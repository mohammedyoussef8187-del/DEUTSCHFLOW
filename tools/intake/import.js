/*
 * Stages 6–8 of the intake pipeline: PREVIEW/DIFF → IMPORT TRANSACTION → VERIFY.
 *
 * The diff exists to answer one question before anything is written: would this import
 * CHANGE something that already exists, and did a human verify that something?
 *
 *   - a row that is absent    -> create
 *   - a row that is identical -> unchanged (this is what makes a re-import a no-op)
 *   - a row that differs and is still `imported` -> update, because nobody has reviewed it
 *   - a row that differs and is `verified`       -> CONFLICT, and the import stops
 *
 * The last case is the important one. Verified wording is the product of human review,
 * and a source that changed underneath must produce an explicit decision, never a silent
 * overwrite. Conflicts are reported with both texts so the difference is visible.
 *
 * Writing goes through the repository write APIs, so every aggregate is transactional
 * and no SQL is issued here.
 */

import { IMPORTED_STATUS } from "./map-canonical.js";
import { REPOSITORY_ALIASES } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";

/* The repository layer renames a few entities; resolve a schema entity to its repo. */
const ENTITY_TO_REPO = Object.fromEntries(
  Object.entries(REPOSITORY_ALIASES).map(([alias, entity]) => [entity, alias])
);

export function repositoryFor(repositories, entity) {
  const repo = repositories[ENTITY_TO_REPO[entity] ?? entity];
  if (!repo) throw new Error(`No repository for canonical entity ${entity}`);
  return repo;
}

export const CHANGE = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  UNCHANGED: "unchanged",
  CONFLICT: "conflict"
});

/* Fields that carry meaning. A differing timestamp or revision is not a content change. */
const MEANINGFUL = Object.freeze([
  "german", "text", "slug", "arabicText", "englishText", "title", "cefrLevel", "level",
  "activityType", "exerciseType", "answerLanguage", "isExpected", "scoreable", "label",
  "ordering", "contentType", "contentUuid", "sectionKind", "language", "kind",
  "sourceTitle", "sourcePublisher", "sourceReference",
  /* Structural links and source-asset identity: a changed parent, path, digest or
     measured duration is a real content change, not bookkeeping. */
  "courseUuid", "courseLevelUuid", "unitUuid", "ownerType", "ownerUuid",
  "sourceEdition", "sourceIsbn", "sourceType", "contentVersion",
  "availability", "localPath", "sourcePath", "remoteUrl", "mimeType",
  "byteSize", "durationMs", "checksum"
]);

export function meaningfulFields(row) {
  const out = {};
  for (const field of MEANINGFUL) if (row[field] !== undefined) out[field] = row[field];
  return out;
}

function sameContent(a, b) {
  return JSON.stringify(meaningfulFields(a)) === JSON.stringify(meaningfulFields(b));
}

/**
 * Compare one proposed row against what the store holds.
 * @param {object} existing row already in the store, or null
 * @param {object} proposed row produced by the mapper
 */
export function classifyRow(existing, proposed) {
  if (!existing) return { change: CHANGE.CREATE };
  if (sameContent(existing, proposed)) return { change: CHANGE.UNCHANGED };
  if (existing.contentStatus && existing.contentStatus !== IMPORTED_STATUS) {
    return {
      change: CHANGE.CONFLICT,
      reason: `stored row is ${existing.contentStatus}; a source change must be reviewed`,
      before: meaningfulFields(existing),
      after: meaningfulFields(proposed)
    };
  }
  return { change: CHANGE.UPDATE, before: meaningfulFields(existing), after: meaningfulFields(proposed) };
}

/** Every row a mapping would write, flattened with the entity it belongs to. */
export function flattenRows(mapped) {
  const rows = [];
  const push = (entity, list) => { for (const row of list ?? []) rows.push({ entity, row }); };

  push("courses", [mapped.course.course]);
  push("courseLevels", mapped.course.levels);
  push("courseUnits", mapped.course.units);
  push("lessons", mapped.course.lessons);
  push("lessonSections", mapped.course.sections);
  push("lessonItems", mapped.course.items);
  push("curriculumTexts", mapped.course.texts);

  for (const entry of mapped.vocabulary ?? []) {
    push("vocabularyItems", [entry.item]);
    push("vocabularyMeanings", entry.meanings);
    push("translations", entry.translations);
    push("acceptedAnswers", entry.acceptedAnswers);
  }
  for (const entry of mapped.sentences ?? []) {
    push("sentences", [entry.sentence]);
    push("sentenceTexts", entry.texts);
  }
  /* Assets registered in their own right, with no activity built on them. */
  push("audioAssets", mapped.audioAssets);

  /*
   * A batch may legitimately have no listening activity: source-only audio whose
   * lesson placement is unproven is a file, not something to listen to in a lesson.
   */
  if (mapped.listening) {
    if (mapped.listening.audio) push("audioAssets", [mapped.listening.audio]);
    push("listeningItems", [mapped.listening.item]);
    push("listeningTexts", mapped.listening.texts);
    push("listeningSpeakers", mapped.listening.speakers);
    push("listeningSegments", mapped.listening.segments);
    push("listeningSegmentTexts", mapped.listening.segmentTexts);
  }

  for (const entry of mapped.exercises ?? []) {
    push("exercises", [entry.exercise]);
    push("exerciseTexts", entry.texts);
    push("exerciseOptions", entry.options);
    push("exerciseTargets", entry.targets);
  }
  return rows;
}

