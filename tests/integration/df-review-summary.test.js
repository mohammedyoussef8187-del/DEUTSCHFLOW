// @vitest-environment happy-dom
/*
 * <df-review-summary> component tests (Gate 4 proof of architecture).
 *
 * Proves: Lit renders in this app, reactive updates work, the component consumes
 * application-service data without any storage access, and it cannot mutate learner or
 * SRS state.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeLearnerState } from "../../01_APPLICATION/CURRENT_APP/src/services/review-summary-service.js";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-review-summary.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const snapshot = { words: fixture.clean.words, cards: fixture.clean.cards };
const NOW = 1775000000000;

const COMPONENT_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-review-summary.js"),
  "utf8"
);
const TILE_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-stat-tile.js"),
  "utf8"
);

async function mount(summary) {
  const el = document.createElement("df-review-summary");
  el.summary = summary;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

/** Tiles are now nested <df-stat-tile> components, each with its own shadow root. */
function tiles(el) {
  return [...el.shadowRoot.querySelectorAll("df-stat-tile")];
}

function tileText(el) {
  return tiles(el).map(tile => ({
    label: tile.shadowRoot.querySelector(".value span").textContent.trim(),
    value: tile.shadowRoot.querySelector("strong").textContent.trim()
  }));
}

afterEach(() => { document.body.innerHTML = ""; });

describe("Lit renders inside the existing application", () => {
  it("registers as a custom element and renders into shadow DOM", async () => {
    expect(customElements.get("df-review-summary")).toBeTypeOf("function");
    const el = await mount(summarizeLearnerState(snapshot, NOW));
    expect(el.shadowRoot).toBeTruthy();
    expect(tiles(el)).toHaveLength(4);
  });

  it("renders the real figures produced by the application service", async () => {
    const summary = summarizeLearnerState(snapshot, NOW);
    const el = await mount(summary);
    const rows = tileText(el);

    const dueTotal = summary.counts.due + summary.counts.overdue;
    const byLabel = Object.fromEntries(rows.map(t => [t.label, t.value]));
    expect(byLabel["مستحقة"]).toBe(dueTotal.toLocaleString("ar-EG"));
    expect(byLabel["جديدة"]).toBe(summary.counts.new.toLocaleString("ar-EG"));
    expect(byLabel["ضعيفة"]).toBe(summary.counts.weak.toLocaleString("ar-EG"));
    expect(byLabel["متقنة"]).toBe(summary.counts.mastered.toLocaleString("ar-EG"));

    // Totals line reports the real vocabulary count.
    expect(el.shadowRoot.querySelector(".totals").textContent)
      .toContain(summary.vocabularyTotal.toLocaleString("ar-EG"));
  });

  it("re-renders reactively when the summary property changes", async () => {
    const el = await mount(summarizeLearnerState(snapshot, NOW));
    const before = tileText(el);

    // A larger learner state produces different numbers.
    const grown = {
      words: [...snapshot.words, { id: 99, german: "neu", arabic: "جديد", itemType: "word" }],
      cards: snapshot.cards
    };
    el.summary = summarizeLearnerState(grown, NOW);
    await el.updateComplete;

    const after = tileText(el);
    expect(after).not.toEqual(before);
    expect(el.shadowRoot.querySelector(".totals").textContent).toContain("٥"); // 5 words
  });

  it("shows an empty state instead of fabricating numbers", async () => {
    const el = await mount(null);
    expect(el.shadowRoot.querySelector(".empty")).toBeTruthy();
    expect(tiles(el)).toHaveLength(0);
  });

  it("scopes its styles so the existing global stylesheet is unaffected", async () => {
    const el = await mount(summarizeLearnerState(snapshot, NOW));
    // Styles live in the shadow root, not the document.
    expect(el.shadowRoot.querySelector("style") || el.shadowRoot.adoptedStyleSheets?.length).toBeTruthy();
    expect(document.querySelector("style")).toBeNull();

    // Existing markup alongside the component keeps its own classes and is untouched.
    const legacy = document.createElement("div");
    legacy.className = "card stat-card";
    document.body.append(legacy);
    await el.updateComplete;
    expect(legacy.className).toBe("card stat-card");
    expect(legacy.shadowRoot).toBeNull();
  });
});

describe("architectural boundaries hold", () => {
  it("imports nothing from storage, native plugins, or SRS internals", () => {
    const importsOf = source => [
      ...source.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)
    ].map(m => m[1]);

    // Only Lit and the shared presentation primitive.
    expect(importsOf(COMPONENT_SOURCE)).toEqual(["../../../vendor/lit.js", "./df-stat-tile.js"]);
    // The primitive itself depends on nothing but Lit.
    expect(importsOf(TILE_SOURCE)).toEqual(["../../../vendor/lit.js"]);

    // Scan executable code only: the files' documentation legitimately names the
    // layers these components must not touch.
    const strip = source => source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .toLowerCase();

    for (const source of [COMPONENT_SOURCE, TILE_SOURCE]) {
      const code = strip(source);
      for (const forbidden of [
        "indexeddb", "sqlite", "capacitor", "scheduler", "repositor",
        "createcard", "schedulecard", "wordstatus", "localstorage", "fetch("
      ]) {
        expect(code, `component code must not reference ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("never mutates the learner data it is given", async () => {
    const summary = summarizeLearnerState(snapshot, NOW);
    const summaryBefore = JSON.stringify(summary);
    const snapshotBefore = JSON.stringify(snapshot);

    const el = await mount(summary);
    el.summary = { ...summary };
    await el.updateComplete;

    expect(JSON.stringify(summary)).toBe(summaryBefore);
    expect(JSON.stringify(snapshot)).toBe(snapshotBefore);
  });

  it("renders read-only output with no controls that could change state", async () => {
    const el = await mount(summarizeLearnerState(snapshot, NOW));
    expect(el.shadowRoot.querySelectorAll("button, input, select, textarea, form")).toHaveLength(0);
  });

  it("survives a frozen summary object, proving it only reads", async () => {
    const summary = Object.freeze({
      ...summarizeLearnerState(snapshot, NOW),
      counts: Object.freeze({ ...summarizeLearnerState(snapshot, NOW).counts })
    });
    const el = await mount(summary);
    expect(tiles(el)).toHaveLength(4);
  });
});

describe("iPad-first responsive foundation", () => {
  it("uses a fluid auto-fit grid rather than fixed device breakpoints", () => {
    expect(COMPONENT_SOURCE).toContain("auto-fit");
    expect(COMPONENT_SOURCE).toContain("minmax(150px, 1fr)");
  });

  it("adapts for phone portrait and wide tablet landscape", () => {
    expect(COMPONENT_SOURCE).toContain("@media (max-width: 430px)");
    expect(COMPONENT_SOURCE).toContain("@media (min-width: 1180px)");
    // The tile shrinks itself on small phones.
    expect(TILE_SOURCE).toContain("@media (max-width: 430px)");
  });

  it("inherits the app's existing theme tokens instead of redefining them", () => {
    for (const token of ["--surface", "--border", "--muted", "--text"]) {
      expect(TILE_SOURCE).toContain(token);
    }
    expect(COMPONENT_SOURCE).toContain("--muted");
  });

  it("uses logical properties so the app's RTL direction keeps working", () => {
    expect(TILE_SOURCE).toContain("inline-size");
    expect(COMPONENT_SOURCE).toContain("margin-block-start");
  });
});
