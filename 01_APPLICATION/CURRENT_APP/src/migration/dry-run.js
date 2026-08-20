/*
 * Read-only migration dry-run.
 *
 *   READ CURRENT DATA -> VALIDATE -> TRANSFORM -> VALIDATE CANONICAL RESULT -> REPORT
 *
 * The source is treated as strictly read-only: this module never writes to, deletes, or
 * repairs the source, never switches persistence, and never touches educational content.
 * When a SQLite verification target is supplied it must be an isolated temporary
 * database; the write/read check there exists only to prove the canonical result loads
 * and reads back intact.
 *
 * Reports carry counts, identities, and field names only. Learner study content
 * (answers, translations, sentences) is never placed in the report.
 */

import { validateBackup } from "../data/backup.js";
import { CONSUMED_FIELDS, migrateToCanonical } from "./canonical-migration.js";

/**
 * @param {object} snapshot { words, cards, attempts, settings, profile } read from source
 * @param {object} [options]
 *   now            fixed timestamp for deterministic output
 *   sqliteAdapter  optional isolated SQLite adapter used for a write/read-back check
 */
export async function runMigrationDryRun(snapshot, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();

  // --- 1. VALIDATE SOURCE ---------------------------------------------------
  const sourceValidation = validateBackup({
    app: "DeutschFlow",
    schemaVersion: options.schemaVersion ?? 6,
    exportedAt: now,
    words: snapshot.words ?? [],
    cards: snapshot.cards ?? [],
    attempts: snapshot.attempts ?? [],
    settings: snapshot.settings ?? null,
    profile: snapshot.profile ?? null
  });

  // --- 2. TRANSFORM ---------------------------------------------------------
  const { dataset, report } = migrateToCanonical(snapshot, { now });

  // --- 3. VALIDATE CANONICAL RESULT ----------------------------------------
  const unmapped = detectUnmappedFields(snapshot);
  const srsParity = compareSrsState(snapshot.cards ?? [], dataset.reviewCards, dataset.quarantine);
  const relationships = checkRelationships(dataset);

  let sqliteCheck = null;
  if (options.sqliteAdapter) {
    sqliteCheck = await verifyAgainstSqlite(options.sqliteAdapter, dataset);
  }

  // --- 4. RISK ASSESSMENT ---------------------------------------------------
  const risks = [];
  if (!sourceValidation.ok) {
    risks.push({ severity: "blocking", reason: "source-validation-failed", detail: sourceValidation.errors });
  }
  if (unmapped.length) {
    risks.push({ severity: "blocking", reason: "unmapped-source-fields", detail: unmapped });
  }
  // SRS field values must never differ. A card that is quarantined rather than active is
  // reported separately below, since its state is preserved, not altered.
  if (srsParity.mismatchCount > 0) {
    risks.push({ severity: "blocking", reason: "srs-state-mismatch", detail: srsParity.mismatchCount });
  }
  if (srsParity.lostCards > 0) {
    risks.push({ severity: "blocking", reason: "srs-cards-would-be-lost", detail: srsParity.lostCards });
  }
  if (!relationships.ok) {
    risks.push({ severity: "blocking", reason: "relationship-integrity-failed", detail: relationships });
  }

  // Anything quarantined WITHOUT preservation would be lost by a switch: that blocks.
  const unpreserved = report.quarantine.filter(q => q.preserved === false && q.entity !== "vocabulary_meaning");
  if (unpreserved.length) {
    risks.push({ severity: "blocking", reason: "records-would-be-lost", detail: unpreserved.length });
  }

  const quarantinedCards = report.quarantine.filter(q => q.entity === "review_card");
  if (quarantinedCards.length) {
    risks.push({
      severity: "review",
      reason: "srs-cards-quarantined-not-active",
      detail: quarantinedCards.length,
      note: "preserved verbatim in migration_quarantine; not scheduled for review"
    });
  }
  const quarantinedEvents = report.quarantine.filter(q => q.entity === "review_event");
  if (quarantinedEvents.length) {
    risks.push({
      severity: "review",
      reason: "review-history-quarantined",
      detail: quarantinedEvents.length,
      note: "preserved verbatim in migration_quarantine"
    });
  }
  const quarantinedItems = report.quarantine.filter(q => q.entity === "vocabulary_item");
  if (quarantinedItems.length) {
    risks.push({ severity: "review", reason: "vocabulary-items-quarantined", detail: quarantinedItems.length });
  }
  const missingMeanings = report.quarantine.filter(q => q.entity === "vocabulary_meaning").length;
  if (missingMeanings) {
    risks.push({ severity: "info", reason: "items-without-a-meaning", detail: missingMeanings });
  }
  if (sqliteCheck && !sqliteCheck.ok) {
    risks.push({ severity: "blocking", reason: "sqlite-round-trip-failed", detail: sqliteCheck.mismatchedEntities });
  }

  const blocking = risks.filter(r => r.severity === "blocking");

  return {
    generatedAt: now,
    sourceValidation,
    sourceCounts: report.source,
    canonicalCounts: report.counts,
    srsParity,
    relationships,
    sqliteCheck,
    quarantine: summarizeQuarantine(report.quarantine),
    warnings: summarizeWarnings(report.warnings),
    unmapped,
    risks,
    // The dry-run only reports. Switching persistence stays a separate, approved step.
    switchAppearsSafe: blocking.length === 0,
    sourceModified: false
  };
}

