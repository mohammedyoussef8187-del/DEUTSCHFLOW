/*
 * Runtime composition root for the canonical features (A–I).
 *
 * One place where the canonical source is resolved and the nine services are built, so
 * the rest of the app receives finished services and never learns where their data came
 * from. Nothing here reads or writes legacy learner storage: the running SRS app keeps
 * its own repositories untouched, and this root cannot reach them.
 *
 * Resolution is deliberately conservative:
 *
 *   - Native build with the canonical store gate ON -> the real SQLite canonical store.
 *   - Anything else with a content dataset          -> the LOCAL store: the same
 *     repository layer over an in-memory adapter, seeded from the content the intake
 *     pipeline exported and persisting the learner's own rows locally.
 *   - No dataset, a mismatched one, or a failure    -> an EMPTY source.
 *
 * The local store is a second STORAGE BACKEND, not a second model: schema, write policy,
 * repositories and services are the same objects the SQLite path uses, and a parity test
 * drives both adapters through them and compares the rows. What was ruled out was
 * building the richer MODEL twice, and that has not happened.
 *
 * Before it existed, the web and PWA target — the only target a learner can reach today
 * — always resolved to EMPTY, so every curriculum screen said "nothing authored yet"
 * however much content had been imported. The content was real; the route to it was not.
 *
 * The empty source remains for the cases that deserve it: a real object with the same
 * read shape and no writes, so a screen renders an honest empty state rather than a fake
 * dataset. A failure to open any store is reported, never thrown: the vocabulary study
 * app must keep working even when the canonical store does not.
 */

import { createContentService } from "../services/content-service.js";
import { createGrammarService } from "../services/grammar-service.js";
import { createSentenceService } from "../services/sentence-service.js";
import { createExerciseService } from "../services/exercise-service.js";
import { createCurriculumService } from "../services/curriculum-service.js";
import { createErrorService } from "../services/error-service.js";
import { createListeningService } from "../services/listening-service.js";
import { createPronunciationService } from "../services/pronunciation-service.js";
import { createReminderService } from "../services/reminder-service.js";
import { createCanonicalRepositories } from "../data/canonical-repositories.js";
import { createSqliteAdapter } from "../platform/sqlite/adapter.js";
import { openLocalCanonicalStore } from "../platform/memory/local-canonical-store.js";
import { TABLE_SPECS } from "../platform/sqlite/schema.js";
import { detectNativePlatform } from "../platform/storage-selection.js";
import { resolveNotificationAdapter } from "../platform/notifications/local-notification-adapter.js";
import { isEnabled } from "./feature-gates.js";
import { publishedOnly } from "../content/publication.js";

/** Names the repository layer uses that differ from the schema's entity names. */
export const REPOSITORY_ALIASES = Object.freeze({
  vocabulary: "vocabularyItems",
  meanings: "vocabularyMeanings",
  cards: "reviewCards",
  events: "reviewEvents"
});

export const CANONICAL_SOURCE = Object.freeze({
  SQLITE: "sqlite",
  /** Shipped content in memory, learner rows persisted locally. The web/PWA target. */
  LOCAL: "local",
  EMPTY: "empty"
});

/**
 * A read-only source with nothing in it.
 *
 * Every canonical entity answers `all()` with an empty array and `find()` likewise, so
 * the services assemble correctly and return nothing — which is the truth. There are no
 * write methods at all, so a screen cannot accidentally try to record into a store that
 * does not exist.
 */
export function createEmptyCanonicalSource(reason = "canonical-store-unavailable") {
  const empty = Object.freeze({
    all: async () => [],
    get: async () => null,
    exists: async () => false,
    find: async () => [],
    findOne: async () => null,
    count: async () => 0
  });

  const source = { available: false, reason };
  for (const spec of TABLE_SPECS) source[spec.entity] = empty;
  // The repository layer renames a few entities; the empty source must answer to the
  // same names or a service would reach for a key that is not there. A test asserts
  // these two key sets stay identical.
  for (const alias of Object.keys(REPOSITORY_ALIASES)) source[alias] = empty;
  return Object.freeze(source);
}

/**
 * Open the canonical SQLite store, or explain why not.
 * Never throws: an unavailable store degrades to the empty source.
 */
