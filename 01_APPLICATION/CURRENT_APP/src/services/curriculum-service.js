/*
 * Curriculum service (Feature E).
 *
 * Assembles courses -> CEFR levels -> units -> lessons -> sections -> items, and reads
 * learner progress over that structure.
 *
 * The central rule: CONTENT STRUCTURE and LEARNER PROGRESS are separate dimensions and
 * are never merged. A lesson knows nothing about who completed it; progress rows carry a
 * profile and point at content by uuid. Nothing in this module reads or writes
 * review_cards, so finishing a lesson cannot move ease, intervals or SRS mastery — a
 * learner can complete a lesson and still owe reviews on its vocabulary, which is
 * correct: "I studied this" and "I remember this" are different claims.
 *
 * Lesson items reference content as (contentType, contentUuid), so listening and
 * pronunciation become new content types later without touching this assembly.
 */

import { ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, normalizeLanguage } from "../content/languages.js";

/** The CEFR ladder, in order. Used for progression, not for placement guessing. */
export const CEFR_LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const CONTENT_TYPES = Object.freeze({
  VOCABULARY: "vocabulary",
  GRAMMAR_TOPIC: "grammar_topic",
  GRAMMAR_RULE: "grammar_rule",
  SENTENCE: "sentence",
  EXERCISE: "exercise",
  // Reserved for Features G/H; no schema change is needed to start using them.
  LISTENING: "listening",
  PRONUNCIATION: "pronunciation"
});

export const SECTION_KINDS = Object.freeze({
  INTRO: "intro",
  VOCABULARY: "vocabulary",
  GRAMMAR: "grammar",
  READING: "reading",
  PRACTICE: "practice",
  REVIEW: "review"
});

export const PROGRESS_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed"
});

export const OWNER_TYPES = Object.freeze({
  COURSE: "course", UNIT: "unit", LESSON: "lesson", SECTION: "section"
});

export const TEXT_KINDS = Object.freeze({ TITLE: "title", DESCRIPTION: "description" });

const notDeleted = row => !row.deleted;
const byOrdering = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0);

function groupBy(rows, key) {
  const map = new Map();
  for (const row of (rows ?? []).filter(notDeleted)) {
    const list = map.get(row[key]);
    if (list) list.push(row);
    else map.set(row[key], [row]);
  }
  return map;
}

function indexTexts(texts) {
  const map = new Map();
  for (const row of (texts ?? []).filter(notDeleted)) {
    const key = `${row.ownerType}:${row.ownerUuid}:${row.kind}`;
    const langs = map.get(key) ?? {};
    langs[normalizeLanguage(row.language)] = row.text;
    map.set(key, langs);
  }
  return map;
}

function textFor(index, ownerType, ownerUuid, kind) {
  const found = index.get(`${ownerType}:${ownerUuid}:${kind}`) ?? {};
  // Absent languages are null, never missing keys, so "not translated" cannot be
  // mistaken for "not applicable".
  return { [GERMAN]: found[GERMAN] ?? null, [ENGLISH]: found[ENGLISH] ?? null, [ARABIC]: found[ARABIC] ?? null };
}

function coverageOf(values) {
  const missing = SUPPORT_LANGUAGES.filter(language => !values[language]);
  return {
    [ENGLISH]: Boolean(values[ENGLISH]),
    [ARABIC]: Boolean(values[ARABIC]),
    complete: missing.length === 0,
    missing
  };
}

/**
 * Assemble the full curriculum tree.
 *
 * @param {object} canonical curriculum tables
 * @returns {Array} courses in order, each with levels, units, lessons, sections, items
 */
