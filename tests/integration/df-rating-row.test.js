// @vitest-environment happy-dom
/*
 * <df-rating-row> — difficulty rating controls.
 *
 * The rating VALUE is the input to the SRS scheduler, so these tests pin the exact
 * values, labels, and class names the previous markup produced. What a rating means
 * stays in the scheduler and is not exercised here.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-rating-row.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-rating-row.js"),
  "utf8"
);

async function mount({ correct = false, suggested = 0 } = {}) {
  const el = document.createElement("df-rating-row");
  if (correct) el.setAttribute("correct", "");
  el.setAttribute("suggested", String(suggested));
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const buttons = () => [...document.querySelectorAll('[data-action="rate-answer"]')];

afterEach(() => { document.body.innerHTML = ""; });

describe("rating controls", () => {
  it("offers hard/good/easy for a correct answer, with the previous values and classes", async () => {
    await mount({ correct: true, suggested: 3 });
    expect(buttons().map(b => b.dataset.rating)).toEqual(["2", "3", "4"]);
    expect(buttons().map(b => b.className.split(" ")[1])).toEqual(["hard", "good", "easy"]);
    expect(buttons().map(b => b.textContent.trim())).toEqual(["صعب", "جيد", "سهل"]);
  });

  it("offers only 'again' for an incorrect or revealed answer", async () => {
    await mount({ correct: false });
    expect(buttons().map(b => b.dataset.rating)).toEqual(["1"]);
    expect(buttons()[0].className).toContain("again");
    expect(buttons()[0].textContent.trim()).toBe("ثبت الخطأ وأعدها");
  });

  it("highlights the rating the scheduler suggested", async () => {
    await mount({ correct: true, suggested: 4 });
    expect(buttons().filter(b => b.classList.contains("suggested")).map(b => b.dataset.rating))
      .toEqual(["4"]);
  });

  it("always highlights 'again' on the incorrect path, as the old markup did", async () => {
    await mount({ correct: false, suggested: 0 });
    expect(buttons()[0].classList.contains("suggested")).toBe(true);
  });

  it("highlights nothing when no suggestion applies", async () => {
    await mount({ correct: true, suggested: 0 });
    expect(buttons().filter(b => b.classList.contains("suggested"))).toHaveLength(0);
  });

  it("keeps buttons reachable from the document for delegated clicks", async () => {
    await mount({ correct: true, suggested: 3 });
    const handler = vi.fn(e => {
      const btn = e.target.closest("[data-action]");
      return btn && `${btn.dataset.action}:${btn.dataset.rating}`;
    });
    document.addEventListener("click", handler);

    buttons().find(b => b.dataset.rating === "2").click();

    expect(handler.mock.results[0].value).toBe("rate-answer:2");
    expect(buttons()[0].getRootNode()).toBe(document);
    document.removeEventListener("click", handler);
  });

  it("re-renders when the result flips from correct to incorrect", async () => {
    const el = await mount({ correct: true, suggested: 3 });
    expect(buttons()).toHaveLength(3);
    el.removeAttribute("correct");
    await el.updateComplete;
    expect(buttons().map(b => b.dataset.rating)).toEqual(["1"]);
  });

  it("does not implement scoring: it only emits the rating value", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);

    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of [
      "indexeddb", "sqlite", "capacitor", "schedulecard", "repositor",
      "finalizeanswer", "ease", "interval", "duedate"
    ]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
