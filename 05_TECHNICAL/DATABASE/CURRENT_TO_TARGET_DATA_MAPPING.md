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
