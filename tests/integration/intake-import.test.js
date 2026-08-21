// @vitest-environment happy-dom
/*
 * The intake pipeline against a real store, and the imported lesson rendered through the
 * real learner UI.
 *
 * What this proves:
 *   - the diff decides before anything is written, and a re-import writes nothing
 *   - a source change against VERIFIED content is refused, not silently applied
 *   - a failed aggregate rolls back whole
 *   - provenance survives into the store
 *   - the lesson reaches the actual Learn routes, with English shown as missing
 *   - no SRS row is touched by any of it
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import {
  bootstrapCanonicalRuntime, createServices
} from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createLearnController } from "../../01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js";
import { parseExercises, parseManuscript } from "../../tools/intake/parse-nicos-weg.js";
import { mapLesson } from "../../tools/intake/map-canonical.js";
import { sourceById } from "../../tools/intake/sources.js";
import {
  CHANGE, applyImport, classifyRow, flattenRows, planImport, verifyImport
} from "../../tools/intake/import.js";

const NOW = 1775000000000;
const PROFILE = "local";
const MANUSCRIPT = "nicos-weg-a2-e2-l1-manuscript";
const EXERCISES = "nicos-weg-a2-e2-l1-exercises";

function artifact(sourceId) {
  const dir = path.resolve(process.cwd(), "tools/intake/artifacts", sourceId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8"));
  return { ...meta, raw: fs.readFileSync(path.join(dir, "raw.txt"), "utf8") };
}

function mapSample(now = NOW) {
  return mapLesson({
    manuscript: parseManuscript(artifact(MANUSCRIPT), sourceById(MANUSCRIPT)),
    exercises: parseExercises(artifact(EXERCISES), sourceById(EXERCISES)),
    source: sourceById(MANUSCRIPT),
    exerciseSource: sourceById(EXERCISES),
    extraction: artifact(MANUSCRIPT),
    exerciseExtraction: artifact(EXERCISES),
    now
  });
}

const cleanup = [];
afterEach(async () => {
  document.body.innerHTML = "";
  while (cleanup.length) await cleanup.pop()();
});

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return { adapter, repositories: createCanonicalRepositories(adapter), executor };
}

async function importedStore() {
  const store = await freshStore();
  const mapped = mapSample();
  await applyImport(store.repositories, mapped, { now: NOW });
  return { ...store, mapped };
}

/* ------------------------------------------------------------ the plan */

describe("the diff decides before anything is written", () => {
  it("plans every row as a create on an empty store", async () => {
    const { repositories } = await freshStore();
    const plan = await planImport(repositories, mapSample());
    expect(plan.total).toBe(flattenRows(mapSample()).length);
    expect(plan.create).toHaveLength(plan.total);
    expect(plan.update).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.isNoop).toBe(false);
  });

  it("writes nothing while planning", async () => {
    const { repositories } = await freshStore();
    await planImport(repositories, mapSample());
    expect(await repositories.courses.count()).toBe(0);
    expect(await repositories.vocabulary.count()).toBe(0);
  });

  it("classifies an unchanged row, a refreshable one and a verified one", () => {
    const proposed = { uuid: "x", german: "neu", contentStatus: "imported" };
    expect(classifyRow(null, proposed).change).toBe(CHANGE.CREATE);
    expect(classifyRow({ uuid: "x", german: "neu", contentStatus: "imported" }, proposed).change)
      .toBe(CHANGE.UNCHANGED);
    expect(classifyRow({ uuid: "x", german: "alt", contentStatus: "imported" }, proposed).change)
      .toBe(CHANGE.UPDATE);

    const conflict = classifyRow({ uuid: "x", german: "alt", contentStatus: "verified" }, proposed);
    expect(conflict.change).toBe(CHANGE.CONFLICT);
    expect(conflict.before.german).toBe("alt");
    expect(conflict.after.german).toBe("neu");
  });

  it("ignores a changed timestamp, which is not a content change", () => {
    expect(classifyRow(
      { uuid: "x", german: "gleich", contentStatus: "imported", updatedAt: 1, revision: 9 },
      { uuid: "x", german: "gleich", contentStatus: "imported", updatedAt: 2, revision: 1 }
    ).change).toBe(CHANGE.UNCHANGED);
  });
});

/* --------------------------------------------------------------- import */

