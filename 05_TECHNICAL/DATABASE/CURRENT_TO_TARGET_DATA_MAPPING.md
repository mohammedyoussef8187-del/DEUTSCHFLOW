# Current to Target Data Mapping (CURRENT_TO_TARGET_DATA_MAPPING.md)

This document maps the baseline IndexedDB database structure (`deutschflow_v2` stores) to the future canonical relational schema.

---

## 1. Schema Mapping Reference

### 1.1 Store: `words` to Relational Tables
Current store elements are distributed across normalization tables to support multi-meanings:

| Current Field Name | Target Table | Target Field Name | Classification | Mapping Strategy & Notes |
|---|---|---|---|---|
| `id` | `vocabulary_items` | `uuid` | **Requires transformation** | Seed integers are converted to stable UUIDs (e.g. mapping `33` -> custom seed namespace UUID). |
| `german` | `vocabulary_items` | `german` | **Directly migratable** | Maps spelling string directly. |
| `normalizedGerman`| `vocabulary_items` | `normalizedGerman` | **Requires validation** | Recalculate using target normalizer rules to ensure compatibility. |
| `arabic` | `vocabulary_meanings` | `arabicText` | **Directly migratable** | Primary Arabic translation target. |
| `normalizedArabic`| `vocabulary_meanings` | `normalizedArabic` | **Requires validation** | Recalculate using updated normalizer rules. |
| `pronunciation` | `vocabulary_meanings` | `explanation` | **Requires transformation**| Stores phonetic Arabic script text inside notes field or dedicated field. |
| `itemType` | `vocabulary_items` | `itemType` | **Directly migratable** | Inferred type values: noun, word, phrase, sentence. |
| `article` | `vocabulary_items` | `article` | **Directly migratable** | Noun articles (der, die, das, or null). |
| `plural` | `vocabulary_items` | `plural` | **Directly migratable** | Plural suffix string. |
| `level` | `vocabulary_items` | `level` | **Directly migratable** | CEFR level marker (e.g. A1, A2). |
| `tags` | `vocabulary_meanings` | `tags` | **Directly migratable** | String arrays mapped to tagging fields. |
| `acceptedAnswers` | `accepted_answers` | `text` | **Requires transformation**| Convert line-delimited entries into separate rows in `accepted_answers` (DE). |
| `acceptedArabicAnswers`| `accepted_answers`| `text` | **Requires transformation**| Convert line-delimited entries into separate rows in `accepted_answers` (AR). |
| `sourceRow` | `vocabulary_items` | `sourceReference` | **Directly migratable** | Trace reference cell row number. |
| `favorite` | `vocabulary_meanings` | `favorite` | **Directly migratable** | Boolean star state. |
| `ignored` | `vocabulary_items` | `deleted` | **Requires transformation**| Ignored items set `deleted = 1` or mapped to `ignored` state in card levels. |
| `userFlagged` | `vocabulary_meanings` | `qualityStatus` | **Requires transformation**| Flagged status maps to validation queues. |
| `createdAt` | `vocabulary_items` | `createdAt` | **Directly migratable** | Epoch milliseconds. |
| `updatedAt` | `vocabulary_items` | `updatedAt` | **Directly migratable** | Epoch milliseconds. |

---

### 1.2 Store: `cards` to `review_cards`

| Current Field Name | Target Table | Target Field Name | Classification | Mapping Strategy & Notes |
|---|---|---|---|---|
| `key` | `review_cards` | `uuid` | **Requires transformation** | Format `${wordId}:${skill}` converted to UUID. |
| `wordId` | `review_cards` | `vocabUuid` | **Requires transformation**| Maps legacy integer `wordId` to the newly generated `vocabUuid`. |
| `skill` | `review_cards` | `skill` | **Directly migratable** | recall -> `recall_german` (in scored phase). article -> `article`. |
| `state` | `review_cards` | `state` | **Directly migratable** | new, learning, review, mastered. |
| `dueAt` | `review_cards` | `dueAt` | **Directly migratable** | Review timestamp. |
| `intervalDays` | `review_cards` | `intervalDays` | **Directly migratable** | Decimal days interval. |
| `ease` | `review_cards` | `ease` | **Directly migratable** | Ease factor. |
| `reps` | `review_cards` | `reps` | **Directly migratable** | Repetition count. |
| `lapses` | `review_cards` | `lapses` | **Directly migratable** | Lapses count. |
| `streak` | `review_cards` | `streak` | **Directly migratable** | Consecutive correct answers. |
| `mastery` | `review_cards` | `mastery` | **Directly migratable** | Progress score. |
| `lastReviewedAt` | `review_cards` | `lastReviewedAt` | **Directly migratable** | Last epoch milliseconds reviewed. |

