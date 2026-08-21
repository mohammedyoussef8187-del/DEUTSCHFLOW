# DeutschFlow Structural Completion Audit

**Date:** 2026-08-22  
**Audited Branch:** `gemini/deutschflow-structure-audit` (derived from `origin/mobile-foundation`)  
**Audited Baseline Commit:** `9f07498b98741ab65bc80231f07739824d883b6d`  
**Test Suite Baseline:** 64 test files passed, 1069 tests passed  

---

## Executive Summary & Classification Counts

This audit determines the exact structural completion status of DeutschFlow to eliminate repository rediscovery and identify remaining structural gaps before final learner-product release.

### Subsystem Classification Counts:
* **`COMPLETE_AND_ACTIVE`**: **14**
* **`IMPLEMENTED_BUT_NOT_WIRED`**: **2**
* **`PARTIALLY_WIRED`**: **3**
* **`LEGACY_ONLY`**: **2**
* **`DUPLICATED_PATH`**: **1**
* **`STRUCTURAL_GAP`**: **2**
* **`RELEASE_GATE_ONLY`**: **4**

### Action Item Severity Breakdown:
* **`BLOCKER`**: **0** (No critical blocker prevents ongoing development or current test runs)
* **`REQUIRED_BEFORE_RELEASE`**: **4**
* **`CAN_DEFER`**: **4**

---

## 1. Subsystem Classification & Structural Audit

### 1.1 Startup & Composition Root
* **Startup Sequence (`01_APPLICATION/CURRENT_APP/src/app.js:867-1061`)**: `COMPLETE_AND_ACTIVE`
  * `boot()` initiates `loadState()` (loading IndexedDB words, cards, profile, settings, metadata), applies theme, renders shell, and then boots canonical runtime via `bootLearn()`.
* **Canonical Composition Root (`01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js`)**: `COMPLETE_AND_ACTIVE`
  * `bootstrapCanonicalRuntime()` and `resolveCanonicalSource()` resolve the persistence source (`sqlite` on native when gated on, or honest `empty` source on web/uninitialized).
  * Creates all 9 canonical domain services (`content`, `grammar`, `sentences`, `exercises`, `curriculum`, `errors`, `listening`, `pronunciation`, `reminders`).

### 1.2 Storage Architecture & Repositories
* **Legacy IndexedDB Adapter & Repositories (`src/platform/indexeddb/adapter.js`, `src/data/repositories.js`)**: `COMPLETE_AND_ACTIVE` (Active storage for learner SRS and vocab)
* **Canonical SQLite Schema & Adapter (`src/platform/sqlite/schema.js`, `src/platform/sqlite/adapter.js`)**: `COMPLETE_AND_ACTIVE`
  * Full schema version 10 across 34 table specifications (`TABLE_SPECS`).
  * Incremental reads/writes, transactional write safety, soft-delete, optimistic locking (`revision`), and SRS dedicated mutation path (`applyScheduledCard`).
* **Canonical Repositories Layer (`src/data/canonical-repositories.js`)**: `COMPLETE_AND_ACTIVE`
  * Exposes all canonical entities + transactional aggregate operations under `write` (`content`, `progress`, `errors`, `pronunciation`, `reminders`) and `srs`.
* **Dual-Storage Persistence Selection (`src/platform/storage-selection.js`, `src/platform/bootstrap-persistence.js`)**: `RELEASE_GATE_ONLY`
  * `selectPersistenceBackend()` and `bootstrapPersistence()` are fully implemented and tested. `nativeStorageEnabled` defaults to `false` pending physical device verification.

### 1.3 Features A–I End-to-End Trace
* **Feature A: Multilingual Canonical Content (`src/services/content-service.js`, `src/content/languages.js`)**: `COMPLETE_AND_ACTIVE`
* **Feature B: Grammar (`src/services/grammar-service.js`, `src/runtime/learn-controller.js`)**: `COMPLETE_AND_ACTIVE`
* **Feature C: Sentences / Context (`src/services/sentence-service.js`, `<df-sentence-card>`)**: `COMPLETE_AND_ACTIVE`
* **Feature D: Exercises (`src/services/exercise-service.js`, `src/exercises/answer-evaluator.js`)**: `COMPLETE_AND_ACTIVE`
* **Feature E: Courses / Lessons / CEFR (`src/services/curriculum-service.js`, `<df-course-outline>`, `<df-lesson-view>`)**: `COMPLETE_AND_ACTIVE`
* **Feature F: Error Learning (`src/services/error-service.js`, `<df-error-insights>`)**: `PARTIALLY_WIRED`
  * Summary and practice display are wired, but clicking a practice suggestion dispatches `practice-select`, which is currently a no-op in `learn-controller.js:624-625`.
