/*
 * English and Arabic are independent educational languages.
 *
 * The rule is old — schema 2 already said "English and Arabic carry equal educational
 * weight" — but the tables did not enforce it: a translation hung off the Arabic sense by
 * a NOT NULL foreign key, so English existed only where Arabic did. Once the review
 * lifecycle began holding unreviewed Arabic back as `draft`, a VERIFIED English
 * translation disappeared with it.
 *
 * These tests run the three combinations that matter through the REAL store and the REAL
 * published view every service reads from, so neither language can be shown to suppress
 * the other, and Arabic still cannot decide correctness.
 */

import { describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createMemoryCanonicalAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/memory/canonical-memory-adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { publishedOnly } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import {
  buildContentEntries, createContentService, scoringAnswersFor
} from "../../01_APPLICATION/CURRENT_APP/src/services/content-service.js";
import { ARABIC, ENGLISH } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import fs from "node:fs";
import path from "node:path";

const NOW = 1787356800000;
const meta = {
  contentVersion: 1, sourceReference: "test", sourceType: "editorial",
  verifiedAt: null, verifiedBy: null, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
};
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

/**
 * One word with an Arabic meaning and an English translation, each at the status asked
 * for. The word itself is always published — this is about the two support languages.
 */
function word({ arabic, english }) {
  return {
    item: {
      uuid: "v-1", legacyId: null, german: "das Haus", normalizedGerman: "haus",
      itemType: "noun", article: "das", plural: "Häuser", level: "A2", tags: "",
      ignored: 0, favorite: 0, userFlagged: 0,
      qualityStatus: "ok", qualityIssues: "", qualityNote: "",
      contentStatus: "imported", ...meta
    },
    meanings: [{
      uuid: "m-1", vocabUuid: "v-1", arabicText: "بيت", normalizedArabic: "بيت",
      explanation: null, pronunciation: "", contentStatus: arabic, ...meta
    }],
    translations: [{
      uuid: "t-1", vocabUuid: "v-1", meaningUuid: null, englishText: "house",
      normalizedEnglish: "house", explanation: "a building for living in",
      contentStatus: english, ...meta
    }],
    acceptedAnswers: [
      { uuid: "aa-de", vocabUuid: "v-1", meaningUuid: null, translationUuid: null,
        text: "das Haus", language: "de", scoreable: 1, ...linkMeta },
      { uuid: "aa-en", vocabUuid: "v-1", meaningUuid: null, translationUuid: "t-1",
        text: "house", language: "en", scoreable: 1, ...linkMeta },
      // Stored as content, never scoreable. See src/content/languages.js.
      { uuid: "aa-ar", vocabUuid: "v-1", meaningUuid: "m-1", translationUuid: null,
        text: "بيت", language: "ar", scoreable: 0, ...linkMeta }
    ]
  };
}

/** Write the word into a real store, then read it back the way a screen does. */
async function readBack(statuses, { memory = false } = {}) {
  const executor = memory ? null : createNodeSqliteExecutor(":memory:");
  const adapter = memory ? createMemoryCanonicalAdapter() : createSqliteAdapter(executor);
  await adapter.initializeSchema();
  const repositories = createCanonicalRepositories(adapter);

  await repositories.write.content.saveVocabulary(word(statuses), { now: NOW });

  const service = createContentService(publishedOnly(repositories));
  const [entry] = await service.allEntries();
  const stored = {
    meanings: await repositories.meanings.count(),
    translations: await repositories.translations.count()
  };
  executor?.close();
  return { entry, stored };
}

describe("a draft in one language never hides another", () => {
  it("shows German and English when the Arabic is still a draft", async () => {
    const { entry, stored } = await readBack({ arabic: "draft", english: "verified" });

    expect(entry.german).toBe("das Haus");
    expect(entry.primary.english).toBe("house");
    expect(entry.primary.arabic).toBeNull();
    expect(entry.coverage[ENGLISH]).toBe(true);
    expect(entry.coverage[ARABIC]).toBe(false);

    // Held back, not thrown away: the Arabic is in the store, awaiting review.
    expect(stored.meanings).toBe(1);
  });

  it("shows German and Arabic when the English is still a draft", async () => {
    const { entry, stored } = await readBack({ arabic: "verified", english: "draft" });

    expect(entry.german).toBe("das Haus");
    expect(entry.primary.arabic).toBe("بيت");
    expect(entry.primary.english).toBeNull();
    expect(entry.coverage[ARABIC]).toBe(true);
    expect(entry.coverage[ENGLISH]).toBe(false);
    expect(stored.translations).toBe(1);
  });

  it("shows both when both are published", async () => {
    const { entry } = await readBack({ arabic: "verified", english: "verified" });
    expect(entry.primary.arabic).toBe("بيت");
    expect(entry.primary.english).toBe("house");
    expect(entry.coverage.complete).toBe(true);
  });

  it("behaves identically on the in-memory backend a browser uses", async () => {
    const sqlite = await readBack({ arabic: "draft", english: "verified" });
    const memory = await readBack({ arabic: "draft", english: "verified" }, { memory: true });
    expect(memory.entry).toEqual(sqlite.entry);
    expect(memory.entry.primary.english).toBe("house");
  });
});

describe("each language keeps its own review state and provenance", () => {
  it("reports the status of the language it belongs to, not of its neighbour", async () => {
    const { entry } = await readBack({ arabic: "verified", english: "imported" });
    expect(entry.primary.provenance.arabic.status).toBe("verified");
    expect(entry.primary.provenance.english.status).toBe("imported");
    expect(entry.primary.provenance.english.sourceReference).toBe("test");
  });

  it("keeps a published English translation whose Arabic sense is not published", async () => {
    const executor = createNodeSqliteExecutor(":memory:");
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);
    await repositories.write.content.saveVocabulary(
      word({ arabic: "draft", english: "verified" }), { now: NOW });

    const readable = publishedOnly(repositories);
    // The row exists and is readable; only the Arabic beside it is hidden.
    expect(await readable.translations.count()).toBe(1);
    expect(await readable.meanings.count()).toBe(0);
    expect(await repositories.meanings.count()).toBe(1);
    executor.close();
  });
});

