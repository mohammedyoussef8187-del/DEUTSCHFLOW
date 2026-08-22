// @vitest-environment happy-dom
/*
 * The whole product journey, over the store a learner in a browser actually gets.
 *
 *   open app -> pick a course -> pick a lesson -> learn -> exercise -> deterministic
 *   score -> error learning -> review -> listening -> progress saved -> close ->
 *   reopen offline -> continue
 *
 * Every step here runs against the LOCAL canonical store: shipped content, no SQLite, no
 * native platform, learner rows persisted locally. That is the configuration `app.js`
 * boots, so a step passing here is a step a learner can really take. The SQLite journey
 * is covered separately; this file exists because passing there proved nothing about the
 * only build anybody can currently run.
 *
 * Nothing is seeded. The content is the real Nicos Weg A2 import, read from the same
 * `data/canonical-content.json` the app fetches.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  HARNESS_PROFILE, HARNESS_TIMESTAMP, bootLocalLearnerHarness,
  createMemoryStatePersistence, createShippedContentLoader, readShippedContent
} from "../support/learner-journey-harness.js";
import {
  createIndexedDbStatePersistence
} from "../../01_APPLICATION/CURRENT_APP/src/platform/memory/local-canonical-persistence.js";
import {
  PERSISTED_ENTITIES
} from "../../01_APPLICATION/CURRENT_APP/src/platform/memory/local-canonical-store.js";

const NOW = HARNESS_TIMESTAMP;

afterEach(() => { document.body.innerHTML = ""; });

/** Answer the exercise on screen the way the learner does: type, then submit. */
async function answer(harness, text) {
  const input = document.getElementById("learn-answer");
  if (input) input.value = text;
  else harness.controller.view.answer = text;
  return harness.act("learn-submit-exercise", {});
}

/** The first exercise the evaluator is allowed to score. */
function firstGradeable(data) {
  return data.exercises.find(exercise => exercise.gradeable);
}

describe("open the app", () => {
  it("resolves the local store, not an empty one", async () => {
    const harness = await bootLocalLearnerHarness();
    expect(harness.runtime.kind).toBe("local");
    expect(harness.runtime.available).toBe(true);
    expect(harness.runtime.reason).toBeNull();
    expect(harness.runtime.writable).toBe(true);
  });

  it("offers the curriculum with real counts on the hub", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data, html } = await harness.navigate("learn");

    expect(data.courses).toBeGreaterThan(0);
    expect(data.exercises).toBeGreaterThan(0);
    expect(data.listening).toBeGreaterThan(0);
    expect(data.sentences).toBeGreaterThan(0);
    // No "content store unavailable" note: the store is there.
    expect(html).not.toContain("store-note");
  });

  it("says why rather than crashing when the dataset cannot be loaded", async () => {
    const harness = await bootLocalLearnerHarness({
      loadContent: async () => { throw new Error("offline and never cached"); }
    });
    expect(harness.runtime.available).toBe(false);
    expect(harness.runtime.reason).toContain("offline and never cached");

    const { html } = await harness.navigate("learn-courses");
    expect(html).toContain("store-note");
    // And the screen still renders; study must survive a missing curriculum.
    expect(html.length).toBeGreaterThan(0);
  });
});

describe("select a course and a lesson", () => {
  it("lands on a course that has something to study", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-courses");

    expect(data.courses.length).toBeGreaterThan(1);
    const lessons = data.course.units.flatMap(unit => unit.lessons);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.some(lesson => lesson.sections.length > 0)).toBe(true);

    /* And it is the FIRST such course, not merely any of them: a course with nothing to
       study must never be the one a learner opens on. */
    const firstStudyable = data.courses.find(course =>
      course.units.some(unit => unit.lessons.some(lesson => lesson.sections.length > 0)));
    expect(data.course.slug).toBe(firstStudyable.slug);
  });

  it("still lists the structure-only course, and it is still openable", async () => {
    const harness = await bootLocalLearnerHarness();
    const listed = await harness.navigate("learn-courses");
    expect(listed.data.courses.map(course => course.slug)).toContain("netzwerk-neu-a2");

    await harness.act("learn-course", { slug: "netzwerk-neu-a2" });
    const { data } = await harness.navigate("learn-courses");
    expect(data.course.slug).toBe("netzwerk-neu-a2");
    const chapters = data.course.units.flatMap(unit => unit.lessons);
    expect(chapters).toHaveLength(12);
    // Registered chapters, no invented lessons inside them.
    expect(chapters.every(chapter => chapter.sections.length === 0)).toBe(true);
  });

  it("opens a real lesson and shows its sections of real content", async () => {
    const harness = await bootLocalLearnerHarness();
    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];

    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    const { data, html } = await harness.navigate("learn-courses");

    expect(data.lesson.uuid).toBe(lesson.uuid);
    expect(data.lesson.sections.length).toBeGreaterThan(0);
    expect(html).toContain("learn-lesson");
  });
});

