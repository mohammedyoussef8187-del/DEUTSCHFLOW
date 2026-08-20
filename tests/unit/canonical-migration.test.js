import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import { deterministicUuid, NS } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);

const NOW = 1771600000000;

describe("current -> canonical migration mapping", () => {
  it("produces stable, deterministic identifiers across runs", () => {
    const a = migrateToCanonical(fixture.clean, { now: NOW });
    const b = migrateToCanonical(fixture.clean, { now: NOW });
    expect(a.dataset).toEqual(b.dataset);
    expect(a.dataset.vocabularyItems[0].uuid).toBe(deterministicUuid(NS.vocab, "1"));
  });

  it("maps a clean snapshot with correct entity counts and no quarantine", () => {
    const { dataset, report } = migrateToCanonical(fixture.clean, { now: NOW });
    expect(report.ok).toBe(true);
    expect(report.quarantine).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(report.counts).toMatchObject({
      profiles: 1,
      settings: 1,
      vocabularyItems: 4,
      vocabularyMeanings: 4,
      acceptedAnswers: 9,
      reviewCards: 4,
      reviewEvents: 3
    });
    expect(dataset.reviewCards).toHaveLength(4);
  });

  it("preserves SRS state verbatim, including unchanged due dates", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const source = fixture.clean.cards.find(c => c.key === "1:recall");
    const migrated = dataset.reviewCards.find(c => c.legacyKey === "1:recall");
    for (const field of [
      "state", "dueAt", "intervalDays", "ease", "reps", "lapses",
      "streak", "mastery", "lastReviewedAt", "correct", "wrong",
      "stability", "difficulty", "lastResult"
    ]) {
      expect(migrated[field]).toBe(source[field]);
    }
    // Mastered card keeps its exact ease at the upper bound and its future due date.
    const mastered = dataset.reviewCards.find(c => c.legacyKey === "3:recall");
    expect(mastered.ease).toBe(3.2);
    expect(mastered.dueAt).toBe(1774000000000);
    expect(mastered.suspended).toBe(1);
  });

  it("links review events to their cards by legacy identity", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const cardUuid = deterministicUuid(NS.card, "1:recall");
    const linked = dataset.reviewEvents.filter(e => e.cardUuid === cardUuid);
    expect(linked).toHaveLength(2);
    expect(dataset.reviewEvents.every(e =>
      dataset.reviewCards.some(c => c.uuid === e.cardUuid)
    )).toBe(true);
  });

  it("preserves favorites, ignored/excluded state, flags, and accepted answers", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    const haus = dataset.vocabularyItems.find(v => v.legacyId === "1");
    const gross = dataset.vocabularyItems.find(v => v.legacyId === "3");
    expect(gross.ignored).toBe(1);
    expect(haus.ignored).toBe(0);

    // Word-scoped learner/quality state lives on the item, so it survives even for
    // words that carry no meaning row.
    expect(haus.favorite).toBe(1);
    expect(gross.userFlagged).toBe(1);
    expect(gross.qualityStatus).toBe("review");
    expect(haus.tags).toBe(JSON.stringify(["wohnen"]));

    const hausMeaning = dataset.vocabularyMeanings.find(m => m.vocabUuid === haus.uuid);
    const hausAnswers = dataset.acceptedAnswers.filter(a => a.meaningUuid === hausMeaning.uuid);
    expect(hausAnswers.filter(a => a.language === "de").map(a => a.text)).toEqual(["das Haus", "Haus"]);
    expect(hausAnswers.filter(a => a.language === "ar").map(a => a.text)).toEqual(["بيت", "منزل"]);
  });

  it("marks migrated content as legacy provenance without asserting authority", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    for (const item of dataset.vocabularyItems) {
      expect(item.contentStatus).toBe("legacy");
      expect(item.sourceType).toBe("legacy");
      expect(item.contentVersion).toBe(1);
      expect(item.verifiedAt).toBeNull();
    }
    // Provenance reference (source row) is retained.
    expect(dataset.vocabularyItems.find(v => v.legacyId === "1").sourceReference).toBe("44");
  });

  it("does not rewrite legacy wording during structural migration", () => {
    const { dataset } = migrateToCanonical(fixture.clean, { now: NOW });
    expect(dataset.vocabularyItems.find(v => v.legacyId === "4").german)
      .toBe("Das ist ein schönes Haus.");
    expect(dataset.vocabularyMeanings.find(m =>
      m.vocabUuid === dataset.vocabularyItems.find(v => v.legacyId === "1").uuid
    ).arabicText).toBe("بيت");
  });
});

describe("malformed / incomplete legacy data handling", () => {
  const result = migrateToCanonical(fixture.malformed, { now: NOW });

  it("migrates only well-formed records and quarantines the rest", () => {
    expect(result.report.counts.vocabularyItems).toBe(2); // ids 10 and 13
    expect(result.report.counts.vocabularyMeanings).toBe(1); // 13 has no Arabic
    expect(result.report.counts.reviewCards).toBe(2); // 10:recall and 10:badease
    expect(result.report.counts.reviewEvents).toBe(1); // only id 50 links
    expect(result.report.ok).toBe(false);
  });

  it("reports each quarantined record with a preserved copy and reasons", () => {
    const reasons = result.report.quarantine.map(q => q.reasons.join(","));
    expect(reasons).toContain("missing-id");
    expect(reasons).toContain("missing-german");
    expect(reasons).toContain("duplicate-id");
    expect(reasons).toContain("missing-arabic-meaning");
    expect(reasons).toContain("orphan-card");
    expect(reasons).toContain("missing-skill");
    expect(reasons).toContain("unlinkable-event");
    expect(reasons).toContain("missing-cardKey");
    // Original record is preserved for recovery, never discarded.
    const orphan = result.report.quarantine.find(q => q.reasons.includes("orphan-card"));
    expect(orphan.record.key).toBe("99:recall");
  });

  it("preserves out-of-bounds ease as a warning rather than silently clamping it", () => {
    const badEase = result.dataset.reviewCards.find(c => c.legacyKey === "10:badease");
    expect(badEase.ease).toBe(9.9);
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ sourceId: "10:badease", reason: "ease-out-of-bounds" })
    );
  });

  it("does not invent missing educational values", () => {
    // Word 13 had an empty Arabic meaning: the item survives, but no meaning is fabricated.
    const item13 = result.dataset.vocabularyItems.find(v => v.legacyId === "13");
    expect(item13).toBeTruthy();
    expect(result.dataset.vocabularyMeanings.some(m => m.vocabUuid === item13.uuid)).toBe(false);
  });
});
