import fs from "node:fs";
import path from "node:path";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { bootstrapCanonicalRuntime } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createLearnController } from "../../01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js";
import { createNodeSqliteExecutor } from "./sqlite-node-executor.js";
import { discover, NICOS_WEG_TEMPLATE } from "../../tools/intake/discover.js";
import { runBatch } from "../../tools/intake/batch.js";

export const HARNESS_TIMESTAMP = 1775000000000;
export const HARNESS_PROFILE = "learner-test-profile";

function artifact(sourceId) {
  const root = process.cwd();
  const dir = path.resolve(root, "tools/intake/artifacts", sourceId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8"));
  return { ...meta, raw: fs.readFileSync(path.join(dir, "raw.txt"), "utf8") };
}

/**
 * Committed artifact loader to avoid requiring external binary pdftotext during tests.
 */
export function createArtifactLoader(overrides = {}) {
  return source => {
    const base = source.role === "manuscript"
      ? artifact("nicos-weg-a2-e2-l1-manuscript")
      : artifact("nicos-weg-a2-e2-l1-exercises");
    const override = overrides[source.id];
    return override ? override(structuredClone(base)) : base;
  };
}

/**
 * Creates an in-memory or file-backed clean SQLite store with schema initialized.
 * @param {string} [dbPath=":memory:"]
 */
export async function createHarnessStore(dbPath = ":memory:") {
  const executor = createNodeSqliteExecutor(dbPath);
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  const repositories = createCanonicalRepositories(adapter);
  return { executor, adapter, repositories };
}

/**
 * Imports the real Nicos Weg A2 verified intake content into the provided repositories.
 * @param {object} repositories Canonical repositories object
 */
export async function importNicosWegContent(
  repositories, loadExtraction = createArtifactLoader(), now = HARNESS_TIMESTAMP
) {
  const root = process.cwd();
  const discovery = discover({ root, templates: [NICOS_WEG_TEMPLATE] });
  // A fixed clock, so two stores loaded from the same source hold the same rows and a
  // test can compare them field for field instead of excusing the timestamps.
  return runBatch(repositories, { apply: true, discovery, loadExtraction, now });
}

/**
 * Boots the canonical runtime and learn controller over the supplied store and options.
 * @param {object} options
 */
export async function bootLearnerHarness(options = {}) {
  const {
    dbPath = ":memory:",
    existingExecutor = null,
    profileUuid = HARNESS_PROFILE,
    now = () => HARNESS_TIMESTAMP,
    readDueCount = async () => 0,
    readLastStudiedAt = async () => null,
    notificationAdapter = {
      permission: async () => "granted",
      requestPermission: async () => "granted",
      pending: async () => [],
      schedule: async () => ({ scheduled: 1 }),
      cancel: async () => ({ cancelled: 1 })
    },
    toasts = []
  } = options;

  let executor = existingExecutor;
  let adapter;
  let repositories;

  if (!executor) {
    const store = await createHarnessStore(dbPath);
    executor = store.executor;
    adapter = store.adapter;
    repositories = store.repositories;
  } else {
    adapter = createSqliteAdapter(executor);
    repositories = createCanonicalRepositories(adapter);
  }

  const runtime = await bootstrapCanonicalRuntime({
    isNativePlatform: true,
    gates: { canonicalNativeStore: true, canonicalRuntime: true },
    openExecutor: async () => ({ executor }),
    notificationAdapter,
    readDueCount,
    readLastStudiedAt,
    now
  });

  const controller = createLearnController(runtime, {
    profileUuid,
    now,
    toast: (msg, kind) => toasts.push({ message: msg, kind })
  });

  /**
   * Helper to simulate page navigation and rendering into the DOM.
   */
  async function navigate(route) {
    const data = await controller.load(route);
    const html = controller.render(route);
    if (typeof document !== "undefined" && document.body) {
      document.body.innerHTML = `<div id="app">${html}</div>`;
      controller.hydrate(route);
      await Promise.resolve();
    }
    return { data, html };
  }

  /**
   * Helper to execute an action button/event through controller.
   */
  async function dispatchAction(action, dataset = {}) {
    const result = await controller.handleAction(action, dataset);
    if (result?.reload) {
      const currentRoute = controller.routes.find(r => r.id === dataset.route)?.id || "learn-courses";
      await navigate(currentRoute);
    }
    return result;
  }

  return {
    executor,
    adapter,
    repositories,
    runtime,
    controller,
    toasts,
    navigate,
    dispatchAction,
    close: async () => {
      if (executor?.close) await executor.close();
    }
  };
}

/* ==========================================================================
 * The LOCAL store: the configuration a learner in a browser actually gets.
 * ========================================================================== */

/**
 * The content dataset exactly as it is shipped to a device.
 *
 * Read from the committed file rather than rebuilt, so a test fails if the file the app
 * loads and the content the tests assume ever drift apart.
 */
export function readShippedContent() {
  const file = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/data/canonical-content.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** A content loader over an in-process copy: no network, same bytes. */
export function createShippedContentLoader(dataset = readShippedContent()) {
  return async () => structuredClone(dataset);
}

/**
 * Learner-state persistence backed by a plain object.
 *
 * Its `saved` handle survives a "restart", which is what makes closing and reopening the
 * app testable without a real database. The IndexedDB port is exercised separately.
 */
export function createMemoryStatePersistence(initial = null) {
  const box = { state: initial, writes: 0 };
  return {
    box,
    async read() { return box.state; },
    async write(state) { box.writes += 1; box.state = structuredClone(state); }
  };
}

/**
 * Boot the runtime the way the web/PWA build does: not native, no SQLite, shipped
 * content, learner rows persisted locally.
 */
export async function bootLocalLearnerHarness(options = {}) {
  const {
    loadContent = createShippedContentLoader(),
    persistence = createMemoryStatePersistence(),
    profileUuid = HARNESS_PROFILE,
    now = () => HARNESS_TIMESTAMP,
    readDueCount = async () => 0,
    readLastStudiedAt = async () => null,
    notificationAdapter = {
      permission: async () => "denied",
      requestPermission: async () => "denied",
      pending: async () => [],
      schedule: async () => ({ scheduled: 0 }),
      cancel: async () => ({ cancelled: 0 })
    },
    toasts = []
  } = options;

  const runtime = await bootstrapCanonicalRuntime({
    isNativePlatform: false,
    loadContent,
    persistence,
    notificationAdapter,
    readDueCount,
    readLastStudiedAt,
    now
  });

  const controller = createLearnController(runtime, {
    profileUuid, now, toast: (message, kind) => toasts.push({ message, kind })
  });

  /** Render a route into the document the way the host app does, then hydrate. */
  async function navigate(route) {
    const data = await controller.load(route);
    const html = controller.render(route);
    if (typeof document !== "undefined" && document.body) {
      document.body.innerHTML = `<div id="app">${html}</div>`;
      controller.hydrate(route);
      await Promise.resolve();
    }
    return { data, html };
  }

  async function act(action, dataset = {}) {
    const result = await controller.handleAction(action, dataset);
    await runtime.store?.flush();
    return result;
  }

  async function event(type, detail = {}) {
    const result = await controller.handleEvent(type, detail);
    await runtime.store?.flush();
    return result;
  }

  return {
    runtime,
    controller,
    persistence,
    toasts,
    repositories: runtime.source,
    navigate,
    act,
    event,
    flush: () => runtime.store?.flush() ?? Promise.resolve()
  };
}
