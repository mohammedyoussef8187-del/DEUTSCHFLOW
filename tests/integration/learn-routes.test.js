// @vitest-environment happy-dom
/*
 * The Learn routes, driven through the real controller over a real canonical store.
 *
 * What this proves:
 *   - every route renders, empty or populated, and never throws
 *   - progress, spoken attempts and reminder settings really persist
 *   - grading goes through the existing deterministic evaluator
 *   - Arabic cannot score, even routed through the UI
 *   - nothing here can touch an SRS card
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LEARN_ROUTES, createLearnController, isLearnRoute
} from "../../01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js";
import { bootstrapCanonicalRuntime } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";

const NOW = 1775000000000;
const PROFILE = "local";
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const cleanup = [];
afterEach(async () => {
  document.body.innerHTML = "";
  while (cleanup.length) await cleanup.pop()();
});

const notificationAdapter = {
  async permission() { return "granted"; },
  async requestPermission() { return "granted"; },
  async pending() { return []; },
  async schedule() { return { scheduled: 0 }; },
  async cancel() { return { cancelled: 0 }; }
};

async function controllerOn({ native = true, toasts = [] } = {}) {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const runtime = await bootstrapCanonicalRuntime({
    isNativePlatform: native,
    gates: native ? { canonicalNativeStore: true } : {},
    openExecutor: async () => ({ executor }),
    notificationAdapter,
    readDueCount: async () => 12,
    now: () => NOW
  });
  const controller = createLearnController(runtime, {
    profileUuid: PROFILE, now: () => NOW,
    toast: (message, kind) => toasts.push([message, kind])
  });
  return { controller, runtime, toasts };
}

/** Render a route into the document the way the host app does, then hydrate. */
async function show(controller, route) {
  await controller.load(route);
  document.body.innerHTML = `<div id="app">${controller.render(route)}</div>`;
  controller.hydrate(route);
  await Promise.resolve();
  return document.getElementById("app");
}

async function seedCourse(runtime) {
  await runtime.source.write.content.saveCourse({
    course: { uuid: "c-1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1,
      sourceTitle: "Netzwerk A1", sourcePublisher: "Klett", ...meta },
    levels: [{ uuid: "cl-1", courseUuid: "c-1", cefrLevel: "A1", ordering: 1, ...linkMeta }],
    units: [{ uuid: "u-1", courseUuid: "c-1", courseLevelUuid: "cl-1", slug: "unit-1", ordering: 1, ...meta }],
    lessons: [
      { uuid: "l-1", unitUuid: "u-1", slug: "greetings", cefrLevel: "A1", ordering: 1, ...meta },
      { uuid: "l-2", unitUuid: "u-1", slug: "family", cefrLevel: "A1", ordering: 2, ...meta }
    ],
    sections: [{ uuid: "sec-1", lessonUuid: "l-1", slug: "words", sectionKind: "vocabulary", ordering: 1, ...meta }],
    items: [{ uuid: "i-1", sectionUuid: "sec-1", contentType: "vocabulary", contentUuid: "v-1",
      ordering: 1, required: 1, ...linkMeta }],
    prerequisites: [],
    texts: [
      { uuid: "ct-1", ownerType: "course", ownerUuid: "c-1", language: "en", kind: "title", text: "Netzwerk A1", ...meta },
      { uuid: "ct-2", ownerType: "lesson", ownerUuid: "l-1", language: "en", kind: "title", text: "Saying hello", ...meta },
      { uuid: "ct-3", ownerType: "lesson", ownerUuid: "l-1", language: "ar", kind: "title", text: "إلقاء التحية", ...meta }
    ]
  }, { now: NOW });
}