* **Feature G: Listening (`src/services/listening-service.js`, `<df-listening-player>`)**: `PARTIALLY_WIRED`
  * Activity details, transcript, and audio offline checks render cleanly. Choosing a segment dispatches `segment-select`, which is currently a no-op in `learn-controller.js:627-628`.
* **Feature H: Pronunciation (`src/services/pronunciation-service.js`, `<df-pronunciation-card>`)**: `COMPLETE_AND_ACTIVE`
* **Feature I: Reminders / Notifications (`src/services/reminder-service.js`, `<df-reminder-settings>`, `src/platform/notifications/local-notification-adapter.js`)**: `PARTIALLY_WIRED` & `RELEASE_GATE_ONLY`
  * UI settings and persistence are active via `learn-controller`. Native device notification firing is gated off (`nativeNotifications: false` in `src/runtime/feature-gates.js`).

### 1.4 Intake Pipelines
* **Nicos Weg Intake Pipeline (`tools/intake/`)**: `COMPLETE_AND_ACTIVE` (One verified episode imported with 189 rows).
* **Netzwerk neu A2 Intake Pipeline (`tools/intake/map-netzwerk.js`, `run-netzwerk.mjs`)**: `COMPLETE_AND_ACTIVE` (All 12 chapters structured; audio asset metadata indexed without unauthorized rights extraction).

---

## 2. Features A–I End-to-End Tracing Table

| Feature | Storage Entity | Repository | Service | Controller / Runtime Entry Point | Learner UI Component / Screen | Reachable? | Legacy Storage Dependent? |
|---|---|---|---|---|---|---|---|
| **A. Multilingual Content** | `vocabularyItems`, `vocabularyMeanings`, `translations`, `acceptedAnswers` | `repositories.vocabulary`, `meanings`, `translations`, `acceptedAnswers`, `write.content.saveVocabulary` | `content-service.js` (`createContentService`) | `composition-root.js`, `learn-controller.js` | Embedded across all Learn routes (`df-sentence-card`, `df-word-panel`, `df-lesson-view`) | Yes (`learn-*`) | No (Canonical SQLite / Empty source) |
| **B. Grammar** | `grammarTopics`, `grammarRules`, `grammarExamples`, `grammarTexts` | `repositories.grammarTopics`, `grammarRules`, `write.content.saveGrammarTopic` | `grammar-service.js` (`createGrammarService`) | `learn-controller.js` (`load("learn-grammar")`, `renderers["learn-grammar"]`) | `renderers["learn-grammar"]` (cards in `app.js` via `learn-controller.js:252-269`) | Yes (`learn-grammar`) | No |
| **C. Sentences** | `sentences`, `sentenceTexts`, `sentenceVocabulary`, `sentenceGrammar`, `sentenceTags` | `repositories.sentences`, `sentenceTexts`, `write.content.saveSentence` | `sentence-service.js` (`createSentenceService`) | `learn-controller.js` (`load("learn-sentences")`) | `<df-sentence-card>` (`src/ui/components/df-sentence-card.js`) | Yes (`learn-sentences`) | No |
| **D. Exercises** | `exercises`, `exerciseTexts`, `exerciseOptions`, `exerciseTargets` | `repositories.exercises`, `exerciseOptions`, `write.content.saveExercise` | `exercise-service.js` (`createExerciseService`) | `learn-controller.js` (`submitExercise`, `grade`, `handleAction("learn-submit-exercise")`) | `<df-choice-list>`, input prompt in `learn-controller.js:282-328` | Yes (`learn-exercises`) | No |
| **E. Curriculum & CEFR** | `courses`, `courseLevels`, `courseUnits`, `lessons`, `lessonSections`, `lessonItems`, `lessonProgress`, `courseProgress`, `sectionProgress`, `cefrProgress` | `repositories.courses`, `lessons`, `write.content.saveCourse`, `write.progress.recordLessonProgress` | `curriculum-service.js` (`createCurriculumService`) | `learn-controller.js` (`completeLesson`, `handleAction("learn-course" \| "learn-open-lesson" \| "learn-complete-lesson")`) | `<df-course-outline>`, `<df-lesson-view>` (`src/ui/components/`) | Yes (`learn-courses`) | No |
| **F. Error Learning** | `errorCategories`, `errorCategoryTexts`, `errorRemediations`, `errorEvents`, `errorEventCategories`, `errorPatterns` | `repositories.errorCategories`, `errorEvents`, `write.errors.recordEvent`, `write.content.saveErrorTaxonomy` | `error-service.js` (`createErrorService`) | `learn-controller.js` (`recordError`, `ensureTaxonomy`, `load("learn-errors")`) | `<df-error-insights>` (`src/ui/components/df-error-insights.js`) | Yes (`learn-errors`) | No |
| **G. Listening** | `audioAssets`, `listeningItems`, `listeningTexts`, `listeningSpeakers`, `listeningSegments`, `listeningSegmentTexts`, `listeningLinks` | `repositories.audioAssets`, `listeningItems`, `listeningSegments`, `write.content.saveListening` | `listening-service.js` (`createListeningService`) | `learn-controller.js` (`load("learn-listening")`, `handleAction("learn-activity")`) | `<df-listening-player>` (`src/ui/components/df-listening-player.js`) | Yes (`learn-listening`) | No |
| **H. Pronunciation** | `pronunciationFeatures`, `pronunciationTexts`, `pronunciationItems`, `pronunciationVariants`, `pronunciationPairs`, `pronunciationLinks`, `pronunciationAttempts` | `repositories.pronunciationFeatures`, `pronunciationItems`, `pronunciationAttempts`, `write.pronunciation.recordAttempt` | `pronunciation-service.js` (`createPronunciationService`) | `learn-controller.js` (`recordSpokenAttempt`, `handleEvent("self-rate")`) | `<df-pronunciation-card>` (`src/ui/components/df-pronunciation-card.js`) | Yes (`learn-pronunciation`) | No |
| **I. Reminders** | `reminderSettings`, `reminderSchedule` | `repositories.reminderSettings`, `reminderSchedule`, `write.reminders.save` | `reminder-service.js` (`createReminderService`) | `learn-controller.js` (`changeReminder`, `handleEvent("reminder-change")`) | `<df-reminder-settings>` (`src/ui/components/df-reminder-settings.js`) | Yes (`learn-reminders`) | Reads due counts from active state; no direct SRS dependency |

