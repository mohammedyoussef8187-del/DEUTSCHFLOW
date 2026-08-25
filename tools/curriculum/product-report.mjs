#!/usr/bin/env node
/*
 * What a learner actually gets.
 *
 * Every other report in this repository counts rows. This one counts what survives the
 * publication gate and reaches a screen: courses a learner can open, units inside them,
 * lessons inside those, and — the number the whole product is judged on — how many of
 * those lessons open onto nothing.
 *
 * It reads through the same services the app does, so a lesson that is present in the
 * database but hidden from the published view is correctly absent here.
 *
 *   node tools/curriculum/product-report.mjs [--db <file>] [--json]
 */

import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";

/** The shape `createSqliteAdapter` expects, over node:sqlite. */
export function executorFor(db) {
  return {
    async exec(sql) { db.exec(sql); },
    async run(sql, params = []) {
      return { changes: Number(db.prepare(sql).run(...params)?.changes ?? 0) };
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
  };
}

/**
 * Walk the published curriculum and count what is really there.
 *
 * A lesson counts as empty when it has no items in any section — that is the state a
 * learner experiences as a broken screen, and it is the one number that must be zero.
 */
export async function productReport(services) {
  const courses = await services.curriculum.courses();
  const report = {
    courses: [], levels: {}, emptyLessons: [], emptyUnits: [],
    totals: {
      courses: 0, units: 0, lessons: 0, sections: 0, items: 0,
      vocabulary: 0, exercises: 0, sentences: 0, grammarItems: 0, listening: 0
    },
    grammar: { topics: 0, rules: 0, rulesWithoutExplanation: [] },
    exercises: { total: 0, gradeable: 0, selfAssessed: 0 }
  };

  for (const course of courses ?? []) {
    const summary = {
      slug: course.slug, cefr: course.cefrLevel,
      title: course.title?.de ?? course.title?.en ?? course.slug,
      units: 0, lessons: 0, items: 0
    };
    report.totals.courses += 1;

    for (const unit of course.units ?? []) {
      report.totals.units += 1;
      summary.units += 1;
      if (!(unit.lessons ?? []).length) {
        report.emptyUnits.push(`${course.slug}/${unit.slug}`);
      }

      for (const lesson of unit.lessons ?? []) {
        report.totals.lessons += 1;
        summary.lessons += 1;
        let items = 0;
        for (const section of lesson.sections ?? []) {
          report.totals.sections += 1;
          items += (section.items ?? []).length;
          for (const item of section.items ?? []) {
            report.totals.items += 1;
            const bucket = {
              vocabulary: "vocabulary", exercise: "exercises", sentence: "sentences",
              listening: "listening", grammar_rule: "grammarItems", grammar: "grammarItems"
            }[item.contentType];
            if (bucket) report.totals[bucket] += 1;
          }
        }
        summary.items += items;
        if (!items) report.emptyLessons.push(`${course.slug}/${unit.slug}/${lesson.slug}`);
      }
    }

    report.courses.push(summary);
    const level = (report.levels[course.cefrLevel] ??= { courses: 0, units: 0, lessons: 0 });
    level.courses += 1;
    level.units += summary.units;
    level.lessons += summary.lessons;
  }

  /* Grammar has to teach, not label: a rule with no explanation is a heading. */
  const grammar = await services.grammar.topics();
  for (const topic of grammar ?? []) {
    report.grammar.topics += 1;
    for (const rule of topic.rules ?? []) {
      report.grammar.rules += 1;
      const explained = rule.explanation?.ar || rule.explanation?.de || rule.explanation?.en;
      if (!explained) report.grammar.rulesWithoutExplanation.push(`${topic.slug}/${rule.slug}`);
    }
  }

  /* Scoring has to be honest: an exercise with no expected answer is self-assessed. */
  const exercises = await services.exercises.all();
  for (const exercise of exercises ?? []) {
    report.exercises.total += 1;
    if (exercise.gradeable) report.exercises.gradeable += 1;
    else report.exercises.selfAssessed += 1;
  }

  return report;
}

function print(report) {
  console.log("── DeutschFlow, as a learner sees it ──\n");
  for (const course of report.courses) {
    console.log(`  ${course.cefr}  ${course.title}`);
    console.log(`      ${course.units} units · ${course.lessons} lessons · ${course.items} items`);
  }
  console.log("\n── totals ──");
  for (const [key, value] of Object.entries(report.totals)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
  console.log("\n── grammar ──");
  console.log(`  topics ${report.grammar.topics} · rules ${report.grammar.rules} · ` +
    `without explanation ${report.grammar.rulesWithoutExplanation.length}`);
  console.log("\n── exercises ──");
  console.log(`  total ${report.exercises.total} · AUTO_GRADED ${report.exercises.gradeable} · ` +
    `SELF_ASSESSED ${report.exercises.selfAssessed}`);
  console.log("\n── the number that matters ──");
  console.log(`  empty learner-visible lessons: ${report.emptyLessons.length}`);
  for (const lesson of report.emptyLessons.slice(0, 20)) console.log(`      ${lesson}`);
  console.log(`  units with no lessons: ${report.emptyUnits.length}`);
  for (const unit of report.emptyUnits.slice(0, 20)) console.log(`      ${unit}`);
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--db");
  const dbFile = path.resolve(process.cwd(),
    index === -1 ? "tools/intake/artifacts/intake.db" : args[index + 1]);

  const db = new DatabaseSync(dbFile);
  try {
    const adapter = createSqliteAdapter(executorFor(db));
    const repositories = createCanonicalRepositories(adapter);
    const services = createServices(repositories);
    const report = await productReport(services);
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else print(report);
    process.exitCode = report.emptyLessons.length || report.emptyUnits.length ? 1 : 0;
  } finally {
    db.close();
  }
}

if (process.argv[1]?.endsWith("product-report.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
