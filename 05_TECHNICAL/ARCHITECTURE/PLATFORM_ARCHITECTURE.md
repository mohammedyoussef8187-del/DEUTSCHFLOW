# Platform Architecture (PLATFORM_ARCHITECTURE.md)

This document describes how the shared **DeutschFlow** core integrates with platform-specific native wrappers (Capacitor for mobile, Tauri for desktop).

---

## 1. Native Integration Boundaries

The shared application core compiles into standard static web assets (HTML, CSS, JS). These assets are loaded inside native WebView containers managed by platform wrappers.

```
                  ┌──────────────────────┐
                  │ Shared Web Core App  │
                  └──────────┬───────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  Capacitor   │        │    Tauri     │        │ Web Browser  │
│ (iOS/Android)│        │   (Desktop)  │        │  (Static)    │
└────┬─────────┘        └────┬─────────┘        └────┬─────────┘
     │                       │                       │
     ▼                       ▼                       ▼
Native SQLite           Tauri SQLite            IndexedDB
Microphone Plugin       Tauri FS                WebAudio
Local Notification      OS Tray Reminders       In-App Alerts
```

---

## 2. Platform Adapter Interfaces

To interact with native APIs without platform locking, the core defines an abstract `PlatformAdapter` interface:

```typescript
interface PlatformAdapter {
  storage: {
    execute(query: string, params?: any[]): Promise<any>;
    transaction(queries: Array<{sql: string, params: any[]}>): Promise<any>;
  };
  audio: {
    play(path: string): Promise<void>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<string>; // Returns local path
  };
  notifications: {
    schedule(id: string, title: string, body: string, dueTime: number): Promise<void>;
    cancel(id: string): Promise<void>;
  };
}
```

### 2.1 Capacitor Implementation (Mobile)
*   **Storage:** Utilizes `capacitor-community/sqlite` plugin mapping to native SQLite libraries.
*   **Audio/Mic:** Maps to Capacitor native media plugins requesting microphone permissions dynamically before recording.
*   **Notifications:** Schedules native notifications via `CapacitorLocalNotifications` API.

### 2.2 Tauri Implementation (Desktop)
*   **Storage:** Invokes Tauri database commands written in Rust, which read and write to a local `.db` file in the user's application data folder.
*   **Audio/Mic:** Native audio execution and filesystem storage via Rust Tauri command bridges.
*   **Notifications:** Invokes Tauri native system notification helper commands.

### 2.3 Web Fallback Implementation
*   **Storage:** Fallback repository writes to standard browser IndexedDB.
*   **Audio:** Utilizes HTML5 Audio elements and browser MediaStream Recording APIs.
*   **Notifications:** Local in-app modal notices or banner alerts (Web Push is deferred).

---

## 3. Native Lifecycle Management

Platform adapters hook into native application lifecycle events to secure data integrity:
1.  **Suspend / Pause (App goes background):** Capacitor listener catches `appStateChange` (mobile) and Tauri catches window blur (desktop). The system commits any transient state (active study session queue, settings overrides) from `state` memory to SQLite immediately to prevent data loss.
2.  **Resume / Active (App comes foreground):** Refreshes the database connection, re-calculates due cards matching the current clock time, and checks for service worker or app cache updates.
