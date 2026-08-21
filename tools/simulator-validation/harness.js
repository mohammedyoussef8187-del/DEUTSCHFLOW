/*
 * Gate 5 simulator validation harness.
 *
 * Runs INSIDE the app on an iOS Simulator and exercises the real native SQLite executor
 * and the real first-launch migration controller. It is CI-only: it is copied into the
 * installed app bundle by the Codemagic workflow and is never part of a production build.
 *
 * Isolation rules:
 *   - every database it opens is named with the VALIDATION_PREFIX, never "deutschflow"
 *   - the migration source is an in-memory fixture, never the learner's IndexedDB
 *   - it never enables native storage for the real app
 *
 * Results are written into the validation database itself, so CI reads them with the
 * system `sqlite3` binary rather than scraping logs. The harness is self-sequencing:
 * the first launch runs phase 1, and a relaunch detects existing phase-1 rows and runs
 * phase 2, which is what proves the data survived process termination.
 */

import { openCapacitorSqlite } from "./src/platform/sqlite/capacitor-executor.js";
import { createSqliteAdapter } from "./src/platform/sqlite/adapter.js";
import { runFirstLaunchMigration } from "./src/migration/first-launch-controller.js";
import { compareLearnerState, readLearnerState } from "./src/data/backup.js";

const VALIDATION_PREFIX = "deutschflow_validation";
const RESULTS_DB = VALIDATION_PREFIX;          // deutschflow_validationSQLite.db
const MIGRATION_DB = `${VALIDATION_PREFIX}_migration`;
const NOW = 1775000000000;

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed: passed ? 1 : 0, detail: String(detail).slice(0, 500) });
  log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
function log(message) {
  console.log(`[DF-VALIDATION] ${message}`);
  const el = document.getElementById("out");
  if (el) el.textContent += `${message}\n`;
}

/* ---------------------------------------------------------------- fixtures */

/** A learner snapshot with SRS state worth protecting, plus an orphan card. */
function fixtureSnapshot() {
  return {
    words: [
      { id: 1, german: "das Haus", arabic: "بيت", pronunciation: "هاوس", normalizedGerman: "das haus",
        normalizedArabic: "بيت", itemType: "noun", article: "das", plural: "Häuser", level: "A1",
        tags: ["wohnen"], acceptedAnswers: ["das Haus", "Haus"], acceptedArabicAnswers: ["بيت"],
        sourceRow: 44, favorite: true, ignored: false, userFlagged: false, qualityStatus: "ok",
        createdAt: 1700000000000, updatedAt: 1700000100000 },
      { id: 2, german: "fahren", arabic: "يقود", pronunciation: "فاهرن", normalizedGerman: "fahren",
        normalizedArabic: "يقود", itemType: "word", article: null, plural: "", level: "A2",
        tags: [], acceptedAnswers: ["fahren"], acceptedArabicAnswers: [], sourceRow: 45,
        favorite: false, ignored: false, userFlagged: false, qualityStatus: "ok",
        createdAt: 1700000000000, updatedAt: 1700000000000 }
    ],
    cards: [
      { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1771497600000,
        intervalDays: 3.5, ease: 2.5, reps: 2, lapses: 0, streak: 2, mastery: 50, correct: 3,
        wrong: 1, stability: 4.2, difficulty: 5, lastResult: 3, suspended: false,
        lastReviewedAt: 1771200000000, createdAt: 1700000000000, updatedAt: 1771200000000 },
      // Orphan: its word was deleted. Must be quarantined, never dropped.
      { key: "9999:recall", wordId: 9999, skill: "recall", state: "learning", dueAt: 1771497600000,
        intervalDays: 0, ease: 1.9, reps: 0, lapses: 3, streak: 0, mastery: 0, correct: 0, wrong: 3,
        stability: 0, difficulty: 5, lastResult: 1, suspended: false,
        lastReviewedAt: 1771400000000, createdAt: 1700000000000, updatedAt: 1771400000000 }
    ],
    attempts: [
      { id: 1, cardKey: "1:recall", wordId: 1, sessionId: "s-1", skill: "recall", correct: true,
        answerType: "perfect", userAnswer: "das Haus", correctAnswer: "das Haus", elapsedMs: 4200,
        rating: 4, initial: true, retryCount: 0, itemType: "noun", usedHint: false, revealed: false,
        createdAt: 1771100000000 }
    ],
    settings: { theme: "dark", sessionSize: 15, dailyGoal: 30, showPronunciation: true,
      acceptAeOeUe: true, acceptSs: false, requireArticle: true, ignoreSentencePunctuation: true },
    profile: { streak: 8, lastStudyDate: "2026-08-20", totalXP: 1240, createdAt: 1700000000000 }
  };
}

