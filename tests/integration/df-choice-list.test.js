// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-choice-list.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-choice-list.js"), "utf8"
);
const CHOICES = JSON.stringify([{ id: "a", label: "das Haus" }, { id: "b", label: "fahren" }, { id: "c", label: "groß" }]);

async function mount(attrs = {}) {
  const el = document.createElement("df-choice-list");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const btns = () => [...document.querySelectorAll('[data-action="choose-answer"]')];

afterEach(() => { document.body.innerHTML = ""; });

describe("choice list", () => {
  it("renders one enabled button per choice before an answer", async () => {
    await mount({ choices: CHOICES });
    expect(btns().map(b => b.dataset.choice)).toEqual(["a", "b", "c"]);
    expect(btns().every(b => b.className === "answer-btn")).toBe(true);
    expect(btns().every(b => !b.disabled)).toBe(true);
    expect(btns()[0].querySelector("span").getAttribute("lang")).toBe("de");
  });

  it("marks correct, wrong, and dimmed choices once revealed", async () => {
    await mount({ choices: CHOICES, revealed: true, correctid: "a", chosenid: "b" });
    expect(btns().map(b => b.className)).toEqual(["answer-btn correct", "answer-btn wrong", "answer-btn dim"]);
    expect(btns().every(b => b.disabled)).toBe(true);
  });

  it("marks only the correct choice when the learner picked it", async () => {
    await mount({ choices: CHOICES, revealed: true, correctid: "a", chosenid: "a" });
    expect(btns().map(b => b.className)).toEqual(["answer-btn correct", "answer-btn dim", "answer-btn dim"]);
  });

  it("dispatches through delegation with the choice id", async () => {
    await mount({ choices: CHOICES });
    const handler = vi.fn(e => {
      const b = e.target.closest("[data-action]");
      return b && `${b.dataset.action}:${b.dataset.choice}`;
    });
    document.addEventListener("click", handler);
    btns()[1].querySelector("span").click();
    expect(handler.mock.results[0].value).toBe("choose-answer:b");
    document.removeEventListener("click", handler);
  });

  it("renders nothing for absent or malformed choices", async () => {
    expect((await mount({})).querySelectorAll("button")).toHaveLength(0);
    document.body.innerHTML = "";
    expect((await mount({ choices: "nope" })).querySelectorAll("button")).toHaveLength(0);
  });

  it("does not decide correctness itself", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["validate", "submitanswer", "indexeddb", "schedulecard", "repositor"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
