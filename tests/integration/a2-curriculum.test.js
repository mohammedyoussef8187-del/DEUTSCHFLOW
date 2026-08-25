// @vitest-environment happy-dom
/*
 * The complete seven-lesson A2 curriculum, from the manifest to the learner.
 *
 * Every lesson goes through the SAME adapter, review gate and intake path as the first
 * two did, so what this file has to prove is that seven of them compose: one course, seven
 * units, seven lessons in teaching order, nothing duplicated, nothing unreviewed leaking,
 * and the whole batch still a no-op the second time.
 *
 * The manifest is the source of truth for what belongs in the curriculum, so it is read
 * here rather than restated — a lesson added to the manifest and forgotten in the runner
 * would fail these tests rather than quietly go missing.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { publishedOnly } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import { isPlayableOffline } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";
import { validateGermanAnswer } from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { expectedAnswersFor } from "../../01_APPLICATION/CURRENT_APP/src/services/exercise-service.js";
import { ARABIC, ENGLISH } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import { flattenRows, planImport } from "../../tools/intake/import.js";
import { buildOpenContentLesson, validateOpenContent } from "../../tools/intake/map-open-content.js";
import {
  OPEN_CONTENT_ARTIFACTS, readArtifact, readManifest, runOpenContent
} from "../../tools/intake/run-open-content.mjs";
import { importNicosWegContent } from "../support/learner-journey-harness.js";

const NOW = 1787356800000;
const PROFILE = "local";
const MANIFEST = readManifest();
const LESSONS = [...MANIFEST.lessons].sort((a, b) => a.curriculumOrder - b.curriculumOrder);

const cleanup = [];
afterEach(async () => {
  document.body.innerHTML = "";
  while (cleanup.length) await cleanup.pop()();
});

const built = file => buildOpenContentLesson({ dataset: readArtifact(file), now: NOW });

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter) };
}

/** The whole curriculum, imported in teaching order the way the runner does it. */
async function importedCurriculum(store = null) {
  const target = store ?? await freshStore();
  const results = [];
  for (const file of OPEN_CONTENT_ARTIFACTS) {
    results.push(await runOpenContent(target.repositories, built(file), {
      apply: true, now: NOW, profileUuid: PROFILE
    }));
  }
  return { ...target, results, services: createServices(target.repositories) };
}

const openCourse = async services =>
  (await services.curriculum.courses()).find(entry => entry.slug === "deutschflow-open-a2");

/* ====================================================================== */
/* The manifest                                                           */
/* ====================================================================== */

describe("the curriculum manifest", () => {
  it("declares seven lessons and the runner imports exactly those", () => {
    expect(MANIFEST.lessonCount).toBe(7);
    expect(LESSONS).toHaveLength(7);
    expect(OPEN_CONTENT_ARTIFACTS).toEqual(LESSONS.map(lesson => lesson.datasetPath));
  });

  it("names the seven domains in teaching order", () => {
    expect(LESSONS.map(lesson => lesson.title)).toEqual([
      "Alltag organisieren und einkaufen",
      "Familie und Feiern: über die Vergangenheit sprechen",
      "Reisen planen und von Reisen erzählen",
      "Gesund leben und beim Arzt sprechen",
      "Über Wohnen, Beziehungen und Arbeit sprechen",
      "Über Bildung und umweltbewusstes Handeln sprechen",
      "In der Stadt nach dem Weg fragen und Kultur erleben"
    ]);
  });

  it("carries the totals the datasets actually add up to", () => {
    const summed = { vocabulary: 0, sentences: 0, grammarTopics: 0, grammarRules: 0,
      exercises: 0, listeningItems: 0, remoteMediaAssets: 0, listeningSegments: 0,
      pronunciationMetadata: 0 };
    for (const lesson of LESSONS) {
      for (const key of Object.keys(summed)) summed[key] += lesson.recordCounts[key] ?? 0;
    }
    expect(summed).toEqual({
      vocabulary: 139, sentences: 74, grammarTopics: 7, grammarRules: 14,
      exercises: 70, listeningItems: 7, remoteMediaAssets: 7, listeningSegments: 32,
      pronunciationMetadata: 7
    });
    expect(MANIFEST.totals).toMatchObject(summed);
  });

  it("every dataset validates against the production adapter", () => {
    for (const lesson of LESSONS) {
      const validation = validateOpenContent(readArtifact(lesson.datasetPath));
      expect(validation.errors, lesson.title).toEqual([]);
    }
  });
});

/* ====================================================================== */
/* Import                                                                 */
/* ====================================================================== */

