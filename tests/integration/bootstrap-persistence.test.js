import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { createIndexedDbAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js";
import { createRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/repositories.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { bootstrapPersistence } from "../../01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const NOW = 1771600000000;
const NATIVE = { Capacitor: { isNativePlatform: () => true } };

function harness(seed = fixture.clean) {
  // One IndexedDB instance shared across calls, as on a real device.
  const environment = { indexedDB: new IDBFactory(), IDBKeyRange, SEED: [] };
  const idb = createIndexedDbAdapter({ DEFAULT_SETTINGS }, environment);
  const repositories = createRepositories(idb);
  const state = { seeded: false, switched: null, backup: null, sqliteOpens: 0 };

  return {
    state,
    openIndexedDb: async () => {
      if (!state.seeded) {
        await idb.open();
        await repositories.lifecycle.replaceAll({
          words: seed.words, cards: seed.cards, attempts: seed.attempts,
          settings: seed.settings, profile: seed.profile
        });
        state.seeded = true;
      }
      return repositories;
    },
    openSqliteTarget: async () => {
      state.sqliteOpens++;
      return createSqliteAdapter(createNodeSqliteExecutor(":memory:"));
    },
    backupSink: async payload => { state.backup = payload; return "memory://backup"; },
    commitSwitch: async info => { state.switched = info; }
  };
}

describe("persistence bootstrap", () => {
  it("keeps development behavior unchanged: IndexedDB, and no migration attempted", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, ...h, now: NOW // nativeStorageEnabled omitted => OFF
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("native-storage-gated-until-verified");
    expect(result.migration).toBeNull();
    expect(result.repositories).toBeTruthy();
    // Nothing was migrated or switched.
    expect(h.state.sqliteOpens).toBe(0);
    expect(h.state.switched).toBeNull();
    expect(h.state.backup).toBeNull();
  });

  it("uses IndexedDB on the web target even when the switch is enabled", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: {}, nativeStorageEnabled: true, ...h, now: NOW
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("web-target-uses-indexeddb");
    expect(h.state.sqliteOpens).toBe(0);
  });

  it("migrates and switches to SQLite on a native platform when enabled", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h, now: NOW
    });

    expect(result.backend).toBe("sqlite");
    expect(result.reason).toBe("migrated");
    expect(result.migration.switched).toBe(true);
    expect(h.state.switched.migratedAt).toBe(NOW);
    expect(h.state.backup.words).toHaveLength(4);
    expect(await result.adapter.selectAll("reviewCards")).toHaveLength(4);
  });

  it("skips migration entirely on an already-migrated device", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h,
      isAlreadyMigrated: async () => true, now: NOW
    });

    expect(result.backend).toBe("sqlite");
    expect(result.reason).toBe("already-migrated");
    expect(result.migration).toBeNull();
    expect(h.state.backup).toBeNull();
    expect(h.state.switched).toBeNull();
  });
});

describe("automatic fallback to IndexedDB", () => {
  it("falls back when the SQLite database cannot be opened", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h,
      openSqliteTarget: async () => { throw new Error("native plugin unavailable"); },
      now: NOW
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("sqlite-open-failed");
    expect(result.fellBack).toBe(true);
    expect(result.repositories).toBeTruthy();
  });

  it("falls back when the backup cannot be persisted", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h,
      backupSink: async () => { throw new Error("disk full"); },
      now: NOW
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("migration-not-switched");
    expect(result.migration.stage).toBe("backup");
    expect(h.state.switched).toBeNull();
  });

  it("falls back when no backup sink is configured at all", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h, backupSink: null, now: NOW
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("migration-aborted");
    expect(h.state.switched).toBeNull();
  });

  it("falls back when verification fails, and never switches", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h,
      openSqliteTarget: async () => {
        const adapter = createSqliteAdapter(createNodeSqliteExecutor(":memory:"));
        return {
          ...adapter,
          // Corrupt the read-back so verification cannot pass.
          readCanonical: async () => {
            const real = await adapter.readCanonical();
            return { ...real, vocabularyItems: [] };
          }
        };
      },
      now: NOW
    });

    expect(result.backend).toBe("indexeddb");
    expect(result.reason).toBe("migration-not-switched");
    expect(result.migration.stage).toBe("verify");
    expect(h.state.switched).toBeNull();
    // The learner still has a working store.
    expect(await result.repositories.vocabulary.all()).toHaveLength(4);
  });

  it("still returns a usable IndexedDB store after any fallback", async () => {
    const h = harness();
    const result = await bootstrapPersistence({
      environment: NATIVE, nativeStorageEnabled: true, ...h,
      openSqliteTarget: async () => { throw new Error("boom"); },
      now: NOW
    });

    const words = await result.repositories.vocabulary.all();
    const cards = await result.repositories.cards.all();
    expect(words).toHaveLength(4);
    expect(cards).toHaveLength(4);
    // SRS state intact on the fallback path.
    expect(cards.find(c => c.key === "1:recall").ease).toBe(2.5);
  });
});

describe("canonical model gate status", () => {
  it("records the simulator gate as passed and names the commit", async () => {
    const { CANONICAL_MODEL_STATUS } = await import(
      "../../01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js");
    expect(CANONICAL_MODEL_STATUS.simulatorGate).toBe("passed");
    expect(CANONICAL_MODEL_STATUS.simulatorGateCommit).toBe("16807f9");
  });

  it("activates the canonical model for development only", async () => {
    const { isCanonicalModelActiveForDevelopment, isLearnerStorageSwitched } = await import(
      "../../01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js");
    expect(isCanonicalModelActiveForDevelopment()).toBe(true);
    // The learner-facing switch stays off until the physical-device gate passes.
    expect(isLearnerStorageSwitched()).toBe(false);
  });

  it("keeps physical-device validation as a deferred release gate", async () => {
    const { CANONICAL_MODEL_STATUS } = await import(
      "../../01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js");
    expect(CANONICAL_MODEL_STATUS.physicalDeviceGate).toBe("deferred-release-gate");
    expect(CANONICAL_MODEL_STATUS.learnerSwitchEnabled).toBe(false);
  });

  it("still resolves real learners to IndexedDB despite development activation", async () => {
    const h = harness();
    const result = await bootstrapPersistence({ environment: NATIVE, ...h, now: NOW });
    expect(result.backend).toBe("indexeddb");
    expect(h.state.switched).toBeNull();
  });
});
