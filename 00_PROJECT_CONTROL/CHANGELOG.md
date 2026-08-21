# Changelog (CHANGELOG.md)

All notable changes to the **DeutschFlow** project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
*   Completed all work that does not depend on the native SQLite switch (option (c); no learner data modified, SRS untouched):
    *   Finished the study screen migration with the sentence-order builder; migrated settings rows and the statistics charts. 15 Lit components in total.
    *   Indexed cards by word instead of rescanning per word: 14.9ms to 1.8ms on the real 2820-word deck with identical results. Not cached across renders, since state.cards is mutated in place.
    *   Accessibility: role=switch settings toggles with names, aria-pressed filter chips, a polite live result count, a real progressbar for skill accuracy, a labelled activity chart with a per-day text alternative, proper search semantics, and every touch target at the 44pt minimum.

### Fixed
*   Statistics tiles rendered NaN for first-attempt accuracy and average answer time.
*   Session-summary and audit-row number formatting differed; consolidating them naively would have changed the session summary and dropped the "+" from the XP tile.
*   Field focus and caret were lost on every re-render, which dismissed the on-screen keyboard while typing in vocabulary search.
*   Dialogs did not move, trap, or restore focus, making them unusable with a keyboard including an iPad external keyboard.
*   The PWA did not work offline: the service worker never populated its cache, so the whole module graph missed on every offline request.
*   Completed the Study/SRS UI migration and the main-screen migration (no learner data modified, SRS algorithm untouched):
    *   Migrated all five interactive study controls one at a time — answer input, hint, reveal, rating controls, and the session-end summary — each verified against the study interaction suite and in the browser.
    *   Migrated the remaining study presentation: study progress, teaching panel, question prompt, answer feedback, and multiple-choice answers; plus the vocabulary row on the words page.
    *   Established the light-DOM rule for components containing dispatched controls, since the app uses one delegated document click listener and locates the answer field by id and activeElement.
    *   Fixed two pre-existing display bugs separately from the refactors: NaN statistics tiles, and a session-summary vs audit-row number-formatting difference.
    *   iPad/iPhone validation: all controls at the 44pt HIG minimum, dvh-based full-height layouts, keyboard-clear answer field, safe-area insets on every edge, and a two-column iPad vocabulary workspace.
    *   Expanded the passing regression suite from 155 to 216 tests.
*   Consolidated the UI onto shared Lit components and took the first study-screen slice (no learner data modified):
    *   Extracted `<df-stat-tile>` as a shared presentation primitive; `<df-review-summary>` composes it and `statCard()` emits it, migrating the statistics page and import preview in one change.
    *   Deleted `dashboardStats()`, which duplicated the review-summary application service; the statistics page now uses the same service as the dashboard.
    *   Fixed a pre-existing bug where statistics tiles showed "ليس رقمًا" (NaN) for first-attempt accuracy and average answer time, because pre-formatted strings were coerced with Number().
    *   Added 10 study/SRS interaction tests that drive the real application through the DOM (introduce, answer, rate) and assert card creation, deferred commit, scheduling outcomes, attempt-log fields, session coherence, and that wrong answers never delete cards.
    *   Migrated the study progress strip to `<df-study-progress>`, deliberately the read-only part; all SRS-mutating controls remain vanilla.
    *   Migrated the study teaching panel to `<df-word-panel>` (German form, pronunciation, meaning, descriptive pills), keeping the intro action buttons vanilla; German text is bidi-isolated and marked `lang="de"` for the RTL page.
    *   Gave the full-screen study route its own safe-area padding, which the shell insets did not reach.
    *   Expanded the passing regression suite from 124 to 155 tests.