describe("the seven lessons import into one course", () => {
  it("creates one course and seven units, reusing the shared rows", async () => {
    const store = await freshStore();
    const unchanged = [];
    for (const [index, file] of OPEN_CONTENT_ARTIFACTS.entries()) {
      const result = await runOpenContent(store.repositories, built(file), {
        apply: true, now: NOW, profileUuid: PROFILE
      });
      expect(result.applied, file).toBe(true);
      expect(result.plan.conflicts, file).toEqual([]);
      expect(result.plan.update, file).toEqual([]);
      unchanged.push(result.plan.unchanged.length);
      expect(result.verification.ok, file).toBe(true);
      void index;
    }

    // The first lesson creates the course; every later one finds the same five rows —
    // the course, its CEFR level and its three titles — already there and unchanged.
    expect(unchanged).toEqual([0, 5, 5, 5, 5, 5, 5]);
    expect(await store.repositories.courses.count({ slug: "deutschflow-open-a2" })).toBe(1);
    expect(await store.repositories.courseUnits.count()).toBe(7);
    expect(await store.repositories.lessons.count()).toBe(7);
  });

  it("shows all seven lessons in curriculum order, each in its own unit", async () => {
    const { services } = await importedCurriculum();
    const course = await openCourse(services);

    expect(course.units).toHaveLength(7);
    expect(course.units.every(unit => unit.lessons.length === 1)).toBe(true);

    const lessons = course.units.flatMap(unit => unit.lessons);
    expect(lessons.map(lesson => lesson.title.de)).toEqual(LESSONS.map(lesson => lesson.title));
    expect(new Set(lessons.map(lesson => lesson.uuid)).size).toBe(7);
  });

  it("gives every lesson published content to open", async () => {
    const { services } = await importedCurriculum();
    const course = await openCourse(services);

    for (const lesson of course.units.flatMap(unit => unit.lessons)) {
      expect(lesson.sections.length, lesson.slug).toBeGreaterThan(0);
      const items = lesson.sections.flatMap(section => section.items);
      expect(items.length, lesson.slug).toBeGreaterThan(0);
      expect(items.some(item => item.contentType === "exercise"), lesson.slug).toBe(true);
      expect(items.some(item => item.contentType === "vocabulary"), lesson.slug).toBe(true);
    }
  });

  it("writes nothing at all on a second pass over the whole curriculum", async () => {
    const store = await importedCurriculum();
    const snapshot = async () => JSON.stringify(await store.adapter.readCanonical());
    const before = await snapshot();

    for (const file of OPEN_CONTENT_ARTIFACTS) {
      const plan = await planImport(store.repositories, built(file).mapped);
      expect(plan.isNoop, file).toBe(true);
      const again = await runOpenContent(store.repositories, built(file), {
        apply: true, now: NOW + 9_000_000, profileUuid: PROFILE
      });
      expect(again.applied, file).toBe(false);
      expect(again.reason, file).toBe("no-changes");
    }
    expect(await snapshot()).toBe(before);
  });
});

/* ====================================================================== */
/* The review gate                                                        */
/* ====================================================================== */

describe("the publication gate holds across the curriculum", () => {
  it("stores every draft row and shows none of them, in every lesson", async () => {
    const { results } = await importedCurriculum();
    let drafts = 0;
    for (const [index, result] of results.entries()) {
      const where = OPEN_CONTENT_ARTIFACTS[index];
      expect(result.verification.drafts.notStored, where).toEqual([]);
      expect(result.verification.drafts.visible, where).toEqual([]);
      drafts += result.verification.drafts.stored;
    }
    expect(drafts).toBe(692);
  });

  it("keeps every Arabic gloss and the whole grammar in review", async () => {
    const { services, repositories } = await importedCurriculum();

    // Stored, so an educator can review it.
    expect(await repositories.meanings.count()).toBe(139);
    expect(await repositories.grammarTopics.count()).toBe(7);
    expect(await repositories.grammarRules.count()).toBe(14);

    // Invisible, because none of it has been reviewed.
    const readable = publishedOnly(repositories);
    expect(await readable.meanings.count()).toBe(0);
    expect(await services.grammar.topics()).toEqual([]);
  });

  it("imports the pronunciation citation without inventing pronunciation", async () => {
    const { repositories } = await importedCurriculum();

    // Seven lessons each cite an official pronunciation page…
    const cited = OPEN_CONTENT_ARTIFACTS.map(file => built(file).audit.pronunciationMetadata);
    expect(cited.flat()).toHaveLength(7);
    expect(cited.flat().every(entry => entry.learnerReady === false)).toBe(true);
    expect(cited.flat().every(entry => entry.canonicalRows === 0)).toBe(true);

    // …and not one phoneme, IPA string or model recording reaches the store.
    expect(await repositories.pronunciationItems.count()).toBe(0);
    expect(await repositories.pronunciationFeatures.count()).toBe(0);
    expect(await repositories.pronunciationVariants.count()).toBe(0);
  });

  it("refuses a pronunciation record that claims to be learner-ready", () => {
    const dataset = readArtifact(OPEN_CONTENT_ARTIFACTS[0]);
    dataset.pronunciationMetadata[0].learnerReady = true;
    dataset.pronunciationMetadata[0].ipa = "ˈaltaːk";
    const codes = validateOpenContent(dataset).errors.map(error => error.code);
    expect(codes).toContain("pronunciation-claims-learner-ready");
    expect(codes).toContain("pronunciation-metadata-fabricated");
  });

  it("refuses a record the author marked EXCLUDED", () => {
    const dataset = readArtifact(OPEN_CONTENT_ARTIFACTS[0]);
    dataset.vocabulary[0].reviewStatus = "EXCLUDED";
    expect(validateOpenContent(dataset).errors.map(error => error.code))
      .toContain("excluded-record-present");
  });
});