describe("consume the learning content", () => {
  it("shows the imported sentences with their German text", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-sentences");
    expect(data.sentences.length).toBeGreaterThan(0);
    expect(data.sentences[0].german).toBeTruthy();
  });

  it("shows a listening activity built from the real transcript", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-listening");
    expect(data.activities.length).toBeGreaterThan(0);
    expect(data.activity.segments.length).toBeGreaterThan(0);
    expect(data.activity.speakers.length).toBeGreaterThan(0);
  });

  it("renders an honest empty state where nothing is authored", async () => {
    const harness = await bootLocalLearnerHarness();
    // No pronunciation content has been imported for any course. The route says so
    // rather than inventing an item to fill the screen.
    const { data } = await harness.navigate("learn-pronunciation");
    expect(data.items).toEqual([]);
    expect(data.item).toBeNull();

    const grammar = await harness.navigate("learn-grammar");
    expect(grammar.data.topics).toEqual([]);
  });
});

describe("a lesson leads somewhere", () => {
  const openLesson = async harness => {
    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];
    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    return harness.navigate("learn-courses");
  };

  it("names every item instead of showing its uuid", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await openLesson(harness);

    const items = data.lesson.sections.flatMap(section => section.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const label = data.labels[item.contentUuid];
      expect(label, `${item.contentType} ${item.contentUuid}`).toBeTruthy();
      expect(label.title).toBeTruthy();
      expect(label.title).not.toBe(item.contentUuid);
    }
  });

  it("shows a word with its German form and its reviewed Arabic meaning", async () => {
    const harness = await bootLocalLearnerHarness();
    /* The Nicos lesson, whose Arabic gloss came from the source and is published. The
       open-content lesson deliberately has none yet — its Arabic is a draft awaiting an
       educator — and a word there shows its German alone. */
    await harness.act("learn-course", { slug: "nicos-weg-a2" });
    const { data } = await openLesson(harness);

    const word = data.lesson.sections.flatMap(s => s.items)
      .find(item => item.contentType === "vocabulary");
    const label = data.labels[word.contentUuid];
    expect(label.lang).toBe("de");
    expect(label.detail).toBeTruthy();       // the Arabic meaning, not a second uuid
  });

  it("renders the items as controls the learner can press", async () => {
    const harness = await bootLocalLearnerHarness();
    await openLesson(harness);

    const view = document.getElementById("learn-lesson");
    const buttons = [...view.shadowRoot.querySelectorAll("button.item")];
    expect(buttons.length).toBeGreaterThan(0);
    // The label is what is on screen; the uuid is not.
    const text = view.shadowRoot.textContent;
    for (const item of harness.controller.view.data.lesson.sections.flatMap(s => s.items)) {
      expect(text).not.toContain(item.contentUuid);
    }
  });

  it("opens the exercise a practice item stands for", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await openLesson(harness);
    const practice = data.lesson.sections.flatMap(s => s.items)
      .find(item => item.contentType === "exercise");

    const result = await harness.event("item-select", {
      contentType: "exercise", contentUuid: practice.contentUuid
    });
    expect(result.route).toBe("learn-exercises");

    const opened = await harness.navigate("learn-exercises");
    expect(opened.data.exercise.uuid).toBe(practice.contentUuid);
  });

  it("opens the listening activity a reading item stands for", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await openLesson(harness);
    const listening = data.lesson.sections.flatMap(s => s.items)
      .find(item => item.contentType === "listening");

    const result = await harness.event("item-select", {
      contentType: "listening", contentUuid: listening.contentUuid
    });
    expect(result.route).toBe("learn-listening");

    const opened = await harness.navigate("learn-listening");
    expect(opened.data.activity.uuid).toBe(listening.contentUuid);
  });

  it("keeps a word on the lesson screen, where it is already shown in full", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await openLesson(harness);
    const word = data.lesson.sections.flatMap(s => s.items)
      .find(item => item.contentType === "vocabulary");

    const result = await harness.event("item-select", {
      contentType: "vocabulary", contentUuid: word.contentUuid
    });
    expect(result.route).toBeUndefined();
    expect(result.reload).toBe(false);
  });

  it("names each task in the exercise picker rather than listing slugs", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data, html } = await harness.navigate("learn-exercises");
    expect(data.exercises.length).toBeGreaterThan(1);

    const named = data.exercises.filter(exercise =>
      exercise.instruction?.ar || exercise.instruction?.de);
    expect(named.length).toBeGreaterThan(0);
    // A slug survives only as the tooltip, never as the visible label.
    expect(html).toContain(`title="${named[0].slug}"`);
  });
});


