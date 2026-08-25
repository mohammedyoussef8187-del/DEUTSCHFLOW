/*
 * Referential integrity for a canonical dataset.
 *
 * `publication.js` decides whether one ROW may be shown to a learner. That decision is
 * correct and it is per row — but a dataset is a graph, and hiding a parent without
 * hiding its children leaves the children pointing at nothing. A `lesson_item` whose
 * section was withheld is not "hidden"; it is exported, downloaded, and then silently
 * skipped by every reader that walks the tree from a course downwards. It inflates every
 * count taken from the flat table and matches nothing taken from the tree.
 *
 * This module supplies the missing half: given a set of entity arrays, it works out which
 * rows can still reach a real parent, and which cannot.
 *
 * THE RELATIONSHIPS ARE READ FROM THE SCHEMA, NOT LISTED HERE. `SCHEMA_STATEMENTS`
 * already declares them — `FOREIGN KEY (section_uuid) REFERENCES lesson_sections(uuid)`
 * and forty more — so they are parsed out of the DDL and translated into entity/field
 * names through `TABLE_SPECS`. A relationship added to the schema is therefore enforced
 * here the day it is added, without anyone remembering to update a list.
 *
 * Two relationships the DDL cannot express are declared explicitly below, because SQL has
 * no way to say them: `lesson_items` and `curriculum_texts` both point at a row whose
 * TABLE is named in a sibling column. Those are the polymorphic edges, and they are also
 * where most of the orphans were.
 */

import { SCHEMA_STATEMENTS, TABLE_SPECS } from "../platform/sqlite/schema.js";

/* ------------------------------------------------------- schema introspection */

const ENTITY_BY_TABLE = new Map(TABLE_SPECS.map(spec => [spec.table, spec.entity]));

const FIELD_BY_COLUMN = new Map(
  TABLE_SPECS.map(spec => [spec.entity, new Map(spec.columns)])
);

