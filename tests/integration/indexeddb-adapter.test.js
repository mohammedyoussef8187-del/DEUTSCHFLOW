import { describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createIndexedDbAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js";

function createFixture() {
  const environment = { indexedDB: new IDBFactory(), IDBKeyRange, SEED: [] };
  const DF = { DEFAULT_SETTINGS: { theme: "auto", sessionSize: 20 } };
  return { adapter: createIndexedDbAdapter(DF, environment), environment };
}

describe("IndexedDB platform adapter", () => {
  it("retains the existing database name, version, stores, and indexes", async () => {
    const { adapter } = createFixture();
    const db = await adapter.open();

    expect(adapter.DB_NAME).toBe("deutschflow_v2");
    expect(db.version).toBe(2);
    expect(Array.from(db.objectStoreNames)).toEqual(["attempts", "cards", "meta", "words"]);

    const tx = db.transaction(["words", "cards", "attempts"], "readonly");
    expect(Array.from(tx.objectStore("words").indexNames)).toEqual(["normalizedGerman", "qualityStatus"]);
    expect(Array.from(tx.objectStore("cards").indexNames)).toEqual(["dueAt", "skill", "wordId"]);
    expect(Array.from(tx.objectStore("attempts").indexNames)).toContain("answerType");
  });

  it("performs isolated CRUD and indexed attempt queries", async () => {
    const { adapter } = createFixture();
    await adapter.put("words", { id: 7, german: "Haus" });
    await adapter.add("attempts", { wordId: 7, createdAt: 200, correct: true });
    await adapter.add("attempts", { wordId: 7, createdAt: 400, correct: false });

    expect(await adapter.get("words", 7)).toEqual({ id: 7, german: "Haus" });
    expect(await adapter.getAttemptsSince(300)).toHaveLength(1);
    expect(await adapter.getByIndex("attempts", "wordId", 7)).toHaveLength(2);
  });

  it("restores learner state and legacy wording without transformation", async () => {
    const { adapter } = createFixture();
    const word = { id: 1, german: "Legacy wording", arabic: "صياغة قديمة", sourceRow: 44, acceptedAnswers: ["Legacy wording"] };
    const card = { key: "1:recall", wordId: 1, state: "review", dueAt: 1771497600000, intervalDays: 3.5, ease: 2.5, reps: 2, lapses: 0, streak: 2 };
    const attempt = { id: 1, wordId: 1, cardKey: "1:recall", createdAt: 1771490000000, correct: true };

    await adapter.replaceAll({ words: [word], cards: [card], attempts: [attempt], settings: { theme: "dark" }, profile: { streak: 8 } });

    expect(await adapter.getAll("words")).toEqual([word]);
    expect(await adapter.getAll("cards")).toEqual([card]);
    expect(await adapter.getAll("attempts")).toEqual([attempt]);
    expect(await adapter.getMeta("settings")).toEqual({ theme: "dark", sessionSize: 20 });
    expect(await adapter.getMeta("profile")).toEqual({ streak: 8 });
    expect(await adapter.getMeta("session", "missing")).toBeNull();
  });
});
