// @vitest-environment happy-dom
/*
 * Release-candidate readiness for the human review that still has to happen.
 *
 * The gates are intentional, so nothing here approves anything. What it proves is that the
 * gates can be WORKED THROUGH: that every held-back row is identifiable and attached to
 * its lesson, that a reviewer can take the queue one language or one content type at a
 * time, that approving a row publishes it without moving its identity, and — the part
 * that was broken — that an import run after approval does not fight the reviewer.
 *
 * It also pins the two things that must stay unproven: the seven remote recordings are
 * checked for structure only and stay technical-review-gated, and pronunciation stays
 * metadata with no phonetic content anywhere.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { publishedOnly } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import { CHANGE, classifyRow, planImport } from "../../tools/intake/import.js";
import { buildOpenContentLesson } from "../../tools/intake/map-open-content.js";
import {
  OPEN_CONTENT_ARTIFACTS, buildOpenContentAudit, describeRemoteMedia, readArtifact, runOpenContent
} from "../../tools/intake/run-open-content.mjs";

const NOW = 1787356800000;
const PROFILE = "local";

const cleanup = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()(); });

const built = file => buildOpenContentLesson({ dataset: readArtifact(file), now: NOW });

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter) };
}

async function importedCurriculum() {
  const store = await freshStore();
  const lessons = [];
  for (const file of OPEN_CONTENT_ARTIFACTS) {
    const lesson = built(file);
    await runOpenContent(store.repositories, lesson, { apply: true, now: NOW, profileUuid: PROFILE });
    lessons.push({ artifact: file, audit: lesson.audit, applied: true, reason: null,
      media: describeRemoteMedia(readArtifact(file), file) });
  }
  return { ...store, lessons, services: createServices(store.repositories) };
}

/* ====================================================================== */
/* The queue a reviewer works from                                        */
/* ====================================================================== */

describe("every gated row is identifiable and attached to its lesson", () => {
  it("lists one entry per held-back row, across all seven lessons", () => {
    const queue = OPEN_CONTENT_ARTIFACTS
      .flatMap(file => built(file).audit.reviewQueue);
    const drafts = OPEN_CONTENT_ARTIFACTS
      .reduce((sum, file) => sum + built(file).audit.review.draftRows, 0);

    expect(queue).toHaveLength(drafts);
    expect(queue).toHaveLength(692);

    /*
     * Six of those are the same row seen twice: every lesson declares the shared course
     * record, so its Arabic title is listed by all seven. The aggregate audit is what a
     * reviewer works from, and it lists each row once.
     */
    expect(new Set(queue.map(entry => entry.uuid)).size).toBe(686);
  });

  it("carries the lesson, the identity and the text of every entry", () => {
    for (const entry of built(OPEN_CONTENT_ARTIFACTS[0]).audit.reviewQueue) {
      expect(entry.uuid, entry.entity).toBeTruthy();
      expect(entry.entity, entry.uuid).toBeTruthy();
      expect(entry.lessonUuid, entry.uuid).toBeTruthy();
      expect(entry.lessonTitle, entry.uuid).toBeTruthy();
      expect(entry.sourceReference, entry.uuid).toContain("CC BY 4.0");
    }
  });

  it("can be split by language and by content type", () => {
    const audit = buildOpenContentAudit(OPEN_CONTENT_ARTIFACTS.map(file => ({
      artifact: file, audit: built(file).audit, applied: true, reason: null,
      media: describeRemoteMedia(readArtifact(file), file)
    })), NOW);

    // Arabic is the largest single block; German and English are reviewable on their own.
    expect(audit.educatorReview.total).toBe(686);
    expect(new Set(audit.educatorReview.queue.map(entry => entry.uuid)).size).toBe(686);
    expect(audit.educatorReview.byLanguage.ar).toBeGreaterThan(0);
    expect(audit.educatorReview.byLanguage.de).toBeGreaterThan(0);
    expect(audit.educatorReview.byLanguage.en).toBeGreaterThan(0);
    expect(audit.educatorReview.byEntity.vocabularyMeanings).toBe(139);
    expect(audit.educatorReview.byEntity.grammarTopics).toBe(7);
    expect(audit.educatorReview.byEntity.grammarRules).toBe(14);
    // And by lesson, so review can be scheduled a lesson at a time.
    expect(Object.keys(audit.educatorReview.byLesson)).toHaveLength(7);
  });

  it("names every Arabic gloss with the German word it belongs to", async () => {
    const { repositories } = await importedCurriculum();
    const queue = OPEN_CONTENT_ARTIFACTS.flatMap(file => built(file).audit.reviewQueue)
      .filter(entry => entry.entity === "vocabularyMeanings");

    expect(queue).toHaveLength(139);
    for (const entry of queue.slice(0, 20)) {
      expect(entry.language).toBe("ar");
      expect(entry.text).toBeTruthy();
      // The stored row it refers to really exists, under the same uuid.
      const stored = await repositories.meanings.get(entry.uuid);
      expect(stored, entry.uuid).not.toBeNull();
      expect(stored.arabicText).toBe(entry.text);
    }
  });
});

