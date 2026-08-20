# Potential Issues (POTENTIAL_ISSUES.md)

This log contains all **Potential Issues (Classification B)** that require further verification or may present structural weaknesses in the DeutschFlow application.

---

### Issue 1: Performance Lag in Word Bank Rendering
*   **Component/File:** `src/app.js` (lines 1150–1160, `renderWords`)
*   **Evidence:** The rendering engine generates raw HTML strings for up to 200 vocabulary entries at a time and updates the DOM innerHTML.
*   **Impact:** Performance lag on mobile devices. Scrolling or updating filters for thousands of vocabulary words in DOM without virtualization or deferred rendering will cause layout stutters.
*   **Recommended Action:** Implement list virtualization or infinite scrolling in chunks of 30 items.
*   **Priority:** P2

---

### Issue 2: IndexedDB Blocked Event Crash Loop
*   **Component/File:** `src/app.js` (line 496, `open`)
*   **Evidence:** `req.onblocked = () => reject(new Error("قاعدة البيانات مفتوحة في تبويب آخر..."))`
*   **Impact:** On iOS Safari, multi-tab usage or quick reload cycles frequently trigger IndexedDB block events. Rejecting the promise without a graceful retry or UI prompt can lock the app into crash states.
*   **Recommended Action:** Add a database connection timeout/retry loop and alert the user to close extra tabs before rejecting.
*   **Priority:** P1

---

### Issue 3: XLSX Column Mapping Fragility
*   **Component/File:** `src/app.js` (line 1020, `mapRows`)
*   **Evidence:** Column indices are located using a regex find check: `de = find(/ألماني|الماني|german|deutsch|الكلمة/i)`.
*   **Impact:** If the user imports a spreadsheet that uses slightly different headers (e.g. `"De"` instead of `"deutsch"` or `"المفردة"` instead of `"الكلمة"`), the index returns `-1`, resulting in invalid rows or partial data mapping errors.
*   **Recommended Action:** Implement a manual header-mapping step in the import preview modal if automated regex matching fails.
*   **Priority:** P2

---

### Issue 4: Stale Cache via Service Worker
*   **Component/File:** `sw.js`
*   **Evidence:** Cache-First fetch intercept with no explicit programmatic check to notify the user of background updates.
*   **Impact:** The user will continue to run old versions of the app indefinitely after updates are pushed to the server, unless they hard-refresh the page.
*   **Recommended Action:** Implement a service worker update notification popup in the UI when a new cache version is activated.
*   **Priority:** P1
