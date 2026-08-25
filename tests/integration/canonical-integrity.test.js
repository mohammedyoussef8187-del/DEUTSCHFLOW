// @vitest-environment happy-dom
/*
 * The shipped dataset must be a closed graph.
 *
 * Publication is a per-ROW decision and a dataset is a graph, so hiding a parent used to
 * leave its children exported and pointing at nothing. Those rows never reached a learner
 * — every reader walks the tree from a course downwards and simply never arrived at them
 * — which is exactly why the defect survived: it was invisible from the screens and
 * visible only in the counts, where it made the product look larger than it was.
 *
 * These tests run against `data/canonical-content.json`, the file the browser actually
 * downloads, rather than against an authoring fixture. A fixture can be closed while the
 * artefact that ships is not.
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  declaredReferences, findOrphans, integrityReport, POLYMORPHIC_REFERENCES, pruneOrphans
} from "../../01_APPLICATION/CURRENT_APP/src/content/referential-integrity.js";
import { readShippedContent } from "../support/learner-journey-harness.js";

let entities;
let report;

beforeAll(() => {
  entities = readShippedContent().entities;
  report = integrityReport(entities);
});

const alive = rows => (rows ?? []).filter(row => !row.deleted);
const idsOf = rows => new Set(alive(rows).map(row => row.uuid));

describe("no exported row references a parent that was not exported", () => {
  /* The named zeros the release gate is written against. */
  const cases = [
    ["ORPHAN_COURSE_LEVELS", "courseLevels"],
    ["ORPHAN_COURSE_UNITS", "courseUnits"],
    ["ORPHAN_LESSONS", "lessons"],
    ["ORPHAN_LESSON_SECTIONS", "lessonSections"],
    ["ORPHAN_LESSON_ITEMS", "lessonItems"],
    ["ORPHAN_CURRICULUM_TEXTS", "curriculumTexts"]
  ];

  for (const [name, entity] of cases) {
    it(`${name} = 0`, () => {
      expect(report.orphans[entity] ?? [], name).toEqual([]);
    });
  }

  it("INVALID_REFERENCES = 0 across every entity, named or not", () => {
    /*
     * The list above is the one a release checklist reads; this is the one that catches a
     * relationship nobody thought to name — including any added to the schema later.
     */
    expect(report.counts).toEqual({});
    expect(report.total).toBe(0);
  });

  it("resolves every polymorphic reference to a known table", () => {
    expect(report.unknownTypes).toEqual([]);
  });
});

describe("the relationships are taken from the schema, not from a list", () => {
  it("derives the curriculum spine from the DDL", () => {
    const edges = declaredReferences()
      .map(reference => `${reference.entity}.${reference.field}→${reference.target}`);

    for (const expected of [
      "courseLevels.courseUuid→courses",
      "courseUnits.courseUuid→courses",
      "lessons.unitUuid→courseUnits",
      "lessonSections.lessonUuid→lessons",
      "lessonItems.sectionUuid→lessonSections"
    ]) {
      expect(edges, expected).toContain(expected);
    }
  });

  it("treats a NOT NULL reference as required and a nullable one as optional", () => {
    const references = declaredReferences();
    const required = references.find(
      reference => reference.entity === "lessonItems" && reference.field === "sectionUuid");
    const optional = references.find(
      reference => reference.entity === "listeningItems" && reference.field === "audioUuid");

    expect(required?.optional).toBe(false);
    /* A listening activity with no recording is a real activity, not a broken row. */
    expect(optional?.optional).toBe(true);
  });

  it("covers both polymorphic edges the DDL cannot express", () => {
    expect(POLYMORPHIC_REFERENCES.map(reference => reference.entity).sort())
      .toEqual(["curriculumTexts", "lessonItems"]);
  });
});

