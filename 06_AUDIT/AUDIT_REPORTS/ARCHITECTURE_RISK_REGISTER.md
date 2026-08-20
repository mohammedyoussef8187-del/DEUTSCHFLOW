# Architectural Risk Register (ARCHITECTURE_RISK_REGISTER.md)

This register catalogs the key technical, storage, and platform risks associated with the upgraded **DeutschFlow** technical design, along with mitigation strategies.

---

## 1. Active Risk Catalog

### Risk 1: Browser Storage Purges on iOS / iPadOS
*   **Probability:** High
*   **Impact:** Critical (Full user data and progress loss)
*   **Context:** iOS Safari automatically deletes sandboxed IndexedDB data if the application remains unopened for 7 days, or when the system detects low local disk space.
*   **Mitigation:** **Reject IndexedDB as primary native storage**. Native mobile builds utilizing Capacitor must write directly to dedicated filesystem documents directories using native SQLite plugins. These directories are protected from iOS cache clearing cycles.

---

### Risk 2: Schema Migration Failures Resulting in Progress Loss
*   **Probability:** Medium
*   **Impact:** Critical (Database corruption or progress reset)
*   **Context:** Database structural upgrades (adding tables, altering columns) could fail during runtime migration execution on old user databases.
*   **Mitigation:** Implement strict transactional upgrades. Before running migrations, the system makes a temporary copy of the active database file. If any SQL migration query fails, the transaction is rolled back, the corrupt file is deleted, and the database is restored from the backup copy.

---

### Risk 3: Performance Degradation with Large Curriculums
*   **Probability:** Medium
*   **Impact:** High (Layout stutters, slow search, input lag)
*   **Context:** Querying and filtering thousands of vocabulary entries and their card schedules on mobile devices can cause stutters if handled inefficiently.
*   **Mitigation:** Add relational indexes on key query targets (such as due dates and normalized spelling). Limit active list rendering to virtualized scrolling components that load entries in small, manageable pages.

---

### Risk 4: Platform-Specific Audio / Recording Plugin Divergence
*   **Probability:** Medium
*   **Impact:** High (Audio fails, microphone errors)
*   **Context:** iOS, Android, and Desktop wrapper environments use different underlying native audio and microphone recording APIs.
*   **Mitigation:** Decouple native audio dependencies from the core learning service. The core references a platform-neutral `AudioAdapter` interface, letting native plugins implement custom recording adapters per wrapper without modifying the learning core code.
