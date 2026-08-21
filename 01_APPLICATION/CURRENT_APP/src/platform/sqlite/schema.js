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
 * Version 5 adds authored exercises: an exercise entity with a type, multilingual
 * instructions, options (choices/distractors), and targets linking it to the vocabulary,
 * sentence or grammar rule it practises. Options carry `scoreable` for the same reason
 * accepted answers do — Arabic options may be shown and explained but can never be the
 * thing that decides correctness.
 *
 * Version 6 adds the curriculum: courses -> CEFR levels -> units -> lessons ->
 * sections -> items, plus LEARNER PROGRESS in entirely separate tables.
 *
 * Two deliberate separations:
 *   1. Content structure and learner progress never share a table. Completing a lesson
 *      writes only to *_progress; it cannot touch review_cards, so course completion and
 *      SRS mastery stay independent dimensions of "how well do I know this".
 *   2. lesson_items reference content by (content_type, content_uuid) rather than by a
 *      column per kind. Listening and pronunciation can therefore be added later as new
 *      content_type values with no schema change.
 *
 * Version 1 was never activated for learners (nativeStorageEnabled stayed false through
 * Gate 5), so no deployed v1 database exists and v2 is the first version any learner
 * database will see. A forward migration step becomes necessary only once a learner
 * database has actually been written.
 */

