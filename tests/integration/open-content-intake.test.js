// @vitest-environment happy-dom
/*
 * The first open-licensed lesson, from the artifact to the learner.
 *
 * The artifact mixes CC BY text transcribed from COERLL with original DeutschFlow German
 * and Arabic that no educator has reviewed. Almost every test here is about keeping those
 * two apart: both are imported, only the first is shown, and neither fact is taken on
 * trust — the store is asked directly, and so is the published view every service reads
 * through.
 *
 * What this proves:
 *   - the artifact validates, and is refused when its licence, provenance or media claims
 *     do not hold up
 *   - reviewed rows import and reach a learner through the real journey
 *   - unreviewed rows import, stay `draft`, and are invisible to every service
 *   - CC BY provenance and attribution survive into the store
 *   - deterministic scoring works on the published exercises
 *   - the remote media asset stays remote and is never offline-playable
 *   - a second identical import writes nothing at all
 *   - Nicos, Netzwerk and every learner/SRS row are untouched
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
import { flattenRows, planImport } from "../../tools/intake/import.js";
import {
  LICENCE_MARKER, buildOpenContentLesson, validateOpenContent, verifyExerciseAnswerKeys
} from "../../tools/intake/map-open-content.js";
import { runOpenContent, readArtifact } from "../../tools/intake/run-open-content.mjs";

/*
 * This suite is about ONE lesson — Familie und Feiern — which is now lesson 2 of the
 * seven-lesson curriculum. It is named here rather than taken from the head of the
 * artifact list, so adding a lesson in front of it cannot silently re-point these tests
 * at different content.
 */
const FAMILY_EVENTS = "00_PROJECT_CONTROL/A2_CONTENT/A2_LESSON_02_FAMILY_EVENTS.json";
import { importNicosWegContent } from "../support/learner-journey-harness.js";

const NOW = 1787356800000;
const PROFILE = "local";

const cleanup = [];
afterEach(async () => {
  document.body.innerHTML = "";
  while (cleanup.length) await cleanup.pop()();
});

const artifact = () => readArtifact(FAMILY_EVENTS);

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter) };
}

const built = (dataset = artifact()) => buildOpenContentLesson({ dataset, now: NOW });

async function imported(options = {}) {
  const store = await freshStore();
  const lesson = built();
  const result = await runOpenContent(store.repositories, lesson, {
    apply: true, now: NOW, profileUuid: PROFILE, ...options
  });
  return { ...store, lesson, result, services: createServices(store.repositories) };
}

/* ====================================================================== */
/* The artifact                                                           */
/* ====================================================================== */

