// @vitest-environment happy-dom
/*
 * The five confirmed defects, and the shapes that produced them.
 *
 * Each of these shipped once. Four were content mistakes; the fifth — two different words
 * collapsing onto one row — was the authoring engine losing a lexeme, and would have
 * recurred on the next pair of words that happen to share a surface form. So this file
 * guards the engine's identity rule as well as the five corrections themselves.
 *
 * It reads `data/canonical-content.json`, the file the browser downloads, because a fix
 * that is true of the source but not of the artefact is not a fix.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { assertNoCollisions, vocabularyKey } from "../../tools/curriculum/build-lesson.js";
import { A1 } from "../../tools/curriculum/a1.js";
import { A2_EXTRA } from "../../tools/curriculum/a2.js";
import { readShippedContent } from "../support/learner-journey-harness.js";

let entities;
let vocabulary;
let byLesson;

/** Every vocabulary entry a given lesson shows, with its article and Arabic meaning. */
function wordsIn(slug) {
  return byLesson.get(slug) ?? [];
}

beforeAll(() => {
  entities = readShippedContent().entities;
  const alive = rows => (rows ?? []).filter(row => !row.deleted);

  vocabulary = new Map(alive(entities.vocabularyItems).map(row => [row.uuid, row]));
  const meaning = new Map();
  for (const row of alive(entities.vocabularyMeanings)) meaning.set(row.vocabUuid, row.arabicText);

  const sections = new Map(alive(entities.lessonSections).map(row => [row.uuid, row]));
  const lessons = new Map(alive(entities.lessons).map(row => [row.uuid, row]));

  byLesson = new Map();
  for (const item of alive(entities.lessonItems)) {
    if (item.contentType !== "vocabulary") continue;
    const section = sections.get(item.sectionUuid);
    const lesson = section ? lessons.get(section.lessonUuid) : null;
    const word = vocabulary.get(item.contentUuid);
    if (!lesson || !word) continue;
    if (!byLesson.has(lesson.slug)) byLesson.set(lesson.slug, []);
    byLesson.get(lesson.slug).push({
      german: word.german, article: word.article, plural: word.plural,
      arabic: meaning.get(word.uuid) ?? null
    });
  }
});

describe("RC-1 — two words that look alike stay two words", () => {
  it("keeps `der Morgen` and `morgen` apart, each in its own lesson", () => {
    const routine = wordsIn("a1-l09-tagesablauf");
    const noun = routine.find(word => word.german === "Morgen");

    expect(noun, "a1-l09 must teach the noun").toBeTruthy();
    expect(noun.article).toBe("der");
    expect(noun.plural).toBe("Morgen");
    expect(noun.arabic).toBe("الصباح");

    /* And the adverb must not have followed it into the daily-routine lesson. */
    expect(routine.filter(word => word.german === "morgen")).toEqual([]);

    const week = wordsIn("a1-l06-woche");
    const adverb = week.find(word => word.german === "morgen");
    expect(adverb, "a1-l06 must still teach the adverb").toBeTruthy();
    expect(adverb.article).toBeNull();
    expect(adverb.arabic).toBe("غداً");
  });

  it("keeps temporal `als` and comparative `als` apart", () => {
    const past = wordsIn("a2-l16-praeteritum").filter(word => word.german === "als");
    const comparison = wordsIn("a2-l12-vergleich").filter(word => word.german === "als");

    expect(past).toHaveLength(1);
    expect(past[0].arabic).toBe("عندما (للماضي)");

    expect(comparison).toHaveLength(1);
    expect(comparison[0].arabic).toBe("من (في المقارنة)");
  });

  it("shows no lesson the same German word twice", () => {
    /* The superseded item left behind by an identity change looks exactly like this. */
    const doubled = [];
    for (const [slug, words] of byLesson) {
      const counts = new Map();
      for (const word of words) counts.set(word.german, (counts.get(word.german) ?? 0) + 1);
      for (const [german, count] of counts) {
        if (count > 1) doubled.push(`${slug}: ${german} ×${count}`);
      }
    }
    expect(doubled).toEqual([]);
  });

  it("derives identity from the sense, so a future collision cannot merge silently", () => {
    const bare = { de: "Morgen" };
    const sensed = { de: "Morgen", sense: "noun" };
    expect(vocabularyKey("c", bare)).not.toBe(vocabularyKey("c", sensed));
    /* An entry without a sense keeps the identity it already had. */
    expect(vocabularyKey("c", bare)).toBe("c:morgen");
  });

  it("refuses to build a level in which two different words would collapse", () => {
    /* The guard, proven on a level built for the purpose rather than on the real one. */
    const colliding = {
      cefr: "A1", units: [{ lessons: [{ slug: "x", vocabulary: [
        { de: "Weg", article: "der", ar: "الطريق" },
        { de: "weg", ar: "بعيداً" }
      ] }] }]
    };
    expect(() => assertNoCollisions(colliding, "c"))
      .toThrow(/vocabulary identity collision/);

    /* Resolved by a sense, the same level builds. */
    colliding.units[0].lessons[0].vocabulary[0].sense = "noun";
    expect(() => assertNoCollisions(colliding, "c")).not.toThrow();
  });

  it("passes the guard on both real levels", () => {
    expect(() => assertNoCollisions(A1, "deutschflow-a1")).not.toThrow();
    expect(() => assertNoCollisions(A2_EXTRA, "deutschflow-open-a2")).not.toThrow();
  });
});

