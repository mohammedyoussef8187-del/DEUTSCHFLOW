# Module Boundaries (MODULE_BOUNDARIES.md)

This document defines the modular directory structure and dependency boundaries of the upgraded **DeutschFlow** application codebase.

---

## 1. Directory Tree Structure

The monolithic `src/app.js` is refactored into distinct, testable directories:

```
src/
├── core/                  # Core JS types, utilities, normalizers, and formatting
├── learning/              # Core state machines, retry queues, and study coordinators
├── vocabulary/            # Lexical item definitions, schemas, and verbs/nouns properties
├── grammar/               # Structured grammar topics, conjugations, and rule models
├── exercises/             # Exercise item generators, templates, and evaluations
├── srs/                   # Card scheduling math, mastery formulas, and rate helpers
├── courses/               # Lesson trees, CEFR levels, and prerequisites mapping
├── progress/              # Progress metrics and mastery accumulation calculations
├── audio/                 # Audio asset handlers, players, and meta mapping
├── pronunciation/         # Microphone input wrappers and recording comparison triggers
├── data/                  # Repository interfaces and logical database controllers
├── backup/                # JSON backup serialization, restore checks, and zip utilities
├── notifications/         # Platform-neutral scheduled alarm triggers
├── platform/              # Platform wrappers (Capacitor adapters, Tauri commands, Web DB fallbacks)
└── ui/                    # UI routes, modal roots, views rendering, and theme engines
```

---

## 2. Dependency Flow and Boundaries

To maintain clean testability, dependencies must flow strictly inward:

```
┌────────────────────────────────────────────────────────┐
│                        ui/                             │
└───────────┬────────────────────────────────────────────┘
            ▼
┌────────────────────────────────────────────────────────┐
│                 learning/ / courses/                   │
└───────────┬───────────────┬────────────────────────────┘
            │               ▼
            │   ┌────────────────────────────────────────┐
            │   │              exercises/                │
            │   └───────────┬────────────────────────────┘
            ▼               ▼
┌────────────────────────────────────────────────────────┐
│             vocabulary/ / grammar/ / srs/              │
└───────────┬────────────────────────────────────────────┘
            ▼
┌────────────────────────────────────────────────────────┐
│                         data/                          │
└───────────┬────────────────────────────────────────────┘
            ▼
┌────────────────────────────────────────────────────────┐
│                platform/ / core/                       │
└────────────────────────────────────────────────────────┘
```

### 2.1 Dependency Rules
1.  **Core Isolation:** Modules in `core/`, `vocabulary/`, `grammar/`, and `srs/` must not import any modules from `ui/` or `platform/`. They must contain only pure JavaScript/ES functions that can be tested in standard Node environments.
2.  **Platform Abstraction:** Modules in `data/` and `notifications/` define abstract adapter interfaces. The actual platform implementations (Capacitor SQLite APIs or Tauri Rust file system commands) are injected at runtime from `platform/`.
3.  **UI Decoupling:** The UI layer renders views based on data returned by learning controllers and dispatches user actions back via application services. No raw SQL or repository code belongs in the `ui/` layer.
4.  **No Circular References:** Modules must maintain hierarchical relationships. Circular imports (e.g. `vocabulary` importing `exercises` which imports `vocabulary`) are strictly prohibited.
5.  **Lit Component Scoping:** Lit Web Components reside strictly within `ui/`. Lit components interact with Application Services (`learning/`, `courses/`, `progress/`), but must NEVER access database repositories (`data/`) or native platform plugins (`platform/`) directly. Non-UI domain modules use standard Vanilla ES Modules.
