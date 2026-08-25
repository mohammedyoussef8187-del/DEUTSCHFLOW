// @vitest-environment happy-dom
/*
 * The dataset that actually ships.
 *
 * `deutschflow-product.test.js` builds the authored curriculum from source and checks what
 * the authoring engine produces. This file checks the OTHER half — the file the browser
 * downloads, `data/canonical-content.json`, which also carries the lessons that came
 * through the intake and the retirements that hide the structure-only courses.
 *
 * A learner never runs the authoring engine. They fetch this file, so this is where the
 * promises about the finished product have to hold.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { buildCurriculum } from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";
import { publishedOnly } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import { readShippedContent } from "../support/learner-journey-harness.js";

let courses;
let lessons;

beforeAll(() => {
  const dataset = readShippedContent();
  /* The same gate the app applies before anything reaches a screen. */
  courses = buildCurriculum(publishedOnly(dataset.entities));
  lessons = courses.flatMap(course => course.units.flatMap(unit => unit.lessons));
});

describe("the shipped dataset is a course", () => {
  it("offers A1 before A2", () => {
    expect(courses.map(course => course.cefrLevel)).toEqual(["A1", "A2"]);
  });

  it("ships both levels with real length", () => {
    const [a1, a2] = courses;
    expect(a1.units.length).toBeGreaterThanOrEqual(8);
    expect(a2.units.length).toBeGreaterThanOrEqual(12);
    expect(lessons.length).toBeGreaterThanOrEqual(30);
  });

  it("ships no course that is only structure", () => {
    const slugs = courses.map(course => course.slug);
    expect(slugs).not.toContain("netzwerk-neu-a2");
    expect(slugs).not.toContain("nicos-weg-a2");
  });
});

describe("every shipped lesson is a lesson", () => {
  it("has content in it", () => {
    const empty = lessons
      .filter(lesson => !lesson.sections.some(section => section.items.length))
      .map(lesson => lesson.slug);
    expect(empty).toEqual([]);
  });

  it("opens by saying what it is for", () => {
    /*
     * Either on the lesson itself or in its intro section — the imported lessons carry it
     * one way and the authored ones the other, and a learner reads the same thing.
     */
    const silent = lessons.filter(lesson => {
      const onLesson = lesson.objective?.ar || lesson.objective?.de || lesson.objective?.en;
      const inIntro = lesson.sections.some(section => section.teaching?.objective);
      return !onLesson && !inIntro;
    }).map(lesson => lesson.slug);
    expect(silent).toEqual([]);
  });

  it("teaches in prose somewhere, not only through a list of items", () => {
    const untaught = lessons.filter(lesson =>
      !lesson.sections.some(section => Object.keys(section.teaching ?? {}).length)
    ).map(lesson => lesson.slug);
    expect(untaught).toEqual([]);
  });

  it("closes with something to carry away", () => {
    const unreviewed = lessons.filter(lesson =>
      !lesson.sections.some(section => section.teaching?.summary || section.teaching?.mistake)
    ).map(lesson => lesson.slug);
    expect(unreviewed).toEqual([]);
  });

  it("gives every lesson vocabulary and practice", () => {
    const thin = lessons.filter(lesson => {
      const kinds = new Set(lesson.sections.map(section => section.kind));
      return !kinds.has("vocabulary") || !kinds.has("practice");
    }).map(lesson => lesson.slug);
    expect(thin).toEqual([]);
  });
});

describe("the reading sections give the learner something to read", () => {
  /*
   * Two shapes are in the dataset and both are legitimate: an authored lesson writes a
   * passage as section text, while an imported one fills the section with sentence items.
   * What must never ship is the third shape — a heading with neither, which is what an
   * authored passage silently failing to be written looks like from the outside.
   */
  it("never ships a reading section that is only a heading", () => {
    const readings = lessons.flatMap(lesson =>
      lesson.sections.filter(section => section.kind === "reading")
        .map(section => ({
          lesson: lesson.slug,
          passage: section.teaching?.passage?.de ?? null,
          items: section.items.length
        })));
    expect(readings.length).toBeGreaterThan(0);

    const headingOnly = readings
      .filter(entry => !entry.passage && !entry.items)
      .map(entry => entry.lesson);
    expect(headingOnly).toEqual([]);
  });

  it("ships the German text of the passages that were authored as prose", () => {
    const authored = lessons.flatMap(lesson =>
      lesson.sections.filter(
        section => section.kind === "reading" && section.teaching?.passage
      ).map(section => ({ lesson: lesson.slug, passage: section.teaching.passage })));

    expect(authored.length).toBeGreaterThan(0);
    for (const entry of authored) {
      expect(entry.passage.de, entry.lesson).toBeTruthy();
      expect(entry.passage.de.length, entry.lesson).toBeGreaterThan(80);
    }
  });
});
