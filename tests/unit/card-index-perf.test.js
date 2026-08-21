import { describe, expect, it } from "vitest";
import { groupCardsByWord, summarizeLearnerState } from "../../01_APPLICATION/CURRENT_APP/src/services/review-summary-service.js";
import { wordStatus, wordMastery } from "../../01_APPLICATION/CURRENT_APP/src/srs/scheduler.js";

const NOW = 1775000000000;

function makeData(wordCount, cardCount) {
  const words = Array.from({ length: wordCount }, (_, i) => ({ id: i + 1, german: `w${i}`, arabic: `م${i}`, itemType: "word" }));
  const cards = Array.from({ length: cardCount }, (_, i) => ({
    key: `${(i % wordCount) + 1}:recall`, wordId: (i % wordCount) + 1, skill: "recall", state: "review",
    dueAt: NOW + 86400000, intervalDays: 3, ease: 2.5, reps: 2, lapses: 0, streak: 2, mastery: 50,
    correct: 2, wrong: 0, suspended: false
  }));
  return { words, cards };
}

describe("card indexing", () => {
  it("groups cards by their word", () => {
    const { cards } = makeData(3, 6);
    const index = groupCardsByWord(cards);
    expect(index.get(1)).toHaveLength(2);
    expect(index.get(1).every(c => c.wordId === 1)).toBe(true);
    expect(index.get(999)).toBeUndefined();
  });

  it("handles an empty or missing card list", () => {
    expect(groupCardsByWord([]).size).toBe(0);
    expect(groupCardsByWord().size).toBe(0);
  });

  it("produces identical status and mastery to scanning the whole list", () => {
    const { words, cards } = makeData(300, 400);
    const index = groupCardsByWord(cards);
    for (const word of words) {
      const own = index.get(word.id) ?? [];
      expect(wordStatus(word, own, NOW)).toBe(wordStatus(word, cards, NOW));
      expect(wordMastery(word, own)).toBe(wordMastery(word, cards));
    }
  });

  it("keeps summary counts unchanged after the optimization", () => {
    const { words, cards } = makeData(200, 250);
    const summary = summarizeLearnerState({ words, cards }, NOW);

    const expected = {};
    for (const word of words) {
      const status = wordStatus(word, cards, NOW);
      expected[status] = (expected[status] ?? 0) + 1;
    }
    for (const [status, count] of Object.entries(expected)) {
      expect(summary.counts[status]).toBe(count);
    }
    expect(Object.values(summary.counts).reduce((a, b) => a + b, 0)).toBe(words.length);
  });

  it("reflects cards added later, since no index is cached across renders", () => {
    const { words, cards } = makeData(5, 0);
    expect(summarizeLearnerState({ words, cards }, NOW).counts.new).toBe(5);

    // The app mutates state.cards in place, so a cached index would go stale here.
    cards.push({ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW + 86400000,
      intervalDays: 3, ease: 2.5, reps: 2, lapses: 0, streak: 2, mastery: 50, correct: 2, wrong: 0, suspended: false });
    const after = summarizeLearnerState({ words, cards }, NOW);
    expect(after.counts.new).toBe(4);
  });
});
