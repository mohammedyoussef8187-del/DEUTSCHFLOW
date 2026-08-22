// @vitest-environment happy-dom
/*
 * The second open-licensed lesson: Reisen planen und von Reisen erzählen.
 *
 * It goes through the SAME adapter, the same review gate and the same intake path as
 * lesson 1, so most of what needs proving is that nothing was special-cased for it. What
 * is genuinely new is that its artifact records provenance in a different shape — field
 * names rather than language codes, and origins that qualify themselves in prose — and
 * that it lands in a course that already exists.
 *
 * What this proves:
 *   - the artifact validates and imports through the production path
 *   - the course, level and course titles lesson 1 created are REUSED, not rewritten
 *   - source-transcribed text publishes; DeutschFlow's own wording stays draft
 *   - a verified English translation is published while its Arabic is still a draft
 *   - deterministic scoring works on the exercises whose answers are source vocabulary
 *   - the remote interview stays remote-only
 *   - a second identical import writes nothing
 *   - Nicos, Netzwerk, lesson 1 and every learner/SRS row are untouched
 */

import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { isPlayableOffline } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";
import { validateGermanAnswer } from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { flattenRows, planImport } from "../../tools/intake/import.js";
import {
  LICENCE_MARKER, buildOpenContentLesson, originFor, validateOpenContent
} from "../../tools/intake/map-open-content.js";
import {
  OPEN_CONTENT_ARTIFACTS, readArtifact, runOpenContent
} from "../../tools/intake/run-open-content.mjs";
import { importNicosWegContent } from "../support/learner-journey-harness.js";

const NOW = 1787356800000;
const PROFILE = "local";
/*
 * Named rather than taken by position: this suite is about the travel lesson and the one
 * before it, which are lessons 2 and 3 of the seven-lesson curriculum. Indexing into the
 * artifact list would re-point these tests at different content the moment a lesson is
 * added in front of them.
 */
const LESSON_ONE = "00_PROJECT_CONTROL/A2_CONTENT/A2_LESSON_02_FAMILY_EVENTS.json";
const LESSON_TWO = "00_PROJECT_CONTROL/A2_CONTENT/A2_LESSON_03_TRAVEL.json";
const PAIR = Object.freeze([LESSON_ONE, LESSON_TWO]);

const cleanup = [];
afterEach(async () => {
  document.body.innerHTML = "";
  while (cleanup.length) await cleanup.pop()();
});

const artifact = (file = LESSON_TWO) => readArtifact(file);
const built = (file = LESSON_TWO) =>
  buildOpenContentLesson({ dataset: artifact(file), now: NOW });

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter) };
}

/** Both lessons, in order, the way the runner imports them. */
async function importedBoth() {
  const store = await freshStore();
  const results = [];
  for (const file of PAIR) {
    results.push(await runOpenContent(store.repositories, built(file), {
      apply: true, now: NOW, profileUuid: PROFILE
    }));
  }
  return { ...store, results, services: createServices(store.repositories) };
}

