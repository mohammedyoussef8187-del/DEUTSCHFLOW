# Architecture Review Summary (ARCHITECTURE_REVIEW_SUMMARY.md)

This summary reviews the proposed technical design and database schema for the upgraded **DeutschFlow** German Learning System.

---

## 1. Technical Design Overview

1.  **Recommended Architecture:** A local-first, modular shared web application core decoupled from platform adapters via a Repository Abstraction layer.
2.  **Recommended Native Persistence:** **SQLite** as the primary storage layer for native installations (iOS, Android, and Desktop Tauri packages) to ensure data safety against iOS automatic cache cleanup cycles. Web standard browser fallback uses IndexedDB.
3.  **Shared-Core Approach:** One core codebase written in vanilla ECMAScript containing all business logic, validation normalizers, SRS schedulers, and exercise managers.
4.  **Current SRS Preservation Strategy:** The logical database migration plan maps and preserves all legacy SRS card states (`new`, `learning`, `review`, `mastered`), repetition counts (`reps`), ease values (`ease`), streaks (`streak`), and due dates (`dueAt`) without resetting user history.
5.  **Database Migration Approach:** Automated database transition runs on the first native app launch. Reads data from IndexedDB, translates keys and identifiers, and commits them in a secure transactional write to SQLite with full automatic rollback on error.
6.  **Multi-Platform Strategy:** Shared HTML/CSS/JS frontend core packaged via Capacitor (iOS/Android wrapper) and Tauri (Windows/macOS desktop wrapper).
7.  **Offline Strategy:** Core study features (vocabulary recall, grammar exercises, locally downloaded audio, SRS updates) operate without any internet requirement.
8.  **Sync-Readiness Strategy:** All database tables include globally unique record identifiers (UUIDs), revision versions, update timestamps, and tombstone deletion states, enabling conflict-free merge operations when cloud synchronization is introduced.
9.  **Major Technical Risks:**
    *   Disk cache deletion of browser IndexedDB data on iOS (mitigated by using native SQLite storage).
    *   Regression of scheduling and validation logic (mitigated by introducing automated Jest/Vitest unit testing).
10. **Decisions Still Requiring User Approval:**
    *   Select specific SQLite wrapper library/plugin.
    *   Select UI layout refactoring library (Vanilla JS modules vs. lightweight compilerless UI rendering frameworks).
11. **Recommended Implementation Sequence:**
    1.  **Step 1:** Refactor monolithic `app.js` into separate ES modules with Jest/Vitest unit test configurations.
    2.  **Step 2:** Redesign database model in SQLite and implement repository interfaces.
    3.  **Step 3:** Implement automatic database migration pipelines from current IndexedDB stores.
    4.  **Step 4:** Build Capacitor (mobile) and Tauri (desktop) wrapping layers with platform-native SQLite adapters.
    5.  **Step 5:** Integrate local audio media caching and local scheduled notifications.
