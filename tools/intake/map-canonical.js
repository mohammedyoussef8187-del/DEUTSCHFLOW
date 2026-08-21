/*
 * Stage 5 of the intake pipeline: MAP TO CANONICAL ENTITIES.
 *
 * Pure: intermediate records in, canonical rows out. It writes nothing — the import
 * stage hands these rows to the repository write APIs, so the domain layer stays the
 * only path into the store.
 *
 * Identity is derived, never allocated. Every uuid is a deterministic hash of a source
 * key, so re-running the same source produces the same identifiers and the import
 * upserts instead of duplicating. Nothing here reads a clock for identity.
 *
 * VOCABULARY IDENTITY IS COURSE-SCOPED, NOT LESSON-SCOPED, and keyed by the headword
 * TOGETHER WITH ITS GLOSS. A word that recurs in a later episode with the same meaning
 * is therefore the same canonical item, reused rather than duplicated, while the same
 * German surface form printed with a different meaning stays a separate item. Merging on
 * spelling alone would quietly fuse two words; splitting on lesson alone would give a
 * learner the same word twice. Lesson membership lives in lesson_items either way, so
 * reuse never costs the per-lesson context.
 *
 * Provenance travels with every row at the finest level the source offers: the document,
 * the page it was printed on, the publisher's own reference URL, when it was extracted,
 * and a verification status that starts at `imported` — a machine read it correctly, and
 * a human has not yet confirmed it.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";
import { SUPPORTS, assertSupports } from "./sources.js";

const NS = Object.freeze({
  course: "deutschflow/intake/course",
  level: "deutschflow/intake/course_level",
  unit: "deutschflow/intake/course_unit",
  lesson: "deutschflow/intake/lesson",
  section: "deutschflow/intake/lesson_section",
  item: "deutschflow/intake/lesson_item",
  text: "deutschflow/intake/text",
  vocab: "deutschflow/intake/vocabulary",
  meaning: "deutschflow/intake/meaning",
  sentence: "deutschflow/intake/sentence",
  sentenceText: "deutschflow/intake/sentence_text",
  listening: "deutschflow/intake/listening",
  segment: "deutschflow/intake/listening_segment",
  speaker: "deutschflow/intake/listening_speaker",
  exercise: "deutschflow/intake/exercise",
  option: "deutschflow/intake/exercise_option",
  answer: "deutschflow/intake/accepted_answer",
  link: "deutschflow/intake/link"
});

/**
 * Content status for imported rows.
 *
 * `imported` is deliberately NOT `verified`: extraction succeeded, a human has not
 * signed off. The diff stage treats a `verified` row as protected and an `imported` row
 * as refreshable, which is what keeps a re-import from overwriting reviewed wording.
 */
export const IMPORTED_STATUS = "imported";

/**
 * The canonical identity of one vocabulary entry within a course.
 *
 * The gloss is folded into the key through a short stable fingerprint, so two entries
 * only share an identity when the source printed the same meaning for them.
 */
export function vocabularyKey(courseSlug, entry) {
  return `${courseSlug}:vocab:${slugify(entry.headword)}:${glossFingerprint(entry.arabic)}`;
}

