/*
 * Local notification adapter.
 *
 * Platform-neutral, driven by an INJECTED bridge, exactly as the SQLite executor is.
 * This module imports nothing native and never touches a Capacitor package, so the
 * plain web/PWA build stays dependency-free and the test suite needs no device.
 *
 * Gated like native storage was: `nativeNotificationsEnabled` defaults to FALSE, so the
 * app resolves to a no-op adapter that reports `unsupported` and schedules nothing.
 * Physical-device notification validation is a deferred RELEASE gate; a simulator can
 * show a banner but cannot stand in for real Focus modes, Scheduled Summary, or the
 * system's own rate limiting.
 *
 * There is no cloud push anywhere here and no account: everything is a local
 * notification the device fires by itself, so reminders work with the network off and
 * without a login.
 */

export const NOTIFICATION_BACKEND = Object.freeze({
  NONE: "none",
  LOCAL_NATIVE: "local-native"
});

export const NATIVE_NOTIFICATION_STATUS = Object.freeze({
  developmentActive: true,
  learnerSwitchEnabled: false,
  physicalDeviceGate: "deferred-release-gate"
});

/**
 * Choose a backend. Mirrors selectPersistenceBackend so both gates read the same way.
 *
 * @param {object} context { isNativePlatform, nativeNotificationsEnabled, hasBridge }
 */
export function selectNotificationBackend(context = {}) {
  const { isNativePlatform = false, nativeNotificationsEnabled = false, hasBridge = false } = context;

  if (!isNativePlatform) {
    return { backend: NOTIFICATION_BACKEND.NONE, reason: "web-target-has-no-local-notifications" };
  }
  if (!nativeNotificationsEnabled) {
    return { backend: NOTIFICATION_BACKEND.NONE, reason: "native-notifications-gated-until-verified" };
  }
  if (!hasBridge) {
    return { backend: NOTIFICATION_BACKEND.NONE, reason: "notification-bridge-unavailable" };
  }
  return { backend: NOTIFICATION_BACKEND.LOCAL_NATIVE, reason: "native-platform-uses-local-notifications" };
}

/**
 * Read the Capacitor LocalNotifications plugin off the global bridge, without importing
 * it, so nothing is bundled or loaded on a web target.
 */
export function detectNotificationBridge(environment = globalThis) {
  return environment?.Capacitor?.Plugins?.LocalNotifications ?? null;
}

/** The adapter used whenever native notifications are gated off or unavailable. */
export function createNoopNotificationAdapter(reason = "unsupported") {
  return Object.freeze({
    backend: NOTIFICATION_BACKEND.NONE,
    reason,
    async permission() { return "unsupported"; },
    async requestPermission() { return "unsupported"; },
    async pending() { return []; },
    async schedule() { return { scheduled: 0, skipped: "unsupported" }; },
    async cancel() { return { cancelled: 0, skipped: "unsupported" }; }
  });
}

function mapPermission(result) {
  const value = String(result?.display ?? result ?? "").toLowerCase();
  if (value === "granted") return "granted";
  if (value === "denied") return "denied";
  if (value === "prompt" || value === "prompt-with-rationale") return "unknown";
  if (value === "provisional") return "provisional";
  return "unknown";
}

/**
 * Wrap an injected bridge in the small surface this app actually uses.
 *
 * The bridge is any object exposing checkPermissions / requestPermissions /
 * getPending / schedule / cancel — which is the shape of @capacitor/local-notifications,
 * and equally the shape of a fake in a test.
 */
export function createLocalNotificationAdapter(bridge, options = {}) {
  if (!bridge) return createNoopNotificationAdapter("notification-bridge-unavailable");
  const onError = options.onError ?? (() => {});

  // A failing notification call must never break study. Every call degrades to a
  // reported non-result instead of throwing into the caller.
  const guard = async (label, run, fallback) => {
    try {
      return await run();
    } catch (error) {
      onError({ label, error });
      return fallback;
    }
  };

  return Object.freeze({
    backend: NOTIFICATION_BACKEND.LOCAL_NATIVE,
    reason: "native-platform-uses-local-notifications",

    async permission() {
      return guard("checkPermissions", async () => mapPermission(await bridge.checkPermissions()), "unknown");
    },

    async requestPermission() {
      return guard("requestPermissions", async () => mapPermission(await bridge.requestPermissions()), "unknown");
    },

    async pending() {
      return guard("getPending", async () => {
        const result = await bridge.getPending();
        return (result?.notifications ?? []).map(notification => ({
          notificationId: notification.id,
          at: notification.schedule?.at instanceof Date
            ? notification.schedule.at.getTime()
            : Number(notification.schedule?.at) || null
        }));
      }, []);
    },

    async schedule(entries) {
      const list = entries ?? [];
      if (!list.length) return { scheduled: 0 };
      return guard("schedule", async () => {
        await bridge.schedule({
          notifications: list.map(entry => ({
            id: entry.notificationId,
            title: entry.payload?.title ?? "",
            body: entry.payload?.body ?? "",
            // A Date, because the OS schedules against the device's own local clock.
            schedule: { at: new Date(entry.at), allowWhileIdle: false },
            extra: { kind: entry.kind }
          }))
        });
        return { scheduled: list.length };
      }, { scheduled: 0, failed: list.length });
    },

    async cancel(entries) {
      const list = entries ?? [];
      if (!list.length) return { cancelled: 0 };
      return guard("cancel", async () => {
        await bridge.cancel({ notifications: list.map(entry => ({ id: entry.notificationId })) });
        return { cancelled: list.length };
      }, { cancelled: 0, failed: list.length });
    }
  });
}

/**
 * The composition point: detect the platform, apply the gate, wrap the bridge.
 *
 * With the gate off — which is the default and the current state — this returns the
 * no-op adapter on every platform, so today's runtime behaviour is unchanged.
 */
export function resolveNotificationAdapter(options = {}) {
  const {
    environment = globalThis,
    isNativePlatform = false,
    nativeNotificationsEnabled = false,
    bridge = detectNotificationBridge(environment),
    onError
  } = options;

  const selection = selectNotificationBackend({
    isNativePlatform, nativeNotificationsEnabled, hasBridge: Boolean(bridge)
  });

  return selection.backend === NOTIFICATION_BACKEND.LOCAL_NATIVE
    ? createLocalNotificationAdapter(bridge, { onError })
    : createNoopNotificationAdapter(selection.reason);
}
