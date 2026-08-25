#!/usr/bin/env node
/*
 * Teaching prose for the seven A2 lessons that came from open content.
 *
 * Those lessons arrived with vocabulary, sentences, grammar, exercises and a listening
 * activity — everything a learner practises with, and nothing that tells them why they
 * are here. A DeutschFlow lesson opens by saying what it is for and the situation it
 * happens in, and closes by summarising what to carry away and what learners get wrong.
 *
 * That framing is written here, by this project. It is original DeutschFlow material
 * layered ONTO the imported lessons: it adds an intro and a review section and touches
 * nothing that is scored, so the educator review those lessons already passed still
 * stands over the content it actually covered.
 *
 *   node tools/curriculum/a2-open-teaching.mjs [--apply] [--db <file>]
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";
import { AUTHOR, SOURCE_TYPE, STATUS } from "./build-lesson.js";

const NS_SECTION = "deutschflow/curriculum/lesson_section";
const NS_TEXT = "deutschflow/curriculum/text";

/* An intro sorts before anything imported; a review sorts after all of it. */
const INTRO_ORDERING = 0;
const REVIEW_ORDERING = 90;

export const TEACHING = Object.freeze({
  "alltag-und-services": {
    context: { ar: "أسبوع عادي: مشاوير، مواعيد، وتسوّق يومي. اللغة التي تحتاجها هنا هي لغة التنظيم — متى، أين، وكم." },
    canDo: { ar: "أستطيع تنظيم يومي وطلب ما أحتاجه في المتاجر والخدمات." },
    summary: { ar: "المفردات هنا عملية أكثر منها نظرية: احفظها بالجملة التي تُقال فيها، لا وحدها. وانتبه لترتيب الفعل عندما تبدأ الجملة بظرف زمان." },
    mistake: { ar: "خطأ شائع عند البدء بظرف زمان: «Morgen ich gehe». الصواب «Morgen gehe ich» — الفعل يبقى في المركز الثاني." }
  },
  "familie-und-feiern-perfekt": {
    objective: {
      ar: "تتحدث عن عائلتك والمناسبات التي تحضرها، وتحكي عمّا حدث بصيغة الماضي المركّب.",
      de: "Du kannst über deine Familie und Feste sprechen und mit dem Perfekt erzählen, was passiert ist.",
      en: "You can talk about your family and celebrations and use the Perfekt to say what happened."
    },
    context: { ar: "احتفال عائلي مضى: من كان هناك، ماذا حدث، وكيف كان." },
    canDo: { ar: "أستطيع وصف عائلتي والحديث عن مناسبة مضت." },
    summary: { ar: "الماضي المركّب هو زمن الحكاية في الألمانية المنطوقة: haben أو sein في المركز الثاني، واسم المفعول آخر كلمة." },
    mistake: { ar: "«Ich habe nach Hause gegangen» خطأ. أفعال الحركة تأخذ sein: «Ich bin nach Hause gegangen»." }
  },
  "reisen-planen-und-erzaehlen": {
    context: { ar: "رحلة: التخطيط لها قبل السفر، ثم روايتها بعد العودة." },
    canDo: { ar: "أستطيع تنظيم سفر والحديث عن رحلة مضت." },
    summary: { ar: "التخطيط يستعمل المضارع مع ظرف زمان («Nächste Woche fahre ich…»)، والحكاية تستعمل الماضي المركّب. الزمنان يعيشان في نفس الدرس عن قصد." },
    mistake: { ar: "لا تخلط بين mit للوسيلة وnach للوجهة: «mit dem Zug nach Berlin»، وليس «nach dem Zug»." }
  },
  "gesundheit-und-termine": {
    context: { ar: "موعد عند الطبيب: أن تصف ما تشعر به، وأن تفهم النصيحة، وأن ترتّب موعداً آخر." },
    canDo: { ar: "أستطيع وصف أعراضي وحجز موعد وفهم نصيحة بسيطة." },
    summary: { ar: "الألم يُقال بثلاث بنى: «Mein Kopf tut weh»، «Ich habe Kopfschmerzen»، «Ich bin krank». الثانية هي الأكثر استعمالاً في العيادة." },
    mistake: { ar: "«Ich habe weh» ليست جملة ألمانية. قل «Mein Hals tut weh» أو «Ich habe Halsschmerzen»." }
  },
  "wohnen-und-arbeiten": {
    context: { ar: "أن تختار سكناً وأن تتحدث عن عملك: مقارنة، وصف، وتعبير عن رغبة." },
    canDo: { ar: "أستطيع مقارنة أشكال السكن ووصف عملي ورغباتي فيه." },
    summary: { ar: "المقارنة تحتاج ‎-er مع als، والوصف قبل الاسم يحتاج نهاية للصفة. الاثنان معاً هما ما يجعل الوصف يبدو ناضجاً لا مبتدئاً." },
    mistake: { ar: "«größer wie» خطأ شائع جداً. المقارنة دائماً بـ als: «größer als»." }
  },
  "bildung-und-umwelt": {
    context: { ar: "نقاش: مسارك التعليمي، ورأيك في سلوك يومي أفضل للبيئة." },
    canDo: { ar: "أستطيع وصف مساري التعليمي وتبرير رأيي." },
    summary: { ar: "الرأي في A2 يُبنى بجملة تابعة: «Ich finde, dass …» مع الفعل في النهاية، و«…, weil …» للسبب." },
    mistake: { ar: "«weil ich bin dagegen» خطأ. في الجملة التابعة الفعل آخر كلمة: «weil ich dagegen bin»." }
  },
  "stadt-kultur-und-wege": {
    context: { ar: "مدينة لا تعرفها: أن تسأل عن الطريق، وأن تفهم الإجابة، وأن تخطّط لأمسية ثقافية." },
    canDo: { ar: "أستطيع السؤال عن الطريق وفهم الإرشاد والحديث عن فعالية." },
    summary: { ar: "الإرشاد يُعطى بصيغة الأمر المهذّبة («Gehen Sie geradeaus»)، وحروف mit وzu وnach تأخذ حالة الجر دائماً." },
    mistake: { ar: "«Wie komme ich zu der Bahnhof?» خطأ. الاختصار إلزامي ومذكّر: «zum Bahnhof»." }
  }
});

