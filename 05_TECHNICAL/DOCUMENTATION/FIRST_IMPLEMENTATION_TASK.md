# First Implementation Task Specification (FIRST_IMPLEMENTATION_TASK.md)

This document specifies the exact scope, boundaries, allowed file modifications, and success criteria for the **very first implementation task** of the DeutschFlow Mobile-First roadmap.

---

## 1. Task Metadata

*   **Task Title:** Establish Characterization Test Harness & Baseline Regression Safety Net
*   **Target Phase:** Phase 1 (Baseline Characterization & Regression Protection)
*   **Prerequisite:** User review and approval of the Mobile-First Implementation Plan.
*   **Estimated Complexity:** LOW
*   **Modifies Learner Data:** NO (Zero data impact; read-only operations)
*   **Installs Lit:** NO
*   **Installs Capacitor:** NO
*   **Modifies Runtime Application Code:** NO

---

## 2. Objective & Rationale

### Objective
Create an automated unit and integration test harness (using Vitest in Node environment) alongside a reference golden test dataset (`golden_vocab_dataset.json`) to characterize and lock existing application behavior (`normalizeGerman`, `normalizeArabic`, `validateGermanAnswer`, Levenshtein typo thresholds, and SRS card math).

### Why This Task is First
The current application has no automated test coverage. Refactoring `app.js` or migrating storage without automated regression tests creates a high risk of subtle bugs in answer evaluation or SRS schedules. Establishing a test safety net first guarantees 100% behavioral safety before any structural code changes occur.

---

## 3. Allowed and Prohibited File Boundaries

### Files Allowed to Change
1.  `package.json` (Add Vitest devDependency and `test` script).
2.  `tests/` directory (NEW files: unit test specifications and golden fixture data).
3.  `00_PROJECT_CONTROL/CURRENT_WORK_STATUS.md` (Update project status tracking).
4.  `00_PROJECT_CONTROL/CHANGELOG.md` (Log task completion).

### Files Strictly Prohibited from Changing
1.  `src/app.js` (Must remain untouched during this task).
2.  `data/seed-data.js` (Must remain untouched).
3.  `index.html` (Must remain untouched).
4.  Any CSS, asset, or runtime application file.

---

## 4. Task Step-by-Step Instructions

1.  **Step 1:** Initialize Vitest in devDependencies:
    ```bash
    npm install -D vitest
    ```
2.  **Step 2:** Create `tests/fixtures/golden_vocab_dataset.json` containing nouns with articles/plurals, verbs, adjectives, multiple accepted answers, and review card states.
3.  **Step 3:** Create `tests/unit/evaluator.test.js` asserting normalization rules, umlaut substitutions, case handling, and typo distance calculations against `src/app.js` functions.
4.  **Step 4:** Create `tests/unit/srs_math.test.js` asserting ease boundaries (`[1.3, 3.2]`), repetition increments, and interval formulas.
5.  **Step 5:** Execute `npm test` and verify 100% test pass rate.

---

## 5. Success Criteria & Rollback Plan

### Success Criteria
*   `npm test` executes cleanly and passes 100% of assertions.
*   Characterization tests lock exact baseline behavior for answer evaluation and SRS calculations.
*   `src/app.js` remains 100% bit-for-bit identical to pre-task commit.

### Rollback Plan
If any dependency failure occurs during task setup:
1.  Run `git checkout -- package.json package-lock.json`.
2.  Remove `tests/` directory.
3.  Restore workspace to pre-task baseline commit.
