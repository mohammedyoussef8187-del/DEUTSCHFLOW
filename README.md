# DeutschFlow

DeutschFlow is a structured German Learning System that progressively upgrades an existing vocabulary trainer into a comprehensive educational platform.

## Temporary iPhone/iPad PWA Distribution

Until Apple Developer signing is available, the current application can be published as an
installable Progressive Web App from `01_APPLICATION/CURRENT_APP`.

The repository includes `.github/workflows/deploy-pwa.yml`. After GitHub Pages is configured
to use **GitHub Actions**, a push to `mobile-foundation` that changes the current app publishes
the PWA automatically. No Apple Developer account is required for this web installation.

On iPhone or iPad: open the published HTTPS link in Safari, tap **Share**, choose
**Add to Home Screen**, then tap **Add**. Learner data remains local in IndexedDB, so users
should keep manual backups and must not clear Safari website data while this temporary PWA is
their active installation.

## Project Navigation

For AI agents, developers, and tools, please refer to the specific entry point files for instructions and context:

*   **For Codex-based agents:** Refer to [AGENTS.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/AGENTS.md)
*   **For Claude Code agents:** Refer to [CLAUDE.md](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/CLAUDE.md)
*   **General Project Documentation:** Located under [00_PROJECT_CONTROL/](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/00_PROJECT_CONTROL/)

## Folder Structure

The project is organized as follows:

*   `00_PROJECT_CONTROL/`: Project metadata, roadmap, decision logs, changelogs, and AI instructions.
*   `01_APPLICATION/`: Contains `CURRENT_APP` and `LEGACY_APP` source code.
*   `02_DATA/`: Houses databases, data quality pipelines, and schema migrations.
*   `03_COURSE_CONTENT/`: Integrated curriculum content, vocabulary lists, grammar models, and audio.
*   `04_PRODUCT_DESIGN/`: Learning model definition, requirements, and design files.
*   `05_TECHNICAL/`: Architecture documents, testing suites, and developer guides.
*   `06_AUDIT/`: Application, data, and learning gap audit reports.
*   `07_RELEASES/`: Archive of builds, release packages, and data backups.
*   `99_ARCHIVE/`: Deprecated materials and legacy artifacts.