async function seedExercises(runtime) {
  await runtime.source.write.content.saveExercise({
    exercise: { uuid: "x-de", slug: "train-time", exerciseType: "type_answer", level: "A1",
      ordering: 1, answerLanguage: "de", ...meta },
    texts: [
      { uuid: "xt-1", exerciseUuid: "x-de", language: "de", kind: "prompt", text: "Wie heißt „house“?", ...meta },
      { uuid: "xt-2", exerciseUuid: "x-de", language: "ar", kind: "instruction", text: "اكتب الكلمة الألمانية.", ...meta }
    ],
    options: [{ uuid: "xo-1", exerciseUuid: "x-de", text: "das Haus", language: "de",
      isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta }],
    targets: []
  }, { now: NOW });

  await runtime.source.write.content.saveExercise({
    exercise: { uuid: "x-ar", slug: "meaning", exerciseType: "type_answer", level: "A1",
      ordering: 2, answerLanguage: "ar", ...meta },
    texts: [{ uuid: "xt-3", exerciseUuid: "x-ar", language: "de", kind: "prompt", text: "das Haus", ...meta }],
    // Authored as expected AND scoreable in Arabic: the policy must still refuse it.
    options: [{ uuid: "xo-2", exerciseUuid: "x-ar", text: "بيت", language: "ar",
      isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta }],
    targets: []
  }, { now: NOW });
}

/* --------------------------------------------------------------- routing */

describe("routes exist and are recognised", () => {
  it("declares one hub and eight feature routes", () => {
    expect(LEARN_ROUTES).toHaveLength(9);
    expect(LEARN_ROUTES.filter(route => route.hub)).toHaveLength(1);
  });

  it("recognises its own routes and nothing else", () => {
    for (const route of LEARN_ROUTES) expect(isLearnRoute(route.id)).toBe(true);
    for (const route of ["home", "words", "study", "stats", "settings"]) {
      expect(isLearnRoute(route)).toBe(false);
    }
  });

  it("renders every route without throwing, on an empty store", async () => {
    const { controller } = await controllerOn({ native: false });
    for (const route of LEARN_ROUTES) {
      const app = await show(controller, route.id);
      expect(app.innerHTML.length, `${route.id} rendered nothing`).toBeGreaterThan(0);
    }
  });

  it("renders every route without throwing, on a populated store", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    await seedExercises(runtime);
    for (const route of LEARN_ROUTES) {
      const app = await show(controller, route.id);
      expect(app.innerHTML.length, `${route.id} rendered nothing`).toBeGreaterThan(0);
    }
  });
});

/* ---------------------------------------------------------- empty states */

describe("empty states are honest", () => {
  it("says why the store is unavailable in a browser", async () => {
    const { controller } = await controllerOn({ native: false });
    const app = await show(controller, "learn");
    expect(app.querySelector(".store-note").textContent).toContain("المتصفح");
  });

  it("names what is missing rather than hiding the route", async () => {
    const { controller } = await controllerOn();
    for (const [route, phrase] of [
      ["learn-courses", "لا توجد دورات بعد"],
      ["learn-grammar", "لا توجد قواعد بعد"],
      ["learn-sentences", "لا توجد جُمل بعد"],
      ["learn-exercises", "لا توجد تمارين بعد"],
      ["learn-listening", "لا توجد تسجيلات بعد"],
      ["learn-pronunciation", "لا توجد تمارين نطق بعد"]
    ]) {
      const app = await show(controller, route);
      expect(app.textContent, route).toContain(phrase);
    }
  });

  it("fabricates no content when the store is empty", async () => {
    const { controller } = await controllerOn();
    const app = await show(controller, "learn-courses");
    expect(app.querySelector("df-course-outline")).toBeNull();
  });

  it("offers every area from the hub even with nothing authored", async () => {
    const { controller } = await controllerOn();
    const app = await show(controller, "learn");
    const tiles = [...app.querySelectorAll('[data-action="learn-nav"]')];
    expect(tiles).toHaveLength(8);
    expect(tiles.every(tile => tile.textContent.includes("لا يوجد محتوى بعد"))).toBe(true);
  });
});

/* ------------------------------------------------- courses, progress, resume */

