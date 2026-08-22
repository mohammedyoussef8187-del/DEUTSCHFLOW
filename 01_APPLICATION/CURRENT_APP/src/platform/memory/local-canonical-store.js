/*
 * The canonical store as it exists on a device without SQLite.
 *
 * Two halves that must not be confused with each other:
 *
 *   CONTENT is authored, shipped with the app, and identical on every device. It is
 *   loaded fresh on every launch from the dataset the intake pipeline exported, so a
 *   corrected import reaches a learner the next time the app starts. It is never saved
 *   back, because nothing here is allowed to edit it.
 *
 *   LEARNER STATE is what this person did — which lesson they finished, which mistakes
 *   they made, what they said out loud. It is written at runtime and persisted locally,
 *   so closing the app and reopening it offline continues where they were.
 *
 * Keeping them apart is what makes reloading safe: content is replaced by the shipped
 * copy, learner rows are replayed on top, and neither can overwrite the other.
 *
 * WHAT THIS DELIBERATELY DOES NOT HOLD: review_cards and review_events. SRS history
 * lives in the legacy IndexedDB store until the device gate passes
 * (`learnerStorageSwitch`), and this store must not become a second, competing home for
 * it. Both entities are absent from PERSISTED_ENTITIES, and a test asserts they stay
 * absent — an accidental addition would silently fork a learner's SRS history in two.
 */

import { SCHEMA_VERSION } from "../sqlite/schema.js";
import { createMemoryCanonicalAdapter } from "./canonical-memory-adapter.js";
import { createCanonicalRepositories } from "../../data/canonical-repositories.js";

/**
 * The tables whose rows a learner creates by using the app, and which therefore have to
 * survive a reload. Everything absent from this list is either shipped content or is
 * owned by another store.
 */
export const PERSISTED_ENTITIES = Object.freeze([
  "profiles",
  "settings",
  "courseProgress", "lessonProgress", "sectionProgress", "cefrProgress",
  "errorCategories", "errorEvents", "errorEventCategories", "errorPatterns",
  "pronunciationAttempts",
  "reminderSettings", "reminderSchedule"
]);

export const LOCAL_STORE_STATE_VERSION = 1;

/**
 * Open the local canonical store.
 *
 * @param {object} options
 *   loadContent()  resolves to the exported content dataset, or null for no content
 *   persistence    { read(), write(state) } for learner rows; omit for a scratch store
 *   onError(error, stage) reported rather than thrown; study must survive a bad store
 * @returns {Promise<object>} { adapter, repositories, available, reason, counts, flush }
 */
export async function openLocalCanonicalStore(options = {}) {
  const { loadContent = null, persistence = null, onError = null } = options;

  const report = (error, stage) => {
    try { onError?.(error, stage); } catch { /* a broken reporter cannot break the store */ }
  };

  let save = () => {};
  const adapter = createMemoryCanonicalAdapter({ onCommit: () => save() });
  await adapter.initializeSchema();

  /* ------------------------------------------------------------- content */

  let counts = {};
  let reason = null;

  if (loadContent) {
    try {
      const dataset = await loadContent();
      if (!dataset) {
        reason = "no-content-dataset";
      } else if (Number(dataset.schemaVersion) !== SCHEMA_VERSION) {
        // Loading rows shaped for another schema would put values in the wrong fields
        // and call the result content. Refuse, and say so.
        reason = `content-schema-${dataset.schemaVersion}-expected-${SCHEMA_VERSION}`;
      } else {
        await adapter.importCanonical(dataset.entities ?? {});
        counts = dataset.counts ?? {};
      }
    } catch (error) {
      report(error, "content");
      reason = `content-load-failed: ${error?.message ?? error}`;
    }
  } else {
    reason = "no-content-loader";
  }

  /* ------------------------------------------------------- learner state */

  let restored = 0;
  if (persistence?.read) {
    try {
      const saved = await persistence.read();
      if (saved?.entities && Number(saved.schemaVersion) === SCHEMA_VERSION) {
        restored = adapter.memory.load(pick(saved.entities, PERSISTED_ENTITIES));
      }
    } catch (error) {
      // A learner losing their progress is bad; a learner losing the app is worse.
      report(error, "restore");
    }
  }

  /* ---------------------------------------------------------- persisting */

  let running = null;
  let again = false;

  async function writeNow() {
    if (!persistence?.write) return;
    try {
      await persistence.write({
        schemaVersion: SCHEMA_VERSION,
        stateVersion: LOCAL_STORE_STATE_VERSION,
        savedAt: Date.now(),
        entities: adapter.memory.export(PERSISTED_ENTITIES)
      });
    } catch (error) {
      report(error, "persist");
    }
  }

  /*
   * Saves are coalesced rather than queued: a burst of writes inside one interaction
   * ends in exactly one extra save, and a save that arrives while one is in flight is
   * folded into the next. No timers, so a test can await `flush()` and be certain.
   */
  save = () => {
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        await writeNow();
      } while (again);
      running = null;
    })();
    return running;
  };

  const flush = async () => { await save(); };

  return Object.freeze({
    adapter,
    repositories: createCanonicalRepositories(adapter),
    /** True when authored content really loaded; the screens key their notes off this. */
    available: reason === null,
    reason,
    counts,
    restored,
    flush
  });
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) if (source[key]) out[key] = source[key];
  return out;
}