*   Passed Gate 4 (Lit proof of architecture) with a real component and began the iPad-first UI foundation (no learner data modified):
    *   Added Lit 3.3.3, vendored as a single ESM bundle (`npm run build:vendor`) so the app stays a no-bundler static site that Capacitor serves directly.
    *   Added `<df-review-summary>`, which replaced the dashboard's hand-built stat grid with a real read-only view of learner state (due, new, weak, mastered, vocabulary and learning totals). Every figure comes from the existing SRS `wordStatus` engine; nothing is invented.
    *   Added the `review-summary-service` application service, which derives the summary through repositories and the domain engine and is strictly read-only.
    *   Boundaries enforced by test: the component imports Lit and nothing else, renders no interactive controls, and works on a frozen summary, so it cannot reach storage or mutate learner/SRS state.
    *   Shadow-DOM styles inherit the app's existing CSS custom properties, so the global stylesheet, theming, and RTL keep working; `app.js` changed by two imports and one hydrate call in the existing `afterRender` hook.
    *   Added the iPad-first app shell layer: safe-area insets on all edges, and a vertical navigation side rail from tablet landscape upward while phones and tablet portrait keep the existing bottom bar.
    *   Verified in a real browser at iPad landscape, iPad portrait, and iPhone sizes, with the existing UI and routing intact and IndexedDB unchanged.
    *   Expanded the passing regression suite from 98 to 124 tests.
*   Implemented the first-launch migration controller and persistence bootstrap (gated OFF; no learner data modified):
    *   `src/migration/first-launch-controller.js` enforces the approved sequence BACKUP -> READ OLD -> VALIDATE -> TRANSFORM -> WRITE SQLITE -> VERIFY -> SWITCH, and only that sequence.
    *   Refuses to start without a durable backup sink. The IndexedDB source is read-only for the whole run and remains the recovery source; the target must be empty before writing so a repeated run cannot double-import.
    *   Any failure at any stage aborts without switching and the app remains on IndexedDB. The switch flag is written only after verification passes; a failed verify or failed switch clears only the new database.
    *   Verification compares the read-back field-for-field against the transformed dataset, checks referential integrity, requires identical SRS state, and requires every source word to be accounted for.
    *   `src/platform/bootstrap-persistence.js` composes platform detection, backend selection, and migration so the automatic IndexedDB fallback is guaranteed by the wiring; there is no path that leaves the learner without a working store.
    *   Verified by an end-to-end rehearsal at real learner-data scale (2811 words / 337 cards / 2528 attempts): full sequence completed with 0 lost cards, 0 SRS mismatches, integrity OK, and the real export file only ever read.
    *   Expanded the passing regression suite from 78 to 98 tests.
*   Established the Capacitor 8 mobile foundation and native SQLite path (DF-014; no learner data modified):
    *   Verified the target against current official documentation before implementing: Capacitor 8 requires Xcode 26.0+, iOS deployment target 15.0, Android Studio Otter 2025.2.1+, minSdk 24 / compileSdk 36 / targetSdk 36, and NodeJS 22+; `@capacitor-community/sqlite` 8.1.1 declares peer `@capacitor/core >=8.0.0`.
    *   Installed Capacitor 8.5.0 (`core`, `cli`, `ios`, `android`) and `@capacitor-community/sqlite` 8.1.1, and added `capacitor.config.json` with `webDir` pointing at the existing PWA and `iosDatabaseLocation` = `Library/CapacitorDatabase`, keeping learner data out of WebView storage subject to OS purge.
    *   Added `src/platform/sqlite/capacitor-executor.js`, the native executor satisfying the same contract as the Node test executor, so the platform-neutral adapter runs unchanged on device. It passes `transaction=false` on every `execute`/`run` so the adapter's explicit BEGIN/COMMIT is the only transaction, reuses registered connections, enables `PRAGMA foreign_keys` per connection, rolls back only while a transaction is active, constrains PRAGMA input, and imports the plugin lazily so Node tests and the web build never load native code.
    *   Added a plugin test double over `node:sqlite` and 10 contract tests covering connection parameters, transaction flags, parameter binding, commit/rollback, PRAGMA safety, and full schema/migration/SRS parity on the native path.
    *   Encryption remains OFF pending the SQLCipher export-compliance review (DF-010 condition 6); `appId` is a placeholder pending confirmation; native platform folders are not added (they require macOS/Xcode 26 and the Android SDK).
    *   Expanded the passing regression suite from 61 to 71 tests.
