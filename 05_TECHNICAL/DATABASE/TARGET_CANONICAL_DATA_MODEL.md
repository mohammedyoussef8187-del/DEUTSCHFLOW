# Target Canonical Data Model (TARGET_CANONICAL_DATA_MODEL.md)

This document describes the logical data model for the upgraded **DeutschFlow** German Learning System, designed to be platform-independent.

---

## 1. Multi-Language and Context-Sense Architecture

To support multiple languages (German, English, Arabic) and multiple contextual meanings per word (e.g. `fahren` meaning *to drive* vs *to travel*), the data model decouples the vocabulary spelling from its semantic definitions.

```
       ┌──────────────────────┐
       │    VocabularyItem    │  (German spelling, level, type, gender)
       └──────────┬───────────┘
                  │ 1
                  │
                  │ has many
                  ▼ 1..*
       ┌──────────────────────┐
       │   VocabularyMeaning  │  (Context sense definition, tags, status)
       └──────────┬───────────┘
                  │
     ┌────────────┴────────────┐
     │ has many                │ has many
     ▼ 1..*                    ▼ 1..*
┌──────────┐              ┌──────────┐
│Translation│             │Accepted  │
│ (English) │             │Answer    │
└──────────┘              └──────────┘
(Scored prompts/answers)  (Synonyms, typos, inflections)
```

### 1.1 VocabularyItem Table
Stores the primary spelling, grammatical markers, and structural attributes of the German target entry.
*   **Attributes:** Target German lemma, part of speech, article (noun gender), plural suffix, level (CEFR), and timestamps.

### 1.2 VocabularyMeaning (Context-Sense) Table
Represents a specific semantic definition of a word. A single `VocabularyItem` can map to multiple `VocabularyMeaning` entries.
*   **Example (`fahren`):**
    *   *Sense 1:* To drive a vehicle (context: *Auto fahren*).
    *   *Sense 2:* To travel / go (context: *mit dem Zug fahren*).
*   **Attributes:** Arabic translation, grammatical annotations, contextual tags, and quality flags.
*   **Grading role:** Stores the Arabic meaning as annotations. Arabic answers do **NOT** participate in scored evaluation.

### 1.3 Translation (English equivalents) Table
Stores the scored translation entries in English.
*   **Attributes:** Canonical English translation string used for scored recall prompting.
*   **Grading role:** Participates in scored German-English and English-German evaluation.

### 1.4 AcceptedAnswer Table
Contains acceptable alternative synonyms, inflected spellings, or approved minor typo equivalents for a specific `VocabularyMeaning` or `Translation`.
*   **Attributes:** Text string, language tag (DE, EN), and validation status.

---

## 2. Synchronization Metadata Fields

Every syncable table in the canonical database must include the following metadata fields to enable safe cloud synchronization and conflict resolution:
1.  **Globally Unique Identifier (`uuid`):** RFC4122 v4 UUID string, assigned locally at creation. Relational foreign keys map to this UUID, preventing ID clashing when databases merge.
2.  **Creation Timestamp (`createdAt`):** UTC epoch millisecond timestamp.
3.  **Modification Timestamp (`updatedAt`):** UTC epoch millisecond timestamp.
4.  **Revision Version (`revision`):** Integer incremented on local modifications, used in Optimistic Concurrency Control (OCC) sync checks.
5.  **Tombstone State (`deleted`):** Boolean indicator (default `false`). Deleting a record flags `deleted = true` instead of purging the row, enabling delete synchronization to other devices.
