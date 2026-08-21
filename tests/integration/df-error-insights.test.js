// @vitest-environment happy-dom
/*
 * Minimum proof that the Feature F architecture works end to end:
 * canonical rows -> error service -> component render.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-error-insights.js";
import {
  ERROR_SCOPES, ERROR_SOURCES, PATTERN_STATUS, practiceQueue, summarizeErrors
} from "../../01_APPLICATION/CURRENT_APP/src/services/error-service.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-error-insights.js"), "utf8");

const NOW = 1775000000000;
const DAY = 86400000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

function canonical(over = {}) {
  return {
    errorCategories: [
      { uuid: "cat-article", slug: "article-wrong", scope: ERROR_SCOPES.MORPHOLOGY, ordering: 1, ...meta },
      { uuid: "cat-typo", slug: "spelling-typo", scope: ERROR_SCOPES.ORTHOGRAPHY, ordering: 2, ...meta }
    ],
    errorCategoryTexts: [
      { uuid: "t1", categoryUuid: "cat-article", language: "en", kind: "name", text: "Wrong article", ...meta },
      { uuid: "t2", categoryUuid: "cat-article", language: "ar", kind: "advice", text: "احفظ الأداة مع الكلمة.", ...meta }
    ],
    errorRemediations: [
      { uuid: "r1", categoryUuid: "cat-article", contentType: "grammar_rule", contentUuid: "rule-gender", ordering: 1, ...linkMeta }
    ],
    errorEvents: [
      { uuid: "e1", profileUuid: PROFILE, occurredAt: NOW - 2 * DAY, skill: "recall", answerLanguage: "de",
        contentType: "vocabulary", contentUuid: "v-haus", evaluationType: "article_wrong", scored: 1,
        expectedAnswer: "das Haus", userAnswer: "der Haus", ...linkMeta },
      { uuid: "e2", profileUuid: PROFILE, occurredAt: NOW - DAY, skill: "recall", answerLanguage: "de",
        contentType: "vocabulary", contentUuid: "v-haus", evaluationType: "article_wrong", scored: 1,
        expectedAnswer: "das Haus", userAnswer: "die Haus", ...linkMeta },
      { uuid: "e3", profileUuid: PROFILE, occurredAt: NOW - DAY, skill: "recognition", answerLanguage: "ar",
        contentType: "vocabulary", contentUuid: "v-brot", evaluationType: "wrong", scored: 0,
        expectedAnswer: "خبز", userAnswer: "بيت", ...linkMeta }
    ],
    errorEventCategories: [
      { uuid: "l1", eventUuid: "e1", categoryUuid: "cat-article", source: ERROR_SOURCES.DETERMINISTIC, confidence: 1, ...linkMeta },
      { uuid: "l2", eventUuid: "e2", categoryUuid: "cat-article", source: ERROR_SOURCES.DETERMINISTIC, confidence: 1, ...linkMeta },
      { uuid: "l3", eventUuid: "e3", categoryUuid: "cat-typo", source: ERROR_SOURCES.ADVISORY, confidence: 0.6, ...linkMeta }
    ],
    errorPatterns: [],
    ...over
  };
}

async function mount(props) {
  const el = document.createElement("df-error-insights");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);
const all = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

const fromData = (data = canonical()) => ({
  summary: summarizeErrors(data, PROFILE, { now: NOW }),
  practice: practiceQueue(data, PROFILE, { now: NOW })
});

afterEach(() => { document.body.innerHTML = ""; });

describe("error insights", () => {
  it("shows a repeated mistake with its count and status", async () => {
    const el = await mount(fromData());
    const patterns = all(el, ".pattern");
    expect(patterns).toHaveLength(1);
    expect(patterns[0].dataset.category).toBe("article-wrong");
    expect(patterns[0].dataset.status).toBe(PATTERN_STATUS.ACTIVE);
    expect(patterns[0].textContent).toContain("2");
    expect(sr(el, ".name .en").textContent.trim()).toBe("Wrong article");
  });

  it("shows the authored advice in the language it exists in", async () => {
    const el = await mount(fromData());
    expect(sr(el, ".advice").textContent.trim()).toBe("احفظ الأداة مع الكلمة.");
  });

  it("reports Arabic mistakes as recorded but not counted", async () => {
    const el = await mount(fromData());
    expect(sr(el, ".note").textContent).toContain("1");
    expect(sr(el, ".note").textContent).toContain("لا تُحتسب");
    // The advisory mistake never became a pattern.
    expect(all(el, ".pattern").map(p => p.dataset.category)).toEqual(["article-wrong"]);
  });

  it("labels practice as a suggestion that does not change review dates", async () => {
    const el = await mount(fromData());
    const notes = all(el, ".note").map(n => n.textContent);
    expect(notes.some(text => text.includes("لا يغيّر مواعيد المراجعة"))).toBe(true);
  });

  it("suggests the authored remediation content", async () => {
    const el = await mount(fromData());
    const suggestions = all(el, ".suggestion");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].dataset.contentType).toBe("grammar_rule");
    expect(suggestions[0].dataset.content).toBe("rule-gender");
  });

  it("requests practice instead of starting it", async () => {
    const el = await mount(fromData());
    const events = [];
    el.addEventListener("practice-select", e => events.push(e.detail));
    sr(el, ".suggestion").click();
    expect(events).toEqual([
      { contentType: "grammar_rule", contentUuid: "rule-gender", categorySlug: "article-wrong" }
    ]);
  });

  it("says there is nothing yet rather than showing an empty list", async () => {
    const el = await mount(fromData({ ...canonical(), errorEvents: [], errorEventCategories: [] }));
    expect(sr(el, ".empty")).not.toBeNull();
    expect(sr(el, ".suggestions")).toBeNull();
  });

  it("renders with no data at all", async () => {
    const el = await mount({ summary: null, practice: null });
    expect(sr(el, ".panel")).not.toBeNull();
    expect(sr(el, ".empty")).not.toBeNull();
  });

  it("is read-only and never reaches storage or scheduling", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard",
      "reviewcard", "dueat", "mastery", "ease"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves SRS card data untouched while rendering", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const el = await mount(fromData());
    sr(el, ".suggestion").click();
    expect(JSON.stringify(card)).toBe(before);
  });
});