export function buildCurriculum(canonical = {}) {
  const texts = indexTexts(canonical.curriculumTexts);
  const levelsByCourse = groupBy(canonical.courseLevels, "courseUuid");
  const unitsByCourse = groupBy(canonical.courseUnits, "courseUuid");
  const lessonsByUnit = groupBy(canonical.lessons, "unitUuid");
  const sectionsByLesson = groupBy(canonical.lessonSections, "lessonUuid");
  const itemsBySection = groupBy(canonical.lessonItems, "sectionUuid");
  const prereqsByLesson = groupBy(canonical.lessonPrerequisites, "lessonUuid");

  return (canonical.courses ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(course => {
      const courseTitle = textFor(texts, OWNER_TYPES.COURSE, course.uuid, TEXT_KINDS.TITLE);

      const units = (unitsByCourse.get(course.uuid) ?? []).sort(byOrdering).map(unit => {
        const unitTitle = textFor(texts, OWNER_TYPES.UNIT, unit.uuid, TEXT_KINDS.TITLE);

        const lessons = (lessonsByUnit.get(unit.uuid) ?? []).sort(byOrdering).map(lesson => {
          const lessonTitle = textFor(texts, OWNER_TYPES.LESSON, lesson.uuid, TEXT_KINDS.TITLE);

          const sections = (sectionsByLesson.get(lesson.uuid) ?? []).sort(byOrdering).map(section => ({
            uuid: section.uuid,
            slug: section.slug,
            kind: section.sectionKind,
            ordering: section.ordering ?? 0,
            title: textFor(texts, OWNER_TYPES.SECTION, section.uuid, TEXT_KINDS.TITLE),
            items: (itemsBySection.get(section.uuid) ?? []).sort(byOrdering).map(item => ({
              uuid: item.uuid,
              contentType: item.contentType,
              contentUuid: item.contentUuid,
              ordering: item.ordering ?? 0,
              required: item.required !== 0
            }))
          }));

          return {
            uuid: lesson.uuid,
            slug: lesson.slug,
            cefrLevel: lesson.cefrLevel || null,
            ordering: lesson.ordering ?? 0,
            unitUuid: unit.uuid,
            courseUuid: course.uuid,
            title: lessonTitle,
            contentStatus: lesson.contentStatus ?? null,
            sections,
            prerequisites: (prereqsByLesson.get(lesson.uuid) ?? []).map(p => p.requiresLessonUuid),
            coverage: coverageOf(lessonTitle)
          };
        });

        return {
          uuid: unit.uuid,
          slug: unit.slug,
          ordering: unit.ordering ?? 0,
          courseLevelUuid: unit.courseLevelUuid ?? null,
          title: unitTitle,
          lessons,
          coverage: coverageOf(unitTitle)
        };
      });

      return {
        uuid: course.uuid,
        slug: course.slug,
        cefrLevel: course.cefrLevel || null,
        ordering: course.ordering ?? 0,
        title: courseTitle,
        // Book/source metadata, e.g. Netzwerk A1 as a course source.
        source: {
          title: course.sourceTitle ?? null,
          publisher: course.sourcePublisher ?? null,
          edition: course.sourceEdition ?? null,
          isbn: course.sourceIsbn ?? null,
          reference: course.sourceReference ?? null,
          type: course.sourceType ?? null
        },
        provenance: {
          status: course.contentStatus ?? null,
          version: course.contentVersion ?? null,
          verifiedAt: course.verifiedAt ?? null
        },
        levels: (levelsByCourse.get(course.uuid) ?? []).sort(byOrdering).map(level => ({
          uuid: level.uuid,
          cefrLevel: level.cefrLevel,
          ordering: level.ordering ?? 0
        })),
        units,
        coverage: coverageOf(courseTitle)
      };
    });
}

/** Every lesson in a course, flattened in teaching order. */
export function lessonsInOrder(course) {
  return (course?.units ?? []).flatMap(unit => unit.lessons);
}

/* ------------------------------------------------------------------ progress */

function statusIndex(rows, key, profileUuid) {
  const map = new Map();
  for (const row of (rows ?? []).filter(notDeleted)) {
    if (row.profileUuid !== profileUuid) continue;
    map.set(row[key], row);
  }
  return map;
}

/**
 * Whether a lesson's prerequisites are satisfied.
 * A lesson with no prerequisites is always unlocked; a missing prerequisite lesson
 * blocks rather than silently unlocking, so a broken reference fails safe.
 */
export function isLessonUnlocked(lesson, completedLessonUuids) {
  const done = completedLessonUuids instanceof Set ? completedLessonUuids : new Set(completedLessonUuids ?? []);
  return (lesson?.prerequisites ?? []).every(required => done.has(required));
}

/**
 * Course progress derived from lesson/section progress rows.
 * Deliberately derived rather than stored as a percentage, so it cannot drift out of
 * step with the lesson rows it summarizes.
 */
export function courseProgressFor(course, progress = {}, profileUuid) {
  const lessonStatus = statusIndex(progress.lessonProgress, "lessonUuid", profileUuid);
  const sectionStatus = statusIndex(progress.sectionProgress, "sectionUuid", profileUuid);
  const lessons = lessonsInOrder(course);

  const completedLessons = lessons.filter(
    lesson => lessonStatus.get(lesson.uuid)?.status === PROGRESS_STATUS.COMPLETED
  );
  const completedUuids = new Set(completedLessons.map(lesson => lesson.uuid));

  const lessonViews = lessons.map(lesson => {
    const sections = lesson.sections.map(section => ({
      uuid: section.uuid,
      kind: section.kind,
      status: sectionStatus.get(section.uuid)?.status ?? PROGRESS_STATUS.NOT_STARTED
    }));
    return {
      uuid: lesson.uuid,
      slug: lesson.slug,
      cefrLevel: lesson.cefrLevel,
      status: lessonStatus.get(lesson.uuid)?.status ?? PROGRESS_STATUS.NOT_STARTED,
      unlocked: isLessonUnlocked(lesson, completedUuids),
      sections,
      sectionsCompleted: sections.filter(s => s.status === PROGRESS_STATUS.COMPLETED).length,
      sectionsTotal: sections.length
    };
  });

  const stored = (progress.courseProgress ?? [])
    .filter(notDeleted)
    .find(row => row.profileUuid === profileUuid && row.courseUuid === course?.uuid) ?? null;

  return {
    courseUuid: course?.uuid ?? null,
    status: stored?.status ?? PROGRESS_STATUS.NOT_STARTED,
    lessonsTotal: lessons.length,
    lessonsCompleted: completedLessons.length,
    percent: lessons.length ? Math.round((completedLessons.length / lessons.length) * 100) : 0,
    lessons: lessonViews,
    // Where to pick up: the stored resume point when it is still valid, otherwise the
    // first unlocked lesson that is not finished.
    resume: resumePoint(course, lessonViews, stored)
  };
}

function resumePoint(course, lessonViews, stored) {
  const byUuid = new Map(lessonViews.map(lesson => [lesson.uuid, lesson]));
  const storedLesson = stored?.lastLessonUuid ? byUuid.get(stored.lastLessonUuid) : null;

  if (storedLesson && storedLesson.status !== PROGRESS_STATUS.COMPLETED && storedLesson.unlocked) {
    const section = stored.lastSectionUuid &&
      storedLesson.sections.some(s => s.uuid === stored.lastSectionUuid)
      ? stored.lastSectionUuid
      : storedLesson.sections.find(s => s.status !== PROGRESS_STATUS.COMPLETED)?.uuid ?? null;
    return { lessonUuid: storedLesson.uuid, sectionUuid: section, reason: "stored" };
  }

  const next = lessonViews.find(
    lesson => lesson.unlocked && lesson.status !== PROGRESS_STATUS.COMPLETED
  );
  if (!next) return { lessonUuid: null, sectionUuid: null, reason: "course-complete" };

  return {
    lessonUuid: next.uuid,
    sectionUuid: next.sections.find(s => s.status !== PROGRESS_STATUS.COMPLETED)?.uuid ?? null,
    reason: storedLesson ? "stored-point-stale" : "first-available"
  };
}

/** CEFR progress across every course, derived from lessons plus any stored rows. */
export function cefrProgressFor(courses, progress = {}, profileUuid) {
  const lessonStatus = statusIndex(progress.lessonProgress, "lessonUuid", profileUuid);
  const stored = statusIndex(progress.cefrProgress, "cefrLevel", profileUuid);

  return CEFR_LEVELS.map(level => {
    const lessons = courses.flatMap(course =>
      lessonsInOrder(course).filter(lesson => (lesson.cefrLevel || course.cefrLevel) === level)
    );
    const completed = lessons.filter(
      lesson => lessonStatus.get(lesson.uuid)?.status === PROGRESS_STATUS.COMPLETED
    ).length;
    return {
      cefrLevel: level,
      lessonsTotal: lessons.length,
      lessonsCompleted: completed,
      percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
      status: stored.get(level)?.status ?? (
        lessons.length && completed === lessons.length ? PROGRESS_STATUS.COMPLETED
          : completed ? PROGRESS_STATUS.IN_PROGRESS
          : PROGRESS_STATUS.NOT_STARTED
      )
    };
  });
}

/** Repository-backed service. Read-only; never touches SRS. */
export function createCurriculumService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function loadContent() {
    const [courses, courseLevels, courseUnits, lessons, lessonSections, lessonItems,
           lessonPrerequisites, curriculumTexts] = await Promise.all([
      repositories.courses.all(), repositories.courseLevels.all(),
      repositories.courseUnits.all(), repositories.lessons.all(),
      repositories.lessonSections.all(), repositories.lessonItems.all(),
      repositories.lessonPrerequisites.all(), repositories.curriculumTexts.all()
    ]);
    return { courses, courseLevels, courseUnits, lessons, lessonSections, lessonItems,
             lessonPrerequisites, curriculumTexts };
  }

  async function loadProgress() {
    const [courseProgress, lessonProgress, sectionProgress, cefrProgress] = await Promise.all([
      repositories.courseProgress.all(), repositories.lessonProgress.all(),
      repositories.sectionProgress.all(), repositories.cefrProgress.all()
    ]);
    return { courseProgress, lessonProgress, sectionProgress, cefrProgress };
  }

  return Object.freeze({
    async courses() {
      return buildCurriculum(await loadContent());
    },

    async courseBySlug(slug) {
      return (await this.courses()).find(course => course.slug === slug) ?? null;
    },

    async lesson(lessonUuid) {
      return (await this.courses())
        .flatMap(lessonsInOrder)
        .find(lesson => lesson.uuid === lessonUuid) ?? null;
    },

    async progressForCourse(courseSlug, profileUuid) {
      const course = await this.courseBySlug(courseSlug);
      if (!course) return null;
      return courseProgressFor(course, await loadProgress(), profileUuid);
    },

    async cefrProgress(profileUuid) {
      return cefrProgressFor(await this.courses(), await loadProgress(), profileUuid);
    },

    /** Where the learner should continue, across all courses. */
    async resume(profileUuid) {
      const courses = await this.courses();
      const progress = await loadProgress();
      for (const course of courses) {
        const summary = courseProgressFor(course, progress, profileUuid);
        if (summary.resume.lessonUuid) {
          return { courseUuid: course.uuid, courseSlug: course.slug, ...summary.resume };
        }
      }
      return { courseUuid: null, courseSlug: null, lessonUuid: null, sectionUuid: null, reason: "nothing-available" };
    }
  });
}
