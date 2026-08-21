// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-setting-row.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-setting-row.js"), "utf8"
);

async function mount(attrs = {}) {
  const el = document.createElement("df-setting-row");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("settings row", () => {
  it("renders the toggle variant with the setting key the handler reads", async () => {
    await mount({ kind: "toggle", label: "إظهار النطق", desc: "وصف", key: "showPronunciation", on: true });
    const btn = document.querySelector('[data-action="toggle-setting"]');
    expect(btn.dataset.setting).toBe("showPronunciation");
    expect(btn.classList.contains("on")).toBe(true);
    expect(btn.getRootNode()).toBe(document);
  });

  it("renders the number variant with the class and key the change handler matches", async () => {
    await mount({ kind: "number", label: "الكلمات الجديدة", desc: "وصف", key: "newPerDay", value: 12 });
    const input = document.querySelector("input.setting-number");
    expect(input.dataset.setting).toBe("newPerDay");
    expect(input.value).toBe("12");
    expect(input.type).toBe("number");
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  it("gives both controls an accessible name, which the toggle previously lacked", async () => {
    const toggle = await mount({ kind: "toggle", label: "قبول ss", desc: "شرح", key: "acceptSs" });
    const btn = toggle.querySelector("button");
    expect(btn.getAttribute("aria-label")).toBe("قبول ss");
    expect(btn.getAttribute("role")).toBe("switch");
    expect(btn.getAttribute("aria-checked")).toBe("false");
    // The description is announced with the control.
    expect(btn.getAttribute("aria-describedby")).toBe(toggle.querySelector("p").id);
    document.body.innerHTML = "";

    const number = await mount({ kind: "number", label: "حجم الجلسة", desc: "شرح", key: "sessionSize", value: 20 });
    expect(number.querySelector("input").getAttribute("aria-label")).toBe("حجم الجلسة");
  });

  it("reflects switch state in aria-checked", async () => {
    const el = await mount({ kind: "toggle", label: "x", key: "k", on: true });
    expect(el.querySelector("button").getAttribute("aria-checked")).toBe("true");
    el.removeAttribute("on");
    await el.updateComplete;
    expect(el.querySelector("button").getAttribute("aria-checked")).toBe("false");
    expect(el.querySelector("button").classList.contains("on")).toBe(false);
  });

  it("dispatches the toggle through delegation", async () => {
    await mount({ kind: "toggle", label: "x", key: "acceptAeOeUe" });
    const handler = vi.fn(e => {
      const b = e.target.closest("[data-action]");
      return b && `${b.dataset.action}:${b.dataset.setting}`;
    });
    document.addEventListener("click", handler);
    document.querySelector("button.toggle").click();
    expect(handler.mock.results[0].value).toBe("toggle-setting:acceptAeOeUe");
    document.removeEventListener("click", handler);
  });

  it("gives each row a unique description id", async () => {
    await mount({ kind: "toggle", label: "a", desc: "one", key: "k1" });
    await mount({ kind: "toggle", label: "b", desc: "two", key: "k2" });
    const ids = [...document.querySelectorAll("df-setting-row p")].map(p => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("stores nothing itself", () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "repositor", "savesettings", "sqlite"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
