/*
 * Canonical SQLite persistence adapter (platform-neutral).
 *
 * Contains no direct binding to any SQLite driver. It is driven by an injected async
 * executor so the same code runs against `node:sqlite` (tests) and
 * `@capacitor-community/sqlite` (device) without change. This is the single boundary
 * where SQL is issued; the SRS engine, evaluator, grammar/course logic, and UI must
 * reach it only through the repository layer, never directly (DECISION_LOG DF-010).
 *
 * Executor contract (all methods return promises):
 *   exec(sql)            -> run one or more DDL statements
 *   run(sql, params[])   -> parameterized write
 *   all(sql, params[])   -> parameterized read, resolves to an array of row objects
 *   transaction(fn)      -> run async fn inside BEGIN/COMMIT, ROLLBACK on throw
 *   pragma(name, value?) -> read (value omitted) or set a PRAGMA
 *
 * Beyond the bulk migration import, this adapter offers INCREMENTAL operations so the
 * canonical model can be a real application store rather than a read-only snapshot.
 * Every one of them is entity-scoped: the entity name is resolved to a TABLE_SPEC, and
 * only columns that spec declares are ever written or filtered on. A column name that
 * is not in the spec is rejected rather than interpolated, and every VALUE is bound as
 * a parameter, so no caller-supplied string can reach the SQL text.
 *
 * What each entity may do is not decided here — see write-policy.js. Append-only
 * history cannot be edited, learner-owned rows are soft-deleted rather than removed,
 * and review_cards is refused outright so SRS state can only move through the
 * scheduler path.
 */

import { SCHEMA_STATEMENTS, SCHEMA_VERSION, TABLE_SPECS } from "./schema.js";
import { RevisionConflictError, assertAllowed, policyFor } from "./write-policy.js";

const SPEC_BY_ENTITY = new Map(TABLE_SPECS.map(spec => [spec.entity, spec]));

