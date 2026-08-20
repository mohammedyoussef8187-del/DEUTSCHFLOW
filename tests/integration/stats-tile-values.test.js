// @vitest-environment happy-dom
/*
 * Statistics-tile value formatting.
 *
 * The statistics page passes pre-formatted strings for two tiles ("—" when there is no
 * data, "85%" for accuracy, "1.2ث" for duration). Those were being coerced with
 * Number(), which produced NaN and rendered as "ليس رقمًا". Numeric tiles must still be
 * localized exactly as before.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8"
);

/** Extract the real tileValue implementation from app.js and evaluate it in isolation. */
function loadTileValue() {
  const start = APP_SOURCE.indexOf("function tileValue(n){");
  const end = APP_SOURCE.indexOf("function statCard(", start);
  const source = APP_SOURCE.slice(start, end);
  return new Function(`${source}; return tileValue;`)();
}

const tileValue = loadTileValue();
const ar = n => n.toLocaleString("ar-EG");

describe("stat tile value formatting", () => {
  it("localizes plain numbers exactly as before", () => {
    expect(tileValue(0)).toBe(ar(0));
    expect(tileValue(7)).toBe(ar(7));
    expect(tileValue(2820)).toBe(ar(2820));
  });

  it("treats absent values as zero, matching previous behavior", () => {
    expect(tileValue(null)).toBe(ar(0));
    expect(tileValue(undefined)).toBe(ar(0));
    expect(tileValue("")).toBe(ar(0));
  });

  it("passes pre-formatted strings through instead of rendering NaN", () => {
    expect(tileValue("—")).toBe("—");
    expect(tileValue("85%")).toBe("85%");
    expect(tileValue("1.2ث")).toBe("1.2ث");
    expect(tileValue("450ms")).toBe("450ms");
  });

  it("never renders the localized NaN text", () => {
    for (const input of ["—", "85%", "1.2ث", "450ms", null, undefined, "", 0, 12]) {
      expect(String(tileValue(input))).not.toContain("ليس رقم");
    }
  });

  it("still localizes numeric strings", () => {
    expect(tileValue("42")).toBe(ar(42));
  });
});
