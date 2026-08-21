# Current Work Status (CURRENT_WORK_STATUS.md)

This is the single canonical handoff file for **DeutschFlow** to track progress across sequential agent invocations.

## Metadata
*   **Last AI/Agent Used:** Claude Code (Opus 4.8) — primary implementation agent
*   **baseline Git commit:** `80599f5bf1aa9ea6dcd52aa42339df2c8bb67e27`
*   **second pass Git commit:** `2ce3631946f6fe962c48488048a7eaf4ac144e68`
*   **audit Git commit:** `103970456900e24f6a8f6c85346248d34812aaa5`
*   **design Git commit:** `afb480b6d069dc756d0318552e31aa892ab014a4`
*   **phase 4 parity Git commit:** `d622413` (test: verify indexeddb to sqlite migration parity)
*   **backup gate Git commit:** `486e47b` (feat: add verified backup and restore safety gate)
*   **real-data dry-run Git commit:** `bb91fd6` (test: add read-only real-data migration dry-run)
*   **capacitor foundation Git commit:** `63b5226` (feat: add capacitor native sqlite executor)
*   **migration controller Git commit:** `0fe22dc` (feat: wire persistence bootstrap with automatic indexeddb fallback)
*   **Gate 4 Lit Git commit:** `da6993e` (feat: add iPad-first app shell layout foundation)
*   **UI consolidation Git commit:** `91f5804` (feat: migrate study progress strip to Lit)
*   **study presentation Git commit:** `c7a58ba` (feat: migrate the study teaching panel to Lit)
*   **UI migration complete Git commit:** `60f2526` (feat: migrate the multiple-choice answers to Lit)
*   **Last Update Timestamp:** 2026-08-21T06:20:00+03:00

## Current Context
*   **Current Phase:** PHASE 4 — MIGRATION MAPPING + SQLITE PARITY VALIDATION
*   **Current Delivery Priority:** MOBILE FIRST — iOS/iPadOS + Android
*   **Phase Status:** PHASE 2 AND PHASE 3 COMPLETE. PHASE 4 COMPLETE (migration mapping, SQLite parity, backup/restore Gate 2, real-data dry-run). PHASE 5 STARTED: Capacitor 8 mobile foundation and native SQLite executor implemented and contract-tested. Real learner storage NOT switched; on-device verification (Gate 5) NOT yet performed.
*   **Implementation Status:** ACTIVE ON `mobile-foundation`
*   **Current Task:** Gate 4 (Lit proof of architecture) is PASSED with a real, read-only dashboard component, and the iPad-first app shell foundation is in place. Native storage remains GATED OFF; on-device verification still requires user-only device actions.

## Gate 4 — Lit Proof of Architecture (PASSED)
*   Lit **3.3.3**, vendored as a single ESM bundle at `01_APPLICATION/CURRENT_APP/vendor/lit.js` (`npm run build:vendor`), so the app remains a no-bundler static site that Capacitor can serve directly.
*   First component `<df-review-summary>` is real and useful: it replaced the dashboard's hand-built stat grid and shows genuine learner state (due = due + overdue, new, weak, mastered, plus vocabulary and learning totals). No invented statistics.
*   New application service `src/services/review-summary-service.js` derives the summary via the SRS `wordStatus` engine, reading through repositories only. Strictly read-only.
*   Boundary enforced and tested: the component imports Lit and nothing else — no IndexedDB, SQLite, Capacitor, repositories, or SRS internals — renders no interactive controls, and works against a frozen summary object, so it cannot mutate learner/SRS state.
*   Coexistence: styles are scoped in shadow DOM and inherit the existing CSS custom properties, so the global stylesheet, theming, and RTL are untouched. `app.js` gained two imports plus one hydrate call in the existing `afterRender` hook.
*   **Browser-verified** against the seeded app: element upgraded, 2820 real words rendered, reactive re-render without reload, existing topbar/nav/routing/training cards intact, and IndexedDB unchanged (2820 words / 0 cards / 0 attempts before and after).

