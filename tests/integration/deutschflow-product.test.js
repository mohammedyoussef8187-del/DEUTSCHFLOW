// @vitest-environment happy-dom
/*
 * DeutschFlow as a product, not as a database.
 *
 * Everything else in this suite proves that content travels correctly. This file asks the
 * only question a learner asks: is there a course to take, does it go somewhere, and does
 * every screen along the way have something on it?
 *
 * It builds the whole authored curriculum into a fresh store and then reads it back
 * through the app's own services, so a lesson that exists but is held out of the published
 * view fails here exactly as it would fail a learner.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { runLevel } from "../../tools/curriculum/run-curriculum.mjs";
import { productReport } from "../../tools/curriculum/product-report.mjs";
import { A1 } from "../../tools/curriculum/a1.js";
import { A2_UNITS } from "../../tools/curriculum/a2-units-8-12.js";
import { expectedAnswersFor } from "../../01_APPLICATION/CURRENT_APP/src/services/exercise-service.js";
import { validateGermanAnswer } from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { ARABIC } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";

const NOW = 1787356800000;

/*
 * A2 normally attaches to the course the open-content intake created. This suite builds
 * only the authored material, so the same units are written here as a standalone A2 —
 * their teaching content is what is under test, not which course row they hang from.
 */
const A2_STANDALONE = {
  cefr: "A2", ordering: 2,
  title: { de: "DeutschFlow A2", en: "DeutschFlow A2", ar: "دويتش فلو A2" },
  objective: { ar: "المستوى الثاني." },
  units: A2_UNITS
};

let store;
let repositories;
let services;
let report;

beforeAll(async () => {
  store = createNodeSqliteExecutor();
  const adapter = createSqliteAdapter(store.executor ?? store);
  await adapter.initializeSchema();
  repositories = createCanonicalRepositories(adapter);
  services = createServices(repositories);

  for (const level of [A1, A2_STANDALONE]) {
    const result = await runLevel(repositories, level, { apply: true, now: NOW });
    expect(result.applied, `${level.cefr} did not apply: ${result.reason}`).toBe(true);
    expect(result.verification.ok).toBe(true);
  }
  report = await productReport(services);
});

afterAll(() => { store?.close?.(); });

describe("there is a course to take", () => {
  it("covers A1 and A2", () => {
    const levels = report.courses.map(course => course.cefr).sort();
    expect(levels).toEqual(["A1", "A2"]);
  });

  it("gives A1 a full beginner pathway rather than a sample", () => {
    const a1 = report.courses.find(course => course.cefr === "A1");
    expect(a1.units).toBeGreaterThanOrEqual(8);
    expect(a1.lessons).toBeGreaterThanOrEqual(16);
  });

  it("continues into A2", () => {
    const a2 = report.courses.find(course => course.cefr === "A2");
    expect(a2.units).toBeGreaterThanOrEqual(5);
    expect(a2.lessons).toBeGreaterThanOrEqual(10);
  });
});

describe("no screen opens onto nothing", () => {
  /* The single number the brief judges the product on. */
  it("has no empty learner-visible lesson", () => {
    expect(report.emptyLessons).toEqual([]);
  });

  it("has no unit without lessons", () => {
    expect(report.emptyUnits).toEqual([]);
  });

  it("gives every lesson vocabulary, grammar and practice", async () => {
    const courses = await services.curriculum.courses();
    const thin = [];
    for (const course of courses) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          const kinds = new Set(lesson.sections.map(section => section.kind));
          const types = new Set(
            lesson.sections.flatMap(section => section.items.map(item => item.contentType))
          );
          const missing = [
            kinds.has("vocabulary") ? null : "vocabulary",
            kinds.has("grammar") ? null : "grammar",
            kinds.has("practice") ? null : "practice",
            types.has("exercise") ? null : "exercises"
          ].filter(Boolean);
          if (missing.length) thin.push(`${lesson.slug}: ${missing.join(", ")}`);
        }
      }
    }
    expect(thin).toEqual([]);
  });
});