describe("importing the sample", () => {
  it("writes the whole lesson through the repository write APIs", async () => {
    const { repositories } = await importedStore();
    expect(await repositories.courses.count()).toBe(1);
    expect(await repositories.lessons.count()).toBe(1);
    expect(await repositories.vocabulary.count()).toBe(11);
    expect(await repositories.sentences.count()).toBe(10);
    expect(await repositories.listeningItems.count()).toBe(1);
    expect(await repositories.listeningSegments.count()).toBe(10);
    expect(await repositories.listeningSpeakers.count()).toBe(2);
    expect(await repositories.exercises.count()).toBe(14);
    expect(await repositories.lessonItems.count()).toBe(26);
  });

  it("creates no English row anywhere", async () => {
    const { repositories } = await importedStore();
    expect(await repositories.translations.count()).toBe(0);
    expect(await repositories.curriculumTexts.count({ language: "en" })).toBe(0);
    expect(await repositories.exerciseTexts.count({ language: "en" })).toBe(0);
  });

  it("keeps the printed page on every content row", async () => {
    const { repositories } = await importedStore();
    const entry = await repositories.vocabulary.findOne({ german: "erwachsen" });
    expect(entry.sourceReference).toContain("Seite 2");
    expect(entry.sourceReference).toContain("dw.com/nico/arabic");
    expect(entry.contentStatus).toBe("imported");
    expect(entry.verifiedAt).toBeNull();

    const lesson = await repositories.lessons.findOne({ slug: "familiengeschichten" });
    expect(lesson.sourceReference).toContain("Seite 1");
  });

  it("stores the Arabic gloss in logical order", async () => {
    const { repositories } = await importedStore();
    const entry = await repositories.vocabulary.findOne({ german: "erwachsen" });
    const meaning = await repositories.meanings.findOne({ vocabUuid: entry.uuid });
    expect(meaning.arabicText).toBe("بالغ؛ راشد");
  });

  it("is idempotent: a second import plans nothing and changes nothing", async () => {
    const { repositories, mapped } = await importedStore();
    const counts = async () => ({
      courses: await repositories.courses.count(),
      vocabulary: await repositories.vocabulary.count(),
      exercises: await repositories.exercises.count(),
      items: await repositories.lessonItems.count()
    });
    const before = await counts();

    const plan = await planImport(repositories, mapSample(NOW + 5_000_000));
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.isNoop).toBe(true);
    expect(plan.unchanged).toHaveLength(plan.total);

    await applyImport(repositories, mapSample(NOW + 5_000_000), { now: NOW + 5_000_000 });
    expect(await counts()).toEqual(before);
    expect(mapped.keys.courseUuid).toBe(mapSample(NOW + 5_000_000).keys.courseUuid);
  });

  it("refuses to overwrite content a human verified, and shows both texts", async () => {
    const { repositories, mapped } = await importedStore();
    const lesson = await repositories.lessons.findOne({ slug: "familiengeschichten" });
    // A reviewer signs off on the lesson row.
    await repositories.lessons.update(lesson.uuid, { contentStatus: "verified" }, { now: NOW });

    // The source is then reprinted with a different episode title.
    const changed = mapSample();
    changed.course.lessons[0].slug = "familiengeschichten-neu";

    const plan = await planImport(repositories, changed);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({ entity: "lessons", uuid: mapped.keys.lessonUuid });
    expect(plan.conflicts[0].before.slug).toBe("familiengeschichten");
    expect(plan.conflicts[0].after.slug).toBe("familiengeschichten-neu");
    expect(plan.conflicts[0].reason).toContain("reviewed");
  });

  it("refreshes an imported row when the source really changed", async () => {
    const { repositories } = await importedStore();
    const changed = mapSample();
    changed.course.lessons[0].slug = "familiengeschichten-korrigiert";

    const plan = await planImport(repositories, changed);
    expect(plan.update.map(entry => entry.entity)).toContain("lessons");
    expect(plan.conflicts).toEqual([]);
  });

  it("rolls an aggregate back whole when part of it fails", async () => {
    const { repositories } = await freshStore();
    const broken = mapSample();
    // A segment pointing at a listening item that will never exist. The speakers and
    // texts written before it must not survive either.
    broken.listening.segments[0].itemUuid = "does-not-exist";

    await expect(applyImport(repositories, broken, { now: NOW })).rejects.toThrow();
    expect(await repositories.listeningItems.count()).toBe(0);
    expect(await repositories.listeningSpeakers.count()).toBe(0);
    expect(await repositories.listeningSegments.count()).toBe(0);
    expect(await repositories.listeningTexts.count()).toBe(0);
  });

  it("refuses to import into a read-only store", async () => {
    const { adapter } = await freshStore();
    const readOnly = { ...createCanonicalRepositories(adapter), write: undefined };
    await expect(applyImport(readOnly, mapSample(), { now: NOW })).rejects.toThrow(/read-only/);
  });
});

