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
 * Version 7 adds error learning. Two groups again, for the same reason:
 *   - AUTHORED taxonomy (error_categories, error_category_texts, error_remediations)
 *     is shareable content with no profile attached.
 *   - RECORDED mistakes (error_events, error_event_categories, error_patterns) belong
 *     to one learner and are keyed by profile_uuid.
 *
 * error_events RECORD what the deterministic evaluator already decided; they never
 * re-decide it. `scored` says whether that answer counted toward SRS, so an Arabic
 * answer is recorded with scored = 0: it can be learned from and shown back, but it
 * cannot re-enter correctness through the back door.
 *
 * error_event_categories carries a `source` of 'deterministic' or 'advisory'. AI may
 * only ever write 'advisory' rows. Nothing that drives practice reads them.
 *
 * Nothing in this group writes to review_cards. Error learning suggests what to
 * practise; it never reschedules a card.
 *
 * Version 8 adds listening. The audio FILE and the listening ACTIVITY are separate
 * entities, because one recording is often used by several activities and because a
 * file's availability changes independently of the teaching built on it.
 *
 * Offline-first is expressed in the schema, not left to convention:
 * audio_assets.availability records where the file actually IS ('bundled',
 * 'downloaded', 'source-only', 'remote'), separately from remote_url, which is
 * optional source metadata. Study is designed around a locally available file; a
 * remote URL is a way to GET one, never a requirement to study.
 *
 * Listening does not grade. Listening comprehension is checked by ordinary exercises
 * linked through listening_links, so the deterministic evaluator stays the single
 * grader. There is no listening-specific scoring column anywhere below.
 *
 * Transcripts and per-segment support follow the same language-as-a-ROW shape as
 * grammar, sentences and curriculum: German transcript, English support and Arabic
 * support are rows in the same table, so no language is the default the others hang
 * off, and a language can be added without a schema change.
 *
 * Lesson membership needs nothing new: lesson_items already references content as
 * (content_type, content_uuid), so a listening activity joins a lesson as
 * content_type = 'listening'.
 *
 * Version 9 adds pronunciation, and one omission in it is deliberate:
 * pronunciation_attempts has NO COLUMN FOR A MACHINE VERDICT OF CORRECTNESS.
 *
 * There is `self_rating`, which the learner gives, and `advisory_score`, which a
 * recognizer or model may suggest and which is labelled with its source. There is no
 * `correct`, no `scored`, and no `quality`, because judging speech automatically is
 * exactly the kind of unreliable verdict Arabic scoring was removed for. A field that
 * does not exist cannot later be quietly read as authority.
 *
 * What IS deterministic about pronunciation is authored, not heard: the phoneme
 * inventory, IPA, syllabification, stress, regional variety and minimal pairs. And a
 * minimal-pair DISCRIMINATION question - hear it, choose which word - is an ordinary
 * multiple-choice exercise in German, so it scores through the existing evaluator via
 * pronunciation_links. Producing speech is self-assessed; discriminating sounds is
 * scoreable. The schema keeps those two apart.
 *
 * Model audio reuses audio_assets from version 8 unchanged, so the offline-first
 * rules already established apply to pronunciation with no new mechanism.
 *
 * Version 1 was never activated for learners (nativeStorageEnabled stayed false through
 * Gate 5), so no deployed v1 database exists and v2 is the first version any learner
 * database will see. A forward migration step becomes necessary only once a learner
 * database has actually been written.
 */

