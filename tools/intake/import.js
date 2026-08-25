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
import {
  DRAFT_STATUS, isPublished, publishedOnly
} from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
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
  "byteSize", "durationMs", "checksum",
  /* Grammar, sentence and listening structure: which topic a rule belongs to, which
     rule a sentence practises, what an activity points at. */
  "topicUuid", "ruleUuid", "vocabUuid", "sentenceUuid", "itemUuid", "meaningUuid",
  "translationUuid", "exerciseUuid", "segmentUuid", "speakerUuid", "lessonUuid",
  "targetType", "targetUuid", "role", "category", "register", "variety", "required",
  "startMs", "endMs", "explanation", "pronunciation", "article", "plural", "itemType",
  "tags",
  /* `normalizedGerman`, `normalizedArabic` and `normalizedEnglish` are deliberately NOT
     here: each is a pure function of the text beside it, so it can never differ on its
     own. Treating a derived column as content would report a change whenever a mapper
     leaves it to the column default instead of computing it — a difference in who
     computed the value, not in what the row says. */
  /* Publication state. Promoting a row out of `draft` is a real change to what a learner
     can see, so an import that promotes one must be planned and written, not read as a
     row that already matches. */
  "contentStatus"
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
/*
 * Statuses an import may still write over.
 *
 * `imported` came from a source and can be refreshed from that source. `draft` was
 * authored but never published, so nothing a learner saw depends on it. Everything else
 * — a `verified` row a human signed off, a `legacy` row a learner built up — is a
 * decision this pipeline does not get to overwrite silently.
 */
const UPDATABLE_STATUSES = Object.freeze([IMPORTED_STATUS, DRAFT_STATUS]);

/**
 * How far along the lifecycle a status is.
 *
 * `draft` was authored, `imported` came from a source, `verified` was signed off by a
 * person. `legacy` is not on this path at all — it is what a learner built up before the
 * lifecycle existed — so it has no rank and is never overtaken.
 */
const LIFECYCLE_RANK = Object.freeze({ [DRAFT_STATUS]: 0, [IMPORTED_STATUS]: 1, verified: 2 });

const rankOf = status => LIFECYCLE_RANK[status];

/** The same row, with the lifecycle column set aside so only the content is compared. */
function sameBody(a, b) {
  const strip = row => {
    const fields = meaningfulFields(row);
    delete fields.contentStatus;
    return JSON.stringify(fields);
  };
  return strip(a) === strip(b);
}

/**
 * Whether this caller is allowed to revise a row that is already `verified`.
 *
 * The gate below exists to stop an importer silently overwriting something a PERSON signed
 * off. It is not meant to stop an author correcting their own material: DeutschFlow's own
 * lessons are written `verified` because this project is their author of record, and a
 * confirmed defect in one of them has to be fixable by re-running the authoring engine.
 *
 * So authority is explicit and narrow. A caller names the one `verifiedBy` identity it
 * speaks for, and may revise only rows carrying that identity AND written by that same
 * author. Every other verified row — anything an educator approved, anything imported —
 * still conflicts exactly as before. A caller that names nobody, which is every existing
 * caller, gets the old behaviour unchanged.
 */
function mayRevise(existing, authority) {
  if (!authority?.verifiedBy) return false;
  return existing.verifiedBy === authority.verifiedBy &&
    existing.sourceType === authority.sourceType;
}

