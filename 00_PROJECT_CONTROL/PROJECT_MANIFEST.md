# Project Manifest (PROJECT_MANIFEST.md)

This file defines the canonical structure and manifests the contents of the **DeutschFlow** directory tree.

## Directory Structure

*   `00_PROJECT_CONTROL/` - Canonical files for project metadata, constraints, roadmap, and agent coordination.
    *   `PROJECT_MANIFEST.md`
    *   `PROJECT_CONTEXT.md`
    *   `CURRENT_WORK_STATUS.md`
    *   `DEVELOPMENT_ROADMAP.md`
    *   `DECISION_LOG.md`
    *   `CHANGELOG.md`
    *   `AI_WORKING_RULES.md`
*   `01_APPLICATION/` - Application source code.
    *   `CURRENT_APP/` - Intended target production application files.
    *   `LEGACY_APP/` - Raw existing/legacy application code.
*   `02_DATA/` - Databases, migration tooling, and cleaning rules.
    *   `CURRENT_DATABASE/` - Target production databases.
    *   `LEGACY_DATA/` - Legacy databases and export dumps.
    *   `MIGRATIONS/` - Database migration scripts.
    *   `DATA_QUALITY/` - Quality verification pipelines and schema rules.
*   `03_COURSE_CONTENT/` - German course materials.
    *   `NETZWERK_A1/` - A1 source files and syllabus rules.
    *   `NETZWERK_A2/` - A2 course structure assets.
    *   `NETZWERK_NEU_A2/` - Netzwerk Neu A2 assets.
    *   `VOCABULARY/` - Vocabulary lists, tables, and dictionary definitions.
    *   `GRAMMAR/` - Structured grammar rules and modules.
    *   `LISTENING/` - Listening comprehension audios and text scripts.
    *   `EXERCISES/` - Formatted test exercises and validation schemes.
*   `04_PRODUCT_DESIGN/` - Requirements and learning specifications.
    *   `REQUIREMENTS/` - Written requirements, features, and stories.
    *   `FEATURE_MATRIX/` - Feature roadmap matrix and priority.
    *   `UX_UI/` - Wireframes, visual mockups, and layout assets.
    *   `LEARNING_MODEL/` - Educational structures and retention algorithms.
*   `05_TECHNICAL/` - Architecture, guidelines, and quality assurance.
    *   `ARCHITECTURE/` - Software architectures and dataflow diagrams.
    *   `DATABASE/` - Database design schemas and model specifications.
    *   `TESTING/` - Testing frameworks, unit, and integration tests.
    *   `DOCUMENTATION/` - Code documentation guidelines and APIs.
*   `06_AUDIT/` - Project state analysis and reports.
    *   `APPLICATION_AUDIT/` - Legacy code audit logs and performance analysis.
    *   `DATA_AUDIT/` - Data completeness and structure audit logs.
    *   `LEARNING_GAP_ANALYSIS/` - Audit of educational material coverage.
    *   `AUDIT_REPORTS/` - Unified final reports.
*   `07_RELEASES/` - Production releases and snapshots.
    *   `BACKUPS/` - Backup databases and application archives.
    *   `BUILDS/` - Compiled output assets and deployment targets.
*   `99_ARCHIVE/` - Historical or deprecated files.
