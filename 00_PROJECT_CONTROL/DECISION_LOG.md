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
