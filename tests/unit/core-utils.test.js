import { describe, expect, it } from "vitest";
import { clamp, formatRelative, round, uniqueBy } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { inferItemType, splitArticle } from "../../01_APPLICATION/CURRENT_APP/src/core/text.js";

describe("extracted core utilities", () => {
  it("preserves numeric helpers", () => {
    expect(clamp(4, 1, 3)).toBe(3);
    expect(round(2.555, 2)).toBe(2.56);
  });

  it("preserves collection and relative-time behavior", () => {
    expect(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], x => x.id)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(formatRelative(1_000 + 60_000, 1_000)).toBe("بعد 1 دقيقة");
  });

  it("preserves article splitting and item inference", () => {
    expect(splitArticle("das Haus")).toEqual({ article: "das", rest: "Haus" });
    expect(inferItemType("Ich lerne jeden Tag.")).toBe("sentence");
  });
});
