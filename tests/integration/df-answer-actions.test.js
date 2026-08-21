// @vitest-environment happy-dom
/*
 * <df-answer-actions> — hint, check, and reveal controls.
 *
 * The application routes every control through ONE delegated document click listener
 * that resolves `e.target.closest("[data-action]")`. These tests pin that the buttons
 * stay reachable from the document and keep their exact data-action values and
 * enable/disable rules.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-actions.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-answer-actions.js"),
  "utf8"
);

async function mount({ hasresult = false, usedhint = false } = {}) {
  const el = document.createElement("df-answer-actions");
  if (hasresult) el.setAttribute("hasresult", "");
  if (usedhint) el.setAttribute("usedhint", "");
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const byAction = action => document.querySelector(`[data-action="${action}"]`);

afterEach(() => { document.body.innerHTML = ""; });

describe("answer action controls", () => {
  it("keeps every control reachable from the document for delegated clicks", async () => {
    await mount();
    for (const action of ["hint", "submit-writing", "reveal-answer"]) {
      const button = byAction(action);
      expect(button, `${action} must be reachable`).toBeTruthy();
      expect(button.getRootNode()).toBe(document);
    }
    expect(SOURCE).toContain("createRenderRoot() { return this; }");
  });

  it("resolves through closest([data-action]), the way the app dispatches", async () => {
    await mount();
    const handler = vi.fn(e => e.target.closest("[data-action]")?.dataset.action);
    document.addEventListener("click", handler);

    byAction("hint").click();
    byAction("reveal-answer").click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.results.map(r => r.value)).toEqual(["hint", "reveal-answer"]);
    document.removeEventListener("click", handler);
  });

  it("enables hint and check, and offers reveal, before an answer is given", async () => {
    await mount();
    expect(byAction("hint").disabled).toBe(false);
    expect(byAction("submit-writing").disabled).toBe(false);
    expect(byAction("reveal-answer")).toBeTruthy();
  });

  it("disables hint once the hint was already used, leaving check available", async () => {
    await mount({ usedhint: true });
    expect(byAction("hint").disabled).toBe(true);
    expect(byAction("submit-writing").disabled).toBe(false);
    expect(byAction("reveal-answer")).toBeTruthy();
  });

  it("locks the controls and removes reveal once a result is showing", async () => {
    await mount({ hasresult: true });
    expect(byAction("hint").disabled).toBe(true);
    expect(byAction("submit-writing").disabled).toBe(true);
    // Reveal is removed entirely, not merely disabled — matching the previous markup.
    expect(byAction("reveal-answer")).toBeNull();
  });

  it("updates reactively as the question state changes", async () => {
    const el = await mount();
    expect(byAction("reveal-answer")).toBeTruthy();

    el.setAttribute("hasresult", "");
    await el.updateComplete;
    expect(byAction("reveal-answer")).toBeNull();
    expect(byAction("hint").disabled).toBe(true);
  });

  it("owns markup only: it performs no hinting, revealing, or scoring", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);

    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of [
      "indexeddb", "sqlite", "capacitor", "schedulecard", "repositor",
      "usehint", "revealanswer", "submitanswer", "finalizeanswer"
    ]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