describe("the artifact validates", () => {
  it("passes every licence, provenance and count check", () => {
    const validation = validateOpenContent(artifact());
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it("declares the counts it actually carries", () => {
    const dataset = artifact();
    expect(dataset.recordCounts).toMatchObject({
      courses: 1, units: 1, lessons: 1, lessonSections: 5,
      vocabulary: 19, sentences: 12, grammarTopics: 1, grammarRules: 2,
      exercises: 10, listeningItems: 1, remoteMediaAssets: 1, listeningSegments: 10,
      // Metadata only: an official pronunciation page is cited, nothing is imported.
      pronunciationMetadata: 1
    });
    expect(dataset.vocabulary).toHaveLength(19);
    // Eight deterministic plus two learner-production prompts.
    expect(dataset.exercises).toHaveLength(10);
  });

  it("refuses a source that is not CC BY on an official host", () => {
    const dataset = artifact();
    dataset.sources[0].licence = "all-rights-reserved";
    dataset.sources[1].url = "https://example.com/copy";
    const validation = validateOpenContent(dataset);
    expect(validation.ok).toBe(false);
    expect(validation.errors.map(error => error.code))
      .toEqual(expect.arrayContaining(["source-not-cc-by", "source-host-not-official"]));
  });

  it("refuses an artifact with no changes notice, which CC BY requires", () => {
    const dataset = artifact();
    delete dataset.attributionBundle.changesNotice;
    expect(validateOpenContent(dataset).errors.map(error => error.code))
      .toContain("missing-changes-notice");
  });

  it("refuses a record whose uuid is not the one its source id derives", () => {
    const dataset = artifact();
    dataset.vocabulary[0].uuid = "11111111-2222-3333-4444-555555555555";
    expect(validateOpenContent(dataset).errors.map(error => error.code))
      .toContain("record-uuid-mismatch");
  });

  it("refuses a row that claims to have been reviewed already", () => {
    const dataset = artifact();
    dataset.vocabulary[0].canonicalTarget.item.verifiedBy = "nobody";
    expect(validateOpenContent(dataset).errors.map(error => error.code))
      .toContain("premature-verification");
  });
});

/* ====================================================================== */
/* The media asset                                                        */
/* ====================================================================== */

describe("the remote media asset stays remote", () => {
  it("refuses invented checksum, duration or byte size", () => {
    for (const [field, value] of [["checksum", "sha256:made-up"], ["durationMs", 91000],
      ["byteSize", 4096], ["localPath", "media/eva.mp4"]]) {
      const dataset = artifact();
      dataset.listening.mediaAsset.canonicalTarget.row[field] = value;
      const codes = validateOpenContent(dataset).errors.map(error => error.code);
      expect(codes.some(code => code.startsWith("media-")), field).toBe(true);
    }
  });

  it("registers exactly one asset row, never two", async () => {
    const { repositories, lesson } = await imported();
    const assets = await repositories.audioAssets.all();
    expect(assets).toHaveLength(1);
    expect(assets[0].uuid).toBe(lesson.mapped.listening.audio.uuid);
    // The artifact lists the same row twice; the batch must not add it a second time.
    expect(lesson.mapped.audioAssets).toEqual([]);
  });

  it("is never offline-playable and carries no local binary", async () => {
    const { repositories } = await imported();
    const [asset] = await repositories.audioAssets.all();

    expect(asset.availability).toBe("remote");
    expect(asset.localPath).toBe("");
    expect(asset.checksum).toBeNull();
    expect(asset.durationMs).toBe(0);
    expect(asset.byteSize).toBe(0);
    expect(isPlayableOffline(asset)).toBe(false);
  });

  it("tells the listening screen the audio is not on the device", async () => {
    const { services } = await imported();
    const activity = (await services.listening.activities())
      .find(entry => entry.slug === "eva-geburtstag");
    expect(activity.audio.playableOffline).toBe(false);
    expect(activity.audio.missingReason).toBe("remote-only");
    expect(activity.segments).toHaveLength(10);
  });
});

/* ====================================================================== */
/* The review gate                                                        */
/* ====================================================================== */

describe("unreviewed content is imported but not published", () => {
  it("marks original German and Arabic as draft, and source text as imported", () => {
    const { audit } = built();
    expect(audit.review.publishedRows).toBe(110);
    expect(audit.review.draftRows).toBe(118);
    expect(audit.review.draftByEntity).toMatchObject({
      vocabularyMeanings: 19,     // the Arabic gloss and the original German definition
      sentences: 7,               // sentences whose German DeutschFlow wrote
      grammarTopics: 1, grammarRules: 2, grammarExamples: 7,
      // Four whose answer key is a grammar rule that is itself a draft, plus the two
      // learner-production prompts, which have no answer key to trace at all.
      exercises: 6
    });
    // The English translations are published even though every Arabic meaning is a
    // draft: since schema 11 neither language passes through the other.
    expect(audit.review.publishedByEntity.translations).toBe(19);
    expect(audit.review.draftByEntity.translations).toBeUndefined();
  });

  it("stores every draft row rather than dropping it", async () => {
    const { result, lesson } = await imported();
    const drafts = flattenRows(lesson.mapped)
      .filter(({ row }) => row.contentStatus === "draft");
    expect(drafts.length).toBe(118);
    expect(result.verification.drafts.stored).toBe(118);
    expect(result.verification.drafts.notStored).toEqual([]);
  });

  it("shows no draft row through any service a screen reads from", async () => {
    const { result, services, repositories } = await imported();
    expect(result.verification.drafts.visible).toEqual([]);

    // The same fact, asked of the services rather than of the verification report.
    const draftSentences = (await repositories.sentences.find({ contentStatus: "draft" }))
      .map(row => row.uuid);
    expect(draftSentences.length).toBe(7);
    const readable = (await services.sentences.all()).map(entry => entry.uuid);
    for (const uuid of draftSentences) expect(readable).not.toContain(uuid);

    // Grammar is entirely unreviewed prose, so the grammar screen stays empty.
    expect(await repositories.grammarTopics.count()).toBe(1);
    expect(await services.grammar.topics()).toEqual([]);
  });

  it("withholds a link into unpublished content instead of dangling it", async () => {
    const { lesson, repositories } = await imported();
    expect(lesson.audit.review.withheldLinks).toBeGreaterThan(0);

    // Every lesson item that WAS written points at content a learner can open.
    for (const item of await repositories.lessonItems.all()) {
      const target = await publishedOnly(repositories)[repositoryOf(item.contentType)]
        .get(item.contentUuid);
      expect(target, `${item.contentType} ${item.contentUuid}`).not.toBeNull();
    }
  });

  it("publishes an exercise only when its answer key is source vocabulary", () => {
    const verdicts = verifyExerciseAnswerKeys(artifact());
    expect([...verdicts.entries()].filter(([, ok]) => ok).map(([id]) => id)).toEqual([
      "open-a2:exercise:parents", "open-a2:exercise:gift",
      "open-a2:exercise:invite", "open-a2:exercise:wedding"
    ]);
    // The Perfekt exercises answer to a grammar rule that is still a draft.
    expect(verdicts.get("open-a2:exercise:perfekt-habe")).toBe(false);
  });
});

const repositoryOf = contentType => ({
  vocabulary: "vocabulary", sentence: "sentences", exercise: "exercises",
  listening: "listeningItems", grammar: "grammarRules"
})[contentType] ?? contentType;

/* ====================================================================== */
/* Provenance                                                             */
/* ====================================================================== */

describe("CC BY provenance survives the import", () => {
  it("keeps the licence marker on every content row that cites a source", async () => {
    const { repositories, lesson } = await imported();
    const uuids = new Set(flattenRows(lesson.mapped).map(({ row }) => row.uuid));

    for (const entity of ["vocabulary", "sentences", "exercises", "listeningItems", "courses"]) {
      for (const row of await repositories[entity].all()) {
        if (!uuids.has(row.uuid)) continue;
        expect(row.sourceReference, `${entity} ${row.uuid}`).toContain(LICENCE_MARKER);
        expect(row.sourceType).toBe("cc-by-4.0-open-content");
      }
    }
  });

  it("cites the official COERLL page each row came from", async () => {
    const { repositories } = await imported();
    const word = await repositories.vocabulary.findOne({ german: "Eltern" });
    expect(word.sourceReference).toContain("coerll.utexas.edu");
    expect(word.contentStatus).toBe("imported");
    expect(word.verifiedAt).toBeNull();
  });

  it("carries the attribution and the changes notice into the audit", () => {
    const { audit } = built();
    expect(audit.attributionRequired).toBe(true);
    expect(audit.attributionTexts.length).toBeGreaterThan(0);
    expect(audit.attributionTexts.join(" ")).toContain("COERLL");
    expect(audit.changesNotice).toContain("newly written");
    expect(audit.licenceUrl).toContain("creativecommons.org/licenses/by/4.0");
    // The A2 label is DeutschFlow's, not a claim made by COERLL.
    expect(audit.cefrAssignment.status).toBe("EDITORIAL_A2_ASSIGNMENT");
    expect(audit.cefrAssignment.noSourceLevelClaim).toBe(true);
  });
});

/* ====================================================================== */
/* The learner journey                                                    */
/* ====================================================================== */

describe("a learner can reach the new lesson", () => {
  it("opens the course, the lesson and its sections", async () => {
    const { services } = await imported();
    const course = (await services.curriculum.courses())
      .find(entry => entry.slug === "deutschflow-open-a2");

    expect(course.cefrLevel).toBe("A2");
    const lessons = course.units.flatMap(unit => unit.lessons);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].slug).toBe("familie-und-feiern-perfekt");
    expect(lessons[0].title.de).toBe("Familie und Feiern: über die Vergangenheit sprechen");
    expect(lessons[0].sections.length).toBeGreaterThan(0);
  });

  it("reads the accepted vocabulary, sentences and listening back", async () => {
    const { services, repositories } = await imported();

    const words = await services.content.allEntries();
    const open = words.filter(entry => (entry.level ?? "") === "A2" && entry.german === "Eltern");
    expect(open).toHaveLength(1);
    expect(open[0].article).toBe("die");

    const sentences = await services.sentences.all();
    expect(sentences).toHaveLength(5);            // the five transcribed from the source
    expect(sentences.every(entry => entry.german)).toBe(true);

    const activities = await services.listening.activities();
    expect(activities).toHaveLength(1);
    expect(activities[0].transcript).toBeTruthy();

    // Grammar was all unreviewed prose, so there is none to read.
    expect(await repositories.grammarRules.count()).toBe(2);
    expect(await services.grammar.topics()).toEqual([]);
  });

  it("scores a published exercise deterministically, right and wrong", async () => {
    const { services } = await imported();
    const exercises = await services.exercises.all();
    const exercise = exercises.find(entry => entry.slug === "open-a2-parents");

    expect(exercise.gradeable).toBe(true);
    expect(exercise.expectedAnswers.map(answer => answer.text)).toEqual(["die Eltern"]);
    expect(exercise.answerLanguage).toBe("de");

    const { validateGermanAnswer } =
      await import("../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js");
    const word = { german: "die Eltern", acceptedAnswers: [], itemType: "word", article: null };
    expect(validateGermanAnswer("die Eltern", word).isCorrect).toBe(true);
    expect(validateGermanAnswer("die Kinder", word).isCorrect).toBe(false);
  });

  it("offers only the four exercises whose answers are source vocabulary", async () => {
    const { services } = await imported();
    const slugs = (await services.exercises.all()).map(entry => entry.slug).sort();
    expect(slugs).toEqual([
      "open-a2-gift", "open-a2-invite", "open-a2-parents", "open-a2-wedding"
    ]);
  });

  it("records progress against the lesson and reads it back", async () => {
    const { services, repositories } = await imported();
    const course = (await services.curriculum.courses())
      .find(entry => entry.slug === "deutschflow-open-a2");
    const lesson = course.units.flatMap(unit => unit.lessons)[0];
    const at = NOW + 1000;

    await repositories.write.progress.recordLessonProgress({
      lesson: {
        uuid: `lp:${PROFILE}:${lesson.uuid}`, profileUuid: PROFILE, lessonUuid: lesson.uuid,
        status: "completed", startedAt: at, completedAt: at,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      },
      sections: [],
      course: {
        uuid: `cp:${PROFILE}:${course.uuid}`, profileUuid: PROFILE, courseUuid: course.uuid,
        status: "in_progress", startedAt: at, lastLessonUuid: lesson.uuid,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      }
    }, { now: at });

    const progress = await services.curriculum.progressForCourse(course.slug, PROFILE);
    expect(progress.lessons.find(row => row.uuid === lesson.uuid).status).toBe("completed");
    expect(progress.resume.lessonUuid).toBeDefined();
  });
});

