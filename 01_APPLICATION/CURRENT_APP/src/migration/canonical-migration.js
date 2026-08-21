/*
 * Current -> Canonical structural migration (pure, no I/O).
 *
 * Input:  a snapshot of the baseline IndexedDB runtime model
 *           { words[], cards[], attempts[], settings, profile }
 *         exactly as returned by the IndexedDB adapter (getAll / getMeta).
 * Output: { dataset, report }
 *           dataset -> the canonical relational model (see TARGET_DATABASE_SCHEMA.md)
 *           report  -> counts, quarantined records, and non-fatal warnings.
 *
 * Guarantees (see DATA_MIGRATION_STRATEGY.md and DATA_PRESERVATION_AND_ROLLBACK_PLAN.md):
 *   - SRS state is copied verbatim: dueAt, intervalDays, ease, reps, lapses, streak,
 *     mastery, state, lastReviewedAt (plus correct/wrong/stability/difficulty/suspended
 *     /lastResult) are preserved without recomputation.
 *   - Educational wording is copied unchanged and marked with legacy provenance; it is
 *     never rewritten, corrected, or granted verified status by migration.
 *   - No missing educational value is invented. Unresolvable records are quarantined
 *     (preserved in the report) rather than dropped silently or fabricated.
 *   - Identifiers are deterministic, so child records link to parents by legacy identity.
 */

import { deterministicUuid, NS } from "./uuid.js";
import { ARABIC, GERMAN, isScoreable, normalizeLanguage } from "../content/languages.js";

const CONTENT_STATUS_LEGACY = "legacy";
const SOURCE_TYPE_LEGACY = "legacy";
const EASE_MIN = 1.3;
const EASE_MAX = 3.2;

/*
 * Source fields this transform reads. Anything present in real learner data but absent
 * here is unmapped and would be lost by a persistence switch, so the dry-run compares
 * actual record keys against these sets and reports the difference.
 */
export const CONSUMED_FIELDS = Object.freeze({
  words: Object.freeze([
    "id", "german", "arabic", "pronunciation", "normalizedGerman", "normalizedArabic",
    "itemType", "article", "plural", "level", "tags", "acceptedAnswers",
    "acceptedArabicAnswers", "sourceRow", "favorite", "ignored", "userFlagged",
    "qualityStatus", "qualityIssues", "qualityNote", "createdAt", "updatedAt"
  ]),
  cards: Object.freeze([
    "key", "wordId", "skill", "state", "dueAt", "intervalDays", "ease", "stability",
    "difficulty", "reps", "lapses", "correct", "wrong", "streak", "mastery",
    "lastReviewedAt", "lastResult", "suspended", "createdAt", "updatedAt"
  ]),
  attempts: Object.freeze([
    "id", "sessionId", "wordId", "cardKey", "skill", "correct", "answerType", "rating",
    "initial", "retryCount", "itemType", "usedHint", "revealed", "elapsedMs",
    "userAnswer", "correctAnswer", "createdAt"
  ]),
  profile: Object.freeze([
    "username", "streak", "lastStudyDate", "totalXP", "cloudUserId", "createdAt",
    "lastSessionAt", "sessions"
  ])
});

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function boolInt(value) {
  return value ? 1 : 0;
}

// Arrays and structured values are preserved verbatim as JSON text so nothing is
// dropped; empty/absent values stay NULL rather than becoming a misleading "[]".
function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return JSON.stringify(value);
}

function metaFields(now) {
  return { createdAt: now, updatedAt: now, revision: 1, deleted: 0 };
}

/**
 * @param {object} snapshot { words, cards, attempts, settings, profile }
 * @param {object} [options] { now, profileUuid }
 */
