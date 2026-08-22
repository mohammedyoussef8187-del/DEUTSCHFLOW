// @vitest-environment happy-dom
/*
 * The in-memory canonical adapter, held against the SQLite one.
 *
 * The point of this file is parity. A second storage backend is only safe if it is
 * indistinguishable from the first through the layer everything else uses, so almost
 * every test here runs the SAME operation against both adapters and compares the result
 * rather than asserting a value the memory adapter happens to produce.
 *
 * What this proves:
 *   - the real imported Nicos Weg lesson round-trips identically through both
 *   - write policy, soft delete, revisions and optimistic concurrency behave the same
 *   - constraints the DDL declares are enforced by both
 *   - a failed batch rolls back whole on both
 *   - review_cards is refused by the generic surface on both
 */

import { describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createMemoryCanonicalAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/memory/canonical-memory-adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { importNicosWegContent } from "../support/learner-journey-harness.js";

const NOW = 1775000000000;

async function sqliteAdapter() {
  const executor = createNodeSqliteExecutor(":memory:");
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, close: () => executor.close() };
}

async function memoryAdapter() {
  const adapter = createMemoryCanonicalAdapter();
  await adapter.initializeSchema();
  return { adapter, close: () => {} };
}

/** Run one body against both adapters and hand back both results for comparison. */
async function onBoth(body) {
  const sqlite = await sqliteAdapter();
  const memory = await memoryAdapter();
  try {
    return {
      sqlite: await body(sqlite.adapter, createCanonicalRepositories(sqlite.adapter)),
      memory: await body(memory.adapter, createCanonicalRepositories(memory.adapter))
    };
  } finally {
    sqlite.close();
    memory.close();
  }
}

/** What a call did, whether it returned or threw — so failures compare too. */
async function outcome(work) {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, name: error.name, message: error.message };
  }
}

const profile = {
  uuid: "p-1", username: "learner", streak: 0, lastStudyDate: null, totalXP: 0,
  cloudUserId: null, lastSessionAt: null, sessions: null
};

describe("both adapters report the same schema", () => {
  it("initializes to the same version", async () => {
    const { sqlite, memory } = await onBoth(adapter => adapter.schemaVersion());
    expect(memory).toBe(sqlite);
  });

  it("starts empty in every table", async () => {
    const { sqlite, memory } = await onBoth(adapter => adapter.readCanonical());
    expect(memory).toEqual(sqlite);
  });
});