/* ====================================================================== */
/* Import behaviour                                                       */
/* ====================================================================== */

describe("the import behaves like every other intake", () => {
  it("previews every row and writes nothing", async () => {
    const { repositories } = await freshStore();
    const lesson = built();
    const result = await runOpenContent(repositories, lesson, { apply: false, now: NOW });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("preview-only");
    expect(result.plan.create.length).toBe(flattenRows(lesson.mapped).length);
    expect(result.plan.conflicts).toEqual([]);
    expect(await repositories.courses.count()).toBe(0);
    expect(await repositories.vocabulary.count()).toBe(0);
  });

  it("verifies the batch through the services after applying", async () => {
    const { result } = await imported();
    expect(result.applied).toBe(true);
    expect(result.verification.ok).toBe(true);
    expect(result.verification.lesson.slug).toBe("familie-und-feiern-perfekt");
    expect(result.verification.links.missing).toEqual([]);
    expect(result.verification.grammar.missingTopics).toEqual([]);
  });

  it("is a true no-op the second time, writing nothing at all", async () => {
    const store = await freshStore();
    await runOpenContent(store.repositories, built(), { apply: true, now: NOW });

    const snapshot = async () => JSON.stringify(await store.adapter.readCanonical());
    const before = await snapshot();

    const plan = await planImport(store.repositories, built().mapped);
    expect(plan.isNoop).toBe(true);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);

    const second = await runOpenContent(store.repositories, built(), {
      apply: true, now: NOW + 9_000_000
    });
    expect(second.applied).toBe(false);
    expect(second.reason).toBe("no-changes");
    // Byte-identical, revisions and timestamps included.
    expect(await snapshot()).toBe(before);
  });

  it("rolls the whole batch back when a later row fails", async () => {
    const { repositories } = await freshStore();
    const lesson = built();
    // A segment pointing at a listening item that will never exist. It is written well
    // after the course, so the earlier aggregates must not survive either.
    lesson.mapped.listening.segments[0].itemUuid = "does-not-exist";

    await expect(runOpenContent(repositories, lesson, { apply: true, now: NOW }))
      .rejects.toThrow();

    expect(await repositories.courses.count()).toBe(0);
    expect(await repositories.vocabulary.count()).toBe(0);
    expect(await repositories.grammarTopics.count()).toBe(0);
    expect(await repositories.exercises.count()).toBe(0);
  });
});

