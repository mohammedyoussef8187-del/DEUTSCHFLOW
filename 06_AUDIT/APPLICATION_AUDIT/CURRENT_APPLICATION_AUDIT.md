# Current Application Audit (CURRENT_APPLICATION_AUDIT.md)

This document provides a detailed evidence-based audit of the **DeutschFlow** baseline application architecture, subsystems, and features.

---

## 1. Executive Findings Summary
*   **Monolithic JavaScript:** The codebase `src/app.js` is a single, monolithic 120 KB file containing all UI, business logic, storage, and file decompression logic.
*   **UI-Only and Missing Features:** Several features represented in the Settings UI or DEFAULT_SETTINGS are stubbed out or completely absent:
    *   **Audio Playback:** **ABSENT**. There is no audio file loading, playing, caching, or TTS engine in the code.
    *   **Difficulty Modes:** **LOCKED**. Statically rendered as "Hard+" with no UI select element to modify it.
    *   **Daily Goals:** **UI ONLY**. Input field exists, but its value is never used or displayed.
    *   **Sentence-Order Practice:** **DISABLED**. Blocked from review queues by default in Hard mode.
*   **Testing Coverage:** **0%**. There are no automated testing pipelines, unit tests, integration tests, or lint checks in the codebase.
*   **English Language Support:** **0%**. English is not defined in the seed dictionary schema, and there is no UI element to toggle or retrieve English translations.

---

## 2. Core Subsystems Detailed Audit

### 2.1 Storage and Data Pipeline
*   **IndexedDB Implementation:** Custom, vanilla-coded promises using standard request event handlers (`onsuccess`, `onerror`). It handles schema migration and bulk puts/deletions.
*   **Seed Loading Flow:** Database initialization checks if any vocabulary records exist. If empty, it attempts to load in-memory seed records from `data/seed-data.js` (an array of 2,820 objects).
*   **Legacy Intake:** Check for database `german_vocab_std`. If present, parses and imports old data structure automatically.

### 2.2 Learning & Spaced Repetition (SRS) Engine
*   **Supported Skills:** `recall` (Arabic -> German typing), `recognition` (German -> Arabic typing), `article` (der/die/das selection or typing), `order` (sentence token ordering).
*   **Automated Scoring suggestion:** The engine scores response accuracy at the moment of submission (`automaticRating`). It assigns suggestions:
    *   `1` (Again): incorrect/skipped.
    *   `2` (Hard): correct answer, but used a hint, had minor typo/casing differences, or took > 18 seconds.
    *   `4` (Easy): perfect answer in under 7 seconds.
    *   `3` (Good): default correct answer.
*   **Manual Rating:** If correct, the user chooses difficulty (صعب, جيد, سهل). If incorrect, they can only proceed via the "ثبت الخطأ وأعدها" (1) rating.
*   **Due Date calculation:** Review intervals are calculated using the easement factor (`ease`) and repetition count (`reps`):
    *   Rep 1: 1 day (Hard/Good) or 3 days (Easy).
    *   Rep 2: 2 days (Hard), 4 days (Good), or 7 days (Easy).
    *   Rep 3+: Interval = Math.round(Interval * EaseFactor).
*   **Mastery Math:** Card mastery combines reps, interval length, streak count, and lapses penalty. Word mastery is a weighted average of active card masteries.

### 2.3 Grading & Normalization Subsystem
*   **German Normalization:** Lowercases, normalizes NFC diacritics, and strips punctuation. Optionally folds umlauts (`ä` -> `ae`, etc.) and `ß` -> `ss` based on settings.
*   **Article Checking:** Split article from noun rest. If `requireArticle` setting is active:
    *   Noun entered without article: incorrect ("article_missing", score 0.35).
    *   Noun entered with wrong article: incorrect ("article_wrong", score 0.25).
*   **Arabic Normalization:** Strips Arabic diacritics (harakat), normalizes letters (أ/إ/آ -> ا, ى -> ي, ة -> ه), and strips punctuation.
*   **Typo Tolerance:** Uses Levenshtein calculation. If the distance is within typo limits (1 for short words, 2-4 for longer), it flags a `"minor_typo"`.
    *   **CRITICAL RULE DEFECT:** Even though a typo is categorized as a "minor_typo", `isCorrect` is marked as `false` in the result payload, failing the card.

### 2.4 Import/Export/Backup Engine
*   **XLSX Decompression:** Uses native `DecompressionStream` with the `'deflate-raw'` parameter to unzip xlsx files.
*   **XML Parsing:** Custom `DOMParser` queries worksheet rows and sharedStrings. Maps columns based on header search regexes.
*   **JSON Backup:** Exports all stores as a single JSON object. Restoring simply clears all tables and populates them with import payloads.

### 2.5 UI & Event Handling
*   **Rendering Flow:** Single monolithic `render(state)` method that updates `#app` innerHTML on view routing changes.
*   **Event Routing:** Attaches single click event handler to window (`window.addEventListener("click", ...)`). Routes UI actions based on elements containing `data-action`.
