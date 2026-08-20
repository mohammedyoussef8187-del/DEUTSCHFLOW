# Mobile-First Implementation Plan (MOBILE_FIRST_IMPLEMENTATION_PLAN.md)

This document defines the canonical, staged implementation roadmap for transforming **DeutschFlow** into a native Mobile-First application (targeting iPad/iPhone and Android) based on the approved architecture.

---

## 1. Implementation Principles

1.  **Mobile-First Focus:** Primary initial targets are iPad / iPadOS, iPhone / iOS, and Android devices. Desktop (Tauri) is deferred.
2.  **No Big-Bang Rewrite:** The current application remains functional throughout migration. Refactoring follows a strict **Protect → Characterize → Isolate → Migrate → Verify → Continue** lifecycle.
3.  **Strict Data Preservation:** All existing user cards, SRS intervals, ease factors, streaks, due dates, favorites, flags, settings, and accepted answers are preserved without progress resets.
4.  **Presentation-Only Lit UI:** Lit Web Components are restricted to UI view rendering. All domain logic, SRS math, answer evaluation, and data access remain in framework-independent ES modules behind repository interfaces.

---

## 2. Implementation Roadmap

| Phase | Objective | Risk | Data Impact | Stop Gate | User Approval Required |
|---|---|---|---|---|---|
| **Phase 1** | Baseline Characterization & Regression Protection | LOW | Read-Only (Zero Impact) | **Gate 0** | YES (before starting Phase 2) |
| **Phase 2** | `app.js` Modularization & Decoupling | MEDIUM | Read-Only (Zero Impact) | **Gate 1** | YES (before starting Phase 3) |
| **Phase 3** | Repository Layer & Storage Abstraction | MEDIUM | Read-Only (Zero Impact) | **Gate 1.5**| YES (before starting Phase 4) |
| **Phase 4** | Data Preservation & Native SQLite Migration | HIGH | Structural Migration (Preserved) | **Gate 2 & Gate 3** | YES (before starting Phase 5) |
| **Phase 5** | Lit Infrastructure & Proof-of-Architecture | LOW | Zero Impact | **Gate 4** | YES (before starting Phase 6) |
| **Phase 6** | Incremental UI Component Migration | MEDIUM | Zero Impact | **Gate 4.5**| YES (before starting Phase 7) |
| **Phase 7** | Mobile Shell & Capacitor Integration | HIGH | Native Mobile Storage Enablement | **Gate 5** | YES (before final release) |
| **Phase 8** | QA, Verification & Mobile Release | LOW | Zero Impact | **Final Gate** | YES (before distribution) |

---

## 3. Detailed Phase Summaries

### Phase 1: Baseline Characterization & Regression Protection
*   **Goal:** Establish an automated test safety net (Vitest) around core functions (`normalizeGerman`, `validateGermanAnswer`, SRS calculations, Levenshtein distance) using a golden test dataset.
*   **Key Rule:** Zero modification to runtime application files (`src/app.js`).

### Phase 2: `app.js` Modularization & Decoupling
*   **Goal:** Extract monolithic IIFE code from `src/app.js` into standalone ES modules (`src/core/`, `src/srs/`, `src/exercises/`).
*   **Key Rule:** Pure structural extraction without changing algorithm logic.

### Phase 3: Repository Layer & Storage Abstraction
*   **Goal:** Introduce repository interfaces (`VocabularyRepository`, `CardRepository`) backed initially by an IndexedDB adapter.
*   **Key Rule:** Application logic interacts solely through repository methods.

### Phase 4: Data Preservation & Native SQLite Migration
*   **Goal:** Implement `@capacitor-community/sqlite` adapter and run transactional data migration from IndexedDB to SQLite.
*   **Key Rule:** Hard Stop Gate (Gate 2). Require verified JSON export and parity check before switching storage drivers.

### Phase 5: Lit Infrastructure & Proof-of-Architecture
*   **Goal:** Set up Lit dependency and build tooling; convert 1 small isolated UI component (`df-status-pill`) to prove Lit integration.
*   **Key Rule:** Must not alter study session views or domain logic.

### Phase 6: Incremental UI Component Migration
*   **Goal:** Gradually migrate UI screens from legacy template strings to Lit components in order of risk (Settings → Modals → Vocab Cards → Answer Input → Study Session).

### Phase 7: Mobile Shell & Capacitor Integration
*   **Goal:** Integrate Capacitor wrappers for iOS/iPadOS and Android, implementing iPad split layouts, safe areas, touch targets, native SQLite, microphone recording, and local notifications.

### Phase 8: Quality Assurance, Verification & Mobile Release
*   **Goal:** Conduct cross-device verification on physical iPads, iPhones, and Android devices, confirming offline capability, data persistence, and UI performance.