/* ====================================================================== */
/* Everything that was already there                                      */
/* ====================================================================== */

describe("nothing that already existed is disturbed", () => {
  it("leaves the Nicos lesson byte-identical", async () => {
    const store = await freshStore();
    await importNicosWegContent(store.repositories);
    const before = JSON.stringify(await store.adapter.readCanonical());

    await runOpenContent(store.repositories, built(), { apply: true, now: NOW });

    const after = await store.adapter.readCanonical();
    const nicosCourse = after.courses.find(row => row.slug === "nicos-weg-a2");
    expect(nicosCourse.revision).toBe(1);

    // Every row the Nicos import wrote is still exactly as it was.
    const beforeRows = new Map(Object.entries(JSON.parse(before))
      .flatMap(([entity, rows]) => rows.map(row => [`${entity}:${row.uuid}`, row])));
    for (const [entity, rows] of Object.entries(after)) {
      for (const row of rows) {
        const original = beforeRows.get(`${entity}:${row.uuid}`);
        if (original) expect(row, `${entity} ${row.uuid}`).toEqual(original);
      }
    }
  });

  it("touches no learner or SRS row", async () => {
    const { repositories } = await imported();
    for (const entity of ["profiles", "settings", "cards", "events", "courseProgress",
      "lessonProgress", "sectionProgress", "errorEvents", "pronunciationAttempts"]) {
      expect(await repositories[entity].count(), entity).toBe(0);
    }
  });

  it("adds the lesson to the shipped dataset, published rows only", () => {
    const file = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/data/canonical-content.json");
    const shipped = JSON.parse(fs.readFileSync(file, "utf8"));

    expect(shipped.entities.courses.map(row => row.slug)).toContain("deutschflow-open-a2");
    for (const [entity, rows] of Object.entries(shipped.entities)) {
      for (const row of rows) {
        expect(row.contentStatus ?? "imported", `${entity} ${row.uuid}`).not.toBe("draft");
      }
    }
    /*
     * All twelve of this lesson's sentences ship now: five were transcribed from the
     * source and shipped from the start, and the seven DeutschFlow wrote were released
     * by the educator review. The two groups are still distinguishable by the lifecycle
     * state each carries, which is what the gate was protecting.
     */
    const lessonOne = new Set(built().mapped.sentences.map(entry => entry.sentence.uuid));
    const shippedFromLessonOne = shipped.entities.sentences
      .filter(row => lessonOne.has(row.uuid));
    expect(lessonOne.size).toBe(12);
    expect(shippedFromLessonOne).toHaveLength(12);
    expect(shippedFromLessonOne.filter(row => row.contentStatus === "imported")).toHaveLength(5);
    expect(shippedFromLessonOne.filter(row => row.contentStatus === "verified")).toHaveLength(7);
  });
});