/* ====================================================================== */
/* Scoring                                                                */
/* ====================================================================== */

describe("deterministic scoring across the curriculum", () => {
  it("publishes only exercises whose answer key is published vocabulary", async () => {
    const { services, repositories } = await importedCurriculum();
    const open = entry => (entry.sourceType ?? "") === "cc-by-4.0-open-content";

    // Seventy authored, of which the gate publishes those it can trace.
    expect((await repositories.exercises.all()).filter(open)).toHaveLength(70);
    const visible = (await services.exercises.all())
      .filter(entry => entry.slug.startsWith("open-a2"));
    expect(visible).toHaveLength(48);
    expect(visible.every(entry => entry.gradeable)).toBe(true);
  });

  it("scores every published exercise right and wrong, in German only", async () => {
    const { services } = await importedCurriculum();
    const visible = (await services.exercises.all())
      .filter(entry => entry.slug.startsWith("open-a2"));

    for (const exercise of visible) {
      expect(exercise.answerLanguage, exercise.slug).toBe("de");
      const expected = expectedAnswersFor(exercise);
      expect(expected.length, exercise.slug).toBeGreaterThan(0);
      // The evaluator, not this test, decides — and it must decide both ways.
      const word = { german: expected[0].text, acceptedAnswers: [], itemType: "word", article: null };
      expect(validateGermanAnswer(expected[0].text, word).isCorrect, exercise.slug).toBe(true);
      expect(validateGermanAnswer(`${expected[0].text} nein`, word).isCorrect, exercise.slug)
        .toBe(false);
    }
  });

  it("keeps every learner-production prompt out of the graded set", async () => {
    const { repositories } = await importedCurriculum();
    const production = (await repositories.exercises.find({}))
      .filter(row => row.slug.includes("production"));

    // Fourteen across the curriculum, two per lesson, all still in review.
    expect(production).toHaveLength(14);
    expect(production.every(row => row.contentStatus === "draft")).toBe(true);

    // And none of them has an answer key that could ever grade a learner.
    const options = await repositories.exerciseOptions.all();
    for (const row of production) {
      expect(options.some(option => option.exerciseUuid === row.uuid && option.isExpected),
        row.slug).toBe(false);
    }
  });

  it("never lets an Arabic answer become scoreable", async () => {
    const { repositories } = await importedCurriculum();
    const arabic = (await repositories.acceptedAnswers.find({ language: "ar" }));
    expect(arabic.every(row => row.scoreable === 0)).toBe(true);
  });
});

/* ====================================================================== */
/* Multilingual independence                                              */
/* ====================================================================== */

describe("English stands on its own across the curriculum", () => {
  it("shows the English of all 139 words while every Arabic gloss is in review", async () => {
    const { services } = await importedCurriculum();
    const entries = (await services.content.allEntries())
      .filter(entry => (entry.level ?? "") === "A2");

    const english = entries.filter(entry => entry.primary?.english);
    expect(english).toHaveLength(139);
    expect(entries.every(entry => entry.primary?.arabic == null)).toBe(true);
    expect(english.every(entry => entry.coverage[ENGLISH] === true)).toBe(true);
    expect(english.every(entry => entry.coverage[ARABIC] === false)).toBe(true);
  });

  it("keeps each language's provenance on its own row", async () => {
    const { repositories } = await importedCurriculum();
    const [translation] = await repositories.translations.find({}, { limit: 1 });
    expect(translation.vocabUuid).toBeTruthy();
    // English hangs off the word, never off the Arabic sense it is not waiting for.
    expect(translation.meaningUuid).toBeNull();
    expect(translation.contentStatus).toBe("imported");
    expect(translation.sourceReference).toContain("CC BY 4.0");
  });
});

