/*
 * The intake pipeline's pure stages: NORMALIZE, PARSE, VALIDATE, MAP.
 *
 * Every test runs against the committed extraction artifacts rather than the PDF, so
 * the suite is hermetic and a parser change can be diffed against text that never moved.
 *
 * What it defends: nothing is invented. No English appears where the source prints none,
 * no answer key appears where the booklet has none, no level appears that the header
 * does not state, and identity is derived so a re-run cannot duplicate.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasBidiControls, hasPresentationForms, isArabic, normalizationReport,
  normalizeArabicRun, normalizeDigits, normalizeLine, normalizePage, reverseVisualOrder
} from "../../tools/intake/normalize.js";
import {
  parseExercises, parseFooter, parseManuscript, parseTranscript, parseVocabulary
} from "../../tools/intake/parse-nicos-weg.js";
import {
  SEVERITY, mergeValidation, validateExercises, validateManuscript
} from "../../tools/intake/validate.js";
import { IMPORTED_STATUS, mapLesson } from "../../tools/intake/map-canonical.js";
import { SOURCES, SUPPORTS, assertSupports, sourceById, supports } from "../../tools/intake/sources.js";
import { splitPages } from "../../tools/intake/extract.mjs";
import { flattenRows } from "../../tools/intake/import.js";

const NOW = 1775000000000;
const ROOT = process.cwd();

function artifact(sourceId) {
  const dir = path.resolve(ROOT, "tools/intake/artifacts", sourceId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8"));
  return { ...meta, raw: fs.readFileSync(path.join(dir, "raw.txt"), "utf8") };
}

const MANUSCRIPT = "nicos-weg-a2-e2-l1-manuscript";
const EXERCISES = "nicos-weg-a2-e2-l1-exercises";

const manuscriptSource = () => sourceById(MANUSCRIPT);
const exerciseSource = () => sourceById(EXERCISES);
const parsedManuscript = () => parseManuscript(artifact(MANUSCRIPT), manuscriptSource());
const parsedExercises = () => parseExercises(artifact(EXERCISES), exerciseSource());

const mapped = () => mapLesson({
  manuscript: parsedManuscript(),
  exercises: parsedExercises(),
  source: manuscriptSource(),
  exerciseSource: exerciseSource(),
  extraction: artifact(MANUSCRIPT),
  exerciseExtraction: artifact(EXERCISES),
  now: NOW
});

/* ---------------------------------------------------------------- sources */

describe("source registry", () => {
  it("describes only files that are actually in this repository", () => {
    for (const source of SOURCES) {
      expect(fs.existsSync(path.resolve(ROOT, source.path)), source.path).toBe(true);
    }
  });

  it("states what each source does NOT contain, so absence is explicit", () => {
    const manuscript = manuscriptSource();
    expect(manuscript.absent).toContain(SUPPORTS.ENGLISH);
    expect(manuscript.absent).toContain(SUPPORTS.IPA);
    expect(exerciseSource().absent).toContain(SUPPORTS.EXERCISE_ANSWERS);
  });

  it("refuses to produce an entity its source does not support", () => {
    expect(supports(manuscriptSource(), SUPPORTS.ENGLISH)).toBe(false);
    expect(() => assertSupports(manuscriptSource(), SUPPORTS.ENGLISH, "an English translation"))
      .toThrow(/does not support/);
  });
});

/* ------------------------------------------------------------- extraction */

