import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createReviewSummaryService, summarizeLearnerState
} from "../../01_APPLICATION/CURRENT_APP/src/services/review-summary-service.js";
import { wordStatus } from "../../01_APPLICATION/CURRENT_APP/src/srs/scheduler.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const snapshot = { words: fixture.clean.words, cards: fixture.clean.cards };
// After every card's dueAt in the fixture, so due/overdue buckets are populated.
const NOW = 1775000000000;

describe("review summary service", () => {
  it("derives counts using the same domain engine as the rest of the app", () => {
    const summary = summarizeLearnerState(snapshot, NOW);

    // Independently recompute with the domain function: no invented statistics.
    const expected = {};
    for (const word of snapshot.words) {
      const status = wordStatus(word, snapshot.cards, NOW);
      expected[status] = (expected[status] ?? 0) + 1;
    }
    for (const [status, count] of Object.entries(expected)) {
      expect(summary.counts[status]).toBe(count);
    }
    // Every word lands in exactly one bucket.
    expect(Object.values(summary.counts).reduce((a, b) => a + b, 0)).toBe(snapshot.words.length);
  });

  it("reports vocabulary and card totals from real data", () => {
    const summary = summarizeLearnerState(snapshot, NOW);
    expect(summary.vocabularyTotal).toBe(4);
    expect(summary.cardTotal).toBe(4);
    expect(summary.generatedAt).toBe(NOW);
  });

  it("counts due cards with the existing rule: scheduled, not suspended", () => {
    const summary = summarizeLearnerState(snapshot, NOW);
    const expected = snapshot.cards.filter(c => !c.suspended && c.dueAt <= NOW).length;
    expect(summary.dueCards).toBe(expected);
    // The suspended mastered card is excluded.
    expect(summary.dueCards).toBeLessThan(snapshot.cards.length);
  });

  it("is read-only: it mutates neither the words nor the cards it is given", () => {
    const before = JSON.stringify(snapshot);
    summarizeLearnerState(snapshot, NOW);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("handles an empty or partial snapshot without inventing values", () => {
    const empty = summarizeLearnerState({}, NOW);
    expect(empty.vocabularyTotal).toBe(0);
    expect(empty.dueCards).toBe(0);
    expect(Object.values(empty.counts).every(v => v === 0)).toBe(true);

    const noCards = summarizeLearnerState({ words: snapshot.words }, NOW);
    expect(noCards.vocabularyTotal).toBe(4);
    expect(noCards.counts.new).toBe(3); // the ignored word is bucketed separately
    expect(noCards.counts.ignored).toBe(1);
  });

  it("reads through repositories only, issuing no writes", async () => {
    const calls = [];
    const repositories = {
      vocabulary: {
        all: async () => { calls.push("vocabulary.all"); return snapshot.words; },
        save: () => { throw new Error("service must not write"); },
        remove: () => { throw new Error("service must not write"); }
      },
      cards: {
        all: async () => { calls.push("cards.all"); return snapshot.cards; },
        save: () => { throw new Error("service must not write"); }
      }
    };

    const service = createReviewSummaryService(repositories, { clock: () => NOW });
    const summary = await service.getSummary();

    expect(calls.sort()).toEqual(["cards.all", "vocabulary.all"]);
    expect(summary.vocabularyTotal).toBe(4);
    expect(summary.generatedAt).toBe(NOW);
  });

  it("requires repositories rather than reaching for storage itself", () => {
    expect(() => createReviewSummaryService(null)).toThrow(/Repositories are required/);
  });
});
