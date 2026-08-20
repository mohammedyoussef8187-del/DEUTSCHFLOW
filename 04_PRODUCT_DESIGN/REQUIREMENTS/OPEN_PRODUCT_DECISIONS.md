# Open Product Decisions (OPEN_PRODUCT_DECISIONS.md)

This document lists key product, technical, and architectural decisions that require user approval before proceeding with database schema and software implementation.

---

## Decision 1: Multi-Platform Packaging Architecture
*   **Status:** APPROVED WITH CONDITION
*   **Condition:** Production native installations (mobile and desktop) must not rely on browser IndexedDB as the sole persistence layer due to OS deletion risks. A durable native persistence layer (such as SQLite or equivalent) must be evaluated under a repository abstraction in the technical architecture phase.
*   **Context:** DeutschFlow must support installation across iOS, Android, Windows, macOS, Linux, and Web browsers, reusing the same application core and learning logic.
*   **Options:**
    1.  **PWA-Only Approach:** Deploy as a standard Progressive Web App.
    2.  **Shared Web App + Capacitor (Mobile & Web):** Build a responsive web app wrapped with Capacitor for mobile deployment (iOS/Android) and run via browser for desktop.
    3.  **Shared Web App + Capacitor (Mobile) + Tauri (Desktop):** Build a unified web application core and wrap it with Capacitor for mobile and Tauri (Rust-based webview) for native desktop executables.
*   **Impact:** Option 3 ensures native installation wrappers for all environments, providing persistent sandbox storage that prevents the OS from deleting the local IndexedDB database (critical on iOS, where Safari automatically purges sandboxed data after 7 days of inactivity).
*   **Recommendation:** **Option 3 (Shared Web App + Capacitor Mobile + Tauri Desktop)**. It maximizes code reuse while guaranteeing data safety and native store readiness on all target platforms.
*   **Why Approval is Required:** Directly impacts build complexity, SDK requirements (Xcode, Android Studio, Rust compile tools), and deployment workflows.

---

## Decision 2: Cross-Device Synchronization Strategy
*   **Status:** APPROVED WITH STAGED IMPLEMENTATION
*   **Condition:** Staged approach: baseline release utilizes manual JSON backup/restore (which remains a permanent product capability). Target future release is Central Cloud Sync. Peer-to-peer Wi-Fi sync is rejected. The database schema must be designed as sync-ready from the start (requiring globally unique record IDs, modification timestamps, versioning, and tombstone handling). Cloud sync implementation is NOT approved for the current phase.
*   **Context:** Learners want to study across multiple devices (e.g., iPhone during transit, laptop at home) without losing progress.
*   **Options:**
    1.  **No Automated Sync (Manual Backup Portability):** Users export a JSON database backup from device A and import it to device B manually.
    2.  **Peer-to-Peer Sync (Local Network):** Direct peer sync over Wi-Fi when both devices are open on the same local network.
    3.  **Central Cloud Sync (Incremental Sync API):** Sync changes incrementally via a lightweight REST backend.
*   **Impact:** Options 1 and 2 require no server infrastructure, preserving the offline-first serverless architecture. Option 3 requires a centralized backend server and sync logic to resolve merge conflicts in SRS intervals, but offers the smoothest user experience.
*   **Recommendation:** **Option 1 (Manual JSON Backup Portability)** as the baseline, with an architectural roadmap to support **Option 3 (Central Cloud Sync)** in a later phase.
*   **Why Approval is Required:** Determines whether the application remains entirely serverless/static or requires a centralized sync backend database.

---

