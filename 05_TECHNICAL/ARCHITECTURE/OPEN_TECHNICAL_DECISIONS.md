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
*   **Status:** DEFERRED — DESKTOP PHASE
*   **Note:** Implementation sequencing decision prioritizes native Mobile/Tablet (iOS/iPadOS and Android) delivery first. Desktop/Tauri evaluation remains approved in long-term architecture but is deferred until the Desktop delivery phase.
*   **Context:** Tauri requires a Rust-to-JS bridge to query SQLite database files.
*   **Options:**
    1.  **`tauri-plugin-sql`:** Official plugin exposing database execution APIs directly to JavaScript.
    2.  **Custom Rust Commands:** Hand-code custom Rust command functions in `src-tauri/src/main.rs` to handle SQL statements.
*   **Impact:** Option 1 requires zero custom Rust code, accelerating development. Option 2 provides granular control over database connection pools but increases Tauri build management overhead.
*   **Recommendation:** **Option 1 (`tauri-plugin-sql`)** to minimize Rust-side maintenance and maintain layout consistency with Capacitor queries.

---

## Decision 3: Modular UI Rendering Framework
*   **Status:** APPROVED WITH STAGED MIGRATION
*   **Final Decision:** Approved **Lit-based component architecture** for the future DeutschFlow UI, with an **incremental migration strategy** from the existing Vanilla JS application. No full/big-bang rewrite.
*   **Rationale for Decision Change:** The Mobile-First and iPad/tablet-first priority requirements, combined with the expanded German Learning System scope (grammar, exercises, courses, dashboards, audio controls, and responsive tablet orientation changes), materially changed the technical evaluation. The UI state complexity and reactive component lifecycle requirements outweigh maximum preservation of the manual template-string DOM rendering approach. Lit provides standard Web Components, reactive state bindings, zero framework lock-in in domain models, and high performance in native WebViews without adding heavy application framework bundles.
*   **Context:** Splitting the monolithic 120 KB `app.js` requires organizing UI rendering code.
*   **Options:**
    1.  **Vanilla ES Modules:** Keep rendering in template strings but refactor into separate file modules imported dynamically.
    2.  **Lightweight Compilerless Framework (e.g. Alpine.js or Lit):** Introduce a minimal reactive web framework to bind variables directly to HTML elements.
*   **Impact:** Option 1 has zero performance overhead, requires no tooling, and preserves 100% of current code rendering behavior. Option 2 simplifies event handlers and state sync at the cost of dependency overhead.
*   **Original Recommendation:** **Option 1 (Vanilla ES Modules)** to maintain the strict zero-tooling runtime setup and eliminate migration risks.
*   **Approved Architecture Rules:**
    1.  **Presentation-Only Boundary:** Lit is strictly a presentation layer. Core domain logic (SRS scheduler, answer evaluator, vocabulary rules, grammar mastery, exercise calculation, repositories) remains in framework-independent ES modules.
    2.  **No Direct Persistence or Native API Calls:** Lit components must never query database plugins (`@capacitor-community/sqlite`, IndexedDB) or platform APIs directly; all data passes through Application Services and Repositories.
    3.  **No Full Rewrite:** Incremental component-by-component migration. Existing screens remain functional throughout migration.
    4.  **No UI Framework Bundles:** No Material, Bootstrap, Ionic, or Tailwind frameworks are introduced.
    5.  **Vanilla ES Modules Retained:** Vanilla ES modules remain the standard for domain services, repositories, and utilities.
