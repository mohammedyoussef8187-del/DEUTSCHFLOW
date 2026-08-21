/*
 * Feature I — reminders and local notifications.
 *
 * The rules this suite defends hardest:
 *   - a reminder time is wall-clock, so DST and travel move the instant, not the hour
 *   - reminders read due state and never write anything a learner earned
 *   - silence is a feature: every skip states its reason
 *   - the native path is gated off and no cloud push or account exists anywhere
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_SETTINGS, NOTIFICATION_IDS, PERMISSION, REMINDER_KINDS, SCHEDULE_STATUS,
  buildScheduleRecord, cancelAllPlan, diffSchedule, formatLocalTime, isSameLocalDay,
  lastDeliveredByKind, localDayNumber, normalizeReminderSettings, nextOccurrence,
  parseLocalTime, planReminders, systemOffsetAt
} from "../../01_APPLICATION/CURRENT_APP/src/reminders/reminder-schedule.js";
import {
  NATIVE_NOTIFICATION_STATUS, NOTIFICATION_BACKEND, createLocalNotificationAdapter,
  createNoopNotificationAdapter, detectNotificationBridge, resolveNotificationAdapter,
  selectNotificationBackend
} from "../../01_APPLICATION/CURRENT_APP/src/platform/notifications/local-notification-adapter.js";
import { countDue, createReminderService } from "../../01_APPLICATION/CURRENT_APP/src/services/reminder-service.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const HOUR = 3600000;
const DAY = 86400000;
const PROFILE = "profile-1";

/* Fixed offsets keep every assertion independent of the machine's timezone. */
const utc = () => 0;
const berlin = () => 120;          // CEST, UTC+2
const kabul = () => 270;           // UTC+4:30, a half-hour zone
const negative = () => -300;       // UTC-5

/** 2026-03-01T00:00:00Z */
const T0 = Date.UTC(2026, 2, 1, 0, 0, 0);

/* ------------------------------------------------------------------ time */

