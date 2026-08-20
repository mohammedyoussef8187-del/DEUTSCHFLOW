/*
 * Read-only migration dry-run coverage, including a run against the real learner
 * backup export when it is present in the repository.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMigrationDryRun, detectUnmappedFields } from "../../01_APPLICATION/CURRENT_APP/src/migration/dry-run.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const NOW = 1771600000000;

function isolatedSqlite() {
  return createSqliteAdapter(createNodeSqliteExecutor(":memory:"));
}

describe("migration dry-run", () => {
  it("reports a clean snapshot as safe with no risks", async () => {
    const report = await runMigrationDryRun(fixture.clean, { now: NOW, sqliteAdapter: isolatedSqlite() });

    expect(report.sourceValidation.ok).toBe(true);
    expect(report.srsParity.identical).toBe(true);
    expect(report.srsParity.lostCards).toBe(0);
    expect(report.relationships.ok).toBe(true);
    expect(report.sqliteCheck.ok).toBe(true);
    expect(report.unmapped).toEqual([]);
    expect(report.risks).toEqual([]);
    expect(report.switchAppearsSafe).toBe(true);
    expect(report.sourceModified).toBe(false);
  });

  it("treats the source snapshot as strictly read-only", async () => {
    const snapshot = JSON.parse(JSON.stringify(fixture.clean));
    const before = JSON.stringify(snapshot);
    await runMigrationDryRun(snapshot, { now: NOW, sqliteAdapter: isolatedSqlite() });
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("detects source fields the transform does not read", () => {
    const snapshot = JSON.parse(JSON.stringify(fixture.clean));
    snapshot.words[0].experimentalScore = 42;
    snapshot.attempts[0].newTelemetryField = "x";

    const unmapped = detectUnmappedFields(snapshot);
    expect(unmapped).toContainEqual({ collection: "words", field: "experimentalScore", records: 1 });
    expect(unmapped).toContainEqual({ collection: "attempts", field: "newTelemetryField", records: 1 });
  });

  it("blocks the switch when unmapped fields would be silently dropped", async () => {
    const snapshot = JSON.parse(JSON.stringify(fixture.clean));
    snapshot.words[0].experimentalScore = 42;

    const report = await runMigrationDryRun(snapshot, { now: NOW });
    expect(report.switchAppearsSafe).toBe(false);
    expect(report.risks.some(r => r.reason === "unmapped-source-fields" && r.severity === "blocking")).toBe(true);
  });

  it("preserves unresolved records instead of losing them", async () => {
    const report = await runMigrationDryRun(fixture.malformed, { now: NOW, sqliteAdapter: isolatedSqlite() });

    // The orphan card is quarantined, not dropped: no SRS state is lost.
    expect(report.srsParity.lostCards).toBe(0);
    expect(report.srsParity.quarantinedCards).toBeGreaterThan(0);
    expect(report.quarantine.total).toBeGreaterThan(0);
    expect(report.risks.some(r => r.reason === "srs-cards-quarantined-not-active")).toBe(true);
    // Quarantined records still load and read back from SQLite.
    expect(report.sqliteCheck.ok).toBe(true);
  });

  it("keeps learner study content out of the report", async () => {
    const report = await runMigrationDryRun(fixture.clean, { now: NOW });
    const serialized = JSON.stringify(report);
    for (const secret of ["Haus", "بيت", "das Haus", "schönes"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});

/*
 * Real learner data: the actual exported backup in 02_DATA. Skipped automatically if the
 * export is not present in the working copy. The file is only ever read.
 */
const REAL_BACKUP = path.resolve(process.cwd(), "02_DATA/LEGACY_DATA/DeutschFlow-backup-2026-08-20.json");
const hasRealBackup = fs.existsSync(REAL_BACKUP);

describe.skipIf(!hasRealBackup)("real learner data dry-run (read-only)", () => {
  it("migrates real learner state with zero loss and leaves the file untouched", async () => {
    const digestBefore = crypto.createHash("sha256").update(fs.readFileSync(REAL_BACKUP)).digest("hex");
    const mtimeBefore = fs.statSync(REAL_BACKUP).mtimeMs;

    const payload = JSON.parse(fs.readFileSync(REAL_BACKUP, "utf8"));
    const report = await runMigrationDryRun(
      {
        words: payload.words, cards: payload.cards, attempts: payload.attempts,
        settings: payload.settings, profile: payload.profile
      },
      { now: NOW, schemaVersion: payload.schemaVersion, sqliteAdapter: isolatedSqlite() }
    );

    // Every vocabulary item and every SRS card survives.
    expect(report.canonicalCounts.vocabularyItems).toBe(payload.words.length);
    expect(report.srsParity.lostCards).toBe(0);
    expect(report.srsParity.mismatchCount).toBe(0);
    expect(report.srsParity.activeCards + report.srsParity.quarantinedCards).toBe(payload.cards.length);
    expect(report.canonicalCounts.reviewEvents + report.quarantine.total - report.srsParity.quarantinedCards)
      .toBe(payload.attempts.length);

    expect(report.unmapped).toEqual([]);
    expect(report.relationships.ok).toBe(true);
    expect(report.sqliteCheck.ok).toBe(true);
    expect(report.risks.filter(r => r.severity === "blocking")).toEqual([]);
    expect(report.switchAppearsSafe).toBe(true);

    // The learner's exported file is unchanged, byte for byte.
    const digestAfter = crypto.createHash("sha256").update(fs.readFileSync(REAL_BACKUP)).digest("hex");
    expect(digestAfter).toBe(digestBefore);
    expect(fs.statSync(REAL_BACKUP).mtimeMs).toBe(mtimeBefore);
  });
});
