/*
 * Canonical persistence adapter backed by plain objects.
 *
 * WHY THIS EXISTS. The canonical model had exactly one storage adapter, SQLite, which
 * exists only on a packaged native build. On the web and PWA target — the only target a
 * learner can actually reach today — the runtime resolved to an empty source, so every
 * curriculum screen rendered "nothing authored yet" no matter how much content had been
 * imported. Real content existed; no learner could reach it.
 *
 * This is a second STORAGE backend, not a second model. Everything that decides meaning
 * is shared and imported from one place:
 *
 *   - TABLE_SPECS decides which fields an entity has and what they are called.
 *   - write-policy.js decides what each entity may do, what its natural key is, and —
 *     parsed from the same DDL SQLite is given — its DEFAULTs, NOT NULL columns and
 *     foreign keys.
 *
 * So the rules are not restated here; they are applied here. A parity test drives both
 * adapters through the same repository layer and compares the rows field for field.
 *
 * Durability is the caller's business. This adapter holds the data and reports every
 * commit through `onCommit`, so the browser store can persist a snapshot and a test can
 * pass nothing at all.
 */

import { SCHEMA_VERSION, TABLE_SPECS } from "../sqlite/schema.js";
import {
  RevisionConflictError, assertAllowed, columnConstraintsFor, policyFor, uniqueKeysFor
} from "../sqlite/write-policy.js";

const SPEC_BY_ENTITY = new Map(TABLE_SPECS.map(spec => [spec.entity, spec]));
const ENTITY_BY_TABLE = new Map(TABLE_SPECS.map(spec => [spec.table, spec.entity]));

/** Thrown for what SQLite would refuse: a duplicate key, a null, a missing parent. */
export class ConstraintError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConstraintError";
  }
}

// Same coercion the SQLite bindings force, so a row written through either adapter
// carries the same value: no undefined, and no JavaScript booleans.
function normalizeWrite(value) {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}

