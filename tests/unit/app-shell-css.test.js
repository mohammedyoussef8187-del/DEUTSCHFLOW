import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/styles.css"), "utf8"
);
const HTML = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/index.html"), "utf8"
);

describe("iPad-first app shell foundation", () => {
  it("opts into the full display area so safe-area insets resolve on iOS", () => {
    expect(HTML).toContain("viewport-fit=cover");
  });

  it("respects the display cutout and home indicator on every edge", () => {
    for (const inset of [
      "env(safe-area-inset-top)", "env(safe-area-inset-left)",
      "env(safe-area-inset-right)", "env(safe-area-inset-bottom)"
    ]) {
      expect(CSS, `missing ${inset}`).toContain(inset);
    }
  });

  it("switches navigation to a side rail from tablet landscape upward", () => {
    expect(CSS).toContain("@media (min-width:900px)");
    const tablet = CSS.slice(CSS.indexOf("@media (min-width:900px)"));
    // The bottom pill becomes a vertical rail.
    expect(tablet).toContain("grid-template-columns:1fr");
    expect(tablet).toContain("grid-auto-rows:64px");
  });

  it("uses logical properties so the app's RTL direction is preserved", () => {
    const shell = CSS.slice(CSS.indexOf("iPad-first app shell foundation"));
    expect(shell).toContain("padding-inline");
    expect(shell).toContain("inset-inline-start");
    // No hard-coded physical left/right offsets for the rail position.
    expect(shell).not.toMatch(/\bright:\s*\d/);
  });

  it("gives the full-screen study route its own safe-area padding", () => {
    // The study route renders outside .layout, so it needs insets of its own.
    const study = CSS.slice(CSS.indexOf("The study route renders full-screen"));
    expect(study).toContain("env(safe-area-inset-left)");
    expect(study).toContain("env(safe-area-inset-top)");
    expect(study).toContain("env(safe-area-inset-bottom)");
    expect(study).toContain("padding-inline");
  });

  it("keeps phone and tablet-portrait layouts on the existing bottom bar", () => {
    // The side-rail rules live only inside the >=900px query, so narrower
    // viewports keep the original bottom navigation untouched.
    const beforeTablet = CSS.slice(0, CSS.indexOf("@media (min-width:900px)"));
    expect(beforeTablet).toContain(".bottom-nav{position:fixed");
    expect(beforeTablet).toContain("grid-template-columns:repeat(5,1fr)");
  });
});

describe("iPad/iPhone viewport and touch refinements", () => {
  it("uses dvh for full-height layouts, with a vh fallback first", () => {
    // 100vh measures the viewport without iOS dynamic chrome, so the page overflows.
    for (const selector of [".layout{min-height:100vh;min-height:100dvh}", ".study-layout{min-height:100vh;min-height:100dvh}"]) {
      expect(CSS).toContain(selector);
    }
  });

  it("meets the 44pt minimum hit area for icon controls", () => {
    expect(CSS).toContain("min-inline-size:44px");
    expect(CSS).toContain("min-block-size:44px");
  });

  it("keeps the answer field clear of the on-screen keyboard", () => {
    expect(CSS).toContain(".answer-input{scroll-margin-block-end:120px}");
    expect(CSS).toContain(".answer-actions{scroll-margin-block-end:24px}");
  });

  it("tightens study padding on very short viewports", () => {
    expect(CSS).toContain("@media (max-height:520px)");
  });
});

describe("iPad workspace density", () => {
  it("splits the vocabulary list into two columns from tablet landscape", () => {
    const tablet = CSS.slice(CSS.indexOf("iPad workspace density"));
    expect(tablet).toContain(".list-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))");
    // display:contents keeps the article as the grid item, preserving its own layout.
    expect(tablet).toContain("df-word-row{display:contents}");
  });

  it("keeps the column seam RTL-safe", () => {
    const tablet = CSS.slice(CSS.indexOf("iPad workspace density"));
    expect(tablet).toContain("border-inline-end");
    expect(tablet).not.toMatch(/border-right:\s*1px/);
  });

  it("tracks the visible viewport for modal height on iOS", () => {
    expect(CSS).toContain(".modal{max-height:88vh;max-height:88dvh}");
  });
});