const meta = now => ({ createdAt: now, updatedAt: now, revision: 1, deleted: 0 });

const lifecycle = (now, reference) => ({
  contentStatus: STATUS, contentVersion: 1, sourceReference: reference,
  sourceType: SOURCE_TYPE, verifiedAt: now, verifiedBy: AUTHOR, ...meta(now)
});

function textRows(ownerType, ownerUuid, kind, values, now, reference) {
  const rows = [];
  for (const language of ["de", "en", "ar"]) {
    if (!values?.[language]) continue;
    rows.push({
      uuid: deterministicUuid(NS_TEXT, `${ownerUuid}:${kind}:${language}`),
      ownerType, ownerUuid, language, kind, text: values[language],
      ...lifecycle(now, reference)
    });
  }
  return rows;
}

/**
 * Add the framing sections to one lesson.
 *
 * Idempotent by construction: every uuid is derived from the lesson and the kind, so a
 * second run finds the rows already present and writes nothing.
 */
export async function teachLesson(repositories, lesson, teaching, options = {}) {
  const now = options.now ?? Date.now();
  const reference = `DeutschFlow A2 — teaching frame for ${lesson.slug}`;
  const written = { sections: 0, texts: 0 };

  const upsertSection = async (kind, ordering) => {
    const uuid = deterministicUuid(NS_SECTION, `${lesson.uuid}:${kind}`);
    if (!await repositories.lessonSections.exists(uuid)) {
      await repositories.lessonSections.insert({
        uuid, lessonUuid: lesson.uuid, slug: `${lesson.slug}-${kind}`,
        sectionKind: kind, ordering, ...lifecycle(now, reference)
      }, { now });
      written.sections += 1;
    }
    return uuid;
  };

  const writeTexts = async (ownerUuid, kind, values) => {
    for (const row of textRows("section", ownerUuid, kind, values, now, reference)) {
      if (await repositories.curriculumTexts.exists(row.uuid)) continue;
      await repositories.curriculumTexts.insert(row, { now });
      written.texts += 1;
    }
  };

  /*
   * The objective a lesson already carries is repeated into its intro rather than
   * rewritten: it is the same promise, and the intro is simply where a learner reads it.
   */
  const objective = teaching.objective ?? await lessonObjective(repositories, lesson);

  if (objective || teaching.context || teaching.canDo) {
    const intro = await upsertSection("intro", INTRO_ORDERING);
    if (objective) await writeTexts(intro, "objective", objective);
    if (teaching.context) await writeTexts(intro, "context", teaching.context);
    if (teaching.canDo) await writeTexts(intro, "can-do", teaching.canDo);
  }

  if (teaching.summary || teaching.mistake) {
    const review = await upsertSection("review", REVIEW_ORDERING);
    if (teaching.summary) await writeTexts(review, "summary", teaching.summary);
    if (teaching.mistake) await writeTexts(review, "mistake", teaching.mistake);
  }

  /* A lesson with no objective of its own gets the one written here. */
  if (teaching.objective) {
    for (const row of textRows("lesson", lesson.uuid, "objective", teaching.objective, now, reference)) {
      if (await repositories.curriculumTexts.exists(row.uuid)) continue;
      await repositories.curriculumTexts.insert(row, { now });
      written.texts += 1;
    }
  }

  return written;
}

/** The objective already written on a lesson, in every language it exists in. */
async function lessonObjective(repositories, lesson) {
  const rows = await repositories.curriculumTexts.find({
    ownerType: "lesson", ownerUuid: lesson.uuid, kind: "objective"
  });
  if (!rows.length) return null;
  const values = {};
  for (const row of rows.filter(entry => !entry.deleted)) values[row.language] = row.text;
  return Object.keys(values).length ? values : null;
}

export async function run(repositories, options = {}) {
  const now = options.now ?? Date.now();
  const totals = { lessons: 0, sections: 0, texts: 0, missing: [] };

  await repositories.lifecycle.transaction(async () => {
    for (const [slug, teaching] of Object.entries(TEACHING)) {
      const lesson = await repositories.lessons.findOne({ slug });
      if (!lesson) { totals.missing.push(slug); continue; }
      const written = await teachLesson(repositories, lesson, teaching, { now });
      totals.lessons += 1;
      totals.sections += written.sections;
      totals.texts += written.texts;
    }
  });

  return totals;
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
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--db");
  const dbFile = path.resolve(process.cwd(),
    index === -1 ? "tools/intake/artifacts/intake.db" : args[index + 1]);

  const store = openStore(dbFile);
  try {
    const adapter = createSqliteAdapter(store.executor);
    const repositories = createCanonicalRepositories(adapter);
    if (!args.includes("--apply")) {
      console.log(`preview only — ${Object.keys(TEACHING).length} lessons would gain a teaching frame`);
      return;
    }
    const totals = await run(repositories);
    console.log(`teaching frames: lessons ${totals.lessons}, sections +${totals.sections}, texts +${totals.texts}`);
    if (totals.missing.length) console.log(`  not found: ${totals.missing.join(", ")}`);
  } finally {
    store.db.close();
  }
}

if (process.argv[1]?.endsWith("a2-open-teaching.mjs")) {
  main().catch(error => { console.error(error); process.exit(1); });
}
