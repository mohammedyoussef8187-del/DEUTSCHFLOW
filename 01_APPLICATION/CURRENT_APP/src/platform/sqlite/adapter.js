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
 */

import { SCHEMA_STATEMENTS, SCHEMA_VERSION, TABLE_SPECS } from "./schema.js";

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

  return Object.freeze({
    initializeSchema,
    schemaVersion,
    importCanonical,
    readCanonical,
    selectAll,
    verifyIntegrity
  });
}

// SQLite bindings accept null/number/string/bigint but not undefined or booleans.
function normalizeWrite(value) {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}
