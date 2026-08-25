// @vitest-environment happy-dom
/*
 * Corrupt data must not be able to come back, and must never become somebody's chore.
 *
 * Two sources reach a learner and both are checked here: the 2820-row legacy spreadsheet
 * behind `seed-data.js`, and the authored curriculum in `canonical-content.json`. The
 * detectors are the ones the product itself uses, so a rule that is wrong here is wrong
 * in the application too.
 *
 * Half of these tests exist to stop the detectors OVERREACHING. `auf|stehen`, `[dann]`,
 * `von ... bis` and `der/die Deutsche` are all things DeutschFlow writes deliberately, and
 * a checker that flags them does not find corruption — it invents work and then hands it
 * to the learner, which is the exact failure this whole pass was written to end.
 */

import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import {
  bracketsBalanced, corruptionReasons, findCorruptedStrings, findDuplicateVocabulary,
  isCorrupted, learnerStrings, LOOKS_LIKE_SLUG, REFERENCE_CODE
} from "../../01_APPLICATION/CURRENT_APP/src/content/content-quality.js";
import {
  EXCLUDED_VERDICTS, triageLegacyEntry, triageLegacySource, VERDICT
} from "../../01_APPLICATION/CURRENT_APP/src/content/legacy-triage.js";
import { loadLegacyCore } from "../support/load-legacy-core.js";
import { readShippedContent } from "../support/learner-journey-harness.js";

let SEED;
let entities;
let DF;

beforeAll(() => {
  const box = { window: {} };
  vm.runInNewContext(
    fs.readFileSync("01_APPLICATION/CURRENT_APP/data/seed-data.js", "utf8"), box);
  SEED = box.window.SEED;
  entities = readShippedContent().entities;
  DF = loadLegacyCore();
});

describe("the detectors leave DeutschFlow's own conventions alone", () => {
  /* Each of these appears in the shipped product and must never be called corrupt. */
  const legitimate = [
    "auf|stehen", "ein|kaufen", "weh|tun", "jemandem zu|hören", "sich aus|ruhen",
    "Wenn …, [dann] Verb + Subjekt.",
    "von ... bis", "Was bedeutet ...?", "zwar ... aber", "Du meinst ...",
    "der/die Angestellte", "die/das Cola", "die Ja-/Nein-Frage",
    "die IBAN", "der USB-Stick", "km/h", "24 Stunden", "Zimmer 3",
    "Es ist Viertel nach acht.", "Ich bin dreißig Jahre alt."
  ];

  for (const value of legitimate) {
    it(`treats ${JSON.stringify(value)} as clean`, () => {
      expect(corruptionReasons(value), value).toEqual([]);
    });
  }
});

describe("the detectors do catch real extraction residue", () => {
  const corrupt = {
    "brauchen /i/3b braun": "workbook or table reference code",
    "der Planen A/3b Platz": "workbook or table reference code",
    "der Sofort B/8c. Sohn": "workbook or table reference code",
    "Seite 42 lesen": "book reference inside learner text",
    "der Glauben (Ich glaube": "unbalanced round bracket",
    "a1-l06-woche": "slug shown as learner text"
  };

  for (const [value, reason] of Object.entries(corrupt)) {
    it(`flags ${JSON.stringify(value)}`, () => {
      expect(corruptionReasons(value), value).toContain(reason);
    });
  }

  it("flags a newline escape that survived into learner text", () => {
    expect(isCorrupted(`Sehr geehrte Damen und Herren,${String.fromCharCode(92)}nich …`))
      .toBe(true);
  });

  it("only reads a slash as a reference when a digit keeps it company", () => {
    expect(REFERENCE_CODE.test("der/die Deutsche")).toBe(false);
    expect(REFERENCE_CODE.test("A/3b")).toBe(true);
  });

  it("knows a balanced bracket from an unbalanced one", () => {
    expect(bracketsBalanced("الاعتقاد (أعتقد)")).toBe(true);
    expect(bracketsBalanced("der Glauben (Ich glaube")).toBe(false);
  });

  it("does not mistake an ordinary two-word slug for a printed identifier", () => {
    expect(LOOKS_LIKE_SLUG.test("guten-tag")).toBe(false);
    expect(LOOKS_LIKE_SLUG.test("a1-l06-woche")).toBe(true);
  });
});

