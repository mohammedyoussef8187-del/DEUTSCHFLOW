# Application Feature Inventory (APPLICATION_FEATURE_INVENTORY.md)

This document provides a comprehensive catalog of all features detected in the **DeutschFlow** baseline application.

---

## 1. Feature Map and Implementation Status

The following catalog lists all major capabilities, their implementation status, UI entry points, and source files.

| Feature Name | UI Entry Point | Implementation Files | Stored Data Involved | Current Status | User Purpose | Known Limitations |
|---|---|---|---|---|---|---|
| **Dashboard** | Home page | `src/app.js` | `words`, `cards`, `meta:profile` | **IMPLEMENTED** | Show daily summary and start study sessions. | Layout is simple and has no long-term progression chart. |
| **Review Session** | "تعلّم" bottom tab | `src/app.js` | `words`, `cards`, `attempts`, `meta:session` | **IMPLEMENTED** | Execute study sessions (daily, new, due reviews). | Queue state machine is monolithic and complex to verify. |
| **Word Bank** | "الكلمات" bottom tab | `src/app.js` | `words`, `cards` | **IMPLEMENTED** | List all vocabulary, view status, edit entries. | Renders as a long list; uses basic paging (limit 200). |
| **Add Word** | "+" floating button in Word Bank | `src/app.js` | `words` | **IMPLEMENTED** | Manually input new German/Arabic words into curriculum. | ID calculation is local Max(id)+1, which could clash on sync. |
| **Search** | Input box in Word Bank | `src/app.js` | `words` | **IMPLEMENTED** | Query vocabulary by German or Arabic text. | Search is matching-based; lacks fuzzy search support. |
| **Filters** | Tabs/pills in Word Bank | `src/app.js` | `words`, `cards` | **IMPLEMENTED** | Filter list by categories (all, favorites, due, nouns, etc.). | Hardcoded filter options; cannot create custom filters. |
| **Statistics** | "الإحصائيات" bottom tab | `src/app.js` | `attempts`, `words`, `cards` | **IMPLEMENTED** | Review performance metrics and taxonomy of errors. | Limited to last 30 days; no long-term historical charts. |
| **Progress** | Study header | `src/app.js` | `meta:session` | **IMPLEMENTED** | View progress bar and number of pending retries. | Progress bar is simple and doesn't count retry loops. |
| **Daily Goals** | Settings input | `src/app.js` | `meta:settings` | **UI ONLY** | Set desired daily review points (default 25). | **Incomplete:** The setting is saved but never rendered or tracked in the dashboard. |
| **Session Size** | Settings input | `src/app.js` | `meta:settings` | **IMPLEMENTED** | Set review session queue length (default 20). | Constrained to local session creation only. |
| **Review Scheduling** | Auto rating / Rating buttons | `src/app.js` | `cards` | **IMPLEMENTED** | Update due dates and intervals based on review results. | Custom scheduling formula; lacks standard FSRS configuration. |
| **Favorites** | Star icon in lists and edit form | `src/app.js` | `words` | **IMPLEMENTED** | Mark items for quick reference or dedicated filter study. | Simple boolean flag; no multiple lists support. |
| **Ignore** | Ignored toggle in edit form | `src/app.js` | `words` | **IMPLEMENTED** | Exclude words from active session schedules. | Excluded items remain in memory array. |
| **User Flagging** | Flag button on incorrect answer | `src/app.js` | `words` | **IMPLEMENTED** | Mark entry as corrupted and move it to quality queue. | Automatically ignores/quarantines flagged items. |
| **Pronunciation Display** | Intro screen and details | `src/app.js` | `words`, `meta:settings` | **IMPLEMENTED** | Display phonetic pronunciation helper in Arabic text. | Uses static Arabic letters; lacks IPA or phonetic standards. |
| **Audio Playback** | Settings input (unused) | `src/app.js` | `meta:settings` | **NOT IMPLEMENTED** | Auto-play pronunciation audio for learning. | **UI Only:** Config exists but no actual audio playback logic is implemented. |
| **Recognition Testing** | Review prompt (German) | `src/app.js` | `words`, `cards`, `attempts` | **IMPLEMENTED** | Test German-to-Arabic meaning recall by direct typing. | No multiple-choice meaning options exist. |
| **Recall Testing** | Review prompt (Arabic) | `src/app.js` | `words`, `cards`, `attempts` | **IMPLEMENTED** | Test Arabic-to-German vocabulary recall by direct typing. | Very strict on typos, though basic Levenshtein limit exists. |
| **Article Testing** | Review prompt (Noun) | `src/app.js` | `words`, `cards`, `attempts` | **IMPLEMENTED** | Type or choose correct gender article (der/die/das). | Locked to direct typing in Hard mode (no choice buttons). |
| **Sentence Testing** | Review prompt (Sentence) | `src/app.js` | `words`, `cards`, `attempts` | **PARTIALLY IMPLEMENTED**| Arrange scrambled German tokens into a complete sentence. | **Disabled:** Filtered out under default locked Hard mode. |
| **Spelling Tolerance** | Validator calculation | `src/app.js` | `meta:settings` | **IMPLEMENTED** | Tolerate minor spelling mistakes using Levenshtein distance. | Typos are flagged but still marked as *incorrect* (score 0.45). |
| **Umlaut Tolerance** | Validator calculation | `src/app.js` | `meta:settings` | **IMPLEMENTED** | Accept "ae/oe/ue" and "ss" as substitutes for ä/ö/ü/ß. | Works correctly, applying a 0.88 scoring weight. |
| **Arabic Normalization**| Validator calculation | `src/app.js` | `meta:settings` | **IMPLEMENTED** | Strip diacritics and normalize alif/ya/ta-marbuta. | Arabic is fully normalized during input evaluation. |
| **Accepted Answers** | Edit textareas | `src/app.js` | `words` | **IMPLEMENTED** | Store alternative correct spellings for vocabulary. | Must be manually populated line-by-line. |
| **Difficulty Modes** | Settings text | `src/app.js` | `meta:settings` | **UI ONLY** | Toggle study difficulty settings. | Locked statically to Hard+ mode; no selection input exists. |
| **Import System** | XLSX/CSV button in settings | `src/app.js` | `words` | **IMPLEMENTED** | Import vocabulary from local spreadsheets fully client-side. | Custom ZIP/XML parser is fragile and lacks schema check. |
| **Export System** | CSV button in settings | `src/app.js` | `words` | **IMPLEMENTED** | Export vocabulary data as a UTF-8 CSV download. | Basic export only; does not export full attempt logs. |
| **Backup System** | JSON button in settings | `src/app.js` | `words`, `cards`, `attempts`, `meta` | **IMPLEMENTED** | Download complete IndexedDB database as a JSON backup. | Backup file name is hardcoded. |
| **Restore System** | Restore button in settings | `src/app.js` | `words`, `cards`, `attempts`, `meta` | **IMPLEMENTED** | Restore JSON backup file, fully replacing active database. | Overwrites current database immediately after import. |
| **Themes** | Settings page | `src/app.js` | `meta:settings` | **IMPLEMENTED** | Toggle dark/light/system theme layouts. | Modifies document dataset attributes and meta color headers. |
| **Data Quality Audit** | Quality modal / Word list | `src/app.js` | `words` | **IMPLEMENTED** | Flag structural data issues using predefined regex patterns. | Displays issues in settings modal; lacks bulk-fix tools. |