*   Completed the backup/restore safety gate and the real-data migration dry-run (no learner data modified):
    *   Added explicit-call backup, structure/version validation, restore, and learner-state parity comparison (`src/data/backup.js`) over the repository abstraction, reusing the existing export format. Restores target whichever repositories the caller supplies, so verification restores into an isolated database. No launch-time hook is installed, so running the app produces no automatic backup side effect.
    *   Added a read-only migration dry-run (`src/migration/dry-run.js`) and CLI runner (`tools/migration-dry-run.mjs`): READ -> VALIDATE -> TRANSFORM -> VALIDATE CANONICAL -> REPORT, with an optional write/read-back check against a throwaway in-memory SQLite database. Reports contain counts, field names, and identities only, never learner study content.
    *   Closed data-loss gaps the dry-run exposed in real learner state: word `tags`/`qualityIssues`/`qualityNote` and word-scoped `favorite`/`userFlagged`/`qualityStatus` now live on `vocabulary_items`; all non-typed settings are preserved in `settings.extras`; `review_events` carries the full attempt record; profile `lastSessionAt`/`sessions` preserved.
    *   Added `migration_quarantine` so unresolved records (an SRS card whose word was deleted, an event that can no longer be linked) are quarantined, reported, AND preserved verbatim instead of dropped.
    *   Dry-run against the real 2026-08-20 export (2811 words / 337 cards / 2528 attempts): 0 lost cards, 0 SRS mismatches, 0 unmapped fields, clean integrity, successful SQLite round-trip, 2 records preserved in quarantine, source file byte-identical afterwards.
    *   Expanded the passing regression suite from 45 to 61 tests.
*   Implemented the Phase 4 migration-mapping and SQLite-parity milestone (isolated; real learner storage not switched):
    *   Added a pure current->canonical migration transform (`src/migration/canonical-migration.js`) with deterministic, platform-neutral identifiers (`src/migration/uuid.js`). SRS state is copied verbatim (due dates, interval, ease, reps, lapses, streak, mastery, state, and correct/wrong/stability/difficulty/lastResult/suspended); legacy wording is preserved unchanged and marked with legacy provenance.
    *   Malformed/incomplete legacy records are quarantined with reasons and a preserved copy; out-of-bounds ease is reported as a warning rather than silently clamped; no missing educational values are invented.
    *   Added the Version 1 canonical SQLite schema (`src/platform/sqlite/schema.js`) and a platform-neutral persistence adapter (`src/platform/sqlite/adapter.js`) driven by an injected async SQL executor, reached only through a canonical repository facade (`src/data/canonical-repositories.js`). No SQLite driver is bound in the adapter; the SRS engine, evaluator, and UI never issue SQL directly.
    *   `importCanonical` writes the whole dataset all-or-nothing; `readCanonical` round-trips it; `verifyIntegrity` checks orphan cards/events, ease bounds, and row counts.
    *   Added isolated fixtures (`tests/fixtures/migration_snapshot.json`, clean + malformed) and a `node:sqlite` test executor exercising in-memory and temporary-file databases.
    *   Added end-to-end Stop Gate 3 parity tests: READ OLD (IndexedDB) -> TRANSFORM -> WRITE NEW (SQLite) -> VERIFY, proving field-for-field canonical round-trip, identical SRS state, matching counts/integrity, and that the source IndexedDB remains intact and recoverable.
    *   Recorded Phase 4 implementation refinements in `CURRENT_TO_TARGET_DATA_MAPPING.md`.
    *   Expanded the passing regression suite from 24 to 45 tests.
*   Completed the Phase 3 persistence abstraction milestone:
    *   Extracted the existing `deutschflow_v2` implementation into `src/platform/indexeddb/adapter.js` without changing database name, version, stores, indexes, migration behavior, or persistence format.
    *   Added in-memory IndexedDB integration tests covering schema creation, CRUD, indexed attempt queries, restore fidelity, exact SRS preservation, and unchanged legacy wording.
    *   Recorded the approved separation between learner-state preservation and educational-content authority/versioning.
    *   Expanded the passing regression suite to 24 tests.
