#!/usr/bin/env node
/*
 * Write DeutschFlow's own curriculum into the canonical store.
 *
 * Authored lessons go through exactly the path imported ones do — plan, one transaction,
 * verify, idempotent second run — so nothing about how content reaches a learner depends
 * on who wrote it.
 *
 *   node tools/curriculum/run-curriculum.mjs [--apply] [--db <file>]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { applyImport, planImport, verifyImport } from "../intake/import.js";
import { buildLevel } from "./build-lesson.js";
import { A1 } from "./a1.js";
import { A2_EXTRA } from "./a2.js";

export const LEVELS = Object.freeze([A1, A2_EXTRA]);

/**
 * Courses that are structure or source shape rather than a learning path.
 *
 * A learner should meet DeutschFlow A1 and DeutschFlow A2, not the repositories the
 * material came from. These rows stay in the store — the Netzwerk chapter titles and the
 * Nicos import are a real record of what was registered — but they are held out of the
 * published view so nobody opens a course of twelve empty chapters.
 */
export const RETIRED_COURSE_SLUGS = Object.freeze(["netzwerk-neu-a2", "nicos-weg-a2"]);

/**
 * Write one level.
 *
 * The listening activities are written one at a time because a batch carries a single
 * listening aggregate; everything else goes in one plan.
 */
export async function runLevel(repositories, level, options = {}) {
  const now = options.now ?? Date.now();

  /* A level that names an existing course joins it instead of creating a second one. */
  let attach = null;
  if (level.attachToCourseSlug) {
    const course = await repositories.courses.findOne({ slug: level.attachToCourseSlug });
    if (!course) {
      return { applied: false, reason: `no course ${level.attachToCourseSlug}`, plan: null,
        written: null, verification: null };
    }
    const [courseLevel] = await repositories.courseLevels.find({ courseUuid: course.uuid });
    attach = { courseUuid: course.uuid, courseLevelUuid: courseLevel?.uuid ?? null,
      slug: course.slug };
  }

  const { mapped, listenings } = buildLevel(level, { now, attach });

  const plan = await planImport(repositories, mapped);
  if (plan.conflicts.length) {
    return { applied: false, reason: "conflicts", plan, written: null, verification: null };
  }
  if (!options.apply) {
    return { applied: false, reason: "preview-only", plan, written: null, verification: null };
  }

  return repositories.lifecycle.transaction(async () => {
    const written = plan.isNoop ? null : await applyImport(repositories, mapped, { now, plan });

    for (const entry of listenings) {
      const batch = {
        course: { course: null, levels: [], units: [], lessons: [], sections: [], items: [],
          prerequisites: [], texts: [] },
        vocabulary: [], sentences: [], grammar: [], exercises: [],
        listening: entry.listening, audioAssets: [], keys: {}
      };
      const activityPlan = await planImport(repositories, batch);
      if (activityPlan.conflicts.length) {
        throw new Error(`listening conflict in ${entry.lessonUuid}`);
      }
      if (!activityPlan.isNoop) await applyImport(repositories, batch, { now, plan: activityPlan });
    }

    const services = createServices(repositories);
    const verification = await verifyImport(services, mapped, options.profileUuid ?? "local",
      { repositories });
    if (!verification.ok) {
      throw new Error(`curriculum could not be verified: ${JSON.stringify({
        course: verification.course, lessons: verification.lessons,
        missing: verification.missingLessons, links: verification.links.missing.length
      })}`);
    }
    return { applied: true, reason: null, plan, written, verification };
  });
}

/**
 * Give an attached course the name of the product rather than the name of its intake.
 *
 * A2 was registered as "DeutschFlow Open A2" because the first seven lessons came from
 * open material. It is now simply DeutschFlow A2 — the origin of any one lesson is still
 * recorded on that lesson's provenance, which is where it belongs, rather than in the
 * title a learner reads on the home screen.
 */
export async function retitleCourse(repositories, level, options = {}) {
  const now = options.now ?? Date.now();
  const course = await repositories.courses.findOne({ slug: level.attachToCourseSlug });
  if (!course) return { updated: 0 };

  const rows = await repositories.curriculumTexts.find({
    ownerType: "course", ownerUuid: course.uuid, kind: "title"
  });
  let updated = 0;
  for (const row of rows) {
    const wanted = level.title?.[row.language];
    if (!wanted || row.text === wanted) continue;
    await repositories.curriculumTexts.update(row.uuid, { text: wanted }, { now });
    updated += 1;
  }
  return { updated };
}

