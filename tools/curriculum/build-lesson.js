/*
 * Turn an authored DeutschFlow lesson into canonical rows.
 *
 * Everything else in this repository imports content that someone else wrote. This is the
 * other direction: DeutschFlow's own teaching material, authored as a compact object and
 * expanded into the same canonical batch `applyImport` already writes. No second pipeline
 * — the plan, the transaction, the idempotency and the publication gate are the ones that
 * were already there.
 *
 * The shape is deliberately close to how a teacher thinks about a lesson rather than how
 * the schema stores one:
 *
 *   { slug, title, objective, context, canDo,
 *     vocabulary: [...], sentences: [...], grammar: {...},
 *     reading: {...}, listening: {...}, exercises: [...], mistakes: [...] }
 *
 * and the expansion decides section order, wires every lesson item, derives the accepted
 * answers, and gives every row a deterministic uuid so authoring the same lesson twice
 * produces the same rows and a re-import writes nothing.
 *
 * Original material is `verified` on the way in: it is written here, by this project, and
 * has no upstream source whose review state we are waiting on. Where a lesson cites an
 * outside source it says so in `sourceReference`, and licensed third-party text is not
 * authored here at all — that is what the open-content intake is for.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";

export const AUTHOR = "DeutschFlow";
export const SOURCE_TYPE = "deutschflow-original";
export const STATUS = "verified";

/** One namespace per entity, so an id can only ever collide with its own kind. */
const NS = Object.freeze({
  course: "deutschflow/curriculum/course",
  level: "deutschflow/curriculum/course_level",
  unit: "deutschflow/curriculum/course_unit",
  lesson: "deutschflow/curriculum/lesson",
  section: "deutschflow/curriculum/lesson_section",
  item: "deutschflow/curriculum/lesson_item",
  text: "deutschflow/curriculum/text",
  vocab: "deutschflow/curriculum/vocabulary",
  meaning: "deutschflow/curriculum/meaning",
  translation: "deutschflow/curriculum/translation",
  answer: "deutschflow/curriculum/accepted_answer",
  sentence: "deutschflow/curriculum/sentence",
  sentenceText: "deutschflow/curriculum/sentence_text",
  sentenceVocab: "deutschflow/curriculum/sentence_vocabulary",
  topic: "deutschflow/curriculum/grammar_topic",
  rule: "deutschflow/curriculum/grammar_rule",
  example: "deutschflow/curriculum/grammar_example",
  grammarText: "deutschflow/curriculum/grammar_text",
  exercise: "deutschflow/curriculum/exercise",
  exerciseText: "deutschflow/curriculum/exercise_text",
  option: "deutschflow/curriculum/exercise_option",
  target: "deutschflow/curriculum/exercise_target",
  listening: "deutschflow/curriculum/listening",
  listeningText: "deutschflow/curriculum/listening_text",
  speaker: "deutschflow/curriculum/listening_speaker",
  segment: "deutschflow/curriculum/listening_segment",
  segmentText: "deutschflow/curriculum/listening_segment_text"
});

const id = (namespace, name) => deterministicUuid(namespace, name);

/** The order a learner meets a lesson's parts. Sections are emitted in this order. */
export const SECTION_ORDER = Object.freeze([
  "intro", "vocabulary", "context", "grammar", "reading", "listening", "practice",
  "production", "review"
]);

/* ------------------------------------------------------------------ helpers */

const NOW_DEFAULT = 1787000000000;

const meta = now => ({ createdAt: now, updatedAt: now, revision: 1, deleted: 0 });

const lifecycle = (now, reference) => ({
  contentStatus: STATUS,
  contentVersion: 1,
  sourceReference: reference,
  sourceType: SOURCE_TYPE,
  verifiedAt: now,
  verifiedBy: AUTHOR,
  ...meta(now)
});