describe("the lessons teach", () => {
  it("states an objective on every lesson", async () => {
    const courses = await services.curriculum.courses();
    const silent = courses.flatMap(course => course.units.flatMap(unit => unit.lessons))
      .filter(lesson => !(lesson.objective?.ar || lesson.objective?.en || lesson.objective?.de))
      .map(lesson => lesson.slug);
    expect(silent).toEqual([]);
  });

  it("explains every grammar rule instead of only naming it", () => {
    expect(report.grammar.rulesWithoutExplanation).toEqual([]);
    expect(report.grammar.rules).toBeGreaterThan(20);
  });

  it("tells each grammar rule how the form is built", async () => {
    const topics = await services.grammar.topics();
    const rules = topics.flatMap(topic => topic.rules ?? []);
    const withFormation = rules.filter(
      rule => rule.formation?.de || rule.formation?.ar || rule.formation?.en
    );
    // Not every rule is about a form, but most are, and a rule that claims to teach one
    // without showing it is the failure this catches.
    expect(withFormation.length).toBeGreaterThan(rules.length * 0.6);
  });

  it("writes teaching text into sections, not just titles", async () => {
    const courses = await services.curriculum.courses();
    const lessons = courses.flatMap(course => course.units.flatMap(unit => unit.lessons));
    const untaught = lessons.filter(lesson =>
      !lesson.sections.some(section => Object.keys(section.teaching ?? {}).length)
    ).map(lesson => lesson.slug);
    expect(untaught).toEqual([]);
  });
});

describe("nothing on screen is a database identifier", () => {
  it("names every item of every lesson in some language", async () => {
    /*
     * The controller labels lesson items for the screen. A label that falls through to a
     * slug is how a learner ends up reading "deutschflow-a1-a1-l01-hallo-5" where a
     * question should be — so every item of every lesson is checked, not a sample.
     */
    const { createLearnController } = await import(
      "../../01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js");
    const controller = createLearnController({
      services, profileUuid: "local", now: () => NOW,
      source: { ready: true, reason: null, write: true }
    });

    const courses = await services.curriculum.courses();
    const slugLabelled = [];
    for (const course of courses) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          controller.view.courseSlug = course.slug;
          controller.view.lessonUuid = lesson.uuid;
          const data = await controller.load("learn-courses");
          for (const item of data.lesson.sections.flatMap(section => section.items)) {
            const label = data.labels[item.contentUuid];
            if (!label?.title) { slugLabelled.push(`${lesson.slug}: unlabelled`); continue; }
            if (/^[a-z0-9-]+$/.test(label.title) && label.title.includes("-")) {
              slugLabelled.push(`${lesson.slug}: ${label.title}`);
            }
          }
        }
      }
    }
    expect(slugLabelled).toEqual([]);
  });
});

describe("scoring is honest", () => {
  it("scores the exercises that carry an expected answer", () => {
    expect(report.exercises.gradeable).toBeGreaterThan(100);
  });

  it("marks the open-ended ones self-assessed rather than faking a score", () => {
    expect(report.exercises.selfAssessed).toBeGreaterThan(0);
    expect(report.exercises.gradeable + report.exercises.selfAssessed)
      .toBe(report.exercises.total);
  });

  it("accepts the intended answer and rejects a wrong one", async () => {
    const exercises = (await services.exercises.all()).filter(exercise => exercise.gradeable);
    expect(exercises.length).toBeGreaterThan(0);

    let checked = 0;
    for (const exercise of exercises.slice(0, 40)) {
      const expected = expectedAnswersFor(exercise);
      if (!expected.length) continue;
      // The evaluator compares against one German form plus any alternatives.
      const word = {
        german: expected[0].text,
        acceptedAnswers: expected.slice(1).map(entry => entry.text)
      };
      expect(validateGermanAnswer(word.german, word).isCorrect, exercise.slug).toBe(true);
      expect(validateGermanAnswer(`${word.german} zzz`, word).isCorrect, exercise.slug)
        .toBe(false);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("never lets Arabic decide whether an answer is right", async () => {
    const exercises = await services.exercises.all();
    const arabicScoreable = exercises.filter(
      exercise => exercise.gradeable && exercise.answerLanguage === ARABIC
    );
    expect(arabicScoreable).toEqual([]);
  });
});

describe("the path is walkable", () => {
  it("unlocks the first lesson and orders the rest behind it", async () => {
    for (const course of await services.curriculum.courses()) {
      const progress = await services.curriculum.progressForCourse(course.slug, "local");
      expect(progress.lessons.length).toBeGreaterThan(0);
      expect(progress.lessons[0].unlocked).toBe(true);
      expect(progress.resume.lessonUuid).toBe(progress.lessons[0].uuid);
    }
  });

  it("offers a resume point before anything has been studied", async () => {
    const resume = await services.curriculum.resume("local");
    expect(resume.lessonUuid).toBeTruthy();
    expect(resume.courseSlug).toBeTruthy();
  });
});
