import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { SCHEMA_VERSION } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) {
    const fn = cleanup.pop();
    await fn();
  }
});

async function freshAdapter(location = ":memory:") {
  const executor = createNodeSqliteExecutor(location);
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, executor };
}

describe("SQLite canonical persistence adapter", () => {
  it("creates the schema and records the current schema version", async () => {
    const { adapter, executor } = await freshAdapter();
    expect(await adapter.schemaVersion()).toBe(SCHEMA_VERSION);
    const tables = await executor.all(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", []
    );
    expect(tables.map(t => t.name)).toEqual([
      "accepted_answers", "learner_profiles", "migration_quarantine", "review_cards",
      "review_events", "settings", "translations", "vocabulary_items", "vocabulary_meanings"
    ]);
  });

  it("imports a canonical dataset and reads it back unchanged", async () => {
    const { adapter } = await freshAdapter();
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await adapter.importCanonical(dataset);
    const readBack = await adapter.readCanonical();

    for (const entity of Object.keys(dataset)) {
      expect(sortByUuid(readBack[entity])).toEqual(sortByUuid(dataset[entity]));
    }
  });

  it("persists to a real temporary database file", async () => {
    const file = path.join(os.tmpdir(), `deutschflow-test-${Date.now()}.db`);
    cleanup.push(async () => { try { fs.unlinkSync(file); } catch {} });
    const { adapter } = await freshAdapter(file);
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await adapter.importCanonical(dataset);
    expect(fs.existsSync(file)).toBe(true);
    const cards = await adapter.selectAll("reviewCards");
    expect(cards).toHaveLength(4);
  });

  it("rolls back the whole import if any row is invalid (all-or-nothing)", async () => {
    const { adapter } = await freshAdapter();
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    // Force a NOT NULL violation partway through the transaction.
    dataset.reviewCards[1].vocabUuid = null;
    await expect(adapter.importCanonical(dataset)).rejects.toBeTruthy();
    const readBack = await adapter.readCanonical();
    // Nothing committed: the source remains recoverable, the target stays empty.
    expect(readBack.vocabularyItems).toHaveLength(0);
    expect(readBack.reviewCards).toHaveLength(0);
  });

  it("verifies integrity: no orphans, correct counts, ease within bounds", async () => {
    const { adapter } = await freshAdapter();
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await adapter.importCanonical(dataset);
    const integrity = await adapter.verifyIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.orphanCards).toBe(0);
    expect(integrity.orphanEvents).toBe(0);
    expect(integrity.easeOutOfBounds).toBe(0);
    expect(integrity.rowCounts.vocabularyItems).toBe(4);
    expect(integrity.rowCounts.reviewCards).toBe(4);
  });

  it("exposes storage only through the repository layer", async () => {
    const { adapter } = await freshAdapter();
    const repos = createCanonicalRepositories(adapter);
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await repos.lifecycle.importCanonical(dataset);
    expect(await repos.lifecycle.schemaVersion()).toBe(SCHEMA_VERSION);
    expect(await repos.cards.all()).toHaveLength(4);
    expect((await repos.vocabulary.all()).map(v => v.legacyId).sort()).toEqual(["1", "2", "3", "4"]);
  });
});

function sortByUuid(rows) {
  return [...rows].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}
