# Claude Handoff: DeutschFlow Structural Completion

**Branch Audited:** `gemini/deutschflow-structure-audit` (derived from `origin/mobile-foundation`)  
**Commit Audited:** `9f07498b98741ab65bc80231f07739824d883b6d`  
**Test Suite Baseline:** 64 test files passed (1069 / 1069 tests passing)

---

## 1. Summary of Confirmed Structural Gaps

| Gap ID | Description | Exact Files | Exact Symbols | Severity | Scope |
|---|---|---|---|---|---|
| **GAP-01** | `learn-controller.js` ignores `practice-select` and `segment-select` component events | `01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js` | `createLearnController` -> `handleEvent` (lines 624–629) | `REQUIRED_BEFORE_RELEASE` | MEDIUM |
| **GAP-02** | `app.js` hardcodes `schemaVersion: 5` in manual export instead of using `backup.js` constant | `01_APPLICATION/CURRENT_APP/src/app.js`, `src/data/backup.js` | `app.js` -> `exportBackup` (line 575), `backup.js` -> `DEFAULT_SCHEMA_VERSION` | `REQUIRED_BEFORE_RELEASE` | SMALL |
| **GAP-03** | `app.js` `bootLearn` does not pass `openExecutor` hook to `bootstrapCanonicalRuntime` | `01_APPLICATION/CURRENT_APP/src/app.js`, `src/platform/sqlite/capacitor-executor.js` | `app.js` -> `bootLearn` (line 1028), `openCapacitorSqlite` | `REQUIRED_BEFORE_RELEASE` | SMALL |
| **GATE-01** | Physical device validation gate for native storage and local notifications | `src/runtime/feature-gates.js`, `src/platform/storage-selection.js` | `RUNTIME_GATES.canonicalNativeStore`, `RUNTIME_GATES.nativeNotifications`, `RUNTIME_GATES.learnerStorageSwitch` | `CAN_DEFER` (Release Gate) | SMALL |

---

## 2. Exact Files to Open for Implementation

1. **`01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js`**
   * **Lines 618–642 (`handleEvent`):**
     * Currently `practice-select` returns `{ reload: false }`. Update it to route to the exercise flow for the selected error pattern.
     * Currently `segment-select` returns `{ reload: false }`. Update it to focus the segment on the `<df-listening-player>`.
2. **`01_APPLICATION/CURRENT_APP/src/app.js`**
   * **Line 575 (`exportBackup`):**
     * Replace `schemaVersion: 5` with `DEFAULT_SCHEMA_VERSION` (version 6) or import from `src/data/backup.js`.
   * **Lines 1026–1037 (`bootLearn`):**
     * Pass `openExecutor: () => openCapacitorSqlite()` when `detectNativePlatform()` is true.

---

## 3. Recommended Fix Order

1. **Fix GAP-02 (Backup Schema Version alignment):**
   * Touch: `app.js` -> `exportBackup`
   * Tests to run: `npm test tests/integration/backup-restore.test.js`
2. **Fix GAP-03 (Native executor hook in `bootLearn`):**
   * Touch: `app.js` -> `bootLearn`
   * Tests to run: `npm test tests/integration/composition-root.test.js tests/integration/runtime-module-smoke.test.js`
3. **Fix GAP-01 (Wire `practice-select` and `segment-select`):**
   * Touch: `learn-controller.js` -> `handleEvent`
   * Tests to run: `npm test tests/integration/learn-routes.test.js tests/integration/df-listening-player.test.js tests/integration/df-error-insights.test.js`

---

## 4. Tests Likely Affected & Validation Targets

* `tests/integration/learn-routes.test.js` (29 tests)
* `tests/integration/df-listening-player.test.js` (16 tests)
* `tests/integration/df-error-insights.test.js` (10 tests)
* `tests/integration/composition-root.test.js` (23 tests)
* `tests/integration/backup-restore.test.js` (9 tests)
* `tests/integration/runtime-module-smoke.test.js` (2 tests)

---

## 5. What NOT to Re-investigate (Already Fully Proven & Stable)

* **Features A–I Canonical Services & Schema:**
  * All 9 services (`content`, `grammar`, `sentences`, `exercises`, `curriculum`, `errors`, `listening`, `pronunciation`, `reminders`) and 34 SQLite tables in `schema.js` (Version 10) are completely tested and stable.
* **SRS Engine & Arabic Non-Scoring Rule:**
  * `srs/scheduler.js`, `exercises/answer-evaluator.js`, and `evaluateArabicAdvisory` are fully validated. Arabic does not score and recognition is self-assessed.
* **Intake Pipelines:**
  * Nicos Weg intake batch and Netzwerk neu A2 12-chapter structural index are verified and complete. Do not alter rights-safe manifests or audio index files.
* **Simulator SQLite Parity:**
  * The simulator gate passed on commit `16807f9`; do not rewrite the SQLite adapter or Capacitor executor.

---

## 6. Genuine Blockers

* **None for code completion.**
* Only one external dependency exists for final store switching: **Physical Device Verification (Gate 5)** on real iOS/iPadOS hardware with an active Apple Developer account.
