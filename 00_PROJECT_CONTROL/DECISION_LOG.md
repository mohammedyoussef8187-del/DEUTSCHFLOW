# Decision Log (DECISION_LOG.md)

This log is the immutable record of approved design, product, and technical decisions for **DeutschFlow**. Approved decisions must not be altered without explicit user request.

## [DF-001] Project Core Framework and Constraints
*   **Status:** Approved
*   **Date:** 2026-08-20
*   **Context:** The DeutschFlow project is being initialized as a structured German Learning System transitioning from a simple vocabulary trainer.
*   **Decision:**
    *   Initialize a strict directory and control structure to ensure cross-agent continuity (Codex, Claude Code, Antigravity).
    *   No automatic code refactoring or source data manipulation is allowed during the initialization phase.
    *   All code changes must be based on a formal audit and design phase.

## [DF-002] Multi-Language Scoring and Scope
*   **Status:** Approved
*   **Date:** 2026-08-20
*   **Context:** Clarifying educational requirements for English and Arabic supports.
*   **Decision:**
    *   German is the target language.
    *   English and Arabic have equal pedagogical weight for definitions and explanations.
    *   **Scored Evaluation:** Only German-to-English (and vice versa) translation and retrieval participate in user scoring.
    *   **Arabic Evaluation Constraint:** Arabic input must **NOT** affect score evaluation. It serves exclusively for definitions and explanations. No single literal Arabic translation should be forced where multiple contextual meanings exist.

## [DF-003] Grammar Instruction Paradigm
*   **Status:** Approved
*   **Date:** 2026-08-20
*   **Context:** Standardizing grammar teaching methodology.
*   **Decision:**
    *   Reject simple static free-text grammar explanations as the sole grammar feature.
    *   Grammar must eventually be implemented as a structured, programmatically models-driven and interactive learning component.

## [DF-004] Multi-Platform Packaging Architecture
*   **Status:** APPROVED WITH CONDITION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Selection of packaging framework and deploy target architecture for multi-platform delivery (iOS, Android, Windows, macOS, Linux, Web).
*   **Decision:** Approved the deployment model utilizing a **Shared Web Application Core + Capacitor for iOS/Android + Tauri for Desktop**.
*   **Storage Condition:** Production native installations (mobile and desktop) must **NOT** rely on browser IndexedDB as the sole production persistence layer due to OS-directed sandbox deletion risks (especially on iOS Safari). A durable native database layer (such as SQLite or equivalent) must be evaluated and implemented during the technical-architecture phase under a repository/persistence abstraction framework:
    `Learning/Application Core` -> `Data Repository / Persistence Abstraction` -> `Platform-Specific Durable Storage`.
*   **Rationale:** Maximize shared code reuse (retaining one logical database, one learning engine, and one UI codebase) while guaranteeing durable local data safety and store compatibility across target devices.

## [DF-005] Cross-Device Synchronization Strategy
*   **Status:** APPROVED WITH STAGED IMPLEMENTATION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Design and scheduling strategy for synchronizing learning progress (cards, statistics, history, settings) across multiple user devices (mobile and desktop).
*   **Decision:** Approved a **staged synchronization approach**:
    1.  **Baseline / Initial Release:** Retain and improve manual JSON backup/restore exports as the primary portability layer. Manual backup remains a permanent, non-negotiable product feature.
    2.  **Target Future Release:** Central Cloud Synchronization (incremental REST API sync). Cloud sync is **NOT** approved for active implementation in the current phase.
    3.  **Peer-to-Peer Wi-Fi Sync:** Rejected as the primary synchronization method.
*   **Storage & Schema Condition:** The logical database schema redesigned in the next phase must be sync-ready from the start. It must include fields for globally unique record identifiers (UUIDs), creation/modification timestamps, revision versions, and tombstone deletion states for all syncable learning tables (vocabulary, cards, progress, history, settings). Conflict resolution policies (such as append-only merges or version-based overrides) must be supported by the database architecture.

## [DF-006] Cloud Account Requirement vs. Local-Only Mode
*   **Status:** APPROVED WITH STAGED IMPLEMENTATION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Selection of authentication, registration requirements, and local user profiling constraints.
*   **Decision:** Approved the **Optional Cloud Account — Default Local-Only** model:
    1.  **Local-Only / Offline-First:** Default operational mode. Users can install and immediately run the app without internet connection, sign-up forms, login walls, subscription requirements, or profiles.
    2.  **Optional Accounts:** Introduced in a future stage solely to support backup recovery and central cloud synchronization.
    3.  **Authentication Providers:** Undecided in this phase (e.g. Google, Apple, passwordless); no auth SDKs are approved.
*   **Storage & Schema Condition:** The next database schema design must support a durable local profile identifier (local user ID) even for anonymous guests, ensuring that guest-to-account migrations are safe and preserve historical streaks, SRS card progress, error logs, and settings without data loss or duplication when an account is linked.