export const SCHEMA_VERSION = 6;

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

  `CREATE TABLE IF NOT EXISTS exercises (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    exercise_type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT '',
    ordering INTEGER NOT NULL DEFAULT 0,
    answer_language TEXT NOT NULL DEFAULT 'de',
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

  `CREATE INDEX IF NOT EXISTS idx_exercises_level ON exercises (level, ordering)`,

  /* Instructions and hints, one row per (exercise, language, kind). Teaching text only. */
  `CREATE TABLE IF NOT EXISTS exercise_texts (
    uuid TEXT PRIMARY KEY,
    exercise_uuid TEXT NOT NULL,
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
    UNIQUE(exercise_uuid, language, kind),
    FOREIGN KEY (exercise_uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
  )`,

  /*
   * Options: expected answers and distractors. `scoreable` records whether an option may
   * decide correctness, mirroring accepted_answers, so an Arabic option can be displayed
   * and explained without ever grading.
   */
  `CREATE TABLE IF NOT EXISTS exercise_options (
    uuid TEXT PRIMARY KEY,
    exercise_uuid TEXT NOT NULL,
    text TEXT NOT NULL,
    language TEXT NOT NULL,
    is_expected INTEGER NOT NULL DEFAULT 0,
    scoreable INTEGER NOT NULL DEFAULT 0,
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (exercise_uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_exercise_options_exercise ON exercise_options (exercise_uuid, ordering)`,

  /* What the exercise practises: a vocabulary item, a sentence, or a grammar rule. */
  `CREATE TABLE IF NOT EXISTS exercise_targets (
    uuid TEXT PRIMARY KEY,
    exercise_uuid TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(exercise_uuid, target_type, target_uuid),
    FOREIGN KEY (exercise_uuid) REFERENCES exercises(uuid) ON DELETE CASCADE
  )`,

  /* ---------------------------------------------------------- curriculum */

  `CREATE TABLE IF NOT EXISTS courses (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    cefr_level TEXT NOT NULL DEFAULT '',
    ordering INTEGER NOT NULL DEFAULT 0,
    source_title TEXT,
    source_publisher TEXT,
    source_edition TEXT,
    source_isbn TEXT,
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

  /* A course may span several CEFR stages; most span one. */
  `CREATE TABLE IF NOT EXISTS course_levels (
    uuid TEXT PRIMARY KEY,
    course_uuid TEXT NOT NULL,
    cefr_level TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(course_uuid, cefr_level),
    FOREIGN KEY (course_uuid) REFERENCES courses(uuid) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS course_units (
    uuid TEXT PRIMARY KEY,
    course_uuid TEXT NOT NULL,
    course_level_uuid TEXT,
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
    FOREIGN KEY (course_uuid) REFERENCES courses(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_course_units_course ON course_units (course_uuid, ordering)`,

  `CREATE TABLE IF NOT EXISTS lessons (
    uuid TEXT PRIMARY KEY,
    unit_uuid TEXT NOT NULL,
    slug TEXT NOT NULL,
    cefr_level TEXT NOT NULL DEFAULT '',
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
    FOREIGN KEY (unit_uuid) REFERENCES course_units(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons (unit_uuid, ordering)`,

  `CREATE TABLE IF NOT EXISTS lesson_sections (
    uuid TEXT PRIMARY KEY,
    lesson_uuid TEXT NOT NULL,
    slug TEXT NOT NULL,
    section_kind TEXT NOT NULL DEFAULT 'practice',
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
    FOREIGN KEY (lesson_uuid) REFERENCES lessons(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_lesson_sections_lesson ON lesson_sections (lesson_uuid, ordering)`,

  /*
   * Membership: which canonical content a section teaches, in order. Referenced by
   * (content_type, content_uuid) so listening and pronunciation become new type values
   * rather than new columns.
   */
  `CREATE TABLE IF NOT EXISTS lesson_items (
    uuid TEXT PRIMARY KEY,
    section_uuid TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_uuid TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    required INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(section_uuid, content_type, content_uuid),
    FOREIGN KEY (section_uuid) REFERENCES lesson_sections(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_lesson_items_section ON lesson_items (section_uuid, ordering)`,

  `CREATE TABLE IF NOT EXISTS lesson_prerequisites (
    uuid TEXT PRIMARY KEY,
    lesson_uuid TEXT NOT NULL,
    requires_lesson_uuid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(lesson_uuid, requires_lesson_uuid),
    FOREIGN KEY (lesson_uuid) REFERENCES lessons(uuid) ON DELETE CASCADE,
    FOREIGN KEY (requires_lesson_uuid) REFERENCES lessons(uuid) ON DELETE CASCADE
  )`,

  /* Titles and descriptions for course/unit/lesson/section, language as a row. */
  `CREATE TABLE IF NOT EXISTS curriculum_texts (
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

  `CREATE INDEX IF NOT EXISTS idx_curriculum_texts_owner ON curriculum_texts (owner_type, owner_uuid)`,

  /* ------------------------------------------------- learner progress ------
   * Separate from content by construction. Nothing here writes to review_cards,
   * so finishing a lesson can never alter SRS mastery, ease or due dates.
   */

  `CREATE TABLE IF NOT EXISTS course_progress (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    course_uuid TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    started_at INTEGER,
    completed_at INTEGER,
    last_lesson_uuid TEXT,
    last_section_uuid TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(profile_uuid, course_uuid)
  )`,

  `CREATE TABLE IF NOT EXISTS lesson_progress (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    lesson_uuid TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(profile_uuid, lesson_uuid)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_lesson_progress_profile ON lesson_progress (profile_uuid, status)`,

  `CREATE TABLE IF NOT EXISTS section_progress (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    section_uuid TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(profile_uuid, section_uuid)
  )`,

  `CREATE TABLE IF NOT EXISTS cefr_progress (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    cefr_level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(profile_uuid, cefr_level)
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
    entity: "exercises",
    table: "exercises",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["exercise_type", "exerciseType"],
      ["level", "level"], ["ordering", "ordering"], ["answer_language", "answerLanguage"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "exerciseTexts",
    table: "exercise_texts",
    columns: [
      ["uuid", "uuid"], ["exercise_uuid", "exerciseUuid"], ["language", "language"],
      ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "exerciseOptions",
    table: "exercise_options",
    columns: [
      ["uuid", "uuid"], ["exercise_uuid", "exerciseUuid"], ["text", "text"],
      ["language", "language"], ["is_expected", "isExpected"], ["scoreable", "scoreable"],
      ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "exerciseTargets",
    table: "exercise_targets",
    columns: [
      ["uuid", "uuid"], ["exercise_uuid", "exerciseUuid"], ["target_type", "targetType"],
      ["target_uuid", "targetUuid"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "courses",
    table: "courses",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["cefr_level", "cefrLevel"],
      ["ordering", "ordering"], ["source_title", "sourceTitle"],
      ["source_publisher", "sourcePublisher"], ["source_edition", "sourceEdition"],
      ["source_isbn", "sourceIsbn"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "courseLevels",
    table: "course_levels",
    columns: [
      ["uuid", "uuid"], ["course_uuid", "courseUuid"], ["cefr_level", "cefrLevel"],
      ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "courseUnits",
    table: "course_units",
    columns: [
      ["uuid", "uuid"], ["course_uuid", "courseUuid"],
      ["course_level_uuid", "courseLevelUuid"], ["slug", "slug"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "lessons",
    table: "lessons",
    columns: [
      ["uuid", "uuid"], ["unit_uuid", "unitUuid"], ["slug", "slug"],
      ["cefr_level", "cefrLevel"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "lessonSections",
    table: "lesson_sections",
    columns: [
      ["uuid", "uuid"], ["lesson_uuid", "lessonUuid"], ["slug", "slug"],
      ["section_kind", "sectionKind"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "lessonItems",
    table: "lesson_items",
    columns: [
      ["uuid", "uuid"], ["section_uuid", "sectionUuid"], ["content_type", "contentType"],
      ["content_uuid", "contentUuid"], ["ordering", "ordering"], ["required", "required"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "lessonPrerequisites",
    table: "lesson_prerequisites",
    columns: [
      ["uuid", "uuid"], ["lesson_uuid", "lessonUuid"],
      ["requires_lesson_uuid", "requiresLessonUuid"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "curriculumTexts",
    table: "curriculum_texts",
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
    entity: "courseProgress",
    table: "course_progress",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["course_uuid", "courseUuid"],
      ["status", "status"], ["started_at", "startedAt"], ["completed_at", "completedAt"],
      ["last_lesson_uuid", "lastLessonUuid"], ["last_section_uuid", "lastSectionUuid"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "lessonProgress",
    table: "lesson_progress",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["lesson_uuid", "lessonUuid"],
      ["status", "status"], ["started_at", "startedAt"], ["completed_at", "completedAt"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "sectionProgress",
    table: "section_progress",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["section_uuid", "sectionUuid"],
      ["status", "status"], ["completed_at", "completedAt"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "cefrProgress",
    table: "cefr_progress",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["cefr_level", "cefrLevel"],
      ["status", "status"], ["started_at", "startedAt"], ["completed_at", "completedAt"],
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
