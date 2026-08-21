#!/usr/bin/env node
/*
 * The intake pipeline, end to end, for one lesson.
 *
 *   node tools/intake/run-intake.mjs --preview
 *   node tools/intake/run-intake.mjs --apply --db intake.db
 *
 * EXTRACT → NORMALIZE → PARSE → VALIDATE → MAP → PREVIEW/DIFF → IMPORT → VERIFY.
 *
 * `--preview` is the default and writes nothing. It prints what would be created,
 * updated or refused, so the diff is always seen before the store is touched.
 *
 * A validation ERROR stops the run. A CONFLICT — a source change against content a human
 * verified — also stops it, and needs `--accept-changes` to proceed, which is a decision
 * someone has to make on purpose.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { extractSource, writeArtifacts } from "./extract.mjs";
import { sourceById } from "./sources.js";
import { parseExercises, parseManuscript } from "./parse-nicos-weg.js";
import { mergeValidation, validateExercises, validateManuscript } from "./validate.js";
import { mapLesson } from "./map-canonical.js";
import { applyImport, planImport, verifyImport } from "./import.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";

const MANUSCRIPT = "nicos-weg-a2-e2-l1-manuscript";
const EXERCISES = "nicos-weg-a2-e2-l1-exercises";

/** Everything up to and including MAP. Pure enough to run without a database. */
export function buildLesson({ now = Date.now(), root = process.cwd(), writeArtifactFiles = false } = {}) {
  const manuscriptSource = sourceById(MANUSCRIPT);
  const exerciseSource = sourceById(EXERCISES);

  const manuscriptExtraction = extractSource(MANUSCRIPT, { root, now });
  const exerciseExtraction = extractSource(EXERCISES, { root, now });
  if (writeArtifactFiles) {
    writeArtifacts(manuscriptExtraction, { root });
    writeArtifacts(exerciseExtraction, { root });
  }

  const manuscript = parseManuscript(manuscriptExtraction, manuscriptSource);
  const exercises = parseExercises(exerciseExtraction, exerciseSource);

  const validation = mergeValidation(
    validateManuscript(manuscript, manuscriptSource),
    validateExercises(exercises, exerciseSource)
  );

  const mapped = mapLesson({
    manuscript, exercises,
    source: manuscriptSource, exerciseSource,
    extraction: manuscriptExtraction, exerciseExtraction,
    now
  });

  return { manuscript, exercises, validation, mapped, manuscriptExtraction, exerciseExtraction };
}

function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  const executor = {
    async exec(sql) { db.exec(sql); },
    async run(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result?.changes ?? 0) };
    },
    async all(sql, params = []) { return db.prepare(sql).all(...params); },
    async transaction(fn) {
      db.exec("BEGIN");
      try { await fn(); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    async pragma(name, value) {
      if (value === undefined) {
        const row = db.prepare(`PRAGMA ${name}`).get();
        return row ? Object.values(row)[0] : null;
      }
      db.exec(`PRAGMA ${name} = ${value}`);
      return value;
    }
  };
  return { db, executor };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const accept = args.includes("--accept-changes");
  const dbIndex = args.indexOf("--db");
  const dbFile = dbIndex === -1 ? "tools/intake/artifacts/intake.db" : args[dbIndex + 1];

  const { validation, mapped } = buildLesson({ writeArtifactFiles: true });

  console.log("── validation ──");
  console.log(JSON.stringify(validation.summary, null, 2));
  for (const entry of validation.issues) {
    console.log(`  ${entry.severity === "error" ? "ERROR" : "warn "} ${entry.code}` +
      `${entry.where ? ` [${entry.where}]` : ""}: ${entry.detail}`);
  }
  if (!validation.ok) {
    console.error("validation failed; nothing was imported");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const { db, executor } = openStore(apply ? dbFile : ":memory:");
  try {
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);

    const plan = await planImport(repositories, mapped);
    console.log("── plan ──");
    console.log(`  create ${plan.create.length}  update ${plan.update.length}` +
      `  unchanged ${plan.unchanged.length}  conflicts ${plan.conflicts.length}`);
    for (const conflict of plan.conflicts) {
      console.log(`  CONFLICT ${conflict.entity} ${conflict.uuid}: ${conflict.reason}`);
      console.log(`    before ${JSON.stringify(conflict.before)}`);
      console.log(`    after  ${JSON.stringify(conflict.after)}`);
    }
    if (plan.conflicts.length && !accept) {
      console.error("verified content would change; re-run with --accept-changes to decide");
      process.exit(3);
    }

    if (!apply) {
      console.log("preview only; pass --apply to write");
      return;
    }

    const written = await applyImport(repositories, mapped);
    console.log("── written ──");
    console.log(JSON.stringify(written));

    const services = createServices(repositories);
    console.log("── verify ──");
    console.log(JSON.stringify(await verifyImport(services, mapped), null, 2));
    console.log(`store: ${dbFile}`);
  } finally {
    db.close();
  }
}

if (process.argv[1]?.endsWith("run-intake.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
