/*
 * Review summary application service.
 *
 * Sits between the UI and the domain/repository layers:
 *   Lit UI -> THIS SERVICE -> Domain (SRS status engine) -> Repository -> Adapter
 *
 * Strictly READ-ONLY. It reads learner state and derives counts; it performs no writes,
 * schedules nothing, and mutates neither the arrays it is given nor any card. The UI
 * receives a plain data object and never touches storage or SRS internals.
 *
 * Every figure here is derived from data the application already stores, using the same
 * domain functions the existing dashboard uses. Nothing is invented or estimated.
 */

import { wordStatus } from "../srs/scheduler.js";

/** Status buckets produced by the domain's wordStatus engine. */
export const STATUS_KEYS = Object.freeze([
  "new", "learning", "due", "overdue", "weak", "mastered", "ignored"
]);

/**
 * Derive the review summary from an in-memory learner snapshot.
 * Pure: no I/O, no mutation of the inputs.
 *
 * @param {object} snapshot { words, cards }
 * @param {number} [now] evaluation instant, injected for deterministic results
 */
export function summarizeLearnerState(snapshot = {}, now = Date.now()) {
  const words = Array.isArray(snapshot.words) ? snapshot.words : [];
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];

  const counts = Object.fromEntries(STATUS_KEYS.map(key => [key, 0]));
  for (const word of words) {
    const status = wordStatus(word, cards, now);
    if (status in counts) counts[status]++;
  }

  // Same rule the existing dashboard uses for "cards due now": scheduled, not suspended.
  const dueCards = cards.filter(card => !card.suspended && card.dueAt <= now).length;

  return {
    vocabularyTotal: words.length,
    cardTotal: cards.length,
    dueCards,
    counts,
    generatedAt: now
  };
}

/**
 * Repository-backed service. Used where the caller has no in-memory snapshot; reads
 * through the repository abstraction only, never a database or plugin API.
 *
 * @param {object} repositories vocabulary/cards repositories
 * @param {object} [options] { clock } injectable time source
 */
export function createReviewSummaryService(repositories, options = {}) {
  if (!repositories) throw new TypeError("Repositories are required");
  const clock = options.clock ?? (() => Date.now());

  return Object.freeze({
    /** Read learner state through repositories and summarize it. Read-only. */
    async getSummary() {
      const [words, cards] = await Promise.all([
        repositories.vocabulary.all(),
        repositories.cards.all()
      ]);
      return summarizeLearnerState({ words, cards }, clock());
    },

    /** Summarize an already-loaded snapshot, avoiding a redundant full read. */
    summarize(snapshot) {
      return summarizeLearnerState(snapshot, clock());
    }
  });
}