describe("wall-clock time", () => {
  it("parses and formats HH:MM", () => {
    expect(parseLocalTime("19:30")).toBe(19 * 60 + 30);
    expect(parseLocalTime("7:05")).toBe(7 * 60 + 5);
    expect(parseLocalTime("00:00")).toBe(0);
    expect(formatLocalTime(19 * 60 + 30)).toBe("19:30");
    expect(formatLocalTime(0)).toBe("00:00");
  });

  it("rejects a bad time instead of silently meaning midnight", () => {
    for (const bad of ["24:00", "12:60", "abc", "", null, undefined, "1930", "12:3"]) {
      expect(parseLocalTime(bad), `${bad} should not parse`).toBeNull();
    }
    expect(nextOccurrence("nonsense", { now: T0, offsetAt: utc })).toBeNull();
  });

  it("finds the next occurrence later today", () => {
    const now = T0 + 8 * HOUR;                       // 08:00 UTC
    expect(nextOccurrence("19:30", { now, offsetAt: utc })).toBe(T0 + 19 * HOUR + 30 * 60000);
  });

  it("rolls to tomorrow when the time has already passed", () => {
    const now = T0 + 20 * HOUR;                      // 20:00 UTC
    expect(nextOccurrence("19:30", { now, offsetAt: utc })).toBe(T0 + DAY + 19 * HOUR + 30 * 60000);
  });

  it("never returns the current instant", () => {
    const now = T0 + 19 * HOUR + 30 * 60000;         // exactly 19:30
    expect(nextOccurrence("19:30", { now, offsetAt: utc })).toBe(now + DAY);
  });

  it("means the learner's local evening, not a fixed instant", () => {
    const now = T0 + 8 * HOUR;
    // 19:30 in Berlin (UTC+2) is 17:30 UTC.
    expect(nextOccurrence("19:30", { now, offsetAt: berlin })).toBe(T0 + 17 * HOUR + 30 * 60000);
    // 19:30 in a UTC-5 zone is 00:30 the next UTC day.
    expect(nextOccurrence("19:30", { now, offsetAt: negative })).toBe(T0 + DAY + 30 * 60000);
  });

  it("handles a half-hour timezone", () => {
    const now = T0 + 2 * HOUR;
    // 09:00 in UTC+4:30 is 04:30 UTC.
    expect(nextOccurrence("09:00", { now, offsetAt: kabul })).toBe(T0 + 4 * HOUR + 30 * 60000);
  });

  it("keeps the same wall-clock hour across a spring-forward DST change", () => {
    // Offset changes from +60 to +120 at 01:00 UTC on the target day.
    const change = T0 + DAY + HOUR;
    const offsetAt = ts => (ts < change ? 60 : 120);
    const now = T0 + 20 * HOUR;                      // after today's reminder passed

    const at = nextOccurrence("19:30", { now, offsetAt });
    // The learner still gets it at 19:30 local, which is now 17:30 UTC, not 18:30.
    expect(at).toBe(T0 + DAY + 17 * HOUR + 30 * 60000);
    expect(localDayNumber(at, offsetAt)).toBe(localDayNumber(now, offsetAt) + 1);
  });

  it("keeps the same wall-clock hour across a fall-back DST change", () => {
    const change = T0 + DAY + HOUR;
    const offsetAt = ts => (ts < change ? 120 : 60);
    const now = T0 + 20 * HOUR;
    expect(nextOccurrence("19:30", { now, offsetAt })).toBe(T0 + DAY + 18 * HOUR + 30 * 60000);
  });

  it("does not fire immediately when a clock jump would land the target in the past", () => {
    // Offset jumps forward right after `now`, pulling the naive candidate behind us.
    const now = T0 + 19 * HOUR;
    const offsetAt = ts => (ts <= now ? 0 : 120);
    const at = nextOccurrence("19:30", { now, offsetAt });
    expect(at).toBeGreaterThan(now);
  });

  it("groups instants into local days", () => {
    expect(isSameLocalDay(T0 + HOUR, T0 + 23 * HOUR, utc)).toBe(true);
    expect(isSameLocalDay(T0 + HOUR, T0 + 25 * HOUR, utc)).toBe(false);
    // 23:00 UTC is already tomorrow in Berlin.
    expect(isSameLocalDay(T0 + 23 * HOUR, T0 + 25 * HOUR, berlin)).toBe(true);
  });

  it("reads the system offset when none is injected", () => {
    expect(systemOffsetAt(T0)).toBe(-new Date(T0).getTimezoneOffset());
    expect(typeof nextOccurrence("19:30", { now: T0 })).toBe("number");
  });
});

/* ------------------------------------------------------------- settings */

describe("settings", () => {
  it("is opt-in: nothing is on until the learner asks", () => {
    expect(DEFAULT_REMINDER_SETTINGS.enabled).toBe(false);
    expect(normalizeReminderSettings({}).enabled).toBe(false);
  });

  it("falls back rather than throwing on a bad value", () => {
    const settings = normalizeReminderSettings({
      dailyTime: "99:99", dueReviewMinimum: "many", minGapHours: -5, enabled: 1
    });
    expect(settings.dailyTime).toBe("19:30");
    expect(settings.dueReviewMinimum).toBe(5);
    expect(settings.minGapHours).toBe(0);
    expect(settings.enabled).toBe(true);
  });

  it("clamps values into range", () => {
    expect(normalizeReminderSettings({ dueReviewMinimum: 9999 }).dueReviewMinimum).toBe(500);
    expect(normalizeReminderSettings({ minGapHours: 999 }).minGapHours).toBe(48);
  });

  it("is frozen, so a caller cannot mutate shared settings", () => {
    expect(Object.isFrozen(normalizeReminderSettings({}))).toBe(true);
  });
});

/* ------------------------------------------------------------- planning */

