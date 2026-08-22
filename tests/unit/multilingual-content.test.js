/*
 * Feature A — English + Arabic multilingual content model.
 *
 * The product rules these tests defend:
 *   - German is the target language
 *   - English and Arabic carry EQUAL educational weight
 *   - Arabic NEVER affects scored correctness
 *   - German/English accepted answers MAY affect scoring
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARABIC, ENGLISH, GERMAN, EDUCATIONAL_LANGUAGES, SCOREABLE_LANGUAGES,
  SUPPORT_LANGUAGES, TARGET_LANGUAGE, assertScoreable, isEducational, isScoreable,
  normalizeLanguage
} from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import {
  buildContentEntries, createContentService, scoringAnswersFor
} from "../../01_APPLICATION/CURRENT_APP/src/services/content-service.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);
const NOW = 1771600000000;

describe("language policy", () => {
  it("treats German as the target language", () => {
    expect(TARGET_LANGUAGE).toBe(GERMAN);
  });

  it("gives English and Arabic equal educational standing", () => {
    expect(SUPPORT_LANGUAGES).toContain(ENGLISH);
    expect(SUPPORT_LANGUAGES).toContain(ARABIC);
    expect(SUPPORT_LANGUAGES).toHaveLength(2);
    expect(isEducational(ENGLISH)).toBe(true);
    expect(isEducational(ARABIC)).toBe(true);
    expect(EDUCATIONAL_LANGUAGES).toEqual([GERMAN, ENGLISH, ARABIC]);
  });

  it("never lets Arabic score, while German and English may", () => {
    expect(isScoreable(GERMAN)).toBe(true);
    expect(isScoreable(ENGLISH)).toBe(true);
    expect(isScoreable(ARABIC)).toBe(false);
    expect(SCOREABLE_LANGUAGES).not.toContain(ARABIC);
  });

  it("normalizes regional tags and casing before deciding", () => {
    expect(normalizeLanguage("en-GB")).toBe("en");
    expect(normalizeLanguage("AR_EG")).toBe("ar");
    expect(isScoreable("EN-US")).toBe(true);
    // A regional Arabic tag must not sneak past the policy.
    expect(isScoreable("ar-EG")).toBe(false);
    expect(isScoreable("")).toBe(false);
    expect(isScoreable(undefined)).toBe(false);
  });

  it("throws rather than silently degrading when asked to score Arabic", () => {
    expect(() => assertScoreable(ARABIC)).toThrow(/must not affect scored correctness/);
    expect(() => assertScoreable("ar-EG")).toThrow();
    expect(assertScoreable("de")).toBe("de");
    expect(assertScoreable("en-GB")).toBe("en");
  });
});

describe("migration into the multilingual model", () => {
  const { dataset, report } = migrateToCanonical(fixture.clean, { now: NOW });

  it("marks German accepted answers as scoreable", () => {
    const german = dataset.acceptedAnswers.filter(a => a.language === GERMAN);
    expect(german.length).toBeGreaterThan(0);
    expect(german.every(a => a.scoreable === 1)).toBe(true);
  });

  it("stores Arabic accepted answers but never as scoreable", () => {
    const arabic = dataset.acceptedAnswers.filter(a => a.language === ARABIC);
    expect(arabic.length).toBeGreaterThan(0);            // preserved as content
    expect(arabic.every(a => a.scoreable === 0)).toBe(true);  // but never grades
  });

  it("invents no English content when the legacy model has none", () => {
    // The legacy model stores no English at all. An empty translations set is correct;
    // fabricating English would be worse than having none.
    expect(dataset.translations).toEqual([]);
    expect(report.counts.translations).toBe(0);
  });

  it("keeps Arabic meanings intact alongside the empty English set", () => {
    expect(dataset.vocabularyMeanings.length).toBeGreaterThan(0);
    expect(dataset.vocabularyMeanings.every(m => Boolean(m.arabicText))).toBe(true);
  });
});

describe("content assembly", () => {
  function canonicalWithEnglish() {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const meaning = dataset.vocabularyMeanings[0];
    dataset.translations.push({
      // Since schema 11 an English translation belongs to the WORD; naming the sense is
      // an optional pairing, used here because this fixture has one of each.
      uuid: "t-1", vocabUuid: meaning.vocabUuid, meaningUuid: meaning.uuid,
      englishText: "house",
      normalizedEnglish: "house", explanation: "a building for living in",
      contentStatus: "verified", contentVersion: 2, sourceReference: null,
      sourceType: "editorial", verifiedAt: NOW, verifiedBy: "editor",
      createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
    });
    dataset.acceptedAnswers.push({
      uuid: "aa-en", vocabUuid: meaning.vocabUuid, meaningUuid: meaning.uuid,
      translationUuid: "t-1",
      text: "house", language: ENGLISH, scoreable: 1,
      createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
    });
    return { dataset, meaning };
  }

  it("presents English and Arabic as peers, not one nested in the other", () => {
    const { dataset, meaning } = canonicalWithEnglish();
    const entries = buildContentEntries(dataset);
    const entry = entries.find(e => e.senses.some(s => s.uuid === meaning.uuid));
    const sense = entry.senses.find(s => s.uuid === meaning.uuid);

    expect(sense.arabic).toBeTruthy();
    expect(sense.english).toBe("house");
    expect(sense.explanations[ENGLISH]).toBe("a building for living in");
    expect(entry.coverage.complete).toBe(true);
  });

  it("treats an entry with only Arabic as complete in Arabic, not broken", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const entry = buildContentEntries(dataset)[0];
    expect(entry.coverage[ARABIC]).toBe(true);
    expect(entry.coverage[ENGLISH]).toBe(false);
    expect(entry.coverage.complete).toBe(false);
    expect(entry.primary.arabic).toBeTruthy();   // still usable for teaching
  });

  it("separates scoring answers from reference-only answers", () => {
    const { dataset, meaning } = canonicalWithEnglish();
    const entry = buildContentEntries(dataset).find(e => e.senses.some(s => s.uuid === meaning.uuid));
    const sense = entry.senses.find(s => s.uuid === meaning.uuid);

    expect(sense.answers.scoring.every(a => a.language !== ARABIC)).toBe(true);
    expect(sense.answers.scoring.map(a => a.language)).toContain(ENGLISH);
    expect(sense.answers.scoring.map(a => a.language)).toContain(GERMAN);
    expect(sense.answers.reference.some(a => a.language === ARABIC)).toBe(true);
  });

  it("refuses to score an Arabic answer even if stored with scoreable = 1", () => {
    // Simulates a bad import or a hand-edited row: the policy still wins.
    const { dataset, meaning } = canonicalWithEnglish();
    dataset.acceptedAnswers.push({
      uuid: "aa-bad", meaningUuid: meaning.uuid, translationUuid: null,
      text: "بيت", language: ARABIC, scoreable: 1,
      createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
    });

    const entry = buildContentEntries(dataset).find(e => e.senses.some(s => s.uuid === meaning.uuid));
    const scoring = scoringAnswersFor(entry);
    expect(scoring.every(a => a.language !== ARABIC)).toBe(true);
    expect(entry.senses.flatMap(s => s.answers.reference).some(a => a.text === "بيت")).toBe(true);
  });

  it("exposes content provenance per language", () => {
    const { dataset, meaning } = canonicalWithEnglish();
    const sense = buildContentEntries(dataset)
      .flatMap(e => e.senses).find(s => s.uuid === meaning.uuid);

    expect(sense.provenance.arabic.status).toBe("legacy");
    expect(sense.provenance.english.status).toBe("verified");
    expect(sense.provenance.english.contentVersion ?? sense.provenance.english.version).toBe(2);
  });

  it("skips soft-deleted rows", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    dataset.vocabularyItems[0].deleted = 1;
    const entries = buildContentEntries(dataset);
    expect(entries.length).toBe(dataset.vocabularyItems.length - 1);
  });

  it("handles an empty canonical dataset", () => {
    expect(buildContentEntries({})).toEqual([]);
    expect(scoringAnswersFor(null)).toEqual([]);
  });
});

describe("content service", () => {
  function repositoriesFor(dataset) {
    return {
      vocabulary: { all: async () => dataset.vocabularyItems },
      meanings: { all: async () => dataset.vocabularyMeanings },
      translations: { all: async () => dataset.translations },
      acceptedAnswers: { all: async () => dataset.acceptedAnswers }
    };
  }

  it("reads through repositories only", async () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const entries = await createContentService(repositoriesFor(dataset)).allEntries();
    expect(entries).toHaveLength(dataset.vocabularyItems.length);
    expect(entries[0].german).toBeTruthy();
  });

  it("reports where translation work is still needed", async () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const coverage = await createContentService(repositoriesFor(dataset)).coverageReport();
    expect(coverage.total).toBe(dataset.vocabularyItems.length);
    expect(coverage[ARABIC]).toBe(dataset.vocabularyItems.length);
    expect(coverage[ENGLISH]).toBe(0);
    expect(coverage.missingEnglish).toBe(coverage.total);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createContentService(null)).toThrow(/Repositories are required/);
  });
});