/** In-memory repositories: the migration source, so no real IndexedDB is involved. */
function memoryRepositories(snapshot) {
  const state = JSON.parse(JSON.stringify(snapshot));
  const meta = new Map([["settings", state.settings], ["profile", state.profile]]);
  return {
    vocabulary: { all: async () => state.words },
    cards: { all: async () => state.cards },
    attempts: { all: async () => state.attempts },
    metadata: {
      get: async (key, fallback = null) => (meta.has(key) ? meta.get(key) : fallback),
      set: async (key, value) => { meta.set(key, value); }
    },
    lifecycle: {
      replaceAll: async () => { throw new Error("migration must not write to the source"); }
    }
  };
}

/* ------------------------------------------------------------ results store */

async function openResultsDb() {
  const handle = await openCapacitorSqlite({ database: RESULTS_DB, version: 1 });
  await handle.executor.exec(`CREATE TABLE IF NOT EXISTS df_validation_results (
    phase INTEGER NOT NULL, name TEXT NOT NULL, passed INTEGER NOT NULL,
    detail TEXT, recorded_at INTEGER NOT NULL)`);
  await handle.executor.exec(`CREATE TABLE IF NOT EXISTS df_probe (
    id INTEGER PRIMARY KEY, label TEXT NOT NULL, ease REAL NOT NULL, due_at INTEGER NOT NULL)`);
  return handle;
}

async function currentPhase(executor) {
  const rows = await executor.all("SELECT COUNT(*) AS n FROM df_validation_results WHERE phase = 1", []);
  return Number(rows[0]?.n ?? 0) > 0 ? 2 : 1;
}

async function persistResults(executor, phase) {
  for (const r of results) {
    await executor.run(
      "INSERT INTO df_validation_results (phase, name, passed, detail, recorded_at) VALUES (?,?,?,?,?)",
      [phase, r.name, r.passed, r.detail, Date.now()]
    );
  }
}

/* ------------------------------------------------------------------ phase 1 */