/** A short, stable digest of a gloss. Not a hash of meaning — a hash of the printed text. */
export function glossFingerprint(gloss) {
  const text = String(gloss ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!text) return "none";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

const slugify = value => String(value ?? "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

/**
 * Provenance stamped on every content row.
 * @param {object} context { source, extraction, page }
 */
function provenance({ source, extraction, page }, now) {
  return {
    contentStatus: IMPORTED_STATUS,
    contentVersion: 1,
    // The finest reference the document itself provides.
    sourceReference: page
      ? `${source.title} — ${source.reference} — Seite ${page}`
      : `${source.title} — ${source.reference}`,
    sourceType: source.kind,
    verifiedAt: null,
    verifiedBy: null,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  };
}

const linkMeta = now => ({ createdAt: now, updatedAt: now, revision: 1, deleted: 0 });

/**
 * Map one parsed lesson into canonical rows.
 *
 * @param {object} input { manuscript, exercises, source, exerciseSource, extraction, now }
 * @returns {object} { keys, course, vocabulary, sentences, listening, exercises, stats }
 */
export function mapLesson(input) {
  const { manuscript, exercises = null, source, exerciseSource = null, now = Date.now() } = input;

  assertSupports(source, SUPPORTS.COURSE_IDENTITY, "a course");
  assertSupports(source, SUPPORTS.LESSON_IDENTITY, "a lesson");

  const courseSlug = slugify(`${manuscript.course.title}-${manuscript.course.cefrLevel ?? ""}`);
  const lessonKey = `${courseSlug}:${manuscript.lesson.number ?? slugify(manuscript.lesson.title)}`;
  const page = number => ({ source, extraction: input.extraction, page: number });

  const courseUuid = deterministicUuid(NS.course, courseSlug);
  const levelUuid = deterministicUuid(NS.level, `${courseSlug}:${manuscript.course.cefrLevel}`);
  const unitUuid = deterministicUuid(NS.unit, `${courseSlug}:default`);
  const lessonUuid = deterministicUuid(NS.lesson, lessonKey);
  /*
   * exercises.slug is UNIQUE across the store, and every lesson prints an "Übung 1" and
   * shares vocabulary with its neighbours. Without a lesson tag the second lesson's
   * exercise would collide with the first one's and quietly take it over.
   */
  const lessonTag = manuscript.lesson.number != null
    ? `e${manuscript.lesson.number}`
    : slugify(manuscript.lesson.title);

  /* ------------------------------------------------------------- course */

  const course = {
    course: {
      uuid: courseUuid,
      slug: courseSlug,
      cefrLevel: manuscript.course.cefrLevel,
      ordering: 1,
      sourceTitle: manuscript.course.title,
      sourcePublisher: manuscript.course.publisher,
      sourceEdition: null,
      sourceIsbn: null,
      ...provenance(page(null), now)
    },
    levels: manuscript.course.cefrLevel ? [{
      uuid: levelUuid, courseUuid, cefrLevel: manuscript.course.cefrLevel,
      ordering: 1, ...linkMeta(now)
    }] : [],
    /*
     * The handout names an episode, not a unit. Rather than invent a unit name, one
     * unnamed unit carries the lessons, and its absence of a title is visible.
     */
    units: [{
      uuid: unitUuid, courseUuid, courseLevelUuid: manuscript.course.cefrLevel ? levelUuid : null,
      slug: "episodes", ordering: 1, ...provenance(page(null), now)
    }],
    lessons: [{
      uuid: lessonUuid, unitUuid, slug: slugify(manuscript.lesson.title),
      cefrLevel: manuscript.lesson.cefrLevel, ordering: manuscript.lesson.number ?? 1,
      ...provenance(page(1), now)
    }],
    sections: [],
    items: [],
    prerequisites: [],
    texts: [
      // German title as printed. No English: the source has none.
      textRow(NS.text, "course", courseUuid, "de", "title", manuscript.course.title, page(null), now),
      textRow(NS.text, "lesson", lessonUuid, "de", "title", manuscript.lesson.title, page(1), now)
    ]
  };

  if (manuscript.lesson.titleArabic) {
    course.texts.push(textRow(NS.text, "lesson", lessonUuid, "ar", "title",
      manuscript.lesson.titleArabic, page(1), now));
  }

  /* --------------------------------------------------------- vocabulary */

  assertSupports(source, SUPPORTS.VOCABULARY_DE_AR, "vocabulary");
  const vocabulary = manuscript.vocabulary.map(entry => {
    /* Same word AND same meaning across episodes is one item; same spelling with a
       different gloss is not. The gloss fingerprint is what tells them apart. */
    const key = vocabularyKey(courseSlug, entry);
    const vocabUuid = deterministicUuid(NS.vocab, key);
    const meaningUuid = deterministicUuid(NS.meaning, key);

    return {
      item: {
        uuid: vocabUuid,
        legacyId: null,
        german: entry.headword,
        normalizedGerman: entry.headword.toLowerCase().replace(/\|/g, ""),
        itemType: "word",
        article: null,          // not printed as a separate field; not inferred
        plural: null,
        level: manuscript.course.cefrLevel,
        tags: entry.principalParts ? "principal-parts" : "",
        ignored: 0, favorite: 0, userFlagged: 0,
        qualityStatus: "ok", qualityIssues: "", qualityNote: entry.note ?? "",
        ...provenance(page(entry.page), now)
      },
      meanings: entry.arabic ? [{
        uuid: meaningUuid, vocabUuid, arabicText: entry.arabic,
        normalizedArabic: entry.arabic,
        explanation: entry.principalParts ?? "",
        pronunciation: "",      // the source prints no pronunciation guidance
        ...provenance(page(entry.page), now)
      }] : [],
      // No English in the source, so no translation row at all. The UI shows it missing.
      translations: [],
      acceptedAnswers: [{
        uuid: deterministicUuid(NS.answer, `${key}:de`),
        meaningUuid: entry.arabic ? meaningUuid : null,
        translationUuid: null,
        text: entry.headword.replace(/\|/g, ""),
        language: "de",
        scoreable: 1,
        ...linkMeta(now)
      }]
    };
  });

  /* ------------------------------------------- transcript as sentences */

  assertSupports(source, SUPPORTS.TRANSCRIPT, "transcript sentences");
  const sentences = manuscript.transcript.map(turn => {
    const key = `${lessonKey}:turn:${turn.ordering}`;
    const sentenceUuid = deterministicUuid(NS.sentence, key);
    return {
      sentence: {
        uuid: sentenceUuid, german: turn.german,
        level: manuscript.course.cefrLevel, register: null,
        ordering: turn.ordering, ...provenance(page(turn.page), now)
      },
      // No translation of the dialogue is printed, so none is stored.
      texts: [],
      vocabulary: [], grammar: [], tags: []
    };
  });

  /* -------------------------------------------------------- listening */

  const listeningUuid = deterministicUuid(NS.listening, `${lessonKey}:listening`);
  const speakerNames = [...new Set(manuscript.transcript.map(turn => turn.speaker))];
  const speakers = speakerNames.map((label, index) => ({
    uuid: deterministicUuid(NS.speaker, `${lessonKey}:speaker:${slugify(label)}`),
    itemUuid: listeningUuid, label, role: "", variety: "", ordering: index + 1,
    ...linkMeta(now)
  }));
  const speakerByLabel = new Map(speakers.map(speaker => [speaker.label, speaker.uuid]));

  const listening = {
    /*
     * No audio file for this episode exists in the repository, so no asset is
     * registered and the activity is honestly unplayable. The transcript still teaches.
     */
    audio: null,
    item: {
      uuid: listeningUuid, slug: `${slugify(manuscript.lesson.title)}-dialog`,
      audioUuid: null, activityType: "dialogue",
      level: manuscript.course.cefrLevel, ordering: 1,
      ...provenance(page(1), now)
    },
    texts: [
      textRow(NS.text, null, listeningUuid, "de", "transcript",
        manuscript.transcript.map(turn => `${turn.speaker}: ${turn.german}`).join("\n"),
        page(1), now, "itemUuid"),
      textRow(NS.text, null, listeningUuid, "de", "title", manuscript.lesson.title, page(1), now, "itemUuid")
    ],
    speakers,
    segments: manuscript.transcript.map(turn => ({
      uuid: deterministicUuid(NS.segment, `${lessonKey}:segment:${turn.ordering}`),
      itemUuid: listeningUuid,
      speakerUuid: speakerByLabel.get(turn.speaker) ?? null,
      ordering: turn.ordering,
      // No timecodes are printed. Zero means unknown here, and the UI shows no clock.
      startMs: 0, endMs: 0,
      ...linkMeta(now)
    })),
    segmentTexts: manuscript.transcript.map(turn => ({
      uuid: deterministicUuid(NS.text, `${lessonKey}:segment:${turn.ordering}:de`),
      segmentUuid: deterministicUuid(NS.segment, `${lessonKey}:segment:${turn.ordering}`),
      language: "de", kind: "transcript", text: turn.german,
      ...provenance(page(turn.page), now)
    })),
    links: []
  };

  if (manuscript.lesson.titleArabic) {
    listening.texts.push(textRow(NS.text, null, listeningUuid, "ar", "title",
      manuscript.lesson.titleArabic, page(1), now, "itemUuid"));
  }

  /* -------------------------------------------------------- exercises */

  const mappedExercises = [];

  /*
   * Exercises printed in the teacher's booklet. The booklet prints no answer key, so
   * every option is stored as a choice and NONE is marked expected. The exercise is
   * therefore ungradeable, which is the truth about it.
   */
  for (const exercise of exercises?.exercises ?? []) {
    const key = `${lessonKey}:uebung:${exercise.number}`;
    const exerciseUuid = deterministicUuid(NS.exercise, key);
    const exPage = { source: exerciseSource ?? source, extraction: input.exerciseExtraction, page: exercise.page };

    mappedExercises.push({
      exercise: {
        uuid: exerciseUuid, slug: slugify(`${lessonTag}-uebung-${exercise.number}-${exercise.title}`),
        exerciseType: exercise.options.length ? "multiple_choice" : "type_answer",
        level: manuscript.course.cefrLevel, ordering: exercise.ordering,
        answerLanguage: "de", ...provenance(exPage, now)
      },
      texts: [
        textRow(NS.text, null, exerciseUuid, "de", "prompt",
          exercise.items.map(item => `${item.number}. ${item.text}`).join("\n"), exPage, now, "exerciseUuid"),
        textRow(NS.text, null, exerciseUuid, "de", "instruction",
          `${exercise.title} ${exercise.instruction}`.trim(), exPage, now, "exerciseUuid")
      ],
      options: exercise.options.map((text, index) => ({
        uuid: deterministicUuid(NS.option, `${key}:option:${index + 1}`),
        exerciseUuid, text, language: "de",
        // Not expected: the source does not say which option answers which item.
        isExpected: 0, scoreable: 1, ordering: index + 1,
        ...linkMeta(now)
      })),
      targets: []
    });
  }

  /*
   * One DERIVED exercise per vocabulary entry: prompt is the Arabic gloss, expected
   * answer is the German headword. Both strings are verbatim from the same page, so
   * nothing is invented — but it is labelled `derived` so a reviewer can tell it apart
   * from an exercise the publisher wrote.
   */
  for (const entry of manuscript.vocabulary) {
    if (!entry.arabic) continue;
    const key = `${lessonKey}:recall:${slugify(entry.headword)}`;
    const exerciseUuid = deterministicUuid(NS.exercise, key);
    const exPage = page(entry.page);
    const german = entry.headword.replace(/\|/g, "");

    mappedExercises.push({
      exercise: {
        uuid: exerciseUuid, slug: slugify(`${lessonTag}-recall-${entry.headword}`),
        exerciseType: "type_answer", level: manuscript.course.cefrLevel,
        ordering: 100 + entry.ordering, answerLanguage: "de",
        ...provenance(exPage, now),
        sourceType: "derived-from-vocabulary"
      },
      texts: [
        // The Arabic gloss is the prompt. Arabic teaches here; it never scores.
        textRow(NS.text, null, exerciseUuid, "ar", "prompt", entry.arabic, exPage, now, "exerciseUuid"),
        textRow(NS.text, null, exerciseUuid, "de", "instruction",
          "Schreib das deutsche Wort.", exPage, now, "exerciseUuid")
      ],
      options: [{
        uuid: deterministicUuid(NS.option, `${key}:answer`),
        exerciseUuid, text: german, language: "de",
        isExpected: 1, scoreable: 1, ordering: 1,
        ...linkMeta(now)
      }],
      targets: [{
        uuid: deterministicUuid(NS.link, `${key}:target`),
        exerciseUuid, targetType: "vocabulary",
        targetUuid: deterministicUuid(NS.vocab, vocabularyKey(courseSlug, entry)),
        ...linkMeta(now)
      }]
    });
  }

  /* ------------------------------------------- lesson sections and items */

  const sectionOf = (slug, kind, ordering) => ({
    uuid: deterministicUuid(NS.section, `${lessonKey}:${slug}`),
    lessonUuid, slug, sectionKind: kind, ordering, ...provenance(page(1), now)
  });

  const listeningSection = sectionOf("dialog", "reading", 1);
  const vocabSection = sectionOf("wortschatz", "vocabulary", 2);
  const practiceSection = sectionOf("uebungen", "practice", 3);
  course.sections = [listeningSection, vocabSection, practiceSection];

  const itemRow = (section, contentType, contentUuid, ordering) => ({
    uuid: deterministicUuid(NS.item, `${section.uuid}:${contentType}:${contentUuid}`),
    sectionUuid: section.uuid, contentType, contentUuid, ordering, required: 1,
    ...linkMeta(now)
  });

  course.items = [
    itemRow(listeningSection, "listening", listeningUuid, 1),
    ...vocabulary.map((entry, index) => itemRow(vocabSection, "vocabulary", entry.item.uuid, index + 1)),
    ...mappedExercises.map((entry, index) => itemRow(practiceSection, "exercise", entry.exercise.uuid, index + 1))
  ];

  return {
    keys: { courseSlug, lessonKey, courseUuid, lessonUuid, listeningUuid },
    course,
    vocabulary,
    sentences,
    listening,
    exercises: mappedExercises,
    stats: {
      vocabulary: vocabulary.length,
      sentences: sentences.length,
      segments: listening.segments.length,
      speakers: speakers.length,
      exercisesFromSource: exercises?.exercises?.length ?? 0,
      exercisesDerived: mappedExercises.length - (exercises?.exercises?.length ?? 0),
      englishTexts: 0
    }
  };
}

function textRow(namespace, ownerType, ownerUuid, language, kind, text, pageContext, now, ownerField = null) {
  const base = {
    uuid: deterministicUuid(namespace, `${ownerType ?? ownerField}:${ownerUuid}:${language}:${kind}`),
    language, kind, text,
    ...provenance(pageContext, now)
  };
  if (ownerField) return { ...base, [ownerField]: ownerUuid };
  return { ...base, ownerType, ownerUuid };
}
