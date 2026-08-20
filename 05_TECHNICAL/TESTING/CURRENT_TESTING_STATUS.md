# Current Testing Status (CURRENT_TESTING_STATUS.md)

This document details the current testing coverage and validation mechanisms of the **DeutschFlow** baseline application.

---

## 1. Automated Test Framework
*   **Unit Tests:** **ABSENT**. There are no unit test runners, test suites, or test specs (e.g. Jest, Mocha, Vitest) in the codebase.
*   **Integration Tests:** **ABSENT**. No integration tests are present to verify storage sync, migration paths, or state machines.
*   **End-to-End Tests:** **ABSENT**. No web driver or automation frameworks (e.g. Playwright, Cypress, Puppeteer) are configured.
*   **Build/CI Checks:** **ABSENT**. There is no compilation, bundling, or linting pipeline (e.g. ESLint, Prettier, Webpack, Vite checks).

---

## 2. Static and Runtime Data Validation
Although functional testing is absent, the application contains a built-in **Runtime Data Audit** utility located in `src/app.js` under the `DF.dataAudit` function.

### Verification Capabilities
1.  **Duplicate Form Check:** Identifies pairs of items that share exact normalized German spellings and Arabic definitions.
2.  **Conflicting Definitions:** Flagging identical German lemmas mapped to different Arabic definitions.
3.  **Ambiguous Translation Mapping:** Mapping multiple distinct German words to a single Arabic meaning (which may or may not be correct synonyms).
4.  **Structural Quality Rules (`qualityIssues`):**
    *   Missing mandatory fields.
    *   Unclosed formatting brackets or parentheses.
    *   Workbook page or lesson references embedded in spelling strings.
    *   Malformed layouts derived from spreadsheet formatting.
    *   Nouns missing corresponding grammatical gender articles (`der`, `die`, `das`).
    *   Noun gender articles mismatched with spelling start tokens.
    *   Unusually long text strings (e.g. German text > 180 chars, Arabic text > 220 chars).
    *   Arabic sentence translations whose length is too short compared to the German prompt.

### UI representation
Users can view items flagged with issues by applying the "تحتاج مراجعة" (Requires Review) filter in the Word Bank or by opening the Quality Control Modal from the settings page. Flagged words display a "بيانات" (Data) warning pill.

---

## 3. Recommended Future Testing Framework
Because DeutschFlow has a high number of critical validation rules and custom scheduling math, adding deterministic automated testing is a P1 priority before refactoring or implementing updates:

1.  **Linguistic Grading Tests:** Tests for `validateGermanAnswer`, `validateArticleAnswer`, and `validateArabicAnswer` to verify correct grading behavior for typos, punctuation, article errors, and diacritics.
2.  **SRS Logic Verification:** Unit tests for `scheduleCard`, `cardMastery`, and `automaticRating` to verify correct ease, lapses, and interval progression across repeated reviews.
3.  **Migration and Sync Tests:** Mock tests to verify database migrations from `german_vocab_std` to `deutschflow_v2`.
4.  **Backup/Restore Verification:** Tests to verify backup serialization and safety checks preventing database corruption during restoration.
