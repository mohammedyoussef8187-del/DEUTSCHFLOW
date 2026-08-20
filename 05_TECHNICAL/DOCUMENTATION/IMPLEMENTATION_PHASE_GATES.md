# Implementation Phase Gates & Stop Gates (IMPLEMENTATION_PHASE_GATES.md)

This document defines the hard **Stop Gates** that govern the DeutschFlow Mobile-First implementation sequence. No execution agent may bypass a Stop Gate without explicit user approval.

---

## 1. Stop Gate Definitions

```
┌────────────────────────────────────────────────────────┐
│  Gate 0: Baseline & Regression Safety Gate             │
│  (100% test pass on characterization suite)            │
└───────────┬────────────────────────────────────────────┘
            │ APPROVED
            ▼
┌────────────────────────────────────────────────────────┐
│  Gate 1: Modularization Verification Gate              │
│  (app.js decoupled into ES modules with zero diff)     │
└───────────┬────────────────────────────────────────────┘
            │ APPROVED
            ▼
┌────────────────────────────────────────────────────────┐
│  Gate 2: Database Backup & Parity Gate                 │
│  (Full backup exported & verified in isolated runner)  │
└───────────┬────────────────────────────────────────────┘
            │ APPROVED
            ▼
┌────────────────────────────────────────────────────────┐
│  Gate 3: SQLite Storage Parity Gate                    │
│  (SQLite transaction migration verified 100% equal)   │
└───────────┬────────────────────────────────────────────┘
            │ APPROVED
            ▼
┌────────────────────────────────────────────────────────┐
│  Gate 4: Lit Proof-of-Architecture Gate                │
│  (Minimal component verified; zero domain coupling)    │
└───────────┬────────────────────────────────────────────┘
            │ APPROVED
            ▼
┌────────────────────────────────────────────────────────┐
│  Gate 5: Mobile Shell & Native Build Gate              │
│  (Capacitor iOS/Android build verified offline)       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Gate Criteria and Rollback Procedures

### Gate 0: Baseline & Regression Safety Gate
*   **Precondition:** Characterization test harness (Vitest) and golden dataset installed.
*   **Success Criteria:** All regression tests for normalizers, Levenshtein typos, answer evaluation, and SRS interval math pass cleanly.
*   **Verification Command:** `npm test`
*   **Rollback Trigger:** Test failures or behavioral discrepancies against baseline `app.js`.
*   **User Action Required:** Explicit approval to begin Phase 2.

### Gate 1: Modularization Verification Gate
*   **Precondition:** Core functions extracted from `app.js` into ES modules under `src/core/`, `src/srs/`, `src/exercises/`.
*   **Success Criteria:** 100% regression test suite pass rate; zero change in evaluation outputs or card metrics.
*   **Rollback Trigger:** Any test breakage or module import failure.

### Gate 2: Database Backup & Verification Gate
*   **Precondition:** Automated JSON backup exported from IndexedDB.
*   **Success Criteria:** Backup imported into an isolated test harness; total word count, card schedules, streaks, and settings match source database exactly.
*   **Rollback Trigger:** Mismatch in card count, missing SRS fields, or corrupted JSON data.

### Gate 3: SQLite Storage Parity Gate
*   **Precondition:** Structural data migration executed from IndexedDB to `@capacitor-community/sqlite`.
*   **Success Criteria:** Row counts match source; zero orphan cards; ease factors within `[1.3, 3.2]`; SRS due timestamps unchanged. Source IndexedDB preserved intact.
*   **Rollback Trigger:** Any migration transaction failure or referential integrity error (revert to IndexedDB adapter).

### Gate 4: Lit Proof-of-Architecture Gate
*   **Precondition:** Lit dependency integrated; 1 isolated component (`df-status-pill`) rendered.
*   **Success Criteria:** Lit component renders cleanly; zero domain logic embedded inside component; existing app views function without regression.
*   **Rollback Trigger:** Component styling leak, performance stutter, or architectural coupling.

### Gate 5: Mobile Shell & Native Build Gate
*   **Precondition:** Capacitor iOS and Android projects configured with native SQLite plugin.
*   **Success Criteria:** App launches offline on iPad emulator and Android device; touchscreen study controls functional; virtual keyboard does not obscure answer input fields.
*   **Rollback Trigger:** Native plugin crashes, WebView load errors, or layout rendering defects.
