# Mobile Platform Rollout Plan (MOBILE_PLATFORM_ROLLOUT_PLAN.md)

This document specifies the target UX requirements, responsive layout adaptation rules, and Capacitor native capability integration sequence for iOS (iPad/iPhone) and Android.

---

## 1. Device Adaptation & UX Requirements

```
                       ┌────────────────────────┐
                       │  Mobile-First Delivery │
                       └───────────┬────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│       iPad / iPadOS & Tablets   │         │    iPhone & Android Phones      │
├─────────────────────────────────┤         ├─────────────────────────────────┤
│ • Split-view dual panel layout  │         │ • One-handed portrait study     │
│ • Simultaneous content + review │         │ • Compact responsive cards      │
│ • Touch targets >= 44x44 pt     │         │ • German special key bar        │
│ • External keyboard support     │         │ • Bottom navigation bar         │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

### 1.1 iPad & Tablet UX Requirements
*   **Dual Orientation:** Full support for both Portrait and Landscape orientations. Layouts dynamically adjust breakpoints without losing session state or triggering card re-evaluation.
*   **Split-View Workspace:** On screens wider than 768px, UI presents dual panels: left panel displays curriculum tree/grammar explanation; right panel displays active exercise or vocabulary detail.
*   **Keyboard Handling:** Input fields during active recall sessions auto-scroll into view above the virtual keyboard. Supports hardware Bluetooth keyboards (pressing `Enter` submits answer, `Space` plays audio).
*   **Touch Ergonomics:** Minimum touch target boundaries of `44x44 pt`. Prominent audio playback and microphone buttons positioned for comfortable finger access.

### 1.2 iPhone & Phone UX Requirements
*   **Portrait-Optimized:** One-handed ergonomics with primary action buttons (Submit, Audio, Flip Card) positioned within the lower thumb zone.
*   **On-Screen German Helpers:** Quick-tap character buttons (`ä`, `ö`, `ü`, `ß`) rendered directly above the keyboard area.

---

## 2. Native Capacitor Capability Integration Sequence

Native capabilities are introduced sequentially after the Web Core foundation is stabilized:

```
Step 1: Capacitor Shell Setup (iOS & Android projects)
   │
   ▼
Step 2: Native SQLite Storage (@capacitor-community/sqlite)
   │
   ▼
Step 3: Microphone Permission & Recording Adapter
   │
   ▼
Step 4: Local Review Notifications Scheduler
```

### 2.1 Capability Rollout Details
1.  **Capacitor Shell Setup:** Configures native iOS (Xcode) and Android (Android Studio) projects loading local web assets.
2.  **Native SQLite Storage:** Connects `@capacitor-community/sqlite` plugin to the SQLite repository adapter, targeting persistent Documents directory.
3.  **Microphone Audio Adapter:** Wraps Capacitor Media plugin requesting microphone permissions dynamically upon user tapping "Record Pronunciation". Voice audio files save to local temporary directory.
4.  **Local Review Notifications:** Connects Capacitor Local Notifications plugin to SRS scheduler, requesting notification permissions to dispatch local reminders for due card reviews.
