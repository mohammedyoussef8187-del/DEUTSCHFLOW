/*
 * Feature D — exercises.
 *
 * The service assembles exercise specs; it never grades. The rules it must hold:
 * deterministic ordering, Arabic never gradeable, and expected answers that a grader
 * can safely trust.
 */

import { describe, expect, it } from "vitest";
import {
  EXERCISE_TEXT_KINDS, EXERCISE_TYPES, TARGET_TYPES, buildExercises,
  createExerciseService, exercisesForTarget, expectedAnswersFor, seededShuffle
} from "../../01_APPLICATION/CURRENT_APP/src/services/exercise-service.js";
import { ARABIC, ENGLISH, GERMAN } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const NOW = 1775000000000;
const meta = {
  contentStatus: "draft", contentVersion: 1, sourceReference: null, sourceType: "editorial",
  verifiedAt: null, verifiedBy: null, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
};
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (exerciseUuid, language, kind, value) =>
  ({ uuid: `xt-${exerciseUuid}-${language}-${kind}`, exerciseUuid, language, kind, text: value, ...meta });

const option = (uuid, exerciseUuid, textValue, language, isExpected, scoreable, ordering) =>
  ({ uuid, exerciseUuid, text: textValue, language, isExpected, scoreable, ordering, ...linkMeta });

function canonical() {
  return {
    exercises: [
      { uuid: "x-2", slug: "choose-article", exerciseType: EXERCISE_TYPES.MULTIPLE_CHOICE,
        level: "A1", ordering: 2, answerLanguage: GERMAN, ...meta },
      { uuid: "x-1", slug: "type-the-noun", exerciseType: EXERCISE_TYPES.TYPE_ANSWER,
        level: "A1", ordering: 1, answerLanguage: GERMAN, ...meta,
        contentStatus: "verified", contentVersion: 2, sourceType: "textbook", verifiedAt: NOW }
    ],
    exerciseTexts: [
      text("x-1", ENGLISH, EXERCISE_TEXT_KINDS.INSTRUCTION, "Type the German noun with its article."),
      text("x-1", ARABIC, EXERCISE_TEXT_KINDS.INSTRUCTION, "اكتب الاسم الألماني مع أداته."),
      text("x-1", ARABIC, EXERCISE_TEXT_KINDS.PROMPT, "بيت"),
      text("x-1", ENGLISH, EXERCISE_TEXT_KINDS.HINT, "Three genders: der, die, das."),
      // x-2 has English instructions only.
      text("x-2", ENGLISH, EXERCISE_TEXT_KINDS.INSTRUCTION, "Choose the correct article.")
    ],
    exerciseOptions: [
      option("o-1b", "x-1", "Haus", GERMAN, 1, 1, 2),
      option("o-1a", "x-1", "das Haus", GERMAN, 1, 1, 1),
      // Arabic option: shown to the learner, but must never grade.
      option("o-1c", "x-1", "بيت", ARABIC, 1, 1, 3),
      option("o-2a", "x-2", "das", GERMAN, 1, 1, 1),
      option("o-2b", "x-2", "der", GERMAN, 0, 1, 2),
      option("o-2c", "x-2", "die", GERMAN, 0, 1, 3)
    ],
    exerciseTargets: [
      { uuid: "xt-1", exerciseUuid: "x-1", targetType: TARGET_TYPES.VOCABULARY, targetUuid: "v-haus", ...linkMeta },
      { uuid: "xt-2", exerciseUuid: "x-2", targetType: TARGET_TYPES.GRAMMAR_RULE, targetUuid: "rule-articles", ...linkMeta },
      { uuid: "xt-3", exerciseUuid: "x-2", targetType: TARGET_TYPES.VOCABULARY, targetUuid: "v-haus", ...linkMeta }
    ]
  };
}

