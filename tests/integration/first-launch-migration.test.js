/*
 * First-launch migration controller: the approved safe sequence and every failure path.
 *
 *   BACKUP -> READ OLD -> VALIDATE -> TRANSFORM -> WRITE SQLITE -> VERIFY -> SWITCH
 *
 * Each test asserts both the outcome AND that the IndexedDB source is untouched, since
 * it remains the recovery source until parity is proven in production.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { createIndexedDbAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js";
import { createRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/repositories.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { readLearnerState, compareLearnerState } from "../../01_APPLICATION/CURRENT_APP/src/data/backup.js";
import { runFirstLaunchMigration } from "../../01_APPLICATION/CURRENT_APP/src/migration/first-launch-controller.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const NOW = 1771600000000;

async function sourceWith(seed) {
  const environment = { indexedDB: new IDBFactory(), IDBKeyRange, SEED: [] };
  const adapter = createIndexedDbAdapter({ DEFAULT_SETTINGS }, environment);
  await adapter.open();
  const repositories = createRepositories(adapter);
  await repositories.lifecycle.replaceAll({
    words: seed.words, cards: seed.cards, attempts: seed.attempts,
    settings: seed.settings, profile: seed.profile
  });
  return repositories;
}

function freshTarget() {
  const executor = createNodeSqliteExecutor(":memory:");
  return { adapter: createSqliteAdapter(executor), executor };
}

/** Captures the backup and the switch flag the way a device would persist them. */
function harness() {
  const state = { backup: null, switched: null };
  return {
    state,
    backupSink: async payload => { state.backup = payload; return "memory://backup"; },
    commitSwitch: async info => { state.switched = info; }
  };
}

describe("first-launch migration: successful run", () => {
  it("executes the approved sequence in order and switches only at the end", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { state, backupSink, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });

    expect(report.switched).toBe(true);
    expect(report.stages.map(s => s.stage)).toEqual([
      "backup", "read", "validate", "transform", "write", "verify", "switch"
    ]);
    expect(report.stages.every(s => s.ok)).toBe(true);
    // The backup exists and precedes everything else.
    expect(report.stages[0].stage).toBe("backup");
    expect(state.backup.words).toHaveLength(4);
    expect(state.switched.migratedAt).toBe(NOW);
  });

  it("leaves the IndexedDB source completely untouched as the recovery source", async () => {
    const source = await sourceWith(fixture.clean);
    const before = await readLearnerState(source);
    const { adapter } = freshTarget();
    const { backupSink, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });

    expect(report.sourcePreserved).toBe(true);
    const after = await readLearnerState(source);
    expect(compareLearnerState(before, after, { includeValues: true }).differences).toEqual([]);
  });

  it("verifies SRS state is identical rather than recalculated", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { backupSink, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });

    expect(report.verification.ok).toBe(true);
    expect(report.verification.srs.identical).toBe(true);
    expect(report.verification.srs.lostCards).toBe(0);
    expect(report.verification.srs.mismatchCount).toBe(0);
    expect(report.verification.integrity.ok).toBe(true);

    const cards = await adapter.selectAll("reviewCards");
    for (const origin of fixture.clean.cards) {
      const migrated = cards.find(c => c.legacyKey === origin.key);
      expect(migrated.dueAt).toBe(origin.dueAt);
      expect(migrated.ease).toBe(origin.ease);
      expect(migrated.reps).toBe(origin.reps);
      expect(migrated.intervalDays).toBe(origin.intervalDays);
      expect(migrated.state).toBe(origin.state);
    }
  });
});

