# Target Product Requirements (TARGET_PRODUCT_REQUIREMENTS.md)

This document defines the product, educational, and technical requirements for the upgraded **DeutschFlow** German Learning System.

---

## 1. Core Product Vision & Scope
DeutschFlow is transitioning from a basic vocabulary trainer into a structured **German Learning System**. The upgraded product must cover:
1.  **Vocabulary:** Spaced Repetition System (SRS) reviews with active recall and recognition modes.
2.  **Grammar:** Interactive, model-driven grammar exercises (cases, conjugation, tenses, word order) moving beyond static text explanations.
3.  **Course Progression:** Structured curriculum aligned with CEFR levels (A1, A2, B1, etc.) and Netzwerk textbook chapters.
4.  **Audio & Listening:** Media playback for pronunciation, listening comprehension, and dictation exercises.
5.  **Multi-Language Support:** Equal educational importance for Arabic and English definitions, annotations, and explanations.

---

## 2. P1 Core Requirement: Multi-Platform Installability

The upgraded DeutschFlow must operate as a unified, installable multi-platform product.

### 2.1 Multi-Platform Target Environments
*   **iOS / iPadOS:** Native-like touch application on iPhone and iPad.
*   **Android:** Touch application on Android phones and tablets.
*   **Desktop / Laptop:** Installation on Windows, macOS, and Linux.
*   **Web Access:** Accessible via standard web browsers.

### 2.2 Operational and Layout Principles
*   **Unified Codebase:** A single shared application core, learning engine, database schema, and validation logic. Divergence between platforms must be avoided unless required by the OS.
*   **Responsive Layouts:** Adaptation across phone aspect ratios, tablet views, split-screens, and large desktop screens.
*   **Mobile Keyboard Adaptability:** Support correct scroll-fit-viewport and visibility when mobile on-screen keyboards (German and Arabic layouts) are active.
*   **Touch and Keyboard Input:** Support touch tap/swipe patterns for mobile and full keyboard shortcuts (enter to submit, space to check, numbers 1-4 for ratings) for desktop.
*   **Data Portability:** Explicit JSON database backup and restore logic to easily transfer user progress, review history, settings, and learning stats between platforms.

### 2.3 Offline Operation Constraint
Core learning features must operate without a permanent network connection:
*   Offline vocabulary study and review.
*   Offline access to locally stored grammar lessons and interactive exercises.
*   Local SRS interval calculations and due date scheduling.
*   Local audio playback and progress log writing.
*   *Note: Internet-dependent features (like database sync or downloading new courses) must degrade gracefully when network is absent.*

### 2.4 Device Integrations and Permissions
*   **Audio Playback:** Local caching and playing of MP3 audio tracks (Kursbuch and Übungsbuch).
*   **File Access:** Permission to read and write files during backup JSON restore/exports and CSV vocabulary imports.
*   **Microphone Access:** Optional permission model for future speech/pronunciation analysis modules.
*   **Reminders & Notifications:** Native review triggers to remind users of due cards.
*   **Storage Lifespans:** Storage mechanisms must prevent the operating system from deleting local IndexedDB database records during low-disk cleaning cycles (critical on iOS).

---

## 3. Multi-Platform Implementation Frameworks Evaluation

The framework choice for compiling DeutschFlow is currently an **Open Decision**. Below is a detailed technical evaluation comparing appropriate approaches.

### Framework Options Comparison Matrix

| Criteria | Option A: PWA-Only | Option B: Web + Capacitor | Option C: Web + Capacitor (Mobile) + Tauri (Desktop) | Option D: React Native / NativeScript |
|---|---|---|---|---|
| **Description** | Single-page Progressive Web App hosted on static servers. | Web core packaged as native mobile wrapper via Capacitor. | Capacitor packaging for iOS/Android; Rust-based Tauri wrapper for desktop. | Re-write the UI layer using native component bridges. |
| **Reuse of Current Code** | **Excellent (95%)** - Uses existing JS, HTML, and CSS directly. | **Excellent (90%)** - Uses existing JS/HTML/CSS inside wrapper. | **Excellent (90%)** - Uses existing web core inside native wrappers. | **Poor (20%)** - Requires rewriting the entire UI and DOM logic. |
| **iOS / Android Support** | Good (runs in browser, installable via Safari/Chrome share menu). | **Excellent** - Compiles to native IPA/APK packages. | **Excellent** - Compiles to native IPA/APK packages. | **Excellent** - Fully native iOS/Android components. |
| **Windows/macOS Support** | Fair (installable via Chrome/Edge). | Poor (desktop wrappers are not standard for Capacitor). | **Excellent** - Tauri packages compile to native desktop binaries. | Good (via React Native Desktop, but adds high complexity). |
| **Offline Capability** | Good (Service Worker caching). | **Excellent** - Core assets are bundled locally inside the native package. | **Excellent** - Web assets are embedded inside the executable package. | **Excellent** - Fully local native app architecture. |
| **Filesystem Access** | Limited (Sandboxed browser downloads/file pickers). | Good (via Capacitor File System APIs). | **Excellent** - Tauri provides full native OS filesystem access. | **Excellent** - Full native OS filesystem APIs. |
| **Microphone & Audio** | Browser-dependent Web Audio and MediaRecorder APIs. | Stable (via Capacitor plugins mapping to native APIs). | Stable (Tauri native integrations & system webview support). | Native OS audio/media streams. |
| **Update Process** | **Instant** - Updates automatically on service worker cache refresh. | Store release required for native code; OTA updates for web assets. | Store release for mobile; auto-updater configuration for desktop. | App Store/Play Store binary upgrades required. |
| **App Store Packaging** | Hard (requires extra wrapper tools like PWABuilder). | **Excellent** - Built directly for Apple App Store and Google Play. | **Excellent** - Native stores supported on mobile and desktop. | **Excellent** - Standard store release packages. |
| **Complexity & Cost** | **Lowest** - No native build tools or SDKs needed. | Medium - Requires Android Studio and Xcode build setups. | High - Requires Xcode, Android Studio, Rust compile tools, and web configs. | **Highest** - Heavy engineering overhead and complete UI refactoring. |
| **Performance** | Webview-dependent; potential browser limits on low-end devices. | Stable webview container; excellent on modern devices. | Stable desktop webview (WebView2 on Windows, WebKit on macOS). | Native UI threads provide maximum rendering performance. |
| **Data Loss Risk** | **High** - Browsers (especially iOS Safari) delete IndexedDB on low space. | Low - Native wrappers run in persistent storage contexts. | Low - Persistent local database directories. | Lowest - Full native SQLite/native storage contexts. |

---

## 4. Open Product/Technical Decisions

### [DECISION-OPEN] Multi-Platform Packaging Framework
*   **Context:** DeutschFlow must support iOS, Android, Desktop, and Web. We must select the packaging wrapper that maximizes existing vanilla codebase reuse while securing data persistence.
*   **Discussion:**
    *   *Option A (PWA-only)* has lowest complexity but suffers from **severe data-deletion risks on iOS** (where Safari automatically deletes sandboxed IndexedDB storage after 7 days of inactivity or under low disk conditions).
    *   *Option B (Capacitor)* solves mobile store packaging and persistent storage, but does not compile native binaries for Windows/macOS.
    *   *Option C (Capacitor + Tauri)* offers the most complete multi-platform persistence coverage, but introduces compilation overhead (requiring Rust toolchains for Tauri and mobile SDKs).
*   **Status:** **OPEN** (Requires approval during the Architecture and Design Phase).
