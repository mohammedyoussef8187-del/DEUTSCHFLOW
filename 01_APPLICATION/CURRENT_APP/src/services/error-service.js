/*
 * Error learning service (Feature F).
 *
 * Turns mistakes the learner actually made into a taxonomy, recurring patterns, and a
 * suggested practice list.
 *
 * Three rules hold this together:
 *
 *   1. THIS MODULE NEVER DECIDES CORRECTNESS. It reads the deterministic evaluator's
 *      verdict and classifies it. Re-deriving correctness here would create a second
 *      grader that could disagree with the first.
 *
 *   2. A CLASSIFICATION IS DETERMINISTIC ONLY IF THE LANGUAGE COULD SCORE IT. Arabic
 *      answers are evaluated advisorily (the evaluator returns isCorrect: null on
 *      purpose), so an Arabic mistake is recorded and shown to the learner but is
 *      classified with source "advisory" and is excluded from everything that drives
 *      practice. Arabic can teach; it can never grade, and it can never decide what the
 *      learner is made to drill.
 *
 *   3. ERROR LEARNING SUGGESTS, IT DOES NOT SCHEDULE. Nothing here reads or writes
 *      review_cards. The practice queue is a separate surface next to the due queue; it
 *      cannot move a due date, an ease, an interval or a lapse count. A learner's SRS
 *      schedule after a session is identical whether or not this module ran.
 *
 * AI fits in exactly one place: it may add "advisory" classifications with a confidence.
 * That is the same tier Arabic occupies, and it is read only for display.
 */

import { ARABIC, ENGLISH, GERMAN, isScoreable, normalizeLanguage } from "../content/languages.js";
import { deterministicUuid } from "../migration/uuid.js";

/** Where in the language a mistake lives. Used for grouping, not for severity. */
export const ERROR_SCOPES = Object.freeze({
  ORTHOGRAPHY: "orthography",
  MORPHOLOGY: "morphology",
  SYNTAX: "syntax",
  LEXIS: "lexis",
  USAGE: "usage"
});

/** Who says so. AI may only ever produce ADVISORY. */
export const ERROR_SOURCES = Object.freeze({
  DETERMINISTIC: "deterministic",
  ADVISORY: "advisory"
});

export const PATTERN_STATUS = Object.freeze({
  ACTIVE: "active",
  IMPROVING: "improving",
  RESOLVED: "resolved"
});

export const CATEGORY_TEXT_KINDS = Object.freeze({
  NAME: "name",
  EXPLANATION: "explanation",
  ADVICE: "advice"
});

/**
 * The built-in taxonomy, keyed by the deterministic evaluator's own verdict type.
 *
 * `error` distinguishes a wrong answer from a near miss: a capitalization or punctuation
 * difference was ACCEPTED as correct, so it is worth teaching from but must never be
 * counted or displayed as a mistake.
 */
const TAXONOMY = Object.freeze({
  article_missing:      { slug: "article-missing",  scope: ERROR_SCOPES.MORPHOLOGY, error: true },
  article_wrong:        { slug: "article-wrong",    scope: ERROR_SCOPES.MORPHOLOGY, error: true },
  minor_typo:           { slug: "spelling-typo",    scope: ERROR_SCOPES.ORTHOGRAPHY, error: true },
  wrong_order:          { slug: "word-order",       scope: ERROR_SCOPES.SYNTAX,     error: true },
  incomplete:           { slug: "incomplete",       scope: ERROR_SCOPES.USAGE,      error: true },
  wrong:                { slug: "meaning-mismatch", scope: ERROR_SCOPES.LEXIS,      error: true },
  empty:                { slug: "no-answer",        scope: ERROR_SCOPES.USAGE,      error: true },
  capitalization:       { slug: "capitalization",   scope: ERROR_SCOPES.ORTHOGRAPHY, error: false },
  punctuation:          { slug: "punctuation",      scope: ERROR_SCOPES.ORTHOGRAPHY, error: false },
  umlaut_variant:       { slug: "umlaut-spelling",  scope: ERROR_SCOPES.ORTHOGRAPHY, error: false },
  acceptable_paraphrase:{ slug: "paraphrase",       scope: ERROR_SCOPES.LEXIS,      error: false }
});