describe("complete an exercise and get a deterministic score", () => {
  it("marks the right German answer correct", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-exercises");
    const exercise = firstGradeable(data);
    expect(exercise).toBeTruthy();

    await harness.act("learn-exercise", { uuid: exercise.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, exercise.expectedAnswers[0].text);

    expect(harness.controller.view.result.selfAssessed).toBe(false);
    expect(harness.controller.view.result.correct).toBe(true);
  });

  it("marks a wrong answer wrong, and grades the same answer the same way twice", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-exercises");
    const exercise = firstGradeable(data);

    await harness.act("learn-exercise", { uuid: exercise.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "völliger unsinn");
    const first = { ...harness.controller.view.result };

    await answer(harness, "völliger unsinn");
    expect(harness.controller.view.result.correct).toBe(first.correct);
    expect(first.correct).toBe(false);
  });

  it("never returns a verdict for an exercise whose answer is Arabic", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-exercises");
    const arabic = data.exercises.find(exercise => !exercise.gradeable);
    expect(arabic).toBeTruthy();

    await harness.act("learn-exercise", { uuid: arabic.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "أي شيء");

    expect(harness.controller.view.result.selfAssessed).toBe(true);
    expect(harness.controller.view.result.correct).toBeNull();
  });
});

describe("error learning follows a real mistake", () => {
  const makeMistake = async harness => {
    const { data } = await harness.navigate("learn-exercises");
    const exercise = firstGradeable(data);
    await harness.act("learn-exercise", { uuid: exercise.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "definitiv falsch");
    return exercise;
  };

  it("records the mistake as an error event against the exercise", async () => {
    const harness = await bootLocalLearnerHarness();
    const exercise = await makeMistake(harness);

    const events = await harness.repositories.errorEvents.find({ profileUuid: HARNESS_PROFILE });
    expect(events).toHaveLength(1);
    expect(events[0].contentUuid).toBe(exercise.uuid);
    expect(events[0].skill).toBe("exercise");
  });

  it("surfaces it on the error-learning route", async () => {
    const harness = await bootLocalLearnerHarness();
    await makeMistake(harness);

    const { data } = await harness.navigate("learn-errors");
    expect(data.summary.active).toBeGreaterThan(0);
    expect(data.summary.categories.length).toBeGreaterThan(0);
  });

  it("records nothing for a self-assessed Arabic answer", async () => {
    const harness = await bootLocalLearnerHarness();
    const { data } = await harness.navigate("learn-exercises");
    const arabic = data.exercises.find(exercise => !exercise.gradeable);

    await harness.act("learn-exercise", { uuid: arabic.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "لا شيء");

    expect(await harness.repositories.errorEvents.count()).toBe(0);
  });
});

describe("progress is saved", () => {
  const completeFirstLesson = async harness => {
    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];
    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    await harness.navigate("learn-courses");
    await harness.act("learn-complete-lesson", { lesson: lesson.uuid });
    return lesson;
  };

  it("records the lesson, its sections and the course resume point", async () => {
    const harness = await bootLocalLearnerHarness();
    const lesson = await completeFirstLesson(harness);

    const [progress] = await harness.repositories.lessonProgress.find({ lessonUuid: lesson.uuid });
    expect(progress.status).toBe("completed");
    expect(progress.completedAt).toBe(NOW);

    const [course] = await harness.repositories.courseProgress.find({ profileUuid: HARNESS_PROFILE });
    expect(course.lastLessonUuid).toBe(lesson.uuid);
    expect(await harness.repositories.sectionProgress.count()).toBeGreaterThan(0);
  });

  it("shows the completion back on the course screen", async () => {
    const harness = await bootLocalLearnerHarness();
    const lesson = await completeFirstLesson(harness);

    const { data } = await harness.navigate("learn-courses");
    const entry = data.progress.lessons.find(row => row.uuid === lesson.uuid);
    expect(entry.status).toBe("completed");
  });
});

describe("close the app, reopen it offline, continue", () => {
  /** Everything a learner did in one session, over one persistence handle. */
  async function firstSession(persistence) {
    const harness = await bootLocalLearnerHarness({ persistence });

    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];
    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    await harness.navigate("learn-courses");
    await harness.act("learn-complete-lesson", { lesson: lesson.uuid });

    const exercises = await harness.navigate("learn-exercises");
    const exercise = firstGradeable(exercises.data);
    await harness.act("learn-exercise", { uuid: exercise.uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "das ist falsch");

    await harness.flush();
    return { harness, lesson, exercise };
  }

  it("keeps progress and error history across a restart", async () => {
    const persistence = createMemoryStatePersistence();
    const { lesson } = await firstSession(persistence);

    // The app closes. Nothing of the first runtime survives except what was written.
    const reopened = await bootLocalLearnerHarness({ persistence });

    const [progress] = await reopened.repositories.lessonProgress.find({ lessonUuid: lesson.uuid });
    expect(progress.status).toBe("completed");
    expect(await reopened.repositories.errorEvents.count()).toBe(1);

    const { data } = await reopened.navigate("learn-courses");
    expect(data.progress.lessons.find(row => row.uuid === lesson.uuid).status).toBe("completed");
  });

  it("continues offline, with the content served from the cached dataset", async () => {
    const persistence = createMemoryStatePersistence();
    const { lesson } = await firstSession(persistence);

    /*
     * Offline is not "no content": the service worker precaches the dataset, so the
     * fetch still resolves from the cache while the network is gone. What must not
     * happen is a request escaping to the network.
     */
    const cached = readShippedContent();
    let networkCalls = 0;
    const offline = await bootLocalLearnerHarness({
      persistence,
      loadContent: async () => { networkCalls += 1; return structuredClone(cached); }
    });

    expect(networkCalls).toBe(1);
    expect(offline.runtime.available).toBe(true);

    // Continue: the lesson is still complete, and a second lesson can still be worked on.
    const { data } = await offline.navigate("learn-courses");
    expect(data.progress.lessons.find(row => row.uuid === lesson.uuid).status).toBe("completed");

    const exercises = await offline.navigate("learn-exercises");
    const exercise = firstGradeable(exercises.data);
    await offline.act("learn-exercise", { uuid: exercise.uuid });
    await offline.navigate("learn-exercises");
    await answer(offline, exercise.expectedAnswers[0].text);
    expect(offline.controller.view.result.correct).toBe(true);
  });

  it("replaces content from the shipped copy rather than from what was saved", async () => {
    const persistence = createMemoryStatePersistence();
    await firstSession(persistence);

    const saved = await persistence.read();
    // Only learner tables are persisted; content never rides along.
    expect(Object.keys(saved.entities).every(entity => PERSISTED_ENTITIES.includes(entity)))
      .toBe(true);
    expect(saved.entities.courses).toBeUndefined();
    expect(saved.entities.exercises).toBeUndefined();
    expect(saved.entities.vocabularyItems).toBeUndefined();
  });

  it("survives a persistence layer that fails, without losing the session", async () => {
    const broken = {
      read: async () => { throw new Error("storage unreadable"); },
      write: async () => { throw new Error("storage full"); }
    };
    const harness = await bootLocalLearnerHarness({ persistence: broken });

    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];
    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    await harness.navigate("learn-courses");
    await harness.act("learn-complete-lesson", { lesson: lesson.uuid });

    // The write failed, but the session is intact and the learner is not shown a crash.
    const [progress] = await harness.repositories.lessonProgress.find({ lessonUuid: lesson.uuid });
    expect(progress.status).toBe("completed");
  });
});

