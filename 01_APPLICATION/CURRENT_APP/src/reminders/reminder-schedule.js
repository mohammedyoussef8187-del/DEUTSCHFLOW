/*
 * Reminder scheduling (Feature I) — pure, deterministic, device-free.
 *
 * Everything here is arithmetic over an injected clock and an injected UTC-offset
 * function, so the whole of the scheduling behaviour — including DST transitions and a
 * learner changing timezone — is unit-testable with no device, no OS and no real
 * notification.
 *
 * Three rules:
 *
 *   1. A REMINDER TIME IS WALL-CLOCK, NOT AN INSTANT. "19:30" means half past seven in
 *      the learner's own evening, which is a different absolute instant after a flight
 *      or a clock change. The instant is derived at planning time, never stored.
 *
 *   2. REMINDERS READ, THEY NEVER WRITE. Due counts and last-studied come in as plain
 *      numbers. Nothing in this module can reach a card, a due date, an ease or a
 *      progress row, so no reminder can alter what a learner has earned.
 *
 *   3. SILENCE IS A FEATURE. A reminder is skipped, with a stated reason, when the
 *      learner has already studied, when there is too little to do, when the previous
 *      one was too recent, or when permission was never granted. The plan always says
 *      WHY something was skipped rather than quietly dropping it.
 */

export const REMINDER_KINDS = Object.freeze({
  DAILY_STUDY: "daily_study",
  DUE_REVIEW: "due_review"
});

/** What the OS last told us. `unknown` means we have not asked yet. */
export const PERMISSION = Object.freeze({
  UNKNOWN: "unknown",
  GRANTED: "granted",
  DENIED: "denied",
  PROVISIONAL: "provisional",
  UNSUPPORTED: "unsupported"
});

/** Permission states under which the OS will actually show something. */
const ALLOWED_PERMISSIONS = Object.freeze([PERMISSION.GRANTED, PERMISSION.PROVISIONAL]);

export const SCHEDULE_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  SKIPPED: "skipped"
});

/** Opt-in by default: nothing is scheduled until the learner asks for it. */
export const DEFAULT_REMINDER_SETTINGS = Object.freeze({
  enabled: false,
  dailyEnabled: true,
  dailyTime: "19:30",
  dueReviewEnabled: false,
  dueReviewTime: "09:00",
  dueReviewMinimum: 5,
  minGapHours: 6,
  skipIfStudiedToday: true
});

const HOUR = 3600000;
const DAY = 86400000;
const MINUTE = 60000;

/** Stable notification ids per kind, so rescheduling replaces rather than accumulates. */
export const NOTIFICATION_IDS = Object.freeze({
  [REMINDER_KINDS.DAILY_STUDY]: 1001,
  [REMINDER_KINDS.DUE_REVIEW]: 1002
});

/* ------------------------------------------------------------------- time */

/** The local UTC offset in minutes at an instant. Injectable, so tests need no TZ. */
export function systemOffsetAt(timestamp) {
  return -new Date(timestamp).getTimezoneOffset();
}

/**
 * Parse "HH:MM" into minutes after local midnight.
 * Returns null for anything unparseable, so a bad value is reported rather than
 * silently becoming midnight.
 */
