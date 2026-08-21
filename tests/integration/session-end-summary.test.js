// @vitest-environment happy-dom
/*
 * Session-end summary consolidation.
 *
 * The session summary and the data-audit row both rendered the same value+label tile,
 * but with DIFFERENT number formatting: the session summary printed raw values
 * ("+12", "1234"), while the audit row localized them ("١٬٢٣٤"). Consolidating them onto
 * <df-stat-tile> must preserve each call site's original output exactly.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-stat-tile.js";

const APP_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8"
);

/** Load the real helpers out of app.js and evaluate them in isolation. */
function loadHelpers() {
  const start = APP_SOURCE.indexOf("function tileValue(n){");
  const end = APP_SOURCE.indexOf("function statCard(", start);
  const tileValueSrc = APP_SOURCE.slice(start, end);

  const mStart = APP_SOURCE.indexOf("function metricTile(value,label){");
  const mEnd = APP_SOURCE.indexOf("function miniAudit(", mStart);
  const metricSrc = APP_SOURCE.slice(mStart, mEnd);

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

  return new Function("DF", `${tileValueSrc}; ${metricSrc};
    function miniAudit(n,label){return metricTile(tileValue(n),label);}
    return { tileValue, metricTile, miniAudit };`)({ esc });
}

const { metricTile, miniAudit } = loadHelpers();

const valueOf = markup => markup.match(/value="([^"]*)"/)[1];

afterEach(() => { document.body.innerHTML = ""; });

describe("session summary formatting is preserved", () => {
  it("prints session values raw, exactly as the old markup did", () => {
    // Old markup was `<strong>${s.attempts}</strong>` — no localization.
    expect(valueOf(metricTile(1234, "إجمالي المحاولات"))).toBe("1234");
    expect(valueOf(metricTile(0, "عرض إجابة"))).toBe("0");
    // Old markup was `<strong>+${s.xp}</strong>` — the plus sign must survive.
    expect(valueOf(metricTile("+12", "نقطة خبرة"))).toBe("+12");
    // Accuracy strings pass through untouched.
    expect(valueOf(metricTile("—", "دقة أول محاولة"))).toBe("—");
    expect(valueOf(metricTile("85%", "دقة كل المحاولات"))).toBe("85%");
  });

  it("keeps the audit row localized, exactly as the old markup did", () => {
    // Old markup was `Number(n||0).toLocaleString("ar-EG")`.
    expect(valueOf(miniAudit(1234, "سليمة هيكلياً"))).toBe((1234).toLocaleString("ar-EG"));
    expect(valueOf(miniAudit(0, "تكرارات مطابقة"))).toBe((0).toLocaleString("ar-EG"));
    expect(valueOf(miniAudit(null, "تحتاج مراجعة"))).toBe((0).toLocaleString("ar-EG"));
  });

  it("no legacy end-stat markup remains in the app", () => {
    expect(APP_SOURCE).not.toContain('class="end-stat"');
  });
});

describe("icon-less tile variant", () => {
  async function mount(attrs) {
    const el = document.createElement("df-stat-tile");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    document.body.append(el);
    await el.updateComplete;
    return el;
  }

  it("renders a stacked metric with no icon box when no icon is given", async () => {
    const el = await mount({ value: "12", label: "تلميحات" });
    expect(el.shadowRoot.querySelector(".icon")).toBeNull();
    expect(el.shadowRoot.querySelector(".tile").classList.contains("plain")).toBe(true);
    expect(el.shadowRoot.querySelector("strong").textContent.trim()).toBe("12");
    expect(el.shadowRoot.querySelector(".value span").textContent.trim()).toBe("تلميحات");
  });

  it("leaves existing icon tiles unchanged", async () => {
    const el = await mount({ icon: "✓", value: "5", label: "متقنة", tone: "mastered" });
    expect(el.shadowRoot.querySelector(".icon").textContent.trim()).toBe("✓");
    expect(el.shadowRoot.querySelector(".tile").classList.contains("plain")).toBe(false);
  });

  it("stays read-only in both variants", async () => {
    for (const attrs of [{ value: "1", label: "x" }, { icon: "✓", value: "1", label: "x" }]) {
      const el = await mount(attrs);
      expect(el.shadowRoot.querySelectorAll("button, input, form")).toHaveLength(0);
    }
  });
});