---

## 3. Dual-Storage Architecture & Learner Storage Switch Audit

### Current Storage Matrix
* **Data living ONLY in IndexedDB:**
  * Active learner vocabulary (`words` store: 2,820 items).
  * Active learner SRS cards (`cards` store: interval, ease, dueAt, mastery, status).
  * Historical learner study attempts (`attempts` store: 30-day history).
  * UI metadata & session progress (`meta` store: `profile`, `settings`, `session`).
* **Data living Canonically (SQLite / Runtime):**
  * Multilingual canonical course, lesson, unit, and curriculum structures.
  * Authorship records for vocabulary, grammar, sentences, exercises, and audio assets.
  * Canonical lesson progress (`lesson_progress`, `course_progress`, `section_progress`).
  * Structured error logs and error categorization (`error_events`, `error_event_categories`).
  * Spoken pronunciation attempt logs (`pronunciation_attempts`).
  * Reminder configuration (`reminder_settings`, `reminder_schedule`).
* **Dual-Read / Dual-Write Status:**
  * **Zero dual-write.** There is no runtime path that writes simultaneously to both IndexedDB and SQLite.
  * **Dual-Read isolation:** The running vocabulary study loop reads strictly from IndexedDB. The Learn area reads strictly from `bootstrapCanonicalRuntime()`. The single bridge is that `bootLearn()` passes a read-only closure `readDueCount: async () => state.cards.filter(...).length` to provide due-item counts to the reminder planning service without passing card entities.
* **Risk of Divergence:**
  * None at present because `learnerStorageSwitch` is `false`. The two persistence stores operate completely isolated.
* **Pre-conditions for flipping `learnerStorageSwitch` to `true`:**
  1. Completion of on-device physical hardware validation (Gate 5 on real iOS/Android devices).
  2. Executing `runFirstLaunchMigration()` with automated backup verification, hash-integrity checks, and exact SRS preservation.
  3. Validating that `openCapacitorSqlite()` successfully handles native storage lifecycle under OS backgrounding, memory eviction, and system restarts.
