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
