/*
 * Per-entity write policy for the canonical store.
 *
 * The adapter provides safe MECHANISM; this module states what each entity is allowed to
 * do with it. Keeping the two apart is what stops the write path from collapsing into a
 * single `save(anything)` that would let any caller overwrite any row.
 *
 * Three kinds of protection are declared here:
 *
 *   1. APPEND-ONLY HISTORY. A review event, an error event, a spoken attempt and a
 *      quarantine record are statements about something that already happened. They can
 *      be written once and read forever; they cannot be edited or hard-deleted, because
 *      rewriting history is never a legitimate application operation.
 *
 *   2. SRS PROTECTION. review_cards is refused by the generic write surface entirely.
 *      An ease, an interval or a due date may only change through the dedicated
 *      scheduler path, which is explicit at the call site and impossible to reach by
 *      accident while saving something else.
 *
 *   3. PRESERVE-ON-DELETE. Anything a learner earned or recorded is soft-deleted, never
 *      removed, so a mistaken delete stays recoverable.
 *
 * Natural keys are DERIVED FROM THE SCHEMA DDL rather than restated here, so a UNIQUE
 * constraint and the upsert that relies on it cannot drift apart.
 */

import { SCHEMA_STATEMENTS, TABLE_SPECS } from "./schema.js";

/** Rows that record something that already happened. Insert, then read forever. */
export const APPEND_ONLY_ENTITIES = Object.freeze([
  "reviewEvents",
  "errorEvents",
  "errorEventCategories",
  "pronunciationAttempts",
  "quarantine"
]);

/**
 * Entities the generic write surface refuses outright.
 * review_cards carries the SRS state; it changes only through the scheduler path.
 */
export const PROTECTED_ENTITIES = Object.freeze(["reviewCards"]);

/** Learner-owned rows that are soft-deleted rather than removed. */
export const PRESERVE_ON_DELETE_ENTITIES = Object.freeze([
  "profiles", "settings", "reviewCards", "reviewEvents", "quarantine",
  "courseProgress", "lessonProgress", "sectionProgress", "cefrProgress",
  "errorEvents", "errorEventCategories", "errorPatterns",
  "pronunciationAttempts", "reminderSettings", "reminderSchedule"
]);

/* ------------------------------------------------------- derived from DDL */

function parseUniqueKeys() {
  const byTable = new Map();
  for (const statement of SCHEMA_STATEMENTS) {
    const table = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(statement)?.[1];
    if (!table) continue;

    const keys = [];
    // Column-level UNIQUE, e.g. `slug TEXT NOT NULL UNIQUE`.
    for (const match of statement.matchAll(/^\s*(\w+)\s+\w+[^,\n]*\bUNIQUE\b/gm)) {
      keys.push([match[1]]);
    }
    // Table-level UNIQUE(a, b, c).
    for (const match of statement.matchAll(/\bUNIQUE\s*\(([^)]*)\)/g)) {
      keys.push(match[1].split(",").map(part => part.trim()).filter(Boolean));
    }
    byTable.set(table, keys);
  }
  return byTable;
}

const UNIQUE_KEYS_BY_TABLE = parseUniqueKeys();

/** Every UNIQUE key on an entity's table, as column-name arrays. */
export function uniqueKeysFor(entity) {
  const spec = TABLE_SPECS.find(candidate => candidate.entity === entity);
  if (!spec) return [];
  return UNIQUE_KEYS_BY_TABLE.get(spec.table) ?? [];
}

/**
 * The conflict target an upsert should use.
 *
 * `uuid` always works; a natural key is preferred when one exists, because that is what
 * makes an upsert idempotent for the thing it represents — one settings row per profile,
 * one progress row per (learner, lesson), one text per (owner, language, kind) — rather
 * than merely idempotent for a uuid the caller happened to reuse.
 */
export function conflictTargetFor(entity, preferNaturalKey = true) {
  const keys = uniqueKeysFor(entity);
  if (preferNaturalKey && keys.length) {
    // The widest natural key is the most specific identity the schema declares.
    const natural = keys.reduce((widest, key) => (key.length > widest.length ? key : widest), keys[0]);
    if (!(natural.length === 1 && natural[0] === "uuid")) return natural;
  }
  return ["uuid"];
}

/* ------------------------------------------------------------------ policy */

export function policyFor(entity) {
  const spec = TABLE_SPECS.find(candidate => candidate.entity === entity);
  if (!spec) return null;

  const columns = new Set(spec.columns.map(([column]) => column));
  const appendOnly = APPEND_ONLY_ENTITIES.includes(entity);
  const protectedEntity = PROTECTED_ENTITIES.includes(entity);

  return Object.freeze({
    entity,
    table: spec.table,
    protected: protectedEntity,
    appendOnly,
    insert: !protectedEntity,
    update: !protectedEntity && !appendOnly,
    // An upsert is an update in disguise, so it inherits the same restriction.
    upsert: !protectedEntity && !appendOnly && columns.has("uuid"),
    softDelete: !protectedEntity && columns.has("deleted"),
    hardDelete: !protectedEntity && !appendOnly && !PRESERVE_ON_DELETE_ENTITIES.includes(entity),
    hasRevision: columns.has("revision"),
    hasUpdatedAt: columns.has("updated_at"),
    hasDeleted: columns.has("deleted"),
    conflictTarget: conflictTargetFor(entity)
  });
}

/** Thrown when an operation is refused by policy rather than by SQLite. */
export class WritePolicyError extends Error {
  constructor(entity, operation, reason) {
    super(`${operation} is not permitted on ${entity}: ${reason}`);
    this.name = "WritePolicyError";
    this.entity = entity;
    this.operation = operation;
    this.reason = reason;
  }
}

/** Thrown when an optimistic-concurrency update finds a different revision. */
export class RevisionConflictError extends Error {
  constructor(entity, uuid, expectedRevision) {
    super(`${entity} ${uuid} was modified by someone else (expected revision ${expectedRevision})`);
    this.name = "RevisionConflictError";
    this.entity = entity;
    this.uuid = uuid;
    this.expectedRevision = expectedRevision;
  }
}

export function assertAllowed(entity, operation) {
  const policy = policyFor(entity);
  if (!policy) throw new RangeError(`Unknown canonical entity: ${entity}`);

  if (policy.protected) {
    throw new WritePolicyError(entity, operation,
      "SRS state changes only through the scheduler path");
  }
  if (!policy[operation]) {
    const reason = policy.appendOnly
      ? "this is an append-only historical record"
      : operation === "hardDelete"
        ? "learner history is preserved; use softDelete"
        : "not supported by this entity";
    throw new WritePolicyError(entity, operation, reason);
  }
  return policy;
}