/**
 * The identity of one vocabulary entry inside a course.
 *
 * Normally a word IS its normalised German form: writing `Termin` in two lessons should
 * produce one row that both lessons point at, which is what makes re-teaching a word free.
 *
 * But normalisation lower-cases, and German has pairs that differ only in case or only in
 * meaning — `der Morgen` (morning) against `morgen` (tomorrow), the comparative `als`
 * (than) against the temporal `als` (when). Those are different words that happen to share
 * a surface form, and silently folding them together loses one of them completely: its
 * article, its plural and its meaning all disappear, and the lesson that introduced it
 * shows the learner the other word instead.
 *
 * `sense` is how an author says "this is a different lexeme that happens to look the same".
 * It is deliberately opt-in: adding it to a word changes that word's uuid, so it is used
 * only where two entries genuinely collide, and every other row keeps the identity it
 * already has. `assertNoCollisions` below is what makes the opt-in safe — a collision an
 * author has not resolved stops the build instead of merging.
 */
export function vocabularyKey(courseSlug, word) {
  const base = `${courseSlug}:${normalizeGerman(word.de)}`;
  return word.sense ? `${base}#${word.sense}` : base;
}

/**
 * What two entries must agree on to be the same word.
 *
 * Two lessons teaching `der Termin` agree on all of it and share a row. Two entries that
 * differ here are different words, and if they also share an identity key one of them is
 * about to be thrown away.
 */
function lexicalSignature(word) {
  return JSON.stringify([
    word.de, word.article ?? null, word.plural ?? null, word.wordClass ?? null,
    word.ar ?? null, word.en ?? null
  ]);
}

/**
 * Refuse to build a level in which two different words would collapse onto one row.
 *
 * This is the guard that makes the whole scheme trustworthy: the two known collisions are
 * resolved with `sense`, and any future one — a new lesson adding `der Weg` beside `weg`,
 * or a second meaning of an existing word — fails here with both lessons named, instead of
 * shipping a lesson that teaches the wrong word.
 */
export function assertNoCollisions(level, courseSlug) {
  const byKey = new Map();

  for (const unit of level.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      for (const word of lesson.vocabulary ?? []) {
        const key = vocabularyKey(courseSlug, word);
        const signature = lexicalSignature(word);
        const seen = byKey.get(key);

        if (!seen) { byKey.set(key, { signature, word, lesson: lesson.slug }); continue; }
        if (seen.signature === signature) continue;   // the same word, taught twice

        throw new Error(
          `vocabulary identity collision in ${level.cefr}: "${seen.word.de}" ` +
          `(${seen.lesson}) and "${word.de}" (${lesson.slug}) both resolve to "${key}". ` +
          `They are different entries, so one would be discarded. Give one of them a ` +
          `distinct \`sense\` — for example { de: "${word.de}", sense: "…" }.`
        );
      }
    }
  }

  return byKey.size;
}

/** German comparison form: lower case, no article, no separable-verb pipe. */
export function normalizeGerman(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\|/g, "")
    .trim()
    .toLowerCase();
}

const normalizeText = value => String(value ?? "").normalize("NFC").trim().toLowerCase();

