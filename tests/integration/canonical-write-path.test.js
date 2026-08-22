/*
 * The canonical incremental write path.
 *
 * The invariants this suite defends:
 *   - a multi-row aggregate is written whole or not at all
 *   - append-only history cannot be edited
 *   - review_cards can only be written through the named SRS path
 *   - anything a learner earned is soft-deleted, never removed
 *   - every value is bound; no caller string reaches the SQL text
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import {
  APPEND_ONLY_ENTITIES, PROTECTED_ENTITIES, RevisionConflictError, WritePolicyError,
  conflictTargetFor, policyFor, uniqueKeysFor
} from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/write-policy.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "draft", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()();
});

async function fresh() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter), executor };
}

/** A vocabulary row every foreign key in this file can hang off. */
async function seedVocabulary(adapter) {
  await adapter.insert("profiles", {
    uuid: PROFILE, username: "test", streak: 0, totalXP: 0, createdAt: NOW, updatedAt: NOW
  }, { now: NOW });
  await adapter.insert("vocabularyItems", {
    uuid: "v-haus", legacyId: "1", german: "das Haus", normalizedGerman: "das haus",
    article: "das", itemType: "noun",
    level: "A1", ...meta
  }, { now: NOW });
  return "v-haus";
}

/* ------------------------------------------------------------------ CRUD */

describe("insert, read, update", () => {
  it("inserts a row and reads it back by uuid", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);

    const record = await adapter.getByUuid("vocabularyItems", "v-haus");
    expect(record).toMatchObject({ german: "das Haus", article: "das", level: "A1" });
    expect(await adapter.exists("vocabularyItems", "v-haus")).toBe(true);
    expect(await adapter.exists("vocabularyItems", "nope")).toBe(false);
    expect(await adapter.getByUuid("vocabularyItems", "nope")).toBeNull();
  });

  it("stamps created_at, updated_at, revision and deleted when omitted", async () => {
    const { adapter } = await fresh();
    await adapter.insert("vocabularyItems",
      { uuid: "v-1", german: "der Zug", normalizedGerman: "der zug", itemType: "noun" }, { now: NOW });
    expect(await adapter.getByUuid("vocabularyItems", "v-1")).toMatchObject({
      createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
    });
  });

  it("advances revision and updated_at on every update", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);

    await adapter.update("vocabularyItems", "v-haus", { level: "A2" }, { now: NOW + 1000 });
    const first = await adapter.getByUuid("vocabularyItems", "v-haus");
    expect(first).toMatchObject({ level: "A2", revision: 2, updatedAt: NOW + 1000 });

    await adapter.update("vocabularyItems", "v-haus", { level: "B1" }, { now: NOW + 2000 });
    expect((await adapter.getByUuid("vocabularyItems", "v-haus")).revision).toBe(3);
  });

  it("refuses to let an update rewrite identity or creation time", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    await adapter.update("vocabularyItems", "v-haus",
      { uuid: "hijacked", createdAt: 1, revision: 99, level: "A2" }, { now: NOW + 1000 });

    const record = await adapter.getByUuid("vocabularyItems", "v-haus");
    expect(record).toMatchObject({ uuid: "v-haus", createdAt: NOW, revision: 2, level: "A2" });
    expect(await adapter.exists("vocabularyItems", "hijacked")).toBe(false);
  });

  it("reports how many rows an update touched", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    expect(await adapter.update("vocabularyItems", "v-haus", { level: "A2" })).toBe(1);
    expect(await adapter.update("vocabularyItems", "missing", { level: "A2" })).toBe(0);
  });

  it("rejects an unknown field instead of silently dropping it", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    await expect(adapter.insert("vocabularyItems", { uuid: "v-2", nonsense: 1 }))
      .rejects.toThrow(/Unknown field/);
    await expect(adapter.update("vocabularyItems", "v-haus", { nonsense: 1 }))
      .rejects.toThrow(/Unknown field/);
    await expect(adapter.find("vocabularyItems", { nonsense: 1 }))
      .rejects.toThrow(/Unknown field/);
  });

  it("rejects an unknown entity", async () => {
    const { adapter } = await fresh();
    await expect(adapter.insert("nope", { uuid: "x" })).rejects.toThrow(/Unknown canonical entity/);
    await expect(adapter.find("nope")).rejects.toThrow(/Unknown canonical entity/);
  });
});

/* ---------------------------------------------------- optimistic concurrency */