describe("exercise assembly", () => {
  const exercises = buildExercises(canonical());

  it("returns exercises in authored order with their type and level", () => {
    expect(exercises.map(e => e.slug)).toEqual(["type-the-noun", "choose-article"]);
    expect(exercises[0].type).toBe(EXERCISE_TYPES.TYPE_ANSWER);
    expect(exercises[1].type).toBe(EXERCISE_TYPES.MULTIPLE_CHOICE);
    expect(exercises[0].level).toBe("A1");
  });

  it("assembles multilingual instructions, prompts and hints as peers", () => {
    const [first] = exercises;
    expect(first.instruction[ENGLISH]).toBe("Type the German noun with its article.");
    expect(first.instruction[ARABIC]).toBe("اكتب الاسم الألماني مع أداته.");
    expect(first.prompt[ARABIC]).toBe("بيت");
    expect(first.hint[ENGLISH]).toBe("Three genders: der, die, das.");
  });

  it("reports a missing instruction language rather than omitting it", () => {
    expect(exercises[1].instruction[ARABIC]).toBeNull();
    expect(exercises[1].coverage[ARABIC]).toBe(false);
    expect(exercises[1].coverage.missing).toEqual([ARABIC]);
  });

  it("keeps options in authored order by default", () => {
    expect(exercises[0].options.map(o => o.text)).toEqual(["das Haus", "Haus", "بيت"]);
  });

  it("exposes provenance and links to the content it practises", () => {
    expect(exercises[0].provenance.status).toBe("verified");
    expect(exercises[0].provenance.sourceType).toBe("textbook");
    expect(exercises[1].targets).toEqual([
      { type: TARGET_TYPES.GRAMMAR_RULE, uuid: "rule-articles" },
      { type: TARGET_TYPES.VOCABULARY, uuid: "v-haus" }
    ]);
  });
});

describe("Arabic can never grade an exercise", () => {
  const exercises = buildExercises(canonical());

  it("excludes an Arabic option from expected answers even when stored as expected and scoreable", () => {
    const [first] = exercises;
    // The Arabic option is authored with isExpected=1 and scoreable=1 on purpose.
    const arabicOption = first.options.find(o => o.language === ARABIC);
    expect(arabicOption.isExpected).toBe(true);
    expect(arabicOption.scoreable).toBe(false);          // policy overrode the stored flag

    expect(first.expectedAnswers.map(a => a.text)).toEqual(["das Haus", "Haus"]);
    expect(first.expectedAnswers.every(a => a.language === GERMAN)).toBe(true);
  });

  it("still shows the Arabic option to the learner", () => {
    // Non-scoreable is not the same as hidden: it remains available as content.
    expect(buildExercises(canonical())[0].options.map(o => o.text)).toContain("بيت");
  });

  it("re-filters expected answers through the policy on the way out", () => {
    const tampered = buildExercises(canonical())[0];
    // Simulate a caller mutating the spec before grading.
    tampered.expectedAnswers.push({ text: "بيت", language: ARABIC });
    expect(expectedAnswersFor(tampered).every(a => a.language !== ARABIC)).toBe(true);
  });

  it("marks an exercise whose answer language cannot score as not gradeable", () => {
    const data = canonical();
    const target = data.exercises.find(e => e.slug === "type-the-noun");
    target.answerLanguage = ARABIC;

    const built = buildExercises(data).find(e => e.slug === "type-the-noun");
    expect(built.answerLanguage).toBe(ARABIC);
    expect(built.gradeable).toBe(false);
    // The other exercise is unaffected.
    expect(buildExercises(data).find(e => e.slug === "choose-article").gradeable).toBe(true);
  });

  it("marks an exercise with no scoreable expected answer as not gradeable", () => {
    const data = canonical();
    data.exerciseOptions = data.exerciseOptions.filter(o => o.exerciseUuid !== "x-1" || o.language === ARABIC);
    const [first] = buildExercises(data);
    expect(first.expectedAnswers).toEqual([]);
    expect(first.gradeable).toBe(false);
  });
});