/** SQLite's sort order: NULL first, then numbers, then text. */
function compareValues(a, b) {
  const rank = value => (value === null || value === undefined ? 0 : typeof value === "number" ? 1 : 2);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return 0;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function createMemoryCanonicalAdapter(options = {}) {
  const onCommit = options.onCommit ?? null;

  /** entity -> uuid -> record. Records are keyed by FIELD name, as callers see them. */
  const tables = new Map(TABLE_SPECS.map(spec => [spec.entity, new Map()]));
  let version = 0;

  function specFor(entity) {
    const spec = SPEC_BY_ENTITY.get(entity);
    if (!spec) throw new RangeError(`Unknown canonical entity: ${entity}`);
    return spec;
  }

  const fieldForColumn = (spec, column) =>
    spec.columns.find(([name]) => name === column)?.[1] ?? null;

  function rowsOf(entity) {
    return tables.get(entity) ?? tables.set(entity, new Map()).get(entity);
  }

  /* --------------------------------------------------------- record shape */

  /** Every declared field present, missing ones normalized, in spec order. */
  function completeRecord(spec, record) {
    const out = {};
    for (const [, field] of spec.columns) out[field] = normalizeWrite(record?.[field]);
    return out;
  }

  /** Only the fields the caller actually supplied. Unknown fields are refused. */
  function knownFields(spec, record) {
    const declared = new Set(spec.columns.map(([, field]) => field));
    const out = {};
    for (const [field, value] of Object.entries(record ?? {})) {
      if (!declared.has(field)) throw new RangeError(`Unknown field for ${spec.entity}: ${field}`);
      out[field] = normalizeWrite(value);
    }
    return out;
  }

  function stamp(spec, record, now) {
    const policy = policyFor(spec.entity);
    const out = { ...record };
    if (policy.hasUpdatedAt && out.updatedAt === undefined) out.updatedAt = now;
    if (out.createdAt === undefined && spec.columns.some(([column]) => column === "created_at")) {
      out.createdAt = now;
    }
    if (policy.hasRevision && out.revision === undefined) out.revision = 1;
    if (policy.hasDeleted && out.deleted === undefined) out.deleted = 0;
    return out;
  }

  /** Fill the DDL's own DEFAULT for any column the caller left out of an insert. */
  function applyDefaults(spec, record) {
    const { defaults } = columnConstraintsFor(spec.entity);
    const out = { ...record };
    for (const [column, value] of Object.entries(defaults)) {
      const field = fieldForColumn(spec, column);
      if (field && (out[field] === undefined || out[field] === null)) out[field] = value;
    }
    return out;
  }

  /* ----------------------------------------------------------- constraints */

  function assertNotNull(spec, record) {
    for (const column of columnConstraintsFor(spec.entity).notNull) {
      const field = fieldForColumn(spec, column);
      if (field && (record[field] === null || record[field] === undefined)) {
        throw new ConstraintError(`NOT NULL constraint failed: ${spec.table}.${column}`);
      }
    }
  }

  function assertUnique(spec, record, ignoreUuid = null) {
    const targets = [["uuid"], ...uniqueTargets(spec)];
    for (const target of targets) {
      const fields = target.map(column => fieldForColumn(spec, column)).filter(Boolean);
      if (fields.length !== target.length) continue;
      const clash = findByKey(spec, fields, record, ignoreUuid);
      if (clash) {
        throw new ConstraintError(
          `UNIQUE constraint failed: ${target.map(column => `${spec.table}.${column}`).join(", ")}`);
      }
    }
  }

  function assertForeignKeys(spec, record) {
    for (const key of columnConstraintsFor(spec.entity).foreignKeys) {
      const field = fieldForColumn(spec, key.column);
      const value = field ? record[field] : null;
      // SQLite does not check a NULL child value, and neither does this.
      if (!field || value === null || value === undefined) continue;
      const parentEntity = ENTITY_BY_TABLE.get(key.table);
      if (!parentEntity) continue;
      if (!rowsOf(parentEntity).has(value)) {
        throw new ConstraintError(
          `FOREIGN KEY constraint failed: ${spec.table}.${key.column} -> ${key.table}`);
      }
    }
  }

  /* policyFor names the ONE target an upsert uses; every other UNIQUE key still
     constrains a write, so all of them are checked. */
  function uniqueTargets(spec) {
    return uniqueKeysFor(spec.entity).filter(key => !(key.length === 1 && key[0] === "uuid"));
  }

  function findByKey(spec, fields, record, ignoreUuid) {
    for (const row of rowsOf(spec.entity).values()) {
      if (ignoreUuid !== null && row.uuid === ignoreUuid) continue;
      if (fields.every(field => row[field] === normalizeWrite(record[field]))) return row;
    }
    return null;
  }

  /* --------------------------------------------------------------- writes */

  async function insert(entity, record, options = {}) {
    const spec = specFor(entity);
    assertAllowed(entity, "insert");
    const now = options.now ?? Date.now();

    const supplied = knownFields(spec, stamp(spec, record, now));
    if (!Object.keys(supplied).length) throw new RangeError(`Nothing to insert for ${entity}`);
    const complete = completeRecord(spec, applyDefaults(spec, supplied));

    assertNotNull(spec, complete);
    assertUnique(spec, complete);
    assertForeignKeys(spec, complete);

    rowsOf(entity).set(complete.uuid, complete);
    committed();
    return record.uuid ?? null;
  }

  async function insertAll(entity, records, options = {}) {
    let written = 0;
    for (const record of records ?? []) {
      await insert(entity, record, options);
      written += 1;
    }
    return written;
  }

  async function update(entity, uuid, changes, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "update");
    const now = options.now ?? Date.now();

    const proposed = { ...changes };
    delete proposed.uuid;                  // identity is not a mutable field
    delete proposed.createdAt;             // nor is when it first existed
    delete proposed.revision;              // the adapter owns this
    if (policy.hasUpdatedAt) proposed.updatedAt = options.updatedAt ?? now;

    const supplied = knownFields(spec, proposed);
    if (!Object.keys(supplied).length) throw new RangeError(`Nothing to update for ${entity}`);

    const existing = rowsOf(entity).get(uuid) ?? null;
    const matches = existing !== null &&
      (options.expectedRevision === undefined || !policy.hasRevision ||
        existing.revision === options.expectedRevision);

    if (!matches) {
      if (existing && options.expectedRevision !== undefined) {
        throw new RevisionConflictError(entity, uuid, options.expectedRevision);
      }
      return 0;
    }

    const next = { ...existing, ...supplied };
    if (policy.hasRevision) next.revision = (existing.revision ?? 0) + 1;

    assertNotNull(spec, next);
    assertUnique(spec, next, uuid);
    assertForeignKeys(spec, next);

    rowsOf(entity).set(uuid, next);
    committed();
    return 1;
  }

  async function upsert(entity, record, options = {}) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "upsert");
    const now = options.now ?? Date.now();
    const target = options.conflictTarget ?? policy.conflictTarget;
    return conflictWrite(spec, record, now, target, policy.hasRevision);
  }

  /**
   * Insert, or refresh the row that already claims the same identity.
   *
   * Only the fields the caller supplied are refreshed, and identity and creation time
   * survive, exactly as the SQL upsert's excluded-column list does — an upsert refreshes
   * a row, it does not pretend the row is new.
   */
  function conflictWrite(spec, record, now, target, hasRevision) {
    const known = new Set(spec.columns.map(([column]) => column));
    for (const column of target) {
      if (!known.has(column)) throw new RangeError(`Unknown conflict column for ${spec.entity}: ${column}`);
    }

    const supplied = knownFields(spec, stamp(spec, record, now));
    if (!Object.keys(supplied).length) throw new RangeError(`Nothing to upsert for ${spec.entity}`);

    const keyFields = target.map(column => fieldForColumn(spec, column));
    const existing = keyFields.every(Boolean) ? findByKey(spec, keyFields, supplied, null) : null;

    if (!existing) {
      const complete = completeRecord(spec, applyDefaults(spec, supplied));
      assertNotNull(spec, complete);
      assertUnique(spec, complete);
      assertForeignKeys(spec, complete);
      rowsOf(spec.entity).set(complete.uuid, complete);
      committed();
      return record.uuid ?? null;
    }

    const immutable = new Set(["uuid", "createdAt", ...keyFields]);
    const next = { ...existing };
    for (const [field, value] of Object.entries(supplied)) {
      if (!immutable.has(field)) next[field] = value;
    }
    if (hasRevision) next.revision = (existing.revision ?? 0) + 1;

    assertNotNull(spec, next);
    assertUnique(spec, next, existing.uuid);
    assertForeignKeys(spec, next);

    rowsOf(spec.entity).set(existing.uuid, next);
    committed();
    return record.uuid ?? null;
  }

  async function softDelete(entity, uuid, options = {}) {
    return setDeleted(entity, uuid, 1, options);
  }

  async function restore(entity, uuid, options = {}) {
    return setDeleted(entity, uuid, 0, options);
  }

  function setDeleted(entity, uuid, deleted, options) {
    const spec = specFor(entity);
    const policy = assertAllowed(entity, "softDelete");
    const now = options.now ?? Date.now();
    const existing = rowsOf(entity).get(uuid);
    if (!existing) return 0;

    const next = { ...existing, deleted };
    if (policy.hasUpdatedAt) next.updatedAt = now;
    if (policy.hasRevision) next.revision = (existing.revision ?? 0) + 1;
    rowsOf(entity).set(uuid, next);
    committed();
    void spec;
    return 1;
  }

  async function hardDelete(entity, uuid) {
    specFor(entity);
    assertAllowed(entity, "hardDelete");
    const removed = rowsOf(entity).delete(uuid);
    if (removed) committed();
    return removed ? 1 : 0;
  }

  /* ---------------------------------------------------------------- reads */

  async function getByUuid(entity, uuid) {
    specFor(entity);
    const row = rowsOf(entity).get(uuid);
    return row ? { ...row } : null;
  }

  async function exists(entity, uuid) {
    specFor(entity);
    return rowsOf(entity).has(uuid);
  }

  /* Checked before any row is looked at, because a filter naming a field the entity
     does not have is wrong whether or not the table happens to be empty. */
  function assertFilterFields(spec, where) {
    const declared = new Set(spec.columns.map(([, field]) => field));
    for (const field of Object.keys(where ?? {})) {
      if (!declared.has(field)) throw new RangeError(`Unknown field for ${spec.entity}: ${field}`);
    }
  }

  function matches(spec, row, where) {
    for (const [field, value] of Object.entries(where ?? {})) {
      if (Array.isArray(value)) {
        if (!value.some(candidate => row[field] === normalizeWrite(candidate))) return false;
      } else if (value === null) {
        if (row[field] !== null) return false;
      } else if (row[field] !== normalizeWrite(value)) {
        return false;
      }
    }
    return true;
  }

  function sorted(spec, rows, orderBy) {
    const declared = new Set(spec.columns.map(([, field]) => field));
    const keys = [].concat(orderBy ?? []).map(entry => {
      const [field, direction = "asc"] = Array.isArray(entry) ? entry : [entry];
      if (!declared.has(field)) throw new RangeError(`Unknown order field for ${spec.entity}: ${field}`);
      return [field, String(direction).toLowerCase() === "desc" ? -1 : 1];
    });
    // uuid last, so every result order is total and identical on every run and device.
    keys.push(["uuid", 1]);

    return rows.slice().sort((a, b) => {
      for (const [field, direction] of keys) {
        const verdict = compareValues(a[field], b[field]) * direction;
        if (verdict !== 0) return verdict;
      }
      return 0;
    });
  }

  function filtered(entity, where, options) {
    const spec = specFor(entity);
    const policy = policyFor(entity);
    const filter = { ...where };
    if (policy.hasDeleted && options.includeDeleted !== true && filter.deleted === undefined) {
      filter.deleted = 0;
    }
    assertFilterFields(spec, filter);
    const rows = [...rowsOf(entity).values()].filter(row => matches(spec, row, filter));
    return { spec, rows };
  }

  async function find(entity, where = {}, options = {}) {
    const { spec, rows } = filtered(entity, where, options);
    let out = sorted(spec, rows, options.orderBy);
    if (Number.isInteger(options.limit)) {
      const offset = Number.isInteger(options.offset) ? options.offset : 0;
      out = out.slice(offset, offset + options.limit);
    }
    return out.map(row => ({ ...row }));
  }

  async function findOne(entity, where = {}, options = {}) {
    const rows = await find(entity, where, { ...options, limit: 1 });
    return rows[0] ?? null;
  }

  async function countWhere(entity, where = {}, options = {}) {
    return filtered(entity, where, options).rows.length;
  }

  async function selectAll(entity) {
    const spec = specFor(entity);
    return sorted(spec, [...rowsOf(entity).values()], []).map(row => ({ ...row }));
  }

  /* ------------------------------------------------------ the SRS path --- */

  /**
   * The ONLY function permitted to write review_cards, exactly as on the SQLite side.
   * The generic write surface refuses that entity, so SRS state cannot move as a side
   * effect of saving something else.
   */
  async function applyScheduledCard(card, options = {}) {
    const spec = specFor("reviewCards");
    const now = options.now ?? Date.now();
    if (!card?.uuid) throw new TypeError("A scheduled card must carry its uuid");
    conflictWrite(spec, card, now, ["profile_uuid", "vocab_uuid", "skill"], true);
    return card.uuid;
  }

  /* -------------------------------------------------------- transactions -- */

  let depth = 0;
  let dirty = false;

  function committed() {
    if (depth > 0) { dirty = true; return; }
    version += 1;
    onCommit?.();
  }

  function snapshot() {
    return new Map([...tables].map(([entity, rows]) => [entity, new Map(rows)]));
  }

  function restoreSnapshot(saved) {
    for (const [entity, rows] of saved) tables.set(entity, rows);
  }

  /**
   * Run related writes as one unit: if any part throws, the whole thing rolls back.
   *
   * Rollback restores the pre-transaction table snapshot. Records are replaced wholesale
   * rather than mutated in place, so copying the row maps is enough and no row has to be
   * deep-cloned. Nesting runs inline, as it does on SQLite, so the outermost call owns
   * the commit — and reports exactly one.
   */
  async function transaction(work) {
    if (typeof work !== "function") throw new TypeError("A transaction body is required");
    if (depth > 0) return work(api);

    const saved = snapshot();
    depth += 1;
    dirty = false;
    try {
      const result = await work(api);
      depth -= 1;
      if (dirty) committed();
      return result;
    } catch (error) {
      depth -= 1;
      restoreSnapshot(saved);
      dirty = false;
      throw error;
    }
  }

  /* ------------------------------------------------------------ lifecycle */

  async function initializeSchema() {
    return SCHEMA_VERSION;
  }

  async function schemaVersion() {
    return SCHEMA_VERSION;
  }

  /** Write a whole canonical dataset atomically, the way the bulk migration does. */
  async function importCanonical(dataset) {
    await transaction(async () => {
      for (const spec of TABLE_SPECS) {
        for (const record of dataset?.[spec.entity] ?? []) {
          const complete = completeRecord(spec, record);
          if (rowsOf(spec.entity).has(complete.uuid)) {
            throw new ConstraintError(`UNIQUE constraint failed: ${spec.table}.uuid`);
          }
          rowsOf(spec.entity).set(complete.uuid, complete);
        }
      }
      dirty = true;
    });
  }

  async function readCanonical() {
    const dataset = {};
    for (const spec of TABLE_SPECS) dataset[spec.entity] = await selectAll(spec.entity);
    return dataset;
  }

  async function verifyIntegrity() {
    const rowCounts = {};
    for (const spec of TABLE_SPECS) rowCounts[spec.entity] = rowsOf(spec.entity).size;

    const vocabulary = rowsOf("vocabularyItems");
    const cards = rowsOf("reviewCards");
    const orphanCards = [...cards.values()].filter(card => !vocabulary.has(card.vocabUuid)).length;
    const orphanEvents = [...rowsOf("reviewEvents").values()]
      .filter(event => !cards.has(event.cardUuid)).length;
    const easeOutOfBounds = [...cards.values()]
      .filter(card => card.ease < 1.3 || card.ease > 3.2).length;

    return {
      ok: orphanCards === 0 && orphanEvents === 0,
      rowCounts, orphanCards, orphanEvents, easeOutOfBounds
    };
  }

  const api = Object.freeze({
    initializeSchema,
    schemaVersion,
    importCanonical,
    readCanonical,
    selectAll,
    verifyIntegrity,
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
    applyScheduledCard,
    /** Not part of the storage contract: how the browser store persists and reloads. */
    memory: Object.freeze({
      version: () => version,
      export: entities => exportRows(entities),
      load: dataset => loadRows(dataset)
    })
  });

  /** A subset of the store, for persisting only the tables a learner writes into. */
  function exportRows(entities) {
    const wanted = entities ?? TABLE_SPECS.map(spec => spec.entity);
    const out = {};
    for (const entity of wanted) {
      specFor(entity);
      out[entity] = [...rowsOf(entity).values()].map(row => ({ ...row }));
    }
    return out;
  }

  /** Put previously exported rows back, replacing whatever those tables hold. */
  function loadRows(dataset) {
    let loaded = 0;
    for (const [entity, records] of Object.entries(dataset ?? {})) {
      if (!SPEC_BY_ENTITY.has(entity)) continue;      // an entity this build dropped
      const spec = specFor(entity);
      const rows = new Map();
      for (const record of records ?? []) {
        const complete = completeRecord(spec, record);
        rows.set(complete.uuid, complete);
        loaded += 1;
      }
      tables.set(entity, rows);
    }
    return loaded;
  }

  return api;
}