/* --------------------------------------------------------------- verify */

describe("verification through the services", () => {
  it("reads the whole lesson back the way a screen would", async () => {
    const { repositories, mapped } = await importedStore();
    const report = await verifyImport(createServices(repositories), mapped, PROFILE);

    expect(report.course).toMatchObject({ slug: "nicos-weg-a2", cefrLevel: "A2" });
    expect(report.course.title.de).toBe("Nicos Weg");
    expect(report.course.title.en).toBeNull();
    expect(report.lesson).toMatchObject({ slug: "familiengeschichten", sections: 3, items: 26 });
    expect(report.listening).toMatchObject({
      segments: 10, speakers: 2, studyable: false, audioIssue: "no-audio", hasTranscript: true
    });
    expect(report.exercises).toMatchObject({ total: 14, gradeable: 11, ungradeable: 3 });
    expect(report.englishMissing).toBe(true);
    expect(report.progress).toMatchObject({ lessonsTotal: 1, resume: "first-available" });
  });

  it("grades only the exercises whose answer the source actually gives", async () => {
    const { repositories } = await importedStore();
    const services = createServices(repositories);
    const exercises = await services.exercises.all();

    // The booklet's three tasks carry no answer key, so they cannot be graded.
    const fromBooklet = exercises.filter(exercise => exercise.slug.startsWith("uebung-"));
    expect(fromBooklet).toHaveLength(3);
    expect(fromBooklet.every(exercise => exercise.gradeable === false)).toBe(true);

    // The derived recall exercises answer with the German headword, which can score.
    const derived = exercises.filter(exercise => exercise.slug.startsWith("recall-"));
    expect(derived).toHaveLength(11);
    expect(derived.every(exercise => exercise.gradeable === true)).toBe(true);
    expect(derived.every(exercise => exercise.answerLanguage === "de")).toBe(true);
  });

  it("never makes an Arabic prompt into a scoreable answer", async () => {
    const { repositories } = await importedStore();
    const services = createServices(repositories);
    const derived = (await services.exercises.all()).find(e => e.slug === "recall-erwachsen");
    expect(derived.prompt.ar).toBe("بالغ؛ راشد");
    expect(derived.expectedAnswers.every(answer => answer.language === "de")).toBe(true);
  });
});

/* ------------------------------------------------------- the real learner UI */

