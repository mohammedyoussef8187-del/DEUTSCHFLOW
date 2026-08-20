/*
 * End-to-end structural migration parity (Stop Gate 3).
 *
 * Exercises the full approved path with real storage engines:
 *   READ OLD (IndexedDB) -> VALIDATE/TRANSFORM (migration) -> WRITE NEW (SQLite)
 *   -> VERIFY (parity + integrity)  -- the source IndexedDB is never deleted.
 * Asserts the canonical state round-trips exactly and that SRS state is identical.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { createIndexedDbAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);

async function seededIndexedDb(snapshot) {
  const environment = { indexedDB: new IDBFactory(), IDBKeyRange, SEED: [] };
  const adapter = createIndexedDbAdapter({ DEFAULT_SETTINGS }, environment);
  await adapter.open();
  await adapter.replaceAll({
    words: snapshot.words,
    cards: snapshot.cards,
    attempts: snapshot.attempts,
    settings: snapshot.settings,
    profile: snapshot.profile
  });
  return adapter;
}

// READ OLD: pull the runtime snapshot back out of IndexedDB exactly as the app would.
async function readSnapshot(indexeddb) {
  return {
    words: await indexeddb.getAll("words"),
    cards: await indexeddb.getAll("cards"),
    attempts: await indexeddb.getAll("attempts"),
    settings: await indexeddb.getMeta("settings", null),
    profile: await indexeddb.getMeta("profile", null)
  };
}

async function loadSqlite(dataset) {
  const executor = createNodeSqliteExecutor(":memory:");
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  await adapter.importCanonical(dataset);
  return { adapter, executor };
}

describe("IndexedDB -> migration -> SQLite parity", () => {
  it("round-trips the canonical state field-for-field through SQLite", async () => {
    const indexeddb = await seededIndexedDb(fixture.clean);
    const snapshot = await readSnapshot(indexeddb);
    const { dataset } = migrateToCanonical(snapshot, { now: 1771600000000 });
    const { adapter } = await loadSqlite(dataset);

    const readBack = await adapter.readCanonical();
    for (const entity of Object.keys(dataset)) {
      expect(sortByUuid(readBack[entity])).toEqual(sortByUuid(dataset[entity]));
    }
  });

  it("keeps SRS state identical from source card to migrated SQLite card", async () => {
    const indexeddb = await seededIndexedDb(fixture.clean);
    const snapshot = await readSnapshot(indexeddb);
    const { dataset } = migrateToCanonical(snapshot, { now: 1771600000000 });
    const { adapter } = await loadSqlite(dataset);

    const migratedCards = await adapter.selectAll("reviewCards");
    for (const source of snapshot.cards) {
      const target = migratedCards.find(c => c.legacyKey === source.key);
      expect(target, `card ${source.key} present`).toBeTruthy();
      expect(target.dueAt).toBe(source.dueAt);          // due dates unchanged
      expect(target.intervalDays).toBe(source.intervalDays);
      expect(target.ease).toBe(source.ease);
      expect(target.reps).toBe(source.reps);
      expect(target.lapses).toBe(source.lapses);
      expect(target.streak).toBe(source.streak);
      expect(target.mastery).toBe(source.mastery);
      expect(target.state).toBe(source.state);
      expect(target.lastReviewedAt).toBe(source.lastReviewedAt ?? null);
      expect(target.suspended).toBe(source.suspended ? 1 : 0);
    }
  });

  it("matches entity counts and passes post-migration integrity checks", async () => {
    const indexeddb = await seededIndexedDb(fixture.clean);
    const snapshot = await readSnapshot(indexeddb);
    const { dataset, report } = migrateToCanonical(snapshot, { now: 1771600000000 });
    const { adapter } = await loadSqlite(dataset);

    const integrity = await adapter.verifyIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.rowCounts.vocabularyItems).toBe(snapshot.words.length);
    expect(integrity.rowCounts.reviewCards).toBe(snapshot.cards.length);
    expect(integrity.rowCounts.reviewEvents).toBe(snapshot.attempts.length);
    expect(report.quarantine).toHaveLength(0);
  });

  it("leaves the source IndexedDB intact and recoverable after migration", async () => {
    const indexeddb = await seededIndexedDb(fixture.clean);
    const snapshot = await readSnapshot(indexeddb);
    const { dataset } = migrateToCanonical(snapshot, { now: 1771600000000 });
    await loadSqlite(dataset);

    // Never READ OLD -> DELETE OLD -> WRITE NEW: the old source must survive the write.
    const stillThere = await readSnapshot(indexeddb);
    expect(stillThere.words).toHaveLength(fixture.clean.words.length);
    expect(stillThere.cards).toHaveLength(fixture.clean.cards.length);
    const haus = stillThere.words.find(w => w.id === 1);
    expect(haus.german).toBe("Haus");
  });
});

function sortByUuid(rows) {
  return [...rows].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}