/* ====================================================================== */
/* Approving one row                                                      */
/* ====================================================================== */

describe("approval publishes a row without moving its identity", () => {
  it("shows an approved Arabic gloss, leaving every other field alone", async () => {
    const { repositories, services } = await importedCurriculum();
    const [meaning] = await repositories.meanings.find({ contentStatus: "draft" }, { limit: 1 });

    const before = { ...meaning };
    await repositories.meanings.update(meaning.uuid,
      { contentStatus: "verified", verifiedAt: NOW + 1000, verifiedBy: "educator" },
      { now: NOW + 1000 });
    const after = await repositories.meanings.get(meaning.uuid);

    // The identity and the content are untouched; only the lifecycle moved.
    expect(after.uuid).toBe(before.uuid);
    expect(after.vocabUuid).toBe(before.vocabUuid);
    expect(after.arabicText).toBe(before.arabicText);
    expect(after.sourceReference).toBe(before.sourceReference);
    expect(after.contentStatus).toBe("verified");

    // And it is now visible where it was not.
    expect(await publishedOnly(repositories).meanings.get(meaning.uuid)).not.toBeNull();
    const entry = (await services.content.allEntries())
      .find(row => row.uuid === meaning.vocabUuid);
    expect(entry.primary.arabic).toBe(before.arabicText);
  });

  it("publishes Arabic without disturbing the English beside it, and the reverse", async () => {
    const { repositories, services } = await importedCurriculum();
    const [meaning] = await repositories.meanings.find({ contentStatus: "draft" }, { limit: 1 });
    const [translation] = await repositories.translations.find({ vocabUuid: meaning.vocabUuid });

    const englishBefore = { ...translation };
    await repositories.meanings.update(meaning.uuid, { contentStatus: "verified" }, { now: NOW + 1 });
    expect(await repositories.translations.get(translation.uuid)).toEqual(englishBefore);

    const entry = (await services.content.allEntries())
      .find(row => row.uuid === meaning.vocabUuid);
    expect(entry.primary.arabic).toBeTruthy();
    expect(entry.primary.english).toBe(englishBefore.englishText);
    expect(entry.coverage.complete).toBe(true);
  });

  it("still refuses to let Arabic score, approved or not", async () => {
    const { repositories, services } = await importedCurriculum();
    const [meaning] = await repositories.meanings.find({ contentStatus: "draft" }, { limit: 1 });
    await repositories.meanings.update(meaning.uuid, { contentStatus: "verified" }, { now: NOW + 1 });

    const entry = (await services.content.allEntries())
      .find(row => row.uuid === meaning.vocabUuid);
    for (const sense of entry.senses) {
      expect(sense.answers.scoring.every(answer => answer.language !== "ar")).toBe(true);
    }
    const arabic = await repositories.acceptedAnswers.find({ language: "ar" });
    expect(arabic.every(row => row.scoreable === 0)).toBe(true);
  });
});

/* ====================================================================== */
/* Re-import after approval                                               */
/* ====================================================================== */

describe("an import run after approval does not fight the reviewer", () => {
  it("treats a stale draft proposal against an approved row as unchanged", () => {
    const body = {
      uuid: "m-1", vocabUuid: "v-1", arabicText: "بيت", sourceReference: "x",
      contentVersion: 1, sourceType: "cc-by-4.0-open-content"
    };
    const approved = { ...body, contentStatus: "verified" };
    const proposed = { ...body, contentStatus: "draft" };

    // The artifact always proposes where the content STARTED; the reviewer moved it on.
    expect(classifyRow(approved, proposed).change).toBe(CHANGE.UNCHANGED);
    // The other direction is a real change and is written.
    expect(classifyRow(proposed, approved).change).toBe(CHANGE.UPDATE);
  });

  it("still refuses when the source text itself changed under an approved row", () => {
    const approved = {
      uuid: "m-1", vocabUuid: "v-1", arabicText: "بيت", contentStatus: "verified"
    };
    const rewritten = { ...approved, arabicText: "منزل", contentStatus: "draft" };
    const verdict = classifyRow(approved, rewritten);

    expect(verdict.change).toBe(CHANGE.CONFLICT);
    expect(verdict.reason).toContain("reviewed");
  });

  it("re-imports a lesson cleanly after one of its rows was approved", async () => {
    const store = await freshStore();
    const lesson = built(OPEN_CONTENT_ARTIFACTS[0]);
    await runOpenContent(store.repositories, lesson, { apply: true, now: NOW });

    const [meaning] = await store.repositories.meanings.find({ contentStatus: "draft" }, { limit: 1 });
    await store.repositories.meanings.update(meaning.uuid,
      { contentStatus: "verified", verifiedAt: NOW + 1, verifiedBy: "educator" }, { now: NOW + 1 });
    const approved = await store.repositories.meanings.get(meaning.uuid);

    const plan = await planImport(store.repositories, built(OPEN_CONTENT_ARTIFACTS[0]).mapped);
    expect(plan.conflicts).toEqual([]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.isNoop).toBe(true);

    const again = await runOpenContent(store.repositories, built(OPEN_CONTENT_ARTIFACTS[0]),
      { apply: true, now: NOW + 5000 });
    expect(again.applied).toBe(false);
    expect(again.reason).toBe("no-changes");
    // The approval survived the run untouched.
    expect(await store.repositories.meanings.get(meaning.uuid)).toEqual(approved);
  });
});