describe("revision conflicts", () => {
  it("applies an update when the expected revision matches", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    expect(await adapter.update("vocabularyItems", "v-haus", { level: "A2" },
      { expectedRevision: 1, now: NOW })).toBe(1);
  });

  it("reports a conflict rather than overwriting a row that moved underneath", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    await adapter.update("vocabularyItems", "v-haus", { level: "A2" }, { now: NOW });

    await expect(adapter.update("vocabularyItems", "v-haus", { level: "B1" },
      { expectedRevision: 1, now: NOW })).rejects.toThrow(RevisionConflictError);
    // The other writer's value survived.
    expect((await adapter.getByUuid("vocabularyItems", "v-haus")).level).toBe("A2");
  });

  it("does not call a missing row a conflict", async () => {
    const { adapter } = await fresh();
    expect(await adapter.update("vocabularyItems", "ghost", { level: "A2" },
      { expectedRevision: 1 })).toBe(0);
  });
});

/* ---------------------------------------------------------------- upsert */

describe("upsert", () => {
  it("uses the schema's own UNIQUE constraint as the identity", async () => {
    expect(conflictTargetFor("reminderSettings")).toEqual(["profile_uuid"]);
    expect(conflictTargetFor("lessonProgress")).toEqual(["profile_uuid", "lesson_uuid"]);
    expect(conflictTargetFor("errorPatterns"))
      .toEqual(["profile_uuid", "category_uuid", "content_type", "content_uuid"]);
    // No natural key means the uuid is the identity.
    expect(conflictTargetFor("sentences")).toEqual(["uuid"]);
    expect(uniqueKeysFor("lessonProgress")).toContainEqual(["profile_uuid", "lesson_uuid"]);
  });

  it("keeps one row per learner and lesson however often it is written", async () => {
    const { adapter } = await fresh();
    const row = uuid => ({
      uuid, profileUuid: PROFILE, lessonUuid: "l-1", status: "in_progress", ...linkMeta
    });

    await adapter.upsert("lessonProgress", row("lp-1"), { now: NOW });
    await adapter.upsert("lessonProgress",
      { ...row("lp-2"), status: "completed", completedAt: NOW }, { now: NOW + 1000 });

    const rows = await adapter.find("lessonProgress", { profileUuid: PROFILE });
    expect(rows).toHaveLength(1);
    // Identity and creation survive; the state and revision move.
    expect(rows[0]).toMatchObject({
      uuid: "lp-1", status: "completed", completedAt: NOW, createdAt: NOW, revision: 2
    });
  });

  it("keeps different learners apart under the same natural key", async () => {
    const { adapter } = await fresh();
    await adapter.upsert("lessonProgress",
      { uuid: "lp-1", profileUuid: PROFILE, lessonUuid: "l-1", status: "completed", ...linkMeta });
    await adapter.upsert("lessonProgress",
      { uuid: "lp-2", profileUuid: "other", lessonUuid: "l-1", status: "not_started", ...linkMeta });

    expect(await adapter.countWhere("lessonProgress")).toBe(2);
    expect((await adapter.findOne("lessonProgress", { profileUuid: PROFILE })).status).toBe("completed");
  });

  it("refreshes an authored text in place on re-import", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences",
      { uuid: "s-1", german: "Das Haus ist groß.", level: "A1", ordering: 1, ...meta });

    const text = uuid => ({
      uuid, sentenceUuid: "s-1", language: "en", kind: "translation",
      text: "The house is big.", ...meta
    });
    await adapter.upsert("sentenceTexts", text("t-1"), { now: NOW });
    await adapter.upsert("sentenceTexts",
      { ...text("t-2"), text: "The house is large.", contentStatus: "verified" }, { now: NOW + 1 });

    const rows = await adapter.find("sentenceTexts", { sentenceUuid: "s-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uuid: "t-1", text: "The house is large.", contentStatus: "verified" });
  });

  it("rejects an unknown conflict column", async () => {
    const { adapter } = await fresh();
    await expect(adapter.upsert("sentences", { uuid: "s-1", german: "x", ...meta },
      { conflictTarget: ["nope"] })).rejects.toThrow(/Unknown conflict column/);
  });
});

/* ------------------------------------------------------------- filtering */