/* ====================================================================== */
/* Media                                                                  */
/* ====================================================================== */

describe("the seven remote recordings stay remote", () => {
  it("registers each interview once, unplayable, with no invented metadata", async () => {
    const { services, repositories } = await importedCurriculum();

    const activities = (await services.listening.activities())
      .filter(activity => activity.audio.missingReason === "remote-only");
    expect(activities).toHaveLength(7);

    for (const activity of activities) {
      expect(activity.audio.playableOffline, activity.slug).toBe(false);
      const asset = await repositories.audioAssets.get(activity.audio.uuid);
      expect(asset.availability, activity.slug).toBe("remote");
      expect(asset.localPath, activity.slug).toBe("");
      expect(asset.checksum, activity.slug).toBeNull();
      expect(asset.durationMs, activity.slug).toBe(0);
      expect(asset.byteSize, activity.slug).toBe(0);
      expect(isPlayableOffline(asset), activity.slug).toBe(false);
    }
  });
});

/* ====================================================================== */
/* Everything that was already there                                      */
/* ====================================================================== */

describe("the curriculum import disturbs nothing", () => {
  it("leaves Nicos content byte-identical", async () => {
    const store = await freshStore();
    await importNicosWegContent(store.repositories);
    const before = JSON.parse(JSON.stringify(await store.adapter.readCanonical()));

    await importedCurriculum(store);

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

  it("writes no learner or SRS row", async () => {
    const { repositories } = await importedCurriculum();
    for (const entity of ["profiles", "settings", "cards", "events", "courseProgress",
      "lessonProgress", "sectionProgress", "errorEvents", "pronunciationAttempts"]) {
      expect(await repositories[entity].count(), entity).toBe(0);
    }
  });

  it("rolls a lesson back whole when one of its rows fails", async () => {
    const store = await freshStore();
    await runOpenContent(store.repositories, built(OPEN_CONTENT_ARTIFACTS[0]), {
      apply: true, now: NOW
    });
    const before = JSON.stringify(await store.adapter.readCanonical());

    const broken = built(OPEN_CONTENT_ARTIFACTS[1]);
    broken.mapped.listening.segments[0].itemUuid = "does-not-exist";
    await expect(runOpenContent(store.repositories, broken, { apply: true, now: NOW }))
      .rejects.toThrow();

    // The lesson before it survives untouched; the failed one left nothing behind.
    expect(JSON.stringify(await store.adapter.readCanonical())).toBe(before);
    expect(await store.repositories.lessons.count()).toBe(1);
  });
});

/* ====================================================================== */
/* The shipped dataset                                                    */
/* ====================================================================== */

describe("the shipped dataset carries the curriculum", () => {
  const shipped = () => JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/data/canonical-content.json"), "utf8"));

  it("ships the seven lessons and no draft row at all", () => {
    const dataset = shipped();
    const open = row => (row.sourceType ?? "") === "cc-by-4.0-open-content";

    expect(dataset.entities.lessons.filter(open)).toHaveLength(7);
    expect(dataset.entities.courseUnits.filter(open)).toHaveLength(7);
    for (const [entity, rows] of Object.entries(dataset.entities)) {
      for (const row of rows) {
        expect(row.contentStatus ?? "imported", `${entity} ${row.uuid}`).not.toBe("draft");
      }
    }
  });

  it("ships English and Arabic for every word, each on its own row", () => {
    const dataset = shipped();
    const open = row => (row.sourceType ?? "") === "cc-by-4.0-open-content";

    expect(dataset.entities.vocabularyItems.filter(open)).toHaveLength(139);
    expect(dataset.entities.translations.filter(open)).toHaveLength(139);
    /* The Arabic ships now that the educator review released it. Before the review it
       was held back while the English shipped, which is the independence this pair of
       counts has always been here to record. */
    const arabic = (dataset.entities.vocabularyMeanings ?? []).filter(open);
    expect(arabic).toHaveLength(139);
    expect(arabic.every(row => row.contentStatus === "verified")).toBe(true);
    // English was never gated on Arabic and still is not.
    expect(dataset.entities.translations.filter(open)
      .every(row => row.contentStatus === "imported")).toBe(true);
  });

  it("ships no pronunciation row and no playable recording", () => {
    const dataset = shipped();
    expect(dataset.entities.pronunciationItems ?? []).toHaveLength(0);
    expect(dataset.entities.pronunciationFeatures ?? []).toHaveLength(0);
    const remote = dataset.entities.audioAssets.filter(row => row.availability === "remote");
    expect(remote).toHaveLength(7);
    expect(remote.every(row => !isPlayableOffline(row))).toBe(true);
  });
});
