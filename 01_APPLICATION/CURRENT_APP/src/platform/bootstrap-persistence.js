/*
 * Persistence bootstrap: the composition point between platform detection, backend
 * selection, and the first-launch migration.
 *
 * Guarantees:
 *   - With `nativeStorageEnabled` false (the default during development), this always
 *     resolves to IndexedDB and NEVER attempts a migration. Today's runtime behavior is
 *     therefore unchanged on every platform.
 *   - If native SQLite is selected and the migration or its verification fails for any
 *     reason, the app falls back to IndexedDB automatically, with the reason reported.
 *     There is no path where a failed migration leaves the app without storage.
 *   - An already-migrated device skips straight to SQLite without re-running migration.
 *
 * All collaborators are injected, so this module performs no I/O and no native imports.
 */

import { runFirstLaunchMigration } from "../migration/first-launch-controller.js";
import {
  STORAGE_INDEXEDDB, STORAGE_SQLITE, detectNativePlatform, selectPersistenceBackend
} from "./storage-selection.js";

/**
 * @param {object} options
 *   environment            global object used for platform detection
 *   nativeStorageEnabled   master switch; OFF until on-device verification passes
 *   openIndexedDb          async () => repositories (always required; the fallback)
 *   openSqliteTarget       async () => canonical SQLite adapter
 *   isAlreadyMigrated      async () => boolean
 *   backupSink, commitSwitch, resetTarget, now  passed through to the controller
 */
export async function bootstrapPersistence(options = {}) {
  const {
    environment = globalThis,
    nativeStorageEnabled = false,
    openIndexedDb,
    openSqliteTarget = null,
    isAlreadyMigrated = async () => false,
    backupSink = null,
    commitSwitch = null,
    resetTarget = null,
    now = Date.now()
  } = options;

  if (typeof openIndexedDb !== "function") throw new TypeError("openIndexedDb is required");

  const selection = selectPersistenceBackend({
    isNativePlatform: detectNativePlatform(environment),
    nativeStorageEnabled
  });

  if (selection.backend !== STORAGE_SQLITE) {
    return {
      backend: STORAGE_INDEXEDDB,
      reason: selection.reason,
      repositories: await openIndexedDb(),
      migration: null
    };
  }

  // Native SQLite selected. Any failure below falls back to IndexedDB rather than
  // leaving the learner without a working store.
  const fallback = async (reason, detail = null) => ({
    backend: STORAGE_INDEXEDDB,
    reason,
    detail,
    repositories: await openIndexedDb(),
    migration: detail?.migration ?? null,
    fellBack: true
  });

  if (typeof openSqliteTarget !== "function") {
    return fallback("sqlite-target-unavailable");
  }

  let target;
  try {
    target = await openSqliteTarget();
  } catch (error) {
    return fallback("sqlite-open-failed", { message: error?.message ?? String(error) });
  }

  try {
    if (await isAlreadyMigrated()) {
      return { backend: STORAGE_SQLITE, reason: "already-migrated", adapter: target, migration: null };
    }
  } catch (error) {
    return fallback("migration-state-unreadable", { message: error?.message ?? String(error) });
  }

  let migration;
  try {
    migration = await runFirstLaunchMigration({
      sourceRepositories: await openIndexedDb(),
      targetAdapter: target,
      backupSink,
      commitSwitch,
      resetTarget,
      now
    });
  } catch (error) {
    // Includes the refusal to run without a durable backup sink.
    return fallback("migration-aborted", { message: error?.message ?? String(error) });
  }

  if (!migration.switched) {
    return fallback("migration-not-switched", { migration });
  }

  return { backend: STORAGE_SQLITE, reason: "migrated", adapter: target, migration };
}