describe("filtered reads", () => {
  async function seedSentences(adapter) {
    for (const [uuid, level, ordering] of [["s-1", "A1", 2], ["s-2", "A1", 1], ["s-3", "A2", 3]]) {
      await adapter.insert("sentences",
        { uuid, german: `Satz ${uuid}`, level, ordering, register: "neutral", ...meta });
    }
  }

  it("filters on equality and orders deterministically", async () => {
    const { adapter } = await fresh();
    await seedSentences(adapter);
    const rows = await adapter.find("sentences", { level: "A1" }, { orderBy: ["ordering"] });
    expect(rows.map(r => r.uuid)).toEqual(["s-2", "s-1"]);
  });

  it("supports IN, descending order, limit and offset", async () => {
    const { adapter } = await fresh();
    await seedSentences(adapter);
    expect((await adapter.find("sentences", { uuid: ["s-1", "s-3"] })).map(r => r.uuid))
      .toEqual(["s-1", "s-3"]);
    expect((await adapter.find("sentences", {}, { orderBy: [["ordering", "desc"]] })).map(r => r.uuid))
      .toEqual(["s-3", "s-1", "s-2"]);
    expect((await adapter.find("sentences", {}, { orderBy: ["ordering"], limit: 1, offset: 1 }))
      .map(r => r.uuid)).toEqual(["s-1"]);
  });

  it("matches nothing for an empty IN list rather than everything", async () => {
    const { adapter } = await fresh();
    await seedSentences(adapter);
    expect(await adapter.find("sentences", { uuid: [] })).toEqual([]);
  });

  it("breaks ties by uuid, so the same query always returns the same order", async () => {
    const { adapter } = await fresh();
    for (const uuid of ["s-c", "s-a", "s-b"]) {
      await adapter.insert("sentences", { uuid, german: "x", level: "A1", ordering: 1, ...meta });
    }
    const once = (await adapter.find("sentences", {}, { orderBy: ["ordering"] })).map(r => r.uuid);
    expect(once).toEqual(["s-a", "s-b", "s-c"]);
    expect((await adapter.find("sentences", {}, { orderBy: ["ordering"] })).map(r => r.uuid))
      .toEqual(once);
  });

  it("rejects an unknown order field", async () => {
    const { adapter } = await fresh();
    await expect(adapter.find("sentences", {}, { orderBy: ["nope"] }))
      .rejects.toThrow(/Unknown order field/);
  });

  it("counts with the same filters", async () => {
    const { adapter } = await fresh();
    await seedSentences(adapter);
    expect(await adapter.countWhere("sentences", { level: "A1" })).toBe(2);
    expect(await adapter.countWhere("sentences")).toBe(3);
  });
});

/* --------------------------------------------------------- SQL injection */

describe("SQL parameter safety", () => {
  const HOSTILE = "'; DROP TABLE vocabulary_items; --";

  it("stores a hostile string as data, not as SQL", async () => {
    const { adapter, executor } = await fresh();
    await adapter.insert("sentences",
      { uuid: HOSTILE, german: HOSTILE, level: HOSTILE, ordering: 1, ...meta });

    const tables = await executor.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vocabulary_items'", []);
    expect(tables).toHaveLength(1);                     // the table is still there
    expect((await adapter.getByUuid("sentences", HOSTILE)).german).toBe(HOSTILE);
  });

  it("treats a hostile filter value as a value", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    expect(await adapter.find("sentences", { level: `A1' OR '1'='1` })).toEqual([]);
    expect(await adapter.countWhere("sentences", { german: HOSTILE })).toBe(0);
  });

  it("survives a hostile string through an update and an upsert", async () => {
    const { adapter, executor } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    await adapter.update("sentences", "s-1", { german: HOSTILE });
    await adapter.upsert("sentences",
      { uuid: "s-1", german: `${HOSTILE} again`, level: "A1", ordering: 1, ...meta });

    expect((await adapter.getByUuid("sentences", "s-1")).german).toBe(`${HOSTILE} again`);
    expect(await executor.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sentences'", [])).toHaveLength(1);
  });

  it("never interpolates a caller value into SQL text", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(),
      "01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js"), "utf8");
    // Template placeholders in SQL come only from spec-resolved names and fixed keywords.
    const interpolations = [...source.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1].trim());
    const allowed = /^(spec\.table|spec\.entity|entity|field|column|value|name|target\.join\(", "\)|pairs\.map|assignments\.join|clause\.sql|clauses\.join|parts\.join|sets\.join|where|String\(direction\)|cols\.join|placeholders|orderClause|table)/;
    for (const expression of interpolations) {
      expect(allowed.test(expression), `unreviewed interpolation: ${expression}`).toBe(true);
    }
  });
});

/* ---------------------------------------------------------- transactions */

