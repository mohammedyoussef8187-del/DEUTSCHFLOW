// @vitest-environment happy-dom
/*
 * <df-answer-input> — first interactive control migrated.
 *
 * The critical property is that it renders into the LIGHT DOM: the surrounding app
 * finds the field with document.getElementById, reads its value the same way, and the
 * global Enter handler compares document.activeElement.id. A shadow root would break
 * all three, so these tests pin that contract.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-input.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-input.js"),
  "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-answer-input");
  for (const [key, value] of Object.entries(attrs)) {
    if (value === true) el.setAttribute(key, "");
    else if (value !== false) el.setAttribute(key, String(value));
  }
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("answer input integration contract", () => {
  it("is reachable via document.getElementById, as the app expects", async () => {
    await mount({ lang: "de", placeholder: "اكتب" });
    const input = document.getElementById("answer-input");
    expect(input).toBeTruthy();
    expect(input.tagName).toBe("TEXTAREA");
  });

  it("renders in the light DOM so global styles and queries keep working", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
    expect(document.getElementById("answer-input").getRootNode()).toBe(document);
    expect(SOURCE).toContain("createRenderRoot() { return this; }");
  });

  it("supports document.activeElement.id, which drives Enter-to-submit", async () => {
    await mount();
    const input = document.getElementById("answer-input");
    input.focus();
    expect(document.activeElement.id).toBe("answer-input");
  });

  it("exposes the typed value where the submit handler reads it", async () => {
    await mount();
    const input = document.getElementById("answer-input");
    input.value = "das Haus";
    expect(document.getElementById("answer-input").value).toBe("das Haus");
  });

  it("carries the same attributes the previous markup did", async () => {
    await mount({ lang: "de", placeholder: "اكتب الإجابة" });
    const input = document.getElementById("answer-input");
    expect(input.className).toContain("answer-input");
    expect(input.getAttribute("lang")).toBe("de");
    expect(input.getAttribute("placeholder")).toBe("اكتب الإجابة");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("adds the Arabic answer class only when asked", async () => {
    const plain = await mount({ lang: "de" });
    expect(plain.querySelector("textarea").className).not.toContain("arabic-answer");
    document.body.innerHTML = "";

    const arabic = await mount({ lang: "ar", arabic: true });
    expect(arabic.querySelector("textarea").className).toContain("arabic-answer");
  });

  it("disables the field once a result is showing", async () => {
    const el = await mount({ disabled: true });
    expect(el.querySelector("textarea").disabled).toBe(true);

    el.removeAttribute("disabled");
    await el.updateComplete;
    expect(el.querySelector("textarea").disabled).toBe(false);
  });

  it("owns markup only: it never evaluates, scores, or stores answers", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);

    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of [
      "indexeddb", "sqlite", "capacitor", "schedulecard", "repositor",
      "validate", "submitanswer", "scheduler"
    ]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
