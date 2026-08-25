#!/usr/bin/env node
/*
 * Release metrics that say which population they counted.
 *
 * The previous completion report gave a single number per category — "296 exercises" —
 * drawn from the flat exported table. That number was not wrong so much as unattributed:
 * it counted rows in a file, while the reader took it to mean exercises a learner can
 * meet, and at the time those differed by fourteen. A count is only meaningful with its
 * scope attached, so this reports five of them side by side:
 *
 *   ENTITY_TOTAL            rows in the source store (undeleted). Everything authored or
 *                           imported, including drafts and retired material.
 *   CANONICAL_TOTAL         rows in the shipped dataset: published, and closed under
 *                           every relationship the schema declares.
 *   LEARNER_REFERENCED      rows reachable from a course through a complete parent chain.
 *   LEARNER_VISIBLE         rows a learner actually meets on a screen — for content, the
 *                           distinct objects a lesson item points at.
 *   ORPHANED                canonical rows that cannot reach a parent. Must be zero.
 *
 * ENTITY_TOTAL above CANONICAL_TOTAL is not a defect: it is the draft and retired
 * material the source store keeps on purpose. ORPHANED above zero is a defect.
 *
 *   node tools/intake/release-metrics.mjs [--db <file>] [--dataset <file>] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TABLE_SPECS } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js";
import { integrityReport } from "../../01_APPLICATION/CURRENT_APP/src/content/referential-integrity.js";

/** The categories a release is judged on, and the entity each one counts. */
export const CATEGORIES = Object.freeze([
  { label: "Courses", entity: "courses" },
  { label: "Units", entity: "courseUnits" },
  { label: "Lessons", entity: "lessons" },
  { label: "Sections", entity: "lessonSections" },
  { label: "Lesson items", entity: "lessonItems" },
  { label: "Vocabulary", entity: "vocabularyItems", contentType: "vocabulary" },
  { label: "Grammar rules", entity: "grammarRules", contentType: ["grammar", "grammar_rule"] },
  /* Reached through their rules, not pointed at directly — see `topicsViaRules`. */
  { label: "Grammar topics", entity: "grammarTopics", via: "rules" },
  { label: "Sentences", entity: "sentences", contentType: "sentence" },
  { label: "Exercises", entity: "exercises", contentType: "exercise" },
  { label: "Listening", entity: "listeningItems", contentType: "listening" }
]);

const TABLE_BY_ENTITY = new Map(TABLE_SPECS.map(spec => [spec.entity, spec.table]));

const alive = rows => (rows ?? []).filter(row => !row.deleted);

/**
 * Walk the dataset from courses downwards and collect what is genuinely reachable.
 *
 * This is the tree a learner navigates, so it is the definitive answer to "how much is
 * there" — as distinct from how many rows a table holds.
 */
export function reachable(entities = {}) {
  const courses = alive(entities.courses);
  const courseIds = new Set(courses.map(row => row.uuid));

  const units = alive(entities.courseUnits).filter(row => courseIds.has(row.courseUuid));
  const unitIds = new Set(units.map(row => row.uuid));

  const levels = alive(entities.courseLevels).filter(row => courseIds.has(row.courseUuid));

  const lessons = alive(entities.lessons).filter(row => unitIds.has(row.unitUuid));
  const lessonIds = new Set(lessons.map(row => row.uuid));

  const sections = alive(entities.lessonSections).filter(row => lessonIds.has(row.lessonUuid));
  const sectionIds = new Set(sections.map(row => row.uuid));

  const items = alive(entities.lessonItems).filter(row => sectionIds.has(row.sectionUuid));

  /* What those items point at, grouped by the type they declare. */
  const referenced = new Map();
  for (const item of items) {
    if (!referenced.has(item.contentType)) referenced.set(item.contentType, new Set());
    referenced.get(item.contentType).add(item.contentUuid);
  }

  return { courses, levels, units, lessons, sections, items, referenced };
}

/** The topics owning any rule a lesson item points at. */
function topicsViaRules(tree, canonical) {
  const ruleIds = referencedCount(tree, ["grammar", "grammar_rule"]);
  const topics = new Set();
  for (const rule of alive(canonical.grammarRules)) {
    if (ruleIds.has(rule.uuid) && rule.topicUuid) topics.add(rule.topicUuid);
  }
  for (const uuid of referencedCount(tree, "grammar_topic")) topics.add(uuid);
  return [...topics];
}

function referencedCount(tree, contentType) {
  const types = Array.isArray(contentType) ? contentType : [contentType];
  const seen = new Set();
  for (const type of types) {
    for (const uuid of tree.referenced.get(type) ?? []) seen.add(uuid);
  }
  return seen;
}

/**
 * Every category counted in every scope.
 *
 * @param {object} source entity → rows, read from the source store
 * @param {object} canonical entity → rows, read from the shipped dataset
 */