describe("transactions", () => {
  it("commits every row of an aggregate together", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);

    await repositories.write.content.saveSentence({
      sentence: { uuid: "s-1", german: "Das Haus ist groß.", level: "A1", ordering: 1, ...meta },
      texts: [
        { uuid: "t-en", sentenceUuid: "s-1", language: "en", kind: "translation", text: "The house is big.", ...meta },
        { uuid: "t-ar", sentenceUuid: "s-1", language: "ar", kind: "translation", text: "البيت كبير.", ...meta }
      ],
      vocabulary: [{ uuid: "sv-1", sentenceUuid: "s-1", vocabUuid: "v-haus", role: "target", ...linkMeta }],
      grammar: [],
      tags: [{ uuid: "tg-1", sentenceUuid: "s-1", tag: "wohnen", ...linkMeta }]
    }, { now: NOW });

    expect(await adapter.countWhere("sentences")).toBe(1);
    expect(await adapter.countWhere("sentenceTexts")).toBe(2);
    expect(await adapter.countWhere("sentenceVocabulary")).toBe(1);
    expect(await adapter.countWhere("sentenceTags")).toBe(1);
  });

  it("rolls the whole aggregate back when any part fails", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);

    await expect(repositories.write.content.saveSentence({
      sentence: { uuid: "s-1", german: "Das Haus ist groß.", level: "A1", ordering: 1, ...meta },
      texts: [{ uuid: "t-en", sentenceUuid: "s-1", language: "en", kind: "translation", text: "ok", ...meta }],
      // A link to a vocabulary item that does not exist: the foreign key must refuse it.
      vocabulary: [{ uuid: "sv-1", sentenceUuid: "s-1", vocabUuid: "v-missing", role: "target", ...linkMeta }],
      grammar: [],
      tags: []
    }, { now: NOW })).rejects.toThrow();

    // Nothing survived: not the sentence, not the translation that had already been written.
    expect(await adapter.countWhere("sentences")).toBe(0);
    expect(await adapter.countWhere("sentenceTexts")).toBe(0);
    expect(await adapter.countWhere("sentenceVocabulary")).toBe(0);
  });

  it("rolls back a failure raised by the caller, not only by SQLite", async () => {
    const { adapter } = await fresh();
    await expect(adapter.transaction(async tx => {
      await tx.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
      throw new Error("changed my mind");
    })).rejects.toThrow("changed my mind");
    expect(await adapter.countWhere("sentences")).toBe(0);
  });

  it("returns the transaction body's value", async () => {
    const { adapter } = await fresh();
    expect(await adapter.transaction(async () => "done")).toBe("done");
  });

  it("runs a nested transaction inline rather than issuing a second BEGIN", async () => {
    const { adapter } = await fresh();
    await adapter.transaction(async tx => {
      await tx.transaction(async inner => {
        await inner.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
      });
      await tx.insert("sentences", { uuid: "s-2", german: "y", level: "A1", ordering: 2, ...meta });
    });
    expect(await adapter.countWhere("sentences")).toBe(2);
  });

  it("rolls back the outer unit when a nested part fails", async () => {
    const { adapter } = await fresh();
    await expect(adapter.transaction(async tx => {
      await tx.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
      await tx.transaction(async () => { throw new Error("inner"); });
    })).rejects.toThrow("inner");
    expect(await adapter.countWhere("sentences")).toBe(0);
  });

  it("requires a transaction body", async () => {
    const { adapter } = await fresh();
    await expect(adapter.transaction(null)).rejects.toThrow(/transaction body/);
  });
});

/* ----------------------------------------------------------- foreign keys */

describe("referential integrity", () => {
  it("refuses a child row whose parent does not exist", async () => {
    const { adapter } = await fresh();
    await expect(adapter.insert("sentenceTexts",
      { uuid: "t-1", sentenceUuid: "missing", language: "en", kind: "translation", text: "x", ...meta }))
      .rejects.toThrow();
  });

  it("refuses a duplicate uuid", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    await expect(adapter.insert("sentences", { uuid: "s-1", german: "y", level: "A1", ordering: 2, ...meta }))
      .rejects.toThrow();
  });

  it("refuses a duplicate natural key on insert", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    const text = uuid => ({ uuid, sentenceUuid: "s-1", language: "en", kind: "translation", text: "x", ...meta });
    await adapter.insert("sentenceTexts", text("t-1"));
    await expect(adapter.insert("sentenceTexts", text("t-2"))).rejects.toThrow();
  });
});

/* ------------------------------------------------------- delete semantics */

describe("deletion preserves what a learner earned", () => {
  it("soft-deletes and hides the row from ordinary reads", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });

    expect(await adapter.softDelete("sentences", "s-1", { now: NOW + 1000 })).toBe(1);
    expect(await adapter.find("sentences")).toEqual([]);
    expect(await adapter.countWhere("sentences")).toBe(0);

    const hidden = await adapter.find("sentences", {}, { includeDeleted: true });
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ deleted: 1, revision: 2, updatedAt: NOW + 1000 });
  });

  it("restores a soft-deleted row", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    await adapter.softDelete("sentences", "s-1");
    expect(await adapter.restore("sentences", "s-1")).toBe(1);
    expect(await adapter.find("sentences")).toHaveLength(1);
  });

  it("refuses to hard-delete learner history", async () => {
    const { adapter } = await fresh();
    for (const entity of ["errorEvents", "pronunciationAttempts", "lessonProgress",
      "reminderSettings", "quarantine", "profiles"]) {
      await expect(adapter.hardDelete(entity, "x"), `${entity} must be preserved`)
        .rejects.toThrow(WritePolicyError);
    }
  });

  it("allows hard delete of authored content, which is replaceable", async () => {
    const { adapter } = await fresh();
    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    expect(await adapter.hardDelete("sentences", "s-1")).toBe(1);
    expect(await adapter.find("sentences", {}, { includeDeleted: true })).toEqual([]);
  });
});

/* ------------------------------------------------------- append-only history */