describe("first-launch migration: failure paths remain on IndexedDB", () => {
  it("refuses to run without a durable backup sink", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    await expect(runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, now: NOW
    })).rejects.toThrow(/durable backupSink is required/);
  });

  it("aborts before reading anything when the backup cannot be persisted", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { state, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source,
      targetAdapter: adapter,
      backupSink: async () => { throw new Error("disk full"); },
      commitSwitch,
      now: NOW
    });

    expect(report.switched).toBe(false);
    expect(report.stage).toBe("backup");
    expect(report.reason).toBe("backup-failed");
    expect(report.remainedOnIndexedDb).toBe(true);
    expect(state.switched).toBeNull();
    // The target schema was never even created: the run stopped before touching it.
    expect(Number(await adapter.schemaVersion())).toBe(0);

    // Source fully intact.
    expect((await readLearnerState(source)).words).toHaveLength(4);
  });

  it("does not switch when the target database already holds data", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { state, backupSink, commitSwitch } = harness();

    // First run migrates successfully.
    const first = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });
    expect(first.switched).toBe(true);

    // A second run must refuse rather than double-import.
    const second = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });
    expect(second.switched).toBe(false);
    expect(second.reason).toBe("target-not-empty");
    expect(second.remainedOnIndexedDb).toBe(true);

    // Still exactly one copy of the data.
    expect(await adapter.selectAll("reviewCards")).toHaveLength(4);
    expect(await adapter.selectAll("vocabularyItems")).toHaveLength(4);
  });

  it("stays on IndexedDB and clears the target when verification fails", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { state, backupSink, commitSwitch } = harness();
    let reset = false;

    // Corrupt the read-back so verification cannot pass.
    const sabotaged = {
      ...adapter,
      readCanonical: async () => {
        const real = await adapter.readCanonical();
        return { ...real, reviewCards: real.reviewCards.slice(1) };
      }
    };

    const report = await runFirstLaunchMigration({
      sourceRepositories: source,
      targetAdapter: sabotaged,
      backupSink,
      commitSwitch,
      resetTarget: async () => { reset = true; },
      now: NOW
    });

    expect(report.switched).toBe(false);
    expect(report.stage).toBe("verify");
    expect(report.reason).toBe("verification-failed");
    expect(report.remainedOnIndexedDb).toBe(true);
    expect(reset).toBe(true);
    expect(state.switched).toBeNull();
  });

  it("stays on IndexedDB when the write fails, leaving the target empty", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { state, backupSink, commitSwitch } = harness();

    const failing = {
      ...adapter,
      importCanonical: async () => { throw new Error("device storage error"); }
    };

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: failing, backupSink, commitSwitch, now: NOW
    });

    expect(report.switched).toBe(false);
    expect(report.stage).toBe("write");
    expect(report.reason).toBe("write-failed");
    expect(state.switched).toBeNull();
    expect(await adapter.selectAll("vocabularyItems")).toHaveLength(0);

    // Source intact and still complete.
    expect((await readLearnerState(source)).words).toHaveLength(4);
  });

  it("stays on IndexedDB when the switch flag cannot be persisted", async () => {
    const source = await sourceWith(fixture.clean);
    const { adapter } = freshTarget();
    const { backupSink } = harness();
    let reset = false;

    const report = await runFirstLaunchMigration({
      sourceRepositories: source,
      targetAdapter: adapter,
      backupSink,
      commitSwitch: async () => { throw new Error("preferences unavailable"); },
      resetTarget: async () => { reset = true; },
      now: NOW
    });

    expect(report.switched).toBe(false);
    expect(report.stage).toBe("switch");
    expect(report.reason).toBe("switch-commit-failed");
    expect(report.remainedOnIndexedDb).toBe(true);
    expect(reset).toBe(true);
  });

  it("migrates a source containing an orphan card without losing it or switching wrongly", async () => {
    // Same shape as the real learner export: a card whose word was deleted.
    const seed = JSON.parse(JSON.stringify(fixture.clean));
    seed.cards.push({
      key: "9999:recall", wordId: 9999, skill: "recall", state: "learning",
      dueAt: 1771497600000, intervalDays: 0, ease: 1.9, reps: 0, lapses: 3,
      streak: 0, mastery: 0, correct: 0, wrong: 3, stability: 0, difficulty: 5,
      lastResult: 1, suspended: false, lastReviewedAt: 1771400000000,
      createdAt: 1700000000000, updatedAt: 1771400000000
    });

    const source = await sourceWith(seed);
    const { adapter } = freshTarget();
    const { backupSink, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });

    expect(report.switched).toBe(true);
    expect(report.verification.srs.lostCards).toBe(0);
    expect(report.verification.srs.quarantinedCards).toBe(1);

    // The orphan card's learner state is preserved verbatim, not discarded.
    const quarantined = await adapter.selectAll("quarantine");
    const card = quarantined.find(row => row.sourceId === "9999:recall");
    expect(card).toBeTruthy();
    expect(JSON.parse(card.payload).lapses).toBe(3);
    expect(JSON.parse(card.payload).ease).toBe(1.9);
  });
});

/*
 * End-to-end rehearsal at real learner-data scale. The real export is READ ONLY: it is
 * loaded into a throwaway in-memory IndexedDB, migrated into a throwaway in-memory
 * SQLite, and the file itself is never opened for writing.
 */
const REAL_BACKUP = path.resolve(process.cwd(), "02_DATA/LEGACY_DATA/DeutschFlow-backup-2026-08-20.json");

describe.skipIf(!fs.existsSync(REAL_BACKUP))("first-launch migration rehearsal on real learner data", () => {
  it("completes the full sequence at real scale with zero SRS loss", async () => {
    const payload = JSON.parse(fs.readFileSync(REAL_BACKUP, "utf8"));
    const source = await sourceWith(payload);
    const before = await readLearnerState(source);
    const { adapter } = freshTarget();
    const { state, backupSink, commitSwitch } = harness();

    const report = await runFirstLaunchMigration({
      sourceRepositories: source, targetAdapter: adapter, backupSink, commitSwitch, now: NOW
    });

    expect(report.switched).toBe(true);
    expect(report.stages.every(s => s.ok)).toBe(true);

    // Backup captured the full learner state before anything else happened.
    expect(state.backup.words).toHaveLength(payload.words.length);
    expect(state.backup.cards).toHaveLength(payload.cards.length);
    expect(state.backup.attempts).toHaveLength(payload.attempts.length);

    // SRS preserved exactly; the one orphan card is quarantined, not lost.
    expect(report.verification.ok).toBe(true);
    expect(report.verification.srs.lostCards).toBe(0);
    expect(report.verification.srs.mismatchCount).toBe(0);
    expect(report.verification.srs.activeCards + report.verification.srs.quarantinedCards)
      .toBe(payload.cards.length);
    expect(report.verification.integrity.ok).toBe(true);

    // Every vocabulary item migrated.
    expect(await adapter.selectAll("vocabularyItems")).toHaveLength(payload.words.length);

    // The IndexedDB source is unchanged and remains the recovery source.
    const after = await readLearnerState(source);
    expect(compareLearnerState(before, after).identical).toBe(true);
  });
});