const enabled = {
  enabled: true, dailyEnabled: true, dailyTime: "19:30",
  dueReviewEnabled: true, dueReviewTime: "09:00", dueReviewMinimum: 5,
  minGapHours: 6, skipIfStudiedToday: true
};
const granted = { permission: PERMISSION.GRANTED, dueCount: 10, lastStudiedAt: null, lastDelivered: {} };
const plan = (settings = enabled, state = granted, now = T0 + 8 * HOUR) =>
  planReminders(settings, state, { now, offsetAt: utc });

describe("planning", () => {
  it("schedules both reminders when everything is in order", () => {
    const result = plan();
    expect(result.scheduled.map(e => e.kind)).toEqual([REMINDER_KINDS.DAILY_STUDY, REMINDER_KINDS.DUE_REVIEW]);
    expect(result.scheduled[0].at).toBe(T0 + 19 * HOUR + 30 * 60000);
    expect(result.scheduled[1].at).toBe(T0 + 9 * HOUR);            // still ahead today
  });

  it("schedules nothing at all when reminders are disabled", () => {
    const result = plan({ ...enabled, enabled: false });
    expect(result.scheduled).toEqual([]);
    expect(result.skipped.every(e => e.reason === "reminders-disabled")).toBe(true);
  });

  it("schedules nothing without permission, and says which state blocked it", () => {
    for (const permission of [PERMISSION.DENIED, PERMISSION.UNKNOWN, PERMISSION.UNSUPPORTED]) {
      const result = plan(enabled, { ...granted, permission });
      expect(result.scheduled).toEqual([]);
      expect(result.skipped[0].reason).toBe(`permission-${permission}`);
    }
  });

  it("accepts provisional permission, which iOS grants without a prompt", () => {
    expect(plan(enabled, { ...granted, permission: PERMISSION.PROVISIONAL }).scheduled).toHaveLength(2);
  });

  it("turns off one kind without touching the other", () => {
    const result = plan({ ...enabled, dueReviewEnabled: false });
    expect(result.scheduled.map(e => e.kind)).toEqual([REMINDER_KINDS.DAILY_STUDY]);
    expect(result.skipped[0].reason).toBe("kind-disabled");
  });

  it("stays quiet when the learner already studied in the reminder's day", () => {
    const now = T0 + 8 * HOUR;
    const result = plan(enabled, { ...granted, lastStudiedAt: now - HOUR }, now);
    expect(result.scheduled.map(e => e.kind)).toEqual([REMINDER_KINDS.DUE_REVIEW]);
    expect(result.skipped[0].reason).toBe("already-studied-today");
  });

  it("still reminds when the last study was yesterday", () => {
    const now = T0 + 8 * HOUR;
    const result = plan(enabled, { ...granted, lastStudiedAt: now - DAY }, now);
    expect(result.scheduled.map(e => e.kind)).toContain(REMINDER_KINDS.DAILY_STUDY);
  });

  it("honours a learner who wants the daily reminder regardless", () => {
    const now = T0 + 8 * HOUR;
    const result = plan({ ...enabled, skipIfStudiedToday: false },
      { ...granted, lastStudiedAt: now - HOUR }, now);
    expect(result.scheduled.map(e => e.kind)).toContain(REMINDER_KINDS.DAILY_STUDY);
  });

  it("does not nag about a handful of due cards", () => {
    const result = plan(enabled, { ...granted, dueCount: 4 });
    expect(result.scheduled.map(e => e.kind)).toEqual([REMINDER_KINDS.DAILY_STUDY]);
    expect(result.skipped[0].reason).toBe("below-due-minimum");
  });

  it("does not repeat a kind inside the minimum gap", () => {
    const now = T0 + 8 * HOUR;
    const result = plan(enabled, {
      ...granted, lastDelivered: { [REMINDER_KINDS.DAILY_STUDY]: now - 2 * HOUR }
    }, now);
    expect(result.skipped[0].reason).toBe("too-soon-after-last");
    expect(result.scheduled.map(e => e.kind)).toEqual([REMINDER_KINDS.DUE_REVIEW]);
  });

  it("allows a repeat once the gap has passed", () => {
    const now = T0 + 8 * HOUR;
    const result = plan(enabled, {
      ...granted, lastDelivered: { [REMINDER_KINDS.DAILY_STUDY]: now - 7 * HOUR }
    }, now);
    expect(result.scheduled.map(e => e.kind)).toContain(REMINDER_KINDS.DAILY_STUDY);
  });

  it("reports an unparseable time rather than scheduling at midnight", () => {
    const result = planReminders({ ...enabled, dailyTime: "99:99" }, granted,
      { now: T0, offsetAt: utc });
    // normalizeReminderSettings already replaced it with the default.
    expect(result.scheduled[0].at).toBe(T0 + 19 * HOUR + 30 * 60000);
  });

  it("keeps the notification body free of anything but a count", () => {
    const [daily, due] = plan().scheduled;
    expect(daily.payload.body).not.toMatch(/\d/);
    expect(due.payload.body).toContain("10");
    expect(JSON.stringify(plan())).not.toContain(PROFILE);
  });

  it("uses one stable id per kind, so rescheduling replaces rather than piles up", () => {
    expect(plan().scheduled.map(e => e.notificationId))
      .toEqual([NOTIFICATION_IDS.daily_study, NOTIFICATION_IDS.due_review]);
    expect(new Set(Object.values(NOTIFICATION_IDS)).size).toBe(Object.keys(NOTIFICATION_IDS).length);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
  });
});

