# Development Roadmap (DEVELOPMENT_ROADMAP.md)

This phase-based roadmap outlines the high-level path to upgrading DeutschFlow into a structured German Learning System.

> [!WARNING]
> Future phases (Phases 1 through 6) are proposed and must not be marked as approved or started until explicitly approved by the user.

## Phase 0: Project Initialization & Workspace Preparation
*   **Status:** APPROVED & COMPLETED
*   **Tasks:**
    *   Set up canonical folder structure.
    *   Create entry point files (`README.md`, `AGENTS.md`, `CLAUDE.md`).
    *   Initialize control configurations (`PROJECT_CONTEXT.md`, `CURRENT_WORK_STATUS.md`, `AI_WORKING_RULES.md`, `DECISION_LOG.md`, `CHANGELOG.md`).
    *   Initialize repository tracking.

## Phase 1: Audit and Analysis
*   **Status:** PENDING USER APPROVAL
*   **Tasks:**
    *   Audit existing/legacy application code in `01_APPLICATION/LEGACY_APP/`.
    *   Audit existing user data and vocabulary structure in `02_DATA/LEGACY_DATA/`.
    *   Perform a learning gap analysis against a structured curriculum (Netzwerk A1, A2, Neu A2).
    *   Generate comprehensive audit reports in `06_AUDIT/`.

## Phase 2: Requirements Definition & System Design
*   **Status:** PENDING USER APPROVAL
*   **Tasks:**
    *   Draft features matrix, learning models, and functional specifications under `04_PRODUCT_DESIGN/`.
    *   Draft target database schema and system architecture under `05_TECHNICAL/`.

## Phase 3: Migration and Foundation
*   **Status:** PENDING USER APPROVAL
*   **Tasks:**
    *   Define database migration scripts in `02_DATA/MIGRATIONS/`.
    *   Port legacy data to the new database model.
    *   Set up testing framework base under `05_TECHNICAL/TESTING/`.

## Phase 4: Core Implementation
*   **Status:** PENDING USER APPROVAL
*   **Tasks:**
    *   Implement vocabulary trainer core.
    *   Implement interactive grammar components.
    *   Integrate course structure and assets (Netzwerk materials).

## Phase 5: Verification & Release
*   **Status:** PENDING USER APPROVAL
*   **Tasks:**
    *   Run complete testing suite.
    *   Deliver initial structured release under `07_RELEASES/`.