describe("the real Nicos Weg lesson round-trips identically", () => {
  it("imports through the same intake pipeline and stores the same rows", async () => {
    const { sqlite, memory } = await onBoth(async (adapter, repositories) => {
      await importNicosWegContent(repositories);
      return adapter.readCanonical();
    });

    // Field for field, table for table: the whole imported lesson.
    expect(memory).toEqual(sqlite);
    expect(memory.courses).toHaveLength(1);
    expect(memory.vocabularyItems.length).toBeGreaterThan(0);
    expect(memory.exercises.length).toBeGreaterThan(0);
  });

  it("reads a lesson back through the repositories the same way", async () => {
    const { sqlite, memory } = await onBoth(async (adapter, repositories) => {
      await importNicosWegContent(repositories);
      return {
        lessons: await repositories.lessons.all(),
        items: await repositories.lessonItems.find({}, { orderBy: ["ordering"] }),
        oneWord: await repositories.vocabulary.findOne({ german: "erwachsen" }),
        counted: await repositories.exercises.count()
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.oneWord).not.toBeNull();
  });
});

describe("reads behave the same", () => {
  const seed = async (adapter, repositories) => {
    await adapter.insert("profiles", profile, { now: NOW });
    for (let index = 0; index < 5; index += 1) {
      await repositories.write.content.saveCourse({
        course: {
          uuid: `c-${index}`, slug: `course-${index}`, cefrLevel: index % 2 ? "A2" : "A1",
          ordering: 5 - index, sourceTitle: null, sourcePublisher: null, sourceEdition: null,
          sourceIsbn: null, contentStatus: "imported", contentVersion: 1,
          sourceReference: null, sourceType: null, verifiedAt: null, verifiedBy: null
        },
        levels: [], units: [], lessons: [], sections: [], items: [], prerequisites: [], texts: []
      }, { now: NOW });
    }
  };

  it("orders, limits and offsets identically", async () => {
    const { sqlite, memory } = await onBoth(async (adapter, repositories) => {
      await seed(adapter, repositories);
      return {
        ordered: await repositories.courses.find({}, { orderBy: [["ordering", "asc"]] }),
        descending: await repositories.courses.find({}, { orderBy: [["ordering", "desc"]] }),
        page: await repositories.courses.find({}, { orderBy: ["slug"], limit: 2, offset: 1 }),
        filtered: await repositories.courses.find({ cefrLevel: "A2" }),
        byList: await repositories.courses.find({ slug: ["course-1", "course-3"] }),
        none: await repositories.courses.find({ slug: [] }),
        counted: await repositories.courses.count({ cefrLevel: "A1" })
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.page).toHaveLength(2);
  });

  it("hides a soft-deleted row from both, and shows it to both on request", async () => {
    const { sqlite, memory } = await onBoth(async (adapter, repositories) => {
      await seed(adapter, repositories);
      await adapter.softDelete("courses", "c-2", { now: NOW });
      return {
        visible: (await repositories.courses.find({})).map(row => row.uuid),
        including: (await adapter.find("courses", {}, { includeDeleted: true })).map(r => r.uuid),
        row: await adapter.getByUuid("courses", "c-2"),
        restored: await adapter.restore("courses", "c-2", { now: NOW }),
        after: await adapter.getByUuid("courses", "c-2")
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.visible).not.toContain("c-2");
    expect(memory.including).toContain("c-2");
  });

  it("refuses an unknown field the same way in a filter and an order", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => ({
      filter: await outcome(() => adapter.find("courses", { nonsense: 1 })),
      order: await outcome(() => adapter.find("courses", {}, { orderBy: ["nonsense"] })),
      entity: await outcome(() => adapter.find("nonsense", {}))
    }));
    expect(memory).toEqual(sqlite);
    expect(memory.filter.ok).toBe(false);
  });
});

describe("writes behave the same", () => {
  it("stamps a new row and advances revision on update", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      const created = await adapter.getByUuid("profiles", "p-1");
      await adapter.update("profiles", "p-1", { streak: 3 }, { now: NOW + 1000 });
      return { created, updated: await adapter.getByUuid("profiles", "p-1") };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.created.revision).toBe(1);
    expect(memory.updated.revision).toBe(2);
    expect(memory.updated.updatedAt).toBe(NOW + 1000);
  });

  it("applies the DDL default for a column the caller left out", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      await adapter.insert("lessonProgress", {
        uuid: "lp-1", profileUuid: "p-1", lessonUuid: "lesson-x",
        startedAt: null, completedAt: null
      }, { now: NOW });
      return adapter.getByUuid("lessonProgress", "lp-1");
    });
    expect(memory).toEqual(sqlite);
    // The DDL says `status TEXT NOT NULL DEFAULT 'not_started'`; neither backend guesses.
    expect(memory.status).toBe("not_started");
  });

  it("upserts on the natural key rather than the uuid", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      const row = uuid => ({
        uuid, profileUuid: "p-1", lessonUuid: "lesson-x", status: "in_progress",
        startedAt: NOW, completedAt: null
      });
      await adapter.upsert("lessonProgress", row("lp-a"), { now: NOW });
      // A different uuid, the same (profile, lesson): one row, refreshed.
      await adapter.upsert("lessonProgress", { ...row("lp-b"), status: "completed" },
        { now: NOW + 5 });
      return {
        rows: await adapter.selectAll("lessonProgress"),
        count: await adapter.countWhere("lessonProgress", {})
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.count).toBe(1);
    expect(memory.rows[0].uuid).toBe("lp-a");         // identity survives the refresh
    expect(memory.rows[0].status).toBe("completed");
    expect(memory.rows[0].revision).toBe(2);
  });

  it("reports the same optimistic-concurrency conflict", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      await adapter.update("profiles", "p-1", { streak: 1 }, { now: NOW });
      return {
        stale: await outcome(() => adapter.update("profiles", "p-1", { streak: 9 },
          { now: NOW, expectedRevision: 1 })),
        missing: await adapter.update("profiles", "nobody", { streak: 9 }, { now: NOW })
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.stale.name).toBe("RevisionConflictError");
    expect(memory.missing).toBe(0);
  });

  it("refuses the same writes by policy", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => ({
      card: await outcome(() => adapter.upsert("reviewCards", { uuid: "rc-1" }, { now: NOW })),
      history: await outcome(() => adapter.update("errorEvents", "e-1", { note: "x" }, { now: NOW })),
      erase: await outcome(() => adapter.hardDelete("reviewEvents", "re-1")),
      unknownField: await outcome(() =>
        adapter.insert("courses", { uuid: "c", slug: "s", nope: 1 }, { now: NOW }))
    }));
    expect(memory).toEqual(sqlite);
    expect(memory.card.ok).toBe(false);
    expect(memory.card.name).toBe("WritePolicyError");
  });
});