## UI Consolidation and First Study-Screen Slice
*   **`<df-stat-tile>`** extracted as a shared presentation primitive. `<df-review-summary>` composes it, and `statCard()` emits it, so the statistics page and import preview migrated in one change. No `.stat-card` markup remains.
*   **`dashboardStats()` deleted** — it duplicated the review-summary application service. The statistics page now derives counts from the same `summarizeLearnerState()` service as the dashboard.
*   **Scope note:** `<df-review-summary>` was NOT placed on the statistics page. That page shows different metrics (first-attempt accuracy, attempt count, average answer time) and only "mastered" overlaps, so reusing it there would have added unrelated tiles and changed behavior. The genuine duplication was the tile primitive and the counts service; both are now shared.
*   **Bug fixed:** statistics tiles rendered `ليس رقمًا` (NaN) for accuracy and average answer time, because `statCard` coerced pre-formatted strings with `Number()`. Pre-existing, not a regression — the refactor reproduced it byte-identically and it was fixed in a separate commit.
*   **Study/SRS interaction tests added** (10 tests) driving the real app through the DOM: introduce → answer → rate, asserting card creation values, that evaluation does not commit until rated, SRS scheduling outcomes, attempt-log fields, session coherence, and that a wrong answer never deletes cards or pushes ease below 1.3.
*   **`<df-study-progress>`** is the first migrated study-screen slice, and deliberately the read-only part (progress bar, retry badge, correct/wrong/hint tally). It renders no controls and no `data-action`, so answering, revealing, hinting, and rating remain vanilla. Browser-verified.
*   **`<df-word-panel>`** is the second slice: the read-only teaching panel (German form, pronunciation, Arabic meaning, descriptive pills). Intro action buttons remain vanilla outside it. German text is marked `lang="de"` and bidi-isolated so it renders correctly inside the RTL page. Browser-verified with real seeded data; introducing a word still creates exactly one card.
*   **Study route safe areas:** the study screen renders full-screen outside `.layout`, so the shell insets did not reach it. It now has its own inline/top/bottom safe-area padding for notched iPhones and iPad landscape.
*   **Remaining study migration order:** session-end summary next (read-only), then the answer input, reveal, hint, and rating controls LAST, one at a time, re-running the study interaction suite after each.


## Study/SRS UI Migration (COMPLETE) and Main-Screen Migration
*   All five interactive study controls migrated one at a time, each verified against the study interaction suite and in the browser: **answer input**, **hint**, **reveal**, **rating controls**, plus the **session-end summary** consolidation.
*   Study presentation migrated: **df-study-progress**, **df-word-panel**, **df-question-prompt**, **df-answer-feedback**, **df-choice-list**.
*   Main list migrated: **df-word-row** (renders up to 200x per page).
*   **Light vs shadow DOM rule established:** components containing dispatched controls render in LIGHT DOM, because the app routes every control through one delegated `document` click listener resolving `e.target.closest("[data-action]")`, and because `answer-input` is located via `document.getElementById` and `document.activeElement.id`. A shadow root would silently break typing, focus, Enter-to-submit, and every button. Read-only components use shadow DOM.
*   **SRS untouched:** scheduler unchanged; rating values, labels, and classes preserved exactly. Browser-verified that clicking rating 3 while the engine suggested 4 moved the card reps 0->1, ease 2.5->2.52, interval 1, state review, and logged the attempt at rating 3.
*   Two pre-existing bugs fixed separately from refactors: statistics tiles rendering `ليس رقمًا` (NaN), and the session-summary/audit formatting difference that a shared helper would have silently changed.
*   11 Lit components; `app.js` at 942 lines.

## iPad/iPhone UX Validation (browser-verified)
*   **Touch targets:** every control now meets the 44x44pt Apple HIG minimum (the theme toggle was the only one below it).
*   **Viewport:** `100vh` replaced with `100dvh` (vh fallback first) on page and study layouts, and on modal max-height, so iOS dynamic chrome no longer pushes content out of view.
*   **Virtual keyboard:** at a keyboard-sized 375x380 viewport the answer field is fully visible, the action row reachable, no horizontal overflow; scroll margins keep the field clear of the keyboard.
*   **External keyboard:** Enter-to-submit verified working through the migrated input.
*   **German input:** the answer field carries `lang="de"`; German text is bidi-isolated so it renders correctly inside the RTL page.
*   **Safe areas:** insets applied on all edges for both `.layout` and the full-screen study route.
*   **iPad workspace:** vocabulary list is two columns from tablet landscape (rows 514px instead of a stretched 1030px), study column centred at 920px with a taller prompt card; iPhone stays single column.

