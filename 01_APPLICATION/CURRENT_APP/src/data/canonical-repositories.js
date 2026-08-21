/*
 * Canonical repository layer over the SQLite persistence adapter.
 *
 * This is the seam the learning/domain engines and UI use to reach durable storage.
 * They call these repositories; the repositories call the injected persistence adapter;
 * only the adapter speaks SQL. No SQLite driver, SQL string, or table name leaks above
 * this layer (DECISION_LOG DF-004 / DF-010: Application Core -> Repository -> Persistence
 * Adapter -> Platform Storage).
 *
 * Each entity exposes exactly the operations its write policy allows, so the shape of
 * the repository IS the invariant:
 *
 *   - append-only history (review events, error events, spoken attempts, quarantine)
 *     has `insert` and no `update`, because rewriting history is not an operation;
 *   - anything a learner earned has `softDelete` and no `hardDelete`;
 *   - `cards` is read-only here. SRS state moves only through `srs.applyScheduledCard`,
 *     which is named separately so every such write is visible at its call site.
 *
 * The `write` namespace holds the multi-row operations that must be atomic: a sentence
 * and its translations, a lesson completion and its sections, an error event and its
 * classifications. Each runs in one transaction, so a half-written aggregate cannot
 * survive a failure.
 */

import { policyFor } from "../platform/sqlite/write-policy.js";