describe("RC-2 — the formal email is laid out like a letter", () => {
  it("carries real line breaks, not the characters backslash-n", () => {
    const rule = entities.grammarRules.find(
      row => row.slug === "deutschflow-open-a2-formelle-email-email-aufbau");
    expect(rule).toBeTruthy();

    const formation = entities.grammarTexts.find(
      row => row.ownerUuid === rule.uuid && row.kind === "formation" && row.language === "de");
    expect(formation).toBeTruthy();

    const backslashN = String.fromCharCode(92) + "n";
    expect(formation.text.includes(backslashN)).toBe(false);

    const lines = formation.text.split("\n").map(line => line.trim()).filter(Boolean);
    expect(lines[0]).toBe("Sehr geehrte Damen und Herren,");
    expect(lines).toContain("Mit freundlichen Grüßen");
    expect(lines[lines.length - 1]).toBe("Amir Hassan");
    expect(lines.length).toBeGreaterThanOrEqual(5);   // salutation, reason, request, close, name
  });

  it("ships no learner-facing string containing the characters backslash-n", () => {
    const backslashN = String.fromCharCode(92) + "n";
    const offenders = [];
    for (const [entity, rows] of Object.entries(entities)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row.deleted) continue;
        for (const [field, value] of Object.entries(row)) {
          if (typeof value === "string" && value.includes(backslashN)) {
            offenders.push(`${entity}.${field}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("a noun is never labelled with its article twice", () => {
  /*
   * Entries disagree about where the article lives: most carry a bare `german` plus an
   * `article` column, two dozen A2 words carry it in both. Concatenating blindly produced
   * "der der Grund" on nine of the ten authored A2 lessons. The renderer is tolerant of
   * either shape, and this holds it that way — through the real controller and the real
   * shipped content, because that is where the doubling was visible.
   */
  it("labels every vocabulary item in every lesson without a doubled article", async () => {
    const { bootLocalLearnerHarness } = await import("../support/learner-journey-harness.js");
    const harness = await bootLocalLearnerHarness();

    const doubled = [];
    for (const slug of ["deutschflow-a1", "deutschflow-open-a2"]) {
      await harness.act("learn-course", { slug });
      const listed = await harness.navigate("learn-courses");

      for (const lesson of listed.data.course.units.flatMap(unit => unit.lessons)) {
        await harness.act("learn-open-lesson", { lesson: lesson.uuid });
        const { data } = await harness.navigate("learn-courses");

        for (const item of data.lesson.sections.flatMap(section => section.items)) {
          if (item.contentType !== "vocabulary") continue;
          const title = data.labels?.[item.contentUuid]?.title ?? "";
          if (/^(der der|die die|das das)/i.test(title)) {
            doubled.push(`${lesson.slug}: ${title}`);
          }
        }
      }
    }
    expect(doubled).toEqual([]);
    /*
     * Walking every lesson of both courses through the real controller takes about a
     * second on its own, and rather longer when seventy-eight files are running beside it.
     * The default five-second budget was enough in isolation and occasionally was not
     * under load, which made this the one unreliable gate in the suite. The work is
     * genuinely this size, so the budget says so instead.
     */
  }, 30_000);
});

describe("RC-3, RC-4, RC-5 — every graded answer is the only right one, and is taught", () => {
  /** The prompt, instruction and expected answers of one exercise, by slug. */
  function exercise(slug) {
    const row = entities.exercises.find(entry => entry.slug === slug && !entry.deleted);
    if (!row) return null;
    const texts = {};
    for (const text of entities.exerciseTexts) {
      if (text.exerciseUuid === row.uuid && !text.deleted) texts[`${text.kind}:${text.language}`] = text.text;
    }
    const expected = entities.exerciseOptions
      .filter(option => option.exerciseUuid === row.uuid && !option.deleted && option.isExpected)
      .map(option => option.text);
    return { row, texts, expected };
  }

  it("RC-3: the preposition gap became a case gap with one answer", () => {
    const item = exercise("deutschflow-a1-a1-l14-wo-ist-4");
    expect(item).toBeTruthy();
    /* The old frame accepted only `unter` where neben/vor/hinter/auf were equally right. */
    expect(item.texts["prompt:de"]).toBe("Die Tasche ist unter ___ Bett.");
    expect(item.expected).toEqual(["dem"]);
  });

  it("RC-4: the clock prompt no longer also means `die Stunde`", () => {
    const item = exercise("deutschflow-a1-a1-l05-uhrzeit-5");
    expect(item).toBeTruthy();
    expect(item.expected).toEqual(["die Uhr"]);

    const prompt = item.texts["prompt:ar"];
    expect(prompt).not.toBe("الساعة");
    expect(prompt).toContain("الجهاز");

    /* `die Stunde` is still taught in the same lesson — that is why the prompt had to say
       which sense it wants, rather than the answer list being widened. */
    expect(wordsIn("a1-l05-uhrzeit").map(word => word.german)).toContain("Stunde");
  });

  it("RC-5: every weekday is taught, and the graded weekday answer is one of them", () => {
    const taught = new Set(wordsIn("a1-l06-woche").map(word => word.german));
    for (const day of ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag",
      "Samstag", "Sonntag"]) {
      expect(taught, `weekday ${day}`).toContain(day);
    }

    const item = exercise("deutschflow-a1-a1-l06-woche-6");
    expect(item).toBeTruthy();
    expect(item.expected).toHaveLength(1);
    expect(taught, "the graded answer must be a word the lesson teaches")
      .toContain(item.expected[0]);
  });

  it("RC-5: the months the lesson promises are actually delivered", () => {
    const taught = new Set(wordsIn("a1-l06-woche").map(word => word.german));
    for (const month of ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
      "August", "September", "Oktober", "November", "Dezember"]) {
      expect(taught, `month ${month}`).toContain(month);
    }
  });
});