describe("history cannot be rewritten", () => {
  it("refuses to update an append-only record", async () => {
    const { adapter } = await fresh();
    for (const entity of APPEND_ONLY_ENTITIES) {
      await expect(adapter.update(entity, "x", { deleted: 0 }), `${entity} must be append-only`)
        .rejects.toThrow(WritePolicyError);
      await expect(adapter.upsert(entity, { uuid: "x" })).rejects.toThrow(WritePolicyError);
    }
  });

  it("still allows an append-only record to be written once", async () => {
    const { adapter } = await fresh();
    await seedVocabulary(adapter);
    await adapter.insert("errorEvents", {
      uuid: "e-1", profileUuid: PROFILE, occurredAt: NOW, skill: "recall", answerLanguage: "de",
      contentType: "vocabulary", contentUuid: "v-haus", evaluationType: "article_wrong",
      scored: 1, expectedAnswer: "das Haus", userAnswer: "der Haus", ...linkMeta
    });
    expect(await adapter.countWhere("errorEvents")).toBe(1);
  });

  it("explains the refusal rather than failing obscurely", async () => {
    const { adapter } = await fresh();
    await expect(adapter.update("errorEvents", "x", { scored: 0 }))
      .rejects.toThrow(/append-only historical record/);
  });
});

/* ------------------------------------------------------------ SRS protection */

describe("SRS state moves only through the named path", () => {
  it("refuses review_cards on the whole generic write surface", async () => {
    const { adapter } = await fresh();
    for (const operation of ["insert", "update", "upsert", "softDelete", "hardDelete"]) {
      const call = operation === "insert" || operation === "upsert"
        ? adapter[operation]("reviewCards", { uuid: "c-1" })
        : adapter[operation]("reviewCards", "c-1", { ease: 9 });
      await expect(call, `${operation} must be refused`).rejects.toThrow(WritePolicyError);
    }
    expect(PROTECTED_ENTITIES).toContain("reviewCards");
    expect(policyFor("reviewCards")).toMatchObject({ insert: false, update: false, protected: true });
  });

  it("exposes no write method on the cards repository", async () => {
    const { repositories } = await fresh();
    expect(Object.keys(repositories.cards).sort())
      .toEqual(["all", "count", "exists", "find", "findOne", "get"]);
  });

  it("persists a scheduled card and its review event atomically", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);

    const card = {
      uuid: "c-1", legacyKey: "1:recall", profileUuid: PROFILE, vocabUuid: "v-haus",
      skill: "recall", state: "review", dueAt: NOW + 86400000, intervalDays: 3, ease: 2.5,
      reps: 2, lapses: 0, streak: 1, mastery: 40, correct: 2, wrong: 0,
      stability: 0, difficulty: 5, suspended: 0, ...linkMeta
    };
    await repositories.srs.applyScheduledCard(card, {
      now: NOW,
      event: { uuid: "ev-1", legacyId: "1", cardUuid: "c-1", vocabUuid: "v-haus",
        skill: "recall", correct: 1, elapsedMs: 1200, ...linkMeta }
    });

    expect(await adapter.countWhere("reviewCards")).toBe(1);
    expect(await adapter.countWhere("reviewEvents")).toBe(1);
  });

  it("updates the same card in place on the next review", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);
    const card = {
      uuid: "c-1", profileUuid: PROFILE, vocabUuid: "v-haus", skill: "recall", state: "review",
      dueAt: NOW, intervalDays: 3, ease: 2.5, reps: 2, lapses: 0, streak: 1, mastery: 40,
      correct: 2, wrong: 0, stability: 0, difficulty: 5, suspended: 0, ...linkMeta
    };
    await repositories.srs.applyScheduledCard(card, { now: NOW });
    await repositories.srs.applyScheduledCard(
      { ...card, uuid: "c-2", intervalDays: 7, ease: 2.6, reps: 3, mastery: 55 }, { now: NOW + 1000 });

    const rows = await adapter.find("reviewCards", { profileUuid: PROFILE });
    expect(rows).toHaveLength(1);                        // one card per (profile, word, skill)
    expect(rows[0]).toMatchObject({ uuid: "c-1", intervalDays: 7, ease: 2.6, mastery: 55, revision: 2 });
  });

  it("rolls back the card when its review event is invalid", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);
    await expect(repositories.srs.applyScheduledCard({
      uuid: "c-1", profileUuid: PROFILE, vocabUuid: "v-haus", skill: "recall", state: "review",
      dueAt: NOW, intervalDays: 3, ease: 2.5, reps: 1, lapses: 0, streak: 1, mastery: 10,
      correct: 1, wrong: 0, stability: 0, difficulty: 5, suspended: 0, ...linkMeta
    }, {
      now: NOW,
      event: { uuid: "ev-1", cardUuid: "missing-card", correct: 1, ...linkMeta }
    })).rejects.toThrow();

    expect(await adapter.countWhere("reviewCards")).toBe(0);
  });

  it("requires a scheduled card to carry its uuid", async () => {
    const { adapter } = await fresh();
    await expect(adapter.applyScheduledCard({ profileUuid: PROFILE })).rejects.toThrow(/uuid/);
  });
});