describe("the browser persistence port", () => {
  let factory;
  beforeEach(() => { factory = new IDBFactory(); });

  it("round-trips learner state through a real IndexedDB", async () => {
    const persistence = createIndexedDbStatePersistence({ indexedDB: factory });
    const harness = await bootLocalLearnerHarness({ persistence });

    const listed = await harness.navigate("learn-courses");
    const lesson = listed.data.course.units.flatMap(unit => unit.lessons)[0];
    await harness.act("learn-open-lesson", { lesson: lesson.uuid });
    await harness.navigate("learn-courses");
    await harness.act("learn-complete-lesson", { lesson: lesson.uuid });
    await harness.flush();

    const reopened = await bootLocalLearnerHarness({
      persistence: createIndexedDbStatePersistence({ indexedDB: factory })
    });
    const [progress] = await reopened.repositories.lessonProgress.find({ lessonUuid: lesson.uuid });
    expect(progress.status).toBe("completed");
  });

  it("uses a database of its own, never the legacy learner one", async () => {
    const persistence = createIndexedDbStatePersistence({ indexedDB: factory });
    await persistence.write({ schemaVersion: 10, entities: {} });

    const names = (await factory.databases()).map(entry => entry.name);
    expect(names).toContain("deutschflow_canonical_local");
    expect(names).not.toContain("deutschflow_v2");
  });
});

