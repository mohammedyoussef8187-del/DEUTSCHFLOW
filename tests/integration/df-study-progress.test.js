// @vitest-environment happy-dom
/*
 * <df-study-progress> — first migrated slice of the study screen.
 * It must stay read-only: it may not contain anything that could alter SRS state.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-study-progress.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-study-progress.js"),
  "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-study-progress");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const bar = el => el.shadowRoot.querySelector(".progress span");
const strip = el => el.shadowRoot.querySelector(".score-strip").textContent.replace(/\s+/g, " ").trim();

afterEach(() => { document.body.innerHTML = ""; });

describe("study progress component", () => {
  it("renders the session tally from attributes", async () => {
    const el = await mount({ percent: 40, completed: 2, planned: 5, correct: 3, wrong: 1, hints: 2 });
    expect(strip(el)).toContain("صحيح 3");
    expect(strip(el)).toContain("خطأ 1");
    expect(strip(el)).toContain("تلميحات 2");
  });

  it("reflects progress width and exposes it to assistive technology", async () => {
    const el = await mount({ percent: 40, completed: 2, planned: 5 });
    expect(bar(el).getAttribute("style")).toContain("40%");

    const track = el.shadowRoot.querySelector('[role="progressbar"]');
    expect(track.getAttribute("aria-valuenow")).toBe("2");
    expect(track.getAttribute("aria-valuemax")).toBe("5");
  });

  it("clamps out-of-range progress instead of overflowing the track", async () => {
    expect(bar(await mount({ percent: 140 })).getAttribute("style")).toContain("100%");
    expect(bar(await mount({ percent: -20 })).getAttribute("style")).toContain("0%");
  });

  it("shows the retry badge only when retries are pending", async () => {
    expect((await mount({ retries: 0 })).shadowRoot.querySelector(".retry-badge")).toBeNull();
    const withRetries = await mount({ retries: 3 });
    expect(withRetries.shadowRoot.querySelector(".retry-badge").textContent).toContain("3");
  });

  it("updates reactively as the session advances", async () => {
    const el = await mount({ percent: 20, correct: 1, wrong: 0, hints: 0 });
    el.setAttribute("percent", "80");
    el.setAttribute("correct", "4");
    await el.updateComplete;
    expect(bar(el).getAttribute("style")).toContain("80%");
    expect(strip(el)).toContain("صحيح 4");
  });

  it("contains no controls, so it cannot alter SRS state", async () => {
    const el = await mount({ percent: 50, correct: 2, wrong: 1 });
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
});