export function parseLocalTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatLocalTime(minutesAfterMidnight) {
  const total = ((Math.round(minutesAfterMidnight) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The next instant at which the local wall clock reads `time`, strictly after `now`.
 *
 * DST is handled by deriving the offset twice: once at `now` to find the candidate, and
 * again at the candidate itself, because the offset that applies to a future instant is
 * the future one. A clock change between the two shifts the answer by exactly the
 * difference, which is what the learner means by "still at seven".
 *
 * @param {string|number} time "HH:MM" or minutes after midnight
 * @param {object} options { now, offsetAt }
 * @returns {number|null} epoch ms, or null when the time cannot be parsed
 */
export function nextOccurrence(time, { now = Date.now(), offsetAt = systemOffsetAt } = {}) {
  const minutes = typeof time === "number" ? time : parseLocalTime(time);
  if (minutes === null || !Number.isFinite(minutes)) return null;

  const candidateFor = offsetMinutes => {
    const localNow = now + offsetMinutes * MINUTE;
    const localMidnight = Math.floor(localNow / DAY) * DAY;
    let localTarget = localMidnight + minutes * MINUTE;
    if (localTarget <= localNow) localTarget += DAY;
    return localTarget - offsetMinutes * MINUTE;
  };

  const firstPass = candidateFor(offsetAt(now));
  const correctedOffset = offsetAt(firstPass);
  const secondPass = candidateFor(correctedOffset);

  // If correcting pushed the occurrence into the past (a clock jumping forward across
  // the target), take the following day rather than firing immediately.
  return secondPass > now ? secondPass : secondPass + DAY;
}

/** The local wall-clock day an instant falls in, as an integer day number. */
export function localDayNumber(timestamp, offsetAt = systemOffsetAt) {
  return Math.floor((timestamp + offsetAt(timestamp) * MINUTE) / DAY);
}

/** Whether two instants fall on the same local day. */
export function isSameLocalDay(a, b, offsetAt = systemOffsetAt) {
  return localDayNumber(a, offsetAt) === localDayNumber(b, offsetAt);
}

/* -------------------------------------------------------------- normalizing */

/** Settings with every field present and in range. Bad values fall back, never throw. */
export function normalizeReminderSettings(settings = {}) {
  const time = (value, fallback) => (parseLocalTime(value) === null ? fallback : String(value).trim());
  const bool = (value, fallback) => (value === undefined || value === null ? fallback : Boolean(value));
  const int = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return Object.freeze({
    enabled: bool(settings.enabled, DEFAULT_REMINDER_SETTINGS.enabled),
    dailyEnabled: bool(settings.dailyEnabled, DEFAULT_REMINDER_SETTINGS.dailyEnabled),
    dailyTime: time(settings.dailyTime, DEFAULT_REMINDER_SETTINGS.dailyTime),
    dueReviewEnabled: bool(settings.dueReviewEnabled, DEFAULT_REMINDER_SETTINGS.dueReviewEnabled),
    dueReviewTime: time(settings.dueReviewTime, DEFAULT_REMINDER_SETTINGS.dueReviewTime),
    dueReviewMinimum: int(settings.dueReviewMinimum, DEFAULT_REMINDER_SETTINGS.dueReviewMinimum, 1, 500),
    minGapHours: int(settings.minGapHours, DEFAULT_REMINDER_SETTINGS.minGapHours, 0, 48),
    skipIfStudiedToday: bool(settings.skipIfStudiedToday, DEFAULT_REMINDER_SETTINGS.skipIfStudiedToday)
  });
}

/* ------------------------------------------------------------------ planning */

function skip(kind, reason) {
  return { kind, scheduled: false, at: null, notificationId: NOTIFICATION_IDS[kind], reason };
}

/**
 * Decide what should be scheduled right now.
 *
 * @param {object} settings reminder settings (raw or normalized)
 * @param {object} state
 *   permission      what the OS last reported
 *   dueCount        cards due at or before `now`; READ ONLY, never written back
 *   lastStudiedAt   when the learner last studied, or null
 *   lastDelivered   { [kind]: timestamp } of the last delivered notification per kind
 * @param {object} options { now, offsetAt }
 * @returns {{ entries: Array, scheduled: Array, skipped: Array, permission: string }}
 */
export function planReminders(settings, state = {}, options = {}) {
  const now = options.now ?? Date.now();
  const offsetAt = options.offsetAt ?? systemOffsetAt;
  const config = normalizeReminderSettings(settings);

  const permission = state.permission ?? PERMISSION.UNKNOWN;
  const dueCount = Number.isFinite(state.dueCount) ? state.dueCount : 0;
  const lastStudiedAt = state.lastStudiedAt ?? null;
  const lastDelivered = state.lastDelivered ?? {};

  const entries = [];

  const blockAll = !config.enabled
    ? "reminders-disabled"
    : !ALLOWED_PERMISSIONS.includes(permission)
      ? `permission-${permission}`
      : null;

  for (const kind of [REMINDER_KINDS.DAILY_STUDY, REMINDER_KINDS.DUE_REVIEW]) {
    if (blockAll) { entries.push(skip(kind, blockAll)); continue; }

    const kindEnabled = kind === REMINDER_KINDS.DAILY_STUDY ? config.dailyEnabled : config.dueReviewEnabled;
    if (!kindEnabled) { entries.push(skip(kind, "kind-disabled")); continue; }

    // Quiet behaviour: never two of the same kind inside the minimum gap.
    const previous = lastDelivered[kind] ?? null;
    if (previous && config.minGapHours > 0 && now - previous < config.minGapHours * HOUR) {
      entries.push(skip(kind, "too-soon-after-last"));
      continue;
    }

    const time = kind === REMINDER_KINDS.DAILY_STUDY ? config.dailyTime : config.dueReviewTime;
    const at = nextOccurrence(time, { now, offsetAt });
    if (at === null) { entries.push(skip(kind, "invalid-time")); continue; }

    if (kind === REMINDER_KINDS.DAILY_STUDY) {
      // Nothing to nag about if they already studied in the day the reminder falls in.
      if (config.skipIfStudiedToday && lastStudiedAt && isSameLocalDay(lastStudiedAt, at, offsetAt)) {
        entries.push(skip(kind, "already-studied-today"));
        continue;
      }
    } else if (dueCount < config.dueReviewMinimum) {
      entries.push(skip(kind, "below-due-minimum"));
      continue;
    }

    entries.push({
      kind,
      scheduled: true,
      at,
      notificationId: NOTIFICATION_IDS[kind],
      reason: "scheduled",
      // Payload the adapter hands to the OS. Deliberately carries no learner detail
      // beyond a count, because a notification is visible on a lock screen.
      payload: kind === REMINDER_KINDS.DAILY_STUDY
        ? { title: "وقت الدراسة", body: "خصّص بضع دقائق للألمانية اليوم." }
        : { title: "مراجعات مستحقة", body: `لديك ${dueCount} بطاقة للمراجعة.` }
    });
  }

  return {
    entries,
    scheduled: entries.filter(entry => entry.scheduled),
    skipped: entries.filter(entry => !entry.scheduled),
    permission
  };
}

/**
 * What to actually do, given what the OS already has pending.
 *
 * Rescheduling is expressed as a diff so a settings change cancels exactly what it
 * invalidates and nothing else, and so an unchanged reminder is not cancelled and
 * re-created — which on iOS would be a visible flicker of a pending notification.
 *
 * @param {Array} pending [{ notificationId, at }] currently registered with the OS
 * @param {object} plan   result of planReminders
 */
export function diffSchedule(pending, plan) {
  const pendingById = new Map(
    (pending ?? []).map(entry => [entry.notificationId, entry])
  );
  const toSchedule = [];
  const toCancel = [];
  const unchanged = [];

  for (const entry of plan?.entries ?? []) {
    const existing = pendingById.get(entry.notificationId) ?? null;
    if (!entry.scheduled) {
      if (existing) toCancel.push({ notificationId: entry.notificationId, kind: entry.kind, reason: entry.reason });
      continue;
    }
    if (existing && existing.at === entry.at) unchanged.push(entry);
    else toSchedule.push(entry);
  }

  // Anything the OS holds that this plan does not know about is stale: a reminder kind
  // removed in a later version, or a leftover from a previous install.
  const known = new Set((plan?.entries ?? []).map(entry => entry.notificationId));
  for (const entry of pending ?? []) {
    if (!known.has(entry.notificationId)) {
      toCancel.push({ notificationId: entry.notificationId, kind: entry.kind ?? null, reason: "unknown-notification" });
    }
  }

  return { toSchedule, toCancel, unchanged };
}

/** Everything currently pending, for a full stop when the learner turns reminders off. */
export function cancelAllPlan(pending) {
  return {
    toSchedule: [],
    unchanged: [],
    toCancel: (pending ?? []).map(entry => ({
      notificationId: entry.notificationId, kind: entry.kind ?? null, reason: "reminders-disabled"
    }))
  };
}

/* ------------------------------------------------------------------ records */

/** A reminder_schedule row for something handed to the OS. Pure builder. */
export function buildScheduleRecord(entry, { profileUuid, now = Date.now() } = {}) {
  return {
    uuid: `${profileUuid}:${entry.kind}:${entry.at}`,
    profileUuid,
    kind: entry.kind,
    notificationId: entry.notificationId,
    scheduledFor: entry.at,
    scheduledAt: now,
    deliveredAt: null,
    cancelledAt: null,
    status: SCHEDULE_STATUS.SCHEDULED,
    reason: entry.reason ?? "",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  };
}

/** The last delivered timestamp per kind, from schedule history. */
export function lastDeliveredByKind(records, profileUuid) {
  const map = {};
  for (const row of (records ?? []).filter(record => !record.deleted)) {
    if (row.profileUuid !== profileUuid) continue;
    if (!row.deliveredAt) continue;
    if (!map[row.kind] || row.deliveredAt > map[row.kind]) map[row.kind] = row.deliveredAt;
  }
  return map;
}