/** The taxonomy as authorable category rows, in a stable order. */
export const BUILT_IN_CATEGORIES = Object.freeze(
  Object.values(TAXONOMY)
    .filter((entry, index, all) => all.findIndex(other => other.slug === entry.slug) === index)
    .map((entry, index) => Object.freeze({ slug: entry.slug, scope: entry.scope, ordering: index + 1 }))
);

export function categoryForEvaluationType(type) {
  return TAXONOMY[type] ?? null;
}

/* ------------------------------------------------------------- classifying */

/**
 * Classify one evaluator verdict.
 *
 * @param {object} evaluation the object returned by the answer evaluator
 * @param {object} options    { language, advisory: [{slug, confidence}] }
 * @returns {object} { recordable, isError, isNearMiss, scored, categories }
 *
 * `scored` mirrors whether the answer was allowed to affect the card: it is false for
 * any language that cannot score, and false whenever the evaluator surrendered its
 * verdict (isCorrect === null, i.e. the learner self-assesses).
 */
export function classifyEvaluation(evaluation, options = {}) {
  const language = normalizeLanguage(options.language ?? GERMAN);
  const entry = evaluation ? categoryForEvaluationType(evaluation.type) : null;
  const languageCanScore = isScoreable(language);
  // A verdict the evaluator refused to make cannot be treated as authoritative.
  const verdictIsAuthoritative = languageCanScore && evaluation?.isCorrect !== null;

  const advisory = (options.advisory ?? []).map(hint => ({
    slug: hint.slug,
    source: ERROR_SOURCES.ADVISORY,
    confidence: clampConfidence(hint.confidence)
  }));

  if (!entry) {
    // Unknown or perfect: nothing to learn from, but an AI hint is still passed through
    // as advisory rather than silently dropped.
    return {
      recordable: advisory.length > 0,
      isError: false,
      isNearMiss: false,
      scored: false,
      categories: advisory
    };
  }

  const primary = {
    slug: entry.slug,
    scope: entry.scope,
    // The rule that keeps Arabic out of anything consequential.
    source: verdictIsAuthoritative ? ERROR_SOURCES.DETERMINISTIC : ERROR_SOURCES.ADVISORY,
    confidence: 1
  };

  return {
    recordable: true,
    isError: entry.error,
    isNearMiss: !entry.error,
    scored: verdictIsAuthoritative,
    categories: [primary, ...advisory]
  };
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/* ---------------------------------------------------------------- recording */

const NS_EVENT = "deutschflow/error_event";
const NS_LINK = "deutschflow/error_event_category";
const NS_PATTERN = "deutschflow/error_pattern";

/**
 * Build the rows for one recorded mistake. Pure: it returns rows, it does not persist
 * them, so a caller can validate or discard before anything is written.
 *
 * Identity is deterministic over (profile, occurredAt, content, answer), so replaying
 * the same session cannot duplicate an event.
 */
export function buildErrorEvent(input, categories, options = {}) {
  const now = options.now ?? Date.now();
  const occurredAt = input.occurredAt ?? now;
  const language = normalizeLanguage(input.answerLanguage ?? GERMAN);
  const contentType = input.contentType ?? "vocabulary";
  const contentUuid = input.contentUuid ?? "";

  const uuid = deterministicUuid(
    NS_EVENT,
    `${input.profileUuid}:${occurredAt}:${contentType}:${contentUuid}:${input.skill ?? ""}:${input.userAnswer ?? ""}`
  );

  const event = {
    uuid,
    profileUuid: input.profileUuid,
    occurredAt,
    sessionUuid: input.sessionUuid ?? null,
    skill: input.skill ?? "",
    answerLanguage: language,
    contentType,
    contentUuid,
    evaluationType: input.evaluationType ?? "",
    // Stored as 0/1 because SQLite has no boolean, and never as a computed truthiness.
    scored: input.scored ? 1 : 0,
    expectedAnswer: input.expectedAnswer ?? "",
    userAnswer: input.userAnswer ?? "",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  };

  const links = (categories ?? []).map(category => ({
    uuid: deterministicUuid(NS_LINK, `${uuid}:${category.slug}:${category.source}`),
    eventUuid: uuid,
    categoryUuid: category.categoryUuid ?? category.slug,
    source: category.source ?? ERROR_SOURCES.DETERMINISTIC,
    confidence: clampConfidence(category.confidence ?? 1),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  }));

  return { event, links };
}

/**
 * Record a mistake straight from an evaluator verdict.
 * Returns null when there is nothing worth recording, so a correct answer produces no
 * row rather than an empty one.
 */
export function recordEvaluation(evaluation, context, options = {}) {
  const verdict = classifyEvaluation(evaluation, {
    language: context.answerLanguage,
    advisory: options.advisory
  });
  if (!verdict.recordable) return null;

  const built = buildErrorEvent(
    {
      ...context,
      evaluationType: evaluation?.type ?? "",
      expectedAnswer: evaluation?.correctAnswer ?? "",
      userAnswer: evaluation?.userAnswer ?? "",
      scored: verdict.scored
    },
    verdict.categories,
    options
  );

  return { ...built, isError: verdict.isError, isNearMiss: verdict.isNearMiss, scored: verdict.scored };
}

/* -------------------------------------------------------------- aggregating */

const notDeleted = row => !row.deleted;
const byOrdering = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0);