/* -------------------------------------------------- cancel and reschedule */

describe("rescheduling", () => {
  const pendingFor = result => result.scheduled.map(e => ({ notificationId: e.notificationId, at: e.at }));

  it("schedules everything when the OS holds nothing", () => {
    const result = plan();
    const diff = diffSchedule([], result);
    expect(diff.toSchedule).toHaveLength(2);
    expect(diff.toCancel).toEqual([]);
  });

  it("changes nothing when the plan matches what is already pending", () => {
    const result = plan();
    const diff = diffSchedule(pendingFor(result), result);
    expect(diff.toSchedule).toEqual([]);
    expect(diff.toCancel).toEqual([]);
    expect(diff.unchanged).toHaveLength(2);
  });

  it("reschedules only the reminder whose time changed", () => {
    const before = plan();
    const after = plan({ ...enabled, dailyTime: "20:00" });
    const diff = diffSchedule(pendingFor(before), after);
    expect(diff.toSchedule.map(e => e.kind)).toEqual([REMINDER_KINDS.DAILY_STUDY]);
    expect(diff.unchanged.map(e => e.kind)).toEqual([REMINDER_KINDS.DUE_REVIEW]);
    expect(diff.toCancel).toEqual([]);
  });

  it("cancels a reminder the learner switched off", () => {
    const before = plan();
    const after = plan({ ...enabled, dueReviewEnabled: false });
    const diff = diffSchedule(pendingFor(before), after);
    expect(diff.toCancel.map(e => e.kind)).toEqual([REMINDER_KINDS.DUE_REVIEW]);
    expect(diff.toCancel[0].reason).toBe("kind-disabled");
  });

  it("cancels a leftover notification the plan does not recognize", () => {
    const result = plan();
    const diff = diffSchedule([...pendingFor(result), { notificationId: 9999, at: T0 }], result);
    expect(diff.toCancel).toEqual([{ notificationId: 9999, kind: null, reason: "unknown-notification" }]);
  });

  it("cancels everything pending when reminders are turned off", () => {
    const diff = cancelAllPlan(pendingFor(plan()));
    expect(diff.toSchedule).toEqual([]);
    expect(diff.toCancel).toHaveLength(2);
    expect(diff.toCancel.every(e => e.reason === "reminders-disabled")).toBe(true);
  });

  it("cancels nothing when nothing is pending", () => {
    expect(cancelAllPlan([]).toCancel).toEqual([]);
    expect(cancelAllPlan(null).toCancel).toEqual([]);
  });
});

/* ------------------------------------------------------------- records */

