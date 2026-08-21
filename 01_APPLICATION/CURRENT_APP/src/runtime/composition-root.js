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
 *   - Native build with the canonical store gate ON  -> the real SQLite canonical store.
 *   - Anything else (web, PWA, gate off, open failed) -> an EMPTY source.
 *
 * The empty source is a real object with the same read shape and no writes, so every
 * screen renders an honest "nothing authored yet" state. It is not a fake dataset, and
 * it is not a second implementation of the canonical model for the browser — building
 * the richer model twice is exactly what was ruled out.
 *
 * A failure to open the store is reported, never thrown: the vocabulary study app must
 * keep working even if the canonical store is unavailable.
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
import { TABLE_SPECS } from "../platform/sqlite/schema.js";
import { detectNativePlatform } from "../platform/storage-selection.js";
import { resolveNotificationAdapter } from "../platform/notifications/local-notification-adapter.js";
import { isEnabled } from "./feature-gates.js";

/** Names the repository layer uses that differ from the schema's entity names. */
export const REPOSITORY_ALIASES = Object.freeze({
  vocabulary: "vocabularyItems",
  meanings: "vocabularyMeanings",
  cards: "reviewCards",
  events: "reviewEvents"
});

export const CANONICAL_SOURCE = Object.freeze({
  SQLITE: "sqlite",
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
  if (!isNativePlatform) {
    // The browser has no SQLite here, and no second model is built for it.
    return { source: createEmptyCanonicalSource("web-target-has-no-canonical-store"), kind: CANONICAL_SOURCE.EMPTY };
  }
  if (!isEnabled("canonicalNativeStore", gates) || !openExecutor) {
    return {
      source: createEmptyCanonicalSource(
        openExecutor ? "canonical-native-store-gated" : "no-executor-supplied"),
      kind: CANONICAL_SOURCE.EMPTY
    };
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
 * Build every canonical service over one source.
 *
 * @param {object} source repositories, or the empty source
 * @param {object} [options] { notificationAdapter, readDueCount, readLastStudiedAt, now }
 */
export function createServices(source, options = {}) {
  const reminders = createReminderService({
    adapter: options.notificationAdapter ?? resolveNotificationAdapter({ isNativePlatform: false }),
    // Due state is READ from whatever the caller already has open — the running app's
    // own repositories — and arrives as a number. No card object enters this root.
    readDueCount: options.readDueCount ?? (async () => 0),
    readLastStudiedAt: options.readLastStudiedAt ?? (async () => null),
    readSettings: async profileUuid =>
      (await source.reminderSettings.find({ profileUuid }))[0] ?? null,
    readHistory: async profileUuid => source.reminderSchedule.find({ profileUuid }),
    writeSettings: source.write ? (row => source.write.reminders.save({ settings: row })) : null,
    writeSchedule: source.write
      ? (rows => source.write.reminders.save({ scheduled: rows }))
      : null,
    now: options.now
  });

  return Object.freeze({
    content: createContentService(source),
    grammar: createGrammarService(source),
    sentences: createSentenceService(source),
    exercises: createExerciseService(source),
    curriculum: createCurriculumService(source),
    errors: createErrorService(source),
    listening: createListeningService(source),
    pronunciation: createPronunciationService(source),
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
  const { source, kind, close = null, error = null } = await resolveCanonicalSource(options);
  const services = createServices(source, options);

  return Object.freeze({
    services,
    source,
    kind,
    available: source.available === true,
    reason: source.reason ?? null,
    writable: Boolean(source.write),
    error,
    close
  });
}
