# Confirmed Defects (CONFIRMED_DEFECTS.md)

This log contains all **Confirmed Defects (Classification A)** identified in the DeutschFlow application code or data.

---

### Defect 1: Typos Treated as Failure in Grading
*   **Component/File:** `src/app.js` (lines 174–176, `validateGermanAnswer`)
*   **Current Behavior:** When the user types an answer with minor spelling mistakes (within Levenshtein threshold), the system flags the result type as `"minor_typo"`. However, the response payload sets `isCorrect: false`.
*   **Impact:** Typos fail the card completely, resetting the SRS repetition count, lapses, and ease, which causes user frustration and scheduling regression.
*   **Recommended Action:** Change grading to treat `"minor_typo"` as correct, but apply a minor ease/mastery penalty (suggesting Hard rating).
*   **Priority:** P1

---

### Defect 2: Daily Goals Setting is a Dead End
*   **Component/File:** `src/app.js` (line 21, `DEFAULT_SETTINGS` / line 1181, `renderSettings`)
*   **Current Behavior:** The settings page displays an input field for the "Daily Goal" value. However, this parameter is never referenced or rendered in the dashboard, study home, or stats views.
*   **Impact:** UI clutter. The user configures a goal that has zero operational impact on the application flow.
*   **Recommended Action:** Implement daily goal progress calculation in the dashboard or statistics page.
*   **Priority:** P2

---

### Defect 3: Locked Difficulty Setting
*   **Component/File:** `src/app.js` (line 24, `DEFAULT_SETTINGS` / line 1182, `renderSettings`)
*   **Current Behavior:** The difficulty parameter is defined in settings, but the Settings UI renders the level as a static text pill `"Hard+"` without any select or toggle controls.
*   **Impact:** The user cannot switch difficulty mode, making the setting functionally useless and misleading.
*   **Recommended Action:** Expose a dropdown selector for difficulty modes (Easy/Medium/Hard) and update validator rules accordingly.
*   **Priority:** P2

---

### Defect 4: Local Word ID Generation Clash Risk
*   **Component/File:** `src/app.js` (line 1288, `openWordModal` submit handler)
*   **Current Behavior:** Adding a new word assigns it an ID calculated as `Max(existing_ids) + 1`.
*   **Impact:** High data collision risk. If the user imports records or syncs multiple databases, duplicate IDs will overwrite vocabulary or create corrupt references.
*   **Recommended Action:** Use a cryptographic uuid or secure namespace identifier (e.g. `makeId("w")`) instead of sequential integers for new custom items.
*   **Priority:** P1

---

### Defect 5: Broken Legacy Codex Branch
*   **Component/File:** `01_APPLICATION/LEGACY_APP/Codex-v4.1.0/`
*   **Current Behavior:** The folders and files inside the Codex branch are missing the actual split module files inside the `src/` folder, leaving it broken.
*   **Impact:** Code regression. The legacy branch cannot be used for reference or historical comparison.
*   **Recommended Action:** Flag the folder as broken in the architecture index and rely purely on `01_APPLICATION/CURRENT_APP/` as the baseline.
*   **Priority:** P2