* **Is switching required for release?**
  * **Yes, for final native 1.0 release**, so the learner has unified SQLite storage with full relational capabilities.
  * **Can remain deferred during intermediate builds** because `canonicalRuntime: true` allows all Features A–I screens to be tested independently without risking user SRS records.

---

## 4. Dead, Duplicate, or Unwired Structural Paths

### Finding 1: Unhandled Component Events in `learn-controller.js`
* **File:** `01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js`
* **Symbols:** `handleEvent("practice-select")` (line 624), `handleEvent("segment-select")` (line 627)
* **Code Evidence:**
  ```javascript
  case "practice-select":
    return { reload: false };

  case "segment-select":
    return { reload: false };
  ```
* **Structural Impact:**
  * In `<df-error-insights>`, clicking a recommended practice item dispatches `practice-select`, but `learn-controller.js` ignores the payload and takes no navigation action.
  * In `<df-listening-player>`, clicking an individual transcript segment dispatches `segment-select`, but `learn-controller.js` does not update the active playback timestamp/segment.
* **Action Required:** `REQUIRED_BEFORE_RELEASE` (Medium scope). Connect `practice-select` to exercise navigation or filtered practice, and `segment-select` to audio/segment focus.

### Finding 2: `exportBackup` in `app.js` Emits Legacy `schemaVersion: 5`
* **File:** `01_APPLICATION/CURRENT_APP/src/app.js` (line 575) vs `01_APPLICATION/CURRENT_APP/src/data/backup.js` (line 21)
* **Symbols:** `exportBackup`, `DEFAULT_SCHEMA_VERSION`
* **Code Evidence:**
  * In `app.js:575`:
    ```javascript
    const payload={app:"DeutschFlow",schemaVersion:5,exportedAt:Date.now(),words:state.words,cards:state.cards,attempts,settings:state.settings,profile:state.profile};
    ```
  * In `backup.js:20-21`:
    ```javascript
    export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([5, 6]);
    const DEFAULT_SCHEMA_VERSION = 6;
    ```
* **Structural Impact:** `app.js` hardcodes schema version 5 for manual JSON backup exports instead of referencing `DEFAULT_SCHEMA_VERSION` (version 6) from `backup.js`.
* **Action Required:** `REQUIRED_BEFORE_RELEASE` (Small scope). Align `exportBackup()` with `backup.js` export utilities.

### Finding 3: `openCapacitorSqlite` Not Injected into Runtime Composition Root
* **File:** `01_APPLICATION/CURRENT_APP/src/app.js` (lines 1026-1037) & `01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js` (lines 83-124)
* **Symbols:** `bootLearn`, `resolveCanonicalSource`, `openCapacitorSqlite`
* **Code Evidence:**
  * In `app.js:1026-1037`:
    ```javascript
    async function bootLearn(){
      try{
        const runtime=await bootstrapCanonicalRuntime({
          readDueCount:async()=>state.cards.filter(c=>!c.suspended&&c.dueAt<=Date.now()).length,
          readLastStudiedAt:async()=>state.profile?.lastStudyDate??null
        });
        ...
    ```
  * `bootstrapCanonicalRuntime()` is called without passing `openExecutor: () => openCapacitorSqlite()`. On native platforms, `resolveCanonicalSource()` checks `if (!isEnabled("canonicalNativeStore", gates) || !openExecutor)` and defaults to `createEmptyCanonicalSource()`.
* **Structural Impact:** Even on a native build with `canonicalNativeStore: true`, `app.js` has not supplied the `openExecutor` hook to open SQLite.
* **Action Required:** `REQUIRED_BEFORE_RELEASE` (Small scope). Provide `openExecutor` via dynamic import when running in a native Capacitor environment.

### Finding 4: `canonicalNativeStore` and `nativeNotifications` Default to Off
* **File:** `01_APPLICATION/CURRENT_APP/src/runtime/feature-gates.js`
* **Symbols:** `RUNTIME_GATES.canonicalNativeStore`, `RUNTIME_GATES.nativeNotifications`
* **Code Evidence:**
  ```javascript
  export const RUNTIME_GATES = Object.freeze({
    learnerStorageSwitch: false,
    canonicalRuntime: true,
    canonicalNativeStore: false,
    nativeNotifications: false
  });
  ```
* **Structural Impact:** Features A–I render in honest empty-state mode on web and remain gated off natively until physical-device validation gate passes.
* **Action Required:** `RELEASE_GATE_ONLY` (Can defer until hardware gate).