async function phaseOne(handle) {
  const { executor } = handle;

  // --- native SQLite basics on a real device-backed database ---
  await executor.run("DELETE FROM df_probe", []);
  await executor.run("INSERT INTO df_probe (id,label,ease,due_at) VALUES (?,?,?,?)",
    [1, "probe-one", 2.5, 1771497600000]);
  await executor.run("INSERT INTO df_probe (id,label,ease,due_at) VALUES (?,?,?,?)",
    [2, "probe-two", 1.9, 1774000000000]);

  const readBack = await executor.all("SELECT * FROM df_probe ORDER BY id", []);
  check("sqlite.write_then_read", readBack.length === 2 && readBack[0].label === "probe-one",
    `rows=${readBack.length}`);
  check("sqlite.preserves_real_values",
    readBack[0].ease === 2.5 && readBack[1].due_at === 1774000000000,
    `ease=${readBack[0].ease} due=${readBack[1].due_at}`);

  const version = await executor.pragma("user_version");
  check("sqlite.pragma_roundtrip", Number.isFinite(Number(version)), `user_version=${version}`);

  // --- transaction rollback must leave no partial rows ---
  try {
    await executor.transaction(async () => {
      await executor.run("INSERT INTO df_probe (id,label,ease,due_at) VALUES (?,?,?,?)",
        [99, "rolled-back", 2.5, 0]);
      throw new Error("deliberate");
    });
  } catch { /* expected */ }
  const afterRollback = await executor.all("SELECT COUNT(*) AS n FROM df_probe WHERE id = 99", []);
  check("sqlite.transaction_rollback", Number(afterRollback[0]?.n ?? -1) === 0);

  // --- real first-launch migration, isolated source and target ---
  const snapshot = fixtureSnapshot();
  const source = memoryRepositories(snapshot);
  const before = await readLearnerState(source);

  const target = await openMigrationTarget();
  let backupTaken = null;
  const report = await runFirstLaunchMigration({
    sourceRepositories: source,
    targetAdapter: target.adapter,
    backupSink: async payload => { backupTaken = payload; return "memory://validation-backup"; },
    commitSwitch: async () => { /* validation only: never switches the real app */ },
    now: NOW
  });

  check("migration.completed", report.switched === true, `stage=${report.stage} reason=${report.reason}`);
  check("migration.sequence_order",
    JSON.stringify(report.stages.map(s => s.stage)) ===
    JSON.stringify(["backup", "read", "validate", "transform", "write", "verify", "switch"]),
    report.stages.map(s => s.stage).join(">"));
  check("migration.backup_before_read", backupTaken !== null && backupTaken.words.length === 2);

  // Source must be untouched.
  const after = await readLearnerState(source);
  check("migration.source_intact", compareLearnerState(before, after).identical === true);

  // SRS must be preserved exactly.
  const cards = await target.adapter.selectAll("reviewCards");
  const migrated = cards.find(c => c.legacyKey === "1:recall");
  const origin = snapshot.cards.find(c => c.key === "1:recall");
  const srsFields = ["dueAt", "intervalDays", "ease", "reps", "lapses", "streak", "mastery", "state"];
  const srsOk = migrated && srsFields.every(f => migrated[f] === origin[f]);
  check("migration.srs_preserved_exactly", srsOk,
    migrated ? srsFields.map(f => `${f}=${migrated[f]}`).join(" ") : "card missing");
  check("migration.verification_reports_srs_identical",
    report.verification?.srs?.identical === true && report.verification.srs.lostCards === 0);

  // Quarantine must preserve the orphan card verbatim.
  const quarantined = await target.adapter.selectAll("quarantine");
  const orphan = quarantined.find(q => q.sourceId === "9999:recall");
  let orphanOk = false;
  if (orphan) {
    const payload = JSON.parse(orphan.payload);
    orphanOk = payload.lapses === 3 && payload.ease === 1.9;
  }
  check("migration.quarantine_preserves_orphan", orphanOk,
    orphan ? "payload retained" : "orphan card missing from quarantine");

  // --- failed verification must NOT switch ---
  const failing = await openMigrationTarget(`${MIGRATION_DB}_fail`);
  const sabotaged = {
    ...failing.adapter,
    readCanonical: async () => {
      const real = await failing.adapter.readCanonical();
      return { ...real, vocabularyItems: [] };   // corrupt the read-back
    }
  };
  let switchedAnyway = null;
  const failReport = await runFirstLaunchMigration({
    sourceRepositories: memoryRepositories(snapshot),
    targetAdapter: sabotaged,
    backupSink: async () => "memory://fail-backup",
    commitSwitch: async () => { switchedAnyway = true; },
    now: NOW
  });
  check("migration.failed_verify_does_not_switch",
    failReport.switched === false && failReport.stage === "verify" && switchedAnyway === null,
    `stage=${failReport.stage} reason=${failReport.reason}`);
  check("migration.failed_run_stays_on_indexeddb", failReport.remainedOnIndexedDb === true);
  await failing.close();

  // Record what the relaunch must find again.
  await executor.run("INSERT INTO df_probe (id,label,ease,due_at) VALUES (?,?,?,?)",
    [3, "migrated-card-count", cards.length, NOW]);
  await target.close();
}

