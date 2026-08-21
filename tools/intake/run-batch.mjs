#!/usr/bin/env node
/*
 * Controlled batch intake.
 *
 *   node tools/intake/run-batch.mjs                 # preview everything, write nothing
 *   node tools/intake/run-batch.mjs --apply         # preview all, then import what qualifies
 *   node tools/intake/run-batch.mjs --template nicos-weg
 *
 * Candidates come from discovery, not from a path list in this file. Every candidate is
 * previewed before any of them is applied, and the audit is written whether or not
 * anything was imported — a batch that imported nothing is still a result worth keeping.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { discover, TEMPLATES } from "./discover.js";
import { runBatch } from "./batch.js";
import { verifyImport } from "./import.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";

export const AUDIT_PATH = "tools/intake/artifacts/batch-audit.json";

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
  const templateIndex = args.indexOf("--template");
  const templateId = templateIndex === -1 ? null : args[templateIndex + 1];
  const dbIndex = args.indexOf("--db");
  const dbFile = dbIndex === -1 ? "tools/intake/artifacts/intake.db" : args[dbIndex + 1];

  const templates = templateId ? TEMPLATES.filter(t => t.id === templateId) : TEMPLATES;
  const discovery = discover({ templates });

  console.log("── discovery ──");
  console.log(`  ${discovery.files.length} document(s) scanned, ` +
    `${discovery.candidates.length} lesson candidate(s)`);
  for (const candidate of discovery.candidates) {
    console.log(`  ${candidate.lessonKey}  roles: ${Object.keys(candidate.sources).join("+")}` +
      `${candidate.importable ? "" : `  (missing ${candidate.missingRoles.join(", ")})`}`);
  }
  for (const file of discovery.unrecognised) {
    console.log(`  unrecognised: ${file.path} (${file.reason})`);
  }

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const { db, executor } = openStore(apply ? dbFile : ":memory:");
  try {
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);

    const { previews, applied, audit } = await runBatch(repositories, { apply, discovery });

    console.log("── preview ──");
    for (const preview of previews) {
      const plan = preview.plan;
      console.log(`  ${preview.lessonKey}: ${preview.decision}` +
        (plan ? `  create ${plan.create.length} update ${plan.update.length} ` +
          `unchanged ${plan.unchanged.length} conflicts ${plan.conflicts.length}` : "") +
        (preview.reason ? `  — ${preview.reason}` : ""));
      if (preview.reuse?.reused) {
        console.log(`    vocabulary reused ${preview.reuse.reused}, new ${preview.reuse.created}`);
      }
    }

    if (apply) {
      console.log("── applied ──");
      for (const entry of applied) console.log(`  ${entry.lessonKey}: ${JSON.stringify(entry.written)}`);

      const services = createServices(repositories);
      console.log("── verify ──");
      for (const preview of previews.filter(p => p.decision === "import")) {
        const report = await verifyImport(services, preview.mapped);
        console.log(`  ${preview.lessonKey}: ` +
          `lessons ${report.lessons}, items ${report.lesson?.items ?? 0}, ` +
          `segments ${report.listening?.segments ?? 0}, ` +
          `exercises ${report.exercises.total} (${report.exercises.gradeable} gradeable), ` +
          `english missing: ${report.englishMissing}`);
      }
    } else {
      console.log("preview only; pass --apply to write");
    }

    fs.writeFileSync(path.resolve(AUDIT_PATH), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
    console.log(`audit -> ${AUDIT_PATH}`);
  } finally {
    db.close();
  }
}

if (process.argv[1]?.endsWith("run-batch.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
