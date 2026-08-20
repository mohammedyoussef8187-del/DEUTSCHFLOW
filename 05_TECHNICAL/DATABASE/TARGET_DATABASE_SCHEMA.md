# Target Database Schema (TARGET_DATABASE_SCHEMA.md)

This document defines the physical table schema for the upgraded **DeutschFlow** canonical storage.

---

## 1. Schema Tables Definition

### 1.1 Table: `learner_profiles`
*   **Purpose:** Tracks local and cloud user identities.
*   **Fields:**
    *   `uuid` (TEXT, PK): Unique profile identifier.
    *   `username` (TEXT, Optional)
    *   `streak` (INTEGER, Required): Consecutive study days count.
    *   `lastStudyDate` (TEXT, Optional): Local date string.
    *   `totalXP` (INTEGER, Required): Accumulated experience points.
    *   `cloudUserId` (TEXT, Optional): Linked external authentication account identifier.
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** High. Used to identify ownership.

### 1.2 Table: `settings`
*   **Purpose:** User configuration.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `profileUuid` (TEXT, FK -> `learner_profiles.uuid`)
    *   `theme` (TEXT, Required): auto, light, dark.
    *   `sessionSize` (INTEGER, Required)
    *   `dailyGoal` (INTEGER, Required)
    *   `showPronunciation` (INTEGER, Boolean, Required)
    *   `acceptAeOeUe` (INTEGER, Boolean, Required)
    *   `acceptSs` (INTEGER, Boolean, Required)
    *   `requireArticle` (INTEGER, Boolean, Required)
    *   `ignoreSentencePunctuation` (INTEGER, Boolean, Required)
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** Yes (last-write-win sync).

### 1.3 Table: `lessons` (Course Structure)
*   **Purpose:** Curriculum layout.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `level` (TEXT, Required): e.g. "A1", "A2".
    *   `unitNumber` (INTEGER, Required)
    *   `unitTitle` (TEXT, Required)
    *   `lessonNumber` (INTEGER, Required)
    *   `lessonTitle` (TEXT, Required)
    *   `prerequisiteLessonUuid` (TEXT, Optional, FK -> `lessons.uuid`)
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** Read-only educational content. Syncs via curriculum update checks.

### 1.4 Table: `vocabulary_items`
*   **Purpose:** Targets vocabulary lemmas.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `german` (TEXT, Required): Core German spelling.
    *   `normalizedGerman` (TEXT, Required): Lowercased, stripped version.
    *   `itemType` (TEXT, Required): noun, word, phrase, sentence.
    *   `article` (TEXT, Optional): der, die, das.
    *   `plural` (TEXT, Optional)
    *   `level` (TEXT, Required): CEFR level.
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Indexes:**
    *   `idx_vocab_german` on `german`
    *   `idx_vocab_normalized` on `normalizedGerman`
*   **Sync Relevance:** Read-only educational content. Custom additions require sync updates.

### 1.5 Table: `vocabulary_meanings`
*   **Purpose:** Links vocabulary items to Arabic explanations/meanings.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `vocabUuid` (TEXT, FK -> `vocabulary_items.uuid`, Cascade Delete)
    *   `arabicText` (TEXT, Required): Standard Arabic meaning.
    *   `normalizedArabic` (TEXT, Required)
    *   `explanation` (TEXT, Optional)
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** Read-only educational content.

### 1.6 Table: `translations`
*   **Purpose:** Scored translation prompts/answers in English.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `meaningUuid` (TEXT, FK -> `vocabulary_meanings.uuid`, Cascade Delete)
    *   `englishText` (TEXT, Required): Standard English equivalent.
    *   `normalizedEnglish` (TEXT, Required)
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** Read-only educational content.

### 1.7 Table: `accepted_answers`
*   **Purpose:** Alternative accepted entries for validation checks.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `meaningUuid` (TEXT, Optional, FK -> `vocabulary_meanings.uuid`)
    *   `translationUuid` (TEXT, Optional, FK -> `translations.uuid`)
    *   `text` (TEXT, Required): Spelling check entry.
    *   `language` (TEXT, Required): "de" or "en".
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** Read-only educational content.

### 1.8 Table: `review_cards` (SRS State)
*   **Purpose:** Tracks spaced-repetition schedules.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `profileUuid` (TEXT, FK -> `learner_profiles.uuid`)
    *   `vocabUuid` (TEXT, FK -> `vocabulary_items.uuid`)
    *   `skill` (TEXT, Required): recall_german, recall_english, article, syntax.
    *   `state` (TEXT, Required): new, learning, review, mastered.
    *   `dueAt` (INTEGER, Required): UTC epoch timestamp.
    *   `intervalDays` (REAL, Required)
    *   `ease` (REAL, Required)
    *   `reps` (INTEGER, Required)
    *   `lapses` (INTEGER, Required)
    *   `streak` (INTEGER, Required)
    *   `mastery` (INTEGER, Required)
    *   `lastReviewedAt` (INTEGER, Optional)
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Uniqueness:** Unique constraint on `(profileUuid, vocabUuid, skill)`.
*   **Indexes:**
    *   `idx_cards_due` on `(profileUuid, dueAt, state)`
*   **Sync Relevance:** High (learner state).

### 1.9 Table: `review_events` (Attempts Log)
*   **Purpose:** Append-only study history.
*   **Fields:**
    *   `uuid` (TEXT, PK)
    *   `cardUuid` (TEXT, FK -> `review_cards.uuid`)
    *   `sessionId` (TEXT, Required)
    *   `correct` (INTEGER, Boolean, Required)
    *   `answerType` (TEXT, Required): perfect, minor_typo, incorrect, etc.
    *   `userAnswer` (TEXT, Optional)
    *   `elapsedMs` (INTEGER, Required)
    *   `rating` (INTEGER, Required): 1 (Again), 2 (Hard), 3 (Good), 4 (Easy).
    *   `createdAt`, `updatedAt`, `revision`, `deleted` (Metadata)
*   **Sync Relevance:** High (append-only events can merge directly without conflicts).

---

## 2. SQL Schema Design Reference (SQLite Compatible)

```sql
-- DESIGN REFERENCE — NOT IMPLEMENTATION

CREATE TABLE IF NOT EXISTS vocabulary_items (
    uuid TEXT PRIMARY KEY,
    german TEXT NOT NULL,
    normalized_german TEXT NOT NULL,
    item_type TEXT NOT NULL,
    article TEXT,
    plural TEXT,
    level TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vocabulary_meanings (
    uuid TEXT PRIMARY KEY,
    vocab_uuid TEXT NOT NULL,
    arabic_text TEXT NOT NULL,
    normalized_arabic TEXT NOT NULL,
    explanation TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS translations (
    uuid TEXT PRIMARY KEY,
    meaning_uuid TEXT NOT NULL,
    english_text TEXT NOT NULL,
    normalized_english TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (meaning_uuid) REFERENCES vocabulary_meanings(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_cards (
    uuid TEXT PRIMARY KEY,
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
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vocab_uuid) REFERENCES vocabulary_items(uuid) ON DELETE CASCADE,
    UNIQUE(profile_uuid, vocab_uuid, skill)
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON review_cards (profile_uuid, due_at, state) WHERE deleted = 0;
```