## [DF-007] AI-Assisted Answer Evaluation Policy
*   **Status:** APPROVED WITH CONDITION AND FUTURE EXTENSION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Grading mechanism rules for lexical evaluation, spelling checks, and synonym validation during active study sessions.
*   **Decision:** Approved the **Deterministic Core Scoring** model with future optional advisory AI extensions:
    1.  **Authoritative Scoring:** Core evaluation must remain deterministic, explainable, reproducible, and 100% offline-capable. AI/LLM models must **NOT** dictate correct/incorrect grading, SRS due dates, intervals, or masteries.
    2.  **Linguistic Grading Rules:** Deterministic validators will evaluate spellings, normalization filters, casings, punctuation, umlaut/ss alternatives, article modifiers, and multiple accepted answers.
    3.  **Arabic Grading Constraint:** Arabic must **NOT** participate in active scored grading. Incorrect Arabic input or semantic synonyms in Arabic must never penalize user score.
    4.  **Advisory AI Role:** AI-assisted grading is approved in future phases as a non-authoritative assistant only (providing semantic tips, suggesting new synonyms for user confirmation, explaining syntax errors). AI must never silently alter scoring history.
    5.  **No AI Provider:** No cloud or local AI model is selected, and implementation is NOT approved.
*   **Storage & Schema Condition:** The next database schema design must allow educational items (vocabulary, sentences) to store grading configuration metadata, such as primary answers, synonym lists, accepted alternatives, and item-specific evaluation rules.

## [DF-008] Speaking / Pronunciation Feature Scope
*   **Status:** APPROVED WITH STAGED IMPLEMENTATION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Integration of speech/pronunciation training module and device microphone permission boundaries.
*   **Decision:** Approved a **staged speaking / pronunciation approach**:
    1.  **Initial Approved Capability:** Self-Evaluation Recording and Playback (user records voice, plays it back, and manually compares to native speaker audio).
    2.  **No Authoritative Scoring Impact:** Self-evaluation practice exercises serve purely for learning drills and must **NOT** affect authoritative SRS card state, intervals, or masteries.
    3.  **Local by Default:** Learner audio recordings must remain stored locally on the device by default (no automatic cloud upload).
    4.  **Automated Pronunciation Scoring:** Deferred as a future optional enhancement (non-authoritative STT/phoneme checks for feedback only). No provider/model is selected.
    5.  **Microphone Support:** Required across iOS, Android, and Desktop wrapper layers, requested explicitly and dynamically only upon using speaking exercises. Core features must remain functional if microphone access is denied.
    6.  **Offline Support:** Basic pronunciation exercises and local audio recording must operate fully offline.
*   **Storage & Schema Condition:** The future database schema must support optional relationships mapping vocabulary, sentences, and exercises to reference audio records and practice metadata.

## [DF-009] Notification and Review Reminder Policy
*   **Status:** APPROVED WITH CONDITION
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Design and strategy rules for push notifications, background scheduling, and practice reminders.
*   **Decision:** Approved the **Native Local Review Notifications** approach:
    1.  **Optional & Opt-In:** Notifications are helper triggers. Users have full setting controls (reminder time, target options) to disable or enable notifications. App startup, core learning, and SRS features must run fully if notifications are denied or disabled.
    2.  **Offline Native Scheduling:** Reminders must run without internet connections, central push-notification servers, cloud accounts, or FCM/APNs backend wrappers, utilising native OS local alarm/scheduler APIs.
    3.  **SRS Authority:** The SRS scheduler remains the sole source of truth for card due-dates. Notifications consume this data and must **NOT** modify learning logs or card metrics. If a notification is delayed or missed, card states remain intact.
    4.  **Privacy-Preserving:** Lock-screen text should avoid exposing specific dictionary items (e.g. default to `"DeutschFlow — You have reviews due."`).
    5.  **Desktop Evaluation:** Windows/macOS/Linux systems will be evaluated separately during the technical architecture phase to design app-running alerts or local tray alarms, avoiding background daemon resource locks.
    6.  **Web Push Deferred:** Web-browser push notifications are deferred. Web versions will use local in-app warnings.
*   **Storage & Schema Condition:** None directly impacting core data, but platform wrappers must expose notification status queries through clean, abstract interfaces.

## [DF-010] Technical Decision 1 — Mobile SQLite Plugin Selection
*   **Status:** APPROVED WITH CONDITIONS
*   **Date:** 2026-08-20
*   **Approving Authority:** User
*   **Context:** Selection of native database storage bridge library/plugin for packaged Capacitor iOS and Android targets.
*   **Decision:** Approved the **Capacitor Community SQLite plugin** (`@capacitor-community/sqlite`) for native SQLite persistence:
    1.  **Wrapper Family:** Capacitor Community SQLite plugin is approved as the technology driver for mobile storage.
    2.  **Version Selection:** Package version pinning remains deferred until implementation workspace configurations are evaluated for compatibility.
    3.  **Repository Isolation:** Mandatory Repository Layer / Persistence Adapter boundary. Business logic and learning engine must never query the plugin API directly.
    4.  **IndexedDB Prohibited on Native:** Standard IndexedDB browser storage is prohibited as the sole persistence layer for native packaged builds to prevent automatic OS data purges.
    5.  **Progress Preservation:** Migrations to the new SQLite database must fully preserve existing card schedules, streaks, and user settings.
    6.  **SQLCipher Compliance:** Export compliance and regulatory checks for SQLCipher must be completed before app store releases.
*   **Storage & Schema Condition:** Data queries must be standard SQL compliant, enabling transition or schema modifications without touching the core learning engine. Implementation is NOT approved for this phase.
