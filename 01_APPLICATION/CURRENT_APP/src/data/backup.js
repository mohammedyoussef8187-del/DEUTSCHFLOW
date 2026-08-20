/*
 * Learner-state backup, validation, restore, and parity comparison.
 *
 * Uses the EXISTING export format already produced by the application
 * (`{ app, schemaVersion, exportedAt, words, cards, attempts, settings, profile }`)
 * so previously exported learner backups remain readable. No new backup format is
 * introduced, and unknown top-level metadata (appVersion, build, dbVersion,
 * engineVersion, ...) is carried through untouched.
 *
 * This module is explicit-call only. It deliberately installs no launch-time hook, so
 * running the app never produces an automatic backup side effect.
 *
 * All functions operate through the repository abstraction; none touch IndexedDB or
 * SQLite directly.
 */

export const BACKUP_APP_NAME = "DeutschFlow";
// Version 5 is written by the current source build; version 6 by the deployed RC build.
// Both describe the same runtime learner model and are accepted for restore.
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([5, 6]);
const DEFAULT_SCHEMA_VERSION = 6;

/**
 * Produce a complete backup of current learner state.
 * @param {object} repositories the repository facade (vocabulary/cards/attempts/metadata)
 * @param {object} [options] { now, schemaVersion, metadata } extra top-level metadata to retain
 */
export async function createBackup(repositories, options = {}) {
  if (!repositories) throw new TypeError("Repositories are required");
  const now = Number.isFinite(options.now) ? options.now : Date.now();

  const [words, cards, attempts, settings, profile] = await Promise.all([
    repositories.vocabulary.all(),
    repositories.cards.all(),
    repositories.attempts.all(),
    repositories.metadata.get("settings", null),
    repositories.metadata.get("profile", null)
  ]);

  return {
    app: BACKUP_APP_NAME,
    schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    ...(options.metadata || {}),
    exportedAt: now,
    words,
    cards,
    attempts,
    settings,
    profile
  };
}

/**
 * Validate backup structure and version before it is trusted for restore or migration.
 * Returns a report; it never throws on learner-data problems and never repairs them.
 */
export function validateBackup(payload) {
  const errors = [];
  const warnings = [];

  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["payload-not-an-object"], warnings, counts: null, schemaVersion: null };
  }
  if (payload.app !== BACKUP_APP_NAME) errors.push("unrecognized-app");
  const schemaVersion = payload.schemaVersion;
  if (!Number.isFinite(schemaVersion)) errors.push("missing-schema-version");
  else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    // Unknown versions are refused rather than guessed at.
    errors.push(`unsupported-schema-version:${schemaVersion}`);
  }
  for (const key of ["words", "cards", "attempts"]) {
    if (!Array.isArray(payload[key])) errors.push(`missing-array:${key}`);
  }
  if (errors.length) {
    return { ok: false, errors, warnings, counts: null, schemaVersion: schemaVersion ?? null };
  }

  // Structural integrity of learner state (identity, linkage, SRS bounds).
  const wordIds = new Set();
  let duplicateWordIds = 0;
  let wordsMissingId = 0;
  for (const word of payload.words) {
    if (word?.id === undefined || word?.id === null) { wordsMissingId++; continue; }
    const id = String(word.id);
    if (wordIds.has(id)) duplicateWordIds++;
    wordIds.add(id);
  }

  const cardKeys = new Set();
  let duplicateCardKeys = 0;
  let orphanCards = 0;
  let easeOutOfBounds = 0;
  for (const card of payload.cards) {
    const key = card?.key === undefined || card?.key === null ? null : String(card.key);
    if (key === null) { warnings.push({ entity: "card", reason: "missing-key" }); continue; }
    if (cardKeys.has(key)) duplicateCardKeys++;
    cardKeys.add(key);
    if (!wordIds.has(String(card.wordId))) orphanCards++;
    const ease = Number(card.ease);
    if (Number.isFinite(ease) && (ease < 1.3 || ease > 3.2)) easeOutOfBounds++;
  }

  let unlinkedAttempts = 0;
  for (const attempt of payload.attempts) {
    if (!cardKeys.has(String(attempt?.cardKey))) unlinkedAttempts++;
  }

  if (duplicateWordIds) errors.push(`duplicate-word-ids:${duplicateWordIds}`);
  if (duplicateCardKeys) errors.push(`duplicate-card-keys:${duplicateCardKeys}`);
  if (wordsMissingId) warnings.push({ entity: "word", reason: "missing-id", count: wordsMissingId });
  if (orphanCards) warnings.push({ entity: "card", reason: "orphan-card", count: orphanCards });
  if (easeOutOfBounds) warnings.push({ entity: "card", reason: "ease-out-of-bounds", count: easeOutOfBounds });
  if (unlinkedAttempts) warnings.push({ entity: "attempt", reason: "unlinked-attempt", count: unlinkedAttempts });
  if (!payload.settings) warnings.push({ entity: "settings", reason: "missing-settings" });
  if (!payload.profile) warnings.push({ entity: "profile", reason: "missing-profile" });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    schemaVersion,
    counts: {
      words: payload.words.length,
      cards: payload.cards.length,
      attempts: payload.attempts.length,
      settings: payload.settings ? Object.keys(payload.settings).length : 0,
      profile: payload.profile ? 1 : 0
    }
  };
}

