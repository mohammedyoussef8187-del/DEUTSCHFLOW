// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-skill-bar.js";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-activity-chart.js";

async function mount(tag, attrs = {}) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("skill accuracy bar", () => {
  it("exposes a real progressbar with its value and name", async () => {
    const el = await mount("df-skill-bar", { label: "الاستدعاء", accuracy: 72, attempts: "١٢ محاولة", detail: "تفاصيل" });
    const bar = el.querySelector('[role="progressbar"]');
    expect(bar.getAttribute("aria-label")).toBe("الاستدعاء");
    expect(bar.getAttribute("aria-valuenow")).toBe("72");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(el.querySelector(".mini-progress span").getAttribute("style")).toBe("width:72%");
    expect(el.querySelector(".skill-head span").textContent.trim()).toBe("الاستدعاء · ١٢ محاولة");
    expect(el.querySelector(".skill-detail").textContent.trim()).toBe("تفاصيل");
  });

  it("clamps out-of-range accuracy", async () => {
    expect((await mount("df-skill-bar", { accuracy: 140 })).querySelector("span[style]").getAttribute("style")).toBe("width:100%");
    document.body.innerHTML = "";
    expect((await mount("df-skill-bar", { accuracy: -5 })).querySelector("span[style]").getAttribute("style")).toBe("width:0%");
  });

  it("omits the detail line when there is none", async () => {
    expect((await mount("df-skill-bar", { label: "x", accuracy: 0 })).querySelector(".skill-detail")).toBeNull();
  });
});

describe("activity chart", () => {
  const days = JSON.stringify([{ label: "السبت", n: 3 }, { label: "الأحد", n: 0 }, { label: "الاثنين", n: 6 }]);

  it("is a labelled image with a text alternative listing every day", async () => {
    const el = await mount("df-activity-chart", { days });
    const chart = el.querySelector(".activity-bars");
    expect(chart.getAttribute("role")).toBe("img");
    expect(chart.getAttribute("aria-label")).toContain("السبت: 3");
    expect(chart.getAttribute("aria-label")).toContain("الاثنين: 6");
  });

  it("hides the decorative bars from assistive technology", async () => {
    const el = await mount("df-activity-chart", { days });
    expect([...el.querySelectorAll(".day-bar")].every(d => d.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("scales bars against the busiest day and keeps a visible minimum", async () => {
    const el = await mount("df-activity-chart", { days });
    const heights = [...el.querySelectorAll(".bar")].map(b => b.getAttribute("style"));
    expect(heights[2]).toBe("height:100%");   // busiest day
    expect(heights[0]).toBe("height:50%");    // 3 of 6
    expect(heights[1]).toBe("height:3%");     // zero day stays visible
  });

  it("stays flat for an all-zero week instead of dividing by zero", async () => {
    const el = await mount("df-activity-chart", { days: JSON.stringify([{ label: "a", n: 0 }, { label: "b", n: 0 }]) });
    expect([...el.querySelectorAll(".bar")].map(b => b.getAttribute("style"))).toEqual(["height:3%", "height:3%"]);
  });

  it("tolerates malformed day data", async () => {
    expect((await mount("df-activity-chart", { days: "nope" })).querySelectorAll(".day-bar")).toHaveLength(0);
  });
});
