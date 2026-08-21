import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = fs.readFileSync(path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8");
const CSS = fs.readFileSync(path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/styles.css"), "utf8");

describe("vocabulary search and filter accessibility", () => {
  it("uses real search semantics with mobile keyboard hints", () => {
    const field = APP.slice(APP.indexOf('id="word-search"'), APP.indexOf('id="word-search"') + 320);
    expect(field).toContain('type="search"');
    expect(field).toContain('enterkeyhint="search"');
    expect(field).toContain('inputmode="search"');
    expect(field).toContain('autocomplete="off"');
    expect(field).toContain('aria-label=');
  });

  it("names the sort control", () => {
    expect(APP).toContain('<select id="word-sort" class="field-select sort-select" aria-label=');
  });

  it("exposes filter chips as toggles", () => {
    expect(APP).toContain('data-action="word-filter"');
    expect(APP).toContain('aria-pressed="${state.wordView.filter===f}"');
  });

  it("announces the result count politely instead of styling it inline", () => {
    expect(APP).toContain('class="result-count" role="status" aria-live="polite"');
    expect(CSS).toContain(".result-count{");
    expect(APP).not.toContain('<div style="color:var(--muted);font-size:13px;margin-bottom:9px">');
  });
});
