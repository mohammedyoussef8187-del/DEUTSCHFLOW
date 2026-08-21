// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-feedback.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-feedback.js"),
  "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-answer-feedback");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.append(el);
  await el.updateComplete;
  const row = el.querySelector("df-rating-row");
  if (row) await row.updateComplete;
  return el;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("answer feedback panel", () => {
  it("shows the expected answer and the learner's answer when wrong", async () => {
    const el = await mount({ note: "الإجابة غير صحيحة.", correctanswer: "das Haus", useranswer: "Hause", lang: "de" });
    expect(el.querySelector(".feedback").classList.contains("error")).toBe(true);
    expect(el.querySelector("h3").textContent).toContain("✗");
    const rows = [...el.querySelectorAll(".feedback-row")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector("strong").textContent.trim()).toBe("das Haus");
    expect(rows[0].querySelector("strong").getAttribute("lang")).toBe("de");
  });

  it("omits the expected-answer row when the answer was correct", async () => {
    const el = await mount({ correct: true, note: "إجابة صحيحة.", useranswer: "das Haus" });
    expect(el.querySelector(".feedback").classList.contains("success")).toBe(true);
    expect(el.querySelector("h3").textContent).toContain("✓");
    expect(el.querySelectorAll(".feedback-row")).toHaveLength(1);
    expect(el.querySelector(".feedback-row strong")).toBeNull();
  });

  it("omits the learner-answer row when nothing was typed, as after a reveal", async () => {
    const el = await mount({ note: "تم عرض الإجابة.", correctanswer: "fahren", useranswer: "" });
    const rows = [...el.querySelectorAll(".feedback-row")];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("الإجابة الصحيحة");
  });

  it("switches the guidance line with correctness", async () => {
    const wrong = await mount({});
    expect(wrong.querySelector(".feedback-hint").textContent).toContain("ستسجل الإجابة كخطأ");
    document.body.innerHTML = "";
    const right = await mount({ correct: true });
    expect(right.querySelector(".feedback-hint").textContent).toContain("قيّم صعوبة التذكر");
  });

  it("hosts the rating row and the report control in the light DOM", async () => {
    const el = await mount({ correct: true, suggested: 3 });
    expect(el.shadowRoot).toBeNull();
    expect(document.querySelector('[data-action="flag-current-word"]').getRootNode()).toBe(document);
    expect([...document.querySelectorAll('[data-action="rate-answer"]')].map(b => b.dataset.rating))
      .toEqual(["2", "3", "4"]);
  });

  it("passes correctness through to the rating row", async () => {
    await mount({ suggested: 0 });
    expect([...document.querySelectorAll('[data-action="rate-answer"]')].map(b => b.dataset.rating))
      .toEqual(["1"]);
  });

  it("reports the evaluator's verdict without re-deciding it", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of [
      "indexeddb", "sqlite", "capacitor", "schedulecard", "repositor",
      "validate", "levenshtein", "normalize"
    ]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