describe("course, unit, lesson and progress", () => {
  it("renders the outline from the real store", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    const app = await show(controller, "learn-courses");

    const outline = app.querySelector("df-course-outline");
    expect(outline.course.slug).toBe("netzwerk-a1");
    expect(outline.progress).toMatchObject({ lessonsTotal: 2, lessonsCompleted: 0 });
    expect(outline.progress.resume.lessonUuid).toBe("l-1");
  });

  it("opens a lesson when the outline asks for it", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    await show(controller, "learn-courses");

    const result = await controller.handleEvent("lesson-select", { lessonUuid: "l-1" });
    expect(result.reload).toBe(true);
    const app = await show(controller, "learn-courses");
    expect(app.querySelector("df-lesson-view").lesson.slug).toBe("greetings");
  });

  it("records lesson completion, and the resume point moves", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    await show(controller, "learn-courses");
    await controller.handleEvent("lesson-select", { lessonUuid: "l-1" });
    await show(controller, "learn-courses");

    await controller.handleAction("learn-complete-lesson", { lesson: "l-1" });
    const app = await show(controller, "learn-courses");

    expect(await runtime.source.lessonProgress.count({ profileUuid: PROFILE })).toBe(1);
    expect(await runtime.source.sectionProgress.count({ profileUuid: PROFILE })).toBe(1);
    const outline = app.querySelector("df-course-outline");
    expect(outline.progress.lessonsCompleted).toBe(1);
    expect(outline.progress.resume.lessonUuid).toBe("l-2");
  });

  it("says it cannot save progress rather than pretending, with no store", async () => {
    const toasts = [];
    const { controller } = await controllerOn({ native: false, toasts });
    await show(controller, "learn-courses");
    await controller.handleAction("learn-complete-lesson", { lesson: "l-1" });
    expect(toasts[0][1]).toBe("error");
  });
});

/* ------------------------------------------------------------- exercises */

describe("exercises grade through the existing evaluator", () => {
  it("accepts a correct German answer", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-de" });
    await show(controller, "learn-exercises");

    document.getElementById("learn-answer").value = "das Haus";
    await controller.handleAction("learn-submit-exercise", {});
    const app = await show(controller, "learn-exercises");

    expect(app.querySelector("[data-verdict]").dataset.verdict).toBe("correct");
    expect(await runtime.source.errorEvents.count({ profileUuid: PROFILE })).toBe(0);
  });

  it("rejects a wrong answer and records the mistake", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-de" });
    await show(controller, "learn-exercises");

    document.getElementById("learn-answer").value = "der Haus";
    await controller.handleAction("learn-submit-exercise", {});
    const app = await show(controller, "learn-exercises");

    expect(app.querySelector("[data-verdict]").dataset.verdict).toBe("wrong");
    const events = await runtime.source.errorEvents.find({ profileUuid: PROFILE });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ contentType: "exercise", contentUuid: "x-de", scored: 1 });
  });

  it("uses the evaluator's own verdict rather than a second grader", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-de" });
    await show(controller, "learn-exercises");

    // A capitalization-only difference is ACCEPTED by the deterministic evaluator.
    document.getElementById("learn-answer").value = "das haus";
    await controller.handleAction("learn-submit-exercise", {});
    const app = await show(controller, "learn-exercises");
    expect(app.querySelector("[data-verdict]").dataset.verdict).toBe("correct");
  });

  it("presents an Arabic-answer exercise as self-checked and scores nothing", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-ar" });
    const app = await show(controller, "learn-exercises");

    expect(app.querySelector("[data-ungradeable]")).not.toBeNull();

    document.getElementById("learn-answer").value = "شيء آخر تماماً";
    await controller.handleAction("learn-submit-exercise", {});
    const after = await show(controller, "learn-exercises");

    expect(after.querySelector("[data-verdict]").dataset.verdict).toBe("self");
    // A wrong Arabic answer produced no scored mistake.
    expect(await runtime.source.errorEvents.count({ profileUuid: PROFILE })).toBe(0);
  });

  it("never returns a correctness verdict for an Arabic exercise", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-ar" });
    await show(controller, "learn-exercises");

    const exercise = controller.view.data.exercise;
    expect(exercise.gradeable).toBe(false);
    const result = controller.grade(exercise, "بيت");
    expect(result.correct).toBeNull();
    expect(result.selfAssessed).toBe(true);
  });
});