describe("constraints the DDL declares are enforced by both", () => {
  it("refuses a duplicate uuid", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      const again = await outcome(() => adapter.insert("profiles", profile, { now: NOW }));
      return { failed: again.ok, count: await adapter.countWhere("profiles", {}) };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.failed).toBe(false);
  });

  it("refuses a second row on a natural key", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      const row = uuid => ({
        uuid, profileUuid: "p-1", lessonUuid: "lesson-x", status: "in_progress",
        startedAt: NOW, completedAt: null
      });
      await adapter.insert("lessonProgress", row("lp-a"), { now: NOW });
      const clash = await outcome(() => adapter.insert("lessonProgress", row("lp-b"), { now: NOW }));
      return { failed: clash.ok, count: await adapter.countWhere("lessonProgress", {}) };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.failed).toBe(false);
    expect(memory.count).toBe(1);
  });

  it("refuses a row whose parent does not exist", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      const orphan = await outcome(() => adapter.insert("settings", {
        uuid: "s-1", profileUuid: "nobody", theme: "auto", extras: null
      }, { now: NOW }));
      return { failed: orphan.ok, count: await adapter.countWhere("settings", {}) };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.failed).toBe(false);
    expect(memory.count).toBe(0);
  });

  it("refuses a null in a NOT NULL column", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      const bad = await outcome(() => adapter.insert("courses", {
        uuid: "c-1", slug: null, cefrLevel: "A2", ordering: 1, contentStatus: "imported",
        contentVersion: 1
      }, { now: NOW }));
      return { failed: bad.ok, count: await adapter.countWhere("courses", {}) };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.failed).toBe(false);
  });
});

describe("a failed transaction rolls back whole on both", () => {
  it("leaves nothing behind when a later write throws", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      const attempt = await outcome(() => adapter.transaction(async () => {
        await adapter.update("profiles", "p-1", { streak: 7 }, { now: NOW });
        await adapter.insert("lessonProgress", {
          uuid: "lp-1", profileUuid: "p-1", lessonUuid: "lesson-x",
          startedAt: NOW, completedAt: null
        }, { now: NOW });
        throw new Error("something later went wrong");
      }));
      return {
        threw: attempt.ok,
        profileRow: await adapter.getByUuid("profiles", "p-1"),
        progress: await adapter.countWhere("lessonProgress", {})
      };
    });
    expect(memory).toEqual(sqlite);
    expect(memory.threw).toBe(false);
    // The earlier update inside the same transaction is gone too.
    expect(memory.profileRow.streak).toBe(0);
    expect(memory.progress).toBe(0);
  });

  it("commits everything when the body completes", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.transaction(async () => {
        await adapter.insert("profiles", profile, { now: NOW });
        await adapter.insert("lessonProgress", {
          uuid: "lp-1", profileUuid: "p-1", lessonUuid: "lesson-x",
          startedAt: NOW, completedAt: null
        }, { now: NOW });
      });
      return adapter.countWhere("lessonProgress", {});
    });
    expect(memory).toEqual(sqlite);
    expect(memory).toBe(1);
  });
});

describe("the SRS path is the only way into review_cards", () => {
  it("schedules a card through applyScheduledCard on both", async () => {
    const { sqlite, memory } = await onBoth(async (adapter) => {
      await adapter.insert("profiles", profile, { now: NOW });
      await adapter.insert("vocabularyItems", {
        uuid: "v-1", legacyId: null, german: "das Haus", normalizedGerman: "haus",
        itemType: "noun", article: "das", plural: null, tags: null
      }, { now: NOW });

      const card = {
        uuid: "rc-1", legacyKey: null, profileUuid: "p-1", vocabUuid: "v-1", skill: "recall",
        state: "review", dueAt: NOW + 86400000, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0,
        streak: 1, mastery: 0, lastReviewedAt: NOW, correct: 1, wrong: 0,
        lastResult: null, suspended: 0
      };
      await adapter.applyScheduledCard(card, { now: NOW });
      await adapter.applyScheduledCard({ ...card, uuid: "rc-2", ease: 2.6 }, { now: NOW + 10 });
      return adapter.selectAll("reviewCards");
    });
    expect(memory).toEqual(sqlite);
    // One card per (profile, vocab, skill): the second call refreshed the first.
    expect(memory).toHaveLength(1);
    expect(memory[0].uuid).toBe("rc-1");
    expect(memory[0].ease).toBe(2.6);
    expect(memory[0].revision).toBe(2);
  });
});

describe("persisting and reloading the memory store", () => {
  it("restores exported rows exactly", async () => {
    const adapter = createMemoryCanonicalAdapter();
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);
    await importNicosWegContent(repositories);
    const before = await adapter.readCanonical();

    const saved = JSON.parse(JSON.stringify(adapter.memory.export()));

    const reloaded = createMemoryCanonicalAdapter();
    await reloaded.initializeSchema();
    reloaded.memory.load(saved);

    expect(await reloaded.readCanonical()).toEqual(before);
  });

  it("reports a commit for every write, and only once per transaction", async () => {
    let commits = 0;
    const adapter = createMemoryCanonicalAdapter({ onCommit: () => { commits += 1; } });
    await adapter.initializeSchema();

    await adapter.insert("profiles", profile, { now: NOW });
    expect(commits).toBe(1);

    await adapter.transaction(async () => {
      await adapter.update("profiles", "p-1", { streak: 1 }, { now: NOW });
      await adapter.update("profiles", "p-1", { streak: 2 }, { now: NOW });
    });
    expect(commits).toBe(2);

    // A rolled-back transaction changed nothing, so it reports nothing.
    await expect(adapter.transaction(async () => {
      await adapter.update("profiles", "p-1", { streak: 3 }, { now: NOW });
      throw new Error("no");
    })).rejects.toThrow();
    expect(commits).toBe(2);
  });
});