describe("extraction artifacts", () => {
  it("keeps the raw text for audit", () => {
    const raw = artifact(MANUSCRIPT).raw;
    expect(raw).toContain("Nicos Weg");
    expect(raw).toContain("SELMA:");
  });

  it("splits pages on the form feed poppler emits", () => {
    expect(splitPages("one\fTwo\fThree").map(page => page.number)).toEqual([1, 2, 3]);
    expect(splitPages("one\fTwo")[1].text).toBe("Two");
  });

  it("records the page count the source registry claims", () => {
    expect(artifact(MANUSCRIPT).pageCount).toBe(manuscriptSource().pages);
    expect(artifact(EXERCISES).pageCount).toBe(exerciseSource().pages);
  });

  it("ties every artifact to the bytes it came from", () => {
    expect(artifact(MANUSCRIPT).digest).toMatch(/^[0-9a-f]{16}$/);
    expect(artifact(MANUSCRIPT).byteSize).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------ normalizing */

describe("normalization", () => {
  it("removes the bidi wrappers a PDF puts around Arabic", () => {
    const wrapped = "‫بالغ‬";
    expect(hasBidiControls(wrapped)).toBe(true);
    const clean = normalizeArabicRun(wrapped);
    expect(hasBidiControls(clean)).toBe(false);
    expect(clean).toBe("بالغ");
  });

  it("maps presentation forms back to base Arabic letters", () => {
    // ARABIC LETTER BEH ISOLATED FORM + alef + lam + GHAIN FINAL FORM
    const presentation = "ﺑالﻎ";
    expect(hasPresentationForms(presentation)).toBe(true);
    const clean = normalizeArabicRun(presentation);
    expect(hasPresentationForms(clean)).toBe(false);
    expect(clean).toBe("بالغ");
  });

  it("produces the real Arabic gloss from the real source line", () => {
    const entry = parsedManuscript().vocabulary.find(item => item.headword === "erwachsen");
    expect(entry.arabic).toBe("بالغ؛ راشد");
    expect(hasPresentationForms(entry.arabic)).toBe(false);
    expect(hasBidiControls(entry.arabic)).toBe(false);
  });

  it("leaves German untouched, umlauts and ß included", () => {
    const line = "Ich würde meine Familie nie verlassen. Außerdem heißt es „Tschüss!“ …";
    const normalized = normalizeLine(line);
    expect(normalized).toContain("würde");
    expect(normalized).toContain("Außerdem");
    expect(normalized).toContain("heißt");
    // NFKC would have turned this ellipsis into three dots. It must not.
    expect(normalized).toContain("…");
  });

  it("reports that German survived normalization", () => {
    const raw = artifact(MANUSCRIPT).pages[0].text;
    const report = normalizationReport(raw, normalizePage(raw));
    expect(report.germanPreserved).toBe(true);
    expect(report.bidiControlsRemoved).toBe(true);
  });

  it("can reverse visual order for a source that needs it, and does not by default", () => {
    expect(reverseVisualOrder("ba cd")).toBe("dc ab");
    // This publisher emits logical order, so the registry says so and no reversal runs.
    expect(manuscriptSource().arabicVisualOrder).toBe(false);
    expect(normalizeArabicRun("مع")).toBe("مع");
  });

  it("normalizes Arabic-Indic digits to digits", () => {
    expect(normalizeDigits("٢٠٢٦")).toBe("2026");
    expect(normalizeDigits("2026")).toBe("2026");
  });

  it("is deterministic", () => {
    const raw = artifact(MANUSCRIPT).pages[1].text;
    expect(normalizePage(raw)).toBe(normalizePage(raw));
  });
});

/* ---------------------------------------------------------------- parsing */

describe("parsing the manuscript", () => {
  it("reads the course and level the header prints", () => {
    expect(parsedManuscript().course).toMatchObject({
      title: "Nicos Weg", publisher: "Deutsche Welle",
      reference: "dw.com/nico/arabic", cefrLevel: "A2"
    });
  });

  it("reads the episode number and both printed titles", () => {
    expect(parsedManuscript().lesson).toMatchObject({
      number: 2, title: "Familiengeschichten", titleArabic: "العائلة"
    });
    // The handout names no unit. Absent stays absent.
    expect(parsedManuscript().lesson.unitTitle).toBeNull();
  });

  it("reads every speaker-labelled turn in printed order", () => {
    const transcript = parsedManuscript().transcript;
    expect(transcript).toHaveLength(10);
    expect(transcript[0]).toMatchObject({ speaker: "SELMA", ordering: 1, page: 1 });
    expect(transcript[0].german).toContain("Ich bin bei meinem Sprachkurs.");
    expect(transcript.at(-1).speaker).toBe("NICO");
    expect(new Set(transcript.map(turn => turn.speaker))).toEqual(new Set(["SELMA", "NICO"]));
  });

  it("keeps the Arabic summary out of the German dialogue", () => {
    for (const turn of parsedManuscript().transcript) {
      expect(isArabic(turn.german), turn.german).toBe(false);
    }
  });

  it("reads the vocabulary list with its Arabic glosses", () => {
    const vocabulary = parsedManuscript().vocabulary;
    expect(vocabulary).toHaveLength(11);
    expect(vocabulary[0]).toMatchObject({ headword: "ab|hauen", page: 2, ordering: 1 });
    expect(vocabulary[0].arabic).toContain("غادر");
  });

  it("attaches principal parts to the entry they belong to", () => {
    const vocabulary = parsedManuscript().vocabulary;
    expect(vocabulary.find(entry => entry.headword === "ab|hauen").principalParts)
      .toBe("haut ab, haute ab, ist abgehauen");
    expect(vocabulary.find(entry => entry.headword === "streng").principalParts)
      .toBe("strenger, am strengsten");
    expect(vocabulary.find(entry => entry.headword === "bei").principalParts).toBeNull();
  });

  it("records English as absent, never as empty or guessed", () => {
    for (const entry of parsedManuscript().vocabulary) {
      expect(entry.english, entry.headword).toBeNull();
    }
  });

  it("reads the page footer the publisher prints", () => {
    expect(parseFooter("Deutsch zum Mitnehmen | dw.com/nico/arabic | © Deutsche Welle | Seite 1 / 2"))
      .toEqual({ reference: "dw.com/nico/arabic", publisher: "Deutsche Welle", page: 1, pages: 2 });
    expect(parseFooter("not a footer")).toBeNull();
  });

  it("is deterministic", () => {
    expect(JSON.stringify(parsedManuscript())).toBe(JSON.stringify(parsedManuscript()));
  });

  it("returns nothing rather than guessing from an empty page", () => {
    expect(parseTranscript({ number: 1, text: "" })).toEqual([]);
    expect(parseVocabulary([{ number: 1, text: "" }])).toEqual([]);
  });
});

describe("parsing the exercises booklet", () => {
  it("reads all three tasks with their items", () => {
    const exercises = parsedExercises().exercises;
    expect(exercises.map(exercise => exercise.number)).toEqual([1, 2, 3]);
    expect(exercises[0].title).toBe("Was passt zusammen?");
    expect(exercises[0].items.map(item => item.text))
      .toEqual(["ich", "du", "er", "sie", "es", "wir", "ihr", "sie"]);
  });

  it("reads the word bank the booklet prints for task 2", () => {
    expect(parsedExercises().exercises[1].options).toContain("deinem");
    expect(parsedExercises().exercises[1].options).toContain("unserer");
  });

  it("records that the booklet prints no answer key", () => {
    for (const exercise of parsedExercises().exercises) {
      expect(exercise.expected, `Übung ${exercise.number}`).toBeNull();
      expect(exercise.expectedAbsentReason).toBe("no-answer-key-in-source");
    }
  });

  it("keeps the page each task was printed on", () => {
    expect(parsedExercises().exercises.map(exercise => exercise.page)).toEqual([2, 3, 4]);
  });
});

/* ------------------------------------------------------------ validation */

describe("validation flags rather than guesses", () => {
  const result = () => mergeValidation(
    validateManuscript(parsedManuscript(), manuscriptSource()),
    validateExercises(parsedExercises(), exerciseSource())
  );

  it("passes this source with warnings and no errors", () => {
    const validation = result();
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it("counts what a reviewer needs to know", () => {
    expect(result().summary).toMatchObject({
      turns: 10, vocabulary: 11, withoutEnglish: 11, withPrincipalParts: 6,
      exercises: 3, gradeable: 0
    });
    expect(result().summary.speakers.sort()).toEqual(["NICO", "SELMA"]);
  });

  it("warns once per entry that the source prints no English", () => {
    const warnings = result().warnings.filter(entry => entry.code === "english-absent-in-source");
    expect(warnings).toHaveLength(11);
  });

  it("warns that the exercises cannot be graded, and why", () => {
    const warnings = result().warnings.filter(entry => entry.code === "exercise-answers-absent");
    expect(warnings).toHaveLength(3);
    expect(warnings[0].detail).toContain("ungradeable");
  });

  it("warns when a task has fewer options than items", () => {
    const warning = result().warnings.find(entry => entry.code === "exercise-options-incomplete");
    expect(warning.detail).toBe("6 options for 8 items");
  });

  it("errors if Arabic survives with presentation forms", () => {
    const broken = parsedManuscript();
    broken.vocabulary[0].arabic = "ﺑا";
    const issues = validateManuscript(broken, manuscriptSource()).issues;
    expect(issues.some(entry => entry.code === "arabic-presentation-forms")).toBe(true);
    expect(validateManuscript(broken, manuscriptSource()).ok).toBe(false);
  });

  it("errors if an answer appears from a source that prints none", () => {
    const forged = parsedExercises();
    forged.exercises[0].expected = ["mein"];
    const validation = validateExercises(forged, exerciseSource());
    expect(validation.ok).toBe(false);
    expect(validation.issues.some(entry => entry.code === "exercise-answers-invented")).toBe(true);
  });

  it("flags a duplicate headword rather than merging it", () => {
    const doubled = parsedManuscript();
    doubled.vocabulary.push({ ...doubled.vocabulary[0], ordering: 99 });
    const issues = validateManuscript(doubled, manuscriptSource()).issues;
    const duplicate = issues.find(entry => entry.code === "duplicate-headword");
    expect(duplicate.severity).toBe(SEVERITY.WARNING);
  });

  it("errors when a required identity is missing", () => {
    const nameless = parsedManuscript();
    nameless.lesson.title = null;
    expect(validateManuscript(nameless, manuscriptSource()).ok).toBe(false);
  });
});

/* ---------------------------------------------------------------- mapping */

describe("canonical mapping", () => {
  it("derives identity, so the same source always produces the same uuids", () => {
    const first = mapLesson({
      manuscript: parsedManuscript(), exercises: parsedExercises(),
      source: manuscriptSource(), exerciseSource: exerciseSource(),
      extraction: artifact(MANUSCRIPT), exerciseExtraction: artifact(EXERCISES), now: NOW
    });
    const later = mapLesson({
      manuscript: parsedManuscript(), exercises: parsedExercises(),
      source: manuscriptSource(), exerciseSource: exerciseSource(),
      extraction: artifact(MANUSCRIPT), exerciseExtraction: artifact(EXERCISES),
      now: NOW + 9_000_000        // a different clock must not change identity
    });
    expect(later.keys).toEqual(first.keys);
    expect(flattenRows(later).map(entry => entry.uuid ?? entry.row.uuid))
      .toEqual(flattenRows(first).map(entry => entry.uuid ?? entry.row.uuid));
  });

  it("stamps provenance down to the printed page", () => {
    const result = mapped();
    const entry = result.vocabulary[0];
    expect(entry.item.sourceReference).toContain("Seite 2");
    expect(entry.item.sourceReference).toContain("dw.com/nico/arabic");
    expect(entry.item.sourceType).toBe("manuscript");
    expect(entry.item.createdAt).toBe(NOW);
  });

  it("marks imported content as imported, not verified", () => {
    const result = mapped();
    expect(result.course.course.contentStatus).toBe(IMPORTED_STATUS);
    expect(result.course.course.verifiedAt).toBeNull();
    expect(result.course.course.verifiedBy).toBeNull();
  });

  it("creates no English row at all", () => {
    const result = mapped();
    expect(result.vocabulary.every(entry => entry.translations.length === 0)).toBe(true);
    expect(flattenRows(result).filter(entry => entry.entity === "translations")).toEqual([]);
    expect(flattenRows(result).filter(entry => entry.row.language === "en")).toEqual([]);
  });

  it("carries the Arabic gloss as a meaning, and the German as the scoreable answer", () => {
    const entry = mapped().vocabulary.find(item => item.item.german === "erwachsen");
    expect(entry.meanings[0].arabicText).toBe("بالغ؛ راشد");
    expect(entry.acceptedAnswers[0]).toMatchObject({ language: "de", text: "erwachsen", scoreable: 1 });
  });

  it("strips the separable-verb pipe from an answer but not from the headword", () => {
    const entry = mapped().vocabulary.find(item => item.item.german === "ab|hauen");
    expect(entry.acceptedAnswers[0].text).toBe("abhauen");
  });

  it("turns each dialogue turn into a segment with its speaker", () => {
    const listening = mapped().listening;
    expect(listening.segments).toHaveLength(10);
    expect(listening.speakers.map(speaker => speaker.label)).toEqual(["SELMA", "NICO"]);
    expect(listening.segments[0].speakerUuid).toBe(listening.speakers[0].uuid);
    // No timecodes are printed, so none are invented.
    expect(listening.segments.every(segment => segment.startMs === 0 && segment.endMs === 0)).toBe(true);
  });

  it("registers no audio asset, because no audio file for this episode is in the repo", () => {
    expect(mapped().listening.audio).toBeNull();
    expect(mapped().listening.item.audioUuid).toBeNull();
  });

  it("imports the booklet's tasks with no expected answer", () => {
    const fromSource = mapped().exercises.filter(entry =>
      entry.exercise.sourceType === "exercises");
    expect(fromSource).toHaveLength(3);
    for (const entry of fromSource) {
      expect(entry.options.every(option => option.isExpected === 0), entry.exercise.slug).toBe(true);
    }
  });

  it("labels the vocabulary-recall exercises as derived, with both strings from the page", () => {
    const derived = mapped().exercises.filter(entry =>
      entry.exercise.sourceType === "derived-from-vocabulary");
    expect(derived).toHaveLength(11);

    const one = derived.find(entry => entry.options[0].text === "erwachsen");
    // Prompt is the Arabic gloss verbatim; the answer is the German headword verbatim.
    expect(one.texts.find(text => text.language === "ar").text).toBe("بالغ؛ راشد");
    expect(one.options[0]).toMatchObject({ text: "erwachsen", language: "de", isExpected: 1, scoreable: 1 });
    // Arabic is the prompt, never a scoreable answer.
    expect(one.options.some(option => option.language === "ar")).toBe(false);
  });

  it("hangs the lesson's content on its sections", () => {
    const result = mapped();
    expect(result.course.sections.map(section => section.slug))
      .toEqual(["dialog", "wortschatz", "uebungen"]);
    const types = new Set(result.course.items.map(item => item.contentType));
    expect(types).toEqual(new Set(["listening", "vocabulary", "exercise"]));
  });

  it("reports what it produced", () => {
    expect(mapped().stats).toMatchObject({
      vocabulary: 11, sentences: 10, segments: 10, speakers: 2,
      exercisesFromSource: 3, exercisesDerived: 11, englishTexts: 0
    });
  });
});
