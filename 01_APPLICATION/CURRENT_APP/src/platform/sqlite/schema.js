/*
 * Canonical SQLite schema (Version 2) for DeutschFlow native persistence.
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
 *
 * Version 2 adds the multilingual content model: a `translations` table for English,
 * alongside the existing Arabic `vocabulary_meanings`, plus `accepted_answers.scoreable`
 * recording whether an answer may decide correctness. English and Arabic carry equal
 * educational weight; only German and English may score. See src/content/languages.js.
 *
 * Version 1 was never activated for learners (nativeStorageEnabled stayed false through
 * Gate 5), so no deployed v1 database exists and v2 is the first version any learner
 * database will see. A forward migration step becomes necessary only once a learner
 * database has actually been written.
 */

export const SCHEMA_VERSION = 2;

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS learner_profiles (
    uuid TEXT PRIMARY KEY,
    username TEXT,
    streak INTEGER NOT NULL DEFAULT 0,
    last_study_date TEXT,
    total_xp INTEGER NOT NULL DEFAULT 0,
    cloud_user_id TEXT,
    last_session_at INTEGER,
    sessions TEXT,
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
    extras TEXT,
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
    tags TEXT,
    ignored INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    user_flagged INTEGER NOT NULL DEFAULT 0,
    quality_status TEXT,
    quality_issues TEXT,
    quality_note TEXT,
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

  `CREATE TABLE IF NOT EXISTS translations (
    uuid TEXT PRIMARY KEY,
    meaning_uuid TEXT NOT NULL,
    english_text TEXT NOT NULL,
    normalized_english TEXT NOT NULL,
    explanation TEXT,
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
    FOREIGN KEY (meaning_uuid) REFERENCES vocabulary_meanings(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_translations_meaning ON translations (meaning_uuid)`,

  `CREATE TABLE IF NOT EXISTS accepted_answers (
    uuid TEXT PRIMARY KEY,
    meaning_uuid TEXT,
    translation_uuid TEXT,
    text TEXT NOT NULL,
    language TEXT NOT NULL,
    -- Whether this answer may decide correctness. Arabic answers are stored (they are
    -- educational content) but never score. See src/content/languages.js.
    scoreable INTEGER NOT NULL DEFAULT 0,
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

  /*
   * Unresolved source records are preserved here verbatim rather than dropped, so a
   * structural migration is never destructive (e.g. an SRS card whose vocabulary word
   * was deleted keeps its repetitions, ease, and lapses and stays recoverable). Rows
   * are inert: nothing in the learning path reads them.
   */
  `CREATE TABLE IF NOT EXISTS migration_quarantine (
    uuid TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    source_id TEXT,
    reasons TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS review_events (
    uuid TEXT PRIMARY KEY,
    legacy_id TEXT,
    card_uuid TEXT NOT NULL,
    vocab_uuid TEXT,
    session_id TEXT,
    skill TEXT,
    item_type TEXT,
    correct INTEGER NOT NULL DEFAULT 0,
    answer_type TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    rating INTEGER,
    initial INTEGER,
    retry_count INTEGER,
    used_hint INTEGER,
    revealed INTEGER,
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
      ["cloud_user_id", "cloudUserId"], ["last_session_at", "lastSessionAt"],
      ["sessions", "sessions"], ["created_at", "createdAt"],
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
      ["extras", "extras"],
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
      ["tags", "tags"], ["ignored", "ignored"], ["favorite", "favorite"],
      ["user_flagged", "userFlagged"], ["quality_status", "qualityStatus"],
      ["quality_issues", "qualityIssues"], ["quality_note", "qualityNote"],
      ["content_status", "contentStatus"],
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
      ["pronunciation", "pronunciation"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "translations",
    table: "translations",
    columns: [
      ["uuid", "uuid"], ["meaning_uuid", "meaningUuid"], ["english_text", "englishText"],
      ["normalized_english", "normalizedEnglish"], ["explanation", "explanation"],
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
      ["language", "language"], ["scoreable", "scoreable"], ["created_at", "createdAt"],
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
      ["uuid", "uuid"], ["legacy_id", "legacyId"], ["card_uuid", "cardUuid"],
      ["vocab_uuid", "vocabUuid"], ["session_id", "sessionId"], ["skill", "skill"],
      ["item_type", "itemType"], ["correct", "correct"], ["answer_type", "answerType"],
      ["user_answer", "userAnswer"], ["correct_answer", "correctAnswer"],
      ["elapsed_ms", "elapsedMs"], ["rating", "rating"], ["initial", "initial"],
      ["retry_count", "retryCount"], ["used_hint", "usedHint"], ["revealed", "revealed"],
      ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "quarantine",
    table: "migration_quarantine",
    columns: [
      ["uuid", "uuid"], ["entity", "entity"], ["source_id", "sourceId"],
      ["reasons", "reasons"], ["payload", "payload"], ["created_at", "createdAt"],
      ["updated_at", "updatedAt"], ["revision", "revision"], ["deleted", "deleted"]
    ]
  }
];