export function classifyRow(existing, proposed, authority = null) {
  if (!existing) return { change: CHANGE.CREATE };
  if (sameContent(existing, proposed)) return { change: CHANGE.UNCHANGED };

  /*
   * The body is identical and only the review status differs.
   *
   * An importer always proposes the status the ARTIFACT declares, which is where the
   * content started. Once a person has moved a row further along — approved an Arabic
   * gloss, signed off a grammar rule — every later import arrives carrying stale news
   * about that row. Treating it as a conflict would stop the whole lesson re-importing
   * the moment review begins, and treating it as an update would quietly un-approve what
   * the person decided. So the further-along row simply wins, and the row is unchanged.
   *
   * An import that moves a row FORWARD is a real change and is written.
   */
  if (sameBody(existing, proposed)) {
    const stored = rankOf(existing.contentStatus);
    const incoming = rankOf(proposed.contentStatus);
    if (stored === undefined || incoming === undefined || incoming <= stored) {
      return { change: CHANGE.UNCHANGED };
    }
    return { change: CHANGE.UPDATE, before: meaningfulFields(existing), after: meaningfulFields(proposed) };
  }

  if (existing.contentStatus && !UPDATABLE_STATUSES.includes(existing.contentStatus) &&
      !mayRevise(existing, authority)) {
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
  const push = (entity, list) => {
    // A pruned batch carries an absent parent whose children still need writing.
    for (const row of list ?? []) if (row) rows.push({ entity, row });
  };

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
  /* Grammar before the sentences and exercises that reference a rule. */
  for (const entry of mapped.grammar ?? []) {
    push("grammarTopics", [entry.topic]);
    push("grammarRules", entry.rules);
    push("grammarExamples", entry.examples);
    push("grammarTexts", entry.texts);
  }

  for (const entry of mapped.sentences ?? []) {
    push("sentences", [entry.sentence]);
    push("sentenceTexts", entry.texts);
    push("sentenceVocabulary", entry.vocabulary);
    push("sentenceGrammar", entry.grammar);
    push("sentenceTags", entry.tags);
  }
  /* Assets registered in their own right, with no activity built on them. */
  push("audioAssets", mapped.audioAssets);

  /*
   * A batch may legitimately have no listening activity: source-only audio whose
   * lesson placement is unproven is a file, not something to listen to in a lesson.
   */
  if (mapped.listening?.item) {
    if (mapped.listening.audio) push("audioAssets", [mapped.listening.audio]);
    push("listeningItems", [mapped.listening.item]);
    push("listeningTexts", mapped.listening.texts);
    push("listeningSpeakers", mapped.listening.speakers);
    push("listeningSegments", mapped.listening.segments);
    push("listeningSegmentTexts", mapped.listening.segmentTexts);
    push("listeningLinks", mapped.listening.links);
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
export async function planImport(repositories, mapped, options = {}) {
  const rows = flattenRows(mapped);
  const entries = [];

  for (const { entity, row } of rows) {
    const existing = await repositoryFor(repositories, entity).get(row.uuid);
    entries.push({ entity, uuid: row.uuid, ...classifyRow(existing, row, options.authority) });
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
 * Drop from a mapped batch every row the store already holds unchanged.
 *
 * Pure. It returns a batch of the same shape carrying only rows that would really
 * create or update, plus what was skipped, so an import can report honestly that it
 * reused rows rather than pretending it wrote them.
 *
 * A parent is dropped independently of its children: an unchanged course whose twelfth
 * chapter is new must write the chapter and leave the course row alone, which is why
 * the aggregate writers accept an absent parent.
 */
export function pruneUnchanged(mapped, unchanged) {
  const skip = new Set(unchanged ?? []);
  const keep = row => Boolean(row) && !skip.has(row.uuid);
  const one = row => (keep(row) ? row : null);
  const filter = rows => (rows ?? []).filter(keep);

  const skipped = { vocabulary: 0 };

  const course = {
    course: one(mapped.course.course),
    levels: filter(mapped.course.levels),
    units: filter(mapped.course.units),
    lessons: filter(mapped.course.lessons),
    sections: filter(mapped.course.sections),
    items: filter(mapped.course.items),
    prerequisites: mapped.course.prerequisites ?? [],
    texts: filter(mapped.course.texts)
  };

  /*
   * An aggregate is kept when ANY of its rows still needs writing, with its unchanged
   * rows pruned out, so a sentence whose Arabic translation was corrected rewrites the
   * translation without touching the sentence.
   */
  const vocabulary = (mapped.vocabulary ?? []).map(entry => ({
    item: one(entry.item),
    meanings: filter(entry.meanings),
    translations: filter(entry.translations),
    acceptedAnswers: filter(entry.acceptedAnswers)
  })).filter(entry => {
    const pending = Boolean(entry.item) || entry.meanings.length ||
      entry.translations.length || entry.acceptedAnswers.length;
    if (!pending) skipped.vocabulary += 1;
    return pending;
  });

  const sentences = (mapped.sentences ?? []).map(entry => ({
    sentence: one(entry.sentence),
    texts: filter(entry.texts),
    vocabulary: filter(entry.vocabulary),
    grammar: filter(entry.grammar),
    tags: filter(entry.tags)
  })).filter(entry => Boolean(entry.sentence) || entry.texts.length ||
    entry.vocabulary.length || entry.grammar.length || entry.tags.length);

  const grammar = (mapped.grammar ?? []).map(entry => ({
    topic: one(entry.topic),
    rules: filter(entry.rules),
    examples: filter(entry.examples),
    texts: filter(entry.texts)
  })).filter(entry => Boolean(entry.topic) || entry.rules.length ||
    entry.examples.length || entry.texts.length);

  const exercises = (mapped.exercises ?? []).map(entry => ({
    exercise: one(entry.exercise),
    texts: filter(entry.texts),
    options: filter(entry.options),
    targets: filter(entry.targets)
  })).filter(entry => Boolean(entry.exercise) || entry.texts.length ||
    entry.options.length || entry.targets.length);

  /*
   * A listening activity is kept or dropped whole, but its CHILD rows are pruned.
   *
   * The item has to survive: its rows are only ever planned when it is present, so
   * pruning it out from under its own segments would hide them from the row count and
   * silently drop a real change. Its texts and segments are a different matter — writing
   * one the store already holds would overwrite whatever lifecycle state that row has
   * reached, which is how a transcript line an educator had verified came back as merely
   * imported the next time an unrelated row in the same activity changed.
   */
  const listeningRows = mapped.listening?.item
    ? [mapped.listening.audio, mapped.listening.item, ...(mapped.listening.texts ?? []),
       ...(mapped.listening.speakers ?? []), ...(mapped.listening.segments ?? []),
       ...(mapped.listening.segmentTexts ?? []), ...(mapped.listening.links ?? [])]
    : [];
  const listening = listeningRows.some(keep)
    ? {
        ...mapped.listening,
        texts: filter(mapped.listening.texts),
        speakers: filter(mapped.listening.speakers),
        segments: filter(mapped.listening.segments),
        segmentTexts: filter(mapped.listening.segmentTexts),
        links: filter(mapped.listening.links)
      }
    : null;

  const batch = {
    ...mapped,
    course,
    audioAssets: filter(mapped.audioAssets),
    vocabulary,
    grammar,
    sentences,
    exercises,
    listening
  };
  const rowCount = flattenRows(batch).length;

  return { batch, rowCount, skipped, skippedTotal: flattenRows(mapped).length - rowCount };
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
   * Consult the diff BEFORE writing.
   *
   * An upsert is never free: on conflict it advances the revision and updated_at of the
   * row even when every meaningful field is identical. Rewriting rows the store already
   * holds unchanged would make a re-run indistinguishable from an edit, and would erode
   * `revision` as the signal that content actually moved.
   *
   * The plan already decides this, over exactly the fields that carry meaning, so the
   * batch is pruned to what would really create or update. A caller that has already
   * planned can pass its plan in rather than paying for the read twice.
   */
  const plan = options.plan ?? await planImport(repositories, mapped);
  const pending = pruneUnchanged(mapped, plan.unchanged.map(entry => entry.uuid));

  if (!pending.rowCount) {
    // Nothing to write: no transaction is opened and no row is touched at all.
    return {
      courses: 0, audioAssets: 0, vocabulary: 0,
      vocabularyReused: pending.skipped.vocabulary,
      grammar: 0, sentences: 0, listening: 0, exercises: 0,
      skippedUnchanged: pending.skippedTotal
    };
  }

  /*
   * ONE transaction around the whole batch, not one per aggregate. Each aggregate is
   * already atomic, but a failure in a later one used to leave earlier ones committed —
   * a half-imported lesson that reads as a real one. Nesting runs inline (the adapter
   * tracks depth), so the outermost call owns the single commit and rollback.
   */
  return repositories.lifecycle.transaction(() => writeBatch(repositories, pending, now));
}

async function writeBatch(repositories, pending, now) {
  const mapped = pending.batch;
  const written = {
    courses: 0, audioAssets: 0, vocabulary: 0,
    // A row the store already holds unchanged is reused, never rewritten.
    vocabularyReused: pending.skipped.vocabulary,
    grammar: 0, sentences: 0, listening: 0, exercises: 0,
    skippedUnchanged: pending.skippedTotal
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
  written.courses = mapped.course.course ? 1 : 0;

  /*
   * Source-only assets are registered in their own right. They are upserted rather than
   * inserted so a re-run refreshes measured metadata without duplicating a file, and
   * they are written before anything that might reference them.
   */
  for (const asset of mapped.audioAssets ?? []) {
    await repositories.audioAssets.upsert(asset, { now });
    written.audioAssets += 1;
  }

  /*
   * Grammar before anything that references a rule: a sentence links to one, and an
   * exercise targets one. Written through the aggregate writer, so a topic, its rules,
   * their examples and every text land together or not at all.
   */
  for (const entry of mapped.grammar ?? []) {
    await repositories.write.content.saveGrammarTopic(entry, { now });
    written.grammar += 1;
  }

  for (const entry of mapped.vocabulary ?? []) {
    /*
     * A word already stored under this course-scoped identity is the same word with the
     * same meaning, so it is NOT rewritten: the row keeps the provenance of the page it
     * was first read from, and this lesson joins it through lesson_items instead.
     * Rewriting would silently move the citation to whichever episode imported last.
     */
    const reused = Boolean(entry.item) && await repositories.vocabulary.exists(entry.item.uuid);
    if (!entry.item || reused) {
      written.vocabularyReused += 1;
      /*
       * The ITEM is not rewritten — that is what keeps the citation of the page it was
       * first read from. Its meanings, translations and accepted answers are a different
       * question: the diff already pruned this batch to rows that really would change, so
       * anything still here is new or corrected and belongs in the store. Skipping the
       * whole aggregate would mean no child of an existing word could ever be written
       * again, which is exactly what stranded the pairings an educator had just approved.
       */
      const children = { ...entry, item: null };
      const pending = children.meanings.length || children.translations.length ||
        children.acceptedAnswers.length;
      if (!pending) continue;
      await repositories.write.content.saveVocabulary(children, { now });
      continue;
    }
    await repositories.write.content.saveVocabulary(entry, { now });
    written.vocabulary += 1;
  }
  for (const entry of mapped.sentences ?? []) {
    await repositories.write.content.saveSentence(entry, { now });
    written.sentences += 1;
  }

  if (mapped.listening?.item) {
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
      // Only the items are hung here; the course row is already correct.
      course: null,
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
  /*
   * A batch may claim one lesson or a whole course of them, so both key shapes are
   * honoured and every claimed lesson has to be readable back.
   */
  const claimedLessons = mapped.keys.lessonUuids ??
    (mapped.keys.lessonUuid ? [mapped.keys.lessonUuid] : []);
  const assembledLessons = course ? course.units.flatMap(unit => unit.lessons) : [];
  const foundLessons = claimedLessons
    .map(uuid => assembledLessons.find(entry => entry.uuid === uuid) ?? null);
  const missingLessons = claimedLessons.filter((uuid, index) => !foundLessons[index]);
  const lesson = foundLessons.find(Boolean) ?? null;

  /* Listening is verified only when the batch claimed one. */
  const activity = mapped.listening
    ? (await services.listening.activities())
        .find(a => a.uuid === mapped.keys.listeningUuid) ?? null
    : null;
  const allExercises = await services.exercises.all();
  /* Only exercises this batch PUBLISHES should read back: a draft is stored and stays
     invisible on purpose, so counting it as missing would fail every review gate. */
  const publishedExercises = (mapped.exercises ?? [])
    .filter(entry => isPublished(entry.exercise));
  const exerciseUuids = new Set(publishedExercises.map(entry => entry.exercise.uuid));
  const exercises = allExercises.filter(exercise => exerciseUuids.has(exercise.uuid));

  const grammarReport = await verifyGrammar(services, mapped);
  const linkReport = await verifyLinks(mapped, options.repositories ?? null);
  const draftReport = await verifyDrafts(mapped, options.repositories ?? null);
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
    lessons: assembledLessons.length,
    claimedLessons: claimedLessons.length,
    missingLessons,
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
      claimed: publishedExercises.length,
      gradeable: exercises.filter(exercise => exercise.gradeable).length,
      ungradeable: exercises.filter(exercise => !exercise.gradeable).length
    },
    grammar: grammarReport,
    links: linkReport,
    drafts: draftReport,
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
    ok: Boolean(course) && Boolean(lesson) && missingLessons.length === 0 &&
      audioReport.missingUuids.length === 0 &&
      audioReport.mismatchedUuids.length === 0 &&
      audioReport.playable === 0 &&
      audioReport.found === audioReport.expected &&
      exercises.length === publishedExercises.length &&
      grammarReport.missingTopics.length === 0 &&
      grammarReport.missingRules.length === 0 &&
      linkReport.missing.length === 0 &&
      draftReport.notStored.length === 0 &&
      draftReport.visible.length === 0 &&
      (!mapped.listening || Boolean(activity))
  };
}

/** Grammar the batch published must assemble back through the grammar service. */
async function verifyGrammar(services, mapped) {
  const topics = (mapped.grammar ?? []).map(entry => entry.topic).filter(isPublished);
  const rules = (mapped.grammar ?? []).flatMap(entry => entry.rules ?? []).filter(isPublished);
  const report = {
    expectedTopics: topics.length, expectedRules: rules.length,
    topics: 0, rules: 0, missingTopics: [], missingRules: []
  };
  if (!topics.length && !rules.length) return report;

  const assembled = await services.grammar.topics();
  const byUuid = new Map(assembled.map(topic => [topic.uuid, topic]));
  const assembledRules = new Set(assembled.flatMap(topic => topic.rules.map(rule => rule.uuid)));

  for (const topic of topics) {
    if (byUuid.has(topic.uuid)) report.topics += 1;
    else report.missingTopics.push(topic.uuid);
  }
  for (const rule of rules) {
    if (assembledRules.has(rule.uuid)) report.rules += 1;
    else report.missingRules.push(rule.uuid);
  }
  return report;
}

/**
 * Relationship rows carry no lifecycle of their own, so they are read straight back from
 * the store. A link the batch wrote and cannot find again means the aggregate writer
 * dropped it, which no service would reveal — a sentence simply loses its vocabulary.
 */
async function verifyLinks(mapped, repositories) {
  const expected = {
    sentenceVocabulary: (mapped.sentences ?? []).flatMap(entry => entry.vocabulary ?? []),
    sentenceGrammar: (mapped.sentences ?? []).flatMap(entry => entry.grammar ?? []),
    exerciseTargets: (mapped.exercises ?? []).flatMap(entry => entry.targets ?? []),
    listeningLinks: mapped.listening?.links ?? [],
    lessonItems: mapped.course?.items ?? []
  };
  const report = { expected: 0, found: 0, missing: [], byEntity: {} };
  for (const [entity, rows] of Object.entries(expected)) {
    report.byEntity[entity] = rows.length;
    report.expected += rows.length;
  }
  if (!report.expected || !repositories) return report;

  for (const [entity, rows] of Object.entries(expected)) {
    for (const row of rows) {
      if (await repositoryFor(repositories, entity).get(row.uuid)) report.found += 1;
      else report.missing.push({ entity, uuid: row.uuid });
    }
  }
  return report;
}

/**
 * The review gate, checked rather than assumed.
 *
 * Every row the batch marked `draft` must be IN the store — it cannot be reviewed if it
 * was never imported — and must be invisible through the published view every service
 * reads from. Both halves matter: the first stops the gate becoming data loss, the
 * second stops it becoming decoration.
 */
async function verifyDrafts(mapped, repositories) {
  const drafts = flattenRows(mapped).filter(({ row }) => row.contentStatus === DRAFT_STATUS);
  const report = { rows: drafts.length, stored: 0, notStored: [], visible: [] };
  if (!drafts.length || !repositories) return report;

  const readable = publishedOnly(repositories);
  for (const { entity, row } of drafts) {
    if (await repositoryFor(repositories, entity).get(row.uuid)) report.stored += 1;
    else report.notStored.push({ entity, uuid: row.uuid });

    if (await repositoryFor(readable, entity).get(row.uuid)) {
      report.visible.push({ entity, uuid: row.uuid });
    }
  }
  return report;
}