## Decision 3: Cloud Account Requirement vs. Local-Only Mode
*   **Status:** APPROVED WITH STAGED IMPLEMENTATION
*   **Condition:** Optional cloud account, default local-only/offline-first. No mandatory sign-up, registration, or internet connection required for core learning features (vocabulary, grammar, SRS cards, local stats, backup/restore). Future optional accounts are strictly for cloud synchronization and recovery. Local anonymous profiles must be durable and support seamless guest-to-account migration without losing history or progress. Authentication providers are not selected, and implementation is NOT approved for this phase.
*   **Context:** Accessing cloud features requires user identification.
*   **Options:**
    1.  **Cloud Account Mandatory:** Users must sign up (email, social login) before using the application.
    2.  **Optional Cloud Account (Default Local-Only):** The application is fully functional upon installation with local data storage. Users can opt-in to create an account for cloud backup and sync.
    3.  **Strictly Local-Only (Anonymous):** No account capabilities exist. Data remains entirely on the device.
*   **Impact:** Option 2 ensures maximum privacy and lets users test the app instantly, while providing a clear upgrade path for users who want multi-device synchronization.
*   **Recommendation:** **Option 2 (Optional Cloud Account, Default Local-Only)**.
*   **Why Approval is Required:** Impacts onboarding design, user data privacy compliance (GDPR/CCPA), and account management scope.

---

## Decision 4: AI-Assisted Answer Evaluation Policy
*   **Context:** For complex sentence creation, writing prompts, or translation exercises, literal spelling validators (`validateGermanAnswer`) fail to grade correct semantic variations.
*   **Options:**
    1.  **No AI Grading (Strict Literal Match):** Grade answers strictly against list of predefined `acceptedAnswers`.
    2.  **Local/On-Device AI Grading (WebNN / Local Models):** Use on-device small language models or web APIs to evaluate semantic equivalence.
    3.  **Cloud AI API Grading (Centralized LLM):** Send answers to a cloud API (e.g. Gemini API) for semantic grading and feedback.
*   **Impact:** Option 1 is 100% offline-compatible and has zero operational cost but is rigid. Option 3 is highly flexible but breaks offline functionality and incurs API request costs.
*   **Recommendation:** **Option 1 (Strict Predefined Literal Matches)** as the primary grading engine, with a fallback to display alternative hints. Avoid cloud LLM grading for core card scoring to maintain offline integrity.
*   **Why Approval is Required:** Affects offline usability, operational costs, and pedagogical trust in the scoring engine.

---

## Decision 5: Speaking/Pronunciation Feature Scope
*   **Context:** Incorporating oral practice is requested for the target German Learning System.
*   **Options:**
    1.  **Out of Scope:** Exclude voice recording and pronunciation checks.
    2.  **Self-Evaluation (Audio Recording Only):** The app records the user's voice and plays it back alongside the native speaker track, allowing the user to self-assess.
    3.  **Automated Pronunciation Scoring (STT / Web Speech API):** Use the browser/OS Speech Recognition API to verify if the user pronounced the target word correctly.
*   **Impact:** Option 3 requires microphone permission handling and is subject to device Speech-to-Text accuracy, which is notoriously inconsistent on older mobile browsers. Option 2 provides high learning value with zero API fragility.
*   **Recommendation:** **Option 2 (Self-Evaluation Playback)** as the immediate implementation, with **Option 3** as an experimental feature toggled in settings.
*   **Why Approval is Required:** Determines permission requirements (microphone access consent) and the technical scope of browser Web Speech API integrations.

---

## Decision 6: Notification and Review Reminder Policy
*   **Context:** Daily practice reminders increase user retention and consistency.
*   **Options:**
    1.  **No Notifications:** Rely entirely on user initiative.
    2.  **Web Push Notifications (PWA):** Send push reminders via service worker subscriptions.
    3.  **Native Local Notifications:** Schedule local reminders native to the OS (via Capacitor/Tauri wrapper APIs) without needing a push server.
*   **Impact:** Option 3 works completely offline and respects user privacy, while Option 2 requires a running push service and is notoriously blocked or unsupported on iOS Safari PWAs.
*   **Recommendation:** **Option 3 (Native Local Notifications)** managed by the app wrapper.
*   **Why Approval is Required:** Influences native wrapper plugin permissions (notifications prompt) and offline scheduling logic.