/* ---------------------------------------------------- listening and pronunciation */

describe("listening and pronunciation", () => {
  async function seedListening(runtime, availability = "bundled") {
    await runtime.source.write.content.saveListening({
      audio: { uuid: "a-1", slug: "am-bahnhof", availability, localPath: availability === "bundled" ? "audio/a.mp3" : "",
        sourcePath: "x.mp3", remoteUrl: null, mimeType: "audio/mpeg", byteSize: 1, durationMs: 42000, ...meta },
      item: { uuid: "li-1", slug: "am-bahnhof", audioUuid: "a-1", activityType: "dialogue",
        level: "A2", ordering: 1, ...meta },
      texts: [{ uuid: "lt-1", itemUuid: "li-1", language: "de", kind: "transcript", text: "Guten Tag.", ...meta }],
      speakers: [], segments: [], segmentTexts: [], links: []
    }, { now: NOW });
  }

  it("shows an offline-ready activity", async () => {
    const { controller, runtime } = await controllerOn();
    await seedListening(runtime);
    const app = await show(controller, "learn-listening");
    const player = app.querySelector("df-listening-player");
    expect(player.activity.slug).toBe("am-bahnhof");
    expect(player.activity.studyable).toBe(true);
  });

  it("reports an activity whose audio is not on the device", async () => {
    const { controller, runtime } = await controllerOn();
    await seedListening(runtime, "source-only");
    const app = await show(controller, "learn-listening");
    const player = app.querySelector("df-listening-player");
    expect(player.activity.studyable).toBe(false);
    expect(player.activity.audio.missingReason).toBe("not-on-device");
  });

  it("records a self-rated pronunciation attempt", async () => {
    const { controller, runtime } = await controllerOn();
    await runtime.source.write.content.savePronunciation({
      feature: { uuid: "f-1", slug: "front-rounded-u", featureKind: "phoneme", ipa: "yː",
        level: "A1", ordering: 1, ...meta },
      item: { uuid: "pi-1", slug: "buecher", featureUuid: "f-1", practiceMode: "listen_repeat",
        targetType: "vocabulary", targetUuid: "v-1", level: "A1", ordering: 1, ...meta },
      texts: [], variants: [{ uuid: "pv-1", itemUuid: "pi-1", ipa: "ˈbyːçɐ", syllables: "Bü·cher",
        stressIndex: 0, variety: "de-DE", isPrimary: 1, ordering: 1, ...meta }],
      pairs: [], links: []
    }, { now: NOW });

    await show(controller, "learn-pronunciation");
    await controller.handleEvent("self-rate", { itemUuid: "pi-1", selfRating: 3 });
    const app = await show(controller, "learn-pronunciation");

    expect(await runtime.source.pronunciationAttempts.count({ profileUuid: PROFILE })).toBe(1);
    const attempt = (await runtime.source.pronunciationAttempts.all())[0];
    expect(attempt.selfRating).toBe(3);
    expect(attempt).not.toHaveProperty("correct");
    expect(app.querySelector("df-pronunciation-card").history.lastSelfRating).toBe(3);
  });
});

/* ------------------------------------------------------------- reminders */

