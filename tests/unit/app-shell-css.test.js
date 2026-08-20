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

  it("keeps phone and tablet-portrait layouts on the existing bottom bar", () => {
    // The side-rail rules live only inside the >=900px query, so narrower
    // viewports keep the original bottom navigation untouched.
    const beforeTablet = CSS.slice(0, CSS.indexOf("@media (min-width:900px)"));
    expect(beforeTablet).toContain(".bottom-nav{position:fixed");
    expect(beforeTablet).toContain("grid-template-columns:repeat(5,1fr)");
  });
});
