# Target Testing Architecture (TARGET_TESTING_ARCHITECTURE.md)

This document defines the automated test architecture, coverage targets, and boundaries for the upgraded **DeutschFlow** application.

---

## 1. Testing Pyramid & Boundaries

The modular refactoring enables isolated testing across three distinct boundaries:

```
                  ┌──────────────────────┐
                  │  End-to-End Tests    │  <-- Playwright / Appium
                  │  (User interactions) │
                  ├──────────────────────┤
                  │  Integration Tests   │  <-- SQLite / DB Migrations /
                  │  (DB, serialization) │      JSON Backup restore
                  ├──────────────────────┤
                  │     Unit Tests       │  <-- Jest / Vitest (Pure JS code)
                  │  (Grading, SRS math) │
                  └──────────────────────┘
```

---

## 2. Testing Levels and Scope

### 2.1 Unit Tests (Pure JavaScript Logic)
*   **Target Components:** `core/normalizers`, `srs/scheduler`, `exercises/evaluation`.
*   **Execution Environment:** Standard Node runner (Vitest or Jest) with zero browser mock dependencies.
*   **Key Test Suites:**
    *   `grading_validator.test.js`: Validates typo boundaries, umlaut substitutions, case normalization, and strict article checks.
    *   `srs_math.test.js`: Confirms that ease factor limits and review intervals compute correctly across different rating combinations (Again, Hard, Good, Easy).

### 2.2 Integration Tests (Database & Business Logic)
*   **Target Components:** `data/repositories`, `backup/serializer`, `database/migrations`.
*   **Execution Environment:** Node running memory-isolated SQLite connections (`:memory:`).
*   **Key Test Suites:**
    *   `database_migration.test.js`: Confirms that database upgrades apply sequentially and roll back safely on failure.
    *   `backup_restore.test.js`: Serializes a mock database to JSON and reads it back, validating data parity.

### 2.3 End-to-End Tests (Platform Wrappers & UI)
*   **Target Components:** Platform wrapper scripts (Capacitor webviews, Tauri windows).
*   **Execution Environment:** Playwright runner targeting emulator viewports.
*   **Key Test Suites:**
    *   `study_session_flow.test.js`: Simulates completing a vocabulary review session, grading responses, and checking streak status updates.
    *   `offline_launch.test.js`: Verifies the PWA launches and loads curriculum databases when network connections are disabled.