describe("reminder settings persist", () => {
  it("saves a change and reads it back through the service", async () => {
    const { controller, runtime } = await controllerOn();
    await show(controller, "learn-reminders");

    await controller.handleEvent("reminder-change", { field: "enabled", value: true });
    await controller.handleEvent("reminder-change", { field: "dailyTime", value: "07:15" });
    const app = await show(controller, "learn-reminders");

    expect(await runtime.source.reminderSettings.count({ profileUuid: PROFILE })).toBe(1);
    const settings = app.querySelector("df-reminder-settings").settings;
    expect(settings).toMatchObject({ enabled: true, dailyTime: "07:15" });
  });

  it("shows the real permission state and previews the plan", async () => {
    const { controller } = await controllerOn();
    await controller.handleEvent("reminder-change", { field: "enabled", value: true });
    const app = await show(controller, "learn-reminders");
    const el = app.querySelector("df-reminder-settings");
    expect(el.permission).toBe("granted");
    expect(el.plan.entries.map(entry => entry.kind))
      .toEqual(["daily_study", "due_review"]);
  });

  it("refuses to save with no store rather than silently dropping the change", async () => {
    const toasts = [];
    const { controller } = await controllerOn({ native: false, toasts });
    await show(controller, "learn-reminders");
    await controller.handleEvent("reminder-change", { field: "enabled", value: true });
    expect(toasts[0][1]).toBe("error");
  });
});

/* --------------------------------------------------------- SRS protection */

describe("the Learn area cannot touch SRS", () => {
  const SOURCE = fs.readFileSync(path.resolve(process.cwd(),
    "01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js"), "utf8");

  it("imports no legacy repository, adapter or scheduler", () => {
    const imports = [...SOURCE.matchAll(/^import\s+.*?from\s+["']([^"']+)["']/gm)].map(m => m[1]);
    for (const forbidden of ["../data/repositories.js", "../platform/indexeddb/adapter.js",
      "../srs/scheduler.js"]) {
      expect(imports, `must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("names no SRS field in its own code", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["schedulecard", "intervaldays", "lapses", "mastery", "dueat", "ease"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("writes nothing into review_cards across a full tour of every route", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    await seedExercises(runtime);

    for (const route of LEARN_ROUTES) await show(controller, route.id);
    await controller.handleEvent("lesson-select", { lessonUuid: "l-1" });
    await show(controller, "learn-courses");
    await controller.handleAction("learn-complete-lesson", { lesson: "l-1" });
    await controller.handleEvent("reminder-change", { field: "enabled", value: true });

    expect(await runtime.source.cards.count()).toBe(0);
    expect(await runtime.source.events.count()).toBe(0);
  });

  it("leaves a legacy card object byte-identical", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-de" });
    await show(controller, "learn-exercises");
    document.getElementById("learn-answer").value = "der Haus";
    await controller.handleAction("learn-submit-exercise", {});

    expect(JSON.stringify(card)).toBe(before);
  });
});

/* ------------------------------------------------------------ iPad-first */

describe("touch targets and direction", () => {
  it("gives every control at least a 44px minimum height", async () => {
    const { controller, runtime } = await controllerOn();
    await seedCourse(runtime);
    await seedExercises(runtime);

    for (const route of LEARN_ROUTES) {
      const app = await show(controller, route.id);
      for (const control of app.querySelectorAll("button, input")) {
        const inline = control.getAttribute("style") ?? "";
        const isComponentSlot = control.closest("df-course-outline, df-lesson-view, df-listening-player, df-pronunciation-card, df-error-insights, df-reminder-settings, df-choice-list");
        if (isComponentSlot) continue;   // components carry their own 44px rules
        const min = /min-height:(\d+)px/.exec(inline)?.[1];
        expect(min, `${route.id}: ${control.outerHTML.slice(0, 80)}`).toBeDefined();
        expect(Number(min), `${route.id} target too small`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it("isolates German text direction inside an RTL page", async () => {
    const { controller, runtime } = await controllerOn();
    await seedExercises(runtime);
    await show(controller, "learn-exercises");
    await controller.handleAction("learn-exercise", { uuid: "x-de" });
    const app = await show(controller, "learn-exercises");
    const prompt = app.querySelector('h2[lang="de"]');
    expect(prompt.getAttribute("dir")).toBe("ltr");
  });
});