/**
 * Build the plan by reading what is already stored.
 * Read-only: it opens nothing it does not close and writes nothing at all.
 */
export async function planImport(repositories, mapped) {
  const rows = flattenRows(mapped);
  const entries = [];

  for (const { entity, row } of rows) {
    const existing = await repositoryFor(repositories, entity).get(row.uuid);
    entries.push({ entity, uuid: row.uuid, ...classifyRow(existing, row) });
  }

  const by = change => entries.filter(entry => entry.change === change);
  return {
    entries,
    create: by(CHANGE.CREATE),
    update: by(CHANGE.UPDATE),
    unchanged: by(CHANGE.UNCHANGED),
    conflicts: by(CHANGE.CONFLICT),
    total: entries.length,
    // A plan that would write nothing is exactly what a second run should produce.
    isNoop: by(CHANGE.CREATE).length === 0 && by(CHANGE.UPDATE).length === 0
  };
}

/**
 * Apply a mapping through the repository write APIs.
 *
 * Order matters because foreign keys do: the course frame before the content that hangs
 * off it, and the vocabulary before the exercises that target it. Each aggregate is its
 * own transaction, and any failure rolls that aggregate back whole.
 */
export async function applyImport(repositories, mapped, options = {}) {
  const now = options.now ?? Date.now();
  if (!repositories.write) throw new Error("This store is read-only; nothing was imported");

  /*
   * ONE transaction around the whole batch, not one per aggregate. Each aggregate is
   * already atomic, but a failure in a later one used to leave earlier ones committed —
   * a half-imported lesson that reads as a real one. Nesting runs inline (the adapter
   * tracks depth), so the outermost call owns the single commit and rollback.
   */
  return repositories.lifecycle.transaction(() => writeBatch(repositories, mapped, now));
}

async function writeBatch(repositories, mapped, now) {
  const written = {
    courses: 0, audioAssets: 0, vocabulary: 0, vocabularyReused: 0,
    sentences: 0, listening: 0, exercises: 0
  };

  await repositories.write.content.saveCourse({
    course: mapped.course.course,
    levels: mapped.course.levels,
    units: mapped.course.units,
    lessons: mapped.course.lessons,
    sections: mapped.course.sections,
    // Items reference content that does not exist yet, so they are written last.
    items: [],
    prerequisites: mapped.course.prerequisites,
    texts: mapped.course.texts
  }, { now });
  written.courses = 1;

  /*
   * Source-only assets are registered in their own right. They are upserted rather than
   * inserted so a re-run refreshes measured metadata without duplicating a file, and
   * they are written before anything that might reference them.
   */
  for (const asset of mapped.audioAssets ?? []) {
    await repositories.audioAssets.upsert(asset, { now });
    written.audioAssets += 1;
  }

  for (const entry of mapped.vocabulary ?? []) {
    /*
     * A word already stored under this course-scoped identity is the same word with the
     * same meaning, so it is NOT rewritten: the row keeps the provenance of the page it
     * was first read from, and this lesson joins it through lesson_items instead.
     * Rewriting would silently move the citation to whichever episode imported last.
     */
    if (await repositories.vocabulary.exists(entry.item.uuid)) {
      written.vocabularyReused += 1;
      continue;
    }
    await repositories.write.content.saveVocabulary(entry, { now });
    written.vocabulary += 1;
  }
  for (const entry of mapped.sentences ?? []) {
    await repositories.write.content.saveSentence(entry, { now });
    written.sentences += 1;
  }

  if (mapped.listening) {
    await repositories.write.content.saveListening(mapped.listening, { now });
    written.listening = 1;
  }

  for (const entry of mapped.exercises ?? []) {
    await repositories.write.content.saveExercise({
      exercise: entry.exercise, texts: entry.texts,
      options: entry.options, targets: entry.targets
    }, { now });
    written.exercises += 1;
  }

  // Now that every referenced piece of content exists, hang the lesson items on it.
  // A slice with no eligible content has no items, and a second write would only
  // bump the course revision for nothing.
  if ((mapped.course.items ?? []).length) {
    await repositories.write.content.saveCourse({
      course: mapped.course.course,
      levels: [], units: [], lessons: [], sections: [],
      items: mapped.course.items,
      prerequisites: [], texts: []
    }, { now });
  }

  return written;
}

