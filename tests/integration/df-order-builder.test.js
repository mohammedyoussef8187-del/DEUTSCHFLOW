// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-order-builder.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-order-builder.js"), "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-order-builder");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const q = sel => document.querySelector(sel);
const tokens = area => [...document.querySelectorAll(`.${area} .token`)].map(t => t.textContent.trim());

afterEach(() => { document.body.innerHTML = ""; });

describe("sentence order builder", () => {
  it("shows the bank tokens and a placeholder while nothing is chosen", async () => {
    await mount({ selected: "[]", pool: JSON.stringify(["Das", "ist", "gut"]) });
    expect(tokens("token-bank")).toEqual(["Das", "ist", "gut"]);
    expect(q(".token-empty").textContent.trim()).toBe("اختر الكلمات بالترتيب");
    expect(tokens("token-area")).toEqual([]);
  });

  it("shows chosen tokens in order with their positional index", async () => {
    await mount({ selected: JSON.stringify(["Das", "ist"]), pool: JSON.stringify(["gut"]) });
    expect(tokens("token-area")).toEqual(["Das", "ist"]);
    expect([...document.querySelectorAll('[data-action="order-undo-at"]')].map(b => b.dataset.index))
      .toEqual(["0", "1"]);
    expect(q(".token-empty")).toBeNull();
  });

  it("enables check only when the bank is empty", async () => {
    await mount({ selected: JSON.stringify(["Das"]), pool: JSON.stringify(["ist"]) });
    expect(q('[data-action="order-submit"]').disabled).toBe(true);
    document.body.innerHTML = "";
    await mount({ selected: JSON.stringify(["Das", "ist"]), pool: "[]" });
    expect(q('[data-action="order-submit"]').disabled).toBe(false);
  });

  it("enables reset only once something has been chosen", async () => {
    await mount({ selected: "[]", pool: JSON.stringify(["Das"]) });
    expect(q('[data-action="order-reset"]').disabled).toBe(true);
    document.body.innerHTML = "";
    await mount({ selected: JSON.stringify(["Das"]), pool: "[]" });
    expect(q('[data-action="order-reset"]').disabled).toBe(false);
  });

  it("locks every control and removes reveal once a result is showing", async () => {
    await mount({ selected: JSON.stringify(["Das"]), pool: JSON.stringify(["ist"]), hasresult: true });
    expect([...document.querySelectorAll(".token")].every(t => t.disabled)).toBe(true);
    expect(q('[data-action="order-reset"]').disabled).toBe(true);
    expect(q('[data-action="order-submit"]').disabled).toBe(true);
    expect(q('[data-action="reveal-answer"]')).toBeNull();
  });

  it("dispatches token picks through delegation with the index", async () => {
    await mount({ selected: "[]", pool: JSON.stringify(["Das", "ist"]) });
    const handler = vi.fn(e => {
      const b = e.target.closest("[data-action]");
      return b && `${b.dataset.action}:${b.dataset.index}`;
    });
    document.addEventListener("click", handler);
    document.querySelectorAll('[data-action="order-pick"]')[1].click();
    expect(handler.mock.results[0].value).toBe("order-pick:1");
    document.removeEventListener("click", handler);
  });

  it("tolerates malformed token data", async () => {
    const el = await mount({ selected: "nope", pool: "{}" });
    expect(el.querySelectorAll(".token")).toHaveLength(0);
  });

  it("never reorders or validates the sentence itself", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["validate", "submitanswer", "indexeddb", "schedulecard", "repositor", "sort("]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
