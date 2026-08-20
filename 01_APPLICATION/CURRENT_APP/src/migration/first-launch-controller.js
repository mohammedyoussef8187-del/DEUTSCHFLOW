/*
 * First-launch migration controller.
 *
 * Executes the approved safe sequence, and only that sequence:
 *
 *   BACKUP -> READ OLD -> VALIDATE -> TRANSFORM -> WRITE SQLITE -> VERIFY -> SWITCH
 *
 * Safety rules enforced here:
 *   - The IndexedDB source is READ-ONLY for the whole run. It is never cleared, rewritten,
 *     or "repaired", and it stays the recovery source after a successful switch until
 *     parity has been proven in production.
 *   - A durable backup must succeed BEFORE anything is read for migration. Without a
 *     backup sink the controller refuses to run.
 *   - Learner/SRS state is copied, never recalculated or reinterpreted.
 *   - ANY failure at ANY stage aborts without switching, so the app stays on IndexedDB.
 *     The switch flag is written only after verification passes.
 *   - The target must be empty before writing, so a re-run can never double-import.
 *
 * The controller performs no I/O of its own: source, target, backup sink, and the switch
 * flag are all injected, which keeps it platform-neutral and fully testable.
 */

import { createBackup, readLearnerState, validateBackup } from "../data/backup.js";
import { migrateToCanonical } from "./canonical-migration.js";
import { compareSrsState } from "./dry-run.js";

export const STAGES = Object.freeze([
  "backup", "read", "validate", "transform", "write", "verify", "switch"
]);

/**
 * @param {object} options
 *   sourceRepositories  IndexedDB repositories (read-only for this run)
 *   targetAdapter       canonical SQLite adapter (already constructed, not yet migrated)
 *   backupSink          async (payload) => location; must durably persist the backup
 *   commitSwitch        async (info) => void; persists "native storage is now active"
 *   resetTarget         optional async () => void; clears the target after a failed verify
 *   now                 fixed timestamp for deterministic runs
 *   schemaVersion       backup schema version to stamp (default 6)
 */
export async function runFirstLaunchMigration(options = {}) {
  const {
    sourceRepositories,
    targetAdapter,
    backupSink,
    commitSwitch,
    resetTarget = null,
    now = Date.now(),
    schemaVersion = 6
  } = options;

  if (!sourceRepositories) throw new TypeError("sourceRepositories are required");
  if (!targetAdapter) throw new TypeError("targetAdapter is required");
  // A migration that cannot be undone from a backup is not allowed to start.
  if (typeof backupSink !== "function") throw new TypeError("A durable backupSink is required");

  const stages = [];
  const record = (stage, ok, detail = null) => { stages.push({ stage, ok, detail }); };
  const fail = (stage, reason, detail = null) => {
    record(stage, false, detail);
    return {
      switched: false,
      stage,
      reason,
      stages,
      backup: backupLocation,
      // Explicit: the app remains on the untouched IndexedDB source.
      remainedOnIndexedDb: true
    };
  };

  let backupLocation = null;

  // --- 1. BACKUP -----------------------------------------------------------
  let backup;
  try {
    backup = await createBackup(sourceRepositories, { now, schemaVersion });
    backupLocation = await backupSink(backup);
    record("backup", true, { location: backupLocation ?? null, counts: countsOf(backup) });
  } catch (error) {
    return fail("backup", "backup-failed", { message: error?.message ?? String(error) });
  }

  // --- 2. READ OLD ---------------------------------------------------------
  let snapshot;
  try {
    snapshot = await readLearnerState(sourceRepositories);
    record("read", true, {
      words: snapshot.words.length,
      cards: snapshot.cards.length,
      attempts: snapshot.attempts.length
    });
  } catch (error) {
    return fail("read", "source-read-failed", { message: error?.message ?? String(error) });
  }

  // --- 3. VALIDATE ---------------------------------------------------------
  const validation = validateBackup({
    app: "DeutschFlow",
    schemaVersion,
    exportedAt: now,
    ...snapshot
  });
  if (!validation.ok) {
    return fail("validate", "source-validation-failed", { errors: validation.errors });
  }
  record("validate", true, { warnings: validation.warnings.length });

  // --- 4. TRANSFORM --------------------------------------------------------
  let dataset;
  let migrationReport;
  try {
    ({ dataset, report: migrationReport } = migrateToCanonical(snapshot, { now }));
  } catch (error) {
    return fail("transform", "transform-failed", { message: error?.message ?? String(error) });
  }

  // Nothing may be silently discarded: every quarantined record must be preserved.
  const unpreserved = migrationReport.quarantine.filter(
    q => q.preserved === false && q.entity !== "vocabulary_meaning"
  );
  if (unpreserved.length) {
    return fail("transform", "records-would-be-lost", { count: unpreserved.length });
  }
  record("transform", true, {
    counts: migrationReport.counts,
    quarantined: migrationReport.quarantine.length
  });

  // --- 5. WRITE SQLITE -----------------------------------------------------
  try {
    await targetAdapter.initializeSchema();

    // The target must be empty, so an interrupted or repeated run cannot double-import.
    const existing = await targetAdapter.verifyIntegrity();
    const occupied = Object.entries(existing.rowCounts).filter(([, count]) => count > 0);
    if (occupied.length) {
      return fail("write", "target-not-empty", { occupied: Object.fromEntries(occupied) });
    }

    // Transactional: a failure here leaves the target empty rather than half-written.
    await targetAdapter.importCanonical(dataset);
    record("write", true, null);
  } catch (error) {
    return fail("write", "write-failed", { message: error?.message ?? String(error) });
  }

  // --- 6. VERIFY -----------------------------------------------------------
  let verification;
  try {
    verification = await verifyMigration(snapshot, dataset, targetAdapter);
  } catch (error) {
    await tryResetTarget(resetTarget);
    return fail("verify", "verification-error", { message: error?.message ?? String(error) });
  }
  if (!verification.ok) {
    // Clear the target so a later retry starts clean. Only the NEW database is touched.
    await tryResetTarget(resetTarget);
    return fail("verify", "verification-failed", verification);
  }
  record("verify", true, verification);

  // --- 7. SWITCH -----------------------------------------------------------
  try {
    if (typeof commitSwitch === "function") {
      await commitSwitch({
        migratedAt: now,
        backup: backupLocation ?? null,
        counts: migrationReport.counts
      });
    }
    record("switch", true, null);
  } catch (error) {
    // The switch flag did not persist, so the app must stay on IndexedDB.
    await tryResetTarget(resetTarget);
    return fail("switch", "switch-commit-failed", { message: error?.message ?? String(error) });
  }

  return {
    switched: true,
    stage: "switch",
    reason: null,
    stages,
    backup: backupLocation,
    // IndexedDB is retained as the recovery source; it was never modified or deleted.
    remainedOnIndexedDb: false,
    sourcePreserved: true,
    verification,
    counts: migrationReport.counts,
    quarantined: migrationReport.quarantine.length
  };
}