/* ------------------------------------------------------ domain write APIs */

describe("repository write APIs", () => {
  it("saves multilingual content with English and Arabic as peers", async () => {
    const { adapter, repositories } = await fresh();
    await adapter.insert("profiles",
      { uuid: PROFILE, username: "t", streak: 0, totalXP: 0, createdAt: NOW, updatedAt: NOW });

    await repositories.write.content.saveVocabulary({
      item: { uuid: "v-1", german: "das Buch", normalizedGerman: "das buch", article: "das",
        itemType: "noun", level: "A1", ...meta },
      meanings: [{ uuid: "m-1", vocabUuid: "v-1", arabicText: "كتاب", normalizedArabic: "كتاب", ...meta }],
      // Since schema 11 both support languages hang off the WORD; naming the Arabic
      // sense is optional, and English does not pass through it.
      translations: [{ uuid: "tr-1", vocabUuid: "v-1", meaningUuid: "m-1", englishText: "book",
        normalizedEnglish: "book", ...meta }],
      acceptedAnswers: [
        { uuid: "aa-en", vocabUuid: "v-1", translationUuid: "tr-1", text: "book",
          language: "en", scoreable: 1, ...linkMeta },
        // Arabic is stored as content and marked unscoreable, exactly as Feature A requires.
        { uuid: "aa-ar", vocabUuid: "v-1", meaningUuid: "m-1", text: "كتاب",
          language: "ar", scoreable: 0, ...linkMeta }
      ]
    }, { now: NOW });

    expect(await adapter.countWhere("translations")).toBe(1);
    expect(await adapter.countWhere("vocabularyMeanings")).toBe(1);
    const arabic = await adapter.findOne("acceptedAnswers", { language: "ar" });
    expect(arabic.scoreable).toBe(0);
  });

  it("saves a course with its lessons in one unit", async () => {
    const { adapter, repositories } = await fresh();
    await repositories.write.content.saveCourse({
      course: { uuid: "c-1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1, ...meta },
      levels: [{ uuid: "cl-1", courseUuid: "c-1", cefrLevel: "A1", ordering: 1, ...linkMeta }],
      units: [{ uuid: "u-1", courseUuid: "c-1", courseLevelUuid: "cl-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [{ uuid: "l-1", unitUuid: "u-1", slug: "greetings", cefrLevel: "A1", ordering: 1, ...meta }],
      sections: [{ uuid: "sec-1", lessonUuid: "l-1", slug: "words", sectionKind: "vocabulary", ordering: 1, ...meta }],
      items: [{ uuid: "i-1", sectionUuid: "sec-1", contentType: "vocabulary", contentUuid: "v-1", ordering: 1, required: 1, ...linkMeta }],
      prerequisites: [],
      texts: [{ uuid: "ct-1", ownerType: "course", ownerUuid: "c-1", language: "en", kind: "title", text: "Netzwerk A1", ...meta }]
    }, { now: NOW });

    expect(await adapter.countWhere("lessons")).toBe(1);
    expect(await adapter.countWhere("lessonItems")).toBe(1);
    expect(await adapter.countWhere("curriculumTexts")).toBe(1);
  });

  it("records a lesson completion without touching SRS", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);
    const card = {
      uuid: "c-1", profileUuid: PROFILE, vocabUuid: "v-haus", skill: "recall", state: "review",
      dueAt: NOW + 500000, intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3,
      mastery: 64, correct: 7, wrong: 2, stability: 0, difficulty: 5, suspended: 0, ...linkMeta
    };
    await repositories.srs.applyScheduledCard(card, { now: NOW });
    const before = await adapter.getByUuid("reviewCards", "c-1");

    await repositories.write.progress.recordLessonProgress({
      lesson: { uuid: "lp-1", profileUuid: PROFILE, lessonUuid: "l-1", status: "completed",
        completedAt: NOW, ...linkMeta },
      sections: [
        { uuid: "sp-1", profileUuid: PROFILE, sectionUuid: "sec-1", status: "completed", ...linkMeta },
        { uuid: "sp-2", profileUuid: PROFILE, sectionUuid: "sec-2", status: "completed", ...linkMeta }
      ],
      course: { uuid: "cp-1", profileUuid: PROFILE, courseUuid: "c-1", status: "in_progress",
        lastLessonUuid: "l-1", ...linkMeta }
    }, { now: NOW + 1000 });

    expect(await adapter.countWhere("sectionProgress")).toBe(2);
    // The card is byte-identical: lesson completion and SRS mastery stay separate.
    expect(await adapter.getByUuid("reviewCards", "c-1")).toEqual(before);
  });

  it("records an error event with its classifications atomically", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);
    await adapter.insert("errorCategories",
      { uuid: "cat-1", slug: "article-wrong", scope: "morphology", ordering: 1, ...meta });

    await repositories.write.errors.recordEvent({
      event: { uuid: "e-1", profileUuid: PROFILE, occurredAt: NOW, skill: "recall",
        answerLanguage: "de", contentType: "vocabulary", contentUuid: "v-haus",
        evaluationType: "article_wrong", scored: 1, expectedAnswer: "das Haus",
        userAnswer: "der Haus", ...linkMeta },
      links: [{ uuid: "l-1", eventUuid: "e-1", categoryUuid: "cat-1",
        source: "deterministic", confidence: 1, ...linkMeta }]
    }, { now: NOW });

    expect(await adapter.countWhere("errorEvents")).toBe(1);
    expect(await adapter.countWhere("errorEventCategories")).toBe(1);
  });

  it("rolls back an error event whose classification is unlinkable", async () => {
    const { adapter, repositories } = await fresh();
    await seedVocabulary(adapter);
    await expect(repositories.write.errors.recordEvent({
      event: { uuid: "e-1", profileUuid: PROFILE, occurredAt: NOW, skill: "recall",
        answerLanguage: "de", contentType: "vocabulary", contentUuid: "v-haus",
        evaluationType: "wrong", scored: 1, expectedAnswer: "x", userAnswer: "y", ...linkMeta },
      links: [{ uuid: "l-1", eventUuid: "e-1", categoryUuid: "cat-missing",
        source: "deterministic", confidence: 1, ...linkMeta }]
    }, { now: NOW })).rejects.toThrow();

    expect(await adapter.countWhere("errorEvents")).toBe(0);
  });

  it("refreshes error patterns in place, keeping one row per learner and cause", async () => {
    const { adapter, repositories } = await fresh();
    await adapter.insert("errorCategories",
      { uuid: "cat-1", slug: "article-wrong", scope: "morphology", ordering: 1, ...meta });
    const pattern = (uuid, occurrences) => ({
      uuid, profileUuid: PROFILE, categoryUuid: "cat-1", contentType: "vocabulary",
      contentUuid: "v-haus", occurrences, firstSeenAt: NOW, lastSeenAt: NOW,
      status: "active", ...linkMeta
    });

    await repositories.write.errors.refreshPatterns([pattern("p-1", 2)], { now: NOW });
    await repositories.write.errors.refreshPatterns([pattern("p-2", 5)], { now: NOW + 1000 });

    const rows = await adapter.find("errorPatterns", { profileUuid: PROFILE });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uuid: "p-1", occurrences: 5, revision: 2 });
  });

  it("records a spoken attempt with no correctness field to record", async () => {
    const { adapter, repositories } = await fresh();
    await adapter.insert("pronunciationItems",
      { uuid: "pi-1", slug: "buecher", practiceMode: "listen_repeat", level: "A1", ordering: 1, ...meta });

    await repositories.write.pronunciation.recordAttempt({
      uuid: "pa-1", profileUuid: PROFILE, itemUuid: "pi-1", occurredAt: NOW,
      selfRating: 3, advisoryScore: 0.4, advisorySource: "asr", note: "", ...linkMeta
    }, { now: NOW });

    const attempt = await adapter.getByUuid("pronunciationAttempts", "pa-1");
    expect(attempt).toMatchObject({ selfRating: 3, advisoryScore: 0.4, advisorySource: "asr" });
    expect(attempt).not.toHaveProperty("correct");
    expect(attempt).not.toHaveProperty("scored");
  });

  it("saves listening metadata with its audio asset first", async () => {
    const { adapter, repositories } = await fresh();
    await repositories.write.content.saveListening({
      audio: { uuid: "a-1", slug: "am-bahnhof", availability: "source-only", localPath: "",
        sourcePath: "x.mp3", mimeType: "audio/mpeg", byteSize: 1, durationMs: 0, ...meta },
      item: { uuid: "li-1", slug: "am-bahnhof", audioUuid: "a-1", activityType: "dialogue",
        level: "A2", ordering: 1, ...meta },
      texts: [{ uuid: "lt-1", itemUuid: "li-1", language: "de", kind: "transcript", text: "Guten Tag.", ...meta }],
      speakers: [], segments: [], segmentTexts: [], links: []
    }, { now: NOW });

    expect((await adapter.getByUuid("listeningItems", "li-1")).audioUuid).toBe("a-1");
    expect(await adapter.countWhere("audioAssets")).toBe(1);
  });

  it("saves reminder settings and schedule rows together", async () => {
    const { adapter, repositories } = await fresh();
    await repositories.write.reminders.save({
      settings: { uuid: "rs-1", profileUuid: PROFILE, enabled: 1, dailyEnabled: 1,
        dailyTime: "19:30", dueReviewEnabled: 0, dueReviewTime: "09:00", dueReviewMinimum: 5,
        minGapHours: 6, skipIfStudiedToday: 1, timeZone: "", permissionState: "granted",
        permissionCheckedAt: NOW, ...linkMeta },
      scheduled: [{ uuid: "sc-1", profileUuid: PROFILE, kind: "daily_study", notificationId: 1001,
        scheduledFor: NOW + 3600000, scheduledAt: NOW, status: "scheduled", reason: "scheduled", ...linkMeta }],
      cancelled: []
    }, { now: NOW });

    expect(await adapter.countWhere("reminderSettings", { profileUuid: PROFILE })).toBe(1);
    expect(await repositories.write.reminders.markDelivered("sc-1", NOW + 3600000, { now: NOW })).toBe(1);
    expect((await adapter.getByUuid("reminderSchedule", "sc-1")).status).toBe("delivered");
  });

  it("keeps one settings row per profile however often it is saved", async () => {
    const { adapter, repositories } = await fresh();
    const settings = uuid => ({ uuid, profileUuid: PROFILE, enabled: 1, dailyEnabled: 1,
      dailyTime: "19:30", dueReviewEnabled: 0, dueReviewTime: "09:00", dueReviewMinimum: 5,
      minGapHours: 6, skipIfStudiedToday: 1, timeZone: "", permissionState: "granted",
      permissionCheckedAt: NOW, ...linkMeta });

    await repositories.write.reminders.save({ settings: settings("rs-1"), scheduled: [] }, { now: NOW });
    await repositories.write.reminders.save({
      settings: { ...settings("rs-2"), dailyTime: "07:15" }, scheduled: []
    }, { now: NOW + 1000 });

    const rows = await adapter.find("reminderSettings", { profileUuid: PROFILE });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uuid: "rs-1", dailyTime: "07:15" });
  });

  it("reads a learner's own rows through the per-profile views", async () => {
    const { adapter, repositories } = await fresh();
    await adapter.upsert("lessonProgress",
      { uuid: "lp-1", profileUuid: PROFILE, lessonUuid: "l-1", status: "completed", ...linkMeta });
    await adapter.upsert("lessonProgress",
      { uuid: "lp-2", profileUuid: "other", lessonUuid: "l-1", status: "completed", ...linkMeta });

    expect(await repositories.write.progress.forProfile(PROFILE).lessons()).toHaveLength(1);
  });

  it("gives append-only entities no update method at all", async () => {
    const { repositories } = await fresh();
    expect(repositories.errorEvents.insert).toBeTypeOf("function");
    expect(repositories.errorEvents.update).toBeUndefined();
    expect(repositories.errorEvents.upsert).toBeUndefined();
    expect(repositories.pronunciationAttempts.update).toBeUndefined();
    // Ordinary content keeps the full set.
    expect(repositories.sentences.update).toBeTypeOf("function");
    expect(repositories.sentences.upsert).toBeTypeOf("function");
  });
});

