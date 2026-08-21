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
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { buildNetzwerkChapter } from "./map-netzwerk.js";
import { applyImport, planImport, verifyImport } from "./import.js";

export const AUDIT_PATH = "tools/intake/artifacts/netzwerk-audit.json";

/** The reviewed, rights-cleared artifacts the Kapitel slice is built from. */
export const CHAPTER_ARTIFACTS = Object.freeze({
  manifest: "00_PROJECT_CONTROL/NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json",
  structureIndex: "00_PROJECT_CONTROL/NETZWERK_NEU_A2_STRUCTURE_INDEX.json",
  audioAssetIndex: "00_PROJECT_CONTROL/NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json",
  safeSlice: "00_PROJECT_CONTROL/NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json"
});

/** Read the four committed artifacts. JSON only: no PDF or MP3 payload is opened. */
export function loadChapterArtifacts(root = process.cwd()) {
  const read = relative => JSON.parse(fs.readFileSync(path.resolve(root, relative), "utf8"));
  return {
    manifest: read(CHAPTER_ARTIFACTS.manifest),
    structureIndex: read(CHAPTER_ARTIFACTS.structureIndex),
    audioAssetIndex: read(CHAPTER_ARTIFACTS.audioAssetIndex),
    safeSlice: read(CHAPTER_ARTIFACTS.safeSlice)
  };
}

/**
 * Preview, and only then apply, one reviewed Kapitel slice.
 *
 * The order is the point. The diff is computed against the real store before anything
 * is written; validation errors and conflicts stop the run; an unchanged plan skips the
 * write entirely rather than bumping revisions for nothing; and the apply and its
 * verification share ONE transaction, so a batch that cannot be read back afterwards
 * never commits.
 */
export async function runNetzwerkChapter(repositories, built, options = {}) {
  const now = options.now ?? Date.now();
  const profileUuid = options.profileUuid ?? "local";

  if (!built?.validation?.ok || !built.mapped) {
    return {
      applied: false, reason: "validation-failed",
      validation: built?.validation ?? null, plan: null, written: null, verification: null
    };
  }

  const plan = await planImport(repositories, built.mapped);

  if (plan.conflicts.length) {
    // Verified content would change. That is a decision for a person, not an import.
    return { applied: false, reason: "source-conflict", validation: built.validation,
      plan, written: null, verification: null };
  }
  if (!options.apply) {
    return { applied: false, reason: "preview-only", validation: built.validation,
      plan, written: null, verification: null };
  }
  if (plan.isNoop) {
    return { applied: false, reason: "no-changes", validation: built.validation,
      plan, written: null, verification: null };
  }

  return repositories.lifecycle.transaction(async () => {
    const written = await applyImport(repositories, built.mapped, { now });
    const services = createServices(repositories);
    const verification = await verifyImport(services, built.mapped, profileUuid, { repositories });

    // Throwing here rolls the whole batch back: an import that cannot be read back
    // afterwards is not an import.
    if (!verification.ok) {
      const error = new Error("Kapitel import failed verification; rolled back");
      error.verification = verification;
      throw error;
    }
    return { applied: true, reason: null, validation: built.validation, plan, written, verification };
  });
}

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

  /*
   * The reviewed Kapitel slice. It runs BEFORE the full-inventory registration: those
   * two paths write the same 16 audio uuids, and registering first would turn the
   * required 22-create plan into 6 creates plus 16 updates.
   */
  const built = buildNetzwerkChapter({ ...loadChapterArtifacts(), chapter: 2 });
  console.log("── Kapitel 2 slice ──");
  console.log(`  validation ${built.validation.ok ? "ok" : "FAILED"}: ` +
    `${built.validation.errors.length} error(s), ${built.validation.warnings.length} warning(s)`);
  for (const entry of built.validation.errors.slice(0, 10)) {
    console.log(`    ERROR ${entry.code}${entry.where ? ` [${entry.where}]` : ""}: ${entry.detail}`);
  }

  let registration = { created: 0, reused: 0 };
  let chapterRun = null;

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const { db, executor } = openStore(apply ? dbFile : ":memory:");
  try {
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);

    chapterRun = await runNetzwerkChapter(repositories, built, { apply });
    const chapterPlan = chapterRun.plan;
    if (chapterPlan) {
      console.log(`  plan: create ${chapterPlan.create.length} update ${chapterPlan.update.length} ` +
        `unchanged ${chapterPlan.unchanged.length} conflicts ${chapterPlan.conflicts.length}`);
    }
    console.log(`  ${chapterRun.applied ? "applied" : `not applied — ${chapterRun.reason}`}`);
    if (chapterRun.written) console.log(`  written: ${JSON.stringify(chapterRun.written)}`);
    if (chapterRun.verification) {
      const audio = chapterRun.verification.audioAssets;
      console.log(`  verified: course ${chapterRun.verification.course?.slug}, ` +
        `lesson ${chapterRun.verification.lesson?.slug}, ` +
        `audio ${audio.found}/${audio.expected} source-only ${audio.sourceOnly} playable ${audio.playable}`);
    }

    // The remaining inventory keeps its existing registration behaviour; the 16 Kapitel
    // uuids already exist, so they are reused rather than overwritten.
    if (apply && assets.length) {
      registration = await registerAudio(repositories, assets);
      console.log("── audio registration ──");
      console.log(`  registered: ${registration.created} new, ${registration.reused} already present`);
    } else if (!apply) {
      console.log("  preview only; pass --apply to write");
    }
  } finally { db.close(); }

  const audit = {
    generatedAt: Date.now(),
    applied: apply,
    filesDiscovered: inventoryResult.documents.length + (inventoryResult.audio.total ?? 0),
    documents: plan.documents,
    coverage: plan.coverage,
    parserStatus: plan.parserStatus,
    lessonsDiscovered: built.validation.ok ? 1 : 0,
    lessonsImported: chapterRun?.applied ? 1 : 0,
    chapter: {
      chapter: 2,
      validationOk: built.validation.ok,
      errors: built.validation.errors,
      warnings: built.validation.warnings.length,
      summary: built.validation.summary,
      applied: Boolean(chapterRun?.applied),
      reason: chapterRun?.reason ?? null,
      rows: chapterRun?.plan
        ? { create: chapterRun.plan.create.length, update: chapterRun.plan.update.length,
            unchanged: chapterRun.plan.unchanged.length, conflicts: chapterRun.plan.conflicts.length }
        : null,
      verification: chapterRun?.verification ?? null
    },
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
