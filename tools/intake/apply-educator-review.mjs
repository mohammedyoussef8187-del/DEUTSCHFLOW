#!/usr/bin/env node
/*
 * Apply a completed educator review to the canonical store.
 *
 * This is the other half of the review gate, and deliberately the smallest half. The
 * queue (`open-content-audit.json`) says which rows a person had to look at; the
 * decisions file says what they decided. This applies those decisions and nothing else.
 *
 * It invents no lifecycle rule. A `VERIFY` decision moves one row from `draft` to
 * `verified` through the SAME repository write API the app uses, which is what already
 * makes a row visible to the published view every service reads through. The row's uuid,
 * its text, its licence and its provenance are not touched — approval is a status change,
 * not an edit.
 *
 * What it refuses, rather than interpreting:
 *
 *   - a decisions file naming a row that is neither queued nor in the store. A review of
 *     content that is not here is not a review of THIS content.
 *   - `CORRECT`, because a correction is a change to the text and belongs in the source
 *     artifact, where provenance and the diff are visible — not in a bulk status update.
 *   - `GATE`, because that is a reviewer saying "not yet"; acting on it would be the
 *     opposite of what they decided.
 *
 *   node tools/intake/apply-educator-review.mjs [--apply] [--db <file>] [--decisions <file>]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { DRAFT_STATUS } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import { repositoryFor } from "./import.js";

export const DECISIONS_FILE = "tools/intake/artifacts/educator_review_decisions.json";
export const QUEUE_FILE = "tools/intake/artifacts/open-content-audit.json";

/** The status a reviewed row moves to. The lifecycle already defines it. */
export const VERIFIED_STATUS = "verified";

/** Decisions this tool is allowed to act on, and what each means. */
export const ACTIONS = Object.freeze({
  VERIFY: "approved; publish through the normal lifecycle",
  CORRECT: "the text must change; belongs in the source artifact, not here",
  GATE: "the reviewer withheld it; leave it withheld"
});

const readJson = file => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), "utf8"));

/**
 * Check the decisions against the content they claim to be a review of.
 *
 * Every failure here is a refusal, never a repair: a decisions file that does not line up
 * with the queue and the store is evidence that something moved between review and
 * integration, and the only safe response is to stop and say so.
 */
export function validateDecisions(decisions, queue, stored = null) {
  const errors = [];
  const rows = decisions?.decisions;
  if (!Array.isArray(rows)) {
    return { ok: false, errors: [{ code: "decisions-not-an-array", detail: typeof rows }] };
  }

  const seen = new Set();
  const tally = {};
  for (const [index, row] of rows.entries()) {
    const where = `decisions[${index}]`;
    if (!row.uuid) errors.push({ code: "decision-without-uuid", detail: "", where });
    else if (seen.has(row.uuid)) errors.push({ code: "duplicate-uuid", detail: row.uuid, where });
    seen.add(row.uuid);

    if (!(row.action in ACTIONS)) {
      errors.push({ code: "unknown-action", detail: String(row.action), where });
    }
    tally[row.action] = (tally[row.action] ?? 0) + 1;
  }

  /*
   * Every decision must name a real row of THIS content — either one still waiting in the
   * queue, or one already in the store.
   *
   * Both halves are needed. Checking only the queue would refuse a review the moment the
   * queue empties, which is exactly what a completed review causes: the import publishes
   * the approved rows, the queue drops to zero, and the decisions that emptied it would
   * then look like decisions about content that no longer exists. Checking the store is
   * the stronger test anyway — it asks whether the row is really there, not whether a
   * derived file still lists it.
   */
  const queued = new Map(queue.map(entry => [entry.uuid, entry]));
  for (const row of rows) {
    const entry = queued.get(row.uuid);
    const known = stored?.get(row.uuid) ?? null;
    if (!entry && !known) {
      errors.push({ code: "decision-matches-no-row", detail: row.uuid });
      continue;
    }
    // The reviewer's row and ours must be the same row, not just the same id.
    const entity = entry?.entity ?? known?.entity;
    if (row.entity && entity && row.entity !== entity) {
      errors.push({ code: "entity-mismatch", detail: `${row.uuid}: ${row.entity} vs ${entity}` });
    }
  }
  // Anything still queued must have been decided; an empty queue satisfies this trivially.
  for (const uuid of queued.keys()) {
    if (!seen.has(uuid)) errors.push({ code: "queue-row-without-decision", detail: uuid });
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: { decisions: rows.length, unique: seen.size, queue: queued.size, byAction: tally }
  };
}

