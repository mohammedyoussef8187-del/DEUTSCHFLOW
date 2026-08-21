// @vitest-environment happy-dom
/*
 * Minimum proof that the Feature E architecture works end to end:
 * canonical rows -> curriculum service -> outline and lesson components.
 *
 * Covers the three things the UI must demonstrate: course -> unit -> lesson navigation,
 * lesson content assembly from mixed content types, and progress/resume behaviour.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-course-outline.js";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-lesson-view.js";
import {
  CONTENT_TYPES, PROGRESS_STATUS, SECTION_KINDS,
  buildCurriculum, courseProgressFor
} from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";

const COMPONENTS = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components");
const OUTLINE_SOURCE = fs.readFileSync(path.join(COMPONENTS, "df-course-outline.js"), "utf8");
const LESSON_SOURCE = fs.readFileSync(path.join(COMPONENTS, "df-lesson-view.js"), "utf8");

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "draft", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

function course() {
  return buildCurriculum({
    courses: [{ uuid: "c-a1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1,
      sourceTitle: "Netzwerk A1", sourcePublisher: "Klett", ...meta }],
    courseLevels: [{ uuid: "cl-a1", courseUuid: "c-a1", cefrLevel: "A1", ordering: 1, ...linkMeta }],
    courseUnits: [
      { uuid: "u-1", courseUuid: "c-a1", courseLevelUuid: "cl-a1", slug: "unit-1", ordering: 1, ...meta },
      { uuid: "u-2", courseUuid: "c-a1", courseLevelUuid: "cl-a1", slug: "unit-2", ordering: 2, ...meta }
    ],
    lessons: [
      { uuid: "l-1a", unitUuid: "u-1", slug: "greetings-1", cefrLevel: "A1", ordering: 1, ...meta },
      { uuid: "l-1b", unitUuid: "u-1", slug: "greetings-2", cefrLevel: "A1", ordering: 2, ...meta },
      { uuid: "l-2a", unitUuid: "u-2", slug: "family", cefrLevel: "A1", ordering: 1, ...meta }
    ],
    lessonSections: [
      { uuid: "s-1", lessonUuid: "l-1a", slug: "words", sectionKind: SECTION_KINDS.VOCABULARY, ordering: 1, ...meta },
      { uuid: "s-2", lessonUuid: "l-1a", slug: "practice", sectionKind: SECTION_KINDS.PRACTICE, ordering: 2, ...meta }
    ],
    lessonItems: [
      { uuid: "i-1", sectionUuid: "s-1", contentType: CONTENT_TYPES.VOCABULARY, contentUuid: "v-haus", ordering: 1, required: 1, ...linkMeta },
      { uuid: "i-2", sectionUuid: "s-1", contentType: CONTENT_TYPES.SENTENCE, contentUuid: "sent-1", ordering: 2, required: 1, ...linkMeta },
      { uuid: "i-3", sectionUuid: "s-1", contentType: CONTENT_TYPES.GRAMMAR_RULE, contentUuid: "rule-1", ordering: 3, required: 0, ...linkMeta },
      { uuid: "i-4", sectionUuid: "s-2", contentType: CONTENT_TYPES.EXERCISE, contentUuid: "x-1", ordering: 1, required: 1, ...linkMeta }
    ],
    lessonPrerequisites: [{ uuid: "pr-1", lessonUuid: "l-1b", requiresLessonUuid: "l-1a", ...linkMeta }],
    curriculumTexts: [
      { uuid: "ct-1", ownerType: "course", ownerUuid: "c-a1", language: "en", kind: "title", text: "Netzwerk A1", ...meta },
      { uuid: "ct-2", ownerType: "unit", ownerUuid: "u-1", language: "en", kind: "title", text: "Hello!", ...meta },
      { uuid: "ct-3", ownerType: "lesson", ownerUuid: "l-1a", language: "en", kind: "title", text: "Saying hello", ...meta },
      { uuid: "ct-4", ownerType: "lesson", ownerUuid: "l-1a", language: "ar", kind: "title", text: "إلقاء التحية", ...meta }
    ]
  })[0];
}

const progressWith = rows => courseProgressFor(course(), {
  courseProgress: rows.courseProgress ?? [],
  lessonProgress: rows.lessonProgress ?? [],
  sectionProgress: rows.sectionProgress ?? [],
  cefrProgress: []
}, PROFILE);

async function mount(tag, props) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);
const all = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

afterEach(() => { document.body.innerHTML = ""; });

describe("course outline", () => {
  it("renders course → unit → lesson in teaching order", async () => {
    const el = await mount("df-course-outline", { course: course() });
    expect(all(el, ".unit").map(u => u.dataset.unit)).toEqual(["u-1", "u-2"]);
    expect(all(el, ".lesson").map(l => l.dataset.lesson)).toEqual(["l-1a", "l-1b", "l-2a"]);
  });

  it("shows the course source without claiming its content", async () => {
    const el = await mount("df-course-outline", { course: course() });
    expect(sr(el, ".title").textContent.trim()).toBe("Netzwerk A1");
    expect(sr(el, ".source").textContent).toContain("Klett");
  });

  it("requests navigation instead of performing it", async () => {
    const el = await mount("df-course-outline", { course: course(), progress: progressWith({}) });
    const events = [];
    el.addEventListener("lesson-select", e => events.push(e.detail));
    sr(el, '[data-lesson="l-1a"]').click();
    expect(events).toEqual([{ courseUuid: "c-a1", lessonUuid: "l-1a", slug: "greetings-1" }]);
  });

  it("does not navigate to a locked lesson", async () => {
    const el = await mount("df-course-outline", { course: course(), progress: progressWith({}) });
    const events = [];
    el.addEventListener("lesson-select", e => events.push(e.detail));
    const locked = sr(el, '[data-lesson="l-1b"]');
    expect(locked.disabled).toBe(true);
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    locked.click();
    expect(events).toEqual([]);
  });

  it("marks the resume point for a fresh learner", async () => {
    const el = await mount("df-course-outline", { course: course(), progress: progressWith({}) });
    expect(sr(el, '[data-resume="true"]').dataset.lesson).toBe("l-1a");
    expect(sr(el, ".count").textContent).toContain("0/3");
  });

  it("moves the resume point once a lesson is completed", async () => {
    const progress = progressWith({
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    });
    const el = await mount("df-course-outline", { course: course(), progress });
    expect(sr(el, '[data-resume="true"]').dataset.lesson).toBe("l-1b");
    expect(sr(el, '[data-lesson="l-1a"]').dataset.status).toBe("completed");
    expect(sr(el, '[data-lesson="l-1b"]').disabled).toBe(false);   // prerequisite met
    expect(sr(el, ".fill").getAttribute("style")).toBe("width:33%");
    expect(sr(el, ".bar").getAttribute("aria-valuenow")).toBe("33");
  });

  it("shows section counts from the progress summary", async () => {
    const progress = progressWith({
      sectionProgress: [{ uuid: "sp1", profileUuid: PROFILE, sectionUuid: "s-1", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    });
    const el = await mount("df-course-outline", { course: course(), progress });
    expect(sr(el, '[data-lesson="l-1a"]').textContent).toContain("1/2");
  });

  it("renders without a progress summary", async () => {
    const el = await mount("df-course-outline", { course: course() });
    expect(all(el, ".lesson").every(l => l.disabled === false)).toBe(true);
    expect(sr(el, ".bar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("says so when there is no course", async () => {
    const el = await mount("df-course-outline", { course: null });
    expect(sr(el, ".empty")).not.toBeNull();
    expect(sr(el, ".course")).toBeNull();
  });
});

describe("lesson view", () => {
  const lessonOf = uuid => course().units.flatMap(u => u.lessons).find(l => l.uuid === uuid);

  it("assembles sections in order", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-1a") });
    expect(all(el, ".section").map(s => s.dataset.kind)).toEqual(["vocabulary", "practice"]);
  });

  it("composes mixed canonical content types in one section", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-1a") });
    const first = all(el, ".section")[0];
    const items = [...first.querySelectorAll(".item")];
    expect(items.map(i => i.dataset.contentType)).toEqual(["vocabulary", "sentence", "grammar_rule"]);
    expect(items.map(i => i.querySelector(".ref").textContent.trim()))
      .toEqual(["v-haus", "sent-1", "rule-1"]);
  });

  it("marks optional items", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-1a") });
    const optional = all(el, ".item").filter(i => i.textContent.includes("اختياري"));
    expect(optional.map(i => i.dataset.item)).toEqual(["i-3"]);
  });

  it("renders English and Arabic titles together", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-1a") });
    expect(sr(el, ".title").textContent.trim()).toBe("Saying hello");
    expect(sr(el, ".subtitle").textContent.trim()).toBe("إلقاء التحية");
  });

  it("falls back to the slug when a lesson has no title yet", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-1b") });
    expect(sr(el, ".title").textContent.trim()).toBe("greetings-2");
  });

  it("says a lesson has no content rather than rendering an empty shell", async () => {
    const el = await mount("df-lesson-view", { lesson: lessonOf("l-2a") });
    expect(sr(el, ".empty").textContent.trim()).toBe("هذا الدرس بلا محتوى بعد");
  });

  it("marks completed sections from the progress view", async () => {
    const progress = progressWith({
      sectionProgress: [{ uuid: "sp1", profileUuid: PROFILE, sectionUuid: "s-1", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    });
    const el = await mount("df-lesson-view", {
      lesson: lessonOf("l-1a"),
      progress: progress.lessons.find(l => l.uuid === "l-1a")
    });
    const sections = all(el, ".section");
    expect(sections[0].textContent).toContain("مكتمل");
    expect(sections[1].textContent).not.toContain("مكتمل");
  });

  it("renders nothing without a lesson", async () => {
    const el = await mount("df-lesson-view", { lesson: null });
    expect(sr(el, ".lesson")).toBeNull();
  });
});

describe("curriculum UI is read-only and SRS-independent", () => {
  for (const [name, source] of [["outline", OUTLINE_SOURCE], ["lesson view", LESSON_SOURCE]]) {
    it(`${name} imports only Lit and never reaches storage or SRS`, () => {
      const imports = [...source.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
      expect(imports).toEqual(["../../../vendor/lit.js"]);
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
      for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard",
        "reviewcard", "mastery", "ease", "interval", "duea"]) {
        expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
      }
    });
  }

  it("leaves SRS card data untouched while rendering progress", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const progress = progressWith({
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    });
    const el = await mount("df-course-outline", { course: course(), progress });
    sr(el, '[data-lesson="l-1b"]').click();
    expect(JSON.stringify(card)).toBe(before);
  });
});