export function releaseMetrics(source, canonical) {
  const tree = reachable(canonical);
  const integrity = integrityReport(canonical);
  const orphanBy = integrity.counts;

  const structural = {
    courses: tree.courses, courseUnits: tree.units, lessons: tree.lessons,
    lessonSections: tree.sections, lessonItems: tree.items, courseLevels: tree.levels
  };

  const rows = CATEGORIES.map(category => {
    const canonicalRows = alive(canonical[category.entity]);
    const inTree = structural[category.entity];

    /*
     * Structure is counted by what the walk reached. Content is counted by what the
     * reached items point at — a vocabulary row nothing references is in the file but
     * not in anybody's lesson, and saying so is the whole point of this table.
     */
    const present = new Set(canonicalRows.map(row => row.uuid));
    /*
     * A grammar topic is a container: no lesson item names one, so counting direct
     * references would report zero for material a learner plainly reads. It is reached
     * when one of its rules is, and that is what is counted.
     */
    const resolved = category.via === "rules"
      ? topicsViaRules(tree, canonical).filter(uuid => present.has(uuid))
      : category.contentType
        ? [...referencedCount(tree, category.contentType)].filter(uuid => present.has(uuid))
        : null;

    return {
      label: category.label,
      entity: category.entity,
      entityTotal: alive(source[category.entity]).length,
      canonicalTotal: canonicalRows.length,
      learnerReferenced: inTree ? inTree.length : resolved.length,
      learnerVisible: inTree ? inTree.length : resolved.length,
      orphaned: orphanBy[category.entity] ?? 0
    };
  });

  /* Listening is the one category where "referenced" and "usable" genuinely differ. */
  const listeningReferenced = [...referencedCount(tree, "listening")];
  const byUuid = new Map(alive(canonical.listeningItems).map(row => [row.uuid, row]));
  const assets = new Set(alive(canonical.audioAssets).map(row => row.uuid));
  const withAudio = listeningReferenced
    .map(uuid => byUuid.get(uuid))
    .filter(row => row?.audioUuid && assets.has(row.audioUuid));

  const listening = {
    entityTotal: alive(source.listeningItems).length,
    canonicalTotal: alive(canonical.listeningItems).length,
    learnerReferenced: listeningReferenced.length,
    withAudio: withAudio.length,
    withoutAudio: listeningReferenced.length - withAudio.length,
    unreferenced: alive(canonical.listeningItems)
      .filter(row => !listeningReferenced.includes(row.uuid))
      .map(row => row.slug)
  };

  return { rows, listening, integrity };
}

function readSource(dbFile) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const out = {};
  for (const category of [...CATEGORIES, { entity: "courseLevels" }, { entity: "curriculumTexts" },
    { entity: "audioAssets" }]) {
    const table = TABLE_BY_ENTITY.get(category.entity);
    if (!table) continue;
    out[category.entity] = db.prepare(`SELECT uuid, deleted FROM ${table}`).all();
  }
  db.close();
  return out;
}

function print(metrics) {
  const pad = (value, width) => String(value).padStart(width);
  console.log("── release metrics, by scope ──\n");
  console.log("  category            ENTITY  CANONICAL  REFERENCED   VISIBLE  ORPHANED");
  for (const row of metrics.rows) {
    console.log(`  ${row.label.padEnd(18)}${pad(row.entityTotal, 6)}${pad(row.canonicalTotal, 11)}` +
      `${pad(row.learnerReferenced, 12)}${pad(row.learnerVisible, 10)}${pad(row.orphaned, 10)}`);
  }

  console.log("\n── listening ──");
  console.log(`  LISTENING_ENTITY_TOTAL      ${metrics.listening.entityTotal}`);
  console.log(`  LISTENING_CANONICAL_TOTAL   ${metrics.listening.canonicalTotal}`);
  console.log(`  LISTENING_LEARNER_REFERENCED ${metrics.listening.learnerReferenced}`);
  console.log(`  LISTENING_WITH_AUDIO        ${metrics.listening.withAudio}`);
  console.log(`  LISTENING_WITHOUT_AUDIO     ${metrics.listening.withoutAudio}`);
  if (metrics.listening.unreferenced.length) {
    console.log(`  not referenced by any lesson: ${metrics.listening.unreferenced.join(", ")}`);
  }

  console.log("\n── referential integrity ──");
  console.log(`  ORPHANED_TOTAL ${metrics.integrity.total}` +
    `${metrics.integrity.ok ? "" : "  ← BROKEN"}`);
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const dbFile = path.resolve(process.cwd(), value("--db", "tools/intake/artifacts/intake.db"));
  const datasetFile = path.resolve(process.cwd(),
    value("--dataset", "01_APPLICATION/CURRENT_APP/data/canonical-content.json"));

  const canonical = JSON.parse(fs.readFileSync(datasetFile, "utf8")).entities;
  const source = readSource(dbFile);
  const metrics = releaseMetrics(source, canonical);

  if (args.includes("--json")) console.log(JSON.stringify(metrics, null, 2));
  else print(metrics);
  process.exitCode = metrics.integrity.ok ? 0 : 1;
}

if (process.argv[1]?.endsWith("release-metrics.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
