import { afterAll, describe, expect, it, vi } from "vitest";

const previous = {
  window: globalThis.window,
  document: globalThis.document,
  indexedDB: globalThis.indexedDB,
  matchMedia: globalThis.matchMedia
};

afterAll(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

describe("browser module graph", () => {
  it("loads app.js and wires extracted modules without touching storage", async () => {
    const elements = new Map();
    globalThis.window = globalThis;
    globalThis.window.addEventListener = vi.fn();
    globalThis.document = {
      addEventListener: vi.fn(),
      getElementById: vi.fn(id => {
        if (!elements.has(id)) elements.set(id, { innerHTML: "", appendChild: vi.fn() });
        return elements.get(id);
      })
    };
    globalThis.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn() }));
    globalThis.indexedDB = { open: vi.fn(() => ({})) };

    await import("../../01_APPLICATION/CURRENT_APP/src/app.js");

    expect(window.DF.normalizeGerman(" DAS HAUS ")).toBe("das haus");
    expect(window.DF.scheduleCard).toBeTypeOf("function");
    expect(window.DF.Repositories.vocabulary.all).toBeTypeOf("function");
    expect(indexedDB.open).toHaveBeenCalledWith("deutschflow_v2", 2);
  });
});