describe("the imported lesson in the real Learn routes", () => {
  async function controllerOverImportedStore() {
    const executor = createNodeSqliteExecutor(":memory:");
    cleanup.push(() => executor.close());
    const runtime = await bootstrapCanonicalRuntime({
      isNativePlatform: true,
      gates: { canonicalNativeStore: true },
      openExecutor: async () => ({ executor }),
      notificationAdapter: {
        async permission() { return "granted"; }, async requestPermission() { return "granted"; },
        async pending() { return []; }, async schedule() { return {}; }, async cancel() { return {}; }
      },
      now: () => NOW
    });
    await applyImport(runtime.source, mapSample(), { now: NOW });
    return createLearnController(runtime, { profileUuid: PROFILE, now: () => NOW });
  }

  async function show(controller, route) {
    await controller.load(route);
    document.body.innerHTML = `<div id="app">${controller.render(route)}</div>`;
    controller.hydrate(route);
    await Promise.resolve();
    return document.getElementById("app");
  }

  it("shows the course on the courses route", async () => {
    const controller = await controllerOverImportedStore();
    const app = await show(controller, "learn-courses");
    const outline = app.querySelector("df-course-outline");
    expect(outline.course.slug).toBe("nicos-weg-a2");
    expect(outline.course.cefrLevel).toBe("A2");
    expect(outline.progress.lessonsTotal).toBe(1);
  });

  it("opens the lesson and shows its three sections of real content", async () => {
    const controller = await controllerOverImportedStore();
    await show(controller, "learn-courses");
    await controller.handleEvent("lesson-select", {
      lessonUuid: mapSample().keys.lessonUuid
    });
    const app = await show(controller, "learn-courses");

    const view = app.querySelector("df-lesson-view");
    expect(view.lesson.slug).toBe("familiengeschichten");
    expect(view.lesson.sections.map(section => section.kind))
      .toEqual(["reading", "vocabulary", "practice"]);
    expect(view.lesson.title.ar).toBe("العائلة");
    // The source prints no English title, and the UI must show that, not hide it.
    expect(view.lesson.title.en).toBeNull();
    expect(view.lesson.coverage.missing).toContain("en");
  });

  it("shows the dialogue on the listening route, with no audio and no invented URL", async () => {
    const controller = await controllerOverImportedStore();
    const app = await show(controller, "learn-listening");
    const player = app.querySelector("df-listening-player");

    expect(player.activity.slug).toBe("familiengeschichten-dialog");
    expect(player.activity.segments).toHaveLength(10);
    expect(player.activity.segments[0].speaker.label).toBe("SELMA");
    expect(player.activity.transcript).toContain("Sprachkurs");
    expect(player.activity.studyable).toBe(false);
    expect(app.innerHTML).not.toContain("http");
  });

  it("shows the transcript turns on the sentences route", async () => {
    const controller = await controllerOverImportedStore();
    const app = await show(controller, "learn-sentences");
    const cards = [...app.querySelectorAll("df-sentence-card")];
    expect(cards).toHaveLength(10);
    expect(cards[0].sentence.german).toContain("Ich bin bei meinem Sprachkurs.");
    // No translation of the dialogue is printed, so both support languages are absent.
    expect(cards[0].sentence.translations.en).toBeNull();
  });

  it("grades a derived exercise through the routed UI and records a real mistake", async () => {
    const controller = await controllerOverImportedStore();
    await show(controller, "learn-exercises");

    const recall = (await controller.runtime.services.exercises.all())
      .find(exercise => exercise.slug === "recall-erwachsen");
    await controller.handleAction("learn-exercise", { uuid: recall.uuid });
    const app = await show(controller, "learn-exercises");
    // The Arabic gloss is the prompt on screen.
    expect(app.textContent).toContain("بالغ؛ راشد");

    document.getElementById("learn-answer").value = "erwachsen";
    await controller.handleAction("learn-submit-exercise", {});
    expect((await show(controller, "learn-exercises")).querySelector("[data-verdict]").dataset.verdict)
      .toBe("correct");

    document.getElementById("learn-answer").value = "erwachsn";
    await controller.handleAction("learn-submit-exercise", {});
    expect((await show(controller, "learn-exercises")).querySelector("[data-verdict]").dataset.verdict)
      .toBe("wrong");

    const events = await controller.runtime.source.errorEvents.find({ profileUuid: PROFILE });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ contentType: "exercise", scored: 1 });
  });

  it("presents a booklet task as ungradeable, because the source gives no answers", async () => {
    const controller = await controllerOverImportedStore();
    await show(controller, "learn-exercises");
    const uebung = (await controller.runtime.services.exercises.all())
      .find(exercise => exercise.slug.startsWith("uebung-2"));
    await controller.handleAction("learn-exercise", { uuid: uebung.uuid });
    const app = await show(controller, "learn-exercises");
    expect(app.querySelector("[data-ungradeable]")).not.toBeNull();
  });

  it("records progress against the imported lesson and moves the resume point", async () => {
    const controller = await controllerOverImportedStore();
    const lessonUuid = mapSample().keys.lessonUuid;
    await show(controller, "learn-courses");
    await controller.handleEvent("lesson-select", { lessonUuid });
    await show(controller, "learn-courses");
    await controller.handleAction("learn-complete-lesson", { lesson: lessonUuid });
    const app = await show(controller, "learn-courses");

    expect(await controller.runtime.source.lessonProgress.count({ profileUuid: PROFILE })).toBe(1);
    expect(await controller.runtime.source.sectionProgress.count({ profileUuid: PROFILE })).toBe(3);
    const progress = app.querySelector("df-course-outline").progress;
    expect(progress.lessonsCompleted).toBe(1);
    expect(progress.resume.reason).toBe("course-complete");
  });

  it("touches no SRS row through the whole tour", async () => {
    const controller = await controllerOverImportedStore();
    const lessonUuid = mapSample().keys.lessonUuid;
    for (const route of ["learn", "learn-courses", "learn-sentences", "learn-exercises",
      "learn-listening", "learn-errors"]) {
      await show(controller, route);
    }
    await controller.handleEvent("lesson-select", { lessonUuid });
    await show(controller, "learn-courses");
    await controller.handleAction("learn-complete-lesson", { lesson: lessonUuid });

    expect(await controller.runtime.source.cards.count()).toBe(0);
    expect(await controller.runtime.source.events.count()).toBe(0);
  });

  it("leaves a legacy card object byte-identical across an import", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    await importedStore();
    expect(JSON.stringify(card)).toBe(before);
  });
});
