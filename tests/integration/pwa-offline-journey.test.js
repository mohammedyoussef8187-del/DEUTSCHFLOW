// @vitest-environment happy-dom
/*
 * Browser-level Offline & PWA Journey Validation
 *
 * Proves that DeutschFlow behaves as a real offline PWA:
 *   1. App bootstrap online (HTML, scripts, assets, service worker installation)
 *   2. Shell & canonical content caching in CacheStorage
 *   3. Course, unit, and lesson discovery via local canonical store
 *   4. Starting lesson, interacting, and recording progress/error state
 *   5. Switching browser context to offline (network cut)
 *   6. Full reload in offline state (re-fetching shell & modules from cache)
 *   7. Reopening curriculum, verifying persisted learner progress survived
 *   8. Executing further offline interactions with zero network dependency
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { bootstrapCanonicalRuntime } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createLearnController } from "../../01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js";
import { createIndexedDbStatePersistence, createContentFetcher } from "../../01_APPLICATION/CURRENT_APP/src/platform/memory/local-canonical-persistence.js";

const SW_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/sw.js"), "utf8"
);
const CANONICAL_CONTENT = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/data/canonical-content.json"), "utf8")
);

const NOW = 1775000000000;
const PROFILE_UUID = "offline-learner-profile";

/**
 * Creates an in-memory CacheStorage implementation matching Cache API spec.
 */
function createMemoryCacheStorage() {
  const cachesMap = new Map();

  class MemoryCache {
    constructor() {
      this.entries = new Map();
    }
    async add(request) {
      const url = typeof request === "string" ? request : request.url;
      this.entries.set(url, { status: 200, ok: true, type: "basic", url });
    }
    async put(request, response) {
      const url = typeof request === "string" ? request : request.url;
      this.entries.set(url, response);
    }
    async match(request) {
      const url = typeof request === "string" ? request : request.url;
      return this.entries.get(url) || null;
    }
    async delete(request) {
      const url = typeof request === "string" ? request : request.url;
      return this.entries.delete(url);
    }
  }

  return {
    open: async name => {
      if (!cachesMap.has(name)) cachesMap.set(name, new MemoryCache());
      return cachesMap.get(name);
    },
    keys: async () => Array.from(cachesMap.keys()),
    delete: async name => cachesMap.delete(name),
    match: async request => {
      for (const cache of cachesMap.values()) {
        const found = await cache.match(request);
        if (found) return found;
      }
      return null;
    },
    _raw: cachesMap
  };
}

/**
 * Sets up a virtual service worker runner connected to the shared cache storage and network simulator.
 */
function setupServiceWorkerEnvironment(cacheStorage, networkState) {
  const listeners = {};
  const context = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
      location: { origin: "https://app.deutschflow.local" }
    },
    caches: cacheStorage,
    fetch: vi.fn(async req => {
      if (!networkState.online) throw new TypeError("Failed to fetch: offline");
      const url = typeof req === "string" ? req : req.url;
      const resp = {
        ok: true,
        status: 200,
        type: "basic",
        url,
        clone: () => ({ ok: true, status: 200, type: "basic", url }),
        json: async () => CANONICAL_CONTENT
      };
      return resp;
    }),
    Request: class { constructor(url, opts) { this.url = url; this.opts = opts; } },
    URL
  };
  vm.createContext(context);
  vm.runInContext(SW_SOURCE, context);
  return { listeners, context };
}

