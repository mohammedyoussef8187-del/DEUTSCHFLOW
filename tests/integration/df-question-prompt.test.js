// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-question-prompt.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-question-prompt.js"),
  "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-question-prompt");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);

afterEach(() => { document.body.innerHTML = ""; });

describe("question prompt", () => {
  it("renders the label and prompt", async () => {
    const el = await mount({ label: "اكتب الكلمة", prompt: "das Haus", promptlang: "de" });
    expect(sr(el, ".label").textContent.trim()).toBe("اكتب الكلمة");
    expect(sr(el, ".prompt-de").textContent.trim()).toBe("das Haus");
    expect(sr(el, ".prompt-de").getAttribute("lang")).toBe("de");
  });

  it("uses the Arabic treatment when the prompt is not German", async () => {
    const el = await mount({ prompt: "بيت", promptlang: "ar" });
    expect(sr(el, ".prompt-ar")).toBeTruthy();
    expect(sr(el, ".prompt-de")).toBeNull();
    expect(sr(el, ".prompt-ar").getAttribute("lang")).toBe("ar");
  });

  it("shows pronunciation only when supplied", async () => {
    expect(sr(await mount({ prompt: "x" }), ".pronunciation")).toBeNull();
    const withPron = await mount({ prompt: "x", pronunciation: "هاوس" });
    expect(sr(withPron, ".pronunciation").textContent.trim()).toBe("هاوس");
  });

  it("renders resolved hint chips, including a value part", async () => {
    const el = await mount({
      prompt: "x",
      hints: JSON.stringify([{ text: "الحرف الأول:", value: "H" }, { text: "عدد الحروف تقريباً: 4" }])
    });
    const pills = [...el.shadowRoot.querySelectorAll(".pill")].map(p => p.textContent.replace(/\s+/g, " ").trim());
    expect(pills).toEqual(["الحرف الأول: H", "عدد الحروف تقريباً: 4"]);
    expect(el.shadowRoot.querySelector(".pill b").getAttribute("lang")).toBe("de");
  });

  it("renders no hint area when there are no hints, and tolerates bad input", async () => {
    expect(sr(await mount({ prompt: "x" }), ".hints")).toBeNull();
    expect(sr(await mount({ prompt: "x", hints: "not-json" }), ".hints")).toBeNull();
    expect(sr(await mount({ prompt: "x", hints: "{}" }), ".hints")).toBeNull();
  });

  it("never derives hints itself", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["splitarticle", "normalizegerman", "normalizearabic", "indexeddb", "schedulecard", "repositor"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