describe("every learner-visible object resolves through a complete parent chain", () => {
  it("walks course → unit → lesson → section → item → referenced content", () => {
    const courses = idsOf(entities.courses);
    expect(courses.size).toBeGreaterThan(0);

    const units = alive(entities.courseUnits);
    expect(units.every(unit => courses.has(unit.courseUuid))).toBe(true);

    const unitIds = idsOf(units);
    const lessons = alive(entities.lessons);
    expect(lessons.every(lesson => unitIds.has(lesson.unitUuid))).toBe(true);

    const lessonIds = idsOf(lessons);
    const sections = alive(entities.lessonSections);
    expect(sections.every(section => lessonIds.has(section.lessonUuid))).toBe(true);

    const sectionIds = idsOf(sections);
    const items = alive(entities.lessonItems);
    expect(items.every(item => sectionIds.has(item.sectionUuid))).toBe(true);

    /* And the far end of each item: the content object it names must be present. */
    const byType = {
      vocabulary: idsOf(entities.vocabularyItems),
      exercise: idsOf(entities.exercises),
      sentence: idsOf(entities.sentences),
      listening: idsOf(entities.listeningItems),
      grammar_rule: idsOf(entities.grammarRules),
      grammar_topic: idsOf(entities.grammarTopics)
    };
    const grammar = new Set([...byType.grammar_rule, ...byType.grammar_topic]);

    const dangling = items.filter(item => {
      const target = item.contentType === "grammar" ? grammar : byType[item.contentType];
      return !target || !target.has(item.contentUuid);
    }).map(item => `${item.contentType} ${item.contentUuid}`);
    expect(dangling).toEqual([]);
  });

  it("INVALID_LISTENING_REFERENCES = 0", () => {
    const assets = idsOf(entities.audioAssets);
    const speakers = idsOf(entities.listeningSpeakers);
    const items = idsOf(entities.listeningItems);
    const segments = idsOf(entities.listeningSegments);

    /* audioUuid is nullable by design; a value that is present must resolve. */
    const badAudio = alive(entities.listeningItems)
      .filter(item => item.audioUuid && !assets.has(item.audioUuid)).map(item => item.slug);
    expect(badAudio).toEqual([]);

    for (const [entity, field, target] of [
      ["listeningTexts", "itemUuid", items],
      ["listeningSpeakers", "itemUuid", items],
      ["listeningSegments", "itemUuid", items],
      ["listeningSegmentTexts", "segmentUuid", segments],
      ["listeningLinks", "itemUuid", items]
    ]) {
      const broken = alive(entities[entity])
        .filter(row => row[field] && !target.has(row[field])).map(row => row.uuid);
      expect(broken, `${entity}.${field}`).toEqual([]);
    }

    const badSpeaker = alive(entities.listeningSegments)
      .filter(row => row.speakerUuid && !speakers.has(row.speakerUuid)).map(row => row.uuid);
    expect(badSpeaker).toEqual([]);
  });
});

describe("pruning is a filter, and it converges", () => {
  it("leaves an already-closed dataset exactly as it was", () => {
    const pruned = pruneOrphans(entities);
    expect(pruned.removedTotal).toBe(0);
    for (const [entity, rows] of Object.entries(entities)) {
      expect(pruned.entities[entity]?.length, entity).toBe(rows.length);
    }
  });

  it("removes a whole broken chain, not only its first link", () => {
    /*
     * Withhold one course and everything under it must go: its level, its units, their
     * lessons, those lessons' sections and items, and every text owned by any of them.
     * A single pass would drop the units and leave the lessons dangling, which is the
     * exact shape of the defect this module exists to prevent.
     */
    const victim = entities.courses[0];
    const damaged = { ...entities, courses: entities.courses.slice(1) };

    expect(findOrphans(damaged).total).toBeGreaterThan(0);

    const pruned = pruneOrphans(damaged);
    expect(pruned.passes).toBeGreaterThan(1);
    expect(findOrphans(pruned.entities).total).toBe(0);

    const survivingUnits = idsOf(pruned.entities.courseUnits);
    for (const unit of alive(entities.courseUnits)) {
      if (unit.courseUuid === victim.uuid) {
        expect(survivingUnits.has(unit.uuid), `unit ${unit.slug} should be gone`).toBe(false);
      }
    }

    /* And nothing belonging to the other course was taken down with it. */
    expect(pruned.entities.courses.length).toBe(entities.courses.length - 1);
    expect(alive(pruned.entities.lessons).length).toBeGreaterThan(0);
  });
});
