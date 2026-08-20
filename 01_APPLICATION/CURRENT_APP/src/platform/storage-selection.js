/*
 * Runtime persistence selection.
 *
 * Establishes the single decision point where the app chooses its persistence backend,
 * so the eventual switch to native SQLite is a reviewed flag change at one place rather
 * than edits scattered through the runtime.
 *
 * Current behavior is deliberately UNCHANGED: `nativeStorageEnabled` defaults to false,
 * so every platform still resolves to the existing IndexedDB backend. Native SQLite is
 * selectable but stays off until Stop Gate 5 (on-device verification) passes and the
 * first-launch migration controller is approved. IndexedDB is never removed — it remains
 * the recoverable source (DATA_MIGRATION_STRATEGY: the old source must survive until
 * parity is verified).
 *
 * The web target keeps IndexedDB regardless: the plugin's browser mode (jeep-sqlite) is
 * out of scope for the mobile-first delivery.
 */

export const STORAGE_INDEXEDDB = "indexeddb";
export const STORAGE_SQLITE = "sqlite";

/**
 * @param {object} [context]
 *   isNativePlatform      true on a packaged Capacitor iOS/Android build
 *   nativeStorageEnabled  master switch for native SQLite; OFF until Gate 5 passes
 * @returns {{ backend: string, reason: string, fallback: string }}
 */
export function selectPersistenceBackend(context = {}) {
  const { isNativePlatform = false, nativeStorageEnabled = false } = context;

  if (!isNativePlatform) {
    return {
      backend: STORAGE_INDEXEDDB,
      reason: "web-target-uses-indexeddb",
      fallback: STORAGE_INDEXEDDB
    };
  }
  if (!nativeStorageEnabled) {
    return {
      backend: STORAGE_INDEXEDDB,
      reason: "native-storage-gated-until-verified",
      fallback: STORAGE_INDEXEDDB
    };
  }
  return {
    backend: STORAGE_SQLITE,
    reason: "native-platform-uses-sqlite",
    // IndexedDB stays available for rollback until the migration is verified on device.
    fallback: STORAGE_INDEXEDDB
  };
}

/**
 * Detect whether the app is running inside a packaged Capacitor build.
 * Reads the global Capacitor bridge rather than importing @capacitor/core, so the plain
 * web/PWA build stays dependency-free and loads no native code.
 */
export function detectNativePlatform(environment = globalThis) {
  const capacitor = environment?.Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return Boolean(capacitor.isNativePlatform());
  // Older bridges expose only a platform string.
  return capacitor.platform === "ios" || capacitor.platform === "android";
}
