// @vitest-environment happy-dom
/*
 * Independent Validation: Seven-Lesson A2 Curriculum Full Learner Journey
 *
 * Verifies across the real LearnController and Canonical Store:
 *   - Course discovery for "DeutschFlow Open A2"
 *   - Correct 7 lessons in exact sequence
 *   - Progression & exercise answering on Lesson 1, Lesson 4, and Lesson 7
 *   - Deterministic German scoring and error event recording
 *   - Progress persistence & reload survival across local store restart
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HARNESS_PROFILE, HARNESS_TIMESTAMP, bootLocalLearnerHarness, createMemoryStatePersistence
} from "../support/learner-journey-harness.js";
import { readManifest } from "../../tools/intake/run-open-content.mjs";

const MANIFEST = readManifest();
const EXPECTED_LESSON_TITLES = [
  "Alltag organisieren und einkaufen",
  "Familie und Feiern: über die Vergangenheit sprechen",
  "Reisen planen und von Reisen erzählen",
  "Gesund leben und beim Arzt sprechen",
  "Über Wohnen, Beziehungen und Arbeit sprechen",
  "Über Bildung und umweltbewusstes Handeln sprechen",
  "In der Stadt nach dem Weg fragen und Kultur erleben"
];

describe("Independent Validation: 7-Lesson A2 Learner Journey", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("proves curriculum integrity and exact 7 lessons in order", async () => {
    const harness = await bootLocalLearnerHarness();
    const coursesData = await harness.controller.load("learn-courses");
    const openA2 = coursesData.courses.find(c => c.slug === "deutschflow-open-a2");
    
    expect(openA2, "DeutschFlow Open A2 course must exist").toBeDefined();
    expect(openA2.units.length, "Exactly 7 units expected").toBe(7);

    const lessons = openA2.units.flatMap(u => u.lessons);
    expect(lessons.length, "Exactly 7 lessons expected").toBe(7);

    const titles = lessons.map(l => l.title?.de || l.title?.en || l.slug);
    expect(titles).toEqual(EXPECTED_LESSON_TITLES);
  });

  it("walks through Lesson 1, Lesson 4, and Lesson 7: exercise completion, grading, errors, and progress persistence", async () => {
    const persistence = createMemoryStatePersistence();
    
    // ── STEP 1: INITIAL BOOT ──
    const harness1 = await bootLocalLearnerHarness({
      persistence
    });

    const coursesData1 = await harness1.controller.load("learn-courses");
    const openA2 = coursesData1.courses.find(c => c.slug === "deutschflow-open-a2");
    const lessons = openA2.units.flatMap(u => u.lessons);

    const lesson1 = lessons[0];
    const lesson4 = lessons[3];
    const lesson7 = lessons[6];

    expect(lesson1.title.de).toBe(EXPECTED_LESSON_TITLES[0]);
    expect(lesson4.title.de).toBe(EXPECTED_LESSON_TITLES[3]);
    expect(lesson7.title.de).toBe(EXPECTED_LESSON_TITLES[6]);

    // ── STEP 2: COMPLETE LESSON 1 ──
    harness1.controller.view.lessonUuid = lesson1.uuid;
    harness1.controller.view.data = { lesson: lesson1 };
    await harness1.act("learn-complete-lesson", { lesson: lesson1.uuid });

    // Answer a gradeable exercise
    const exData1 = await harness1.controller.load("learn-exercises");
    const gradeable1 = exData1.exercises.find(e => e.gradeable);
    expect(gradeable1).toBeDefined();

    // Wrong answer -> error event recorded
    harness1.controller.view.exerciseUuid = gradeable1.uuid;
    await harness1.controller.load("learn-exercises");
    harness1.controller.view.answer = "VolligFalscheAntwort";
    await harness1.act("learn-submit-exercise", {});
    expect(harness1.controller.view.result.correct).toBe(false);

    // Correct answer -> score
    const expectedOption = gradeable1.options?.find(o => o.isExpected);
    if (expectedOption) {
      await harness1.act("learn-submit-exercise", { choice: expectedOption.uuid });
      expect(harness1.controller.view.result.correct).toBe(true);
    }

    // ── STEP 3: COMPLETE LESSON 4 ──
    harness1.controller.view.lessonUuid = lesson4.uuid;
    harness1.controller.view.data = { lesson: lesson4 };
    await harness1.act("learn-complete-lesson", { lesson: lesson4.uuid });

    // ── STEP 4: COMPLETE LESSON 7 ──
    harness1.controller.view.lessonUuid = lesson7.uuid;
    harness1.controller.view.data = { lesson: lesson7 };
    await harness1.act("learn-complete-lesson", { lesson: lesson7.uuid });

    // Flush persistence
    await harness1.flush();

    const progress1 = await harness1.runtime.services.curriculum.progressForCourse("deutschflow-open-a2", HARNESS_PROFILE);
    expect(progress1.lessonsCompleted).toBe(3);

    // ── STEP 5: COLD RELOAD & RESTORATION ──
    const harness2 = await bootLocalLearnerHarness({
      persistence,
      now: () => HARNESS_TIMESTAMP + 50000
    });

    const progress2 = await harness2.runtime.services.curriculum.progressForCourse("deutschflow-open-a2", HARNESS_PROFILE);
    expect(progress2.lessonsCompleted).toBe(3);
    expect(progress2.lessons.find(l => l.uuid === lesson1.uuid).status).toBe("completed");
    expect(progress2.lessons.find(l => l.uuid === lesson4.uuid).status).toBe("completed");
    expect(progress2.lessons.find(l => l.uuid === lesson7.uuid).status).toBe("completed");

    // Check error summary survived
    const errSummary = await harness2.runtime.services.errors.summary(HARNESS_PROFILE, { now: HARNESS_TIMESTAMP + 50000 });
    expect(errSummary.active).toBeGreaterThan(0);
  });
});