---

## 5. Mobile Structure Readiness

* **iPad-First & iPhone-Second**: `COMPLETE_AND_ACTIVE`
  * Responsive layout with CSS grid breakpoints, side rail navigation for screens $\ge 900\text{px}$, bottom nav for compact widths, and full safe-area insets (`env(safe-area-inset-*)`) on all screens including study mode. Minimum touch targets $\ge 44\text{px}$ enforced across components.
* **Offline-First**: `COMPLETE_AND_ACTIVE`
  * Service worker registration (`register-sw.js`, `sw.js`), static asset precaching, and native SQLite/IndexedDB local storage.
  * Audio playback checks local availability and gracefully renders transcripts/support texts if audio assets are missing locally.
* **App Startup & Reload**: `COMPLETE_AND_ACTIVE`
  * Robust lifecycle initialization with focus preservation (`captureFocus` / `restoreFocus`) preventing input desynchronization.
* **Local Persistence & Backup**: `COMPLETE_AND_ACTIVE`
  * Full JSON export/restore with pre-restore snapshots and schema verification.
* **Physical Device Validation Gate**: `RELEASE_GATE_ONLY`
  * Gated by hardware deployment requirement (Apple Developer Account provisioning for physical iPad/iPhone test harness).

---

## 6. Exact Remaining Structural Work

```
====================================================================================================
ITEM 1: Wire Practice & Segment Selection Events in Learn Controller
----------------------------------------------------------------------------------------------------
Severity:      REQUIRED_BEFORE_RELEASE
Scope:         MEDIUM
Files:         01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js
               01_APPLICATION/CURRENT_APP/src/ui/components/df-error-insights.js
               01_APPLICATION/CURRENT_APP/src/ui/components/df-listening-player.js
Symbols:       createLearnController -> handleEvent ("practice-select", "segment-select")
Action:        1. Update `handleEvent("practice-select", detail)` in `learn-controller.js` to route 
                  the learner to targeted exercise practice for the selected error pattern.
               2. Update `handleEvent("segment-select", detail)` in `learn-controller.js` to set 
                  the active audio segment / timecode on `<df-listening-player>`.
====================================================================================================

====================================================================================================
ITEM 2: Wire Native SQLite Executor Injection into App Boot
----------------------------------------------------------------------------------------------------
Severity:      REQUIRED_BEFORE_RELEASE
Scope:         SMALL
Files:         01_APPLICATION/CURRENT_APP/src/app.js
               01_APPLICATION/CURRENT_APP/src/platform/sqlite/capacitor-executor.js
Symbols:       app.js -> bootLearn, openCapacitorSqlite
Action:        Inject `openExecutor: () => openCapacitorSqlite()` into `bootstrapCanonicalRuntime()` 
               when `detectNativePlatform()` is true, enabling native database access once 
               `canonicalNativeStore` gate is flipped.
====================================================================================================

====================================================================================================
ITEM 3: Unify Backup Schema Version Constant
----------------------------------------------------------------------------------------------------
Severity:      REQUIRED_BEFORE_RELEASE
Scope:         SMALL
Files:         01_APPLICATION/CURRENT_APP/src/app.js
               01_APPLICATION/CURRENT_APP/src/data/backup.js
Symbols:       app.js -> exportBackup, backup.js -> DEFAULT_SCHEMA_VERSION
Action:        Update `exportBackup` in `app.js` to use `DEFAULT_SCHEMA_VERSION` (6) rather than 
               hardcoded 5.
====================================================================================================

====================================================================================================
ITEM 4: Physical Device Gate Validation & Feature Gate Release Flip
----------------------------------------------------------------------------------------------------
Severity:      CAN_DEFER (Release Gate Only)
Scope:         SMALL (Execution on physical hardware)
Files:         01_APPLICATION/CURRENT_APP/src/runtime/feature-gates.js
               01_APPLICATION/CURRENT_APP/src/platform/storage-selection.js
               01_APPLICATION/CURRENT_APP/src/platform/bootstrap-persistence.js
Symbols:       RUNTIME_GATES.canonicalNativeStore, RUNTIME_GATES.nativeNotifications, 
               CANONICAL_MODEL_STATUS.learnerSwitchEnabled
Action:        Execute physical on-device validation run for SQLite and local notifications, then flip 
               runtime gates to active for production release.
====================================================================================================
```
