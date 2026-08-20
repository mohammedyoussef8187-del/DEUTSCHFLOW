#!/usr/bin/env node
/*
 * Read-only migration dry-run against a real learner backup export.
 *
 *   node tools/migration-dry-run.mjs "02_DATA/LEGACY_DATA/DeutschFlow-backup-2026-08-20.json"
 *
 * The source file is opened read-only and never written, moved, or modified. The SQLite
 * verification target is an in-memory database that is discarded when the process exits.
 * Output contains counts, field names, and record identities only: no study content.
 */

import fs from "node:fs";
import path from "node:path";
import { runMigrationDryRun } from "../01_APPLICATION/CURRENT_APP/src/migration/dry-run.js";
import { validateBackup } from "../01_APPLICATION/CURRENT_APP/src/data/backup.js";
import { createSqliteAdapter } from "../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../tests/support/sqlite-node-executor.js";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node tools/migration-dry-run.mjs <backup.json>");
  process.exit(2);
}

const resolved = path.resolve(sourcePath);
const payload = JSON.parse(fs.readFileSync(resolved, "utf8")); // read-only
const fileValidation = validateBackup(payload);

const executor = createNodeSqliteExecutor(":memory:");
const report = await runMigrationDryRun(
  {
    words: payload.words,
    cards: payload.cards,
    attempts: payload.attempts,
    settings: payload.settings,
    profile: payload.profile
  },
  {
    now: Date.parse("2026-08-21T00:00:00Z"),
    schemaVersion: payload.schemaVersion,
    sqliteAdapter: createSqliteAdapter(executor)
  }
);
await executor.close();

const line = (label, value) => console.log(`${label.padEnd(34)} ${value}`);
console.log("\n=== DeutschFlow migration dry-run (READ-ONLY) ===");
line("source file", path.basename(resolved));
line("source schemaVersion", payload.schemaVersion);
line("source file validation", fileValidation.ok ? "PASS" : `FAIL ${fileValidation.errors.join(",")}`);
line("source file warnings", JSON.stringify(fileValidation.warnings));

console.log("\n-- counts --");
line("source words/cards/attempts",
  `${report.sourceCounts.words} / ${report.sourceCounts.cards} / ${report.sourceCounts.attempts}`);
for (const [entity, count] of Object.entries(report.canonicalCounts)) line(`canonical ${entity}`, count);

console.log("\n-- SRS parity --");
line("source cards", report.srsParity.sourceCards);
line("active canonical cards", report.srsParity.activeCards);
line("quarantined (preserved) cards", report.srsParity.quarantinedCards);
line("LOST cards", report.srsParity.lostCards);
line("field mismatches", report.srsParity.mismatchCount);
line("SRS preserved", report.srsParity.identical ? "YES" : "NO");

console.log("\n-- relationship integrity --");
line("integrity ok", report.relationships.ok ? "YES" : "NO");
line("orphan meanings/answers", `${report.relationships.orphanMeanings} / ${report.relationships.orphanAnswers}`);
line("orphan cards/events", `${report.relationships.orphanCards} / ${report.relationships.orphanEvents}`);
line("duplicate card identity", report.relationships.duplicateCardIdentity);

console.log("\n-- isolated SQLite write/read-back --");
if (report.sqliteCheck) {
  line("round-trip ok", report.sqliteCheck.ok ? "YES" : "NO");
  line("mismatched entities", JSON.stringify(report.sqliteCheck.mismatchedEntities));
  line("ease out of bounds", report.sqliteCheck.integrity.easeOutOfBounds);
} else {
  line("round-trip", "not run");
}

console.log("\n-- quarantine --");
line("total quarantined", report.quarantine.total);
for (const [reason, count] of Object.entries(report.quarantine.byReason)) line(`  ${reason}`, count);

console.log("\n-- warnings --");
line("total warnings", report.warnings.total);
for (const [reason, count] of Object.entries(report.warnings.byReason)) line(`  ${reason}`, count);

console.log("\n-- unmapped source fields --");
if (!report.unmapped.length) line("unmapped fields", "NONE");
for (const item of report.unmapped) line(`  ${item.collection}.${item.field}`, `${item.records} records`);

console.log("\n-- risks --");
if (!report.risks.length) line("risks", "NONE");
for (const risk of report.risks) line(`  [${risk.severity}] ${risk.reason}`, JSON.stringify(risk.detail));

console.log("\n=== VERDICT ===");
line("source modified", report.sourceModified ? "YES" : "NO");
line("persistence switch appears safe", report.switchAppearsSafe ? "YES" : "NOT YET");
console.log("");