export function migrateToCanonical(snapshot = {}, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const words = Array.isArray(snapshot.words) ? snapshot.words : [];
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const attempts = Array.isArray(snapshot.attempts) ? snapshot.attempts : [];
  const settings = snapshot.settings || null;
  const profile = snapshot.profile || null;

  const dataset = {
    profiles: [],
    settings: [],
    vocabularyItems: [],
    vocabularyMeanings: [],
    /*
     * English translations. The legacy model stores no English at all, so this is
     * empty after a legacy migration by design: no English wording is invented here.
     * The table exists so verified English content can be added later without
     * touching learner state.
     */
    translations: [],
    acceptedAnswers: [],
    /*
     * Grammar is authored content, not migrated learner data: the legacy model has no
     * grammar at all, so these start empty and are populated by content authoring.
     */
    grammarTopics: [],
    grammarRules: [],
    grammarExamples: [],
    grammarTexts: [],
    vocabularyGrammar: [],
    /*
     * Sentences and contextual usage are authored content. The legacy model stores
     * sentence-type vocabulary rows but no structured sentence entities, translations
     * or context, so these stay empty rather than fabricating support texts.
     */
    sentences: [],
    sentenceTexts: [],
    sentenceVocabulary: [],
    sentenceGrammar: [],
    sentenceTags: [],
    /* Exercises are authored content; the legacy model has none. */
    exercises: [],
    exerciseTexts: [],
    exerciseOptions: [],
    exerciseTargets: [],
    /*
     * Curriculum is authored, and progress through it is earned. The legacy model has
     * neither, so no course is invented and no CEFR placement is guessed.
     */
    courses: [],
    courseLevels: [],
    courseUnits: [],
    lessons: [],
    lessonSections: [],
    lessonItems: [],
    lessonPrerequisites: [],
    curriculumTexts: [],
    courseProgress: [],
    lessonProgress: [],
    sectionProgress: [],
    cefrProgress: [],
    /*
     * The error taxonomy is authored and mistakes are recorded as they happen. The
     * legacy model stored neither, and a past attempt cannot be reclassified after
     * the fact without guessing, so nothing is back-filled here.
     */
    errorCategories: [],
    errorCategoryTexts: [],
    errorRemediations: [],
    errorEvents: [],
    errorEventCategories: [],
    errorPatterns: [],
    /*
     * Listening is authored: a recording, a transcript of it, and translations of
     * that transcript. The legacy model held none of the three, and inventing any of
     * them would be fabrication rather than migration, so all listening tables stay
     * empty. Audio files that exist in the authoring repository are registered by an
     * explicit authoring step, not by migrating a learner's database.
     */
    audioAssets: [],
    listeningItems: [],
    listeningTexts: [],
    listeningSpeakers: [],
    listeningSegments: [],
    listeningSegmentTexts: [],
    listeningLinks: [],
    /*
     * Pronunciation is authored (IPA, syllables, stress, minimal pairs) and practised
     * out loud. The legacy model recorded neither, and no IPA can be derived from a
     * spelling without guessing, so nothing is back-filled. pronunciationAttempts is
     * a learner's own spoken history, which simply does not exist yet.
     */
    pronunciationFeatures: [],
    pronunciationTexts: [],
    pronunciationItems: [],
    pronunciationVariants: [],
    pronunciationPairs: [],
    pronunciationLinks: [],
    pronunciationAttempts: [],
    reviewCards: [],
    reviewEvents: [],
    quarantine: []
  };
  const quarantine = [];
  const warnings = [];

  /*
   * Unresolved records are quarantined, reported, AND preserved: the source record is
   * carried into a quarantine table verbatim so a structural migration never destroys
   * learner state (e.g. an SRS card whose word was deleted). `preserve: false` is used
   * only when the same source record is already stored elsewhere in the dataset.
   */
  const quarantineRecord = (entity, sourceId, reasons, record, { preserve = true } = {}) => {
    quarantine.push({ entity, sourceId: sourceId ?? null, reasons, record, preserved: preserve });
    if (!preserve) return;
    dataset.quarantine.push({
      uuid: deterministicUuid(NS.quarantine, `${entity}:${sourceId ?? "unknown"}:${reasons.join("+")}`),
      entity,
      sourceId: sourceId == null ? null : String(sourceId),
      reasons: JSON.stringify(reasons),
      payload: JSON.stringify(record ?? null),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deleted: 0
    });
  };

  // ---- Profile (single local learner) --------------------------------------
  const profileUuid = options.profileUuid || deterministicUuid(NS.profile, "local");
  dataset.profiles.push({
    uuid: profileUuid,
    username: profile?.username ?? null,
    streak: Number.isFinite(profile?.streak) ? profile.streak : 0,
    lastStudyDate: profile?.lastStudyDate ?? null,
    totalXP: Number.isFinite(profile?.totalXP) ? profile.totalXP : 0,
    cloudUserId: profile?.cloudUserId ?? null,
    lastSessionAt: profile?.lastSessionAt ?? null,
    sessions: jsonOrNull(profile?.sessions),
    createdAt: profile?.createdAt ?? now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  });

  // ---- Settings ------------------------------------------------------------
  if (settings) {
    // The approved schema types the settings the engine reads directly. Every other
    // stored preference is preserved verbatim in extras so no setting is lost.
    const TYPED_SETTINGS = [
      "theme", "sessionSize", "dailyGoal", "showPronunciation", "acceptAeOeUe",
      "acceptSs", "requireArticle", "ignoreSentencePunctuation"
    ];
    const extras = {};
    for (const [key, value] of Object.entries(settings)) {
      if (!TYPED_SETTINGS.includes(key)) extras[key] = value;
    }
    dataset.settings.push({
      uuid: deterministicUuid(NS.settings, profileUuid),
      profileUuid,
      theme: settings.theme ?? "auto",
      sessionSize: Number.isFinite(settings.sessionSize) ? settings.sessionSize : 20,
      dailyGoal: Number.isFinite(settings.dailyGoal) ? settings.dailyGoal : 25,
      showPronunciation: boolInt(settings.showPronunciation ?? true),
      acceptAeOeUe: boolInt(settings.acceptAeOeUe ?? true),
      acceptSs: boolInt(settings.acceptSs ?? true),
      requireArticle: boolInt(settings.requireArticle ?? true),
      ignoreSentencePunctuation: boolInt(settings.ignoreSentencePunctuation ?? true),
      extras: Object.keys(extras).length ? JSON.stringify(extras) : null,
      ...metaFields(now)
    });
  }

  // ---- Vocabulary items + meanings + accepted answers ----------------------
  const wordUuidByLegacyId = new Map();

  for (const word of words) {
    const reasons = [];
    if (isBlank(word?.id)) reasons.push("missing-id");
    if (isBlank(word?.german)) reasons.push("missing-german");
    if (reasons.length) {
      quarantineRecord("vocabulary_item", word?.id ?? null, reasons, word);
      continue;
    }
    const legacyId = String(word.id);
    if (wordUuidByLegacyId.has(legacyId)) {
      quarantineRecord("vocabulary_item", legacyId, ["duplicate-id"], word);
      continue;
    }
    const vocabUuid = deterministicUuid(NS.vocab, legacyId);
    wordUuidByLegacyId.set(legacyId, vocabUuid);

    dataset.vocabularyItems.push({
      uuid: vocabUuid,
      legacyId,
      german: word.german,
      normalizedGerman: word.normalizedGerman ?? "",
      itemType: word.itemType ?? "word",
      article: word.article ?? null,
      plural: word.plural ?? null,
      level: word.level ?? "",
      tags: jsonOrNull(word.tags),
      // Word-scoped learner and quality state is kept on the item, which always exists,
      // so it survives even when a word carries no meaning row.
      ignored: boolInt(word.ignored),
      favorite: boolInt(word.favorite),
      userFlagged: boolInt(word.userFlagged),
      qualityStatus: word.qualityStatus ?? null,
      qualityIssues: jsonOrNull(word.qualityIssues),
      qualityNote: word.qualityNote ?? null,
      contentStatus: CONTENT_STATUS_LEGACY,
      contentVersion: 1,
      sourceReference: word.sourceRow == null ? null : String(word.sourceRow),
      sourceType: SOURCE_TYPE_LEGACY,
      verifiedAt: null,
      verifiedBy: null,
      createdAt: word.createdAt ?? now,
      updatedAt: word.updatedAt ?? now,
      revision: 1,
      deleted: 0
    });

    // One primary Arabic meaning per legacy word. Preserve wording even if the
    // learner never verified it; do not invent a meaning when none exists.
    if (isBlank(word.arabic)) {
      // The item itself is already stored; only the absent meaning is reported, and no
      // meaning text is invented for it.
      quarantineRecord("vocabulary_meaning", legacyId, ["missing-arabic-meaning"], word, { preserve: false });
    } else {
      const meaningUuid = deterministicUuid(NS.meaning, vocabUuid);
      dataset.vocabularyMeanings.push({
        uuid: meaningUuid,
        vocabUuid,
        arabicText: word.arabic,
        normalizedArabic: word.normalizedArabic ?? "",
        explanation: null,
        pronunciation: word.pronunciation ?? "",
        contentStatus: CONTENT_STATUS_LEGACY,
        contentVersion: 1,
        sourceReference: word.sourceRow == null ? null : String(word.sourceRow),
        sourceType: SOURCE_TYPE_LEGACY,
        verifiedAt: null,
        verifiedBy: null,
        ...metaFields(now)
      });

      // Accepted answers -> individual rows. German (de) and Arabic (ar) sets.
      // German answers may score; Arabic answers are preserved as educational content
      // but never decide correctness.
      appendAcceptedAnswers(dataset, meaningUuid, word.acceptedAnswers, GERMAN, now);
      appendAcceptedAnswers(dataset, meaningUuid, word.acceptedArabicAnswers, ARABIC, now);
    }
  }

  // ---- Review cards --------------------------------------------------------
  const cardUuidByLegacyKey = new Map();

  for (const card of cards) {
    const reasons = [];
    if (isBlank(card?.key)) reasons.push("missing-key");
    if (isBlank(card?.wordId)) reasons.push("missing-wordId");
    if (isBlank(card?.skill)) reasons.push("missing-skill");
    const vocabUuid = wordUuidByLegacyId.get(String(card?.wordId));
    if (!isBlank(card?.wordId) && !vocabUuid) reasons.push("orphan-card");
    if (reasons.length) {
      quarantineRecord("review_card", card?.key ?? null, reasons, card);
      continue;
    }
    const legacyKey = String(card.key);
    if (cardUuidByLegacyKey.has(legacyKey)) {
      quarantineRecord("review_card", legacyKey, ["duplicate-key"], card);
      continue;
    }
    const cardUuid = deterministicUuid(NS.card, legacyKey);
    cardUuidByLegacyKey.set(legacyKey, cardUuid);

    const ease = Number(card.ease);
    if (Number.isFinite(ease) && (ease < EASE_MIN || ease > EASE_MAX)) {
      // Preserve the learner's value; flag the anomaly rather than clamping it.
      warnings.push({ entity: "review_card", sourceId: legacyKey, reason: "ease-out-of-bounds", value: ease });
    }

    dataset.reviewCards.push({
      uuid: cardUuid,
      legacyKey,
      profileUuid,
      vocabUuid,
      skill: card.skill,
      state: card.state ?? "new",
      dueAt: card.dueAt ?? now,
      intervalDays: Number.isFinite(card.intervalDays) ? card.intervalDays : 0,
      ease: Number.isFinite(ease) ? ease : 2.5,
      reps: Number.isFinite(card.reps) ? card.reps : 0,
      lapses: Number.isFinite(card.lapses) ? card.lapses : 0,
      streak: Number.isFinite(card.streak) ? card.streak : 0,
      mastery: Number.isFinite(card.mastery) ? card.mastery : 0,
      lastReviewedAt: card.lastReviewedAt ?? null,
      // Extended learner-state columns preserved for exact SRS round-trip.
      correct: Number.isFinite(card.correct) ? card.correct : 0,
      wrong: Number.isFinite(card.wrong) ? card.wrong : 0,
      stability: Number.isFinite(card.stability) ? card.stability : 0,
      difficulty: Number.isFinite(card.difficulty) ? card.difficulty : 5,
      lastResult: card.lastResult ?? null,
      suspended: boolInt(card.suspended),
      createdAt: card.createdAt ?? now,
      updatedAt: card.updatedAt ?? now,
      revision: 1,
      deleted: 0
    });
  }

  // ---- Review events (attempts) -------------------------------------------
  for (const attempt of attempts) {
    const reasons = [];
    if (isBlank(attempt?.id)) reasons.push("missing-id");
    const cardUuid = cardUuidByLegacyKey.get(String(attempt?.cardKey));
    if (isBlank(attempt?.cardKey)) reasons.push("missing-cardKey");
    else if (!cardUuid) reasons.push("unlinkable-event");
    if (reasons.length) {
      quarantineRecord("review_event", attempt?.id ?? null, reasons, attempt);
      continue;
    }
    dataset.reviewEvents.push({
      uuid: deterministicUuid(NS.event, String(attempt.id)),
      legacyId: String(attempt.id),
      cardUuid,
      vocabUuid: wordUuidByLegacyId.get(String(attempt.wordId)) ?? null,
      sessionId: attempt.sessionId ?? null,
      skill: attempt.skill ?? null,
      itemType: attempt.itemType ?? null,
      correct: boolInt(attempt.correct),
      answerType: attempt.answerType ?? null,
      userAnswer: attempt.userAnswer ?? null,
      correctAnswer: attempt.correctAnswer ?? null,
      elapsedMs: Number.isFinite(attempt.elapsedMs) ? attempt.elapsedMs : 0,
      rating: Number.isFinite(attempt.rating) ? attempt.rating : null,
      initial: attempt.initial === undefined || attempt.initial === null ? null : boolInt(attempt.initial),
      retryCount: Number.isFinite(attempt.retryCount) ? attempt.retryCount : null,
      usedHint: attempt.usedHint === undefined || attempt.usedHint === null ? null : boolInt(attempt.usedHint),
      revealed: attempt.revealed === undefined || attempt.revealed === null ? null : boolInt(attempt.revealed),
      createdAt: attempt.createdAt ?? now,
      updatedAt: attempt.createdAt ?? now,
      revision: 1,
      deleted: 0
    });
  }

  const report = {
    ok: quarantine.length === 0,
    counts: {
      profiles: dataset.profiles.length,
      settings: dataset.settings.length,
      vocabularyItems: dataset.vocabularyItems.length,
      vocabularyMeanings: dataset.vocabularyMeanings.length,
      translations: dataset.translations.length,
      acceptedAnswers: dataset.acceptedAnswers.length,
      reviewCards: dataset.reviewCards.length,
      reviewEvents: dataset.reviewEvents.length,
      quarantine: dataset.quarantine.length
    },
    source: {
      words: words.length,
      cards: cards.length,
      attempts: attempts.length
    },
    quarantine,
    warnings
  };

  return { dataset, report };
}

function appendAcceptedAnswers(dataset, meaningUuid, list, language, now) {
  if (!Array.isArray(list)) return;
  const code = normalizeLanguage(language);
  list.forEach((text, index) => {
    if (isBlank(text)) return;
    dataset.acceptedAnswers.push({
      uuid: deterministicUuid(NS.acceptedAnswer, `${meaningUuid}:${code}:${index}:${text}`),
      meaningUuid,
      translationUuid: null,
      text,
      language: code,
      // Derived from the language policy, never passed in by a caller, so no import
      // path can smuggle in a scoreable Arabic answer.
      scoreable: isScoreable(code) ? 1 : 0,
      ...metaFields(now)
    });
  });
}
