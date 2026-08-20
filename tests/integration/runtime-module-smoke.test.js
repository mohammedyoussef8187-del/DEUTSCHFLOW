// @vitest-environment happy-dom
/*
 * Runtime module-graph smoke test.
 *
 * Uses a real DOM (happy-dom) rather than a hand-rolled stub, because the runtime now
 * registers a Lit custom element and custom elements need genuine platform APIs.
 * Storage is still stubbed: the test asserts the app opens the existing IndexedDB
 * database and never touches real learner data.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const previous = {
  indexedDB: globalThis.indexedDB,
  matchMedia: globalThis.matchMedia
};

beforeAll(() => {
  // The app mounts into these; the environment starts with an empty document.
  document.body.innerHTML = `<div id="app"></div><div id="modal-root"></div><div id="toast-root"></div>`;
  // The environment implements neither of these.
  globalThis.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn() }));
  globalThis.indexedDB = { open: vi.fn(() => ({})) };
});

afterAll(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

describe("browser module graph", () => {
  it("loads app.js and wires extracted modules without touching storage", async () => {
    await import("../../01_APPLICATION/CURRENT_APP/src/app.js");

    expect(window.DF.normalizeGerman(" DAS HAUS ")).toBe("das haus");
    expect(window.DF.scheduleCard).toBeTypeOf("function");
    expect(window.DF.Repositories.vocabulary.all).toBeTypeOf("function");
    expect(indexedDB.open).toHaveBeenCalledWith("deutschflow_v2", 2);
  });

  it("registers the Lit review-summary element on load", () => {
    expect(customElements.get("df-review-summary")).toBeTypeOf("function");
  });
});
