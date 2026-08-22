#!/usr/bin/env node
/*
 * Import the open-licensed A2 lesson through the production intake path.
 *
 * Same sequence as every other intake, and for the same reason: the preview is the last
 * point at which a mistake costs nothing.
 *
 *   parse -> validate -> map -> plan (preview) -> apply -> verify
 *
 * Nothing is written unless `--apply` is given, a conflict refuses the whole batch, and
 * the apply and its verification share ONE transaction, so a batch that cannot be read
 * back afterwards is rolled back rather than left half-trusted.
 *
 *   node tools/intake/run-open-content.mjs [--apply] [--db <file>] [--json <artifact>]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { applyImport, planImport, verifyImport } from "./import.js";
import { buildOpenContentLesson } from "./map-open-content.js";

/** The manifest that lists the curriculum, in the order it is taught. */
export const CURRICULUM_MANIFEST = "00_PROJECT_CONTROL/A2_COMPLETE_CONTENT_MANIFEST.json";

export function readManifest(file = CURRICULUM_MANIFEST) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), "utf8"));
}

/**
 * Every open-content artifact, in the order it should be imported.
 *
 * Read from the manifest rather than listed here, so adding a lesson is a content change
 * and not a code change, and so the import order is the curriculum order a learner meets.
 * Later lessons reuse the course, level and course titles the first one created; running
 * them out of order would still work — the rows are identical and the diff reports them
 * unchanged — but reading the audits in teaching order is easier for a reviewer.
 *
 * The two standalone artifacts this list used to name are SUPERSEDED: the manifest's
 * lessons 2 and 3 carry the same course, unit and lesson identities, so importing both
 * sets would not duplicate anything, it would simply import the same lessons twice from
 * an older build.
 */
export const OPEN_CONTENT_ARTIFACTS = Object.freeze(
  readManifest().lessons
    .slice()
    .sort((a, b) => a.curriculumOrder - b.curriculumOrder)
    .map(lesson => lesson.datasetPath)
);

export const DEFAULT_ARTIFACT = OPEN_CONTENT_ARTIFACTS[0];

export function readArtifact(file = DEFAULT_ARTIFACT) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), "utf8"));
}

/**
 * Preview, and apply only when asked.
 *
 * @param {object} repositories canonical repositories
 * @param {object} built result of buildOpenContentLesson()
 * @param {object} [options] { apply, now, profileUuid }
 */
export async function runOpenContent(repositories, built, options = {}) {
  const now = options.now ?? Date.now();
  const profileUuid = options.profileUuid ?? "local";
  const plan = await planImport(repositories, built.mapped);

  if (plan.conflicts.length) {
    return { applied: false, reason: "conflicts", plan, audit: built.audit,
      written: null, verification: null };
  }
  if (!options.apply) {
    return { applied: false, reason: "preview-only", plan, audit: built.audit,
      written: null, verification: null };
  }
  if (plan.isNoop) {
    // Already imported and unchanged. Writing would only move revisions and timestamps.
    return { applied: false, reason: "no-changes", plan, audit: built.audit,
      written: null, verification: null };
  }

  return repositories.lifecycle.transaction(async () => {
    const written = await applyImport(repositories, built.mapped, { now, plan });
    const services = createServices(repositories);
    const verification = await verifyImport(services, built.mapped, profileUuid, { repositories });

    // Throwing here rolls the whole batch back: an import that cannot be read back the
    // way a learner would read it has not really landed.
    if (!verification.ok) {
      throw new Error(`open-content import could not be verified: ${JSON.stringify(verification)}`);
    }
    return { applied: true, reason: null, plan, audit: built.audit, written, verification };
  });
}

function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  return {
    db,
    executor: {
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
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const apply = args.includes("--apply");
  const dbFile = path.resolve(process.cwd(), value("--db", "tools/intake/artifacts/intake.db"));
  const chosen = args.includes("--json") ? [value("--json")] : OPEN_CONTENT_ARTIFACTS;

  const store = openStore(dbFile);
  try {
    const adapter = createSqliteAdapter(store.executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);
    for (const artifact of chosen) {
      console.log(`
════ ${artifact} ════`);
      await importOne(repositories, artifact, apply);
    }
  } finally {
    store.db.close();
  }
  console.log(`store: ${dbFile.split(path.sep).join("/")}`);
}

async function importOne(repositories, artifact, apply) {
  const built = buildOpenContentLesson({ dataset: readArtifact(artifact), now: Date.now() });

  console.log("── licence ──");
  console.log(`  ${built.audit.licence} — ${built.audit.licenceUrl}`);
  for (const text of built.audit.attributionTexts) console.log(`  ${text}`);
  console.log(`  changes: ${built.audit.changesNotice}`);
  console.log(`  CEFR: ${built.audit.cefrAssignment?.status} ` +
    `(no source level claim: ${built.audit.cefrAssignment?.noSourceLevelClaim})`);

  console.log("── review gate ──");
  console.log(`  published ${built.audit.review.publishedRows} rows, ` +
    `held as draft ${built.audit.review.draftRows} rows, ` +
    `links withheld ${built.audit.review.withheldLinks}`);
  console.log(`  draft by entity: ${JSON.stringify(built.audit.review.draftByEntity)}`);

  {
    const result = await runOpenContent(repositories, built, { apply });

    console.log("── plan ──");
    console.log(`  create ${result.plan.create.length}  update ${result.plan.update.length}` +
      `  unchanged ${result.plan.unchanged.length}  conflicts ${result.plan.conflicts.length}`);
    for (const conflict of result.plan.conflicts) {
      console.log(`  CONFLICT ${conflict.entity} ${conflict.uuid}: ${conflict.reason}`);
    }

    if (!result.applied) {
      console.log(`  not applied: ${result.reason}`);
      if (result.reason === "conflicts") process.exit(3);
      return;
    }

    console.log("── written ──");
    console.log(`  ${JSON.stringify(result.written)}`);
    console.log("── verify ──");
    const verification = result.verification;
    console.log(`  course ${verification.course?.slug}, lesson ${verification.lesson?.slug}, ` +
      `items ${verification.lesson?.items}`);
    console.log(`  exercises ${verification.exercises.total}/${verification.exercises.claimed} ` +
      `(${verification.exercises.gradeable} gradeable)`);
    console.log(`  listening ${verification.listening?.slug ?? "none"} ` +
      `segments ${verification.listening?.segments ?? 0} ` +
      `audio issue: ${verification.listening?.audioIssue ?? "n/a"}`);
    console.log(`  drafts stored ${verification.drafts.stored}/${verification.drafts.rows}, ` +
      `visible to a learner: ${verification.drafts.visible.length}`);
    console.log(`  links ${verification.links.found}/${verification.links.expected}`);
    console.log(`  ok: ${verification.ok}`);
  }
}

if (process.argv[1]?.endsWith("run-open-content.mjs")) {
  await main();
}
