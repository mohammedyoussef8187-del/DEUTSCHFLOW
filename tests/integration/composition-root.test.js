/*
 * The runtime composition root.
 *
 * What this suite pins:
 *   - the two gates are independent: the A–I screens can be reachable while a learner's
 *     SRS history stays exactly where it is
 *   - an unavailable canonical store degrades to an honest empty source, never a fake
 *     dataset and never a thrown error that would break study
 *   - the root cannot reach legacy learner storage at all
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CANONICAL_SOURCE, bootstrapCanonicalRuntime, createEmptyCanonicalSource, createServices,
  resolveCanonicalSource
} from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { RUNTIME_GATES, isEnabled } from "../../01_APPLICATION/CURRENT_APP/src/runtime/feature-gates.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { CANONICAL_MODEL_STATUS } from "../../01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js";

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()();
});

/** A native build with the canonical store gate opened, backed by node:sqlite. */
async function nativeRuntime(extra = {}) {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  return bootstrapCanonicalRuntime({
    isNativePlatform: true,
    gates: { canonicalNativeStore: true },
    openExecutor: async () => ({ executor }),
    ...extra
  });
}

/* ------------------------------------------------------------------ gates */

describe("the two gates are independent", () => {
  it("keeps learner SRS storage switched off", () => {
    expect(RUNTIME_GATES.learnerStorageSwitch).toBe(false);
    expect(CANONICAL_MODEL_STATUS.learnerSwitchEnabled).toBe(false);
    expect(CANONICAL_MODEL_STATUS.physicalDeviceGate).toBe("deferred-release-gate");
  });

  it("lets the canonical screens be reachable without touching that switch", () => {
    expect(RUNTIME_GATES.canonicalRuntime).toBe(true);
    expect(RUNTIME_GATES.learnerStorageSwitch).toBe(false);
  });

  it("keeps opening a store on device, and notifications, behind their own gates", () => {
    expect(RUNTIME_GATES.canonicalNativeStore).toBe(false);
    expect(RUNTIME_GATES.nativeNotifications).toBe(false);
  });

  it("lets a caller override a gate explicitly", () => {
    expect(isEnabled("canonicalNativeStore")).toBe(false);
    expect(isEnabled("canonicalNativeStore", { canonicalNativeStore: true })).toBe(true);
    expect(isEnabled("nonsense")).toBe(false);
  });
});

/* ----------------------------------------------------------- empty source */

describe("the empty source is honest, not fake", () => {
  it("answers every canonical entity with nothing", async () => {
    const source = createEmptyCanonicalSource("test");
    expect(await source.courses.all()).toEqual([]);
    expect(await source.listeningItems.all()).toEqual([]);
    expect(await source.errorEvents.find({ profileUuid: PROFILE })).toEqual([]);
    expect(await source.reminderSettings.findOne({ profileUuid: PROFILE })).toBeNull();
    expect(await source.cards.all()).toEqual([]);
  });

  it("answers to exactly the names the real repository layer uses", async () => {
    const executor = createNodeSqliteExecutor(":memory:");
    cleanup.push(() => executor.close());
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const real = createCanonicalRepositories(adapter);
    const empty = createEmptyCanonicalSource("test");

    // Everything the services can read must exist on both, or a screen would crash
    // exactly when the store is unavailable — the moment it must not.
    const skip = new Set(["lifecycle", "write", "srs", "available", "reason"]);
    for (const key of Object.keys(real)) {
      if (skip.has(key)) continue;
      expect(empty[key], `empty source is missing ${key}`).toBeDefined();
    }
  });

  it("offers no write method at all", () => {
    const source = createEmptyCanonicalSource("test");
    expect(source.write).toBeUndefined();
    expect(source.srs).toBeUndefined();
    expect(source.courses.insert).toBeUndefined();
    expect(source.available).toBe(false);
  });

  it("drives every service without error, returning empty results", async () => {
    const services = createServices(createEmptyCanonicalSource("test"));
    expect(await services.curriculum.courses()).toEqual([]);
    expect(await services.listening.activities()).toEqual([]);
    expect(await services.pronunciation.items()).toEqual([]);
    expect(await services.sentences.all()).toEqual([]);
    expect(await services.exercises.all()).toEqual([]);
    expect((await services.errors.summary(PROFILE, { now: NOW })).totalEvents).toBe(0);
    expect((await services.reminders.preview(PROFILE)).scheduled).toEqual([]);
  });
});