function categoryIndex(canonical) {
  const bySlug = new Map();
  const byUuid = new Map();
  for (const row of (canonical.errorCategories ?? []).filter(notDeleted)) {
    bySlug.set(row.slug, row);
    byUuid.set(row.uuid, row);
  }
  return { bySlug, byUuid };
}

function categoryTexts(canonical) {
  const map = new Map();
  for (const row of (canonical.errorCategoryTexts ?? []).filter(notDeleted)) {
    const key = `${row.categoryUuid}:${row.kind}`;
    const langs = map.get(key) ?? {};
    langs[normalizeLanguage(row.language)] = row.text;
    map.set(key, langs);
  }
  return map;
}

function textFor(texts, categoryUuid, kind) {
  const found = texts.get(`${categoryUuid}:${kind}`) ?? {};
  // English and Arabic are peers; an absent one is null, never a missing key.
  return { [GERMAN]: found[GERMAN] ?? null, [ENGLISH]: found[ENGLISH] ?? null, [ARABIC]: found[ARABIC] ?? null };
}

/**
 * Rebuild patterns from raw events. The stored error_patterns table is a cache of
 * exactly this, so a corrupted or missing aggregate can always be recomputed rather
 * than being the only copy of the truth.
 *
 * Only deterministic classifications are aggregated: advisory ones (Arabic, AI) are
 * recorded and displayable but never become a pattern that drives practice.
 */
