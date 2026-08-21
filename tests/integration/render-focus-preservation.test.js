// @vitest-environment happy-dom
/*
 * Focus preservation across full re-renders.
 *
 * The app rewrites #app.innerHTML on every render, which destroyed the focused element.
 * Typing in the vocabulary search (debounced at 160ms) therefore lost focus and reset
 * the caret after every keystroke, and on iPad/iPhone that dismisses the keyboard
 * mid-search. These tests pin the capture/restore helpers that fix it.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const APP = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8"
);

function loadHelpers() {
  const start = APP.indexOf("  function captureFocus(root){");
  const end = APP.indexOf("\n  }", APP.indexOf("  function restoreFocus(focus){")) + 4;
  const src = APP.slice(start, end);
  return new Function(`${src}; return { captureFocus, restoreFocus };`)();
}
const { captureFocus, restoreFocus } = loadHelpers();

afterEach(() => { document.body.innerHTML = ""; });

describe("focus preservation", () => {
  it("captures the focused field's id and caret, and restores both after a rewrite", () => {
    document.body.innerHTML = `<div id="app"><input id="word-search" value="haus"></div>`;
    const app = document.getElementById("app");
    const input = document.getElementById("word-search");
    input.focus();
    input.setSelectionRange(4, 4);

    const captured = captureFocus(app);
    expect(captured).toMatchObject({ id: "word-search", start: 4, end: 4 });

    // Simulate the full re-render.
    app.innerHTML = `<input id="word-search" value="haus">`;
    expect(document.activeElement.id).not.toBe("word-search");

    restoreFocus(captured);
    expect(document.activeElement.id).toBe("word-search");
    expect(document.getElementById("word-search").selectionStart).toBe(4);
  });

  it("captures nothing when focus is outside the app or on an element without an id", () => {
    document.body.innerHTML = `<div id="app"><input id="inside"></div><input id="outside">`;
    const app = document.getElementById("app");

    document.getElementById("outside").focus();
    expect(captureFocus(app)).toBeNull();

    const anon = document.createElement("input");
    app.append(anon);
    anon.focus();
    expect(captureFocus(app)).toBeNull();
  });

  it("does nothing when the field no longer exists after the rewrite", () => {
    document.body.innerHTML = `<div id="app"><input id="gone"></div>`;
    const app = document.getElementById("app");
    document.getElementById("gone").focus();
    const captured = captureFocus(app);

    app.innerHTML = "";
    expect(() => restoreFocus(captured)).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it("tolerates controls that do not support selection ranges", () => {
    document.body.innerHTML = `<div id="app"><select id="word-sort"><option>a</option></select></div>`;
    const app = document.getElementById("app");
    const select = document.getElementById("word-sort");
    select.focus();

    const captured = captureFocus(app);
    app.innerHTML = `<select id="word-sort"><option>a</option></select>`;
    expect(() => restoreFocus(captured)).not.toThrow();
    expect(document.activeElement.id).toBe("word-sort");
  });

  it("is a no-op when nothing was focused", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    expect(captureFocus(document.getElementById("app"))).toBeNull();
    expect(() => restoreFocus(null)).not.toThrow();
  });
});