/** Hold the source-shaped courses out of the learner's view, structure and all. */
export async function retireSourceCourses(repositories, slugs = RETIRED_COURSE_SLUGS, options = {}) {
  const now = options.now ?? Date.now();
  const report = { courses: 0, units: 0, lessons: 0, sections: 0 };

  await repositories.lifecycle.transaction(async () => {
    for (const slug of slugs) {
      const course = await repositories.courses.findOne({ slug });
      if (!course || course.contentStatus === "draft") continue;
      await repositories.courses.update(course.uuid, { contentStatus: "draft" }, { now });
      report.courses += 1;

      for (const unit of await repositories.courseUnits.find({ courseUuid: course.uuid })) {
        await repositories.courseUnits.update(unit.uuid, { contentStatus: "draft" }, { now });
        report.units += 1;
        for (const lesson of await repositories.lessons.find({ unitUuid: unit.uuid })) {
          await repositories.lessons.update(lesson.uuid, { contentStatus: "draft" }, { now });
          report.lessons += 1;
          for (const section of await repositories.lessonSections.find({ lessonUuid: lesson.uuid })) {
            await repositories.lessonSections.update(section.uuid, { contentStatus: "draft" }, { now });
            report.sections += 1;
          }
        }
      }
    }
  });
  return report;
}

function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  return {
    db,
    executor: {
      async exec(sql) { db.exec(sql); },
      async run(sql, params = []) {
        const result = db.prepare(sql).run(...params);
        return { changes: Number(result?.changes ?? 0) };
      },
      async all(sql, params = []) { return db.prepare(sql).all(...params); },
      async transaction(fn) {
        db.exec("BEGIN");
        try { await fn(); db.exec("COMMIT"); }
        catch (error) { db.exec("ROLLBACK"); throw error; }
      },
      async pragma(name, value) {
        if (value === undefined) {
          const row = db.prepare(`PRAGMA ${name}`).get();
          return row ? Object.values(row)[0] : null;
        }
        db.exec(`PRAGMA ${name} = ${value}`);
        return value;
      }
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const apply = args.includes("--apply");
  const dbFile = path.resolve(process.cwd(), value("--db", "tools/intake/artifacts/intake.db"));

  const store = openStore(dbFile);
  try {
    const adapter = createSqliteAdapter(store.executor);
    await adapter.initializeSchema();
    const repositories = createCanonicalRepositories(adapter);

    for (const level of LEVELS) {
      const lessons = level.units.reduce((n, unit) => n + unit.lessons.length, 0);
      // A level with nothing authored yet is skipped rather than written as a bare course.
      if (!lessons) { console.log(`
════ DeutschFlow ${level.cefr} — nothing authored yet ════`); continue; }
      console.log(`\n════ DeutschFlow ${level.cefr} — ${level.units.length} units, ${lessons} lessons ════`);
      const result = await runLevel(repositories, level, { apply });
      // A level that names a course this store does not have is reported, not crashed on.
      if (!result.plan) { console.log(`  not applied: ${result.reason}`); continue; }

      console.log(`  plan: create ${result.plan.create.length}  update ${result.plan.update.length}` +
        `  unchanged ${result.plan.unchanged.length}  conflicts ${result.plan.conflicts.length}`);
      for (const conflict of result.plan.conflicts.slice(0, 5)) {
        console.log(`  CONFLICT ${conflict.entity} ${conflict.uuid}: ${conflict.reason}`);
      }
      if (!result.applied) { console.log(`  not applied: ${result.reason}`); continue; }
      console.log(`  written: ${JSON.stringify(result.written)}`);
      console.log(`  verified: lessons ${result.verification.lessons}, ` +
        `items ${result.verification.lesson?.items}, ok ${result.verification.ok}`);
    }

    if (apply) {
      for (const level of LEVELS.filter(entry => entry.attachToCourseSlug)) {
        const renamed = await retitleCourse(repositories, level);
        if (renamed.updated) console.log(`
── retitled ${level.attachToCourseSlug}: ${renamed.updated} texts ──`);
      }
      const retired = await retireSourceCourses(repositories);
      console.log(`\n── retired source-shaped courses ──\n  ${JSON.stringify(retired)}`);
    }
  } finally {
    store.db.close();
  }
  console.log(`store: ${dbFile.split(path.sep).join("/")}`);
}

if (process.argv[1]?.endsWith("run-curriculum.mjs")) {
  await main();
}