/* -------------------------------------------------- migration preservation */

describe("existing migration behaviour is unchanged", () => {
  it("still imports a migrated dataset and reads it back field for field", async () => {
    const { adapter } = await fresh();
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await adapter.importCanonical(dataset);
    const readBack = await adapter.readCanonical();
    for (const entity of Object.keys(dataset)) {
      expect(sortByUuid(readBack[entity]), entity).toEqual(sortByUuid(dataset[entity]));
    }
  });

  it("leaves migrated SRS state untouched when incremental writes happen around it", async () => {
    const { adapter, repositories } = await fresh();
    const { dataset } = migrateToCanonical(fixture.clean, { now: 1771600000000 });
    await adapter.importCanonical(dataset);
    const before = await adapter.selectAll("reviewCards");
    expect(before.length).toBeGreaterThan(0);

    await adapter.insert("sentences", { uuid: "s-1", german: "x", level: "A1", ordering: 1, ...meta });
    await repositories.write.errors.refreshPatterns([]);
    await adapter.upsert("lessonProgress",
      { uuid: "lp-1", profileUuid: before[0].profileUuid, lessonUuid: "l-1", status: "completed", ...linkMeta });

    expect(await adapter.selectAll("reviewCards")).toEqual(before);
  });

  it("preserves quarantine records as unrewritable", async () => {
    const { adapter } = await fresh();
    const { dataset } = migrateToCanonical(fixture.malformed ?? fixture.clean, { now: NOW });
    await adapter.importCanonical(dataset);
    await expect(adapter.update("quarantine", "any", { reasons: "changed" }))
      .rejects.toThrow(WritePolicyError);
    await expect(adapter.hardDelete("quarantine", "any")).rejects.toThrow(WritePolicyError);
  });
});

function sortByUuid(rows) {
  return [...rows].sort((a, b) => String(a.uuid).localeCompare(String(b.uuid)));
}
