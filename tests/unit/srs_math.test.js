import { describe, expect, it } from "vitest";
import { DAY, MINUTE } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { automaticRating, cardMastery, createCard, scheduleCard, wordStatus } from "../../01_APPLICATION/CURRENT_APP/src/srs/scheduler.js";
const NOW = 1_800_000_000_000;

describe("legacy SRS characterization", () => {
  it("creates new cards with baseline state", () => {
    expect(createCard(7, "recall", NOW)).toMatchObject({ wordId: 7, skill: "recall", state: "new", dueAt: NOW, reps: 0, ease: 2.5, mastery: 0 });
  });
  it("moves a failed card to learning", () => {
    expect(scheduleCard(createCard(7, "recall", NOW), 1, NOW)).toMatchObject({ state: "learning", intervalDays: 0, lapses: 1, wrong: 1, reps: 0, ease: 2.3, dueAt: NOW + 10 * MINUTE });
  });
  it.each([[2, 1], [3, 1], [4, 3]])("uses first-success interval for rating %i", (rating, intervalDays) => {
    const next = scheduleCard(createCard(7, "recall", NOW), rating, NOW);
    expect(next.intervalDays).toBe(intervalDays);
    expect(next.reps).toBe(1);
    expect(next.state).toBe("review");
  });
  it("increments repetitions and applies second-review formulas", () => {
    const first = scheduleCard(createCard(7, "recall", NOW), 3, NOW);
    const second = scheduleCard(first, 3, NOW + DAY);
    expect(second).toMatchObject({ reps: 2, intervalDays: 4, state: "review", ease: 2.54 });
    expect(second.dueAt).toBe(NOW + DAY + 4 * DAY);
  });
  it("clamps ease at [1.3, 3.2]", () => {
    const low = scheduleCard({ ...createCard(1, "recall", NOW), ease: 1.3 }, 1, NOW);
    const high = scheduleCard({ ...createCard(1, "recall", NOW), ease: 3.2, reps: 2, intervalDays: 4 }, 4, NOW);
    expect(low.ease).toBe(1.3);
    expect(high.ease).toBe(3.2);
  });

  it("preserves the mastered transition", () => {
    const card = { ...createCard(1, "recall", NOW), state: "review", reps: 4, correct: 4, streak: 4, intervalDays: 20 };
    const next = scheduleCard(card, 4, NOW);
    expect(next).toMatchObject({ state: "mastered", reps: 5, intervalDays: 57, dueAt: NOW + 57 * DAY });
    expect(next.mastery).toBe(cardMastery(next));
  });

  it("preserves automatic rating and word status rules", () => {
    expect(automaticRating({ isCorrect: true, type: "perfect" }, { elapsedMs: 5000 })).toBe(4);
    expect(automaticRating({ isCorrect: false, type: "wrong" })).toBe(1);
    expect(wordStatus({ id: 1, ignored: true }, [], NOW)).toBe("ignored");
  });
});