/**
 * Post-write verification: the target must hold exactly what was transformed, with
 * referential integrity intact and SRS state identical to the source.
 */
export async function verifyMigration(snapshot, dataset, targetAdapter) {
  const readBack = await targetAdapter.readCanonical();

  const entityMismatches = [];
  for (const entity of Object.keys(dataset)) {
    const expected = sortByUuid(dataset[entity]);
    const actual = sortByUuid(readBack[entity] ?? []);
    if (expected.length !== actual.length) {
      entityMismatches.push({ entity, reason: "count", expected: expected.length, actual: actual.length });
      continue;
    }
    for (let i = 0; i < expected.length; i++) {
      if (!rowsEqual(expected[i], actual[i])) {
        entityMismatches.push({ entity, reason: "field-mismatch", uuid: expected[i].uuid });
        break;
      }
    }
  }

  const integrity = await targetAdapter.verifyIntegrity();
  const srs = compareSrsState(snapshot.cards ?? [], readBack.reviewCards ?? [], readBack.quarantine ?? []);

  // Every source word must be represented, either as an item or preserved in quarantine.
  const quarantinedItems = (readBack.quarantine ?? []).filter(row => row.entity === "vocabulary_item").length;
  const vocabAccountedFor =
    (readBack.vocabularyItems?.length ?? 0) + quarantinedItems >= (snapshot.words?.length ?? 0);

  return {
    ok: entityMismatches.length === 0 && integrity.ok && srs.identical && vocabAccountedFor,
    entityMismatches,
    integrity,
    srs,
    vocabAccountedFor
  };
}

async function tryResetTarget(resetTarget) {
  if (typeof resetTarget !== "function") return;
  try { await resetTarget(); } catch { /* target cleanup is best-effort */ }
}

function countsOf(backup) {
  return {
    words: backup.words?.length ?? 0,
    cards: backup.cards?.length ?? 0,
    attempts: backup.attempts?.length ?? 0
  };
}

function sortByUuid(rows) {
  return [...(rows ?? [])].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}

function rowsEqual(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? null) !== (b[key] ?? null)) return false;
  }
  return true;
}
