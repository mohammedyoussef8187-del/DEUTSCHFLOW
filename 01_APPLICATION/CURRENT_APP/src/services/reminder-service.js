/*
 * Reminder service (Feature I).
 *
 * Joins three things that are deliberately kept apart everywhere else: the learner's
 * reminder settings, a READ of how much work is waiting, and the OS.
 *
 * The boundary that matters: this service can READ due state and can WRITE nothing but
 * reminder rows. It receives due counts as numbers through a supplied reader, never a
 * card repository, so there is no object in scope that could mutate SRS state, course
 * progress or mastery even by accident. Deleting every reminder row changes nothing a
 * learner has earned.
 *
 * Nothing here needs a network or an account. Local notifications are fired by the
 * device itself, so reminders keep working with the network off — which is the only
 * design consistent with an offline-first app.
 */

import {
  PERMISSION, REMINDER_KINDS, SCHEDULE_STATUS,
  buildScheduleRecord, cancelAllPlan, diffSchedule, lastDeliveredByKind,
  normalizeReminderSettings, nextOccurrence, planReminders, systemOffsetAt
} from "../reminders/reminder-schedule.js";
import { createNoopNotificationAdapter } from "../platform/notifications/local-notification-adapter.js";

/**
 * Count of cards due at or before `now`.
 *
 * Deliberately takes plain card records and returns a number. It reads `dueAt` and
 * `suspended` and touches nothing else, so it cannot be a route to modifying a card.
 */
export function countDue(cards, now = Date.now()) {
  return (cards ?? []).filter(
    card => !card.deleted && !card.suspended && Number(card.dueAt) <= now
  ).length;
}

/**
 * @param {object} dependencies
 *   adapter        notification adapter (defaults to the no-op one)
 *   readDueCount   async ({ now }) => number
 *   readLastStudiedAt async () => number|null
 *   readSettings   async () => stored reminder settings row or null
 *   readHistory    async () => reminder_schedule rows
 *   writeSettings  async (row) => void        (optional; omitted means read-only)
 *   writeSchedule  async (rows) => void       (optional)
 *   now, offsetAt
 */
export function createReminderService(dependencies = {}) {
  const {
    adapter = createNoopNotificationAdapter("no-adapter-supplied"),
    readDueCount = async () => 0,
    readLastStudiedAt = async () => null,
    readSettings = async () => null,
    readHistory = async () => [],
    writeSettings = null,
    writeSchedule = null,
    offsetAt = systemOffsetAt,
    now: nowFn = () => Date.now()
  } = dependencies;

  const currentTime = () => (typeof nowFn === "function" ? nowFn() : nowFn);

  async function settingsFor(profileUuid) {
    const stored = await readSettings(profileUuid);
    return normalizeReminderSettings(stored ?? {});
  }

  /** State read fresh every time: a cached permission or due count goes stale silently. */
  async function stateFor(profileUuid, now) {
    const [permission, dueCount, lastStudiedAt, history] = await Promise.all([
      adapter.permission(),
      readDueCount({ now, profileUuid }),
      readLastStudiedAt(profileUuid),
      readHistory(profileUuid)
    ]);
    return {
      permission: permission ?? PERMISSION.UNKNOWN,
      dueCount: Number(dueCount) || 0,
      lastStudiedAt,
      lastDelivered: lastDeliveredByKind(history, profileUuid)
    };
  }

  return Object.freeze({
    adapter,

    async settings(profileUuid) {
      return settingsFor(profileUuid);
    },

    /** What the OS currently says, without asking the learner anything. */
    async permission() {
      return adapter.permission();
    },

    /** Ask the OS. Only ever called from an explicit learner action. */
    async requestPermission() {
      return adapter.requestPermission();
    },

    /** What WOULD be scheduled, with reasons. Pure preview: nothing is sent to the OS. */
    async preview(profileUuid) {
      const now = currentTime();
      const settings = await settingsFor(profileUuid);
      return planReminders(settings, await stateFor(profileUuid, now), { now, offsetAt });
    },

    /**
     * Bring the OS in line with the current settings.
     *
     * Expressed as a diff so an unchanged reminder is left alone rather than cancelled
     * and re-created, and so turning reminders off cancels everything pending.
     */
    async sync(profileUuid) {
      const now = currentTime();
      const settings = await settingsFor(profileUuid);
      const pending = await adapter.pending();

      const plan = planReminders(settings, await stateFor(profileUuid, now), { now, offsetAt });
      const diff = settings.enabled ? diffSchedule(pending, plan) : cancelAllPlan(pending);

      if (diff.toCancel.length) await adapter.cancel(diff.toCancel);
      if (diff.toSchedule.length) await adapter.schedule(diff.toSchedule);

      if (writeSchedule && (diff.toSchedule.length || diff.toCancel.length)) {
        await writeSchedule([
          ...diff.toSchedule.map(entry => buildScheduleRecord(entry, { profileUuid, now })),
          ...diff.toCancel.map(entry => ({
            uuid: `${profileUuid}:${entry.kind ?? "unknown"}:cancelled:${now}:${entry.notificationId}`,
            profileUuid,
            kind: entry.kind ?? "unknown",
            notificationId: entry.notificationId,
            scheduledFor: 0,
            scheduledAt: now,
            deliveredAt: null,
            cancelledAt: now,
            status: SCHEDULE_STATUS.CANCELLED,
            reason: entry.reason ?? "",
            createdAt: now,
            updatedAt: now,
            revision: 1,
            deleted: 0
          }))
        ]);
      }

      return { plan, diff, settings, pendingBefore: pending };
    },

    /**
     * Change settings and immediately reconcile the OS, so a saved setting and what the
     * device will actually do can never drift apart.
     */
    async update(profileUuid, changes) {
      if (!writeSettings) throw new TypeError("This reminder service is read-only");
      const now = currentTime();
      const current = await settingsFor(profileUuid);
      const next = normalizeReminderSettings({ ...current, ...changes });

      await writeSettings({
        ...next,
        uuid: `reminder-settings:${profileUuid}`,
        profileUuid,
        permissionState: await adapter.permission(),
        permissionCheckedAt: now,
        updatedAt: now
      });

      return this.sync(profileUuid);
    },

    /** Turn everything off and cancel what the OS holds. One call, no partial state. */
    async disable(profileUuid) {
      return this.update(profileUuid, { enabled: false });
    },

    /** When the next reminder of a kind would land, for display in settings. */
    async nextAt(profileUuid, kind = REMINDER_KINDS.DAILY_STUDY) {
      const now = currentTime();
      const settings = await settingsFor(profileUuid);
      const time = kind === REMINDER_KINDS.DAILY_STUDY ? settings.dailyTime : settings.dueReviewTime;
      return nextOccurrence(time, { now, offsetAt });
    }
  });
}
