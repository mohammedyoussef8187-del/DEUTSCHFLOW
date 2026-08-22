#!/usr/bin/env node
/*
 * Export the imported canonical CONTENT as a static dataset the app can ship.
 *
 * The intake pipeline writes into a SQLite file that only exists on a developer machine.
 * The running app is a static site: it has no SQLite, and on the web target it had no
 * canonical store at all, so every curriculum screen said "nothing authored yet" while
 * a fully imported lesson sat in a database no learner could reach.
 *
 * This bridges the two. It reads the intake store through the same adapter the importer
 * used and writes the content tables out as JSON, in the exact shape
 * `adapter.importCanonical()` accepts, so the browser store reconstitutes byte-identical
 * rows rather than a hand-shaped summary of them.
 *
 * It exports CONTENT ONLY. Learner-owned tables — profiles, settings, progress, error
 * history, spoken attempts, reminders and every SRS row — are refused outright, because
 * this file is shipped to every device: one learner's history must never travel inside
 * the app bundle. Empty tables are omitted so the file stays readable.
 *
 *   node tools/intake/export-canonical.mjs [--db <file>] [--out <file>] [--pretty]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { SCHEMA_VERSION, TABLE_SPECS } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js";

/**
 * Tables that hold something a person did, rather than something an editor authored.
 * Nothing here is ever exported.
 */
export const LEARNER_ENTITIES = Object.freeze([
  "profiles", "settings",
  "reviewCards", "reviewEvents",
  "courseProgress", "lessonProgress", "sectionProgress", "cefrProgress",
  "errorEvents", "errorEventCategories", "errorPatterns",
  "pronunciationAttempts",
  "reminderSettings", "reminderSchedule",
  "quarantine"
]);

export const CONTENT_ENTITIES = Object.freeze(
  TABLE_SPECS.map(spec => spec.entity).filter(entity => !LEARNER_ENTITIES.includes(entity))
);

/**
 * Read the content tables out of an open canonical adapter.
 * @returns {Promise<{schemaVersion:number, entities:object, counts:object, total:number}>}
 */
export async function exportCanonicalContent(adapter) {
  const entities = {};
  const counts = {};
  let total = 0;

  for (const entity of CONTENT_ENTITIES) {
    const rows = await adapter.selectAll(entity);
    if (!rows.length) continue;              // an empty table says nothing; omit it
    entities[entity] = rows;
    counts[entity] = rows.length;
    total += rows.length;
  }

  return { schemaVersion: await adapter.schemaVersion(), entities, counts, total };
}

function openReadOnly(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    executor: {
      async exec() { throw new Error("read-only export"); },
      async run() { throw new Error("read-only export"); },
      async all(sql, params = []) { return db.prepare(sql).all(...params); },
      async transaction(fn) { return fn(); },
      async pragma(name) {
        const row = db.prepare(`PRAGMA ${name}`).get();
        return row ? Object.values(row)[0] : null;
      }
    },
    close: () => db.close()
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const dbFile = path.resolve(process.cwd(), value("--db", "tools/intake/artifacts/intake.db"));
  const outFile = path.resolve(process.cwd(),
    value("--out", "01_APPLICATION/CURRENT_APP/data/canonical-content.json"));

  if (!fs.existsSync(dbFile)) {
    console.error(`no canonical store at ${dbFile}; run the intake first`);
    process.exit(2);
  }

  const store = openReadOnly(dbFile);
  try {
    const adapter = createSqliteAdapter(store.executor);
    const exported = await exportCanonicalContent(adapter);

    if (exported.schemaVersion !== SCHEMA_VERSION) {
      console.error(
        `store is schema ${exported.schemaVersion}, this build expects ${SCHEMA_VERSION}`);
      process.exit(3);
    }

    const dataset = {
      schemaVersion: exported.schemaVersion,
      source: path.relative(process.cwd(), dbFile).split(path.sep).join("/"),
      counts: exported.counts,
      entities: exported.entities
    };

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile,
      JSON.stringify(dataset, null, args.includes("--pretty") ? 2 : 0) + "\n");

    console.log(`wrote ${exported.total} content rows to ${outFile}`);
    for (const [entity, count] of Object.entries(exported.counts)) {
      console.log(`  ${entity}: ${count}`);
    }
  } finally {
    store.close();
  }
}

if (import.meta.url === `file://${process.argv[1].split(path.sep).join("/")}` ||
    process.argv[1]?.endsWith("export-canonical.mjs")) {
  await main();
}