describe("the lesson 2 artifact", () => {
  it("validates against the same rules as lesson 1", () => {
    const validation = validateOpenContent(artifact());
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it("declares the counts it carries", () => {
    expect(artifact().recordCounts).toMatchObject({
      lessons: 1, lessonSections: 5, vocabulary: 20, sentences: 12,
      grammarTopics: 1, grammarRules: 2, exercises: 10,
      listeningItems: 1, remoteMediaAssets: 1, listeningSegments: 4,
      // An official pronunciation page is cited; nothing phonetic is imported.
      pronunciationMetadata: 1
    });
  });

  it("records provenance by field name, and is read anyway", () => {
    const dataset = artifact();
    const word = dataset.vocabulary[0];
    // No `languageOrigins` at all — this artifact uses `fieldOrigins`.
    expect(word.languageOrigins).toBeUndefined();
    expect(word.fieldOrigins.german).toBe("source-transcribed");

    expect(originFor(word, "de")).toBe("source-transcribed");
    expect(originFor(word, "en")).toBe("source-transcribed");
    expect(originFor(word, "ar")).toBe("original-translation");
  });

  it("treats a qualified source origin as still coming from the source", () => {
    const listening = artifact().listening.item;
    expect(originFor(listening, "de")).toContain("source-adapted");
    // And a label the artifact says it wrote itself is not mistaken for source text.
    expect(originFor(listening, "de", "title")).toBe("original");
  });
});

describe("the review gate applies unchanged", () => {
  it("publishes source-transcribed text and holds DeutschFlow's own wording", () => {
    const { audit } = built();
    expect(audit.review.publishedByEntity).toMatchObject({
      vocabularyItems: 20,
      translations: 20,        // English, published even though every Arabic is a draft
      sentences: 8,            // the eight transcribed or adapted from the interview
      exercises: 4
    });
    expect(audit.review.draftByEntity).toMatchObject({
      vocabularyMeanings: 20,  // Arabic gloss plus the original German definition
      sentences: 4,            // the four DeutschFlow wrote
      grammarTopics: 1, grammarRules: 2, grammarExamples: 7,
      // Four keyed to a grammar rule that is itself a draft, plus the two
      // learner-production prompts, which have no answer key to trace at all.
      exercises: 6
    });
    expect(audit.review.publishedRows + audit.review.draftRows).toBe(216);
  });

  it("stores every draft row and shows none of them", async () => {
    const { results } = await importedBoth();
    const lessonTwo = results[1];
    expect(lessonTwo.verification.drafts.stored).toBe(110);
    expect(lessonTwo.verification.drafts.notStored).toEqual([]);
    expect(lessonTwo.verification.drafts.visible).toEqual([]);
  });

  it("keeps the English translation of a word whose Arabic is a draft", async () => {
    const { services, repositories } = await importedBoth();
    const entries = await services.content.allEntries();
    const reise = entries.find(entry => entry.german === "Reise");

    expect(reise.primary.english).toBeTruthy();
    expect(reise.primary.arabic).toBeNull();
    // The Arabic is in the store, waiting for an educator; it is not lost.
    expect(await repositories.meanings.count({ vocabUuid: reise.uuid })).toBe(1);
  });
});

describe("lesson 2 joins the course lesson 1 created", () => {
  it("reuses the course, level and course titles rather than rewriting them", async () => {
    const store = await freshStore();
    await runOpenContent(store.repositories, built(LESSON_ONE), { apply: true, now: NOW });

    const courseBefore = await store.repositories.courses.findOne({ slug: "deutschflow-open-a2" });
    const plan = await planImport(store.repositories, built(LESSON_TWO).mapped);

    // Exactly the shared rows: the course, its CEFR level and its three titles.
    expect(plan.unchanged).toHaveLength(5);
    expect(plan.update).toEqual([]);
    expect(plan.conflicts).toEqual([]);

    await runOpenContent(store.repositories, built(LESSON_TWO), { apply: true, now: NOW });
    expect(await store.repositories.courses.findOne({ slug: "deutschflow-open-a2" }))
      .toEqual(courseBefore);
  });

  it("adds its own unit rather than joining the previous lesson's unit", async () => {
    const { services } = await importedBoth();
    const course = (await services.curriculum.courses())
      .find(entry => entry.slug === "deutschflow-open-a2");

    expect(course.units).toHaveLength(2);
    const lessons = course.units.flatMap(unit => unit.lessons);
    expect(lessons.map(lesson => lesson.slug).sort()).toEqual([
      "familie-und-feiern-perfekt", "reisen-planen-und-erzaehlen"
    ]);
    // Each lesson sits in its own unit.
    expect(course.units.every(unit => unit.lessons.length === 1)).toBe(true);
  });

  it("carries the CC BY licence marker and the COERLL citation into every row", async () => {
    const { repositories } = await importedBoth();
    const uuids = new Set(flattenRows(built().mapped).map(({ row }) => row.uuid));

    for (const entity of ["vocabulary", "sentences", "exercises", "listeningItems"]) {
      for (const row of await repositories[entity].all()) {
        if (!uuids.has(row.uuid)) continue;
        expect(row.sourceReference, `${entity} ${row.uuid}`).toContain(LICENCE_MARKER);
        expect(row.sourceType).toBe("cc-by-4.0-open-content");
      }
    }
    const word = await repositories.vocabulary.findOne({ german: "Reise" });
    expect(word.sourceReference).toContain("coerll.utexas.edu");
    expect(word.verifiedAt).toBeNull();
  });
});

describe("a learner can use lesson 2", () => {
  it("opens the lesson with its published sections and items", async () => {
    const { services } = await importedBoth();
    const course = (await services.curriculum.courses())
      .find(entry => entry.slug === "deutschflow-open-a2");
    const lesson = course.units.flatMap(unit => unit.lessons)
      .find(entry => entry.slug === "reisen-planen-und-erzaehlen");

    expect(lesson.title.de).toBe("Reisen planen und von Reisen erzählen");
    expect(lesson.sections.length).toBeGreaterThan(0);
    const items = lesson.sections.flatMap(section => section.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some(item => item.contentType === "exercise")).toBe(true);
  });

  it("scores its exercises deterministically", async () => {
    const { services } = await importedBoth();
    const exercises = (await services.exercises.all())
      .filter(entry => entry.slug.startsWith("open-a2-l02-"));

    expect(exercises).toHaveLength(4);
    for (const exercise of exercises) {
      expect(exercise.gradeable).toBe(true);
      expect(exercise.answerLanguage).toBe("de");
      const expected = exercise.expectedAnswers[0].text;
      const word = { german: expected, acceptedAnswers: [], itemType: "word", article: null };
      expect(validateGermanAnswer(expected, word).isCorrect, exercise.slug).toBe(true);
      expect(validateGermanAnswer(`${expected} xyz`, word).isCorrect, exercise.slug).toBe(false);
    }
  });

  it("shows the travel interview with its transcript and no playable audio", async () => {
    const { services, repositories } = await importedBoth();
    const activity = (await services.listening.activities())
      .find(entry => entry.slug === "jan-reisen");

    expect(activity.segments).toHaveLength(4);
    expect(activity.audio.playableOffline).toBe(false);
    expect(activity.audio.missingReason).toBe("remote-only");

    const asset = await repositories.audioAssets.get(built().mapped.listening.audio.uuid);
    expect(asset.availability).toBe("remote");
    expect(asset.localPath).toBe("");
    expect(asset.checksum).toBeNull();
    expect(asset.durationMs).toBe(0);
    expect(isPlayableOffline(asset)).toBe(false);
  });

  it("refuses invented technical metadata for the interview", () => {
    for (const [field, value] of [["checksum", "sha256:invented"], ["durationMs", 120000],
      ["localPath", "media/jan.mp4"]]) {
      const dataset = artifact();
      dataset.listening.mediaAsset.canonicalTarget.row[field] = value;
      expect(validateOpenContent(dataset).errors.some(error => error.code.startsWith("media-")),
        field).toBe(true);
    }
  });
});

describe("importing lesson 2 disturbs nothing", () => {
  it("is a byte-identical no-op the second time", async () => {
    const store = await importedBoth();
    const snapshot = async () => JSON.stringify(await store.adapter.readCanonical());
    const before = await snapshot();

    for (const file of PAIR) {
      const plan = await planImport(store.repositories, built(file).mapped);
      expect(plan.isNoop, file).toBe(true);
      const again = await runOpenContent(store.repositories, built(file), {
        apply: true, now: NOW + 9_000_000
      });
      expect(again.applied, file).toBe(false);
      expect(again.reason, file).toBe("no-changes");
    }
    expect(await snapshot()).toBe(before);
  });

  it("leaves Nicos content byte-identical", async () => {
    const store = await freshStore();
    await importNicosWegContent(store.repositories);
    const before = JSON.parse(JSON.stringify(await store.adapter.readCanonical()));

    for (const file of PAIR) {
      await runOpenContent(store.repositories, built(file), { apply: true, now: NOW });
    }

    const after = await store.adapter.readCanonical();
    const originals = new Map(Object.entries(before)
      .flatMap(([entity, rows]) => rows.map(row => [`${entity}:${row.uuid}`, row])));
    for (const [entity, rows] of Object.entries(after)) {
      for (const row of rows) {
        const original = originals.get(`${entity}:${row.uuid}`);
        if (original) expect(row, `${entity} ${row.uuid}`).toEqual(original);
      }
    }
    expect(await store.repositories.courses.findOne({ slug: "nicos-weg-a2" })).toBeTruthy();
  });

  it("rolls the whole batch back when a later row fails", async () => {
    const { repositories } = await freshStore();
    const lesson = built();
    lesson.mapped.listening.segments[0].itemUuid = "does-not-exist";

    await expect(runOpenContent(repositories, lesson, { apply: true, now: NOW }))
      .rejects.toThrow();

    expect(await repositories.courses.count()).toBe(0);
    expect(await repositories.vocabulary.count()).toBe(0);
    expect(await repositories.grammarTopics.count()).toBe(0);
  });

  it("writes no learner or SRS row", async () => {
    const { repositories } = await importedBoth();
    for (const entity of ["profiles", "settings", "cards", "events", "courseProgress",
      "lessonProgress", "sectionProgress", "errorEvents", "pronunciationAttempts"]) {
      expect(await repositories[entity].count(), entity).toBe(0);
    }
  });
});