/**
 * Restore a validated backup into the supplied repositories.
 * The caller decides which repositories these are: restoring into an isolated
 * verification target never touches the learner's live database.
 */
export async function restoreBackup(repositories, payload, { validate = true } = {}) {
  if (!repositories) throw new TypeError("Repositories are required");
  if (validate) {
    const report = validateBackup(payload);
    if (!report.ok) {
      const error = new Error(`Refusing to restore an invalid backup: ${report.errors.join(", ")}`);
      error.report = report;
      throw error;
    }
  }
  await repositories.lifecycle.replaceAll({
    words: payload.words,
    cards: payload.cards,
    attempts: payload.attempts,
    settings: payload.settings,
    profile: payload.profile
  });
  return payload;
}

/** Read the learner-state snapshot back out of repositories for comparison. */
export async function readLearnerState(repositories) {
  const [words, cards, attempts, settings, profile] = await Promise.all([
    repositories.vocabulary.all(),
    repositories.cards.all(),
    repositories.attempts.all(),
    repositories.metadata.get("settings", null),
    repositories.metadata.get("profile", null)
  ]);
  return { words, cards, attempts, settings, profile };
}

// Learner-owned fields that must survive a backup/restore cycle unchanged.
const WORD_FIELDS = [
  "id", "german", "arabic", "pronunciation", "normalizedGerman", "normalizedArabic",
  "itemType", "article", "plural", "level", "tags", "acceptedAnswers",
  "acceptedArabicAnswers", "sourceRow", "favorite", "ignored", "userFlagged",
  "qualityStatus", "qualityIssues", "qualityNote", "createdAt", "updatedAt"
];
const CARD_FIELDS = [
  "key", "wordId", "skill", "state", "dueAt", "intervalDays", "ease", "stability",
  "difficulty", "reps", "lapses", "correct", "wrong", "streak", "mastery",
  "lastReviewedAt", "lastResult", "suspended", "createdAt", "updatedAt"
];
const ATTEMPT_FIELDS = [
  "id", "sessionId", "wordId", "cardKey", "skill", "correct", "answerType", "rating",
  "initial", "retryCount", "itemType", "usedHint", "revealed", "elapsedMs",
  "userAnswer", "correctAnswer", "createdAt"
];

/**
 * Compare two learner-state snapshots field by field.
 * Differences report entity, identity, and field name only. Learner content values are
 * included solely when `includeValues` is explicitly enabled (test diagnostics), so
 * reports and logs never expose private study content by default.
 */
export function compareLearnerState(source, restored, { includeValues = false } = {}) {
  const differences = [];
  const note = (entity, id, field, a, b) => {
    const entry = { entity, id, field };
    if (includeValues) { entry.source = a; entry.restored = b; }
    differences.push(entry);
  };

  compareCollection(source.words, restored.words, "id", WORD_FIELDS, "word", note);
  compareCollection(source.cards, restored.cards, "key", CARD_FIELDS, "card", note);
  compareCollection(source.attempts, restored.attempts, "id", ATTEMPT_FIELDS, "attempt", note);

  for (const [entity, a, b] of [["settings", source.settings, restored.settings], ["profile", source.profile, restored.profile]]) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      if (!deepEqual(a?.[key], b?.[key])) note(entity, entity, key, a?.[key], b?.[key]);
    }
  }

  return {
    identical: differences.length === 0,
    differences,
    counts: {
      words: [source.words?.length ?? 0, restored.words?.length ?? 0],
      cards: [source.cards?.length ?? 0, restored.cards?.length ?? 0],
      attempts: [source.attempts?.length ?? 0, restored.attempts?.length ?? 0]
    }
  };
}

function compareCollection(sourceList, restoredList, idField, fields, entity, note) {
  const source = Array.isArray(sourceList) ? sourceList : [];
  const restored = Array.isArray(restoredList) ? restoredList : [];
  const restoredById = new Map(restored.map(item => [String(item?.[idField]), item]));

  for (const item of source) {
    const id = String(item?.[idField]);
    const other = restoredById.get(id);
    if (!other) { note(entity, id, "<missing-after-restore>", item, undefined); continue; }
    restoredById.delete(id);
    for (const field of fields) {
      if (!deepEqual(item?.[field], other?.[field])) note(entity, id, field, item?.[field], other?.[field]);
    }
  }
  for (const id of restoredById.keys()) note(entity, id, "<unexpected-after-restore>", undefined, null);
}

function deepEqual(a, b) {
  if (a === b) return true;
  // null and undefined both mean "absent" across a JSON round-trip.
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!deepEqual(a[key], b[key])) return false;
    return true;
  }
  return false;
}