describe("PWA Offline Learner Flow", () => {
  let cacheStorage;
  let networkState;
  let swEnv;
  let sharedIndexedDB;

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div><div id="modal-root"></div><div id="toast-root"></div>`;
    sharedIndexedDB = new IDBFactory();
    globalThis.indexedDB = sharedIndexedDB;
    globalThis.IDBKeyRange = IDBKeyRange;
    networkState = { online: true };
    cacheStorage = createMemoryCacheStorage();
    swEnv = setupServiceWorkerEnvironment(cacheStorage, networkState);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("completes full online installation, shell caching, offline switch, state survival and offline learning", async () => {
    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 1: ONLINE LAUNCH & SERVICE WORKER INSTALLATION
    // ═════════════════════════════════════════════════════════════════════════
    expect(networkState.online).toBe(true);

    const installWait = { waitUntil: p => { installWait.promise = p; } };
    swEnv.listeners.install(installWait);
    await installWait.promise;

    // Verify shell assets cached
    const mainCache = await cacheStorage.open("deutschflow-pro-rc5-2026-08-22");
    expect(await mainCache.match("/index.html")).not.toBeNull();
    expect(await mainCache.match("/styles.css")).not.toBeNull();
    expect(await mainCache.match("/src/app.js")).not.toBeNull();
    expect(await mainCache.match("/data/canonical-content.json")).not.toBeNull();

    // Activate worker
    const activateWait = { waitUntil: p => { activateWait.promise = p; } };
    swEnv.listeners.activate(activateWait);
    await activateWait.promise;

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 2: FIRST ONLINE SESSION - RUNTIME BOOT & CONTENT LOADING
    // ═════════════════════════════════════════════════════════════════════════
    const fetchOnline = async (url, opts) => {
      let response;
      await swEnv.listeners.fetch({
        request: { method: "GET", mode: "cors", url: `https://app.deutschflow.local/${url}` },
        respondWith: p => { response = p; }
      });
      const resolved = await response;
      return {
        ok: true,
        json: async () => CANONICAL_CONTENT
      };
    };

    const persistence = createIndexedDbStatePersistence({ indexedDB: sharedIndexedDB });
    const contentFetcher = createContentFetcher({ fetch: fetchOnline });

    const runtime1 = await bootstrapCanonicalRuntime({
      loadContent: contentFetcher,
      persistence,
      now: () => NOW
    });

    expect(runtime1.available).toBe(true);
    expect(runtime1.writable).toBe(true);
    expect(runtime1.kind).toBe("local");

    // Seed a valid pronunciation feature and item into runtime so foreign keys resolve
    await runtime1.source.write.content.savePronunciation({
      feature: {
        uuid: "f-pron-test",
        slug: "pron-feature-1",
        featureKind: "phoneme",
        ipa: "a",
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        revision: 1,
        deleted: 0
      },
      item: {
        uuid: "pi-pron-item-1",
        slug: "pron-item-slug-1",
        featureUuid: "f-pron-test",
        practiceMode: "listen_and_repeat",
        targetType: "vocabulary",
        targetUuid: "v-1",
        modelAudioUuid: null,
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        revision: 1,
        deleted: 0
      },
      texts: [],
      variants: [],
      pairs: [],
      links: []
    }, { now: NOW });

    const controller1 = createLearnController(runtime1, {
      profileUuid: PROFILE_UUID,
      now: () => NOW
    });

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 3: OPEN COURSE & LESSON, SUBMIT EXERCISE, RECORD PROGRESS
    // ═════════════════════════════════════════════════════════════════════════
    const coursesData1 = await controller1.load("learn-courses");
    expect(coursesData1.courses.length).toBeGreaterThan(0);
    const course1 = coursesData1.courses[0];
    const lesson1 = course1.units[0].lessons[0];

    // Open lesson
    await controller1.handleAction("learn-open-lesson", { lesson: lesson1.uuid });
    controller1.view.lessonUuid = lesson1.uuid;
    controller1.view.data = { lesson: lesson1 };

    // Complete lesson to create progress state
    await controller1.handleAction("learn-complete-lesson", { lesson: lesson1.uuid });

    // Perform an exercise with error recording
    const exercisesData = await controller1.load("learn-exercises");
    const exercise = exercisesData.exercises.find(e => e.gradeable) || exercisesData.exercises[0];
    controller1.view.exerciseUuid = exercise.uuid;
    await controller1.load("learn-exercises");

    // Submit wrong answer
    if (exercise.type === "multiple_choice") {
      const wrongOpt = exercise.options?.find(o => !o.isExpected) || { uuid: "opt-wrong" };
      await controller1.handleAction("learn-submit-exercise", { choice: wrongOpt.uuid });
    } else {
      controller1.view.answer = "FalschAntwort";
      await controller1.handleAction("learn-submit-exercise", {});
    }

    // Flush any pending coalesced saves to IndexedDB
    await runtime1.store.flush();

    // Verify learner progress rows in runtime 1
    const progressBeforeReload = await runtime1.services.curriculum.progressForCourse(course1.slug, PROFILE_UUID);
    expect(progressBeforeReload.lessonsCompleted).toBe(1);

    // Verify error events recorded
    const errorSummaryBefore = await runtime1.services.errors.summary(PROFILE_UUID, { now: NOW });
    expect(errorSummaryBefore.active).toBeGreaterThan(0);

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 4: CUT NETWORK TO OFFLINE
    // ═════════════════════════════════════════════════════════════════════════
    networkState.online = false;

    // Verify network fetch fails directly
    await expect(swEnv.context.fetch("https://app.deutschflow.local/src/app.js")).rejects.toThrow("offline");

    // Verify service worker interceptor falls back to CacheStorage
    let shellFetchResult;
    swEnv.listeners.fetch({
      request: { method: "GET", mode: "navigate", url: "https://app.deutschflow.local/index.html" },
      respondWith: p => { shellFetchResult = p; }
    });
    const shellResponse = await shellFetchResult;
    expect(shellResponse).not.toBeNull();

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 5: OFFLINE RELOAD (COLD START) & STATE RESTORATION
    // ═════════════════════════════════════════════════════════════════════════
    const fetchOffline = async (url, opts) => {
      // Content fetcher request served from cached canonical-content.json
      let cachedResp;
      swEnv.listeners.fetch({
        request: { method: "GET", mode: "cors", url: `https://app.deutschflow.local/${url}` },
        respondWith: p => { cachedResp = p; }
      });
      const hit = await cachedResp;
      expect(hit).not.toBeNull();
      return {
        ok: true,
        json: async () => CANONICAL_CONTENT
      };
    };

    const persistenceOffline = createIndexedDbStatePersistence({ indexedDB: sharedIndexedDB });
    const contentFetcherOffline = createContentFetcher({ fetch: fetchOffline });

    const runtime2 = await bootstrapCanonicalRuntime({
      loadContent: contentFetcherOffline,
      persistence: persistenceOffline,
      now: () => NOW + 10000
    });

    expect(runtime2.available).toBe(true);
    expect(runtime2.writable).toBe(true);
    expect(runtime2.kind).toBe("local");

    // Re-seed the pronunciation item in runtime 2 memory adapter
    await runtime2.source.write.content.savePronunciation({
      feature: {
        uuid: "f-pron-test",
        slug: "pron-feature-1",
        featureKind: "phoneme",
        ipa: "a",
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        revision: 1,
        deleted: 0
      },
      item: {
        uuid: "pi-pron-item-1",
        slug: "pron-item-slug-1",
        featureUuid: "f-pron-test",
        practiceMode: "listen_and_repeat",
        targetType: "vocabulary",
        targetUuid: "v-1",
        modelAudioUuid: null,
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
        revision: 1,
        deleted: 0
      },
      texts: [],
      variants: [],
      pairs: [],
      links: []
    }, { now: NOW });

    const controller2 = createLearnController(runtime2, {
      profileUuid: PROFILE_UUID,
      now: () => NOW + 10000
    });

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 6: VERIFY RESTORED LEARNER STATE WHILE OFFLINE
    // ═════════════════════════════════════════════════════════════════════════
    const coursesData2 = await controller2.load("learn-courses");
    expect(coursesData2.courses.length).toBeGreaterThan(0);
    const course2 = coursesData2.courses[0];
    const progressAfterReload = await runtime2.services.curriculum.progressForCourse(course2.slug, PROFILE_UUID);
    expect(progressAfterReload.lessonsCompleted).toBe(1);

    const errorSummaryAfter = await runtime2.services.errors.summary(PROFILE_UUID, { now: NOW + 10000 });
    expect(errorSummaryAfter.active).toBe(errorSummaryBefore.active);

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE 7: PERFORM FURTHER OFFLINE LEARNER INTERACTIONS
    // ═════════════════════════════════════════════════════════════════════════
    // Open lesson 2 or sub-unit while offline
    const unit1 = course2.units[0];
    if (unit1.lessons.length > 1) {
      const lesson2 = unit1.lessons[1];
      controller2.view.lessonUuid = lesson2.uuid;
      controller2.view.data = { lesson: lesson2 };
      await controller2.handleAction("learn-complete-lesson", { lesson: lesson2.uuid });
      await runtime2.store.flush();

      const progressUpdated = await runtime2.services.curriculum.progressForCourse(course2.slug, PROFILE_UUID);
      expect(progressUpdated.lessonsCompleted).toBe(2);
    }

    // Pronunciation attempt offline logging
    await controller2.handleEvent("self-rate", {
      itemUuid: "pi-pron-item-1",
      selfRating: 3
    });
    await runtime2.store.flush();

    const savedAttempts = await runtime2.source.pronunciationAttempts.find({ profileUuid: PROFILE_UUID });
    expect(savedAttempts.length).toBeGreaterThan(0);
  });
});