/**
 * Prove the import landed: read it back through the SERVICES, the same way a screen
 * would, rather than by counting rows in tables.
 */
export async function verifyImport(services, mapped, profileUuid = "local", options = {}) {
  const courses = await services.curriculum.courses();
  const course = courses.find(candidate => candidate.uuid === mapped.keys.courseUuid) ?? null;
  const lesson = course
    ? course.units.flatMap(unit => unit.lessons).find(l => l.uuid === mapped.keys.lessonUuid) ?? null
    : null;

  /* Listening is verified only when the batch claimed one. */
  const activity = mapped.listening
    ? (await services.listening.activities())
        .find(a => a.uuid === mapped.keys.listeningUuid) ?? null
    : null;
  const allExercises = await services.exercises.all();
  const exerciseUuids = new Set(mapped.exercises.map(entry => entry.exercise.uuid));
  const exercises = allExercises.filter(exercise => exerciseUuids.has(exercise.uuid));
  const progress = course ? await services.curriculum.progressForCourse(course.slug, profileUuid) : null;

  /*
   * Source-only assets are read back from the repository, not from a service: they are
   * deliberately not part of any activity, so no service assembles them. Every field
   * that establishes identity is compared, because a registered asset whose digest or
   * measured duration drifted is a different file wearing the same name.
   */
  const expectedAssets = mapped.audioAssets ?? [];
  const audioReport = { expected: expectedAssets.length, found: 0, sourceOnly: 0, playable: 0,
    missingUuids: [], mismatchedUuids: [] };

  if (expectedAssets.length) {
    const repositories = options.repositories;
    if (!repositories) throw new TypeError("Verifying audio assets needs the repositories");
    for (const expected of expectedAssets) {
      const stored = await repositories.audioAssets.get(expected.uuid);
      if (!stored) { audioReport.missingUuids.push(expected.uuid); continue; }
      audioReport.found += 1;
      if (stored.availability === "source-only" && stored.localPath === "") audioReport.sourceOnly += 1;
      else audioReport.playable += 1;

      const differs = ["slug", "sourcePath", "checksum", "byteSize", "durationMs", "mimeType"]
        .some(field => stored[field] !== expected[field]) || stored.remoteUrl != null;
      if (differs) audioReport.mismatchedUuids.push(expected.uuid);
    }
  }

  return {
    course: course ? { slug: course.slug, cefrLevel: course.cefrLevel, title: course.title } : null,
    lessons: course ? course.units.flatMap(unit => unit.lessons).length : 0,
    lesson: lesson ? { slug: lesson.slug, sections: lesson.sections.length,
      items: lesson.sections.reduce((sum, section) => sum + section.items.length, 0) } : null,
    listening: activity ? {
      slug: activity.slug, segments: activity.segments.length,
      speakers: activity.speakers.length, studyable: activity.studyable,
      audioIssue: activity.audio.missingReason,
      hasTranscript: Boolean(activity.transcript)
    } : null,
    exercises: {
      total: exercises.length,
      gradeable: exercises.filter(exercise => exercise.gradeable).length,
      ungradeable: exercises.filter(exercise => !exercise.gradeable).length
    },
    vocabulary: (await services.content.allEntries())
      .filter(entry => entry.uuid && mapped.vocabulary.some(v => v.item.uuid === entry.uuid)).length,
    progress: progress ? { lessonsTotal: progress.lessonsTotal, resume: progress.resume.reason } : null,
    audioAssets: audioReport,
    // The source has no English, and the assembled content must say so rather than hide it.
    englishMissing: course ? course.coverage.missing.includes("en") : null,

    /*
     * One verdict the caller can commit on. Everything the batch claimed must be
     * readable back; listening is required only when the batch actually claimed one.
     */
    ok: Boolean(course) && Boolean(lesson) &&
      audioReport.missingUuids.length === 0 &&
      audioReport.mismatchedUuids.length === 0 &&
      audioReport.playable === 0 &&
      audioReport.found === audioReport.expected &&
      exercises.length === (mapped.exercises ?? []).length &&
      (!mapped.listening || Boolean(activity))
  };
}