describe("schedule records", () => {
  it("records what was scheduled, with no learner state in it", () => {
    const entry = plan().scheduled[0];
    const record = buildScheduleRecord(entry, { profileUuid: PROFILE, now: T0 });
    expect(record).toMatchObject({
      profileUuid: PROFILE, kind: REMINDER_KINDS.DAILY_STUDY,
      scheduledFor: entry.at, scheduledAt: T0, status: SCHEDULE_STATUS.SCHEDULED,
      deliveredAt: null, cancelledAt: null
    });
    for (const forbidden of ["dueAt", "ease", "mastery", "intervalDays", "dueCount"]) {
      expect(record).not.toHaveProperty(forbidden);
    }
  });

  it("finds the last delivery per kind for this learner only", () => {
    const rows = [
      { profileUuid: PROFILE, kind: "daily_study", deliveredAt: T0, deleted: 0 },
      { profileUuid: PROFILE, kind: "daily_study", deliveredAt: T0 + DAY, deleted: 0 },
      { profileUuid: PROFILE, kind: "daily_study", deliveredAt: T0 + 2 * DAY, deleted: 1 },
      { profileUuid: "other", kind: "daily_study", deliveredAt: T0 + 9 * DAY, deleted: 0 },
      { profileUuid: PROFILE, kind: "due_review", deliveredAt: null, deleted: 0 }
    ];
    expect(lastDeliveredByKind(rows, PROFILE)).toEqual({ daily_study: T0 + DAY });
    expect(lastDeliveredByKind([], PROFILE)).toEqual({});
  });
});

/* ------------------------------------------------------ native isolation */

