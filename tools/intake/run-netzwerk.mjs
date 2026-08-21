#!/usr/bin/env node
/*
 * Netzwerk intake.
 *
 *   node tools/intake/run-netzwerk.mjs            # inventory + preview, writes nothing
 *   node tools/intake/run-netzwerk.mjs --apply    # register what is genuinely importable
 *
 * Runs the same gate as every other source: a document is only parsed if its text layer
 * can support the claim "this is what the page says". At the time of writing none of the
 * Netzwerk PDFs can, so no lesson is produced — the audit records why, per document,
 * with the measurements behind the verdict.
 *
 * The audio is a different matter: those files are real and their identity is certain, so
 * they are registered with their true availability. They are NOT attached to any lesson,
 * because nothing in the repository says which lesson a track belongs to.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { inventory, INVENTORY_PATH } from "./netzwerk-inventory.mjs";
import { audioMappingReport, buildNetzwerkAudioAssets } from "./netzwerk-audio.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";

export const AUDIT_PATH = "tools/intake/artifacts/netzwerk-audit.json";

/**
 * Decide, per document, whether a lesson can be produced from it.
 * Pure, so the reasoning is testable without touching a PDF.
 */
export function planNetzwerk(inventoryResult) {
  const documents = inventoryResult.documents.map(document => ({
    path: document.path,
    edition: document.edition,
    level: document.level,
    component: document.component,
    sha256: document.sha256,
    textLayer: document.textLayer.verdict,
    charsPerPage: document.textLayer.charsPerPage,
    suspectRate: document.textLayer.suspectRate,
    decision: document.textLayer.parseable ? "parse" : "blocked-malformed-source",
    reason: document.textLayer.reason
  }));

  const parseable = documents.filter(document => document.decision === "parse");

  /* Richest set per level, judged on evidence rather than on the level's reputation. */
  const byLevel = {};
  for (const document of documents) {
    if (!document.level) continue;
    const key = `${document.edition}:${document.level}`;
    const entry = byLevel[key] ?? { edition: document.edition, level: document.level,
      components: [], parseableComponents: [], audioTracks: 0 };
    entry.components.push(document.component);
    if (document.decision === "parse") entry.parseableComponents.push(document.component);
    byLevel[key] = entry;
  }
  for (const group of inventoryResult.audio.groups) {
    const [level] = group.key.split(":");
    const key = `neu:${level}`;
    if (byLevel[key]) byLevel[key].audioTracks += group.count;
  }

  return {
    documents,
    coverage: Object.values(byLevel),
    lessonsPossible: parseable.length,
    // Stated rather than implied: no parser is written for a layout nobody can read.
    parserStatus: parseable.length
      ? "ready-to-write"
      : "not-written-no-readable-source",
    blocked: documents.filter(document => document.decision !== "parse")
  };
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

/** Register audio assets idempotently. No listening activity is created. */
export async function registerAudio(repositories, assets, options = {}) {
  const now = options.now ?? Date.now();
  let created = 0;
  let reused = 0;

  for (const asset of assets) {
    if (await repositories.audioAssets.exists(asset.uuid)) { reused += 1; continue; }
    await repositories.audioAssets.insert(asset, { now });
    created += 1;
  }
  return { created, reused };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dbIndex = args.indexOf("--db");
  const dbFile = dbIndex === -1 ? "tools/intake/artifacts/intake.db" : args[dbIndex + 1];

  const cached = fs.existsSync(INVENTORY_PATH) && !args.includes("--rescan");
  const inventoryResult = cached
    ? JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"))
    : inventory();

  const plan = planNetzwerk(inventoryResult);

  console.log("── documents ──");
  for (const document of plan.documents) {
    console.log(`  ${path.basename(document.path)}: ${document.edition} ${document.level} ` +
      `${document.component} — ${document.decision} (${document.textLayer}, ` +
      `${document.charsPerPage} chars/page)`);
  }
  console.log("── coverage by level ──");
  for (const entry of plan.coverage) {
    console.log(`  ${entry.edition} ${entry.level}: components ${entry.components.join("+")}, ` +
      `parseable ${entry.parseableComponents.length}, audio ${entry.audioTracks}`);
  }
  console.log(`── parser: ${plan.parserStatus} ──`);
  console.log(`  lessons possible from readable text: ${plan.lessonsPossible}`);

  const assets = buildNetzwerkAudioAssets(inventoryResult.audio.files ?? [], {});
  const mapping = audioMappingReport(inventoryResult.audio.files ?? []);
  console.log("── audio ──");
  console.log(`  discovered ${mapping.discovered}, identified ${mapping.identified}, ` +
    `mapped to lessons ${mapping.mappedToLessons}, unresolved ${mapping.unresolvedMappings}`);

  let registration = { created: 0, reused: 0 };
  if (apply && assets.length) {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    const { db, executor } = openStore(dbFile);
    try {
      const adapter = createSqliteAdapter(executor);
      await adapter.initializeSchema();
      const repositories = createCanonicalRepositories(adapter);
      registration = await registerAudio(repositories, assets);
      console.log(`  registered: ${registration.created} new, ${registration.reused} already present`);
    } finally { db.close(); }
  } else if (!apply) {
    console.log("  preview only; pass --apply to register audio assets");
  }

  const audit = {
    generatedAt: Date.now(),
    applied: apply,
    filesDiscovered: inventoryResult.documents.length + (inventoryResult.audio.total ?? 0),
    documents: plan.documents,
    coverage: plan.coverage,
    parserStatus: plan.parserStatus,
    lessonsDiscovered: 0,
    lessonsImported: 0,
    lessonsQuarantined: plan.blocked.map(document => ({
      path: document.path, decision: document.decision, reason: document.reason
    })),
    rows: { created: registration.created, reused: registration.reused, updated: 0 },
    audio: { ...mapping, registeredAssets: assets.length, ...registration },
    duplicates: inventoryResult.duplicates,
    findings: plan.blocked.map(document => ({
      path: document.path, kind: "malformed-source",
      verdict: document.textLayer, reason: document.reason
    })),
    digests: Object.fromEntries(plan.documents.map(document => [document.path, document.sha256]))
  };

  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(`audit -> ${AUDIT_PATH}`);
}

if (process.argv[1]?.endsWith("run-netzwerk.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