export function aggregatePatterns(canonical, profileUuid, options = {}) {
  const includeAdvisory = options.includeAdvisory === true;
  const { byUuid, bySlug } = categoryIndex(canonical);
  const events = (canonical.errorEvents ?? [])
    .filter(notDeleted)
    .filter(event => event.profileUuid === profileUuid);
  const eventsByUuid = new Map(events.map(event => [event.uuid, event]));

  const buckets = new Map();

  for (const link of (canonical.errorEventCategories ?? []).filter(notDeleted)) {
    if (!includeAdvisory && link.source !== ERROR_SOURCES.DETERMINISTIC) continue;
    const event = eventsByUuid.get(link.eventUuid);
    if (!event) continue;

    const category = byUuid.get(link.categoryUuid) ?? bySlug.get(link.categoryUuid) ?? null;
    const categorySlug = category?.slug ?? link.categoryUuid;
    const key = `${categorySlug}:${event.contentType}:${event.contentUuid}`;

    const bucket = buckets.get(key) ?? {
      categoryUuid: category?.uuid ?? link.categoryUuid,
      categorySlug,
      scope: category?.scope ?? null,
      contentType: event.contentType,
      contentUuid: event.contentUuid,
      occurrences: 0,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      scoredOccurrences: 0
    };

    bucket.occurrences += 1;
    if (event.scored) bucket.scoredOccurrences += 1;
    bucket.firstSeenAt = Math.min(bucket.firstSeenAt, event.occurredAt);
    bucket.lastSeenAt = Math.max(bucket.lastSeenAt, event.occurredAt);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort(
    (a, b) => b.occurrences - a.occurrences ||
      b.lastSeenAt - a.lastSeenAt ||
      a.categorySlug.localeCompare(b.categorySlug)
  );
}

const DAY = 86400000;

/**
 * Status of a pattern. A stored resolution wins; otherwise a mistake that has not
 * recurred for a while is reported as improving rather than being silently forgotten,
 * so progress is visible without claiming the learner has mastered anything.
 */
export function patternStatus(pattern, options = {}) {
  if (pattern?.resolvedAt) return PATTERN_STATUS.RESOLVED;
  const now = options.now ?? Date.now();
  const quietDays = options.quietDays ?? 21;
  if (!pattern?.lastSeenAt) return PATTERN_STATUS.ACTIVE;
  return now - pattern.lastSeenAt >= quietDays * DAY
    ? PATTERN_STATUS.IMPROVING
    : PATTERN_STATUS.ACTIVE;
}

/** Everything the learner should be told about their mistakes, in one shape. */
export function summarizeErrors(canonical = {}, profileUuid, options = {}) {
  const now = options.now ?? Date.now();
  const texts = categoryTexts(canonical);
  const { bySlug } = categoryIndex(canonical);

  const derived = aggregatePatterns(canonical, profileUuid, options);
  const stored = new Map(
    (canonical.errorPatterns ?? [])
      .filter(notDeleted)
      .filter(row => row.profileUuid === profileUuid)
      .map(row => [`${row.categoryUuid}:${row.contentType}:${row.contentUuid}`, row])
  );

  const patterns = derived.map(pattern => {
    const storedRow = stored.get(`${pattern.categoryUuid}:${pattern.contentType}:${pattern.contentUuid}`) ?? null;
    const category = bySlug.get(pattern.categorySlug) ?? null;
    return {
      ...pattern,
      status: patternStatus({ ...pattern, resolvedAt: storedRow?.resolvedAt ?? null }, { now, ...options }),
      resolvedAt: storedRow?.resolvedAt ?? null,
      name: category ? textFor(texts, category.uuid, CATEGORY_TEXT_KINDS.NAME) : null,
      advice: category ? textFor(texts, category.uuid, CATEGORY_TEXT_KINDS.ADVICE) : null
    };
  });

  const byCategory = new Map();
  for (const pattern of patterns) {
    const entry = byCategory.get(pattern.categorySlug) ?? {
      categorySlug: pattern.categorySlug,
      scope: pattern.scope,
      occurrences: 0,
      items: 0,
      lastSeenAt: 0
    };
    entry.occurrences += pattern.occurrences;
    entry.items += 1;
    entry.lastSeenAt = Math.max(entry.lastSeenAt, pattern.lastSeenAt);
    byCategory.set(pattern.categorySlug, entry);
  }

  const events = (canonical.errorEvents ?? [])
    .filter(notDeleted)
    .filter(event => event.profileUuid === profileUuid);

  return {
    profileUuid,
    totalEvents: events.length,
    // Recorded but never counted as authority: exactly the Arabic/AI tier.
    unscoredEvents: events.filter(event => !event.scored).length,
    patterns,
    categories: [...byCategory.values()].sort(
      (a, b) => b.occurrences - a.occurrences || a.categorySlug.localeCompare(b.categorySlug)
    ),
    active: patterns.filter(pattern => pattern.status === PATTERN_STATUS.ACTIVE).length
  };
}

/* -------------------------------------------------------------- remediation */

/** What to study for a category, as (contentType, contentUuid) references. */
export function remediationFor(categorySlug, canonical = {}) {
  const { bySlug } = categoryIndex(canonical);
  const category = bySlug.get(categorySlug);
  if (!category) return [];
  return (canonical.errorRemediations ?? [])
    .filter(notDeleted)
    .filter(row => row.categoryUuid === category.uuid)
    .sort(byOrdering)
    .map(row => ({ contentType: row.contentType, contentUuid: row.contentUuid, ordering: row.ordering ?? 0 }));
}

/**
 * A suggested practice list, strongest pattern first.
 *
 * This is a SUGGESTION SURFACE. It returns content to look at; it does not touch the
 * SRS queue, does not reorder due cards, and cannot change when anything is next due.
 * A learner who ignores it entirely has exactly the same schedule as one who follows it.
 */
export function practiceQueue(canonical = {}, profileUuid, options = {}) {
  const limit = options.limit ?? 10;
  const summary = summarizeErrors(canonical, profileUuid, options);

  const queue = [];
  for (const pattern of summary.patterns) {
    if (pattern.status === PATTERN_STATUS.RESOLVED) continue;
    const remediation = remediationFor(pattern.categorySlug, canonical);
    const targets = remediation.length
      ? remediation
      // With no authored remediation, the thing that was got wrong is the practice.
      : pattern.contentUuid
        ? [{ contentType: pattern.contentType, contentUuid: pattern.contentUuid, ordering: 0 }]
        : [];

    for (const target of targets) {
      queue.push({
        contentType: target.contentType,
        contentUuid: target.contentUuid,
        categorySlug: pattern.categorySlug,
        occurrences: pattern.occurrences,
        lastSeenAt: pattern.lastSeenAt,
        reason: remediation.length ? "remediation" : "repeat-the-item",
        // Stated in the data, not just the docs, so a caller cannot mistake this for
        // a scheduling decision.
        affectsScheduling: false
      });
    }
  }

  const seen = new Set();
  return queue
    .filter(entry => {
      const key = `${entry.categorySlug}:${entry.contentType}:${entry.contentUuid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ service */

/** Repository-backed service. Read-only; never touches SRS. */
export function createErrorService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function load() {
    const [errorCategories, errorCategoryTexts, errorRemediations,
           errorEvents, errorEventCategories, errorPatterns] = await Promise.all([
      repositories.errorCategories.all(), repositories.errorCategoryTexts.all(),
      repositories.errorRemediations.all(), repositories.errorEvents.all(),
      repositories.errorEventCategories.all(), repositories.errorPatterns.all()
    ]);
    return { errorCategories, errorCategoryTexts, errorRemediations,
             errorEvents, errorEventCategories, errorPatterns };
  }

  return Object.freeze({
    async categories() {
      return (await repositories.errorCategories.all()).filter(notDeleted).sort(byOrdering);
    },

    async summary(profileUuid, options = {}) {
      return summarizeErrors(await load(), profileUuid, options);
    },

    async patterns(profileUuid, options = {}) {
      return aggregatePatterns(await load(), profileUuid, options);
    },

    async practice(profileUuid, options = {}) {
      return practiceQueue(await load(), profileUuid, options);
    },

    async remediation(categorySlug) {
      return remediationFor(categorySlug, await load());
    }
  });
}