## iPad-First App Shell Foundation
*   Additive CSS layer only; existing rules and phone layouts unchanged.
*   iOS safe-area insets now respected on top and both inline edges (bottom was already handled); `viewport-fit=cover` already present.
*   From tablet landscape (>=900px) the bottom pill becomes a vertical side rail with 64px touch targets; phones and tablet portrait keep the existing bottom bar.
*   Logical properties throughout, so RTL places the rail on the correct edge.
*   Verified at iPad landscape 1180x820 (side rail, content clears it by 28px), iPad portrait 820x1180 (bottom bar), iPhone 375x812 (bottom bar, 2-column summary, no horizontal overflow).

## First-Launch Migration Controller (implemented, gated OFF)
*   Sequence enforced: **BACKUP -> READ OLD -> VALIDATE -> TRANSFORM -> WRITE SQLITE -> VERIFY -> SWITCH**.
*   Refuses to start without a durable backup sink. The IndexedDB source is read-only for the whole run and is never cleared, rewritten, or repaired.
*   The target must be empty before writing, so an interrupted or repeated run cannot double-import.
*   ANY failure at ANY stage aborts without switching; the app remains on IndexedDB automatically. The switch flag is written only after verification passes. A failed verify or failed switch clears only the NEW database.
*   Verification compares the read-back field-for-field against the transformed dataset, checks referential integrity, requires identical SRS state, and requires every source word to be accounted for.
*   `bootstrap-persistence.js` composes detection + selection + migration so the fallback is guaranteed by the wiring: on any failure the learner still gets a working IndexedDB store.
*   **Real-scale rehearsal:** the full sequence was run against the real 2026-08-20 export loaded into a throwaway IndexedDB (2811 words / 337 cards / 2528 attempts) and completed with 0 lost cards, 0 SRS mismatches, integrity OK, and the source unchanged. The real export file was only ever read (sha256 unchanged).

## Mobile Foundation (DF-014, verified against official docs 2026-08-21)
*   Capacitor **8.5.0** (core/cli/ios/android); `@capacitor-community/sqlite` **8.1.1** (peer `@capacitor/core >=8.0.0`).
*   Platform requirements: **Xcode 26.0+**, **iOS 15.0** deployment target, **Android Studio Otter 2025.2.1+**, **minSdk 24 / compileSdk 36 / targetSdk 36**, **NodeJS 22+**.
*   `capacitor.config.json`: `webDir` = `01_APPLICATION/CURRENT_APP`; `iosDatabaseLocation` = `Library/CapacitorDatabase`.
*   Encryption OFF on both platforms pending the SQLCipher export-compliance review (DF-010 condition 6).
*   `appId` `com.deutschflow.app` is a PLACEHOLDER to confirm before any store submission.
*   Native platform folders NOT added — `cap add ios` needs macOS + Xcode 26, `cap add android` needs the Android SDK.
*   Known advisory: `uuid@7.0.3` via `@capacitor/cli > xcode`. devDependency build tooling only, never shipped; `npm audit fix --force` would downgrade the Capacitor CLI, so it is deliberately left in place.
*   **Last Completed Task:** Implemented backup/validate/restore/parity comparison (explicit-call, no launch-time side effect) and a read-only migration dry-run, then ran it against the real 2026-08-20 learner export. The dry-run exposed genuine unmapped fields and one orphan SRS card; both were closed by preserving all remaining fields and adding a `migration_quarantine` table so unresolved records are preserved rather than dropped. Regression suite 45 -> 61, all passing. No learner data modified (source export verified byte-identical by sha256 and mtime).

