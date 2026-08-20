import { describe, expect, it } from "vitest";
import {
  STORAGE_INDEXEDDB, STORAGE_SQLITE, detectNativePlatform, selectPersistenceBackend
} from "../../01_APPLICATION/CURRENT_APP/src/platform/storage-selection.js";

describe("persistence backend selection", () => {
  it("keeps today's behavior: every platform still resolves to IndexedDB by default", () => {
    expect(selectPersistenceBackend().backend).toBe(STORAGE_INDEXEDDB);
    expect(selectPersistenceBackend({ isNativePlatform: true }).backend).toBe(STORAGE_INDEXEDDB);
    expect(selectPersistenceBackend({ isNativePlatform: false }).backend).toBe(STORAGE_INDEXEDDB);
  });

  it("gates native SQLite behind an explicit switch until on-device verification passes", () => {
    const gated = selectPersistenceBackend({ isNativePlatform: true, nativeStorageEnabled: false });
    expect(gated.backend).toBe(STORAGE_INDEXEDDB);
    expect(gated.reason).toBe("native-storage-gated-until-verified");
  });

  it("selects native SQLite only on a native platform with the switch enabled", () => {
    const selection = selectPersistenceBackend({ isNativePlatform: true, nativeStorageEnabled: true });
    expect(selection.backend).toBe(STORAGE_SQLITE);
    // IndexedDB remains the rollback target rather than being removed.
    expect(selection.fallback).toBe(STORAGE_INDEXEDDB);
  });

  it("never selects SQLite on the web target, even with the switch enabled", () => {
    const selection = selectPersistenceBackend({ isNativePlatform: false, nativeStorageEnabled: true });
    expect(selection.backend).toBe(STORAGE_INDEXEDDB);
    expect(selection.reason).toBe("web-target-uses-indexeddb");
  });
});

describe("native platform detection", () => {
  it("reports false in a plain browser with no Capacitor bridge", () => {
    expect(detectNativePlatform({})).toBe(false);
    expect(detectNativePlatform(undefined)).toBe(false);
  });

  it("uses isNativePlatform() when the bridge provides it", () => {
    expect(detectNativePlatform({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(detectNativePlatform({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
  });

  it("falls back to the platform string on older bridges", () => {
    expect(detectNativePlatform({ Capacitor: { platform: "ios" } })).toBe(true);
    expect(detectNativePlatform({ Capacitor: { platform: "android" } })).toBe(true);
    expect(detectNativePlatform({ Capacitor: { platform: "web" } })).toBe(false);
  });
});