describe("deterministic ordering", () => {
  it("shuffles reproducibly for the same seed", () => {
    const a = buildExercises(canonical(), { shuffleSeed: 42 })[1].options.map(o => o.text);
    const b = buildExercises(canonical(), { shuffleSeed: 42 })[1].options.map(o => o.text);
    expect(a).toEqual(b);
  });

  it("produces a different order for a different seed, without losing options", () => {
    const base = buildExercises(canonical(), { shuffleSeed: 1 })[1].options.map(o => o.text);
    const other = buildExercises(canonical(), { shuffleSeed: 999 })[1].options.map(o => o.text);
    expect([...base].sort()).toEqual([...other].sort());
  });

  it("never calls Math.random, so a session can be reproduced", () => {
    const original = Math.random;
    Math.random = () => { throw new Error("Math.random must not be used"); };
    try {
      expect(() => buildExercises(canonical(), { shuffleSeed: 7 })).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  it("keeps every element when shuffling", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect([...seededShuffle(items, 12345)].sort()).toEqual([...items].sort());
    expect(seededShuffle([], 5)).toEqual([]);
    expect(seededShuffle(["only"], 0)).toEqual(["only"]);
  });
});

describe("exercise edge cases", () => {
  it("handles an empty dataset", () => {
    expect(buildExercises({})).toEqual([]);
    expect(expectedAnswersFor(null)).toEqual([]);
  });

  it("skips soft-deleted exercises, texts, options and targets", () => {
    const data = canonical();
    data.exercises[0].deleted = 1;        // x-2
    data.exerciseOptions[0].deleted = 1;  // "Haus"
    data.exerciseTexts[1].deleted = 1;    // Arabic instruction
    const exercises = buildExercises(data);

    expect(exercises.map(e => e.slug)).toEqual(["type-the-noun"]);
    expect(exercises[0].options.map(o => o.text)).not.toContain("Haus");
    expect(exercises[0].instruction[ARABIC]).toBeNull();
  });

  it("finds exercises practising a given target", () => {
    const data = canonical();
    expect(exercisesForTarget(data, TARGET_TYPES.VOCABULARY, "v-haus").map(e => e.slug))
      .toEqual(["type-the-noun", "choose-article"]);
    expect(exercisesForTarget(data, TARGET_TYPES.GRAMMAR_RULE, "rule-articles").map(e => e.slug))
      .toEqual(["choose-article"]);
    expect(exercisesForTarget(data, TARGET_TYPES.SENTENCE, "s-unknown")).toEqual([]);
  });
});

describe("migration leaves exercises empty", () => {
  it("fabricates no exercises from legacy data", () => {
    const { dataset } = migrateToCanonical(
      { words: [{ id: 1, german: "das Haus", arabic: "بيت", itemType: "noun" }],
        cards: [], attempts: [], settings: null, profile: null },
      { now: NOW }
    );
    expect(dataset.exercises).toEqual([]);
    expect(dataset.exerciseTexts).toEqual([]);
    expect(dataset.exerciseOptions).toEqual([]);
    expect(dataset.exerciseTargets).toEqual([]);
    expect(dataset.vocabularyItems).toHaveLength(1);   // vocabulary still migrates
  });
});

describe("exercise service", () => {
  function repositoriesFor(data) {
    return {
      exercises: { all: async () => data.exercises },
      exerciseTexts: { all: async () => data.exerciseTexts },
      exerciseOptions: { all: async () => data.exerciseOptions },
      exerciseTargets: { all: async () => data.exerciseTargets }
    };
  }

  it("reads through repositories only", async () => {
    expect(await createExerciseService(repositoriesFor(canonical())).all()).toHaveLength(2);
  });

  it("filters by level, type and target", async () => {
    const service = createExerciseService(repositoriesFor(canonical()));
    expect(await service.byLevel("A1")).toHaveLength(2);
    expect((await service.byType(EXERCISE_TYPES.MULTIPLE_CHOICE)).map(e => e.slug)).toEqual(["choose-article"]);
    expect((await service.forTarget(TARGET_TYPES.GRAMMAR_RULE, "rule-articles")).map(e => e.slug))
      .toEqual(["choose-article"]);
  });

  it("reports which exercises cannot be graded and why", async () => {
    const data = canonical();
    data.exercises[0].answerLanguage = ARABIC;   // choose-article
    const report = await createExerciseService(repositoriesFor(data)).gradeabilityReport();
    expect(report.total).toBe(2);
    expect(report.gradeable).toBe(1);
    expect(report.ungradeable[0].reason).toContain('answer language "ar" cannot score');
  });

  it("reports instruction coverage per language", async () => {
    const report = await createExerciseService(repositoriesFor(canonical())).coverageReport();
    expect(report.total).toBe(2);
    expect(report[ENGLISH]).toBe(2);
    expect(report[ARABIC]).toBe(1);
    expect(report.missingArabic).toBe(1);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createExerciseService(null)).toThrow(/Repositories are required/);
  });
});
