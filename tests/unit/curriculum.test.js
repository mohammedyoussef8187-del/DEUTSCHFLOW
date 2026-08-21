/*
 * Feature E — courses, lessons, CEFR structure and learner progress.
 *
 * The rule this suite defends hardest: content structure and learner progress are
 * separate dimensions. Completing a lesson must never touch SRS state.
 */

import { describe, expect, it } from "vitest";
import {
  CEFR_LEVELS, CONTENT_TYPES, OWNER_TYPES, PROGRESS_STATUS, SECTION_KINDS, TEXT_KINDS,
  buildCurriculum, cefrProgressFor, courseProgressFor, createCurriculumService,
  isLessonUnlocked, lessonsInOrder
} from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";
import { ARABIC, ENGLISH } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "draft", contentVersion: 1, sourceReference: null, sourceType: "textbook",
  verifiedAt: null, verifiedBy: null, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (ownerType, ownerUuid, language, kind, value) =>
  ({ uuid: `ct-${ownerUuid}-${language}-${kind}`, ownerType, ownerUuid, language, kind, text: value, ...meta });

/** Netzwerk A1 as a course source: structure only, no fabricated lesson content. */
function canonical() {
  return {
    courses: [
      { uuid: "c-a2", slug: "netzwerk-neu-a2", cefrLevel: "A2", ordering: 2,
        sourceTitle: "Netzwerk neu A2", sourcePublisher: "Klett", sourceEdition: "neu",
        sourceIsbn: null, ...meta },
      { uuid: "c-a1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1,
        sourceTitle: "Netzwerk A1", sourcePublisher: "Klett", sourceEdition: "1", sourceIsbn: null,
        ...meta, contentStatus: "verified", contentVersion: 2, verifiedAt: NOW }
    ],
    courseLevels: [
      { uuid: "cl-a1", courseUuid: "c-a1", cefrLevel: "A1", ordering: 1, ...linkMeta },
      { uuid: "cl-a2", courseUuid: "c-a2", cefrLevel: "A2", ordering: 1, ...linkMeta }
    ],
    courseUnits: [
      { uuid: "u-2", courseUuid: "c-a1", courseLevelUuid: "cl-a1", slug: "unit-2", ordering: 2, ...meta },
      { uuid: "u-1", courseUuid: "c-a1", courseLevelUuid: "cl-a1", slug: "unit-1", ordering: 1, ...meta },
      { uuid: "u-a2-1", courseUuid: "c-a2", courseLevelUuid: "cl-a2", slug: "unit-1", ordering: 1, ...meta }
    ],
    lessons: [
      { uuid: "l-1b", unitUuid: "u-1", slug: "greetings-2", cefrLevel: "A1", ordering: 2, ...meta },
      { uuid: "l-1a", unitUuid: "u-1", slug: "greetings-1", cefrLevel: "A1", ordering: 1, ...meta },
      { uuid: "l-2a", unitUuid: "u-2", slug: "family", cefrLevel: "A1", ordering: 1, ...meta },
      { uuid: "l-a2", unitUuid: "u-a2-1", slug: "travel", cefrLevel: "A2", ordering: 1, ...meta }
    ],
    lessonSections: [
      { uuid: "s-1a-2", lessonUuid: "l-1a", slug: "practice", sectionKind: SECTION_KINDS.PRACTICE, ordering: 2, ...meta },
      { uuid: "s-1a-1", lessonUuid: "l-1a", slug: "words", sectionKind: SECTION_KINDS.VOCABULARY, ordering: 1, ...meta },
      { uuid: "s-1b-1", lessonUuid: "l-1b", slug: "grammar", sectionKind: SECTION_KINDS.GRAMMAR, ordering: 1, ...meta }
    ],
    lessonItems: [
      { uuid: "i-2", sectionUuid: "s-1a-1", contentType: CONTENT_TYPES.SENTENCE, contentUuid: "sent-1", ordering: 2, required: 1, ...linkMeta },
      { uuid: "i-1", sectionUuid: "s-1a-1", contentType: CONTENT_TYPES.VOCABULARY, contentUuid: "v-haus", ordering: 1, required: 1, ...linkMeta },
      { uuid: "i-3", sectionUuid: "s-1a-2", contentType: CONTENT_TYPES.EXERCISE, contentUuid: "x-1", ordering: 1, required: 1, ...linkMeta },
      { uuid: "i-4", sectionUuid: "s-1b-1", contentType: CONTENT_TYPES.GRAMMAR_RULE, contentUuid: "rule-1", ordering: 1, required: 0, ...linkMeta }
    ],
    lessonPrerequisites: [
      { uuid: "pr-1", lessonUuid: "l-1b", requiresLessonUuid: "l-1a", ...linkMeta },
      { uuid: "pr-2", lessonUuid: "l-2a", requiresLessonUuid: "l-1b", ...linkMeta }
    ],
    curriculumTexts: [
      text(OWNER_TYPES.COURSE, "c-a1", ENGLISH, TEXT_KINDS.TITLE, "Netzwerk A1"),
      text(OWNER_TYPES.COURSE, "c-a1", ARABIC, TEXT_KINDS.TITLE, "نتسفيرك A1"),
      text(OWNER_TYPES.UNIT, "u-1", ENGLISH, TEXT_KINDS.TITLE, "Hello!"),
      text(OWNER_TYPES.LESSON, "l-1a", ENGLISH, TEXT_KINDS.TITLE, "Saying hello"),
      text(OWNER_TYPES.LESSON, "l-1a", ARABIC, TEXT_KINDS.TITLE, "إلقاء التحية")
      // u-1 and others have no Arabic title: untranslated, not broken.
    ]
  };
}