*   Completed the protected Phase 2 modularization milestone:
    *   Extracted shared utilities and text normalization into `src/core/`.
    *   Extracted deterministic answer evaluation into `src/exercises/answer-evaluator.js` without scoring changes.
    *   Extracted existing SRS scheduling, mastery, status, and rating behavior into `src/srs/scheduler.js` without algorithm changes.
    *   Converted the runtime loader to native ES modules and added a non-persistent module-wiring smoke test.
*   Started Phase 3 repository abstraction:
    *   Added injected vocabulary, card, attempt, metadata, and lifecycle repositories.
    *   Routed application-service persistence calls through repositories while retaining the existing IndexedDB database and schema unchanged.
    *   Expanded the passing regression suite to 21 tests.
*   Established the Phase 1 regression safety net on branch `mobile-foundation`:
    *   Added Vitest test execution via `npm test`.
    *   Added `tests/fixtures/golden_vocab_dataset.json` with representative vocabulary and new/review/mastered cards.
    *   Added legacy characterization coverage for normalization, deterministic German evaluation, Levenshtein behavior, and SRS state/math.
    *   Verified 12/12 assertions pass; runtime `src/app.js` was not modified.
*   Complete technical architecture and physical database schema design documentation:
    *   `05_TECHNICAL/ARCHITECTURE/TARGET_ARCHITECTURE.md`
    *   `05_TECHNICAL/ARCHITECTURE/MODULE_BOUNDARIES.md`
    *   `05_TECHNICAL/ARCHITECTURE/PLATFORM_ARCHITECTURE.md`
    *   `05_TECHNICAL/ARCHITECTURE/TECHNOLOGY_DECISION_MATRIX.md`
    *   `05_TECHNICAL/DATABASE/TARGET_CANONICAL_DATA_MODEL.md`
    *   `05_TECHNICAL/DATABASE/TARGET_DATABASE_SCHEMA.md`
    *   `05_TECHNICAL/DATABASE/CURRENT_TO_TARGET_DATA_MAPPING.md`
    *   `05_TECHNICAL/DATABASE/DATA_MIGRATION_STRATEGY.md`
    *   `05_TECHNICAL/DATABASE/SCHEMA_VERSIONING_STRATEGY.md`
    *   `05_TECHNICAL/TESTING/TARGET_TESTING_ARCHITECTURE.md`
    *   `06_AUDIT/AUDIT_REPORTS/ARCHITECTURE_RISK_REGISTER.md`
    *   `05_TECHNICAL/ARCHITECTURE/ARCHITECTURE_REVIEW_SUMMARY.md`
    *   `05_TECHNICAL/ARCHITECTURE/OPEN_TECHNICAL_DECISIONS.md`