/* ====================================================================== */
/* Technical review                                                       */
/* ====================================================================== */

describe("the seven remote recordings stay technical-review-gated", () => {
  const media = () => OPEN_CONTENT_ARTIFACTS
    .map(file => describeRemoteMedia(readArtifact(file), file));

  it("checks structure only, and says what it could not check", () => {
    const described = media();
    expect(described).toHaveLength(7);

    for (const entry of described) {
      expect(entry.structurallyValid, entry.slug).toBe(true);
      expect(entry.remoteUrl.startsWith("https://"), entry.slug).toBe(true);
      expect(["coerll.utexas.edu", "media.la.utexas.edu"]).toContain(entry.host);
      expect(entry.reviewState, entry.slug).toBe("TECHNICAL_REVIEW_REQUIRED");
      // Reachability and the file's own facts need the file; they stay unresolved.
      expect(entry.unresolved).toEqual(
        expect.arrayContaining(["reachability", "checksum", "durationMs", "codec"]));
    }
  });

  it("never advertises a remote recording as offline-ready", async () => {
    const { services, repositories } = await importedCurriculum();
    expect(media().every(entry => entry.offlineReady === false)).toBe(true);

    const activities = (await services.listening.activities())
      .filter(activity => activity.audio.missingReason === "remote-only");
    expect(activities).toHaveLength(7);
    for (const activity of activities) {
      expect(activity.audio.playableOffline, activity.slug).toBe(false);
      const asset = await repositories.audioAssets.get(activity.audio.uuid);
      expect(asset.localPath, activity.slug).toBe("");
      expect(asset.checksum, activity.slug).toBeNull();
      expect(asset.durationMs, activity.slug).toBe(0);
    }
  });

  it("refuses a URL that is not on an official host", () => {
    const dataset = readArtifact(OPEN_CONTENT_ARTIFACTS[0]);
    dataset.listening.mediaAsset.canonicalTarget.row.remoteUrl =
      "https://example.com/copy/interview.mp4";
    expect(describeRemoteMedia(dataset).structurallyValid).toBe(false);
  });
});

describe("pronunciation stays metadata", () => {
  it("keeps all seven citations unpromoted, with no evidence to promote them on", async () => {
    const { repositories, lessons } = await importedCurriculum();
    const cited = lessons.flatMap(lesson => lesson.audit.pronunciationMetadata);

    expect(cited).toHaveLength(7);
    for (const entry of cited) {
      expect(entry.learnerReady, entry.sourceId).toBe(false);
      expect(entry.canonicalRows, entry.sourceId).toBe(0);
      expect(entry.reviewStatus, entry.sourceId).toBe("SOURCE_VERIFIED");
    }

    // The repository holds no phonetic content at all, so nothing could be promoted even
    // if someone decided to: there is no IPA, phoneme or model recording to publish.
    expect(await repositories.pronunciationFeatures.count()).toBe(0);
    expect(await repositories.pronunciationItems.count()).toBe(0);
    expect(await repositories.pronunciationVariants.count()).toBe(0);
    expect(await repositories.pronunciationPairs.count()).toBe(0);
  });
});

/* ====================================================================== */
/* Release-candidate state                                                */
/* ====================================================================== */

describe("the release candidate state holds", () => {
  it("leaks no draft row through any service after the whole curriculum imports", async () => {
    const { services, repositories } = await importedCurriculum();

    expect(await services.grammar.topics()).toEqual([]);
    expect(await publishedOnly(repositories).meanings.count()).toBe(0);
    const visibleExercises = (await services.exercises.all())
      .filter(entry => entry.slug.startsWith("open-a2"));
    expect(visibleExercises).toHaveLength(48);
    expect(visibleExercises.every(entry => entry.gradeable)).toBe(true);
  });

  it("writes no learner or SRS row while preparing the release", async () => {
    const { repositories } = await importedCurriculum();
    for (const entity of ["profiles", "settings", "cards", "events", "courseProgress",
      "lessonProgress", "sectionProgress", "errorEvents", "pronunciationAttempts"]) {
      expect(await repositories[entity].count(), entity).toBe(0);
    }
  });

  it("keeps the two storage gates shut", async () => {
    const { RUNTIME_GATES } = await import(
      "../../01_APPLICATION/CURRENT_APP/src/runtime/feature-gates.js");
    // Both are physical-device gates and are not closed from a desktop test run.
    expect(RUNTIME_GATES.learnerStorageSwitch).toBe(false);
    expect(RUNTIME_GATES.canonicalNativeStore).toBe(false);
    expect(RUNTIME_GATES.nativeNotifications).toBe(false);
  });
});
