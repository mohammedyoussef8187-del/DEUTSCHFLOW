# Data Migration Strategy (DATA_MIGRATION_STRATEGY.md)

This document describes the execution steps and validation scripts to migrate user data from the baseline PWA database (`deutschflow_v2` IndexedDB) to the new SQLite database.

---

## 1. Migration Execution Sequencing

The migration must execute automatically on the first native application launch without requiring user intervention:

```
┌────────────────────────────────────────────────────────┐
│                   Open SQLite Database                 │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│        Query and verify empty target database          │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│       Check for existing IndexedDB databases           │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│      Read all records from words, cards, attempts      │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│     Map IDs, generate UUIDs, format properties         │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│   Write transaction to SQLite tables (All or Nothing)  │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│      Run post-migration verification constraints       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Preservation Rules

### 2.0 Preservation Does Not Confer Educational Authority
Structural migration copies legacy educational wording unchanged so migration remains auditable and learner relationships remain intact. Imported sentences, translations, explanations, and contextual wording must be marked with legacy provenance and must not be treated as verified course content solely because migration succeeded.

Educational content review is a separate phase. A later verified revision may replace or supersede legacy wording while stable vocabulary identities, cards, review events, due dates, intervals, ease, repetitions, favorites, flags, and settings remain attached to the learner record.

### 2.1 SRS Intervals and Due Dates
*   All card review states (`new`, `learning`, `review`, `mastered`), repetition counts (`reps`), ease values (`ease`), lapses (`lapses`), and streaks (`streak`) must be written directly to the target `review_cards` table.
*   **Due Date Alignment:** Due timestamps (`dueAt`) must be imported unchanged. The application must not trigger immediate expiration check recalculations on launch.

### 2.2 Custom Content and Flags
*   Custom vocabulary added by the user must be migrated as custom `vocabulary_items`.
*   User-created accepted alternative answers (`acceptedAnswers` and `acceptedArabicAnswers`) must be converted to individual rows in the `accepted_answers` table.
*   Starred items (`favorite`) and quarantine states (`ignored`) must be successfully written to the new model.

---

## 3. Data Integrity Verification Checks

After database transactions commit, the migration controller must verify the following constraints before declaring the migration successful:
1.  **Row Count Check:** Total migrated vocabulary rows must match the source IndexedDB total words count.
2.  **Referential Integrity Check:** Ensure there are no orphan cards (`review_cards` pointing to non-existent `vocabUuid`).
3.  **SRS Interval Boundaries Check:** Verify that ease factors are within the strict `[1.3, 3.2]` bounds and repetition values match source records.
4.  **Failure Rollback:** If any check fails, the SQLite transaction must rollback completely. The application remains on the static seed database and logs the migration exception.
5.  **Content Fidelity Check:** Migration must preserve source wording and provenance without silently correcting it. Content verification status is migrated independently from structural-validity status.
6.  **Learner-State Independence Check:** Replacing or superseding educational wording must not create new review cards, reset existing cards, or alter review history.
