# Target Technical Architecture (TARGET_ARCHITECTURE.md)

This document describes the future technical architecture of the upgraded **DeutschFlow** German Learning System.

---

## 1. Architectural Patterns & Strategy

DeutschFlow is designed as a **local-first, offline-capable application** utilizing a modular shared core packaged for multiple target environments.

```
┌────────────────────────────────────────────────────────┐
│                   Presentation / UI                    │
├────────────────────────────────────────────────────────┤
│                  Application Services                  │
├────────────────────────────────────────────────────────┤
│           Learning / Vocabulary / Grammar Core          │
├────────────────────────────────────────────────────────┤
│                 Repository Abstraction                 │
├───────────────────────┬────────────────────────────────┤
│   Platform Adapter    │        Platform Adapter        │
│    (Tauri / Rust)     │      (Capacitor / JS Bridge)   │
├───────────────────────┼────────────────────────────────┤
│    Native SQLite      │         SQLite plugin          │
└───────────────────────┴────────────────────────────────┘
```

### 1.1 Local-First Architecture
*   **Decoupled Sync:** All writes (user study progress, settings updates, vocabulary flag actions) occur instantly to the local storage engine.
*   **Offline Operation:** The core application operates with zero network dependencies. Inbound/outbound cloud synchronization runs asynchronously as a non-blocking background service.

### 1.2 Repository Pattern
*   To prevent the learning engine from depending directly on browser-specific IndexedDB APIs or wrapper libraries, a **Repository Layer** abstracts database operations.
*   The repository layer defines interfaces for data access (e.g., `VocabularyRepository`, `CardRepository`). The core logic interacts only with these interfaces.

### 1.3 Platform Storage Adapters
*   Platform adapters implement the repository interfaces, mapping logical queries to physical platform databases:
    *   **iOS / Android (Capacitor):** Writes to a native SQLite file utilizing wrapper plugins to secure data persistence.
    *   **Desktop (Tauri):** Writes to a native SQLite file utilizing Rust-based Tauri database APIs.
    *   **Web (Standard Browser):** Falls back to browser IndexedDB storage.

---

## 2. Shared Core Subsystems

The application core is divided into independent service boundaries:
1.  **Linguistic & Evaluation Engine:** Evaluates inputs deterministically, correcting spelling variants, capitalization, and punctuation based on strict lexicographical rules.
2.  **SRS & Review Engine:** Manages card states, updates ease/interval metrics, and schedules due reviews.
3.  **Grammar Engine:** Orchestrates dynamic grammar exercise templates (declensions, conjugations) based on parameter rules.
4.  **Audio Engine:** Coordinates cached audio playback, voice recording comparison, and dictation exercises.
5.  **Backup & Portability Engine:** Serializes and deserializes the logical database schema into standard zip/json files for recovery and migration.
6.  **Notification & Reminder Coordinator:** Queries card states and dispatches alarm requests to the platform notification scheduler.
