/*
 * Removing Arabic from scoring must not touch anything already recorded.
 *
 * Historical attempts, SRS records, due dates, ease, lapses, mastery and streaks all
 * predate this change and were produced under the old rules. They are learner history,
 * not something to recompute, so migration must carry them through untouched — including
 * recognition cards that were originally scored from Arabic text.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";

const NOW = 1775000000000;

/* A learner who studied recognition under the OLD Arabic-scoring rules. */
const historical = {
  words: [{
    id: 1, german: "das Haus", arabic: "بيت", pronunciation: "هاوس",
    normalizedGerman: "das haus", normalizedArabic: "بيت", itemType: "noun",
    article: "das", plural: "Häuser", level: "A1", tags: [],
    acceptedAnswers: ["das Haus"], acceptedArabicAnswers: ["منزل"],
    sourceRow: 1, favorite: false, ignored: false, userFlagged: false,
    qualityStatus: "ok", createdAt: 1700000000000, updatedAt: 1700000000000
  }],
  cards: [{
    // Built up by Arabic-scored reviews before the rule change.
    key: "1:recognition", wordId: 1, skill: "recognition", state: "review",
    dueAt: 1781234567890, intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2,
    streak: 3, mastery: 64, correct: 9, wrong: 2, stability: 18.4, difficulty: 4.5,
    lastResult: 3, suspended: false, lastReviewedAt: 1771200000000,
    createdAt: 1700000000000, updatedAt: 1771200000000
  }],
  attempts: [{
    id: 1, cardKey: "1:recognition", wordId: 1, sessionId: "s-old", skill: "recognition",
    correct: true, answerType: "perfect", userAnswer: "بيت", correctAnswer: "بيت",
    elapsedMs: 5100, rating: 3, initial: true, retryCount: 0, itemType: "noun",
    usedHint: false, revealed: false, createdAt: 1771100000000
  }],
  settings: { theme: "dark", strictArabicAnswers: true, sessionSize: 20, dailyGoal: 25 },
  profile: { streak: 4, totalXP: 900, createdAt: 1700000000000 }
};

const SRS_FIELDS = [
  "state", "dueAt", "intervalDays", "ease", "reps", "lapses", "streak",
  "mastery", "correct", "wrong", "stability", "difficulty", "lastResult", "lastReviewedAt"
];

describe("historical learner data survives the Arabic scoring change", () => {
  const { dataset } = migrateToCanonical(historical, { now: NOW });

  it("carries an Arabic-scored recognition card through field for field", () => {
    const card = dataset.reviewCards.find(c => c.legacyKey === "1:recognition");
    expect(card).toBeTruthy();
    const source = historical.cards[0];
    for (const field of SRS_FIELDS) {
      expect(card[field], `${field} changed`).toBe(source[field]);
    }
    expect(card.suspended).toBe(0);
  });

  it("keeps the recognition skill on the card rather than rewriting it", () => {
    // The skill is history. Renaming or dropping it would orphan the learner's progress.
    expect(dataset.reviewCards.find(c => c.legacyKey === "1:recognition").skill).toBe("recognition");
  });

  it("preserves a historical Arabic-scored attempt exactly as recorded", () => {
    const event = dataset.reviewEvents[0];
    const source = historical.attempts[0];
    expect(event.correct).toBe(1);            // it WAS correct under the old rules
    expect(event.skill).toBe("recognition");
    expect(event.userAnswer).toBe(source.userAnswer);
    expect(event.correctAnswer).toBe(source.correctAnswer);
    expect(event.rating).toBe(source.rating);
    expect(event.createdAt).toBe(source.createdAt);
  });

  it("does not recompute or re-grade past sessions", () => {
    // Nothing in the migration re-evaluates an answer; the recorded verdict stands.
    expect(dataset.reviewEvents).toHaveLength(historical.attempts.length);
    expect(dataset.reviewEvents.every(e => e.correct === 1)).toBe(true);
  });

  it("keeps the legacy strictArabicAnswers setting for compatibility", () => {
    // Neutralized for scoring, but not deleted: removing it would alter stored settings.
    const extras = JSON.parse(dataset.settings[0].extras);
    expect(extras.strictArabicAnswers).toBe(true);
  });

  it("still stores Arabic accepted answers, marked non-scoreable", () => {
    const arabic = dataset.acceptedAnswers.filter(a => a.language === "ar");
    expect(arabic.length).toBeGreaterThan(0);
    expect(arabic.every(a => a.scoreable === 0)).toBe(true);
  });

  it("round-trips through SQLite with the SRS values unchanged", async () => {
    const executor = createNodeSqliteExecutor(":memory:");
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    await adapter.importCanonical(dataset);

    const [stored] = await adapter.selectAll("reviewCards");
    const source = historical.cards[0];
    for (const field of SRS_FIELDS) {
      expect(stored[field], `${field} changed through SQLite`).toBe(source[field]);
    }
    expect((await adapter.verifyIntegrity()).ok).toBe(true);
    await executor.close();
  });
});
