// @vitest-environment happy-dom
/*
 * Dialog focus management.
 *
 * Modals previously left focus behind the dialog: opening one moved nothing, Tab walked
 * out into the page underneath, and closing dropped focus entirely. That makes dialogs
 * unusable with a keyboard, including an iPad external keyboard.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const APP = fs.readFileSync(path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8");

/** Load the real modal helpers out of app.js and run them against a live DOM. */
function loadModal() {
  const start = APP.indexOf("  let modalReturnFocus=null;");
  const end = APP.indexOf("\n  }", APP.indexOf("  function trapModalTab(e){")) + 4;
  const src = APP.slice(start, end);
  return new Function(`${src}; return { modal, closeModal, trapModalTab };`)();
}
const { modal, closeModal, trapModalTab } = loadModal();

beforeEach(() => {
  document.body.innerHTML = `<button id="trigger">open</button><div id="modal-root"></div>`;
});
afterEach(() => { document.body.innerHTML = ""; });

const FORM = `<div class="modal-head"><h2>تعديل الكلمة</h2><button data-action="modal-close">x</button></div>
  <input name="german"><input name="arabic"><button data-action="save">حفظ</button>`;

describe("modal focus management", () => {
  it("moves focus to the first field when the dialog opens", () => {
    modal(FORM);
    expect(document.activeElement.getAttribute("name")).toBe("german");
  });

  it("labels the dialog from its heading", () => {
    modal(FORM);
    const dialog = document.querySelector(".modal");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe(document.querySelector(".modal h2").id);
    expect(dialog.getAttribute("aria-label")).toBeNull();
  });

  it("falls back to the dialog itself when it has no fields", () => {
    modal(`<div class="modal-head"><h2>تأكيد</h2></div><p>نص</p>`);
    expect(document.activeElement).toBe(document.querySelector(".modal"));
  });

  it("returns focus to whatever opened the dialog", () => {
    const trigger = document.getElementById("trigger");
    trigger.focus();
    modal(FORM);
    expect(document.activeElement).not.toBe(trigger);
    closeModal();
    expect(document.activeElement).toBe(trigger);
  });

  it("does not force focus anywhere when nothing was focused", () => {
    modal(FORM);
    closeModal();
    expect(document.activeElement).toBe(document.body);
  });

  it("wraps Tab from the last control back to the first", () => {
    modal(FORM);
    const items = [...document.querySelectorAll(".modal button, .modal input")];
    items[items.length - 1].focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    trapModalTab(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it("wraps Shift+Tab from the first control back to the last", () => {
    modal(FORM);
    const items = [...document.querySelectorAll(".modal button, .modal input")];
    items[0].focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    trapModalTab(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("ignores Tab when no dialog is open", () => {
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    expect(() => trapModalTab(event)).not.toThrow();
    expect(event.defaultPrevented).toBe(false);
  });
});