*   Complete Mobile-First staged implementation plan documentation:
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_FIRST_IMPLEMENTATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/IMPLEMENTATION_PHASE_GATES.md`
    *   `05_TECHNICAL/DOCUMENTATION/REGRESSION_PROTECTION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/DATA_PRESERVATION_AND_ROLLBACK_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/LIT_INCREMENTAL_MIGRATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_PLATFORM_ROLLOUT_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/FIRST_IMPLEMENTATION_TASK.md`

### Changed
*   Recorded user approval with persistence condition for Product Decision 1 (Multi-Platform Packaging Architecture).
*   Recorded user approval with staged implementation condition for Product Decision 2 (Cross-Device Synchronization Strategy).
*   Recorded user approval with optional cloud account and default local-only condition for Product Decision 3 (Cloud Account Requirement vs Local-Only Mode).
*   Recorded user approval with deterministic scoring as authoritative and AI as advisory condition for Product Decision 4 (AI-Assisted Answer Evaluation Policy).
*   Recorded user approval with self-evaluation recording/playback condition for Product Decision 5 (Speaking / Pronunciation Feature Scope).
*   Recorded user approval with native local review notifications condition for Product Decision 6 (Notification and Review Reminder Policy).
*   Recorded user approval with conditions for Technical Decision 1 (Mobile SQLite Plugin Selection).
*   Recorded Mobile-First delivery priority (iPad/iPhone and Android prioritization, deferring Technical Decision 2 to the Desktop delivery phase).
*   Recorded user approval with staged migration for Technical Decision 3 (Lit Web Component Mobile-First UI Architecture).

## [0.3.0] - 2026-08-20

### Added
*   Complete technical and educational audit documentation for the current DeutschFlow application:
    *   `05_TECHNICAL/ARCHITECTURE/CURRENT_ARCHITECTURE.md`
    *   `05_TECHNICAL/DATABASE/CURRENT_DATA_MODEL.md`
    *   `05_TECHNICAL/TESTING/CURRENT_TESTING_STATUS.md`
    *   `06_AUDIT/APPLICATION_AUDIT/APPLICATION_FEATURE_INVENTORY.md`
    *   `06_AUDIT/APPLICATION_AUDIT/CURRENT_APPLICATION_AUDIT.md`
    *   `06_AUDIT/APPLICATION_AUDIT/CONFIRMED_DEFECTS.md`
    *   `06_AUDIT/APPLICATION_AUDIT/POTENTIAL_ISSUES.md`
    *   `06_AUDIT/AUDIT_REPORTS/CURRENT_STATE_EXECUTIVE_SUMMARY.md`
    *   `06_AUDIT/LEARNING_GAP_ANALYSIS/CURRENT_LEARNING_CAPABILITY_MATRIX.md`
    *   `04_PRODUCT_DESIGN/REQUIREMENTS/TARGET_PRODUCT_REQUIREMENTS.md`
    *   `04_PRODUCT_DESIGN/LEARNING_MODEL/TARGET_LEARNING_MODEL.md`
    *   `04_PRODUCT_DESIGN/FEATURE_MATRIX/CURRENT_TO_TARGET_MATRIX.md`
    *   `04_PRODUCT_DESIGN/REQUIREMENTS/OPEN_PRODUCT_DECISIONS.md`
*   Second-pass intake of newly discovered A2 course PDFs (Netzwerk Neu A2 Workbook and alternate Kursbuch PDF).

## [0.2.0] - 2026-08-20

### Added
*   Intake of German-language learning resources from the main knowledge base.
    *   `03_COURSE_CONTENT/NETZWERK_A1/Netzwerk Neu A1 - Kursbuch.pdf`
    *   `03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 KB.pdf`
    *   `03_COURSE_CONTENT/REFERENCE/Nicos-Weg-A2-E2-L1-Lehrerhandreichung-und-Uebungen.pdf`
    *   `03_COURSE_CONTENT/VOCABULARY/Nicos-Weg-A2-E2-L1-Manuskript-und-Wortschatz-Arabisch.pdf`
    *   189 unique A2 Kursbuch and Übungsbuch audio files consolidated under `03_COURSE_CONTENT/NETZWERK_NEU_A2/AUDIO/`.
*   [GERMAN_RESOURCE_INVENTORY.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/GERMAN_RESOURCE_INVENTORY.md) tracking all analyzed files.
*   Imported active DeutschFlow application baseline (RC4 Final Technical Build) under `01_APPLICATION/CURRENT_APP/`.
*   Imported legacy application versions (Codex refactored build and v2) under `01_APPLICATION/LEGACY_APP/`.
*   Consolidated DeutschFlow IndexedDB data backups (JSON and CSV exports) under `02_DATA/LEGACY_DATA/`.

## [0.1.0] - 2026-08-20

### Added
*   Initial project folder structure for project control, application, data, course content, product design, technical docs, audit records, releases, and archives.
*   Root configuration and entry point files:
    *   [README.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/README.md)
    *   [AGENTS.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/AGENTS.md)
    *   [CLAUDE.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/CLAUDE.md)
*   Canonical project control files under `00_PROJECT_CONTROL/`:
    *   [PROJECT_MANIFEST.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/PROJECT_MANIFEST.md)
    *   [PROJECT_CONTEXT.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/PROJECT_CONTEXT.md)
    *   [CURRENT_WORK_STATUS.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/CURRENT_WORK_STATUS.md)
    *   [DEVELOPMENT_ROADMAP.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/DEVELOPMENT_ROADMAP.md)
    *   [DECISION_LOG.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/DECISION_LOG.md)
    *   [AI_WORKING_RULES.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/AI_WORKING_RULES.md)
    *   [CHANGELOG.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/CHANGELOG.md)