describe("native adapter isolation", () => {
  const SOURCE = fs.readFileSync(path.resolve(process.cwd(),
    "01_APPLICATION/CURRENT_APP/src/platform/notifications/local-notification-adapter.js"), "utf8");
  // Comments are stripped: the prose deliberately NAMES the plugin whose shape the
  // injected bridge matches, which is documentation, not a dependency.
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("imports nothing at all, native or otherwise", () => {
    const imports = [...SOURCE.matchAll(/^import\s/gm)];
    expect(imports).toHaveLength(0);
    expect(CODE).not.toContain("@capacitor/local-notifications");
  });

  it("has no cloud push and no account anywhere", () => {
    const code = CODE.toLowerCase();
    for (const forbidden of ["fcm", "apns", "firebase", "pushnotifications", "fetch(",
      "http", "token", "login", "account"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("is gated off, exactly like native storage was", () => {
    expect(NATIVE_NOTIFICATION_STATUS.learnerSwitchEnabled).toBe(false);
    expect(NATIVE_NOTIFICATION_STATUS.physicalDeviceGate).toBe("deferred-release-gate");
    expect(selectNotificationBackend({ isNativePlatform: true, nativeNotificationsEnabled: false, hasBridge: true }))
      .toEqual({ backend: NOTIFICATION_BACKEND.NONE, reason: "native-notifications-gated-until-verified" });
  });

  it("never chooses the native backend on a web target", () => {
    expect(selectNotificationBackend({ isNativePlatform: false, nativeNotificationsEnabled: true, hasBridge: true }).backend)
      .toBe(NOTIFICATION_BACKEND.NONE);
  });

  it("degrades to no-op when the bridge is missing", () => {
    expect(selectNotificationBackend({ isNativePlatform: true, nativeNotificationsEnabled: true, hasBridge: false }).reason)
      .toBe("notification-bridge-unavailable");
    expect(resolveNotificationAdapter({ isNativePlatform: true, nativeNotificationsEnabled: true, bridge: null }).backend)
      .toBe(NOTIFICATION_BACKEND.NONE);
  });

  it("reads the bridge off the global rather than importing it", () => {
    expect(detectNotificationBridge({})).toBeNull();
    const bridge = {};
    expect(detectNotificationBridge({ Capacitor: { Plugins: { LocalNotifications: bridge } } })).toBe(bridge);
  });

  it("schedules nothing through the no-op adapter", async () => {
    const noop = createNoopNotificationAdapter("gated");
    expect(await noop.permission()).toBe("unsupported");
    expect(await noop.pending()).toEqual([]);
    expect(await noop.schedule([{ notificationId: 1 }])).toEqual({ scheduled: 0, skipped: "unsupported" });
  });

  it("translates the plan into what the plugin expects", async () => {
    const calls = [];
    const bridge = {
      checkPermissions: async () => ({ display: "granted" }),
      requestPermissions: async () => ({ display: "granted" }),
      getPending: async () => ({ notifications: [{ id: 1001, schedule: { at: new Date(T0) } }] }),
      schedule: async payload => { calls.push(["schedule", payload]); },
      cancel: async payload => { calls.push(["cancel", payload]); }
    };
    const adapter = createLocalNotificationAdapter(bridge);

    expect(await adapter.permission()).toBe("granted");
    expect(await adapter.pending()).toEqual([{ notificationId: 1001, at: T0 }]);

    const entry = plan().scheduled[0];
    await adapter.schedule([entry]);
    const [, payload] = calls[0];
    expect(payload.notifications[0]).toMatchObject({ id: entry.notificationId, title: "وقت الدراسة" });
    expect(payload.notifications[0].schedule.at).toBeInstanceOf(Date);
    expect(payload.notifications[0].schedule.at.getTime()).toBe(entry.at);

    await adapter.cancel([{ notificationId: 1001 }]);
    expect(calls[1][1]).toEqual({ notifications: [{ id: 1001 }] });
  });

  it("maps every permission state the plugin can return", async () => {
    const make = display => createLocalNotificationAdapter({ checkPermissions: async () => ({ display }) });
    expect(await make("granted").permission()).toBe("granted");
    expect(await make("denied").permission()).toBe("denied");
    expect(await make("prompt").permission()).toBe("unknown");
    expect(await make("provisional").permission()).toBe("provisional");
    expect(await make("something-new").permission()).toBe("unknown");
  });

  it("never lets a failing notification call break study", async () => {
    const errors = [];
    const adapter = createLocalNotificationAdapter({
      checkPermissions: async () => { throw new Error("boom"); },
      getPending: async () => { throw new Error("boom"); },
      schedule: async () => { throw new Error("boom"); },
      cancel: async () => { throw new Error("boom"); }
    }, { onError: e => errors.push(e.label) });

    expect(await adapter.permission()).toBe("unknown");
    expect(await adapter.pending()).toEqual([]);
    expect(await adapter.schedule([{ notificationId: 1 }])).toMatchObject({ scheduled: 0, failed: 1 });
    expect(await adapter.cancel([{ notificationId: 1 }])).toMatchObject({ cancelled: 0, failed: 1 });
    expect(errors).toEqual(["checkPermissions", "getPending", "schedule", "cancel"]);
  });
});

/* ------------------------------------------------------------- due state */

describe("due counting reads and never writes", () => {
  const cards = () => [
    { key: "1:recall", dueAt: T0 - DAY, ease: 2.5, mastery: 40, suspended: 0, deleted: 0 },
    { key: "2:recall", dueAt: T0 - HOUR, ease: 2.3, mastery: 10, suspended: 0, deleted: 0 },
    { key: "3:recall", dueAt: T0 + DAY, ease: 2.5, mastery: 60, suspended: 0, deleted: 0 },
    { key: "4:recall", dueAt: T0 - DAY, ease: 2.5, mastery: 0, suspended: 1, deleted: 0 },
    { key: "5:recall", dueAt: T0 - DAY, ease: 2.5, mastery: 0, suspended: 0, deleted: 1 }
  ];

  it("counts only cards that are actually due", () => {
    expect(countDue(cards(), T0)).toBe(2);
    expect(countDue(cards(), T0 + 2 * DAY)).toBe(3);
    expect(countDue([], T0)).toBe(0);
    expect(countDue(null, T0)).toBe(0);
  });

  it("leaves every card byte-identical", () => {
    const list = cards();
    const before = JSON.stringify(list);
    countDue(list, T0);
    planReminders(enabled, { ...granted, dueCount: countDue(list, T0) }, { now: T0, offsetAt: utc });
    expect(JSON.stringify(list)).toBe(before);
  });

  it("has no SRS, progress or scoring reference in either module", () => {
    for (const file of ["src/reminders/reminder-schedule.js", "src/services/reminder-service.js"]) {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP", file), "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
      for (const forbidden of ["schedulecard", "intervaldays", "ease", "lapses", "mastery",
        "courseprogress", "lessonprogress", "indexeddb", "sqlite"]) {
        expect(code, `${file} must not reference ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

/* --------------------------------------------------------------- service */

describe("reminder service", () => {
  function harness({ settings = enabled, dueCount = 10, lastStudiedAt = null,
                     history = [], permission = "granted", now = T0 + 8 * HOUR } = {}) {
    const calls = { scheduled: [], cancelled: [], settingsWritten: [], scheduleWritten: [] };
    let pending = [];
    let stored = settings;

    const adapter = {
      backend: "test",
      async permission() { return permission; },
      async requestPermission() { permission = "granted"; return permission; },
      async pending() { return pending; },
      async schedule(entries) {
        calls.scheduled.push(...entries);
        pending = [
          ...pending.filter(p => !entries.some(e => e.notificationId === p.notificationId)),
          ...entries.map(e => ({ notificationId: e.notificationId, at: e.at }))
        ];
        return { scheduled: entries.length };
      },
      async cancel(entries) {
        calls.cancelled.push(...entries);
        pending = pending.filter(p => !entries.some(e => e.notificationId === p.notificationId));
        return { cancelled: entries.length };
      }
    };

    const service = createReminderService({
      adapter,
      readDueCount: async () => dueCount,
      readLastStudiedAt: async () => lastStudiedAt,
      readSettings: async () => stored,
      readHistory: async () => history,
      writeSettings: async row => { calls.settingsWritten.push(row); stored = row; },
      writeSchedule: async rows => { calls.scheduleWritten.push(...rows); },
      offsetAt: utc,
      now: () => now
    });

    return { service, calls, pendingNow: () => pending };
  }

  it("previews without touching the OS", async () => {
    const { service, calls } = harness();
    const preview = await service.preview(PROFILE);
    expect(preview.scheduled).toHaveLength(2);
    expect(calls.scheduled).toEqual([]);
    expect(calls.cancelled).toEqual([]);
  });

  it("schedules on the first sync and records what it did", async () => {
    const { service, calls, pendingNow } = harness();
    await service.sync(PROFILE);
    expect(calls.scheduled.map(e => e.kind)).toEqual(["daily_study", "due_review"]);
    expect(pendingNow()).toHaveLength(2);
    expect(calls.scheduleWritten.every(row => row.status === SCHEDULE_STATUS.SCHEDULED)).toBe(true);
  });

  it("is idempotent: a second sync changes nothing", async () => {
    const { service, calls } = harness();
    await service.sync(PROFILE);
    const after = calls.scheduled.length;
    await service.sync(PROFILE);
    expect(calls.scheduled).toHaveLength(after);
    expect(calls.cancelled).toEqual([]);
  });

  it("reschedules when the time changes, cancelling nothing else", async () => {
    const { service, calls } = harness();
    await service.sync(PROFILE);
    calls.scheduled.length = 0;
    await service.update(PROFILE, { dailyTime: "20:00" });
    expect(calls.scheduled.map(e => e.kind)).toEqual(["daily_study"]);
    expect(calls.cancelled).toEqual([]);
  });

  it("cancels everything when disabled", async () => {
    const { service, calls, pendingNow } = harness();
    await service.sync(PROFILE);
    await service.disable(PROFILE);
    expect(calls.cancelled).toHaveLength(2);
    expect(pendingNow()).toEqual([]);
    expect(calls.scheduleWritten.some(row => row.status === SCHEDULE_STATUS.CANCELLED)).toBe(true);
  });

  it("schedules nothing when permission is denied", async () => {
    const { service, calls } = harness({ permission: "denied" });
    const result = await service.sync(PROFILE);
    expect(calls.scheduled).toEqual([]);
    expect(result.plan.skipped[0].reason).toBe("permission-denied");
  });

  it("asks for permission only when told to", async () => {
    const { service } = harness({ permission: "unknown" });
    expect(await service.permission()).toBe("unknown");
    expect(await service.requestPermission()).toBe("granted");
  });

  it("re-reads due state on every sync rather than caching it", async () => {
    let dueCount = 2;
    const { service, calls } = harness({ dueCount: 0 });
    const service2 = createReminderService({
      adapter: {
        async permission() { return "granted"; },
        async pending() { return []; },
        async schedule(entries) { calls.scheduled.push(...entries); return {}; },
        async cancel() { return {}; }
      },
      readDueCount: async () => dueCount,
      readSettings: async () => enabled,
      offsetAt: utc,
      now: () => T0 + 8 * HOUR
    });

    expect((await service2.preview(PROFILE)).skipped.map(e => e.reason)).toContain("below-due-minimum");
    dueCount = 20;
    expect((await service2.preview(PROFILE)).scheduled.map(e => e.kind)).toContain("due_review");
    expect(service).toBeTruthy();
  });

  it("respects the delivery gap taken from stored history", async () => {
    const now = T0 + 8 * HOUR;
    const { service } = harness({
      now,
      history: [{ profileUuid: PROFILE, kind: "daily_study", deliveredAt: now - HOUR, deleted: 0 }]
    });
    expect((await service.preview(PROFILE)).skipped.map(e => e.reason)).toContain("too-soon-after-last");
  });

  it("reports when the next reminder would land", async () => {
    const { service } = harness();
    expect(await service.nextAt(PROFILE)).toBe(T0 + 19 * HOUR + 30 * 60000);
    expect(await service.nextAt(PROFILE, "due_review")).toBe(T0 + 9 * HOUR);
  });

  it("refuses to write through a read-only service", async () => {
    const service = createReminderService({ readSettings: async () => enabled });
    await expect(service.update(PROFILE, { enabled: false })).rejects.toThrow(/read-only/);
  });

  it("does nothing at all with the default no-op adapter", async () => {
    const service = createReminderService({ readSettings: async () => enabled, offsetAt: utc, now: () => T0 });
    const result = await service.sync(PROFILE);
    expect(result.plan.scheduled).toEqual([]);
    expect(result.plan.skipped[0].reason).toBe("permission-unsupported");
  });

  it("exposes no way to write learner data", () => {
    const { service } = harness();
    expect(Object.keys(service).sort()).toEqual(
      ["adapter", "disable", "nextAt", "permission", "preview", "requestPermission",
       "settings", "sync", "update"]);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it("leaves SRS cards untouched across a full sync", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: T0 - DAY,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const { service } = harness({ dueCount: countDue([card], T0) });
    await service.sync(PROFILE);
    await service.update(PROFILE, { dailyTime: "07:15" });
    await service.disable(PROFILE);
    expect(JSON.stringify(card)).toBe(before);
  });
});

/* ------------------------------------------------------------- migration */

describe("migration creates no reminders", () => {
  it("does not turn on a notification the learner never asked for", () => {
    const { dataset } = migrateToCanonical({
      words: [{ id: 1, german: "das Haus", arabic: "بيت", itemType: "noun", level: "A1" }],
      cards: [{ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1, intervalDays: 3,
        ease: 2.5, reps: 2, lapses: 1, streak: 1, mastery: 40 }],
      attempts: [], settings: { dailyGoal: 25 }, profile: null
    }, { now: T0 });

    expect(dataset.reminderSettings).toEqual([]);
    expect(dataset.reminderSchedule).toEqual([]);
    // Everything earned still migrates intact.
    expect(dataset.reviewCards[0]).toMatchObject({ ease: 2.5, mastery: 40, lapses: 1 });
    expect(dataset.quarantine).toEqual([]);
  });
});