## Real-Data Dry-Run Result (2026-08-21, source: `DeutschFlow-backup-2026-08-20.json`, READ-ONLY)
*   Source: 2811 words / 337 cards / 2528 attempts. Canonical: 2811 items, 2811 meanings, 60 accepted answers, 336 active cards, 2527 events, 2 quarantined.
*   SRS: 0 lost cards, 0 field mismatches, 0 ease values out of bounds.
*   Relationship integrity: clean (no orphan meanings, answers, cards, or events; no duplicate card identity).
*   Isolated SQLite write/read-back: PASS.
*   Unmapped source fields: NONE.
*   Quarantined and preserved: 1 SRS card (`2691:recall`, word deleted by learner) and its 1 attempt.
*   Verdict: no blocking risks; persistence switch APPEARS SAFE (advisory only — the switch itself remains a separate approved step).

## Decision Status
*   **Decision 1 (Packaging):** RESOLVED (APPROVED WITH CONDITION)
*   **Decision 2 (Synchronization):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 3 (Cloud Account):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 4 (AI Grading):** RESOLVED (APPROVED WITH CONDITION AND FUTURE EXTENSION)
*   **Decision 5 (Pronunciation):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 6 (Notifications):** RESOLVED (APPROVED WITH CONDITION)
*   **Technical Decision 1 (Mobile SQLite):** RESOLVED (APPROVED WITH CONDITIONS)
*   **Technical Decision 2 (Desktop SQLite):** DEFERRED UNTIL DESKTOP PHASE
*   **Technical Decision 3 (UI Framework):** RESOLVED (APPROVED WITH STAGED MIGRATION)
*   **Technical Implementation:** ACTIVE — PHASE 3 COMPLETE / PHASE 4 SAFETY PREPARATION STARTED
*   **Architecture Phase:** COMPLETE (DESIGN & PLANNING ONLY)

## Audit & Design Metrics
*   **current application version:** DeutschFlow Pro RC4 (`pro-rc1-2026-07-25`)
*   **implementation plan files created:**
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_FIRST_IMPLEMENTATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/IMPLEMENTATION_PHASE_GATES.md`
    *   `05_TECHNICAL/DOCUMENTATION/REGRESSION_PROTECTION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/DATA_PRESERVATION_AND_ROLLBACK_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/LIT_INCREMENTAL_MIGRATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_PLATFORM_ROLLOUT_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/FIRST_IMPLEMENTATION_TASK.md`
*   **unresolved questions:** None. Implementation plan complete.
*   **last agent:** OpenAI Codex

## Next Approved Action
*   Storage selection seam, migration controller, and bootstrap wiring are DONE and gated OFF. Remaining, in order:
    1.  **USER-ONLY (iOS first):** run `npx cap add ios` on macOS with Xcode 26.0+, then `npx cap sync ios`. Android is explicitly deprioritized for now.
    2.  **Gate 5 on-device verification (iPad/iPhone):** offline launch, native SQLite persistence across app restarts and force-quit, touch study controls, and virtual-keyboard behavior over the answer input.
    3.  **Device-side migration rehearsal:** run the controller on-device with `nativeStorageEnabled` still OFF for the app, verifying the backup sink writes to native storage and the verification stage passes with real data on the device.
    4.  **Live switch (requires approval):** only after 2 and 3 pass, enable `nativeStorageEnabled` and keep IndexedDB as the recovery source until parity is confirmed in production.
*   Before iOS signing/release (NOT blockers for the stages above): confirm the real bundle identifier (currently placeholder `com.deutschflow.app`) and complete the SQLCipher export-compliance review if encryption is to be enabled.
*   Next UI increments (no device needed), in order: migrate the study **question card** presentation (word, pronunciation, meaning, detail pills) — read-only, so still no interaction risk; then the **session-end summary**, which can reuse `<df-stat-tile>`. Answer input, reveal, hint, and rating controls migrate LAST, one at a time, each re-running the study interaction suite.
*   Do NOT switch real learner persistence or delete IndexedDB support until Gate 5 passes.
*   Do NOT start educational-content rewriting. Do NOT big-bang rewrite `app.js`.

## Open Observation (non-blocking)
*   The deployed RC build writes backups with `schemaVersion: 6` plus `appVersion` / `build` / `dbVersion` / `engineVersion`, while `src/app.js` `exportBackup` writes `schemaVersion: 5` without them. The backup module accepts both and preserves the extra metadata, so nothing is at risk; the source/deploy divergence is simply recorded here for a later reconciliation task.
