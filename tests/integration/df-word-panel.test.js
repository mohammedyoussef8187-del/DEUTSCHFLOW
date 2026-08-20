// @vitest-environment happy-dom
/*
 * <df-word-panel> — read-only teaching panel, second study-screen slice.
 * It must never contain anything that could alter SRS state.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-word-panel.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-word-panel.js"),
  "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-word-panel");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const text = (el, sel) => el.shadowRoot.querySelector(sel)?.textContent.trim() ?? null;
const pills = el => [...el.shadowRoot.querySelectorAll(".pill")].map(p => p.textContent.replace(/\s+/g, " ").trim());

afterEach(() => { document.body.innerHTML = ""; });

describe("word panel", () => {
  it("renders the German form, meaning, and pronunciation", async () => {
    const el = await mount({
      german: "das Haus", meaning: "بيت", pronunciation: "هاوس",
      badge: "كلمة جديدة"
    });
    expect(text(el, ".german")).toBe("das Haus");
    expect(text(el, ".meaning")).toBe("بيت");
    expect(text(el, ".pronunciation")).toBe("هاوس");
    expect(text(el, ".badge")).toBe("كلمة جديدة");
  });

  it("marks the German text for correct language and direction inside an RTL page", async () => {
    const el = await mount({ german: "fahren", meaning: "يقود" });
    const german = el.shadowRoot.querySelector(".german");
    expect(german.getAttribute("lang")).toBe("de");
    expect(SOURCE).toContain("direction: ltr");
    expect(SOURCE).toContain("unicode-bidi: isolate");
  });

  it("omits pronunciation entirely when it is hidden or absent", async () => {
    const el = await mount({ german: "fahren", meaning: "يقود", pronunciation: "" });
    expect(el.shadowRoot.querySelector(".pronunciation")).toBeNull();
  });

  it("shows only the descriptive pills that have values", async () => {
    const full = await mount({ german: "das Haus", meaning: "بيت", article: "das", typelabel: "اسم", level: "A1" });
    expect(pills(full)).toEqual(["الأداة: das", "اسم", "A1"]);

    const sparse = await mount({ german: "fahren", meaning: "يقود", typelabel: "كلمة" });
    expect(pills(sparse)).toEqual(["كلمة"]);

    const bare = await mount({ german: "fahren", meaning: "يقود" });
    expect(bare.shadowRoot.querySelector(".details")).toBeNull();
  });

  it("updates reactively when the presented word changes", async () => {
    const el = await mount({ german: "das Haus", meaning: "بيت" });
    el.setAttribute("german", "fahren");
    el.setAttribute("meaning", "يقود");
    await el.updateComplete;
    expect(text(el, ".german")).toBe("fahren");
    expect(text(el, ".meaning")).toBe("يقود");
  });

  it("contains no controls, so it cannot alter SRS state", async () => {
    const el = await mount({ german: "das Haus", meaning: "بيت", article: "das" });
    expect(el.shadowRoot.querySelectorAll("button, input, select, textarea, form")).toHaveLength(0);
    expect(el.shadowRoot.querySelectorAll("[data-action]")).toHaveLength(0);
  });

  it("depends on Lit alone and never on storage or scheduling", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);

    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "capacitor", "schedulecard", "repositor", "scheduler"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("gives tablets a more generous panel without breaking phones", () => {
    expect(SOURCE).toContain("@media (min-width: 900px)");
    expect(SOURCE).toContain("@media (max-width: 640px)");
    // Uses logical properties so RTL layout is preserved.
    expect(SOURCE).toContain("margin-block-start");
    expect(SOURCE).toContain("min-block-size");
  });
});
