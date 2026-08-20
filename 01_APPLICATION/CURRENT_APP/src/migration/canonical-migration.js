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

const CONTENT_STATUS_LEGACY = "legacy";
const SOURCE_TYPE_LEGACY = "legacy";
const EASE_MIN = 1.3;
const EASE_MAX = 3.2;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function boolInt(value) {
  return value ? 1 : 0;
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
    acceptedAnswers: [],
    reviewCards: [],
    reviewEvents: []
  };
  const quarantine = [];
  const warnings = [];

  const quarantineRecord = (entity, sourceId, reasons, record) =>
    quarantine.push({ entity, sourceId: sourceId ?? null, reasons, record });

  // ---- Profile (single local learner) --------------------------------------
  const profileUuid = options.profileUuid || deterministicUuid(NS.profile, "local");
  dataset.profiles.push({
    uuid: profileUuid,
    username: profile?.username ?? null,
    streak: Number.isFinite(profile?.streak) ? profile.streak : 0,
    lastStudyDate: profile?.lastStudyDate ?? null,
    totalXP: Number.isFinite(profile?.totalXP) ? profile.totalXP : 0,
    cloudUserId: profile?.cloudUserId ?? null,
    createdAt: profile?.createdAt ?? now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  });

  // ---- Settings ------------------------------------------------------------
  if (settings) {
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
      ignored: boolInt(word.ignored),
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
      quarantineRecord("vocabulary_meaning", legacyId, ["missing-arabic-meaning"], word);
    } else {
      const meaningUuid = deterministicUuid(NS.meaning, vocabUuid);
      dataset.vocabularyMeanings.push({
        uuid: meaningUuid,
        vocabUuid,
        arabicText: word.arabic,
        normalizedArabic: word.normalizedArabic ?? "",
        explanation: null,
        pronunciation: word.pronunciation ?? "",
        favorite: boolInt(word.favorite),
        userFlagged: boolInt(word.userFlagged),
        qualityStatus: word.qualityStatus ?? CONTENT_STATUS_LEGACY,
        contentStatus: CONTENT_STATUS_LEGACY,
        contentVersion: 1,
        sourceReference: word.sourceRow == null ? null : String(word.sourceRow),
        sourceType: SOURCE_TYPE_LEGACY,
        verifiedAt: null,
        verifiedBy: null,
        ...metaFields(now)
      });

      // Accepted answers -> individual rows. German (de) and Arabic (ar) sets.
      appendAcceptedAnswers(dataset, meaningUuid, word.acceptedAnswers, "de", now);
      appendAcceptedAnswers(dataset, meaningUuid, word.acceptedArabicAnswers, "ar", now);
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
      cardUuid,
      sessionId: attempt.sessionId ?? null,
      correct: boolInt(attempt.correct),
      answerType: attempt.answerType ?? null,
      userAnswer: attempt.userAnswer ?? null,
      elapsedMs: Number.isFinite(attempt.elapsedMs) ? attempt.elapsedMs : 0,
      rating: Number.isFinite(attempt.rating) ? attempt.rating : null,
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
      acceptedAnswers: dataset.acceptedAnswers.length,
      reviewCards: dataset.reviewCards.length,
      reviewEvents: dataset.reviewEvents.length
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
  list.forEach((text, index) => {
    if (isBlank(text)) return;
    dataset.acceptedAnswers.push({
      uuid: deterministicUuid(NS.acceptedAnswer, `${meaningUuid}:${language}:${index}:${text}`),
      meaningUuid,
      translationUuid: null,
      text,
      language,
      ...metaFields(now)
    });
  });
}