export function createCanonicalRepositories(adapter) {
  if (!adapter) throw new TypeError("A persistence adapter is required");

  /** Reads available on every entity. */
  const reads = entity => ({
    all: () => adapter.selectAll(entity),
    get: uuid => adapter.getByUuid(entity, uuid),
    exists: uuid => adapter.exists(entity, uuid),
    find: (where, options) => adapter.find(entity, where, options),
    findOne: (where, options) => adapter.findOne(entity, where, options),
    count: (where, options) => adapter.countWhere(entity, where, options)
  });

  /**
   * An entity's repository: reads plus whatever its policy permits.
   * Absent capabilities are absent, not stubs that throw, so a caller that tries to
   * update a historical record fails at the call rather than at runtime SQL.
   */
  const repo = entity => {
    const policy = policyFor(entity);
    const api = reads(entity);
    if (policy?.insert) {
      api.insert = (record, options) => adapter.insert(entity, record, options);
      api.insertAll = (records, options) => adapter.insertAll(entity, records, options);
    }
    if (policy?.update) api.update = (uuid, changes, options) => adapter.update(entity, uuid, changes, options);
    if (policy?.upsert) api.upsert = (record, options) => adapter.upsert(entity, record, options);
    if (policy?.softDelete) {
      api.softDelete = (uuid, options) => adapter.softDelete(entity, uuid, options);
      api.restore = (uuid, options) => adapter.restore(entity, uuid, options);
    }
    if (policy?.hardDelete) api.hardDelete = uuid => adapter.hardDelete(entity, uuid);
    return Object.freeze(api);
  };

  /** Read-only regardless of policy. Used for the SRS tables. */
  const readOnly = entity => Object.freeze(reads(entity));

  /* ------------------------------------------------------------- entities */

  const entities = {
    profiles: repo("profiles"),
    settings: repo("settings"),
    vocabulary: repo("vocabularyItems"),
    meanings: repo("vocabularyMeanings"),
    translations: repo("translations"),
    acceptedAnswers: repo("acceptedAnswers"),
    grammarTopics: repo("grammarTopics"),
    grammarRules: repo("grammarRules"),
    grammarExamples: repo("grammarExamples"),
    grammarTexts: repo("grammarTexts"),
    vocabularyGrammar: repo("vocabularyGrammar"),
    sentences: repo("sentences"),
    sentenceTexts: repo("sentenceTexts"),
    sentenceVocabulary: repo("sentenceVocabulary"),
    sentenceGrammar: repo("sentenceGrammar"),
    sentenceTags: repo("sentenceTags"),
    exercises: repo("exercises"),
    exerciseTexts: repo("exerciseTexts"),
    exerciseOptions: repo("exerciseOptions"),
    exerciseTargets: repo("exerciseTargets"),
    courses: repo("courses"),
    courseLevels: repo("courseLevels"),
    courseUnits: repo("courseUnits"),
    lessons: repo("lessons"),
    lessonSections: repo("lessonSections"),
    lessonItems: repo("lessonItems"),
    lessonPrerequisites: repo("lessonPrerequisites"),
    curriculumTexts: repo("curriculumTexts"),
    courseProgress: repo("courseProgress"),
    lessonProgress: repo("lessonProgress"),
    sectionProgress: repo("sectionProgress"),
    cefrProgress: repo("cefrProgress"),
    errorCategories: repo("errorCategories"),
    errorCategoryTexts: repo("errorCategoryTexts"),
    errorRemediations: repo("errorRemediations"),
    errorEvents: repo("errorEvents"),
    errorEventCategories: repo("errorEventCategories"),
    errorPatterns: repo("errorPatterns"),
    audioAssets: repo("audioAssets"),
    listeningItems: repo("listeningItems"),
    listeningTexts: repo("listeningTexts"),
    listeningSpeakers: repo("listeningSpeakers"),
    listeningSegments: repo("listeningSegments"),
    listeningSegmentTexts: repo("listeningSegmentTexts"),
    listeningLinks: repo("listeningLinks"),
    pronunciationFeatures: repo("pronunciationFeatures"),
    pronunciationTexts: repo("pronunciationTexts"),
    pronunciationItems: repo("pronunciationItems"),
    pronunciationVariants: repo("pronunciationVariants"),
    pronunciationPairs: repo("pronunciationPairs"),
    pronunciationLinks: repo("pronunciationLinks"),
    pronunciationAttempts: repo("pronunciationAttempts"),
    reminderSettings: repo("reminderSettings"),
    reminderSchedule: repo("reminderSchedule"),
    // Read-only on purpose. See `srs` below.
    cards: readOnly("reviewCards"),
    events: repo("reviewEvents")
  };

  /* --------------------------------------------------------- aggregates -- */

  const upsertAll = (entity, records, options) =>
    Promise.all((records ?? []).map(record => adapter.upsert(entity, record, options)));

  const insertAll = (entity, records, options) =>
    adapter.insertAll(entity, records ?? [], options);

  /**
   * Authored content. Each of these writes a root row plus everything that belongs to
   * it in one transaction, because a sentence without its translations, or an exercise
   * without its options, is not a smaller version of the thing — it is a broken one.
   *
   * Upsert rather than insert, so re-importing corrected content updates in place
   * instead of colliding, which is what authoring actually needs.
   *
   * The parent row may be absent, and that is not a broken aggregate: it means the
   * store already holds it unchanged. Writing it anyway would advance its revision
   * and updated_at to say something moved when nothing did, so it is left alone and
   * only its new children are saved.
   */
  const content = Object.freeze({
    async saveVocabulary({ item, meanings, translations, acceptedAnswers }, options) {
      return adapter.transaction(async () => {
        if (item) await adapter.upsert("vocabularyItems", item, options);
        await upsertAll("vocabularyMeanings", meanings, options);
        await upsertAll("translations", translations, options);
        await upsertAll("acceptedAnswers", acceptedAnswers, options);
        return item?.uuid ?? null;
      });
    },

    async saveGrammarTopic({ topic, rules, examples, texts }, options) {
      return adapter.transaction(async () => {
        await adapter.upsert("grammarTopics", topic, options);
        await upsertAll("grammarRules", rules, options);
        await upsertAll("grammarExamples", examples, options);
        await upsertAll("grammarTexts", texts, options);
        return topic.uuid;
      });
    },

    async saveSentence({ sentence, texts, vocabulary, grammar, tags }, options) {
      return adapter.transaction(async () => {
        if (sentence) await adapter.upsert("sentences", sentence, options);
        await upsertAll("sentenceTexts", texts, options);
        await upsertAll("sentenceVocabulary", vocabulary, options);
        await upsertAll("sentenceGrammar", grammar, options);
        await upsertAll("sentenceTags", tags, options);
        return sentence?.uuid ?? null;
      });
    },

    async saveExercise({ exercise, texts, options: choices, targets }, options) {
      return adapter.transaction(async () => {
        if (exercise) await adapter.upsert("exercises", exercise, options);
        await upsertAll("exerciseTexts", texts, options);
        await upsertAll("exerciseOptions", choices, options);
        await upsertAll("exerciseTargets", targets, options);
        return exercise?.uuid ?? null;
      });
    },

    async saveCourse({ course, levels, units, lessons, sections, items, prerequisites, texts }, options) {
      return adapter.transaction(async () => {
        if (course) await adapter.upsert("courses", course, options);
        await upsertAll("courseLevels", levels, options);
        await upsertAll("courseUnits", units, options);
        await upsertAll("lessons", lessons, options);
        await upsertAll("lessonSections", sections, options);
        await upsertAll("lessonItems", items, options);
        await upsertAll("lessonPrerequisites", prerequisites, options);
        await upsertAll("curriculumTexts", texts, options);
        return course?.uuid ?? null;
      });
    },

    async saveListening({ audio, item, texts, speakers, segments, segmentTexts, links }, options) {
      return adapter.transaction(async () => {
        // The asset first: the activity references it.
        if (audio) await adapter.upsert("audioAssets", audio, options);
        if (item) await adapter.upsert("listeningItems", item, options);
        await upsertAll("listeningTexts", texts, options);
        await upsertAll("listeningSpeakers", speakers, options);
        await upsertAll("listeningSegments", segments, options);
        await upsertAll("listeningSegmentTexts", segmentTexts, options);
        await upsertAll("listeningLinks", links, options);
        return item?.uuid ?? null;
      });
    },

    async savePronunciation({ feature, item, texts, variants, pairs, links }, options) {
      return adapter.transaction(async () => {
        if (feature) await adapter.upsert("pronunciationFeatures", feature, options);
        await adapter.upsert("pronunciationItems", item, options);
        await upsertAll("pronunciationTexts", texts, options);
        await upsertAll("pronunciationVariants", variants, options);
        await upsertAll("pronunciationPairs", pairs, options);
        await upsertAll("pronunciationLinks", links, options);
        return item.uuid;
      });
    },

    async saveErrorTaxonomy({ categories, texts, remediations }, options) {
      return adapter.transaction(async () => {
        await upsertAll("errorCategories", categories, options);
        await upsertAll("errorCategoryTexts", texts, options);
        await upsertAll("errorRemediations", remediations, options);
        return (categories ?? []).length;
      });
    }
  });

  /**
   * Course progress. Separate from SRS by construction: nothing in here can reach
   * review_cards, so completing a lesson cannot move a due date or an ease.
   */
  const progress = Object.freeze({
    async recordLessonProgress({ lesson, sections, course }, options) {
      return adapter.transaction(async () => {
        await adapter.upsert("lessonProgress", lesson, options);
        await upsertAll("sectionProgress", sections, options);
        // The course row carries the resume point, so it moves with the lesson.
        if (course) await adapter.upsert("courseProgress", course, options);
        return lesson.uuid;
      });
    },

    async recordCefrProgress(rows, options) {
      return adapter.transaction(async () => upsertAll("cefrProgress", rows, options));
    },

    forProfile(profileUuid) {
      return {
        courses: () => adapter.find("courseProgress", { profileUuid }),
        lessons: () => adapter.find("lessonProgress", { profileUuid }),
        sections: () => adapter.find("sectionProgress", { profileUuid }),
        cefr: () => adapter.find("cefrProgress", { profileUuid })
      };
    }
  });

  /**
   * Error learning. An event and its classifications are one fact, so they are written
   * together or not at all — a classified event with no event, or an event whose
   * classifications half-arrived, would both corrupt the pattern aggregation.
   */
  const errors = Object.freeze({
    async recordEvent({ event, links }, options) {
      return adapter.transaction(async () => {
        await adapter.insert("errorEvents", event, options);
        await insertAll("errorEventCategories", links, options);
        return event.uuid;
      });
    },

    async recordEvents(entries, options) {
      return adapter.transaction(async () => {
        for (const entry of entries ?? []) {
          await adapter.insert("errorEvents", entry.event, options);
          await insertAll("errorEventCategories", entry.links, options);
        }
        return (entries ?? []).length;
      });
    },

    /** Patterns are a rebuildable cache, so refreshing them is an upsert, not history. */
    async refreshPatterns(patterns, options) {
      return adapter.transaction(async () => upsertAll("errorPatterns", patterns, options));
    },

    forProfile(profileUuid) {
      return {
        events: options => adapter.find("errorEvents", { profileUuid },
          { orderBy: [["occurredAt", "desc"]], ...options }),
        patterns: () => adapter.find("errorPatterns", { profileUuid })
      };
    }
  });

  /** A learner's spoken attempts. Append-only: their own history, never rewritten. */
  const pronunciation = Object.freeze({
    async recordAttempt(attempt, options) {
      return adapter.transaction(async () => {
        // A recording is an asset in its own right and must exist before it is referenced.
        if (options?.recording) await adapter.upsert("audioAssets", options.recording, options);
        await adapter.insert("pronunciationAttempts", attempt, options);
        return attempt.uuid;
      });
    },

    history(profileUuid, itemUuid) {
      return adapter.find("pronunciationAttempts", { profileUuid, itemUuid },
        { orderBy: [["occurredAt", "desc"]] });
    }
  });

  /**
   * Reminders. Settings and the schedule log move together, so what the learner asked
   * for and what the OS was told can never be saved half-apart.
   */
  const reminders = Object.freeze({
    async save({ settings, scheduled, cancelled }, options) {
      return adapter.transaction(async () => {
        if (settings) await adapter.upsert("reminderSettings", settings, options);
        await upsertAll("reminderSchedule", scheduled, options);
        await upsertAll("reminderSchedule", cancelled, options);
        return settings?.uuid ?? null;
      });
    },

    async markDelivered(uuid, deliveredAt, options) {
      return adapter.update("reminderSchedule", uuid,
        { deliveredAt, status: "delivered" }, options);
    },

    forProfile(profileUuid) {
      return {
        settings: () => adapter.findOne("reminderSettings", { profileUuid }),
        schedule: () => adapter.find("reminderSchedule", { profileUuid },
          { orderBy: [["scheduledFor", "desc"]] })
      };
    }
  });

  /**
   * The SRS path.
   *
   * Named apart from everything else so that changing a due date, an ease or an interval
   * is always a deliberate, greppable act. The card must already have been computed by
   * the scheduler — this persists a decision, it does not make one — and the review event
   * that justifies it is written in the same transaction.
   */
  const srs = Object.freeze({
    async applyScheduledCard(card, { event = null, ...options } = {}) {
      return adapter.transaction(async () => {
        await adapter.applyScheduledCard(card, options);
        if (event) await adapter.insert("reviewEvents", event, options);
        return card.uuid;
      });
    },

    forProfile(profileUuid) {
      return {
        cards: () => adapter.find("reviewCards", { profileUuid }),
        due: (now, options) => adapter.find("reviewCards", { profileUuid, suspended: 0 },
          { orderBy: [["dueAt", "asc"]], ...options })
          .then(cards => cards.filter(card => Number(card.dueAt) <= now))
      };
    }
  });

  return Object.freeze({
    lifecycle: Object.freeze({
      initializeSchema: () => adapter.initializeSchema(),
      schemaVersion: () => adapter.schemaVersion(),
      importCanonical: dataset => adapter.importCanonical(dataset),
      readCanonical: () => adapter.readCanonical(),
      verifyIntegrity: () => adapter.verifyIntegrity(),
      /** Run several repository calls as one atomic unit. */
      transaction: work => adapter.transaction(work)
    }),
    ...entities,
    write: Object.freeze({ content, progress, errors, pronunciation, reminders }),
    srs
  });
}
