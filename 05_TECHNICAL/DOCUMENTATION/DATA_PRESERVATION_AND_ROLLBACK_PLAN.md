# Data Preservation and Rollback Plan (DATA_PRESERVATION_AND_ROLLBACK_PLAN.md)

This document establishes the data protection protocols, structural migration safety pipeline, and multi-tier rollback procedures for DeutschFlow user learning data.

---

## 1. Non-Destructive Migration Pipeline

To ensure absolute safety of existing user learning progress, database migrations execute using a non-destructive **Read-Validate-Transform-Write-Verify-Switch** pipeline:

```
┌────────────────────────────────────────────────────────┐
│ 1. READ OLD (IndexedDB words, cards, attempts, meta)  │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 2. VALIDATE & CLASSIFY RECORDS                         │
│ (Valid, Migratable, Requires Transformation)          │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 3. TRANSFORM & GENERATE UUIDs                          │
│ (Map legacy integer IDs to UUIDs; re-calculate norms)  │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 4. WRITE NEW (Single SQLite Transaction)               │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 5. VERIFY PARITY (Row counts, SRS due dates, ease)    │
└───────────┬────────────────────────────────────────────┘
            │ PASS                                FAIL │
            ▼                                          ▼
┌──────────────────────┐                   ┌──────────────────────┐
│ 6. SWITCH DRIVER     │                   │ ROLLBACK TRANSACTION │
│ (Set SQLite Primary) │                   │ (Retain IndexedDB)   │
└──────────────────────┘                   └──────────────────────┘
```

### Critical Rule
The legacy IndexedDB database is **NEVER deleted or truncated** during or after SQLite migration. It remains intact as an emergency fallback repository.

---

## 2. Legacy Record Classification

Data records read from IndexedDB are classified before writing to SQLite:
1.  **Valid & Directly Migratable:** German text, CEFR levels, item types, streaks, lapses, review state.
2.  **Requires Transformation:** Legacy integer `wordId` maps to generated `vocabUuid`; `acceptedAnswers` string arrays split into `accepted_answers` rows.
3.  **Requires Validation:** `normalizedGerman` and `normalizedArabic` strings are recalculated using the updated normalizer functions to ensure indexing consistency.
4.  **Quarantined / Unresolved:** Legacy seed entries flagged with invalid schema formatting are isolated in a `quarantined_records` log without interrupting primary database migration.

---

## 3. Rollback Procedures

```
                       ┌─────────────────────────┐
                       │   Migration Failure     │
                       └───────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Tier 1: Transaction │   │ Tier 2: DB File │       │ Tier 3: JSON    │
│ Rollback (SQLite)│   │ Restore         │       │ Backup Restore  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Tier 1: SQLite Transaction Abort
*   **Trigger:** SQL constraint error or parity check failure during migration script execution.
*   **Action:** Execute `ROLLBACK` on the active SQLite database transaction. Delete corrupted target database file.
*   **Recovery State:** Application remains on IndexedDB storage driver without data mutation.

### Tier 2: Database File Restore
*   **Trigger:** Corruption detected during runtime launch after migration completed.
*   **Action:** Replace `deutschflow.db` with `deutschflow.db.bak` created during pre-migration backup.

### Tier 3: Portable JSON Backup Recovery
*   **Trigger:** Total device or wrapper storage failure.
*   **Action:** Prompt user to restore from exported JSON backup file (`deutschflow-backup-YYYY-MM-DD.json`). The JSON restore engine validates payload schema version and populates SQLite tables cleanly.
