# Technology Decision Matrix (TECHNOLOGY_DECISION_MATRIX.md)

This matrix compares appropriate technology options for the technical architecture phase of the upgraded **DeutschFlow** application.

---

## 1. Technical Framework Comparison Matrix

| Area | Option | Advantages | Disadvantages | Existing Code Reuse | Platform Fit | Recommendation |
|---|---|---|---|---|---|---|
| **Persistence** | **IndexedDB** | Easy implementation; matches current PWA storage structure. | **High data loss risk** on iOS Safari; limited query indices. | **Excellent (100%)** | Weak on native platforms. | **Rejected** as primary native storage. Retained as Web fallback. |
| **Persistence** | **SQLite** | Permanent storage; ACID transactions; strong search indexing. | Requires native library compilation and wrapper plugins. | Moderate (requires new storage repository queries). | **Excellent** on native iOS, Android, and Desktop. | **Recommended** as primary production storage for native builds. |
| **Persistence** | **Hybrid Repository Abstraction** | Decouples data model from specific engine; runs everywhere. | Adds a thin abstraction interface layer. | Good (reuses schema definitions). | **Excellent** - Allows tailoring storage per platform. | **Recommended** wrapper architecture. |
| **Mobile** | **Capacitor** | Compiles to native iOS/Android; preserves existing HTML5/CSS/JS. | WebView wrapper performance limits (though negligible for UI). | **Excellent (90%)** | Native app store deployment. | **Recommended** mobile packaging framework. |
| **Desktop** | **Tauri** | Very small binaries; low memory usage; Rust-based backend. | Rust compiler toolchain requirements. | **Excellent (95%)** | Native OS integrations. | **Deferred** until Desktop delivery phase. |
| **Web** | **Shared Web Core** | High portability; quick browser access. | No native notifications; browser storage limits. | **Excellent (100%)** | Standard web. | **Recommended** fallback target. |
| **Data Layer** | **SQL Query Builder / DAO** | Type-safety, clean structure, secure parameter queries. | Small library footprint size overhead. | Moderate (requires writing SQL queries). | Consistent across Tauri/Capacitor SQLite files. | **Recommended** (use clean, lightweight query controllers). |
| **UI Presentation** | **Lit Web Components** | Standard Web Components, reactive state management, lifecycle hooks, clean tablet/mobile responsive rendering, presentation-only decoupling. | Requires small runtime dependency (~5KB). | Moderate (components created incrementally around current templates). | **Excellent** across native WebViews and web targets. | **Approved** for future UI component rendering via staged migration. |
| **JS Modules** | **Vanilla ES Modules** | Standard browser native modules; zero dependencies; clean boundaries. | Manual state management if used for UI DOM updates alone. | **Excellent (100%)** | Standard across all targets. | **Approved** for domain services, repositories, SRS calculations, and non-UI logic. |

---

## 2. Recommendation Rationale

### Why SQLite is Recommended Over IndexedDB for Native Builds
IndexedDB in mobile browsers operates inside sandbox directory limits. On iOS, if the device runs low on disk space or the app remains closed for more than 7 days, **Apple Safari automatically deletes sandboxed IndexedDB databases**. Utilizing SQLite inside native Capacitor and Tauri storage directories protects database files from system cleaning cycles, ensuring absolute progress safety.

### Why Capacitor & Tauri are Recommended Over Native Re-Writes (e.g. React Native)
A React Native or Flutter rewrite would require discarding 100% of the tested DeutschFlow UI rendering layouts, RTL Arabic styling, CSS variables, and HTML DOM elements. Capacitor and Tauri allow packaging the existing web client directly, keeping the codebase unified and avoiding massive UI rewrite costs, while providing native SQLite and filesystem access bridges.
