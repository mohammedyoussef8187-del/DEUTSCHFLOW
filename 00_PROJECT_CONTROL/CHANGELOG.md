# Changelog (CHANGELOG.md)

All notable changes to the **DeutschFlow** project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
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

### Changed
*   Recorded user approval with persistence condition for Product Decision 1 (Multi-Platform Packaging Architecture).
*   Recorded user approval with staged implementation condition for Product Decision 2 (Cross-Device Synchronization Strategy).
*   Recorded user approval with optional cloud account and default local-only condition for Product Decision 3 (Cloud Account Requirement vs Local-Only Mode).
*   Recorded user approval with deterministic scoring as authoritative and AI as advisory condition for Product Decision 4 (AI-Assisted Answer Evaluation Policy).
*   Recorded user approval with self-evaluation recording/playback condition for Product Decision 5 (Speaking / Pronunciation Feature Scope).
*   Recorded user approval with native local review notifications condition for Product Decision 6 (Notification and Review Reminder Policy).
*   Recorded user approval with conditions for Technical Decision 1 (Mobile SQLite Plugin Selection).
*   Recorded Mobile-First delivery priority (iPad/iPhone and Android prioritization, deferring Technical Decision 2 to the Desktop delivery phase).

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