async function openMigrationTarget(name = MIGRATION_DB) {
  const handle = await openCapacitorSqlite({ database: name, version: 1 });
  return { adapter: createSqliteAdapter(handle.executor), close: handle.close };
}

/* ------------------------------------------------------------------ phase 2 */

async function phaseTwo(handle) {
  const { executor } = handle;

  // The app process was terminated between phase 1 and now.
  const probes = await executor.all("SELECT * FROM df_probe ORDER BY id", []);
  const one = probes.find(p => p.id === 1);
  const two = probes.find(p => p.id === 2);
  check("persistence.probe_rows_survived_relaunch", probes.length >= 3, `rows=${probes.length}`);
  check("persistence.values_unchanged_after_relaunch",
    one?.label === "probe-one" && one?.ease === 2.5 && two?.due_at === 1774000000000,
    one ? `ease=${one.ease}` : "probe missing");
  check("persistence.rolled_back_row_absent", !probes.some(p => p.id === 99));

  const phase1 = await executor.all(
    "SELECT COUNT(*) AS n, SUM(passed) AS ok FROM df_validation_results WHERE phase = 1", []);
  check("persistence.phase1_results_survived",
    Number(phase1[0]?.n ?? 0) > 0, `phase1 rows=${phase1[0]?.n} passed=${phase1[0]?.ok}`);

  // The migrated canonical data must also still be on disk.
  const target = await openMigrationTarget();
  const cards = await target.adapter.selectAll("reviewCards");
  const items = await target.adapter.selectAll("vocabularyItems");
  const card = cards.find(c => c.legacyKey === "1:recall");
  check("persistence.migrated_cards_survived_relaunch", cards.length > 0 && items.length === 2,
    `cards=${cards.length} items=${items.length}`);
  check("persistence.migrated_srs_unchanged_after_relaunch",
    card?.ease === 2.5 && card?.reps === 2 && card?.intervalDays === 3.5 && card?.state === "review",
    card ? `ease=${card.ease} reps=${card.reps}` : "card missing");

  const integrity = await target.adapter.verifyIntegrity();
  check("persistence.integrity_after_relaunch", integrity.ok === true,
    `orphanCards=${integrity.orphanCards} orphanEvents=${integrity.orphanEvents}`);
  await target.close();
}

/* -------------------------------------------------------------------- entry */

export async function runValidation() {
  const errors = [];
  window.addEventListener("error", e => errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", e => errors.push(String(e.reason)));

  let handle;
  try {
    check("bridge.capacitor_available", Boolean(window.Capacitor), `platform=${window.Capacitor?.getPlatform?.()}`);
    check("bridge.native_platform", window.Capacitor?.isNativePlatform?.() === true);

    handle = await openResultsDb();
    check("sqlite.connection_opened", true);

    const phase = await currentPhase(handle.executor);
    log(`running phase ${phase}`);

    if (phase === 1) await phaseOne(handle);
    else await phaseTwo(handle);

    check("run.no_uncaught_errors", errors.length === 0, errors.join(" | "));
    await persistResults(handle.executor, phase);

    const failed = results.filter(r => !r.passed).length;
    log(`phase ${phase} complete: ${results.length - failed}/${results.length} checks passed`);
    document.title = failed === 0 ? `DF-VALIDATION-PHASE-${phase}-OK` : `DF-VALIDATION-PHASE-${phase}-FAIL`;
  } catch (error) {
    log(`HARNESS ERROR: ${error?.stack || error}`);
    try {
      if (handle) {
        check("run.harness_threw", false, String(error?.message || error));
        await persistResults(handle.executor, 0);
      }
    } catch { /* nothing more we can do */ }
    document.title = "DF-VALIDATION-ERROR";
  } finally {
    try { if (handle) await handle.close(); } catch { /* ignore */ }
  }
}
