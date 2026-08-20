# Open Technical Decisions (OPEN_TECHNICAL_DECISIONS.md)

This document lists key technical choices requiring developer/user approval before starting database implementation or code refactoring.

---

## Decision 1: Mobile SQLite Plugin Selection
*   **Status:** APPROVED WITH CONDITIONS
*   **Condition:** Approved the Capacitor Community SQLite plugin (`@capacitor-community/sqlite`) for native SQLite persistence on iOS/Android. The exact plugin package version remains deferred until implementation compatibility is verified against system SDKs. Strict repository abstraction is mandatory (the learning/application core must never call the plugin directly). Native mobile builds must not rely on browser IndexedDB as the sole persistence mechanism. All existing user progress and SRS state must be preserved during migrations. SQLCipher export compliance and regulatory checks must be completed before app store distribution. Web client uses IndexedDB fallback.
*   **Context:** Native iOS and Android Capacitor wrappers require a plugin to communicate with native SQLite storage.
*   **Options:**
    1.  **`@capacitor-community/sqlite`:** Capacitor Community SQLite plugin.
    2.  **`cordova-sqlite-storage`:** Legacy Cordova plugin wrapped for Capacitor.
*   **Impact:** Option 1 has active support, handles database encryption optionally, and supports multi-connection transaction queues directly.
*   **Recommendation:** **Option 1 (`@capacitor-community/sqlite`)**. It is the modern standard for Capacitor applications.

---

## Decision 2: Desktop SQLite Wrapper for Tauri
*   **Context:** Tauri requires a Rust-to-JS bridge to query SQLite database files.
*   **Options:**
    1.  **`tauri-plugin-sql`:** Official plugin exposing database execution APIs directly to JavaScript.
    2.  **Custom Rust Commands:** Hand-code custom Rust command functions in `src-tauri/src/main.rs` to handle SQL statements.
*   **Impact:** Option 1 requires zero custom Rust code, accelerating development. Option 2 provides granular control over database connection pools but increases Tauri build management overhead.
*   **Recommendation:** **Option 1 (`tauri-plugin-sql`)** to minimize Rust-side maintenance and maintain layout consistency with Capacitor queries.
*   **Status:** **OPEN**

---

## Decision 3: Modular UI Rendering Framework
*   **Context:** Splitting the monolithic 120 KB `app.js` requires organizing UI rendering code.
*   **Options:**
    1.  **Vanilla ES Modules:** Keep rendering in template strings but refactor into separate file modules imported dynamically.
    2.  **Lightweight Compilerless Framework (e.g. Alpine.js or Lit):** Introduce a minimal reactive web framework to bind variables directly to HTML elements.
*   **Impact:** Option 1 has zero performance overhead, requires no tooling, and preserves 100% of current code rendering behavior. Option 2 simplifies event handlers and state sync at the cost of dependency overhead.
*   **Recommendation:** **Option 1 (Vanilla ES Modules)** to maintain the strict zero-tooling runtime setup and eliminate migration risks.
*   **Status:** **OPEN**
