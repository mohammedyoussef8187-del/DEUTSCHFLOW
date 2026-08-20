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
*   **Last Update Timestamp:** 2026-08-21T01:55:00+03:00

## Current Context
*   **Current Phase:** PHASE 4 — MIGRATION MAPPING + SQLITE PARITY VALIDATION
*   **Current Delivery Priority:** MOBILE FIRST — iOS/iPadOS + Android
*   **Phase Status:** PHASE 2 AND PHASE 3 COMPLETE. PHASE 4 COMPLETE (migration mapping, SQLite parity, backup/restore Gate 2, real-data dry-run). PHASE 5 STARTED: Capacitor 8 mobile foundation and native SQLite executor implemented and contract-tested. Real learner storage NOT switched; on-device verification (Gate 5) NOT yet performed.
*   **Implementation Status:** ACTIVE ON `mobile-foundation`
*   **Current Task:** Capacitor target and SQLite plugin version resolved and recorded as DF-014. Native executor implemented behind the existing adapter. Next work is blocked only on user-only device actions (see below) or can proceed with the runtime storage-selection seam.

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
*   Capacitor target, plugin version, and the native executor are DONE (DF-014). Remaining, in order:
    1.  **Runtime storage selection seam:** choose the persistence adapter at startup (native -> SQLite, web -> existing IndexedDB) behind the repository layer, with IndexedDB retained as the recoverable source. Implementable now without a device.
    2.  **First-launch migration controller:** READ OLD -> VALIDATE -> TRANSFORM -> WRITE NEW -> VERIFY -> SWITCH, with backup taken first and rollback to IndexedDB on any verification failure. Must not run automatically against real learner data until Gate 5 verification passes.
    3.  **USER-ONLY:** `npx cap add ios` on macOS with Xcode 26; `npx cap add android` with the Android SDK; Apple Developer enrollment, signing, provisioning.
    4.  **Gate 5 on-device verification:** offline launch on iPad/iPhone, touch study controls, virtual keyboard behavior, and native SQLite persistence across app restarts.
*   Do NOT switch real learner persistence or delete IndexedDB support until Gate 5 passes.
*   Do NOT install Lit until Gate 4 is reached.

## Open Observation (non-blocking)
*   The deployed RC build writes backups with `schemaVersion: 6` plus `appVersion` / `build` / `dbVersion` / `engineVersion`, while `src/app.js` `exportBackup` writes `schemaVersion: 5` without them. The backup module accepts both and preserves the extra metadata, so nothing is at risk; the source/deploy divergence is simply recorded here for a later reconciliation task.