export function createSqliteAdapter(executor) {
  if (!executor) throw new TypeError("A SQLite executor is required");

  async function initializeSchema() {
    for (const statement of SCHEMA_STATEMENTS) {
      await executor.exec(statement);
    }
    await executor.pragma("user_version", SCHEMA_VERSION);
    return SCHEMA_VERSION;
  }

  async function schemaVersion() {
    const value = await executor.pragma("user_version");
    return Number(value);
  }

  function rowFromRecord(spec, record) {
    return spec.columns.map(([, field]) => normalizeWrite(record[field]));
  }

  function recordFromRow(spec, row) {
    const out = {};
    for (const [column, field] of spec.columns) out[field] = row[column];
    return out;
  }

  async function insertMany(spec, records) {
    if (!records || !records.length) return;
    const cols = spec.columns.map(([column]) => column);
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${spec.table} (${cols.join(", ")}) VALUES (${placeholders})`;
    for (const record of records) {
      await executor.run(sql, rowFromRecord(spec, record));
    }
  }

  // Write the entire canonical dataset atomically (all-or-nothing).
  async function importCanonical(dataset) {
    await executor.transaction(async () => {
      for (const spec of TABLE_SPECS) {
        await insertMany(spec, dataset[spec.entity]);
      }
    });
  }

  /* ------------------------------------------------ incremental writes --- */

  function specFor(entity) {
    const spec = SPEC_BY_ENTITY.get(entity);
    if (!spec) throw new RangeError(`Unknown canonical entity: ${entity}`);
    return spec;
  }

  /** Map a record's declared fields to columns. Unknown fields are refused, not ignored. */
  function columnsForFields(spec, record, { strict = true } = {}) {
    const byField = new Map(spec.columns.map(([column, field]) => [field, column]));
    const pairs = [];
    for (const [field, value] of Object.entries(record ?? {})) {
      const column = byField.get(field);
      if (!column) {
        if (strict) throw new RangeError(`Unknown field for ${spec.entity}: ${field}`);
        continue;
      }
      pairs.push([column, normalizeWrite(value)]);
    }
    return pairs;
  }

  function stamp(spec, record, now) {
    const policy = policyFor(spec.entity);
    const out = { ...record };
    if (policy.hasUpdatedAt && out.updatedAt === undefined) out.updatedAt = now;
    if (out.createdAt === undefined && spec.columns.some(([c]) => c === "created_at")) {
      out.createdAt = now;
    }
    if (policy.hasRevision && out.revision === undefined) out.revision = 1;
    if (policy.hasDeleted && out.deleted === undefined) out.deleted = 0;
    return out;
  }

  /** Insert one record. Fails loudly on a duplicate uuid or a violated constraint. */
  async function insert(entity, record, options = {}) {
    const spec = specFor(entity);
    assertAllowed(entity, "insert");
    const now = options.now ?? Date.now();
    const pairs = columnsForFields(spec, stamp(spec, record, now));
    if (!pairs.length) throw new RangeError(`Nothing to insert for ${entity}`);

    const sql = `INSERT INTO ${spec.table} (${pairs.map(([c]) => c).join(", ")}) ` +
      `VALUES (${pairs.map(() => "?").join(", ")})`;
    await executor.run(sql, pairs.map(([, value]) => value));
    return record.uuid ?? null;
  }

  /** Insert several records of one entity, inside the caller's transaction if any. */
  async function insertAll(entity, records, options = {}) {
    let written = 0;
    for (const record of records ?? []) {
      await insert(entity, record, options);
      written += 1;
    }
    return written;
  }

  /**
   * Update one row by uuid.
   *
   * `revision` and `updated_at` are advanced by the adapter rather than by the caller,
   * so a caller cannot forget to and leave two writers indistinguishable. Passing
   * `expectedRevision` turns the write into an optimistic-concurrency check: a row that
   * moved underneath is reported instead of being silently overwritten.
   */
  async function update(entity, uuid, changes, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "update");
    const now = options.now ?? Date.now();

    const proposed = { ...changes };
    delete proposed.uuid;                  // identity is not a mutable field
    delete proposed.createdAt;             // nor is when it first existed
    delete proposed.revision;              // the adapter owns this
    if (policy.hasUpdatedAt) proposed.updatedAt = options.updatedAt ?? now;

    const pairs = columnsForFields(spec, proposed);
    if (!pairs.length) throw new RangeError(`Nothing to update for ${entity}`);

    const assignments = pairs.map(([column]) => `${column} = ?`);
    if (policy.hasRevision) assignments.push("revision = revision + 1");

    const params = pairs.map(([, value]) => value);
    let where = "uuid = ?";
    params.push(uuid);
    if (options.expectedRevision !== undefined && policy.hasRevision) {
      where += " AND revision = ?";
      params.push(options.expectedRevision);
    }

    const result = await executor.run(
      `UPDATE ${spec.table} SET ${assignments.join(", ")} WHERE ${where}`, params
    );
    const changed = Number(result?.changes ?? 0);

    if (changed === 0 && options.expectedRevision !== undefined && await exists(entity, uuid)) {
      throw new RevisionConflictError(entity, uuid, options.expectedRevision);
    }
    return changed;
  }

  /**
   * Insert, or update the row that already claims the same identity.
   *
   * The conflict target comes from the schema's own UNIQUE constraints (see
   * write-policy.js), so an upsert is idempotent for the THING — one settings row per
   * profile, one progress row per (learner, lesson) — and not merely for a uuid the
   * caller happened to reuse.
   */
  async function upsert(entity, record, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "upsert");
    const now = options.now ?? Date.now();
    const target = options.conflictTarget ?? policy.conflictTarget;

    const known = new Set(spec.columns.map(([column]) => column));
    for (const column of target) {
      if (!known.has(column)) throw new RangeError(`Unknown conflict column for ${entity}: ${column}`);
    }

    const pairs = columnsForFields(spec, stamp(spec, record, now));
    if (!pairs.length) throw new RangeError(`Nothing to upsert for ${entity}`);

    // Identity and creation time survive the update half: an upsert refreshes a row,
    // it does not pretend the row is new.
    const immutable = new Set([...target, "uuid", "created_at"]);
    const assignments = pairs
      .filter(([column]) => !immutable.has(column))
      .map(([column]) => `${column} = excluded.${column}`);
    if (policy.hasRevision) assignments.push(`revision = ${spec.table}.revision + 1`);

    const sql =
      `INSERT INTO ${spec.table} (${pairs.map(([c]) => c).join(", ")}) ` +
      `VALUES (${pairs.map(() => "?").join(", ")}) ` +
      `ON CONFLICT(${target.join(", ")}) DO ` +
      (assignments.length ? `UPDATE SET ${assignments.join(", ")}` : "NOTHING");

    await executor.run(sql, pairs.map(([, value]) => value));
    return record.uuid ?? null;
  }

  /** Mark a row deleted while keeping it readable. The default for anything earned. */
  async function softDelete(entity, uuid, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "softDelete");
    const now = options.now ?? Date.now();
    const sets = ["deleted = 1"];
    if (policy.hasUpdatedAt) sets.push("updated_at = ?");
    if (policy.hasRevision) sets.push("revision = revision + 1");
    const params = policy.hasUpdatedAt ? [now, uuid] : [uuid];
    const result = await executor.run(
      `UPDATE ${spec.table} SET ${sets.join(", ")} WHERE uuid = ?`, params
    );
    return Number(result?.changes ?? 0);
  }

  /** Undo a soft delete. Recoverability is the point of soft-deleting in the first place. */
  async function restore(entity, uuid, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "softDelete");
    const now = options.now ?? Date.now();
    const sets = ["deleted = 0"];
    if (policy.hasUpdatedAt) sets.push("updated_at = ?");
    if (policy.hasRevision) sets.push("revision = revision + 1");
    const params = policy.hasUpdatedAt ? [now, uuid] : [uuid];
    const result = await executor.run(
      `UPDATE ${spec.table} SET ${sets.join(", ")} WHERE uuid = ?`, params
    );
    return Number(result?.changes ?? 0);
  }

  /** Remove a row permanently. Refused for anything a learner earned or recorded. */
  async function hardDelete(entity, uuid) {
    const spec = specFor(entity);
    assertAllowed(entity, "hardDelete");
    const result = await executor.run(`DELETE FROM ${spec.table} WHERE uuid = ?`, [uuid]);
    return Number(result?.changes ?? 0);
  }

  /* ------------------------------------------------------------- reads --- */

  async function getByUuid(entity, uuid) {
    const spec = specFor(entity);
    const rows = await executor.all(`SELECT * FROM ${spec.table} WHERE uuid = ?`, [uuid]);
    return rows.length ? recordFromRow(spec, rows[0]) : null;
  }

  async function exists(entity, uuid) {
    const spec = specFor(entity);
    const rows = await executor.all(
      `SELECT 1 AS present FROM ${spec.table} WHERE uuid = ? LIMIT 1`, [uuid]
    );
    return rows.length > 0;
  }

  /**
   * Build a WHERE clause from field equality (or `IN` for an array value).
   * Field names are resolved through the spec; values are always bound.
   */
  function whereClause(spec, where) {
    const byField = new Map(spec.columns.map(([column, field]) => [field, column]));
    const clauses = [];
    const params = [];
    for (const [field, value] of Object.entries(where ?? {})) {
      const column = byField.get(field);
      if (!column) throw new RangeError(`Unknown field for ${spec.entity}: ${field}`);
      if (Array.isArray(value)) {
        if (!value.length) { clauses.push("0 = 1"); continue; }
        clauses.push(`${column} IN (${value.map(() => "?").join(", ")})`);
        params.push(...value.map(normalizeWrite));
      } else if (value === null) {
        clauses.push(`${column} IS NULL`);
      } else {
        clauses.push(`${column} = ?`);
        params.push(normalizeWrite(value));
      }
    }
    return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
  }

  function orderClause(spec, orderBy) {
    const byField = new Map(spec.columns.map(([column, field]) => [field, column]));
    const parts = [];
    for (const entry of [].concat(orderBy ?? [])) {
      const [field, direction = "asc"] = Array.isArray(entry) ? entry : [entry];
      const column = byField.get(field);
      if (!column) throw new RangeError(`Unknown order field for ${spec.entity}: ${field}`);
      // Direction is matched against a fixed pair rather than interpolated from input.
      parts.push(`${column} ${String(direction).toLowerCase() === "desc" ? "DESC" : "ASC"}`);
    }
    // uuid last, so every result order is total and identical on every run and device.
    parts.push("uuid ASC");
    return ` ORDER BY ${parts.join(", ")}`;
  }

  /**
   * Filtered read. `includeDeleted` defaults to false, so soft-deleted rows stay out of
   * results without every caller having to remember to exclude them.
   */
  async function find(entity, where = {}, options = {}) {
    const spec = specFor(entity);
    const policy = policyFor(entity);
    const filter = { ...where };
    if (policy.hasDeleted && options.includeDeleted !== true && filter.deleted === undefined) {
      filter.deleted = 0;
    }

    const clause = whereClause(spec, filter);
    let sql = `SELECT * FROM ${spec.table}${clause.sql}${orderClause(spec, options.orderBy)}`;
    const params = [...clause.params];
    if (Number.isInteger(options.limit)) {
      sql += " LIMIT ?";
      params.push(options.limit);
      if (Number.isInteger(options.offset)) {
        sql += " OFFSET ?";
        params.push(options.offset);
      }
    }
    const rows = await executor.all(sql, params);
    return rows.map(row => recordFromRow(spec, row));
  }

  async function findOne(entity, where = {}, options = {}) {
    const rows = await find(entity, where, { ...options, limit: 1 });
    return rows[0] ?? null;
  }

  async function countWhere(entity, where = {}, options = {}) {
    const spec = specFor(entity);
    const policy = policyFor(entity);
    const filter = { ...where };
    if (policy.hasDeleted && options.includeDeleted !== true && filter.deleted === undefined) {
      filter.deleted = 0;
    }
    const clause = whereClause(spec, filter);
    const rows = await executor.all(
      `SELECT COUNT(*) AS n FROM ${spec.table}${clause.sql}`, clause.params
    );
    return Number(rows[0]?.n ?? 0);
  }

  /* ------------------------------------------------------ the SRS path --- */

  /**
   * The ONLY function permitted to write review_cards.
   *
   * The generic write surface refuses that table outright, so an ease, an interval or a
   * due date cannot move as a side effect of saving something else. Changing SRS state
   * requires naming this function, which makes every such write visible at its call
   * site and greppable across the codebase.
   *
   * The card must already have been computed by the scheduler; this persists a decision,
   * it does not make one.
   */
  async function applyScheduledCard(card, options = {}) {
    const spec = specFor("reviewCards");
    const now = options.now ?? Date.now();
    if (!card?.uuid) throw new TypeError("A scheduled card must carry its uuid");

    const pairs = columnsForFields(spec, stamp(spec, card, now));
    const target = ["profile_uuid", "vocab_uuid", "skill"];
    const immutable = new Set([...target, "uuid", "created_at"]);
    const assignments = pairs
      .filter(([column]) => !immutable.has(column))
      .map(([column]) => `${column} = excluded.${column}`);
    assignments.push(`revision = ${spec.table}.revision + 1`);

    await executor.run(
      `INSERT INTO ${spec.table} (${pairs.map(([c]) => c).join(", ")}) ` +
      `VALUES (${pairs.map(() => "?").join(", ")}) ` +
      `ON CONFLICT(${target.join(", ")}) DO UPDATE SET ${assignments.join(", ")}`,
      pairs.map(([, value]) => value)
    );
    return card.uuid;
  }

  /* -------------------------------------------------------- transactions -- */

  let depth = 0;

  /**
   * Run related writes as one unit: if any part throws, the whole thing rolls back.
   *
   * Nesting runs inline rather than issuing a second BEGIN, because SQLite has no
   * nested transactions and a second BEGIN would throw over the caller's real error.
   * The outermost call therefore owns commit and rollback for everything inside it.
   */
  async function transaction(work) {
    if (typeof work !== "function") throw new TypeError("A transaction body is required");
    if (depth > 0) return work(api);

    depth += 1;
    try {
      let result;
      await executor.transaction(async () => { result = await work(api); });
      return result;
    } finally {
      depth -= 1;
    }
  }

  async function selectAll(entity) {
    const spec = SPEC_BY_ENTITY.get(entity);
    if (!spec) throw new RangeError(`Unknown canonical entity: ${entity}`);
    const rows = await executor.all(`SELECT * FROM ${spec.table} ORDER BY uuid`, []);
    return rows.map(row => recordFromRow(spec, row));
  }

  // Read the whole canonical dataset back into the same shape the migration produced,
  // so a migrated dataset and its SQLite round-trip can be compared field-for-field.
  async function readCanonical() {
    const dataset = {};
    for (const spec of TABLE_SPECS) {
      dataset[spec.entity] = await selectAll(spec.entity);
    }
    return dataset;
  }

  async function count(table) {
    const rows = await executor.all(`SELECT COUNT(*) AS n FROM ${table}`, []);
    return Number(rows[0]?.n ?? 0);
  }

  // Post-migration integrity checks (DATA_MIGRATION_STRATEGY.md section 3).
  async function verifyIntegrity() {
    const rowCounts = {};
    for (const spec of TABLE_SPECS) rowCounts[spec.entity] = await count(spec.table);

    const orphanCards = Number(
      (await executor.all(
        `SELECT COUNT(*) AS n FROM review_cards c
           LEFT JOIN vocabulary_items v ON v.uuid = c.vocab_uuid
          WHERE v.uuid IS NULL`, []
      ))[0]?.n ?? 0
    );
    const orphanEvents = Number(
      (await executor.all(
        `SELECT COUNT(*) AS n FROM review_events e
           LEFT JOIN review_cards c ON c.uuid = e.card_uuid
          WHERE c.uuid IS NULL`, []
      ))[0]?.n ?? 0
    );
    const easeOutOfBounds = Number(
      (await executor.all(
        `SELECT COUNT(*) AS n FROM review_cards WHERE ease < 1.3 OR ease > 3.2`, []
      ))[0]?.n ?? 0
    );

    return {
      ok: orphanCards === 0 && orphanEvents === 0,
      rowCounts,
      orphanCards,
      orphanEvents,
      easeOutOfBounds
    };
  }

  const api = Object.freeze({
    initializeSchema,
    schemaVersion,
    importCanonical,
    readCanonical,
    selectAll,
    verifyIntegrity,
    // Incremental operations. Entity-scoped and policy-checked; see write-policy.js.
    insert,
    insertAll,
    update,
    upsert,
    softDelete,
    restore,
    hardDelete,
    getByUuid,
    exists,
    find,
    findOne,
    countWhere,
    transaction,
    // Named apart from everything above on purpose: this is the SRS write path.
    applyScheduledCard
  });

  return api;
}

// SQLite bindings accept null/number/string/bigint but not undefined or booleans.
function normalizeWrite(value) {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}