export const SCHEMA_VERSION = 9;

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

  /* ------------------------------------------------ error learning --------
   * Authored taxonomy first: what kinds of mistake exist, described in every
   * educational language. Shareable content, so no profile_uuid appears here.
   */

  `CREATE TABLE IF NOT EXISTS error_categories (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL DEFAULT 'usage',
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

  /* Name, explanation and advice per language. Language is a ROW, as everywhere else. */
  `CREATE TABLE IF NOT EXISTS error_category_texts (
    uuid TEXT PRIMARY KEY,
    category_uuid TEXT NOT NULL,
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
    UNIQUE(category_uuid, language, kind),
    FOREIGN KEY (category_uuid) REFERENCES error_categories(uuid) ON DELETE CASCADE
  )`,

  /*
   * What to study to fix a category, referenced as (content_type, content_uuid) so a
   * grammar rule, a sentence, an exercise or a whole lesson can all be remediation.
   */
  `CREATE TABLE IF NOT EXISTS error_remediations (
    uuid TEXT PRIMARY KEY,
    category_uuid TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_uuid TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(category_uuid, content_type, content_uuid),
    FOREIGN KEY (category_uuid) REFERENCES error_categories(uuid) ON DELETE CASCADE
  )`,

  /* ------------------------------------------------ recorded mistakes ------
   * One row per mistake the learner actually made. `evaluation_type` is copied from
   * the deterministic evaluator's own verdict rather than recomputed, and `scored`
   * records whether that verdict was allowed to affect the card. An unscoreable
   * answer language is stored with scored = 0 and stays advisory forever.
   */

  `CREATE TABLE IF NOT EXISTS error_events (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    session_uuid TEXT,
    skill TEXT NOT NULL DEFAULT '',
    answer_language TEXT NOT NULL DEFAULT 'de',
    content_type TEXT NOT NULL DEFAULT 'vocabulary',
    content_uuid TEXT NOT NULL DEFAULT '',
    evaluation_type TEXT NOT NULL,
    scored INTEGER NOT NULL DEFAULT 0,
    expected_answer TEXT NOT NULL DEFAULT '',
    user_answer TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_error_events_profile ON error_events (profile_uuid, occurred_at)`,

  `CREATE INDEX IF NOT EXISTS idx_error_events_content ON error_events (content_type, content_uuid)`,

  /*
   * Classification of an event. `source` is 'deterministic' when it follows from the
   * evaluator's verdict, or 'advisory' when it is a suggestion (including AI). Both
   * are stored so the learner can see both; only deterministic rows drive practice.
   */
  `CREATE TABLE IF NOT EXISTS error_event_categories (
    uuid TEXT PRIMARY KEY,
    event_uuid TEXT NOT NULL,
    category_uuid TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'deterministic',
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(event_uuid, category_uuid, source),
    FOREIGN KEY (event_uuid) REFERENCES error_events(uuid) ON DELETE CASCADE,
    FOREIGN KEY (category_uuid) REFERENCES error_categories(uuid) ON DELETE CASCADE
  )`,

  /*
   * A recurring mistake, aggregated per learner. Entirely derivable from the events
   * above, and stored only so a long history does not have to be replayed on every
   * open. `status` is the learner-visible state: active, improving or resolved.
   */
  `CREATE TABLE IF NOT EXISTS error_patterns (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    category_uuid TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT '',
    content_uuid TEXT NOT NULL DEFAULT '',
    occurrences INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER,
    last_seen_at INTEGER,
    resolved_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(profile_uuid, category_uuid, content_type, content_uuid),
    FOREIGN KEY (category_uuid) REFERENCES error_categories(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_error_patterns_profile ON error_patterns (profile_uuid, status)`,

  /* ----------------------------------------------------- listening --------
   * The audio file, independent of any teaching built on it.
   *
   * `availability` is the offline-first fact: 'bundled' ships with the app,
   * 'downloaded' was fetched to the device, 'source-only' exists in the authoring
   * repository but not on the device, 'remote' is known only as a URL. Only the
   * first two are playable with no network. `remote_url` is never required.
   */

  `CREATE TABLE IF NOT EXISTS audio_assets (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    availability TEXT NOT NULL DEFAULT 'source-only',
    local_path TEXT NOT NULL DEFAULT '',
    source_path TEXT NOT NULL DEFAULT '',
    remote_url TEXT,
    mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
    byte_size INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    checksum TEXT,
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

  `CREATE INDEX IF NOT EXISTS idx_audio_assets_availability ON audio_assets (availability)`,

  /* The teaching activity. It carries no scoring column: comprehension is checked by
   * ordinary exercises linked through listening_links. */
  `CREATE TABLE IF NOT EXISTS listening_items (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    audio_uuid TEXT,
    activity_type TEXT NOT NULL DEFAULT 'gist',
    level TEXT NOT NULL DEFAULT '',
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
    FOREIGN KEY (audio_uuid) REFERENCES audio_assets(uuid) ON DELETE SET NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_listening_items_level ON listening_items (level, ordering)`,

  /* Title, German transcript, English and Arabic support: one row per
   * (item, language, kind). Language is a ROW, so the three are structural peers. */
  `CREATE TABLE IF NOT EXISTS listening_texts (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
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
    UNIQUE(item_uuid, language, kind),
    FOREIGN KEY (item_uuid) REFERENCES listening_items(uuid) ON DELETE CASCADE
  )`,

  /* Optional speaker metadata. A recording with one unnamed voice needs no row here. */
  `CREATE TABLE IF NOT EXISTS listening_speakers (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    variety TEXT NOT NULL DEFAULT '',
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (item_uuid) REFERENCES listening_items(uuid) ON DELETE CASCADE
  )`,

  /* Optional segmentation with timecodes. `ordering` is authoritative for order;
   * start_ms only breaks a tie, so a mis-typed timecode cannot silently reorder a
   * dialogue. */
  `CREATE TABLE IF NOT EXISTS listening_segments (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
    speaker_uuid TEXT,
    ordering INTEGER NOT NULL DEFAULT 0,
    start_ms INTEGER NOT NULL DEFAULT 0,
    end_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(item_uuid, ordering),
    FOREIGN KEY (item_uuid) REFERENCES listening_items(uuid) ON DELETE CASCADE,
    FOREIGN KEY (speaker_uuid) REFERENCES listening_speakers(uuid) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS listening_segment_texts (
    uuid TEXT PRIMARY KEY,
    segment_uuid TEXT NOT NULL,
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
    UNIQUE(segment_uuid, language, kind),
    FOREIGN KEY (segment_uuid) REFERENCES listening_segments(uuid) ON DELETE CASCADE
  )`,

  /* Links to what the recording teaches or practises, typed the same way lesson_items
   * and error_remediations are: (target_type, target_uuid). An exercise link is how a
   * listening activity is scored, through the existing evaluator. */
  `CREATE TABLE IF NOT EXISTS listening_links (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_uuid TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(item_uuid, target_type, target_uuid),
    FOREIGN KEY (item_uuid) REFERENCES listening_items(uuid) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_listening_links_target ON listening_links (target_type, target_uuid)`,

  /* ------------------------------------------------- pronunciation --------
   * The authored inventory: phonemes, contrasts, stress and intonation patterns,
   * and grapheme-to-sound correspondences. Shareable content, no profile attached.
   */

  `CREATE TABLE IF NOT EXISTS pronunciation_features (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    feature_kind TEXT NOT NULL DEFAULT 'phoneme',
    ipa TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT '',
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

  /* Names, explanations and advice for a feature or an item, one row per
   * (owner, language, kind), following curriculum_texts. Language is a ROW. */
  `CREATE TABLE IF NOT EXISTS pronunciation_texts (
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

  `CREATE INDEX IF NOT EXISTS idx_pronunciation_texts_owner ON pronunciation_texts (owner_type, owner_uuid)`,

  /* A practice item. `practice_mode` says what the learner does; only discrimination
   * modes can be scored, and even then through a linked exercise, never here. */
  `CREATE TABLE IF NOT EXISTS pronunciation_items (
    uuid TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    feature_uuid TEXT,
    practice_mode TEXT NOT NULL DEFAULT 'listen_repeat',
    target_type TEXT NOT NULL DEFAULT '',
    target_uuid TEXT NOT NULL DEFAULT '',
    model_audio_uuid TEXT,
    level TEXT NOT NULL DEFAULT '',
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
    FOREIGN KEY (feature_uuid) REFERENCES pronunciation_features(uuid) ON DELETE SET NULL,
    FOREIGN KEY (model_audio_uuid) REFERENCES audio_assets(uuid) ON DELETE SET NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pronunciation_items_target ON pronunciation_items (target_type, target_uuid)`,

  /* How the item is actually said. Several rows mean several accepted realizations
   * (de-DE, de-AT, de-CH); `is_primary` marks the one taught first. All authored. */
  `CREATE TABLE IF NOT EXISTS pronunciation_variants (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
    ipa TEXT NOT NULL DEFAULT '',
    syllables TEXT NOT NULL DEFAULT '',
    stress_index INTEGER NOT NULL DEFAULT 0,
    variety TEXT NOT NULL DEFAULT 'de-DE',
    is_primary INTEGER NOT NULL DEFAULT 0,
    audio_uuid TEXT,
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
    UNIQUE(item_uuid, variety, ordering),
    FOREIGN KEY (item_uuid) REFERENCES pronunciation_items(uuid) ON DELETE CASCADE,
    FOREIGN KEY (audio_uuid) REFERENCES audio_assets(uuid) ON DELETE SET NULL
  )`,

  /* Minimal pairs: the deterministic half of pronunciation. Two German words that
   * differ in one feature, which makes a discrimination question objectively
   * answerable and therefore scoreable through an ordinary exercise. */
  `CREATE TABLE IF NOT EXISTS pronunciation_pairs (
    uuid TEXT PRIMARY KEY,
    feature_uuid TEXT NOT NULL,
    a_text TEXT NOT NULL,
    a_vocab_uuid TEXT,
    a_audio_uuid TEXT,
    b_text TEXT NOT NULL,
    b_vocab_uuid TEXT,
    b_audio_uuid TEXT,
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
    UNIQUE(feature_uuid, a_text, b_text),
    FOREIGN KEY (feature_uuid) REFERENCES pronunciation_features(uuid) ON DELETE CASCADE
  )`,

  /* What an item teaches or is practised by, typed like listening_links. An exercise
   * link is the ONLY route by which pronunciation practice can be scored. */
  `CREATE TABLE IF NOT EXISTS pronunciation_links (
    uuid TEXT PRIMARY KEY,
    item_uuid TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_uuid TEXT NOT NULL,
    ordering INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(item_uuid, target_type, target_uuid),
    FOREIGN KEY (item_uuid) REFERENCES pronunciation_items(uuid) ON DELETE CASCADE
  )`,

  /*
   * A learner's attempt at SAYING something.
   *
   * Note what is absent: there is no `correct`, no `scored` and no `quality`. The
   * learner's own `self_rating` is the only judgement stored, and `advisory_score`
   * exists solely to record what a recognizer or model suggested, always alongside
   * `advisory_source` naming who suggested it. Nothing reads advisory_score as truth.
   */
  `CREATE TABLE IF NOT EXISTS pronunciation_attempts (
    uuid TEXT PRIMARY KEY,
    profile_uuid TEXT NOT NULL,
    item_uuid TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    session_uuid TEXT,
    self_rating INTEGER NOT NULL DEFAULT 0,
    advisory_score REAL,
    advisory_source TEXT,
    recording_audio_uuid TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (item_uuid) REFERENCES pronunciation_items(uuid) ON DELETE CASCADE,
    FOREIGN KEY (recording_audio_uuid) REFERENCES audio_assets(uuid) ON DELETE SET NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_profile ON pronunciation_attempts (profile_uuid, occurred_at)`,

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
    entity: "errorCategories",
    table: "error_categories",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["scope", "scope"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "errorCategoryTexts",
    table: "error_category_texts",
    columns: [
      ["uuid", "uuid"], ["category_uuid", "categoryUuid"], ["language", "language"],
      ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "errorRemediations",
    table: "error_remediations",
    columns: [
      ["uuid", "uuid"], ["category_uuid", "categoryUuid"],
      ["content_type", "contentType"], ["content_uuid", "contentUuid"],
      ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "errorEvents",
    table: "error_events",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["occurred_at", "occurredAt"],
      ["session_uuid", "sessionUuid"], ["skill", "skill"],
      ["answer_language", "answerLanguage"],
      ["content_type", "contentType"], ["content_uuid", "contentUuid"],
      ["evaluation_type", "evaluationType"], ["scored", "scored"],
      ["expected_answer", "expectedAnswer"], ["user_answer", "userAnswer"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "errorEventCategories",
    table: "error_event_categories",
    columns: [
      ["uuid", "uuid"], ["event_uuid", "eventUuid"], ["category_uuid", "categoryUuid"],
      ["source", "source"], ["confidence", "confidence"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "errorPatterns",
    table: "error_patterns",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["category_uuid", "categoryUuid"],
      ["content_type", "contentType"], ["content_uuid", "contentUuid"],
      ["occurrences", "occurrences"], ["first_seen_at", "firstSeenAt"],
      ["last_seen_at", "lastSeenAt"], ["resolved_at", "resolvedAt"], ["status", "status"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "audioAssets",
    table: "audio_assets",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["availability", "availability"],
      ["local_path", "localPath"], ["source_path", "sourcePath"], ["remote_url", "remoteUrl"],
      ["mime_type", "mimeType"], ["byte_size", "byteSize"], ["duration_ms", "durationMs"],
      ["checksum", "checksum"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningItems",
    table: "listening_items",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["audio_uuid", "audioUuid"],
      ["activity_type", "activityType"], ["level", "level"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningTexts",
    table: "listening_texts",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"], ["language", "language"],
      ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningSpeakers",
    table: "listening_speakers",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"], ["label", "label"],
      ["role", "role"], ["variety", "variety"], ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningSegments",
    table: "listening_segments",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"], ["speaker_uuid", "speakerUuid"],
      ["ordering", "ordering"], ["start_ms", "startMs"], ["end_ms", "endMs"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningSegmentTexts",
    table: "listening_segment_texts",
    columns: [
      ["uuid", "uuid"], ["segment_uuid", "segmentUuid"], ["language", "language"],
      ["kind", "kind"], ["text", "text"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "listeningLinks",
    table: "listening_links",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"],
      ["target_type", "targetType"], ["target_uuid", "targetUuid"], ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationFeatures",
    table: "pronunciation_features",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["feature_kind", "featureKind"],
      ["ipa", "ipa"], ["level", "level"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationTexts",
    table: "pronunciation_texts",
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
    entity: "pronunciationItems",
    table: "pronunciation_items",
    columns: [
      ["uuid", "uuid"], ["slug", "slug"], ["feature_uuid", "featureUuid"],
      ["practice_mode", "practiceMode"],
      ["target_type", "targetType"], ["target_uuid", "targetUuid"],
      ["model_audio_uuid", "modelAudioUuid"], ["level", "level"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationVariants",
    table: "pronunciation_variants",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"], ["ipa", "ipa"],
      ["syllables", "syllables"], ["stress_index", "stressIndex"], ["variety", "variety"],
      ["is_primary", "isPrimary"], ["audio_uuid", "audioUuid"], ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationPairs",
    table: "pronunciation_pairs",
    columns: [
      ["uuid", "uuid"], ["feature_uuid", "featureUuid"],
      ["a_text", "aText"], ["a_vocab_uuid", "aVocabUuid"], ["a_audio_uuid", "aAudioUuid"],
      ["b_text", "bText"], ["b_vocab_uuid", "bVocabUuid"], ["b_audio_uuid", "bAudioUuid"],
      ["ordering", "ordering"],
      ["content_status", "contentStatus"], ["content_version", "contentVersion"],
      ["source_reference", "sourceReference"], ["source_type", "sourceType"],
      ["verified_at", "verifiedAt"], ["verified_by", "verifiedBy"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationLinks",
    table: "pronunciation_links",
    columns: [
      ["uuid", "uuid"], ["item_uuid", "itemUuid"],
      ["target_type", "targetType"], ["target_uuid", "targetUuid"], ["ordering", "ordering"],
      ["created_at", "createdAt"], ["updated_at", "updatedAt"],
      ["revision", "revision"], ["deleted", "deleted"]
    ]
  },
  {
    entity: "pronunciationAttempts",
    table: "pronunciation_attempts",
    columns: [
      ["uuid", "uuid"], ["profile_uuid", "profileUuid"], ["item_uuid", "itemUuid"],
      ["occurred_at", "occurredAt"], ["session_uuid", "sessionUuid"],
      ["self_rating", "selfRating"], ["advisory_score", "advisoryScore"],
      ["advisory_source", "advisorySource"], ["recording_audio_uuid", "recordingAudioUuid"],
      ["note", "note"],
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