/** `CREATE TABLE IF NOT EXISTS foo (` → `foo` */
const TABLE_NAME = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(/i;

/** `FOREIGN KEY (a_uuid) REFERENCES b(uuid)` → [a_uuid, b] */
const FOREIGN_KEY = /FOREIGN KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+(\w+)\s*\(\s*uuid\s*\)/gi;

/**
 * Every declared foreign key, expressed in the entity/field names the dataset uses.
 *
 * A key whose table has no `TABLE_SPECS` entry is skipped rather than guessed at: the
 * dataset cannot contain rows for a table it has no mapping for, so there is nothing to
 * check.
 *
 * @returns {Array<{entity:string, field:string, target:string, optional:boolean}>}
 */
export function declaredReferences() {
  const references = [];

  for (const statement of SCHEMA_STATEMENTS) {
    const table = statement.match(TABLE_NAME)?.[1];
    const entity = table ? ENTITY_BY_TABLE.get(table) : null;
    if (!entity) continue;

    for (const match of statement.matchAll(FOREIGN_KEY)) {
      const [, column, targetTable] = match;
      const target = ENTITY_BY_TABLE.get(targetTable);
      const field = FIELD_BY_COLUMN.get(entity)?.get(column);
      if (!target || !field) continue;

      /*
       * A column the DDL allows to be NULL holds an optional reference: `audio_uuid` on a
       * listening item is the obvious one — an activity with no recording is a real
       * activity, not a broken row. Only a value that is present but unresolvable is an
       * orphan, so nullability is read from the same DDL.
       */
      const declaration = new RegExp(`\\b${column}\\s+TEXT\\s+NOT\\s+NULL`, "i");
      references.push({
        entity, field, target, optional: !declaration.test(statement)
      });
    }
  }

  return references;
}

/**
 * References SQL cannot declare, because the target table is named by a sibling column.
 *
 * The values are the ones the writers actually emit; a type that appears in data but not
 * here is reported as an unknown type rather than quietly passing, because an unreadable
 * reference is exactly as broken as a dangling one.
 */
export const POLYMORPHIC_REFERENCES = Object.freeze([
  {
    entity: "lessonItems", typeField: "contentType", field: "contentUuid",
    targets: Object.freeze({
      vocabulary: "vocabularyItems",
      exercise: "exercises",
      sentence: "sentences",
      listening: "listeningItems",
      /*
       * `grammar` is the older, looser type: the open-content intake emits it for a RULE,
       * while `grammar_topic` and `grammar_rule` say which they mean. A reference that
       * resolves in either table is sound, and the reader routes both — so both are
       * accepted here rather than one being declared correct and real content with it.
       */
      grammar: ["grammarRules", "grammarTopics"],
      grammar_topic: "grammarTopics",
      grammar_rule: "grammarRules",
      pronunciation: "pronunciationItems"
    })
  },
  {
    entity: "curriculumTexts", typeField: "ownerType", field: "ownerUuid",
    targets: Object.freeze({
      course: "courses",
      unit: "courseUnits",
      lesson: "lessons",
      section: "lessonSections",
      exercise: "exercises",
      listening: "listeningItems"
    })
  }
]);

/* ------------------------------------------------------------------ analysis */

const notDeleted = row => !row?.deleted;

function uuidSet(rows) {
  const set = new Set();
  for (const row of rows ?? []) if (notDeleted(row) && row.uuid) set.add(row.uuid);
  return set;
}

/**
 * Find every row that points at something the dataset does not contain.
 *
 * @param {object} entities entity name → array of rows
 * @returns {{orphans: object, unknownTypes: Array, total: number}}
 */
export function findOrphans(entities = {}) {
  const present = new Map();
  const idsOf = entity => {
    if (!present.has(entity)) present.set(entity, uuidSet(entities[entity]));
    return present.get(entity);
  };

  const orphans = {};
  const unknownTypes = [];
  let total = 0;

  const record = (entity, row, reason) => {
    (orphans[entity] ??= []).push({ uuid: row.uuid, reason });
    total += 1;
  };

  for (const reference of declaredReferences()) {
    for (const row of entities[reference.entity] ?? []) {
      if (!notDeleted(row)) continue;
      const value = row[reference.field];
      if (value === null || value === undefined || value === "") {
        if (!reference.optional) {
          record(reference.entity, row, `${reference.field} is empty`);
        }
        continue;
      }
      if (!idsOf(reference.target).has(value)) {
        record(reference.entity, row, `${reference.field} → missing ${reference.target}`);
      }
    }
  }

  for (const reference of POLYMORPHIC_REFERENCES) {
    for (const row of entities[reference.entity] ?? []) {
      if (!notDeleted(row)) continue;
      const type = row[reference.typeField];
      const declared = reference.targets[type];
      if (!declared) {
        unknownTypes.push({ entity: reference.entity, uuid: row.uuid, type });
        continue;
      }
      /* A type may name more than one table it can legitimately resolve in. */
      const targets = Array.isArray(declared) ? declared : [declared];
      if (!targets.some(target => idsOf(target).has(row[reference.field]))) {
        record(reference.entity, row,
          `${reference.typeField}=${type} → missing ${targets.join("/")}`);
      }
    }
  }

  return { orphans, unknownTypes, total };
}

/**
 * Remove every row that cannot reach a real parent, repeatedly, until nothing changes.
 *
 * One pass is not enough. Withholding a course orphans its units; dropping those units
 * orphans their lessons; dropping those lessons orphans their sections, and so on down
 * to the items and the texts. The loop runs until a pass removes nothing, which is when
 * the remaining graph is closed under every relationship the schema declares.
 *
 * It is deliberately a FILTER over a dataset and never a delete against a store: the
 * source database keeps every row, including the drafts and the retired courses, because
 * a row withheld from a learner is not a row that stopped existing.
 *
 * @param {object} entities entity name → array of rows
 * @returns {{entities: object, removed: object, removedTotal: number, passes: number}}
 */
export function pruneOrphans(entities = {}) {
  const working = {};
  for (const [entity, rows] of Object.entries(entities)) working[entity] = rows;

  const removed = {};
  let removedTotal = 0;
  let passes = 0;

  for (;;) {
    const { orphans, total } = findOrphans(working);
    passes += 1;
    if (!total) break;

    for (const [entity, rows] of Object.entries(orphans)) {
      const drop = new Set(rows.map(row => row.uuid));
      working[entity] = (working[entity] ?? []).filter(row => !drop.has(row.uuid));
      removed[entity] = (removed[entity] ?? 0) + drop.size;
      removedTotal += drop.size;
    }

    /* A dataset that cannot be closed would loop forever; it never has, and if the graph
       ever gained a cycle this bound turns an infinite loop into a visible failure. */
    if (passes > 50) throw new Error("referential pruning did not converge");
  }

  return { entities: working, removed, removedTotal, passes };
}

/**
 * A one-line-per-entity integrity verdict, for a report or a test.
 *
 * @returns {{ok: boolean, counts: object, unknownTypes: Array, total: number}}
 */
export function integrityReport(entities = {}) {
  const { orphans, unknownTypes, total } = findOrphans(entities);
  const counts = {};
  for (const [entity, rows] of Object.entries(orphans)) counts[entity] = rows.length;
  return { ok: total === 0 && unknownTypes.length === 0, counts, orphans, unknownTypes, total };
}