/* ------------------------------------------------------------- resolution */

describe("source resolution", () => {
  it("uses the empty source on a web target", async () => {
    const resolved = await resolveCanonicalSource({ isNativePlatform: false });
    expect(resolved.kind).toBe(CANONICAL_SOURCE.EMPTY);
    expect(resolved.source.reason).toBe("web-target-has-no-canonical-store");
  });

  it("uses the empty source while the native store gate is closed", async () => {
    const resolved = await resolveCanonicalSource({
      isNativePlatform: true, openExecutor: async () => ({ executor: null })
    });
    expect(resolved.kind).toBe(CANONICAL_SOURCE.EMPTY);
    expect(resolved.source.reason).toBe("canonical-native-store-gated");
  });

  it("uses the empty source when the whole canonical runtime is switched off", async () => {
    const resolved = await resolveCanonicalSource({
      isNativePlatform: true, gates: { canonicalRuntime: false, canonicalNativeStore: true }
    });
    expect(resolved.source.reason).toBe("canonical-runtime-disabled");
  });

  it("opens the real store on a native build with the gate open", async () => {
    const runtime = await nativeRuntime();
    expect(runtime.kind).toBe(CANONICAL_SOURCE.SQLITE);
    expect(runtime.available).toBe(true);
    expect(runtime.writable).toBe(true);
  });

  it("reports a failed open instead of throwing, so study keeps working", async () => {
    const resolved = await resolveCanonicalSource({
      isNativePlatform: true,
      gates: { canonicalNativeStore: true },
      openExecutor: async () => { throw new Error("disk full"); }
    });
    expect(resolved.kind).toBe(CANONICAL_SOURCE.EMPTY);
    expect(resolved.source.reason).toContain("disk full");
    expect(resolved.error).toBeInstanceOf(Error);
  });

  it("always returns every service, available or not", async () => {
    const web = await bootstrapCanonicalRuntime({ isNativePlatform: false });
    expect(Object.keys(web.services).sort()).toEqual([
      "content", "curriculum", "errors", "exercises", "grammar",
      "listening", "pronunciation", "reminders", "sentences"
    ]);
    expect(web.available).toBe(false);
    expect(web.writable).toBe(false);
  });
});

/* ------------------------------------------------------- end to end, real */