export async function resolveCanonicalSource(options = {}) {
  const {
    environment = globalThis,
    gates = {},
    openExecutor = null,
    isNativePlatform = detectNativePlatform(environment)
  } = options;

  if (!isEnabled("canonicalRuntime", gates)) {
    return { source: createEmptyCanonicalSource("canonical-runtime-disabled"), kind: CANONICAL_SOURCE.EMPTY };
  }
  /*
   * SQLite is only available, and only permitted, on a validated native build. Every
   * other target falls through to the local store rather than to nothing, so the
   * curriculum is reachable in the browser, in the PWA, and on a native build whose
   * store gate has not been opened yet.
   */
  const nativeSqlite = isNativePlatform && isEnabled("canonicalNativeStore", gates) && openExecutor;
  if (!nativeSqlite) {
    const gatedReason = !isNativePlatform
      ? "web-target-has-no-canonical-store"
      : (openExecutor ? "canonical-native-store-gated" : "no-executor-supplied");
    return resolveLocalSource({ ...options, gatedReason });
  }

  try {
    const { executor, close = null } = await openExecutor();
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);
    return {
      source: Object.assign(Object.create(null), repositories, { available: true, reason: null }),
      kind: CANONICAL_SOURCE.SQLITE,
      close
    };
  } catch (error) {
    // Study must survive a broken content store.
    return {
      source: createEmptyCanonicalSource(`canonical-store-open-failed: ${error?.message ?? error}`),
      kind: CANONICAL_SOURCE.EMPTY,
      error
    };
  }
}

/**
 * The local store, or the empty source if it cannot be given real content.
 *
 * An empty local store would be worse than no store: the screens would offer to record
 * progress against a curriculum that is not there. So a store that loaded no content
 * degrades to EMPTY and keeps the honest note, carrying the reason the caller would
 * otherwise never see.
 */
async function resolveLocalSource(options) {
  const { loadContent = null, persistence = null, onStoreError = null, gatedReason } = options;
  if (!loadContent) {
    return { source: createEmptyCanonicalSource(gatedReason), kind: CANONICAL_SOURCE.EMPTY };
  }

  try {
    const store = await openLocalCanonicalStore({
      loadContent, persistence, onError: onStoreError
    });
    if (!store.available) {
      return {
        source: createEmptyCanonicalSource(store.reason ?? gatedReason),
        kind: CANONICAL_SOURCE.EMPTY
      };
    }
    return {
      source: Object.assign(Object.create(null), store.repositories, {
        available: true, reason: null
      }),
      kind: CANONICAL_SOURCE.LOCAL,
      store,
      close: null
    };
  } catch (error) {
    return {
      source: createEmptyCanonicalSource(`local-store-open-failed: ${error?.message ?? error}`),
      kind: CANONICAL_SOURCE.EMPTY,
      error
    };
  }
}

/**
 * Build every canonical service over one source.
 *
 * @param {object} source repositories, or the empty source
 * @param {object} [options] { notificationAdapter, readDueCount, readLastStudiedAt, now }
 */
export function createServices(source, options = {}) {
  /*
   * Every service reads through the published view, so a draft row is invisible to all
   * nine of them at once rather than to whichever ones remembered to filter. Writes are
   * not affected: the importer still writes drafts, and promoting one later makes it
   * appear without another import.
   */
  const readable = publishedOnly(source);
  const reminders = createReminderService({
    adapter: options.notificationAdapter ?? resolveNotificationAdapter({ isNativePlatform: false }),
    // Due state is READ from whatever the caller already has open — the running app's
    // own repositories — and arrives as a number. No card object enters this root.
    readDueCount: options.readDueCount ?? (async () => 0),
    readLastStudiedAt: options.readLastStudiedAt ?? (async () => null),
    readSettings: async profileUuid =>
      (await readable.reminderSettings.find({ profileUuid }))[0] ?? null,
    readHistory: async profileUuid => readable.reminderSchedule.find({ profileUuid }),
    writeSettings: source.write ? (row => source.write.reminders.save({ settings: row })) : null,
    writeSchedule: source.write
      ? (rows => source.write.reminders.save({ scheduled: rows }))
      : null,
    now: options.now
  });

  return Object.freeze({
    content: createContentService(readable),
    grammar: createGrammarService(readable),
    sentences: createSentenceService(readable),
    exercises: createExerciseService(readable),
    curriculum: createCurriculumService(readable),
    errors: createErrorService(readable),
    listening: createListeningService(readable),
    pronunciation: createPronunciationService(readable),
    reminders
  });
}

/**
 * The whole root: resolve a source, build the services, report what happened.
 *
 * The returned object always has every service, whether or not a store was available,
 * so a caller never has to branch on availability to render a screen. `available` and
 * `reason` say what is really going on, for a status line rather than a silent blank.
 */
export async function bootstrapCanonicalRuntime(options = {}) {
  const resolved = await resolveCanonicalSource(options);
  const { source, kind, close = null, error = null, store = null } = resolved;
  const services = createServices(source, options);

  return Object.freeze({
    services,
    source,
    kind,
    available: source.available === true,
    reason: source.reason ?? null,
    writable: Boolean(source.write),
    error,
    close,
    /** Present for the local store: `flush()` waits for the last save to land. */
    store
  });
}