/** Fields present in the source but not read by the transform: silent-loss candidates. */
export function detectUnmappedFields(snapshot) {
  const findings = [];
  for (const [collection, consumed] of Object.entries(CONSUMED_FIELDS)) {
    const records = collection === "profile"
      ? (snapshot.profile ? [snapshot.profile] : [])
      : (snapshot[collection] ?? []);
    const seen = new Map();
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      for (const key of Object.keys(record)) {
        if (consumed.includes(key)) continue;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    for (const [field, count] of seen) findings.push({ collection, field, records: count });
  }
  return findings;
}

/**
 * Every source card must survive with identical SRS state, either as an active review
 * card or preserved verbatim in quarantine. A card present in neither is data loss.
 */
export function compareSrsState(sourceCards, canonicalCards, quarantineRows = []) {
  const byLegacyKey = new Map(canonicalCards.map(card => [card.legacyKey, card]));
  const quarantinedIds = new Set(
    quarantineRows.filter(row => row.entity === "review_card").map(row => String(row.sourceId))
  );
  const fields = [
    ["state", "state"], ["dueAt", "dueAt"], ["intervalDays", "intervalDays"],
    ["ease", "ease"], ["reps", "reps"], ["lapses", "lapses"], ["streak", "streak"],
    ["mastery", "mastery"], ["lastReviewedAt", "lastReviewedAt"],
    ["correct", "correct"], ["wrong", "wrong"], ["stability", "stability"],
    ["difficulty", "difficulty"], ["lastResult", "lastResult"]
  ];
  const mismatches = [];
  let quarantined = 0;
  let lost = 0;

  for (const source of sourceCards) {
    const target = byLegacyKey.get(String(source?.key));
    if (!target) {
      if (quarantinedIds.has(String(source?.key))) quarantined++;
      else lost++;
      continue;
    }
    for (const [sourceField, targetField] of fields) {
      const a = source[sourceField] ?? null;
      const b = target[targetField] ?? null;
      if (a !== b) mismatches.push({ card: String(source.key), field: sourceField });
    }
    if (Boolean(source.suspended) !== Boolean(target.suspended)) {
      mismatches.push({ card: String(source.key), field: "suspended" });
    }
  }

  return {
    identical: mismatches.length === 0 && lost === 0,
    sourceCards: sourceCards.length,
    activeCards: canonicalCards.length,
    quarantinedCards: quarantined,
    lostCards: lost,
    mismatches: mismatches.slice(0, 50),
    mismatchCount: mismatches.length
  };
}

function checkRelationships(dataset) {
  const vocabUuids = new Set(dataset.vocabularyItems.map(v => v.uuid));
  const meaningUuids = new Set(dataset.vocabularyMeanings.map(m => m.uuid));
  const cardUuids = new Set(dataset.reviewCards.map(c => c.uuid));

  const orphanMeanings = dataset.vocabularyMeanings.filter(m => !vocabUuids.has(m.vocabUuid)).length;
  const orphanAnswers = dataset.acceptedAnswers.filter(a => !meaningUuids.has(a.meaningUuid)).length;
  const orphanCards = dataset.reviewCards.filter(c => !vocabUuids.has(c.vocabUuid)).length;
  const orphanEvents = dataset.reviewEvents.filter(e => !cardUuids.has(e.cardUuid)).length;
  const duplicateCardIdentity = dataset.reviewCards.length -
    new Set(dataset.reviewCards.map(c => `${c.profileUuid}|${c.vocabUuid}|${c.skill}`)).size;

  return {
    ok: orphanMeanings === 0 && orphanAnswers === 0 && orphanCards === 0 &&
        orphanEvents === 0 && duplicateCardIdentity === 0,
    orphanMeanings, orphanAnswers, orphanCards, orphanEvents, duplicateCardIdentity
  };
}

/** Load into an isolated SQLite target and read back, proving the result persists intact. */
async function verifyAgainstSqlite(adapter, dataset) {
  await adapter.initializeSchema();
  await adapter.importCanonical(dataset);
  const readBack = await adapter.readCanonical();
  const integrity = await adapter.verifyIntegrity();

  const mismatchedEntities = [];
  for (const entity of Object.keys(dataset)) {
    const a = sortByUuid(dataset[entity]);
    const b = sortByUuid(readBack[entity] ?? []);
    if (a.length !== b.length) { mismatchedEntities.push({ entity, reason: "count" }); continue; }
    for (let i = 0; i < a.length; i++) {
      if (!shallowEqual(a[i], b[i])) { mismatchedEntities.push({ entity, reason: "field-mismatch" }); break; }
    }
  }
  return {
    ok: mismatchedEntities.length === 0 && integrity.ok,
    integrity,
    mismatchedEntities
  };
}

function summarizeQuarantine(quarantine) {
  const byReason = new Map();
  for (const record of quarantine) {
    const key = `${record.entity}:${record.reasons.join("+")}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  return {
    total: quarantine.length,
    // Identity only; the quarantined record itself stays out of the report.
    byReason: Object.fromEntries(byReason),
    sampleIds: quarantine.slice(0, 10).map(q => ({ entity: q.entity, sourceId: q.sourceId, reasons: q.reasons }))
  };
}

function summarizeWarnings(warnings) {
  const byReason = new Map();
  for (const warning of warnings) {
    byReason.set(warning.reason, (byReason.get(warning.reason) ?? 0) + 1);
  }
  return { total: warnings.length, byReason: Object.fromEntries(byReason) };
}

function sortByUuid(rows) {
  return [...rows].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}

function shallowEqual(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key] ?? null;
    const right = b[key] ?? null;
    if (left !== right) return false;
  }
  return true;
}