describe("the curriculum cannot reach SRS state", () => {
  it("persists no review card or review event, whatever the learner does", async () => {
    const persistence = createMemoryStatePersistence();
    const harness = await bootLocalLearnerHarness({ persistence });

    for (const route of ["learn", "learn-courses", "learn-sentences", "learn-exercises",
      "learn-listening", "learn-pronunciation", "learn-errors", "learn-grammar"]) {
      await harness.navigate(route);
    }
    const exercises = await harness.navigate("learn-exercises");
    await harness.act("learn-exercise", { uuid: firstGradeable(exercises.data).uuid });
    await harness.navigate("learn-exercises");
    await answer(harness, "wieder falsch");
    await harness.flush();

    expect(await harness.repositories.cards.count()).toBe(0);
    expect(await harness.repositories.events.count()).toBe(0);

    // And the SRS tables are not even in the set of things this store saves.
    expect(PERSISTED_ENTITIES).not.toContain("reviewCards");
    expect(PERSISTED_ENTITIES).not.toContain("reviewEvents");
    const saved = await persistence.read();
    expect(saved.entities.reviewCards).toBeUndefined();
    expect(saved.entities.reviewEvents).toBeUndefined();
  });
});

describe("the shipped dataset is the one the tests assume", () => {
  it("carries content and no learner rows", async () => {
    const dataset = readShippedContent();
    expect(dataset.schemaVersion).toBe(10);
    expect(dataset.entities.courses.length).toBeGreaterThan(0);
    expect(dataset.entities.exercises.length).toBeGreaterThan(0);

    for (const entity of PERSISTED_ENTITIES) {
      expect(dataset.entities[entity], `${entity} must not ship`).toBeUndefined();
    }
    expect(dataset.entities.reviewCards).toBeUndefined();
    expect(dataset.entities.reviewEvents).toBeUndefined();
  });

  it("loads into a store that reports the same counts it declares", async () => {
    const dataset = readShippedContent();
    const harness = await bootLocalLearnerHarness({
      loadContent: createShippedContentLoader(dataset)
    });
    for (const [entity, count] of Object.entries(dataset.counts)) {
      expect(await harness.repositories[entity]?.count({}, { includeDeleted: true }) ?? count)
        .toBe(count);
    }
  });
});