/** A multilingual field, written `{ de, en, ar }`, expanded into one row per language. */
function textRows(namespace, ownerType, ownerUuid, kind, values, now, reference) {
  const rows = [];
  for (const language of ["de", "en", "ar"]) {
    const text = values?.[language];
    if (!text) continue;
    rows.push({
      uuid: id(namespace, `${ownerUuid}:${kind}:${language}`),
      ownerType, ownerUuid, language, kind, text,
      ...lifecycle(now, reference)
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ course */

/**
 * The course frame for one CEFR level. Every lesson of that level hangs off it, so a
 * learner sees one DeutschFlow course per level rather than one per imported source.
 */
export function buildCourseFrame(level, options = {}) {
  const now = options.now ?? NOW_DEFAULT;
  const slug = `deutschflow-${level.cefr.toLowerCase()}`;
  const courseUuid = id(NS.course, slug);
  const reference = `DeutschFlow ${level.cefr} — original curriculum`;

  const course = {
    uuid: courseUuid, slug, cefrLevel: level.cefr, ordering: level.ordering,
    sourceTitle: `DeutschFlow ${level.cefr}`, sourcePublisher: AUTHOR,
    sourceEdition: null, sourceIsbn: null,
    ...lifecycle(now, reference)
  };
  const courseLevel = {
    uuid: id(NS.level, `${slug}:${level.cefr}`),
    courseUuid, cefrLevel: level.cefr, ordering: 1, ...meta(now)
  };
  const texts = textRows(NS.text, "course", courseUuid, "title", level.title, now, reference);
  if (level.objective) {
    texts.push(...textRows(NS.text, "course", courseUuid, "objective", level.objective, now, reference));
  }
  return { course, courseLevel, texts, courseUuid, courseLevelUuid: courseLevel.uuid, slug };
}

export function buildUnit(frame, unit, options = {}) {
  const now = options.now ?? NOW_DEFAULT;
  const reference = `DeutschFlow ${unit.cefr} — ${unit.slug}`;
  const uuid = id(NS.unit, `${frame.slug}:${unit.slug}`);
  const row = {
    uuid, courseUuid: frame.courseUuid, courseLevelUuid: frame.courseLevelUuid,
    slug: unit.slug, ordering: unit.ordering, ...lifecycle(now, reference)
  };
  const texts = textRows(NS.text, "unit", uuid, "title", unit.title, now, reference);
  if (unit.objective) {
    texts.push(...textRows(NS.text, "unit", uuid, "objective", unit.objective, now, reference));
  }
  return { row, texts, unitUuid: uuid };
}

/* ------------------------------------------------------------------ lesson */

/**
 * Expand one authored lesson.
 *
 * Returns the canonical rows plus the lesson items that place each piece of content in a
 * section, so the batch can be merged with its siblings and handed to `applyImport`.
 */
export function buildLesson(context, lesson, options = {}) {
  const now = options.now ?? NOW_DEFAULT;
  const { frame, unitUuid, cefr } = context;
  const reference = lesson.source
    ? `DeutschFlow ${cefr} — ${lesson.slug} (${lesson.source})`
    : `DeutschFlow ${cefr} — ${lesson.slug}`;
  const life = () => lifecycle(now, reference);

  const lessonUuid = id(NS.lesson, `${frame.slug}:${lesson.slug}`);
  const out = {
    lesson: {
      uuid: lessonUuid, unitUuid, slug: lesson.slug, cefrLevel: cefr,
      ordering: lesson.ordering, ...life()
    },
    sections: [], items: [], texts: [],
    vocabulary: [], sentences: [], grammar: [], exercises: [], listening: null,
    lessonUuid
  };

  out.texts.push(...textRows(NS.text, "lesson", lessonUuid, "title", lesson.title, now, reference));
  if (lesson.objective) {
    out.texts.push(...textRows(NS.text, "lesson", lessonUuid, "objective", lesson.objective, now, reference));
  }
  if (lesson.canDo) {
    out.texts.push(...textRows(NS.text, "lesson", lessonUuid, "can-do", lesson.canDo, now, reference));
  }

  /* Sections are created on demand and numbered by the teaching order above, so a lesson
     that has no listening simply has no listening section rather than an empty one. */
  const sections = new Map();
  const section = kind => {
    if (sections.has(kind)) return sections.get(kind);
    const uuid = id(NS.section, `${lessonUuid}:${kind}`);
    const row = {
      uuid, lessonUuid, slug: `${lesson.slug}-${kind}`, sectionKind: kind,
      ordering: SECTION_ORDER.indexOf(kind) + 1, ...life()
    };
    const entry = { row, uuid, count: 0 };
    sections.set(kind, entry);
    out.sections.push(row);
    return entry;
  };

  const place = (kind, contentType, contentUuid, required = 1) => {
    const entry = section(kind);
    entry.count += 1;
    out.items.push({
      uuid: id(NS.item, `${entry.uuid}:${contentUuid}`),
      sectionUuid: entry.uuid, contentType, contentUuid,
      ordering: entry.count, required, ...meta(now)
    });
  };

  const sectionText = (kind, textKind, values) => {
    const entry = section(kind);
    out.texts.push(...textRows(NS.text, "section", entry.uuid, textKind, values, now, reference));
  };

  /* --- intro: what this lesson is for, and the situation it happens in --------- */
  if (lesson.objective) sectionText("intro", "objective", lesson.objective);
  if (lesson.context) sectionText("intro", "context", lesson.context);
  if (lesson.canDo) sectionText("intro", "can-do", lesson.canDo);

  /* --- vocabulary -------------------------------------------------------------- */
  const vocabByKey = new Map();
  for (const [index, word] of (lesson.vocabulary ?? []).entries()) {
    const key = vocabularyKey(frame.slug, word);
    const vocabUuid = id(NS.vocab, key);
    vocabByKey.set(word.de, vocabUuid);
    if (word.key) vocabByKey.set(word.key, vocabUuid);

    const meaningUuid = id(NS.meaning, key);
    const translationUuid = id(NS.translation, key);
    const bare = word.de.replace(/\|/g, "");
    const withArticle = word.article ? `${word.article} ${bare}` : bare;

    out.vocabulary.push({
      item: {
        uuid: vocabUuid, legacyId: null, german: bare, normalizedGerman: normalizeGerman(bare),
        itemType: word.wordClass ?? "word", article: word.article ?? null,
        plural: word.plural ?? null, level: cefr, tags: word.tags ?? lesson.slug,
        ignored: 0, favorite: 0, userFlagged: 0,
        qualityStatus: "ok", qualityIssues: "", qualityNote: word.note ?? "",
        ...life()
      },
      meanings: [{
        uuid: meaningUuid, vocabUuid, arabicText: word.ar,
        normalizedArabic: normalizeText(word.ar),
        explanation: word.arNote ?? null, pronunciation: "", ...life()
      }],
      translations: [{
        uuid: translationUuid, vocabUuid, meaningUuid, englishText: word.en,
        normalizedEnglish: normalizeText(word.en), explanation: word.enNote ?? null, ...life()
      }],
      /* German answers may score; the English one may too; Arabic is stored as content and
         never decides correctness. See src/content/languages.js. */
      acceptedAnswers: [
        { uuid: id(NS.answer, `${key}:de`), vocabUuid, meaningUuid, translationUuid: null,
          text: withArticle, language: "de", scoreable: 1, ...meta(now) },
        ...(word.article ? [{ uuid: id(NS.answer, `${key}:de-bare`), vocabUuid, meaningUuid,
          translationUuid: null, text: bare, language: "de", scoreable: 1, ...meta(now) }] : []),
        { uuid: id(NS.answer, `${key}:en`), vocabUuid, meaningUuid, translationUuid,
          text: word.en, language: "en", scoreable: 1, ...meta(now) },
        { uuid: id(NS.answer, `${key}:ar`), vocabUuid, meaningUuid, translationUuid: null,
          text: word.ar, language: "ar", scoreable: 0, ...meta(now) }
      ]
    });
    place("vocabulary", "vocabulary", vocabUuid);
    void index;
  }

  /* --- sentences: the words put to work ---------------------------------------- */
  for (const [index, entry] of (lesson.sentences ?? []).entries()) {
    const sentenceUuid = id(NS.sentence, `${lessonUuid}:${index}`);
    const links = (entry.uses ?? [])
      .map(word => vocabByKey.get(word))
      .filter(Boolean)
      .map(vocabUuid => ({
        uuid: id(NS.sentenceVocab, `${sentenceUuid}:${vocabUuid}`),
        sentenceUuid, vocabUuid, role: "target", ...meta(now)
      }));

    out.sentences.push({
      sentence: {
        uuid: sentenceUuid, german: entry.de, normalizedGerman: normalizeGerman(entry.de),
        level: cefr, register: entry.register ?? "neutral", ordering: index + 1, ...life()
      },
      texts: [
        ...(entry.ar ? [{ uuid: id(NS.sentenceText, `${sentenceUuid}:ar`), sentenceUuid,
          language: "ar", kind: "translation", text: entry.ar, ...life() }] : []),
        ...(entry.en ? [{ uuid: id(NS.sentenceText, `${sentenceUuid}:en`), sentenceUuid,
          language: "en", kind: "translation", text: entry.en, ...life() }] : []),
        ...(entry.note ? [{ uuid: id(NS.sentenceText, `${sentenceUuid}:note`), sentenceUuid,
          language: "ar", kind: "note", text: entry.note, ...life() }] : [])
      ],
      vocabulary: links, grammar: [], tags: []
    });
    place("context", "sentence", sentenceUuid);
  }

  /* --- grammar: a topic with rules that actually explain ----------------------- */
  const ruleByKey = new Map();
  if (lesson.grammar) {
    const grammar = lesson.grammar;
    const topicUuid = id(NS.topic, `${frame.slug}:${grammar.slug}`);
    const entry = {
      topic: {
        uuid: topicUuid, slug: `${frame.slug}-${grammar.slug}`, level: cefr,
        category: grammar.category ?? "core", ordering: lesson.ordering, ...life()
      },
      rules: [], examples: [], texts: []
    };
    entry.texts.push(...textRows(NS.grammarText, "topic", topicUuid, "title", grammar.title, now, reference));
    if (grammar.summary) {
      entry.texts.push(...textRows(NS.grammarText, "topic", topicUuid, "summary", grammar.summary, now, reference));
    }

    for (const [index, rule] of (grammar.rules ?? []).entries()) {
      const ruleUuid = id(NS.rule, `${topicUuid}:${rule.slug}`);
      ruleByKey.set(rule.slug, ruleUuid);
      entry.rules.push({
        uuid: ruleUuid, topicUuid, slug: `${frame.slug}-${grammar.slug}-${rule.slug}`,
        ordering: index + 1, ...life()
      });
      entry.texts.push(...textRows(NS.grammarText, "rule", ruleUuid, "title", rule.title, now, reference));
      entry.texts.push(...textRows(NS.grammarText, "rule", ruleUuid, "explanation", rule.explanation, now, reference));
      if (rule.formation) {
        entry.texts.push(...textRows(NS.grammarText, "rule", ruleUuid, "formation", rule.formation, now, reference));
      }
      if (rule.usage) {
        entry.texts.push(...textRows(NS.grammarText, "rule", ruleUuid, "usage", rule.usage, now, reference));
      }
      if (rule.mistake) {
        entry.texts.push(...textRows(NS.grammarText, "rule", ruleUuid, "mistake", rule.mistake, now, reference));
      }
      for (const [order, example] of (rule.examples ?? []).entries()) {
        const exampleUuid = id(NS.example, `${ruleUuid}:${order}`);
        entry.examples.push({
          uuid: exampleUuid, ruleUuid, german: example.de, ordering: order + 1, ...life()
        });
        if (example.ar) {
          entry.texts.push({
            uuid: id(NS.grammarText, `${exampleUuid}:ar`), ownerType: "example",
            ownerUuid: exampleUuid, language: "ar", kind: "translation", text: example.ar,
            ...life()
          });
        }
      }
      place("grammar", "grammar_rule", ruleUuid);
    }
    out.grammar.push(entry);
  }

  /* --- reading: a short text with its own comprehension questions --------------- */
  if (lesson.reading) {
    /*
     * The passage may be written as `{ de }` beside the title, or as its own
     * `passage: { de }` with a `translation: { ar }`. Both read naturally when authoring,
     * and a lesson whose text silently failed to appear is worse than either — so both
     * are accepted rather than one being the only correct spelling.
     */
    const passage = lesson.reading.passage ?? { de: lesson.reading.de };
    const translation = lesson.reading.translation
      ?? (lesson.reading.ar ? { ar: lesson.reading.ar } : null);

    if (!passage?.de) {
      throw new Error(`reading in ${lesson.slug} has no German passage`);
    }
    sectionText("reading", "title", lesson.reading.title);
    sectionText("reading", "passage", passage);
    if (translation) sectionText("reading", "passage-translation", translation);
  }

  /* --- listening: transcript-based, audio only when a real asset exists ---------- */
  if (lesson.listening) {
    const listening = lesson.listening;
    const itemUuid = id(NS.listening, `${lessonUuid}:${listening.slug}`);
    const speakers = (listening.speakers ?? ["A", "B"]).map((label, index) => ({
      uuid: id(NS.speaker, `${itemUuid}:${label}`), itemUuid, label,
      role: "speaker", variety: "de-DE", ordering: index + 1, ...meta(now)
    }));
    const speakerByLabel = new Map(speakers.map(s => [s.label, s.uuid]));

    const segments = [];
    const segmentTexts = [];
    for (const [index, line] of (listening.lines ?? []).entries()) {
      const segmentUuid = id(NS.segment, `${itemUuid}:${index}`);
      segments.push({
        uuid: segmentUuid, itemUuid,
        speakerUuid: speakerByLabel.get(line.speaker) ?? speakers[0].uuid,
        ordering: index + 1, startMs: 0, endMs: 0, ...meta(now)
      });
      segmentTexts.push({
        uuid: id(NS.segmentText, `${segmentUuid}:de`), segmentUuid, language: "de",
        kind: "transcript", text: line.de, ...life()
      });
      if (line.ar) {
        segmentTexts.push({
          uuid: id(NS.segmentText, `${segmentUuid}:ar`), segmentUuid, language: "ar",
          kind: "translation", text: line.ar, ...life()
        });
      }
    }

    out.listening = {
      /* No audio asset: DeutschFlow records no recording it does not have. The activity is
         a transcript a learner reads and works with, and the screen says the audio is not
         on the device rather than pretending a file exists. */
      audio: null,
      item: {
        uuid: itemUuid, slug: `${frame.slug}-${listening.slug}`, audioUuid: null,
        activityType: listening.activityType ?? "dialogue", level: cefr,
        ordering: lesson.ordering, ...life()
      },
      texts: [
        ...textRows(NS.listeningText, "item", itemUuid, "title", listening.title, now, reference)
          .map(row => ({ uuid: row.uuid, itemUuid, language: row.language, kind: row.kind,
            text: row.text, ...life() })),
        ...(listening.instruction
          ? textRows(NS.listeningText, "item", itemUuid, "instruction", listening.instruction, now, reference)
            .map(row => ({ uuid: row.uuid, itemUuid, language: row.language, kind: row.kind,
              text: row.text, ...life() }))
          : [])
      ],
      speakers, segments, segmentTexts, links: []
    };
    place("listening", "listening", itemUuid);
  }

  /* --- exercises ---------------------------------------------------------------- */
  for (const [index, exercise] of (lesson.exercises ?? []).entries()) {
    const exerciseUuid = id(NS.exercise, `${lessonUuid}:${index}`);
    const scored = exercise.type !== "self_assessed";
    const type = scored ? (exercise.type ?? "type_answer") : "type_answer";

    const texts = [];
    const push = (kind, values) => {
      for (const language of ["de", "en", "ar"]) {
        if (!values?.[language]) continue;
        texts.push({
          uuid: id(NS.exerciseText, `${exerciseUuid}:${kind}:${language}`), exerciseUuid,
          language, kind, text: values[language], ...life()
        });
      }
    };
    push("instruction", exercise.instruction);
    push("prompt", exercise.prompt);
    if (exercise.hint) push("hint", exercise.hint);

    const options = [];
    if (scored) {
      const choices = exercise.options ?? [exercise.answer];
      for (const [order, choice] of choices.entries()) {
        const text = typeof choice === "string" ? choice : choice.text;
        options.push({
          uuid: id(NS.option, `${exerciseUuid}:${order}`), exerciseUuid, text,
          language: exercise.answerLanguage ?? "de",
          isExpected: text === exercise.answer ? 1 : 0,
          scoreable: 1, ordering: order + 1, ...meta(now)
        });
      }
    }

    const targets = [];
    for (const word of exercise.practises ?? []) {
      const targetUuid = vocabByKey.get(word) ?? ruleByKey.get(word);
      if (!targetUuid) continue;
      targets.push({
        uuid: id(NS.target, `${exerciseUuid}:${targetUuid}`), exerciseUuid,
        targetType: ruleByKey.has(word) ? "grammar_rule" : "vocabulary",
        targetUuid, ...meta(now)
      });
    }

    out.exercises.push({
      exercise: {
        uuid: exerciseUuid, slug: `${frame.slug}-${lesson.slug}-${index + 1}`,
        exerciseType: type, level: cefr, ordering: index + 1,
        answerLanguage: exercise.answerLanguage ?? "de", ...life()
      },
      texts, options, targets
    });
    place(exercise.section ?? (scored ? "practice" : "production"), "exercise", exerciseUuid);
  }

  /* --- review: what to carry forward -------------------------------------------- */
  if (lesson.review) sectionText("review", "summary", lesson.review);
  for (const mistake of lesson.mistakes ?? []) {
    sectionText("review", "mistake", mistake);
  }

  return out;
}

/* ------------------------------------------------------------------- batch */

/**
 * Merge a level's authored lessons into one batch in the shape `applyImport` writes.
 *
 * Vocabulary is deduplicated across the level: the same word taught in two lessons is one
 * canonical item that both lessons link to, so a learner's progress on it is one thing.
 */
export function buildLevel(level, options = {}) {
  const now = options.now ?? NOW_DEFAULT;

  /*
   * A level may join a course that already exists.
   *
   * A2 was first populated by the open-content intake, and a learner should meet ONE
   * DeutschFlow A2 rather than two courses that happen to sit at the same level. When the
   * caller passes the existing course's identity, these units hang off it and no second
   * course row is written.
   */
  const attach = options.attach ?? null;
  const frame = attach
    ? { courseUuid: attach.courseUuid, courseLevelUuid: attach.courseLevelUuid,
        slug: attach.slug, course: null, courseLevel: null, texts: [] }
    : buildCourseFrame(level, { now });

  const mapped = {
    course: {
      course: frame.course, levels: frame.courseLevel ? [frame.courseLevel] : [], units: [],
      lessons: [], sections: [], items: [], prerequisites: [], texts: [...frame.texts]
    },
    vocabulary: [], sentences: [], grammar: [], exercises: [], listening: null,
    audioAssets: [],
    keys: { courseUuid: frame.courseUuid, lessonUuids: [] }
  };
  /* One batch may carry only one listening aggregate, so activities are collected and
     returned for the caller to write one lesson at a time. */
  const listenings = [];
  const seenVocabulary = new Map();

  for (const unit of level.units) {
    const built = buildUnit(frame, { ...unit, cefr: level.cefr }, { now });
    mapped.course.units.push(built.row);
    mapped.course.texts.push(...built.texts);

    for (const lesson of unit.lessons) {
      const out = buildLesson(
        { frame, unitUuid: built.unitUuid, cefr: level.cefr }, lesson, { now });

      mapped.course.lessons.push(out.lesson);
      mapped.course.sections.push(...out.sections);
      mapped.course.items.push(...out.items);
      mapped.course.texts.push(...out.texts);
      mapped.keys.lessonUuids.push(out.lessonUuid);

      for (const entry of out.vocabulary) {
        if (seenVocabulary.has(entry.item.uuid)) continue;
        seenVocabulary.set(entry.item.uuid, entry);
        mapped.vocabulary.push(entry);
      }
      mapped.sentences.push(...out.sentences);
      mapped.grammar.push(...out.grammar);
      mapped.exercises.push(...out.exercises);
      if (out.listening) listenings.push({ lessonUuid: out.lessonUuid, listening: out.listening });
    }
  }

  return { mapped, listenings, frame };
}