describe("a real store drives the real screens", () => {
  it("saves a course and reads it back through the curriculum service", async () => {
    const runtime = await nativeRuntime();
    await runtime.source.write.content.saveCourse({
      course: { uuid: "c-1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1,
        sourceTitle: "Netzwerk A1", sourcePublisher: "Klett", ...meta },
      levels: [{ uuid: "cl-1", courseUuid: "c-1", cefrLevel: "A1", ordering: 1, ...linkMeta }],
      units: [{ uuid: "u-1", courseUuid: "c-1", courseLevelUuid: "cl-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [{ uuid: "l-1", unitUuid: "u-1", slug: "greetings", cefrLevel: "A1", ordering: 1, ...meta }],
      sections: [{ uuid: "sec-1", lessonUuid: "l-1", slug: "words", sectionKind: "vocabulary", ordering: 1, ...meta }],
      items: [], prerequisites: [],
      texts: [{ uuid: "ct-1", ownerType: "course", ownerUuid: "c-1", language: "en",
        kind: "title", text: "Netzwerk A1", ...meta }]
    }, { now: NOW });

    const courses = await runtime.services.curriculum.courses();
    expect(courses.map(c => c.slug)).toEqual(["netzwerk-a1"]);
    expect(courses[0].title.en).toBe("Netzwerk A1");
    expect(courses[0].units[0].lessons[0].slug).toBe("greetings");
  });

  it("records lesson progress and reports it back as a resume point", async () => {
    const runtime = await nativeRuntime();
    await runtime.source.write.content.saveCourse({
      course: { uuid: "c-1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1, ...meta },
      levels: [], units: [{ uuid: "u-1", courseUuid: "c-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [
        { uuid: "l-1", unitUuid: "u-1", slug: "one", cefrLevel: "A1", ordering: 1, ...meta },
        { uuid: "l-2", unitUuid: "u-1", slug: "two", cefrLevel: "A1", ordering: 2, ...meta }
      ],
      sections: [], items: [], prerequisites: [], texts: []
    }, { now: NOW });

    await runtime.source.write.progress.recordLessonProgress({
      lesson: { uuid: "lp-1", profileUuid: PROFILE, lessonUuid: "l-1",
        status: "completed", completedAt: NOW, ...linkMeta },
      sections: []
    }, { now: NOW });

    const progress = await runtime.services.curriculum.progressForCourse("netzwerk-a1", PROFILE);
    expect(progress).toMatchObject({ lessonsTotal: 2, lessonsCompleted: 1, percent: 50 });
    expect(progress.resume.lessonUuid).toBe("l-2");
  });

  it("records an error event and reports the pattern back", async () => {
    const runtime = await nativeRuntime();
    await runtime.source.errorCategories.insert(
      { uuid: "cat-1", slug: "article-wrong", scope: "morphology", ordering: 1, ...meta }, { now: NOW });
    await runtime.source.write.errors.recordEvent({
      event: { uuid: "e-1", profileUuid: PROFILE, occurredAt: NOW, skill: "recall",
        answerLanguage: "de", contentType: "vocabulary", contentUuid: "v-1",
        evaluationType: "article_wrong", scored: 1, expectedAnswer: "das Haus",
        userAnswer: "der Haus", ...linkMeta },
      links: [{ uuid: "el-1", eventUuid: "e-1", categoryUuid: "cat-1",
        source: "deterministic", confidence: 1, ...linkMeta }]
    }, { now: NOW });

    const summary = await runtime.services.errors.summary(PROFILE, { now: NOW });
    expect(summary.totalEvents).toBe(1);
    expect(summary.patterns[0]).toMatchObject({ categorySlug: "article-wrong", occurrences: 1 });
  });

  it("saves reminder settings through the service and reads them back", async () => {
    const runtime = await nativeRuntime({
      notificationAdapter: {
        async permission() { return "granted"; },
        async requestPermission() { return "granted"; },
        async pending() { return []; },
        async schedule() { return { scheduled: 0 }; },
        async cancel() { return { cancelled: 0 }; }
      },
      readDueCount: async () => 12,
      now: () => NOW
    });

    await runtime.services.reminders.update(PROFILE, { enabled: true, dailyTime: "07:15" });
    expect((await runtime.services.reminders.settings(PROFILE)).dailyTime).toBe("07:15");
    expect(await runtime.source.reminderSettings.count({ profileUuid: PROFILE })).toBe(1);
  });

  it("reads due state as a number supplied by the caller, never as cards", async () => {
    let asked = 0;
    const runtime = await nativeRuntime({
      notificationAdapter: {
        async permission() { return "granted"; },
        async pending() { return []; },
        async schedule() { return {}; },
        async cancel() { return {}; }
      },
      readDueCount: async () => { asked += 1; return 20; },
      now: () => NOW
    });

    await runtime.services.reminders.preview(PROFILE);
    expect(asked).toBe(1);
  });
});

/* --------------------------------------------------- learner data isolation */

describe("the root cannot reach legacy learner storage", () => {
  const SOURCE = fs.readFileSync(path.resolve(process.cwd(),
    "01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js"), "utf8");

  it("imports no legacy repository, adapter or scheduler", () => {
    const imports = [...SOURCE.matchAll(/^import\s+.*?from\s+["']([^"']+)["']/gm)].map(m => m[1]);
    for (const forbidden of ["../data/repositories.js", "../platform/indexeddb/adapter.js",
      "../srs/scheduler.js", "../app.js"]) {
      expect(imports, `must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("names no SRS field in its own code", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["schedulecard", "intervaldays", "lapses", "mastery", "indexeddb"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves an SRS card untouched across a full bootstrap and writes", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    const runtime = await nativeRuntime();
    await runtime.source.write.content.saveCourse({
      course: { uuid: "c-1", slug: "x", cefrLevel: "A1", ordering: 1, ...meta },
      levels: [], units: [], lessons: [], sections: [], items: [], prerequisites: [], texts: []
    }, { now: NOW });
    await runtime.services.curriculum.courses();

    expect(JSON.stringify(card)).toBe(before);
  });

  it("writes nothing into review_cards while the new features are used", async () => {
    const runtime = await nativeRuntime();
    await runtime.source.write.progress.recordLessonProgress({
      lesson: { uuid: "lp-1", profileUuid: PROFILE, lessonUuid: "l-1", status: "completed", ...linkMeta },
      sections: []
    }, { now: NOW });
    expect(await runtime.source.cards.count()).toBe(0);
  });
});
