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
export async function importNicosWegContent(repositories, loadExtraction = createArtifactLoader()) {
  const root = process.cwd();
  const discovery = discover({ root, templates: [NICOS_WEG_TEMPLATE] });
  const result = await runBatch(repositories, { apply: true, discovery, loadExtraction });
  return result;
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