describe("Arabic still never decides correctness", () => {
  it("keeps Arabic out of the scoring answers whatever its status", async () => {
    for (const arabic of ["draft", "imported", "verified"]) {
      const { entry } = await readBack({ arabic, english: "verified" });
      const scoring = scoringAnswersFor(entry);
      expect(scoring.every(answer => answer.language !== ARABIC), arabic).toBe(true);
      expect(scoring.map(answer => answer.language)).toContain("de");
    }
  });

  it("refuses an Arabic answer even when it was stored as scoreable", () => {
    const entry = buildContentEntries({
      vocabularyItems: [word({ arabic: "verified", english: "verified" }).item],
      vocabularyMeanings: [word({ arabic: "verified", english: "verified" }).meanings[0]],
      translations: [],
      acceptedAnswers: [{
        uuid: "aa-bad", vocabUuid: "v-1", meaningUuid: "m-1", translationUuid: null,
        text: "بيت", language: "ar", scoreable: 1, ...linkMeta
      }]
    })[0];
    expect(scoringAnswersFor(entry)).toEqual([]);
  });
});

describe("existing data survives the schema change", () => {
  const fixture = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8"));

  it("gives every migrated translation and answer a word to belong to", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const items = new Set(dataset.vocabularyItems.map(row => row.uuid));

    expect(dataset.acceptedAnswers.length).toBeGreaterThan(0);
    for (const row of dataset.acceptedAnswers) {
      expect(items.has(row.vocabUuid), row.uuid).toBe(true);
    }
    for (const row of dataset.translations) {
      expect(items.has(row.vocabUuid), row.uuid).toBe(true);
    }
  });

  it("keeps a German answer for a word that never had an Arabic meaning", () => {
    const snapshot = structuredClone(fixture.clean);
    const target = snapshot.words.find(entry => (entry.acceptedAnswers ?? []).length) ??
      snapshot.words[0];
    target.acceptedAnswers = ["das Haus"];
    target.arabic = "";                     // the meaning is missing, not the answer

    const { dataset } = migrateToCanonical(snapshot, { now: NOW });
    const item = dataset.vocabularyItems.find(row => row.legacyId === String(target.id));
    const answers = dataset.acceptedAnswers.filter(row => row.vocabUuid === item.uuid);

    expect(answers.map(row => row.text)).toContain("das Haus");
    expect(answers.every(row => row.meaningUuid === null)).toBe(true);
    // And no Arabic meaning was invented to hang it from.
    expect(dataset.vocabularyMeanings.some(row => row.vocabUuid === item.uuid)).toBe(false);
  });

  it("round-trips through the store with both languages intact", async () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const executor = createNodeSqliteExecutor(":memory:");
    const adapter = createSqliteAdapter(executor);
    await adapter.initializeSchema();
    await adapter.importCanonical(dataset);

    const stored = await adapter.readCanonical();
    // Read back by uuid, because the store returns a total order and the dataset is in
    // the order the migration produced.
    const byUuid = rows => [...rows].sort((a, b) => (a.uuid < b.uuid ? -1 : 1));
    for (const entity of ["vocabularyItems", "acceptedAnswers", "vocabularyMeanings"]) {
      expect(byUuid(stored[entity]), entity).toEqual(byUuid(dataset[entity]));
    }
    executor.close();
  });
});
