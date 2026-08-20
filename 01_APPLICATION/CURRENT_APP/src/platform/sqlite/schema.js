/*
 * Canonical SQLite schema (Version 1) for DeutschFlow native persistence.
 *
 * Physical realization of TARGET_DATABASE_SCHEMA.md. Two deliberate, documented
 * refinements over the design-reference DDL, both to preserve learner state exactly:
 *   1. `vocabulary_items.ignored` keeps the learner's excluded/quarantine state as its
 *      own column instead of conflating it with `deleted` (so exclusion stays reversible
 *      and the row is never hidden from integrity checks).
 *   2. `review_cards` carries the full SRS state the runtime tracks
 *      (correct/wrong/stability/difficulty/last_result/suspended) so migration is a
 *      lossless round-trip, not a lossy projection.
 * Educational-content lifecycle columns (content_status, content_version, the source_
 * fields, and the verified_ fields) let verified wording later supersede legacy wording
 * without touching the learner's SRS rows.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS learner_profiles (
    uuid TEXT PRIMARY KEY,
    username TEXT,
    streak INTEGER NOT NULL DEFAULT 0,
    last_study_date TEXT,
    total_xp INTEGER NOT NULL DEFAULT 0,
    cloud_user_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'auto',
    session_size INTEGER NOT NULL DEFAULT 20,
    daily_goal INTEGER NOT NULL DEFAULT 25,
    show_pronunciation INTEGER NOT NULL DEFAULT 1,
    accept_ae_oe_ue INTEGER NOT NULL DEFAULT 1,
    accept_ss INTEGER NOT NULL DEFAULT 1,
    require_article INTEGER NOT NULL DEFAULT 1,
    ignore_sentence_punctuation INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (profile_uuid) REFERENCES learner_profiles(uuid) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS vocabulary_items (
    uuid TEXT PRIMARY KEY,
    legacy_id TEXT,
    german TEXT NOT NULL,
    normalized_german TEXT NOT NULL,
    item_type TEXT NOT NULL,
    article TEXT,
    plural TEXT,
    level TEXT NOT NULL DEFAULT '',
    ignored INTEGER NOT NULL DEFAULT 0,
    content_status TEXT NOT NULL DEFAULT 'legacy',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_normalized ON vocabulary_items (normalized_german)`,

  `CREATE TABLE IF NOT EXISTS vocabulary_meanings (
    uuid TEXT PRIMARY KEY,
    vocab_uuid TEXT NOT NULL,
    arabic_text TEXT NOT NULL,
    normalized_arabic TEXT NOT NULL,
    explanation TEXT,
    pronunciation TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    user_flagged INTEGER NOT NULL DEFAULT 0,
    quality_status TEXT NOT NULL DEFAULT 'legacy',
    content_status TEXT NOT NULL DEFAULT 'legacy',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS accepted_answers (
    uuid TEXT PRIMARY KEY,
    meaning_uuid TEXT,
    translation_uuid TEXT,
    text TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (meaning_uuid) REFERENCES vocabulary_meanings(uuid) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS review_cards (
    uuid TEXT PRIMARY KEY,
    legacy_key TEXT,
    profile_uuid TEXT NOT NULL,
    vocab_uuid TEXT NOT NULL,
    skill TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'new',
    due_at INTEGER NOT NULL,
    interval_days REAL NOT NULL DEFAULT 0.0,
    ease REAL NOT NULL DEFAULT 2.5,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    mastery INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at INTEGER,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    stability REAL NOT NULL DEFAULT 0.0,
    difficulty REAL NOT NULL DEFAULT 5.0,
    last_result INTEGER,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE,
    UNIQUE(profile_uuid, vocab_uuid, skill)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cards_due ON review_cards (profile_uuid, due_at, state)`,

  `CREATE TABLE IF NOT EXISTS review_events (
    uuid TEXT PRIMARY KEY,
    card_uuid TEXT NOT NULL,
    session_id TEXT,
    correct INTEGER NOT NULL DEFAULT 0,
    answer_type TEXT,
    user_answer TEXT,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    rating INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (card_uuid) REFERENCES review_cards(uuid) ON DELETE CASCADE
  )`
];

/*
 * Column <-> canonical-field mapping per table. `entity` is the dataset key produced by
 * the migration transform; column order drives both INSERT and SELECT so writes and reads
 * stay symmetric and a round-trip is exact.
 */
export const TABLE_SPECS = [
  {
    entity: "profiles",
    table: "learner_profiles",
    columns: [
      ["uuid", "uuid"], ["username", "username"], ["streak", "streak"],
      ["last_study_date", "lastStudyDate"], ["total_xp", "totalXP"],
      ["cloud_user_id", "cloudUserId"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "settings",
    table: "settings",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["theme", "theme"],
      ["session_size", "sessionSize"], ["daily_goal", "dailyGoal"],
      ["show_pronunciation", "showPronunciation"], ["accept_ae_oe_ue", "acceptAeOeUe"],
      ["accept_ss", "acceptSs"], ["require_article", "requireArticle"],
      ["ignore_sentence_punctuation", "ignoreSentencePunctuation"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "vocabularyItems",
    table: "vocabulary_items",
    columns: [
      ["uuid", "uuid"], ["legacy_id", "legacyId"], ["german", "german"],
      ["normalized_german", "normalizedGerman"], ["item_type", "itemType"],
      ["article", "article"], ["plural", "plural"], ["level", "level"],
      ["ignored", "ignored"], ["content_status", "contentStatus"],
      ["content_version", "contentVersion"], ["source_reference", "sourceReference"],
      ["source_type", "sourceType"], ["verified_at", "verifiedAt"],
      ["verified_by", "verifiedBy"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "vocabularyMeanings",
    table: "vocabulary_meanings",
    columns: [
      ["uuid", "uuid"], ["vocab_uuid", "vocabUuid"], ["arabic_text", "arabicText"],
      ["normalized_arabic", "normalizedArabic"], ["explanation", "explanation"],
      ["pronunciation", "pronunciation"], ["favorite", "favorite"],
      ["user_flagged", "userFlagged"], ["quality_status", "qualityStatus"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "acceptedAnswers",
    table: "accepted_answers",
    columns: [
      ["uuid", "uuid"], ["meaning_uuid", "meaningUuid"],
      ["translation_uuid", "translationUuid"], ["text", "text"],
      ["language", "language"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "reviewCards",
    table: "review_cards",
    columns: [
      ["uuid", "uuid"], ["legacy_key", "legacyKey"], ["profile_uuid", "profileUuid"],
      ["vocab_uuid", "vocabUuid"], ["skill", "skill"], ["state", "state"],
      ["due_at", "dueAt"], ["interval_days", "intervalDays"], ["ease", "ease"],
      ["reps", "reps"], ["lapses", "lapses"], ["streak", "streak"],
      ["mastery", "mastery"], ["last_reviewed_at", "lastReviewedAt"],
      ["correct", "correct"], ["wrong", "wrong"], ["stability", "stability"],
      ["difficulty", "difficulty"], ["last_result", "lastResult"],
      ["suspended", "suspended"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "reviewEvents",
    table: "review_events",
    columns: [
      ["uuid", "uuid"], ["card_uuid", "cardUuid"], ["session_id", "sessionId"],
      ["correct", "correct"], ["answer_type", "answerType"],
      ["user_answer", "userAnswer"], ["elapsed_ms", "elapsedMs"],
      ["rating", "rating"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  }
];
