// @vitest-environment happy-dom
/*
 * Minimum proof that the Feature I architecture works end to end:
 * settings -> plan -> component render, and every control back out as an event.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-reminder-settings.js";
import {
  PERMISSION, normalizeReminderSettings, planReminders
} from "../../01_APPLICATION/CURRENT_APP/src/reminders/reminder-schedule.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-reminder-settings.js"), "utf8");

const HOUR = 3600000;
const T0 = Date.UTC(2026, 2, 1, 0, 0, 0);
const utc = () => 0;

const settings = (over = {}) => normalizeReminderSettings({
  enabled: true, dailyEnabled: true, dailyTime: "19:30",
  dueReviewEnabled: true, dueReviewTime: "09:00", dueReviewMinimum: 5,
  minGapHours: 6, skipIfStudiedToday: true, ...over
});

const plan = (config = settings(), state = {}) => planReminders(config, {
  permission: PERMISSION.GRANTED, dueCount: 10, lastStudiedAt: null, lastDelivered: {}, ...state
}, { now: T0 + 8 * HOUR, offsetAt: utc });

async function mount(props) {
  const el = document.createElement("df-reminder-settings");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);
const all = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

afterEach(() => { document.body.innerHTML = ""; });

describe("reminder settings", () => {
  it("says reminders work offline and without an account", async () => {
    const el = await mount({ settings: settings(), permission: "granted" });
    expect(sr(el, ".note").textContent).toContain("دون إنترنت ودون حساب");
  });

  it("shows the real permission state", async () => {
    for (const [permission, expected] of [
      ["granted", "ممنوح"], ["denied", "مرفوض"], ["unknown", "لم يُطلب"], ["unsupported", "غير متاح"]
    ]) {
      document.body.innerHTML = "";
      const el = await mount({ settings: settings(), permission });
      expect(sr(el, "[data-permission]").dataset.permission).toBe(permission);
      expect(sr(el, "[data-permission]").textContent).toContain(expected);
    }
  });

  it("offers the permission prompt only when it has not been asked", async () => {
    const unknown = await mount({ settings: settings(), permission: "unknown" });
    expect(sr(unknown, '[data-action="request-permission"]')).not.toBeNull();

    document.body.innerHTML = "";
    const denied = await mount({ settings: settings(), permission: "denied" });
    // Asking again does nothing on iOS once denied; the card says to use system settings.
    expect(sr(denied, '[data-action="request-permission"]')).toBeNull();
    expect(sr(denied, "[data-permission]").textContent).toContain("إعدادات النظام");
  });

  it("requests permission through an event rather than acting itself", async () => {
    const el = await mount({ settings: settings(), permission: "unknown" });
    let asked = 0;
    el.addEventListener("permission-request", () => { asked += 1; });
    sr(el, '[data-action="request-permission"]').click();
    expect(asked).toBe(1);
  });

  it("hides every reminder control while reminders are off", async () => {
    const el = await mount({ settings: settings({ enabled: false }), permission: "granted" });
    expect(sr(el, '[data-field="enabled"]').checked).toBe(false);
    expect(sr(el, '[data-field="dailyEnabled"]')).toBeNull();
    expect(sr(el, '[data-field="dailyTime"]')).toBeNull();
  });

  it("shows the configured times and minimum", async () => {
    const el = await mount({ settings: settings(), permission: "granted" });
    expect(sr(el, '[data-field="dailyTime"]').value).toBe("19:30");
    expect(sr(el, '[data-field="dueReviewTime"]').value).toBe("09:00");
    expect(sr(el, '[data-field="dueReviewMinimum"]').value).toBe("5");
  });

  it("hides a kind's time field when that kind is off", async () => {
    const el = await mount({ settings: settings({ dueReviewEnabled: false }), permission: "granted" });
    expect(sr(el, '[data-field="dueReviewTime"]')).toBeNull();
    expect(sr(el, '[data-field="dailyTime"]')).not.toBeNull();
  });

  it("reports each change as an event and changes nothing itself", async () => {
    const el = await mount({ settings: settings(), permission: "granted" });
    const events = [];
    el.addEventListener("reminder-change", e => events.push(e.detail));

    const toggle = sr(el, '[data-field="enabled"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));

    const time = sr(el, '[data-field="dailyTime"]');
    time.value = "07:15";
    time.dispatchEvent(new Event("change"));

    const minimum = sr(el, '[data-field="dueReviewMinimum"]');
    minimum.value = "20";
    minimum.dispatchEvent(new Event("change"));

    expect(events).toEqual([
      { field: "enabled", value: false },
      { field: "dailyTime", value: "07:15" },
      { field: "dueReviewMinimum", value: 20 }
    ]);
    // The component did not apply anything to its own settings object.
    expect(el.settings.enabled).toBe(true);
    expect(el.settings.dailyTime).toBe("19:30");
  });

  it("previews when each reminder will fire", async () => {
    const el = await mount({ settings: settings(), plan: plan(), permission: "granted" });
    const rows = all(el, ".plan-row");
    expect(rows.map(r => r.dataset.kind)).toEqual(["daily_study", "due_review"]);
    expect(rows.every(r => r.dataset.scheduled === "true")).toBe(true);
    expect(rows[0].querySelector(".time").textContent.trim()).toMatch(/^\d{2}:\d{2}$/);
  });

  it("explains why a reminder will stay silent instead of looking broken", async () => {
    const el = await mount({
      settings: settings(),
      plan: plan(settings(), { lastStudiedAt: T0 + 7 * HOUR, dueCount: 2 }),
      permission: "granted"
    });
    const rows = all(el, ".plan-row");
    expect(rows[0].dataset.scheduled).toBe("false");
    expect(rows[0].querySelector("[data-reason]").dataset.reason).toBe("already-studied-today");
    expect(rows[1].querySelector("[data-reason]").dataset.reason).toBe("below-due-minimum");
    expect(rows[1].textContent).toContain("أقل من الحد الأدنى");
  });

  it("explains a permission block in the preview too", async () => {
    const el = await mount({
      settings: settings(),
      plan: plan(settings(), { permission: PERMISSION.DENIED }),
      permission: "denied"
    });
    expect(sr(el, "[data-reason]").dataset.reason).toBe("permission-denied");
  });

  it("renders with no settings or plan at all", async () => {
    const el = await mount({});
    expect(sr(el, ".panel")).not.toBeNull();
    expect(sr(el, ".plan")).toBeNull();
  });

  it("never reaches storage, the OS, scoring or SRS", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard", "reviewcard",
      "dueat", "mastery", "capacitor", "localnotifications", "fetch("]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves SRS card data untouched while rendering and toggling", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: T0,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const el = await mount({ settings: settings(), plan: plan(), permission: "granted" });
    const toggle = sr(el, '[data-field="dailyEnabled"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(JSON.stringify(card)).toBe(before);
  });
});