/**
 * Apply the approvals.
 *
 * One transaction: a partially applied review would leave the store in a state no reviewer
 * ever approved. A row already at `verified` is counted as such and left alone, so running
 * this twice changes nothing the second time.
 */
export async function applyEducatorReview(repositories, decisions, options = {}) {
  const now = options.now ?? Date.now();
  const reviewer = options.reviewer ?? decisions.metadata?.reviewer ?? "educator";
  const rows = decisions.decisions;

  const report = {
    verified: 0, alreadyVerified: 0, skipped: { CORRECT: 0, GATE: 0 },
    missing: [], byEntity: {}, reviewer
  };

  await repositories.lifecycle.transaction(async () => {
    for (const row of rows) {
      if (row.action !== "VERIFY") {
        report.skipped[row.action] = (report.skipped[row.action] ?? 0) + 1;
        continue;
      }

      const repository = repositoryFor(repositories, row.entity);
      const stored = await repository.get(row.uuid);
      if (!stored) { report.missing.push({ entity: row.entity, uuid: row.uuid }); continue; }
      if (stored.contentStatus === VERIFIED_STATUS) { report.alreadyVerified += 1; continue; }

      /* Only the lifecycle columns move. The text, the licence and the citation that made
         this row reviewable in the first place are exactly as the reviewer saw them. */
      await repository.update(row.uuid, {
        contentStatus: VERIFIED_STATUS,
        verifiedAt: now,
        verifiedBy: reviewer
      }, { now });

      report.verified += 1;
      report.byEntity[row.entity] = (report.byEntity[row.entity] ?? 0) + 1;
    }
  });

  return report;
}

/** What is still held back, by entity, after an apply. */
export async function countDrafts(repositories, entities) {
  const counts = {};
  let total = 0;
  for (const entity of entities) {
    const n = await repositoryFor(repositories, entity).count({ contentStatus: DRAFT_STATUS });
    if (n) counts[entity] = n;
    total += n;
  }
  return { total, byEntity: counts };
}

function openStore(file) {
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
  const decisions = readJson(value("--decisions", DECISIONS_FILE));
  const queue = readJson(value("--queue", QUEUE_FILE)).educatorReview.queue;

  console.log("── decisions ──");
  console.log(`  reviewer: ${decisions.metadata?.reviewer ?? "(unstated)"}`);

  /* Which of the decided rows the store actually holds, so correspondence can be checked
     against reality rather than only against the derived queue file. */
  const entities = [...new Set([...queue.map(e => e.entity), ...decisions.decisions.map(e => e.entity)])]
    .filter(Boolean);
  const store = openStore(dbFile);
  const stored = new Map();
  try {
    const adapter = createSqliteAdapter(store.executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);
    for (const entity of entities) {
      for (const row of await repositoryFor(repositories, entity).all()) {
        stored.set(row.uuid, { entity, contentStatus: row.contentStatus });
      }
    }
  } finally {
    store.db.close();
  }

  const validation = validateDecisions(decisions, queue, stored);
  console.log(`  ${validation.counts.decisions} decisions, ${validation.counts.unique} unique, ` +
    `queue ${validation.counts.queue}`);
  console.log(`  by action: ${JSON.stringify(validation.counts.byAction)}`);

  if (!validation.ok) {
    console.error("── refused ──");
    for (const error of validation.errors.slice(0, 20)) {
      console.error(`  ${error.code}: ${error.detail ?? ""} ${error.where ?? ""}`);
    }
    console.error(`  ${validation.errors.length} problem(s); nothing was applied`);
    process.exit(3);
  }
  console.log("  validation: ok");

  if (!apply) {
    console.log("preview only; pass --apply to write");
    return;
  }

  const applyStore = openStore(dbFile);
  try {
    const adapter = createSqliteAdapter(applyStore.executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);

    const before = await countDrafts(repositories, entities);
    const report = await applyEducatorReview(repositories, decisions);
    const after = await countDrafts(repositories, entities);

    console.log("── applied ──");
    console.log(`  verified ${report.verified}, already verified ${report.alreadyVerified}, ` +
      `missing ${report.missing.length}`);
    console.log(`  by entity: ${JSON.stringify(report.byEntity)}`);
    console.log(`  drafts before ${before.total} -> after ${after.total}`);
    if (after.total) console.log(`  still held back: ${JSON.stringify(after.byEntity)}`);
    if (report.missing.length) {
      console.log(`  NOT FOUND in the store: ${JSON.stringify(report.missing.slice(0, 10))}`);
    }
  } finally {
    applyStore.db.close();
  }
  console.log(`store: ${dbFile.split(path.sep).join("/")}`);
}

if (process.argv[1]?.endsWith("apply-educator-review.mjs")) {
  await main();
}
