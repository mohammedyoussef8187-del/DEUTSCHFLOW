import { describe, expect, it } from "vitest";
import { loadLegacyCore } from "../support/load-legacy-core.js";

const DF = loadLegacyCore();
const NOW = 1_800_000_000_000;

describe("legacy SRS characterization", () => {
  it("creates new cards with baseline state", () => {
    expect(DF.createCard(7, "recall", NOW)).toMatchObject({ wordId: 7, skill: "recall", state: "new", dueAt: NOW, reps: 0, ease: 2.5, mastery: 0 });
  });
  it("moves a failed card to learning", () => {
    expect(DF.scheduleCard(DF.createCard(7, "recall", NOW), 1, NOW)).toMatchObject({ state: "learning", intervalDays: 0, lapses: 1, wrong: 1, reps: 0, ease: 2.3, dueAt: NOW + 10 * DF.MINUTE });
  });
  it.each([[2, 1], [3, 1], [4, 3]])("uses first-success interval for rating %i", (rating, intervalDays) => {
    const next = DF.scheduleCard(DF.createCard(7, "recall", NOW), rating, NOW);
    expect(next.intervalDays).toBe(intervalDays);
    expect(next.reps).toBe(1);
    expect(next.state).toBe("review");
  });
  it("increments repetitions and applies second-review formulas", () => {
    const first = DF.scheduleCard(DF.createCard(7, "recall", NOW), 3, NOW);
    const second = DF.scheduleCard(first, 3, NOW + DF.DAY);
    expect(second).toMatchObject({ reps: 2, intervalDays: 4, state: "review", ease: 2.54 });
    expect(second.dueAt).toBe(NOW + DF.DAY + 4 * DF.DAY);
  });
  it("clamps ease at [1.3, 3.2]", () => {
    const low = DF.scheduleCard({ ...DF.createCard(1, "recall", NOW), ease: 1.3 }, 1, NOW);
    const high = DF.scheduleCard({ ...DF.createCard(1, "recall", NOW), ease: 3.2, reps: 2, intervalDays: 4 }, 4, NOW);
    expect(low.ease).toBe(1.3);
    expect(high.ease).toBe(3.2);
  });
});
