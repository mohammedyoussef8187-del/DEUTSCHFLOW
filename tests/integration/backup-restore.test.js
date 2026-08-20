/*
 * Backup / restore safety gate (Stop Gate 2).
 *
 * Produces a complete backup of learner state, validates its structure and version,
 * restores it into an ISOLATED verification database, and compares the restored state
 * with the source field by field. The source database is asserted unchanged throughout.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { createIndexedDbAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js";
import { createRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/repositories.js";
import {
  compareLearnerState, createBackup, readLearnerState, restoreBackup, validateBackup
} from "../../01_APPLICATION/CURRENT_APP/src/data/backup.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8")
);

// Each call builds a completely separate in-memory database.
async function isolatedRepositories(seed = null) {
  const environment = { indexedDB: new IDBFactory(), IDBKeyRange, SEED: [] };
  const adapter = createIndexedDbAdapter({ DEFAULT_SETTINGS }, environment);
  await adapter.open();
  const repositories = createRepositories(adapter);
  if (seed) {
    await repositories.lifecycle.replaceAll({
      words: seed.words, cards: seed.cards, attempts: seed.attempts,
      settings: seed.settings, profile: seed.profile
    });
  }
  return repositories;
}

describe("learner-state backup integrity", () => {
  it("produces a complete backup in the existing export format", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const backup = await createBackup(source, { now: 1771600000000 });

    expect(backup.app).toBe("DeutschFlow");
    expect(backup.schemaVersion).toBe(6);
    expect(backup.exportedAt).toBe(1771600000000);
    expect(backup.words).toHaveLength(fixture.clean.words.length);
    expect(backup.cards).toHaveLength(fixture.clean.cards.length);
    expect(backup.attempts).toHaveLength(fixture.clean.attempts.length);
    expect(backup.profile.streak).toBe(8);
  });

  it("retains extra top-level export metadata", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const backup = await createBackup(source, {
      now: 1771600000000,
      metadata: { appVersion: "pro-rc1-2026-07-25", build: "RC4", dbVersion: 2, engineVersion: 3 }
    });
    expect(backup.appVersion).toBe("pro-rc1-2026-07-25");
    expect(backup.dbVersion).toBe(2);
  });

  it("validates structure, accepts schema versions 5 and 6, and refuses unknown ones", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const backup = await createBackup(source, { now: 1771600000000 });

    const report = validateBackup(backup);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.counts.words).toBe(4);

    expect(validateBackup({ ...backup, schemaVersion: 5 }).ok).toBe(true);
    expect(validateBackup({ ...backup, schemaVersion: 99 }).errors)
      .toContain("unsupported-schema-version:99");
    expect(validateBackup({ ...backup, app: "SomethingElse" }).errors).toContain("unrecognized-app");
    expect(validateBackup({ ...backup, cards: undefined }).errors).toContain("missing-array:cards");
    expect(validateBackup(null).ok).toBe(false);
  });

  it("reports structural learner-state problems without repairing them", async () => {
    // Corruption of this kind (null ids, orphan links) cannot exist inside IndexedDB,
    // which rejects invalid keys; it only appears in a backup file, so validate the
    // payload as read from disk.
    const backup = {
      app: "DeutschFlow", schemaVersion: 6, exportedAt: 1771600000000,
      ...fixture.malformed
    };
    const report = validateBackup(backup);

    const reasons = report.warnings.map(w => w.reason);
    expect(reasons).toContain("missing-id");
    expect(reasons).toContain("orphan-card");
    expect(reasons).toContain("ease-out-of-bounds");
    expect(reasons).toContain("unlinked-attempt");
    // Reported, not silently corrected: the payload still holds the original values.
    expect(backup.cards.find(c => c.key === "10:badease").ease).toBe(9.9);
  });

  it("refuses to restore an invalid backup", async () => {
    const target = await isolatedRepositories();
    await expect(restoreBackup(target, { app: "Nope", words: [], cards: [], attempts: [] }))
      .rejects.toThrow(/Refusing to restore/);
    expect(await target.vocabulary.all()).toHaveLength(0);
  });
});

describe("restore parity in an isolated verification database", () => {
  it("restores every learner field identically and leaves the source unchanged", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const before = await readLearnerState(source);
    const backup = await createBackup(source, { now: 1771600000000 });

    // Restore into a separate database; the learner's database is never the target.
    const target = await isolatedRepositories();
    await restoreBackup(target, backup);
    const restored = await readLearnerState(target);

    const parity = compareLearnerState(before, restored, { includeValues: true });
    expect(parity.differences).toEqual([]);
    expect(parity.identical).toBe(true);
    expect(parity.counts.words).toEqual([4, 4]);

    // Source database untouched by backup or restore.
    const after = await readLearnerState(source);
    expect(compareLearnerState(before, after).identical).toBe(true);
  });

  it("preserves SRS state, favorites, ignored state, flags, and accepted answers", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const backup = await createBackup(source, { now: 1771600000000 });
    const target = await isolatedRepositories();
    await restoreBackup(target, backup);
    const restored = await readLearnerState(target);

    const card = restored.cards.find(c => c.key === "1:recall");
    const origin = fixture.clean.cards.find(c => c.key === "1:recall");
    for (const field of ["state", "dueAt", "intervalDays", "ease", "reps", "lapses", "streak", "mastery", "lastReviewedAt", "correct", "wrong", "stability", "difficulty", "suspended"]) {
      expect(card[field]).toBe(origin[field]);
    }

    const haus = restored.words.find(w => w.id === 1);
    expect(haus.favorite).toBe(true);
    expect(haus.acceptedAnswers).toEqual(["das Haus", "Haus"]);
    expect(haus.acceptedArabicAnswers).toEqual(["بيت", "منزل"]);
    const gross = restored.words.find(w => w.id === 3);
    expect(gross.ignored).toBe(true);
    expect(gross.userFlagged).toBe(true);

    expect(restored.attempts).toHaveLength(3);
    expect(restored.settings.theme).toBe("dark");
    expect(restored.settings.acceptSs).toBe(false);
    expect(restored.profile.totalXP).toBe(1240);
  });

  it("survives a JSON serialization round-trip, as a real backup file does", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const before = await readLearnerState(source);
    const backup = await createBackup(source, { now: 1771600000000 });

    const roundTripped = JSON.parse(JSON.stringify(backup));
    expect(validateBackup(roundTripped).ok).toBe(true);

    const target = await isolatedRepositories();
    await restoreBackup(target, roundTripped);
    const restored = await readLearnerState(target);
    expect(compareLearnerState(before, restored, { includeValues: true }).differences).toEqual([]);
  });

  it("detects a corrupted restore instead of reporting false parity", async () => {
    const source = await isolatedRepositories(fixture.clean);
    const before = await readLearnerState(source);
    const backup = await createBackup(source, { now: 1771600000000 });

    // Simulate silent corruption of SRS state in transit.
    const damaged = JSON.parse(JSON.stringify(backup));
    damaged.cards.find(c => c.key === "1:recall").ease = 1.9;
    damaged.words.find(w => w.id === 1).favorite = false;

    const target = await isolatedRepositories();
    await restoreBackup(target, damaged);
    const parity = compareLearnerState(before, await readLearnerState(target));

    expect(parity.identical).toBe(false);
    expect(parity.differences).toContainEqual({ entity: "card", id: "1:recall", field: "ease" });
    expect(parity.differences).toContainEqual({ entity: "word", id: "1", field: "favorite" });
  });
});
