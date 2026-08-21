// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-word-row.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-word-row.js"), "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-word-row");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const pills = el => [...el.querySelectorAll(".pill")].map(p => p.textContent.trim());

afterEach(() => { document.body.innerHTML = ""; });

describe("vocabulary row", () => {
  it("renders the word, meaning, and pronunciation", async () => {
    const el = await mount({ wordid: 7, german: "das Haus", arabic: "بيت", pronunciation: "هاوس", mastery: 42, statusclass: "due", statuslabel: "مستحقة" });
    expect(el.querySelector(".word-german").textContent.trim()).toBe("das Haus");
    expect(el.querySelector(".word-german").getAttribute("lang")).toBe("de");
    expect(el.querySelector(".word-arabic").textContent.replace(/\s+/g, " ").trim()).toBe("بيت · هاوس");
  });

  it("omits the pronunciation separator when there is none", async () => {
    const el = await mount({ wordid: 1, german: "fahren", arabic: "يقود" });
    expect(el.querySelector(".word-arabic").textContent.replace(/\s+/g, " ").trim()).toBe("يقود");
  });

  it("stays clickable through the delegated edit handler", async () => {
    await mount({ wordid: 99, german: "x", arabic: "y" });
    const handler = vi.fn(e => {
      const b = e.target.closest("[data-action]");
      return b && `${b.dataset.action}:${b.dataset.id}`;
    });
    document.addEventListener("click", handler);
    document.querySelector(".word-german").click();
    expect(handler.mock.results[0].value).toBe("edit-word:99");
    expect(document.querySelector("article.word-row").getRootNode()).toBe(document);
    document.removeEventListener("click", handler);
  });

  it("shows mastery and the resolved status pill", async () => {
    const el = await mount({ wordid: 1, german: "x", arabic: "y", mastery: 73, statusclass: "weak", statuslabel: "ضعيفة" });
    expect(pills(el)).toEqual(["73%", "ضعيفة"]);
    expect(el.querySelector(".pill.weak")).toBeTruthy();
  });

  it("marks favourites and flagged data only when set", async () => {
    const plain = await mount({ wordid: 1, german: "x", arabic: "y", mastery: 0 });
    expect(plain.textContent).not.toContain("⭐");
    expect(pills(plain)).toEqual(["0%"]);
    document.body.innerHTML = "";

    const marked = await mount({ wordid: 2, german: "x", arabic: "y", mastery: 0, favorite: true, flagged: true });
    expect(marked.textContent).toContain("⭐");
    expect(pills(marked)).toContain("بيانات");
  });

  it("never recomputes learner state", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["wordstatus", "wordmastery", "indexeddb", "repositor", "schedulecard"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