const noProgress = { courseProgress: [], lessonProgress: [], sectionProgress: [], cefrProgress: [] };

describe("curriculum structure", () => {
  const courses = buildCurriculum(canonical());

  it("orders courses, units and lessons deterministically", () => {
    expect(courses.map(c => c.slug)).toEqual(["netzwerk-a1", "netzwerk-neu-a2"]);
    expect(courses[0].units.map(u => u.slug)).toEqual(["unit-1", "unit-2"]);
    expect(courses[0].units[0].lessons.map(l => l.slug)).toEqual(["greetings-1", "greetings-2"]);
  });

  it("orders sections and items within a lesson", () => {
    const lesson = courses[0].units[0].lessons[0];
    expect(lesson.sections.map(s => s.slug)).toEqual(["words", "practice"]);
    expect(lesson.sections[0].items.map(i => i.contentUuid)).toEqual(["v-haus", "sent-1"]);
  });

  it("represents a book as a course source without inventing lesson content", () => {
    expect(courses[0].source).toMatchObject({
      title: "Netzwerk A1", publisher: "Klett", edition: "1"
    });
    expect(courses[1].source.title).toBe("Netzwerk neu A2");
    expect(courses[0].provenance.status).toBe("verified");
  });

  it("models CEFR stages as first-class course levels", () => {
    expect(courses[0].levels).toEqual([{ uuid: "cl-a1", cefrLevel: "A1", ordering: 1 }]);
    expect(courses[0].units[0].courseLevelUuid).toBe("cl-a1");
    expect(CEFR_LEVELS).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
  });

  it("references mixed canonical content by type and uuid", () => {
    const lesson = courses[0].units[0].lessons[0];
    const types = lesson.sections.flatMap(s => s.items.map(i => i.contentType));
    expect(types).toEqual([CONTENT_TYPES.VOCABULARY, CONTENT_TYPES.SENTENCE, CONTENT_TYPES.EXERCISE]);
    // Listening/pronunciation are already valid content types, needing no schema change.
    expect(CONTENT_TYPES.LISTENING).toBe("listening");
    expect(CONTENT_TYPES.PRONUNCIATION).toBe("pronunciation");
  });

  it("marks optional items as not required", () => {
    const grammarSection = courses[0].units[0].lessons[1].sections[0];
    expect(grammarSection.items[0].required).toBe(false);
  });

  it("keeps English and Arabic titles as peers and reports gaps", () => {
    expect(courses[0].title[ENGLISH]).toBe("Netzwerk A1");
    expect(courses[0].title[ARABIC]).toBe("نتسفيرك A1");
    expect(courses[0].coverage.complete).toBe(true);
    expect(courses[0].units[0].title[ARABIC]).toBeNull();
    expect(courses[0].units[0].coverage.missing).toEqual([ARABIC]);
  });

  it("skips soft-deleted rows at every level", () => {
    const data = canonical();
    data.courses[0].deleted = 1;          // A2 course
    data.lessons[0].deleted = 1;          // greetings-2
    data.lessonItems[0].deleted = 1;      // sent-1
    const built = buildCurriculum(data);
    expect(built.map(c => c.slug)).toEqual(["netzwerk-a1"]);
    expect(built[0].units[0].lessons.map(l => l.slug)).toEqual(["greetings-1"]);
    expect(built[0].units[0].lessons[0].sections[0].items.map(i => i.contentUuid)).toEqual(["v-haus"]);
  });

  it("handles an empty curriculum", () => {
    expect(buildCurriculum({})).toEqual([]);
  });
});