describe("the legacy source is triaged, not handed to the learner", () => {
  it("classifies every one of the 2820 rows", () => {
    const { counts } = triageLegacySource(SEED);
    expect(counts.total).toBe(SEED.length);
    expect(counts.VALID + counts.CORRECTED + counts.ARTIFACT + counts.QUARANTINED)
      .toBe(counts.total);
  });

  it("excludes the known extraction residue", () => {
    for (const id of [624, 1260, 1336]) {
      const entry = SEED.find(row => row.id === id);
      expect(triageLegacyEntry(entry).verdict, `seed ${id}`).toBe(VERDICT.ARTIFACT);
    }
  });

  it("restores the merged noun instead of discarding it", () => {
    const decision = triageLegacyEntry(SEED.find(row => row.id === 1115));
    expect(decision.verdict).toBe(VERDICT.CORRECTED);
    expect(decision.german).toBe("der Glaube");
    expect(bracketsBalanced(decision.german)).toBe(true);
  });

  it("keeps every legitimate slash entry, digit-free and therefore safe", () => {
    /*
     * Fifteen two-gender nouns (`der/die Angestellte`, `die/das Cola`) plus
     * `die Ja-/Nein-Frage`. A rule that read a slash as damage would delete all sixteen;
     * what makes them safe is that not one of them contains a digit.
     */
    const slashed = SEED.filter(row => row.de.includes("/") && !/\d/.test(row.de));
    expect(slashed.length).toBeGreaterThanOrEqual(16);
    for (const row of slashed) {
      expect(triageLegacyEntry(row).verdict, row.de).toBe(VERDICT.VALID);
    }
  });

  it("keeps the ellipsis patterns, which are slots rather than truncation", () => {
    const slots = SEED.filter(row => /\.{3}|…/.test(row.de));
    expect(slots.length).toBeGreaterThan(0);
    for (const row of slots) {
      expect(triageLegacyEntry(row).verdict, row.de).toBe(VERDICT.VALID);
    }
  });

  it("MANDATORY_USER_DATA_CLEANUP_ITEMS = 0", () => {
    /*
     * The number this whole pass is about: after triage, nothing that reaches a learner
     * is also proposed to them as an editorial task.
     */
    const published = SEED.map(row => DF.applyPatchToSeed(row)).filter(word => !word.excluded);
    const needsUser = published.filter(word => word.qualityStatus === "review");
    expect(needsUser.map(word => `${word.id} ${word.german}`)).toEqual([]);
  });

  it("excluded rows are dropped from publication, not flagged for review", () => {
    const words = SEED.map(row => DF.applyPatchToSeed(row));
    const excluded = words.filter(word => word.excluded);
    expect(excluded.length).toBeGreaterThan(0);
    for (const word of excluded) {
      expect(EXCLUDED_VERDICTS).toContain(word.triageVerdict);
      expect(word.qualityIssues, word.german).toEqual([]);
    }
  });

  it("keeps every raw row in the source file as evidence", () => {
    /* Cleaning is a filter over publication; the spreadsheet is never edited down. */
    expect(SEED.length).toBe(2820);
    for (const id of [624, 1260, 1336, 1115]) {
      expect(SEED.some(row => row.id === id), `seed ${id} must still exist`).toBe(true);
    }
  });
});

describe("the shipped curriculum carries no corrupted learner text", () => {
  it("LEARNER_VISIBLE_CORRUPTED_REFERENCE_CODES = 0", () => {
    const hits = findCorruptedStrings(entities)
      .filter(row => row.reasons.some(reason => /reference/.test(reason)));
    expect(hits.map(row => `${row.entity}.${row.field}: ${row.value}`)).toEqual([]);
  });

  it("LEARNER_VISIBLE_SLUGS = 0", () => {
    const hits = findCorruptedStrings(entities)
      .filter(row => row.reasons.includes("slug shown as learner text"));
    expect(hits.map(row => row.value)).toEqual([]);
  });

  it("LEARNER_VISIBLE_TRUNCATED_ENTRIES = 0", () => {
    const hits = findCorruptedStrings(entities)
      .filter(row => row.reasons.some(reason => /bracket|escape/.test(reason)));
    expect(hits.map(row => `${row.entity}: ${row.value}`)).toEqual([]);
  });

  it("LEARNER_VISIBLE_OBVIOUS_TABLE_ARTIFACTS = 0, across every string", () => {
    const hits = findCorruptedStrings(entities);
    expect(hits.map(row => `${row.entity}.${row.field}: ${row.value} << ${row.reasons}`))
      .toEqual([]);
  });

  it("inspects a substantial amount of text rather than trivially passing", () => {
    expect(learnerStrings(entities).length).toBeGreaterThan(5000);
  });

  it("duplicates only exist where two attributed sources agree", () => {
    /*
     * One row referenced by two lessons is reuse, not duplication. Two rows for one word
     * are duplication — but where they come from different sources, each carries its own
     * licence and provenance, and removing either would drop an attribution.
     */
    const withinOneSource = findDuplicateVocabulary(entities).filter(row => row.sameSource);
    expect(withinOneSource.map(row => `${row.german} (${row.level})`)).toEqual([]);
  });
});