---

### 1.3 Store: `attempts` to `review_events`

| Current Field Name | Target Table | Target Field Name | Classification | Mapping Strategy & Notes |
|---|---|---|---|---|
| `id` | `review_events` | `uuid` | **Requires transformation** | Convert integer PK to UUID. |
| `cardKey` | `review_events` | `cardUuid` | **Requires transformation**| Maps legacy card key to newly generated `cardUuid`. |
| `sessionId` | `review_events` | `sessionId` | **Directly migratable** | Session UUID string. |
| `correct` | `review_events` | `correct` | **Directly migratable** | Boolean correct indicator. |
| `answerType` | `review_events` | `answerType` | **Directly migratable** | perfect, typo, etc. |
| `userAnswer` | `review_events` | `userAnswer` | **Directly migratable** | Raw user typing. |
| `elapsedMs` | `review_events` | `elapsedMs` | **Directly migratable** | Input latency. |
| `createdAt` | `review_events` | `createdAt` | **Directly migratable** | Event timestamp. |

---

## 2. Implementation Refinements (Phase 4)

These refinements were applied when the mapping was realized in code
(`src/migration/canonical-migration.js`, `src/platform/sqlite/schema.js`). They stay
within the approved architecture and exist to preserve learner state exactly and losslessly:

*   **`words.ignored` -> `vocabulary_items.ignored` (own column), not `deleted`.** Keeping the
    learner's excluded/quarantine state as its own boolean column keeps the row visible to
    integrity checks and keeps exclusion reversible. `deleted` stays `0` for ignored items.
*   **Extended SRS columns on `review_cards`.** In addition to the design-reference fields,
    the runtime's full card state is carried through unchanged: `correct`, `wrong`,
    `stability`, `difficulty`, `last_result`, `suspended`. This makes migration a lossless
    round-trip rather than a lossy projection.
*   **`pronunciation` kept as its own `vocabulary_meanings.pronunciation` column** instead of
    being folded into `explanation`, so phonetic text is preserved without overloading a notes
    field.
*   **`acceptedArabicAnswers` -> `accepted_answers` rows with `language = "ar"`** (alongside DE
    rows), preserving the Arabic accepted-answer set the current model stores.
*   **Skill names preserved verbatim** (`recall`, `recognition`, `article`, `order`). Renaming
    to the scored-phase vocabulary (e.g. `recall_german`) is deferred so SRS identity and the
    parity round-trip stay exact during structural migration.
*   **Stable identifiers** are deterministic name-based UUIDs derived from legacy identity, so
    re-running migration is idempotent and child rows link to parents without a shared counter.

### 2.1 Loss-Prevention Refinements (from the real-data dry-run)

Dry-running the mapping against the real exported learner state (2026-08-20 export) revealed
source fields that the first mapping pass did not read. They are now preserved:

*   **Word-scoped fields kept on `vocabulary_items`:** `tags`, `qualityIssues`, `qualityNote`,
    and `favorite` / `userFlagged` / `qualityStatus`. These were originally assigned to
    `vocabulary_meanings` (anticipating multi-meaning support), but a word without a meaning row
    would then lose them. They are carried on the item, which always exists. Per-meaning
    favouriting can be introduced later as a forward migration without risking loss now.
*   **All settings preserved:** the settings the engine reads directly remain typed columns; every
    other stored preference is preserved verbatim in `settings.extras` (JSON).
*   **Full review history preserved:** `review_events` also carries `skill`, `item_type`,
    `correct_answer`, `initial`, `retry_count`, `used_hint`, `revealed`, and the originating
    `vocab_uuid`.
*   **Profile:** `lastSessionAt` and `sessions` preserved.

### 2.2 Table: `migration_quarantine`

Unresolved source records are quarantined, reported, **and preserved verbatim** rather than
dropped. The real export contains one SRS card (`2691:recall`) whose vocabulary word no longer
exists, plus the one attempt referencing it; discarding them would destroy learner state
(3 lapses, 3 wrong answers, ease 1.9). They are written to `migration_quarantine` with entity,
source id, reasons, and the original record as JSON. Active tables keep clean referential
integrity, the rows are inert (nothing in the learning path reads them), and the state stays
recoverable.
