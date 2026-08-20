/*
 * Capacitor native SQLite executor contract tests.
 *
 * Verifies the executor drives @capacitor-community/sqlite correctly and that the
 * platform-neutral adapter, migration, and parity guarantees hold unchanged when the
 * Node executor is swapped for the Capacitor one. On-device verification (Xcode 26 /
 * Android Studio Otter) remains a separate gate; these tests cover the contract.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCapacitorSqliteExecutor, openCapacitorSqlite, DATABASE_NAME
} from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/capacitor-executor.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import { createFakeSQLiteConnection } from "../support/fake-capacitor-sqlite.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const NOW = 1771600000000;

async function openFake(options = {}) {
  const connection = createFakeSQLiteConnection();
  const handle = await openCapacitorSqlite({ connection, ...options });
  return { ...handle, connection };
}

describe("Capacitor SQLite executor", () => {
  it("opens a connection with the approved parameters and enables foreign keys", async () => {
    const { connection, database } = await openFake();

    expect(database).toBe(DATABASE_NAME);
    const created = connection.calls.find(c => c[0] === "createConnection");
    // database, encrypted, mode, version, readonly
    expect(created).toEqual(["createConnection", "deutschflow", false, "no-encryption", 1, false]);
    expect(connection.calls.some(c => c[0] === "open")).toBe(true);
    expect(connection.calls.some(c => c[0] === "execute" && c[1] === "PRAGMA foreign_keys = ON")).toBe(true);
  });

  it("reuses an existing registered connection instead of creating a duplicate", async () => {
    const connection = createFakeSQLiteConnection();
    await openCapacitorSqlite({ connection });
    await openCapacitorSqlite({ connection });

    expect(connection.calls.filter(c => c[0] === "createConnection")).toHaveLength(1);
    expect(connection.calls.filter(c => c[0] === "retrieveConnection")).toHaveLength(1);
  });

  it("keeps the plugin's implicit per-call transaction disabled", async () => {
    const { executor, connection } = await openFake();
    await executor.exec("CREATE TABLE t (a INTEGER, b TEXT)");
    await executor.run("INSERT INTO t (a, b) VALUES (?, ?)", [1, "x"]);

    // Every execute/run must pass transaction=false so the adapter's explicit
    // BEGIN/COMMIT is the only transaction in play and imports stay all-or-nothing.
    for (const call of connection.calls.filter(c => c[0] === "execute")) expect(call[2]).toBe(false);
    for (const call of connection.calls.filter(c => c[0] === "run")) expect(call[3]).toBe(false);
  });

  it("binds parameters and returns plain rows from query results", async () => {
    const { executor } = await openFake();
    await executor.exec("CREATE TABLE t (a INTEGER, b TEXT)");
    await executor.run("INSERT INTO t (a, b) VALUES (?, ?)", [7, "seven"]);

    expect(await executor.all("SELECT * FROM t WHERE a = ?", [7])).toEqual([{ a: 7, b: "seven" }]);
    expect(await executor.all("SELECT * FROM t WHERE a = ?", [99])).toEqual([]);
  });

  it("commits a successful transaction and rolls a failed one back", async () => {
    const { executor, connection } = await openFake();
    await executor.exec("CREATE TABLE t (a INTEGER NOT NULL)");

    await executor.transaction(async () => {
      await executor.run("INSERT INTO t (a) VALUES (?)", [1]);
    });
    expect(connection.calls.some(c => c[0] === "commitTransaction")).toBe(true);
    expect(await executor.all("SELECT * FROM t", [])).toHaveLength(1);

    await expect(executor.transaction(async () => {
      await executor.run("INSERT INTO t (a) VALUES (?)", [2]);
      throw new Error("boom");
    })).rejects.toThrow("boom");

    expect(connection.calls.some(c => c[0] === "rollbackTransaction")).toBe(true);
    expect(await executor.all("SELECT * FROM t", [])).toHaveLength(1);
  });

  it("reads and writes PRAGMA values and rejects unsafe pragma input", async () => {
    const { executor } = await openFake();
    await executor.pragma("user_version", 1);
    expect(Number(await executor.pragma("user_version"))).toBe(1);

    await expect(executor.pragma("user_version; DROP TABLE t", 1)).rejects.toThrow(/Invalid PRAGMA name/);
    await expect(executor.pragma("user_version", "1; DROP TABLE t")).rejects.toThrow(/Invalid PRAGMA value/);
  });

  it("requires an open connection", () => {
    expect(() => createCapacitorSqliteExecutor(null)).toThrow(/open SQLiteDBConnection is required/);
  });
});

describe("canonical persistence over the Capacitor executor", () => {
  it("runs the schema, migration, and parity guarantees unchanged on the native path", async () => {
    const { executor } = await openFake();
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    expect(Number(await adapter.schemaVersion())).toBe(1);

    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    await adapter.importCanonical(dataset);

    const readBack = await adapter.readCanonical();
    for (const entity of Object.keys(dataset)) {
      expect(sortByUuid(readBack[entity])).toEqual(sortByUuid(dataset[entity]));
    }

    const integrity = await adapter.verifyIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.easeOutOfBounds).toBe(0);
  });

  it("preserves SRS state exactly through the native executor", async () => {
    const { executor } = await openFake();
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    await adapter.importCanonical(dataset);

    const cards = await adapter.selectAll("reviewCards");
    for (const source of fixture.clean.cards) {
      const target = cards.find(c => c.legacyKey === source.key);
      expect(target.dueAt).toBe(source.dueAt);
      expect(target.intervalDays).toBe(source.intervalDays);
      expect(target.ease).toBe(source.ease);
      expect(target.reps).toBe(source.reps);
      expect(target.lapses).toBe(source.lapses);
      expect(target.streak).toBe(source.streak);
      expect(target.mastery).toBe(source.mastery);
      expect(target.state).toBe(source.state);
    }
  });

  it("exposes native storage only through the repository layer", async () => {
    const { executor } = await openFake();
    const adapter = createSqliteAdapter(executor);
    const repositories = createCanonicalRepositories(adapter);
    await repositories.lifecycle.initializeSchema();

    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    await repositories.lifecycle.importCanonical(dataset);
    expect(await repositories.cards.all()).toHaveLength(4);
    expect((await repositories.lifecycle.verifyIntegrity()).ok).toBe(true);
  });
});

function sortByUuid(rows) {
  return [...rows].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}
