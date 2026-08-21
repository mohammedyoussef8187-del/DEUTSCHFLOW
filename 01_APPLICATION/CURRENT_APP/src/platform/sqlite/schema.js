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
 * Version 3 adds grammar as first-class structured content: topics, rules, examples,
 * and a single grammar_texts table where LANGUAGE IS A ROW rather than a column. That
 * shape is deliberate — it makes English and Arabic structurally equal peers, lets a
 * language be added without a schema change, and stops one language becoming the
 * "default" that others hang off. Each text row carries its own content lifecycle, so an
 * Arabic explanation can be verified independently of its English counterpart.
 *
 * Version 4 adds sentences and contextual usage as first-class content, following the
 * same shape grammar established: one German sentence entity, support texts keyed by
 * language ROW in sentence_texts, and many-to-many links to both vocabulary and grammar
 * rules so a sentence belongs to neither exclusively. Context/domain tags are normalized
 * rows rather than a JSON blob, so they can be queried and curated.
 *
 * Version 1 was never activated for learners (nativeStorageEnabled stayed false through
 * Gate 5), so no deployed v1 database exists and v2 is the first version any learner
 * database will see. A forward migration step becomes necessary only once a learner
 * database has actually been written.
 */

export const SCHEMA_VERSION = 4;

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

  `CREATE TABLE IF NOT EXISTS grammar_topics (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL DEFAULT '',
    category TEXT,
    ordering INTEGER NOT NULL DEFAULT 0,
    content_status TEXT NOT NULL DEFAULT 'draft',
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

  `CREATE TABLE IF NOT EXISTS grammar_rules (
    uuid TEXT PRIMARY KEY,
    topic_uuid TEXT NOT NULL,
    slug TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    content_status TEXT NOT NULL DEFAULT 'draft',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (topic_uuid) REFERENCES grammar_topics(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_rules_topic ON grammar_rules (topic_uuid, ordering)`,

  `CREATE TABLE IF NOT EXISTS grammar_examples (
    uuid TEXT PRIMARY KEY,
    rule_uuid TEXT NOT NULL,
    german TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    content_status TEXT NOT NULL DEFAULT 'draft',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (rule_uuid) REFERENCES grammar_rules(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_examples_rule ON grammar_examples (rule_uuid, ordering)`,

  /*
   * One text row per (owner, language, kind). Language is a ROW, not a column, so
   * English and Arabic are peers by construction and a third language needs no schema
   * change. owner_type is 'topic' | 'rule' | 'example'.
   */
  `CREATE TABLE IF NOT EXISTS grammar_texts (
    uuid TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_uuid TEXT NOT NULL,
    language TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    content_status TEXT NOT NULL DEFAULT 'draft',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(owner_type, owner_uuid, language, kind)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_texts_owner ON grammar_texts (owner_type, owner_uuid)`,

  /* Links vocabulary to the grammar it demonstrates, without either owning the other. */
  `CREATE TABLE IF NOT EXISTS vocabulary_grammar (
    uuid TEXT PRIMARY KEY,
    vocab_uuid TEXT NOT NULL,
    rule_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(vocab_uuid, rule_uuid),
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE,
    FOREIGN KEY (rule_uuid) REFERENCES grammar_rules(uuid) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS sentences (
    uuid TEXT PRIMARY KEY,
    german TEXT NOT NULL,
    normalized_german TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT '',
    register TEXT,
    ordering INTEGER NOT NULL DEFAULT 0,
    content_status TEXT NOT NULL DEFAULT 'draft',
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

  `CREATE INDEX IF NOT EXISTS idx_sentences_level ON sentences (level, ordering)`,

  /*
   * Support texts for a sentence: translation, explanation, or note, one row per
   * (sentence, language, kind). Language is a ROW here too, so English and Arabic stay
   * peers and each can be verified on its own schedule.
   */
  `CREATE TABLE IF NOT EXISTS sentence_texts (
    uuid TEXT PRIMARY KEY,
    sentence_uuid TEXT NOT NULL,
    language TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    content_status TEXT NOT NULL DEFAULT 'draft',
    content_version INTEGER NOT NULL DEFAULT 1,
    source_reference TEXT,
    source_type TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sentence_uuid, language, kind),
    FOREIGN KEY (sentence_uuid) REFERENCES sentences(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sentence_texts_sentence ON sentence_texts (sentence_uuid)`,

  /* A sentence demonstrates vocabulary; neither owns the other. */
  `CREATE TABLE IF NOT EXISTS sentence_vocabulary (
    uuid TEXT PRIMARY KEY,
    sentence_uuid TEXT NOT NULL,
    vocab_uuid TEXT NOT NULL,
    role TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sentence_uuid, vocab_uuid),
    FOREIGN KEY (sentence_uuid) REFERENCES sentences(uuid) ON DELETE CASCADE,
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE
  )`,

  /* A sentence illustrates grammar rules; again many-to-many. */
  `CREATE TABLE IF NOT EXISTS sentence_grammar (
    uuid TEXT PRIMARY KEY,
    sentence_uuid TEXT NOT NULL,
    rule_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sentence_uuid, rule_uuid),
    FOREIGN KEY (sentence_uuid) REFERENCES sentences(uuid) ON DELETE CASCADE,
    FOREIGN KEY (rule_uuid) REFERENCES grammar_rules(uuid) ON DELETE CASCADE
  )`,

  /* Context/domain tags as rows, so they can be queried and curated. */
  `CREATE TABLE IF NOT EXISTS sentence_tags (
    uuid TEXT PRIMARY KEY,
    sentence_uuid TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sentence_uuid, tag),
    FOREIGN KEY (sentence_uuid) REFERENCES sentences(uuid) ON DELETE CASCADE
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
    entity: "grammarTopics",
    table: "grammar_topics",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["level", "level"],
      ["category", "category"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "grammarRules",
    table: "grammar_rules",
    columns: [
      ["uuid", "uuid"], ["topic_uuid", "topicUuid"], ["slug", "slug"],
      ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "grammarExamples",
    table: "grammar_examples",
    columns: [
      ["uuid", "uuid"], ["rule_uuid", "ruleUuid"], ["german", "german"],
      ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "grammarTexts",
    table: "grammar_texts",
    columns: [
      ["uuid", "uuid"], ["owner_type", "ownerType"], ["owner_uuid", "ownerUuid"],
      ["language", "language"], ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "vocabularyGrammar",
    table: "vocabulary_grammar",
    columns: [
      ["uuid", "uuid"], ["vocab_uuid", "vocabUuid"], ["rule_uuid", "ruleUuid"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sentences",
    table: "sentences",
    columns: [
      ["uuid", "uuid"], ["german", "german"], ["normalized_german", "normalizedGerman"],
      ["level", "level"], ["register", "register"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sentenceTexts",
    table: "sentence_texts",
    columns: [
      ["uuid", "uuid"], ["sentence_uuid", "sentenceUuid"], ["language", "language"],
      ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sentenceVocabulary",
    table: "sentence_vocabulary",
    columns: [
      ["uuid", "uuid"], ["sentence_uuid", "sentenceUuid"], ["vocab_uuid", "vocabUuid"],
      ["role", "role"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sentenceGrammar",
    table: "sentence_grammar",
    columns: [
      ["uuid", "uuid"], ["sentence_uuid", "sentenceUuid"], ["rule_uuid", "ruleUuid"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sentenceTags",
    table: "sentence_tags",
    columns: [
      ["uuid", "uuid"], ["sentence_uuid", "sentenceUuid"], ["tag", "tag"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
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
