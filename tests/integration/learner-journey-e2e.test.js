// @vitest-environment happy-dom
/*
 * End-to-End Learner Journey Harness Tests
 *
 * Validates the complete real learning product lifecycle:
 *   1. App bootstrap & runtime initialization
 *   2. Course & lesson availability (using verified Nicos Weg content)
 *   3. Opening a lesson and exploring sections
 *   4. Exercise presentation (multiple choice & typed input)
 *   5. Answer submission & deterministic evaluation (German vs Arabic)
 *   6. Error learning event & category logging on wrong answers
 *   7. Lesson completion & progress persistence
 *   8. Close, reload, and cold-start state restoration across session lifecycles
 *   9. Isolation verification (no unintended writes / zero SRS corruption)
 *   10. Repeated action idempotency (no duplicate records)
 *   11. Listening, pronunciation & reminder integration verification
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HARNESS_PROFILE,
  HARNESS_TIMESTAMP,
  bootLearnerHarness,
  importNicosWegContent
} from "../support/learner-journey-harness.js";

describe("Learner Journey End-to-End Harness", () => {
  const cleanup = [];
  const tempFiles = [];

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;
  });

  afterEach(async () => {
    document.body.innerHTML = "";
    while (cleanup.length) await cleanup.pop()();
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
  });

  it("executes the full end-to-end learning lifecycle with real Nicos Weg content", async () => {
    // ── STAGE 1: APP BOOTSTRAP ──
    const harness = await bootLearnerHarness();
    cleanup.push(harness.close);

    expect(harness.runtime.available).toBe(true);
    expect(harness.runtime.writable).toBe(true);
    expect(harness.runtime.services).toBeDefined();

    // Import real verified Nicos Weg A2 intake content
    const batchResult = await importNicosWegContent(harness.repositories);
    expect(batchResult.applied.length).toBeGreaterThan(0);

    // Initial counts
    const initialCards = await harness.repositories.cards.all();
    const initialAttempts = await harness.repositories.pronunciationAttempts.all();
    const initialErrors = await harness.repositories.errorEvents.all();

    // ── STAGE 2: COURSE & LESSON DISCOVERY ──
    const hubNav = await harness.navigate("learn");
    expect(hubNav.data.courses).toBeGreaterThan(0);
    expect(hubNav.data.exercises).toBeGreaterThan(0);
    expect(hubNav.data.listening).toBeGreaterThan(0);

    const coursesNav = await harness.navigate("learn-courses");
    expect(coursesNav.data.courses.length).toBeGreaterThan(0);
    const course = coursesNav.data.courses[0];
    expect(course.slug).toBe("nicos-weg-a2");

    const unit = course.units[0];
    expect(unit.lessons.length).toBeGreaterThan(0);
    const lesson = unit.lessons[0];
    expect(lesson.slug).toBe("familiengeschichten");

    // ── STAGE 3: OPEN LESSON ──
    await harness.controller.handleAction("learn-open-lesson", { lesson: lesson.uuid });
    await harness.navigate("learn-courses");
    expect(harness.controller.view.lessonUuid).toBe(lesson.uuid);
    expect(document.querySelector("#learn-lesson")).not.toBeNull();

    // ── STAGE 4: EXERCISE PRESENTATION ──
    // Find a gradeable multiple_choice or type_answer exercise
    const allExercises = await harness.runtime.services.exercises.all();
    const gradeableEx = allExercises.find(e => e.gradeable) || allExercises[0];
    expect(gradeableEx).toBeDefined();

    harness.controller.view.exerciseUuid = gradeableEx.uuid;
    await harness.navigate("learn-exercises");
    expect(harness.controller.view.data.exercise.uuid).toBe(gradeableEx.uuid);

    // ── STAGE 5: SUBMIT WRONG ANSWER & DETERMINISTIC SCORING ──
    const wrongAnswer = "VolligFalsch";
    if (gradeableEx.type === "multiple_choice") {
      const wrongOption = gradeableEx.options?.find(o => !o.isExpected) || { uuid: "wrong-opt" };
      await harness.controller.handleAction("learn-submit-exercise", { choice: wrongOption.uuid });
    } else {
      const answerInput = document.getElementById("learn-answer");
      if (answerInput) answerInput.value = wrongAnswer;
      await harness.controller.handleAction("learn-submit-exercise", {});
    }
    
    expect(harness.controller.view.result).not.toBeNull();
    expect(harness.controller.view.result.correct).toBe(false);
    expect(harness.controller.view.result.selfAssessed).toBe(false);

    // ── STAGE 6: ERROR EVENT RECORDING ──
    const recordedErrors = await harness.repositories.errorEvents.all();
    expect(recordedErrors.length).toBe(initialErrors.length + 1);
    const errorEvent = recordedErrors[recordedErrors.length - 1];
    expect(errorEvent.contentUuid).toBe(gradeableEx.uuid);
    expect(errorEvent.contentType).toBe("exercise");

    // Error event categories should be linked
    const eventCategories = await harness.repositories.errorEventCategories.find({ eventUuid: errorEvent.uuid });
    expect(eventCategories.length).toBeGreaterThan(0);

    // ── STAGE 7: SUBMIT CORRECT ANSWER ──
    if (gradeableEx.type === "multiple_choice") {
      const correctOption = gradeableEx.options?.find(o => o.isExpected);
      await harness.controller.handleAction("learn-submit-exercise", { choice: correctOption.uuid });
    } else {
      const expectedAnswerText = gradeableEx.options?.find(o => o.isExpected)?.text || gradeableEx.expectedAnswers?.[0]?.text;
      const answerInput = document.getElementById("learn-answer");
      if (answerInput) answerInput.value = expectedAnswerText;
      await harness.controller.handleAction("learn-submit-exercise", {});
    }
    expect(harness.controller.view.result.correct).toBe(true);

    // ── STAGE 8: LESSON COMPLETION & PROGRESS PERSISTENCE ──
    harness.controller.view.lessonUuid = lesson.uuid;
    harness.controller.view.data = { lesson };
    const completionResult = await harness.controller.handleAction("learn-complete-lesson", { lesson: lesson.uuid });
    expect(completionResult.reload).toBe(true);

    const lessonProgress = await harness.repositories.lessonProgress.find({ profileUuid: HARNESS_PROFILE, lessonUuid: lesson.uuid });
    expect(lessonProgress.length).toBe(1);
    expect(lessonProgress[0].status).toBe("completed");

    const courseProgress = await harness.repositories.courseProgress.find({ profileUuid: HARNESS_PROFILE, courseUuid: course.uuid });
    expect(courseProgress.length).toBe(1);
    expect(courseProgress[0].status).toBe("in_progress");
    expect(courseProgress[0].lastLessonUuid).toBe(lesson.uuid);

    // ── STAGE 9: SRS ISOLATION CHECK ──
    // Completing lesson and doing exercises must NOT touch or corrupt review_cards
    const currentCards = await harness.repositories.cards.all();
    expect(currentCards.length).toBe(initialCards.length);
  });

  it("persists learner progress across cold-start reload with a durable SQLite database file", async () => {
    const tempDbPath = path.resolve(process.cwd(), `tools/intake/artifacts/test-learner-journey-${Date.now()}.db`);
    tempFiles.push(tempDbPath);

    // 1. Initial launch: import content and record progress
    {
      const harness1 = await bootLearnerHarness({ dbPath: tempDbPath });
      await importNicosWegContent(harness1.repositories);

      const coursesNav = await harness1.navigate("learn-courses");
      const lesson = coursesNav.data.courses[0].units[0].lessons[0];

      harness1.controller.view.data = { lesson };
      await harness1.controller.handleAction("learn-complete-lesson", { lesson: lesson.uuid });
      await harness1.close();
    }

    // 2. Cold-start reload from same persistent file
    {
      const harness2 = await bootLearnerHarness({ dbPath: tempDbPath });
      cleanup.push(harness2.close);

      const coursesNav = await harness2.navigate("learn-courses");
      expect(coursesNav.data.progress).not.toBeNull();
      expect(coursesNav.data.progress.lessonsCompleted).toBe(1);

      const course = coursesNav.data.courses[0];
      const lesson = course.units[0].lessons[0];

      const savedLessonProgress = await harness2.repositories.lessonProgress.find({
        profileUuid: HARNESS_PROFILE,
        lessonUuid: lesson.uuid
      });
      expect(savedLessonProgress.length).toBe(1);
      expect(savedLessonProgress[0].status).toBe("completed");

      // Verify re-completing same lesson does not duplicate progress rows (idempotency)
      harness2.controller.view.data = { lesson };
      await harness2.controller.handleAction("learn-complete-lesson", { lesson: lesson.uuid });
      const recheckedProgress = await harness2.repositories.lessonProgress.find({
        profileUuid: HARNESS_PROFILE,
        lessonUuid: lesson.uuid
      });
      expect(recheckedProgress.length).toBe(1);
    }
  });

  it("verifies multilingual content, pronunciation and reminder boundaries", async () => {
    const harness = await bootLearnerHarness();
    cleanup.push(harness.close);
    await importNicosWegContent(harness.repositories);

    // 1. Multilingual Sentences retrieval
    const sentencesNav = await harness.navigate("learn-sentences");
    expect(sentencesNav.data.sentences.length).toBeGreaterThan(0);
    const sentence = sentencesNav.data.sentences[0];
    expect(sentence.german).toBeDefined();
    expect(sentence.translations.ar).toBeDefined();

    // 2. Listening activity structure & offline readiness check
    const listeningNav = await harness.navigate("learn-listening");
    expect(listeningNav.data.activities.length).toBeGreaterThan(0);
    const activity = listeningNav.data.activities[0];
    expect(activity.segments.length).toBeGreaterThan(0);
    // Transcript is present and teaches even without local audio binary
    expect(activity.segments[0].german).toBeDefined();

    // 3. Spoken pronunciation attempt logging
    // Seed a pronunciation item
    await harness.runtime.source.write.content.savePronunciation({
      feature: {
        uuid: "f-ue",
        slug: "front-rounded-u",
        featureKind: "phoneme",
        ipa: "yː",
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: HARNESS_TIMESTAMP,
        updatedAt: HARNESS_TIMESTAMP,
        revision: 1,
        deleted: 0
      },
      item: {
        uuid: "pi-1",
        slug: "buecher",
        featureUuid: "f-ue",
        practiceMode: "listen_and_repeat",
        targetType: "vocabulary",
        targetUuid: "v-buch",
        modelAudioUuid: null,
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: HARNESS_TIMESTAMP,
        updatedAt: HARNESS_TIMESTAMP,
        revision: 1,
        deleted: 0
      },
      texts: [],
      variants: [],
      pairs: [],
      links: []
    }, { now: HARNESS_TIMESTAMP });

    const pronNav = await harness.navigate("learn-pronunciation");
    expect(pronNav.data.items.length).toBeGreaterThan(0);

    // Self-rate spoken attempt
    await harness.controller.handleEvent("self-rate", {
      itemUuid: "pi-1",
      selfRating: 3
    });

    const attempts = await harness.repositories.pronunciationAttempts.find({
      profileUuid: HARNESS_PROFILE,
      itemUuid: "pi-1"
    });
    expect(attempts.length).toBe(1);
    expect(attempts[0].selfRating).toBe(3);

    // 4. Reminders settings update
    await harness.controller.handleEvent("reminder-change", {
      field: "enabled",
      value: true
    });
    await harness.controller.handleEvent("reminder-change", {
      field: "dailyTime",
      value: "19:30"
    });

    const reminderSettings = await harness.repositories.reminderSettings.find({
      profileUuid: HARNESS_PROFILE
    });
    expect(reminderSettings.length).toBe(1);
    expect(reminderSettings[0].enabled).toBe(1);
    expect(reminderSettings[0].dailyTime).toBe("19:30");
  });

  it("strictly enforces that Arabic answers are advisory and never score deterministic errors", async () => {
    const harness = await bootLearnerHarness();
    cleanup.push(harness.close);

    // Seed an Arabic-prompted exercise
    await harness.runtime.source.write.content.saveExercise({
      exercise: {
        uuid: "ex-ar-test",
        slug: "ar-translation",
        exerciseType: "type_answer",
        answerLanguage: "ar",
        level: "A1",
        ordering: 1,
        contentStatus: "verified",
        contentVersion: 1,
        createdAt: HARNESS_TIMESTAMP,
        updatedAt: HARNESS_TIMESTAMP,
        revision: 1,
        deleted: 0
      },
      texts: [
        {
          uuid: "ext-1",
          exerciseUuid: "ex-ar-test",
          language: "de",
          kind: "prompt",
          text: "Guten Tag",
          contentStatus: "verified",
          contentVersion: 1,
          createdAt: HARNESS_TIMESTAMP,
          updatedAt: HARNESS_TIMESTAMP,
          revision: 1,
          deleted: 0
        }
      ],
      options: [
        {
          uuid: "exo-1",
          exerciseUuid: "ex-ar-test",
          text: "نهار سعيد",
          language: "ar",
          isExpected: 1,
          scoreable: 0,
          ordering: 1,
          createdAt: HARNESS_TIMESTAMP,
          updatedAt: HARNESS_TIMESTAMP,
          revision: 1,
          deleted: 0
        }
      ],
      targets: []
    }, { now: HARNESS_TIMESTAMP });

    await harness.navigate("learn-exercises");
    harness.controller.view.exerciseUuid = "ex-ar-test";
    await harness.navigate("learn-exercises");

    const exercise = harness.controller.view.data.exercise;
    expect(exercise.gradeable).toBe(false);

    // Submit user Arabic answer
    const answerInput = document.getElementById("learn-answer");
    if (answerInput) answerInput.value = "مرحبا";
    await harness.controller.handleAction("learn-submit-exercise", {});

    const result = harness.controller.view.result;
    expect(result.selfAssessed).toBe(true);
    expect(result.correct).toBeNull(); // Must be null, NEVER false

    // No error event should be recorded because Arabic never scores
    const errorEvents = await harness.repositories.errorEvents.find({ contentUuid: "ex-ar-test" });
    expect(errorEvents.length).toBe(0);
  });
});
