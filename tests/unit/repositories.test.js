import { describe, expect, it, vi } from "vitest";
import { createRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/repositories.js";

function adapter() {
  return Object.fromEntries(["getAll", "get", "put", "bulkPut", "delete", "clear", "bulkDelete", "add", "getAttemptsSince", "getByIndex", "getMeta", "setMeta", "initialize", "replaceAll"].map(name => [name, vi.fn(async (...args) => args)]));
}

describe("repository abstraction", () => {
  it("routes vocabulary and card operations to the current adapter", async () => {
    const db = adapter();
    const repositories = createRepositories(db);
    await repositories.vocabulary.save({ id: 7 });
    await repositories.cards.removeMany(["7:recall"]);
    expect(db.put).toHaveBeenCalledWith("words", { id: 7 });
    expect(db.bulkDelete).toHaveBeenCalledWith("cards", ["7:recall"]);
  });

  it("routes attempts and metadata without changing values", async () => {
    const db = adapter();
    const repositories = createRepositories(db);
    await repositories.attempts.byWordId(7);
    await repositories.metadata.set("settings", { theme: "dark" });
    expect(db.getByIndex).toHaveBeenCalledWith("attempts", "wordId", 7);
    expect(db.setMeta).toHaveBeenCalledWith("settings", { theme: "dark" });
  });

  it("requires an injected persistence adapter", () => {
    expect(() => createRepositories()).toThrow(TypeError);
  });
});
