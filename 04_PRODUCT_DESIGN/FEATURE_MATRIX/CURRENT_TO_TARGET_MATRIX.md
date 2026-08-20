# Current to Target Feature Matrix (CURRENT_TO_TARGET_MATRIX.md)

This matrix compares the current capabilities of the baseline DeutschFlow application with the target state of the upgraded German Learning System.

---

## 1. Feature Transition Matrix

| Capability | Current State | Target State | Preserve | Modify | Add | Priority |
|---|---|---|---|---|---|---|
| **Active Recall (DE)** | Arabic prompt -> user types German. Graded and scored. | English/Arabic context prompt -> user types German. Graded and scored. | Core validator logic. | Support English prompts as primary; decouple Arabic from scoring. | - | P1 |
| **Recognition (AR)** | German prompt -> user types Arabic meaning. Graded and scored. | German prompt -> user types Arabic meaning (optional self-test). Non-scoring. | - | Change to non-scoring; use exclusively for semantic annotations. | - | P1 |
| **Active Recall (EN)** | **Absent** - No English vocabulary definitions exist. | German prompt -> user types English (and vice versa). Graded and scored. | - | - | Add `english` fields to schema and scored English recall cards. | P1 |
| **Spaced Repetition (SRS)** | Custom scheduler updating intervals using ease factors and reps. | Standardized, robust scheduling (such as FSRS or improved ease scheduler). | Core card table relationships. | Upgrade mathematical formulas for cleaner stability scaling. | - | P2 |
| **Sentence Syntax** | Token ordering exists but is disabled in default Hard mode. | Interactive scrambled token ordering integrated in review session queues. | Core token-bank HTML structure. | Enable and balance in session queue; support complex clause sub-structures. | - | P2 |
| **Noun Article Testing** | Direct typing of article ("der", "die", "das") in Hard mode. | Typed article input with feedback + option to test plural endings. | Typed input validation. | - | Add plural inflection testing for nouns. | P2 |
| **Listening & Audio** | **UI Only** - Config setting exists, but no audio playback code. | Native media player caching and playing MP3 textbook audio files. | - | - | Play audio during introductions and after input grading; cache files. | P1 |
| **Grammar Practice** | **Absent** - No grammar training features exist. | Interactive grammar training (case declensions, verb conjugations). | - | - | Coded templates for case endings and verb tables. | P1 |
| **Course Progression** | Tag-based vocabulary listing; no lessons or unlocking logic. | Structured CEFR unit and lesson hierarchies with sequential unlocks. | Level metadata tags. | - | Lesson selector views and unlock progress tracking. | P1 |
| **Data Quality Check** | Automated audits on startup/import detecting syntax errors. | Visual review queue highlighting conflicting definitions or bad rows. | Auditing algorithms. | Improve layout review screens in Settings/Word Bank. | - | P2 |
| **Import / Export** | XLSX/CSV client-side unzip & parse; CSV export. | XLSX/CSV parsing with schema checks; full JSON backup/restore exports. | Custom unzip engine. | Robust validator checking import columns. | - | P2 |
| **UI Aesthetics** | Monolithic RTL layout with dark/light themes. | Premium layout, smooth animations, correct keyboard-fit adjustments. | Core color themes. | Refactor components into clean module interfaces. | - | P2 |
| **Installability** | PWA-only deployment (Safari/Chrome installable). | Native-wrapped packaging for iOS/Android/Desktop from one core. | Web-access features. | - | Native package configurations (Capacitor/Tauri wrappers). | P1 |
| **Speaking & Voice** | **Absent** - No voice analysis exists. | Voice recorder/evaluator to test user pronunciation (future phase). | - | - | Optional microphone permission request and speech API integration. | P3 |