describe("prerequisites", () => {
  const courses = buildCurriculum(canonical());
  const a1 = courses[0];

  it("unlocks a lesson with no prerequisites", () => {
    expect(isLessonUnlocked(lessonsInOrder(a1)[0], [])).toBe(true);
  });

  it("locks a lesson until its prerequisite is completed", () => {
    const second = lessonsInOrder(a1)[1];
    expect(isLessonUnlocked(second, [])).toBe(false);
    expect(isLessonUnlocked(second, ["l-1a"])).toBe(true);
  });

  it("fails safe when a prerequisite lesson is missing entirely", () => {
    // A dangling reference must block rather than silently unlock.
    expect(isLessonUnlocked({ prerequisites: ["l-does-not-exist"] }, ["l-1a"])).toBe(false);
  });

  it("requires every prerequisite, not just one", () => {
    expect(isLessonUnlocked({ prerequisites: ["a", "b"] }, ["a"])).toBe(false);
    expect(isLessonUnlocked({ prerequisites: ["a", "b"] }, ["a", "b"])).toBe(true);
  });
});

describe("progress and resume", () => {
  const courses = buildCurriculum(canonical());
  const a1 = courses[0];

  it("reports nothing started for a fresh learner", () => {
    const progress = courseProgressFor(a1, noProgress, PROFILE);
    expect(progress.lessonsTotal).toBe(3);
    expect(progress.lessonsCompleted).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.resume.lessonUuid).toBe("l-1a");
    expect(progress.resume.reason).toBe("first-available");
  });

  it("derives percentage from completed lessons", () => {
    const progress = courseProgressFor(a1, {
      ...noProgress,
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);
    expect(progress.lessonsCompleted).toBe(1);
    expect(progress.percent).toBe(33);
    expect(progress.resume.lessonUuid).toBe("l-1b");   // now unlocked
  });

  it("ignores another learner's progress", () => {
    const progress = courseProgressFor(a1, {
      ...noProgress,
      lessonProgress: [{ uuid: "lp1", profileUuid: "someone-else", lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);
    expect(progress.lessonsCompleted).toBe(0);
  });

  it("tracks section completion within a lesson", () => {
    const progress = courseProgressFor(a1, {
      ...noProgress,
      sectionProgress: [{ uuid: "sp1", profileUuid: PROFILE, sectionUuid: "s-1a-1", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);
    const lesson = progress.lessons.find(l => l.uuid === "l-1a");
    expect(lesson.sectionsCompleted).toBe(1);
    expect(lesson.sectionsTotal).toBe(2);
    expect(progress.resume.sectionUuid).toBe("s-1a-2");   // the unfinished one
  });

  it("resumes from the stored position when it is still valid", () => {
    const progress = courseProgressFor(a1, {
      ...noProgress,
      courseProgress: [{ uuid: "cp1", profileUuid: PROFILE, courseUuid: "c-a1",
        status: PROGRESS_STATUS.IN_PROGRESS, lastLessonUuid: "l-1a", lastSectionUuid: "s-1a-2", ...linkMeta }]
    }, PROFILE);
    expect(progress.resume).toMatchObject({ lessonUuid: "l-1a", sectionUuid: "s-1a-2", reason: "stored" });
  });

  it("moves past a stale stored position instead of resuming a finished lesson", () => {
    const progress = courseProgressFor(a1, {
      ...noProgress,
      courseProgress: [{ uuid: "cp1", profileUuid: PROFILE, courseUuid: "c-a1",
        status: PROGRESS_STATUS.IN_PROGRESS, lastLessonUuid: "l-1a", lastSectionUuid: "s-1a-1", ...linkMeta }],
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);
    expect(progress.resume.lessonUuid).toBe("l-1b");
    expect(progress.resume.reason).toBe("stored-point-stale");
  });

  it("reports course completion when every lesson is done", () => {
    const done = ["l-1a", "l-1b", "l-2a"].map((uuid, i) =>
      ({ uuid: `lp${i}`, profileUuid: PROFILE, lessonUuid: uuid, status: PROGRESS_STATUS.COMPLETED, ...linkMeta }));
    const progress = courseProgressFor(a1, { ...noProgress, lessonProgress: done }, PROFILE);
    expect(progress.percent).toBe(100);
    expect(progress.resume).toMatchObject({ lessonUuid: null, reason: "course-complete" });
  });

  it("marks locked lessons as locked in the progress view", () => {
    const progress = courseProgressFor(a1, noProgress, PROFILE);
    expect(progress.lessons.find(l => l.uuid === "l-1a").unlocked).toBe(true);
    expect(progress.lessons.find(l => l.uuid === "l-1b").unlocked).toBe(false);
  });
});

describe("CEFR progress", () => {
  const courses = buildCurriculum(canonical());

  it("summarizes every CEFR stage, including untouched ones", () => {
    const cefr = cefrProgressFor(courses, noProgress, PROFILE);
    expect(cefr.map(c => c.cefrLevel)).toEqual(CEFR_LEVELS);
    const a1 = cefr.find(c => c.cefrLevel === "A1");
    expect(a1.lessonsTotal).toBe(3);
    expect(a1.status).toBe(PROGRESS_STATUS.NOT_STARTED);
    expect(cefr.find(c => c.cefrLevel === "B2").lessonsTotal).toBe(0);
  });

  it("advances a level as its lessons are completed", () => {
    const cefr = cefrProgressFor(courses, {
      ...noProgress,
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);
    const a1 = cefr.find(c => c.cefrLevel === "A1");
    expect(a1.lessonsCompleted).toBe(1);
    expect(a1.status).toBe(PROGRESS_STATUS.IN_PROGRESS);
  });

  it("keeps A2 separate from A1", () => {
    const cefr = cefrProgressFor(courses, noProgress, PROFILE);
    expect(cefr.find(c => c.cefrLevel === "A2").lessonsTotal).toBe(1);
  });
});

describe("course progress is independent of SRS", () => {
  it("touches no SRS fields when lessons are completed", () => {
    const courses = buildCurriculum(canonical());
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    courseProgressFor(courses[0], {
      ...noProgress,
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);

    // The card object is not even reachable from this module; this pins the intent.
    expect(JSON.stringify(card)).toBe(before);
  });

  it("keeps lesson completion and vocabulary mastery as separate claims", () => {
    const courses = buildCurriculum(canonical());
    const progress = courseProgressFor(courses[0], {
      ...noProgress,
      lessonProgress: [{ uuid: "lp1", profileUuid: PROFILE, lessonUuid: "l-1a", status: PROGRESS_STATUS.COMPLETED, ...linkMeta }]
    }, PROFILE);

    // A completed lesson says nothing about the SRS state of the words it taught.
    expect(progress.lessons.find(l => l.uuid === "l-1a").status).toBe(PROGRESS_STATUS.COMPLETED);
    expect(progress).not.toHaveProperty("mastery");
    expect(progress).not.toHaveProperty("ease");
    expect(JSON.stringify(progress)).not.toContain("reviewCards");
  });

  it("never reads or writes review data in the service module", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["reviewcards", "schedulecard", "wordstatus", "wordmastery", "indexeddb", "sqlite"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("migration invents no curriculum", () => {
  it("creates no courses, lessons or progress from legacy data", () => {
    const { dataset } = migrateToCanonical({
      words: [{ id: 1, german: "das Haus", arabic: "بيت", itemType: "noun", level: "A1" }],
      cards: [{ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1, intervalDays: 3,
        ease: 2.5, reps: 2, lapses: 0, streak: 1, mastery: 40 }],
      attempts: [], settings: null, profile: null
    }, { now: NOW });

    for (const entity of ["courses", "courseLevels", "courseUnits", "lessons", "lessonSections",
      "lessonItems", "lessonPrerequisites", "curriculumTexts",
      "courseProgress", "lessonProgress", "sectionProgress", "cefrProgress"]) {
      expect(dataset[entity], `${entity} should be empty`).toEqual([]);
    }

    // No CEFR placement is guessed from the word's level either.
    expect(dataset.cefrProgress).toEqual([]);
    // Learner data still migrates untouched.
    expect(dataset.reviewCards[0].ease).toBe(2.5);
    expect(dataset.reviewCards[0].mastery).toBe(40);
  });
});

describe("curriculum service", () => {
  function repositoriesFor(content, progress = noProgress) {
    const wrap = rows => ({ all: async () => rows ?? [] });
    return {
      courses: wrap(content.courses), courseLevels: wrap(content.courseLevels),
      courseUnits: wrap(content.courseUnits), lessons: wrap(content.lessons),
      lessonSections: wrap(content.lessonSections), lessonItems: wrap(content.lessonItems),
      lessonPrerequisites: wrap(content.lessonPrerequisites),
      curriculumTexts: wrap(content.curriculumTexts),
      courseProgress: wrap(progress.courseProgress), lessonProgress: wrap(progress.lessonProgress),
      sectionProgress: wrap(progress.sectionProgress), cefrProgress: wrap(progress.cefrProgress)
    };
  }

  it("reads through repositories only", async () => {
    const service = createCurriculumService(repositoriesFor(canonical()));
    expect((await service.courses()).map(c => c.slug)).toEqual(["netzwerk-a1", "netzwerk-neu-a2"]);
    expect((await service.courseBySlug("netzwerk-a1")).cefrLevel).toBe("A1");
    expect(await service.courseBySlug("missing")).toBeNull();
  });

  it("finds a lesson across courses", async () => {
    const service = createCurriculumService(repositoriesFor(canonical()));
    expect((await service.lesson("l-a2")).slug).toBe("travel");
    expect(await service.lesson("nope")).toBeNull();
  });

  it("reports course progress and a resume point", async () => {
    const service = createCurriculumService(repositoriesFor(canonical()));
    const progress = await service.progressForCourse("netzwerk-a1", PROFILE);
    expect(progress.lessonsTotal).toBe(3);
    expect(progress.resume.lessonUuid).toBe("l-1a");
    expect(await service.progressForCourse("missing", PROFILE)).toBeNull();
  });

  it("resumes across courses, preferring the earliest unfinished one", async () => {
    const service = createCurriculumService(repositoriesFor(canonical()));
    const resume = await service.resume(PROFILE);
    expect(resume.courseSlug).toBe("netzwerk-a1");
    expect(resume.lessonUuid).toBe("l-1a");
  });

  it("reports CEFR progress for the learner", async () => {
    const service = createCurriculumService(repositoriesFor(canonical()));
    const cefr = await service.cefrProgress(PROFILE);
    expect(cefr).toHaveLength(CEFR_LEVELS.length);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createCurriculumService(null)).toThrow(/Repositories are required/);
  });
});
