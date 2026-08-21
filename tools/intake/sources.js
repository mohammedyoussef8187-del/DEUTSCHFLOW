/*
 * Stage 0: the registry of verified educational sources present in this repository.
 *
 * A source is only importable if it is physically here. Nothing is fetched, and nothing
 * is described from memory: every field below is either read off the file, printed on
 * the document itself, or stated in its own footer.
 *
 * `supports` is the honest inventory of what each document actually contains. The
 * pipeline refuses to produce an entity a source does not support, which is the
 * mechanism that stops "we could probably infer the CEFR level" from ever happening.
 */

export const SOURCE_KINDS = Object.freeze({
  MANUSCRIPT: "manuscript",
  VOCABULARY: "vocabulary",
  EXERCISES: "exercises",
  COURSEBOOK: "coursebook",
  AUDIO: "audio"
});

export const SUPPORTS = Object.freeze({
  COURSE_IDENTITY: "course-identity",
  LESSON_IDENTITY: "lesson-identity",
  TRANSCRIPT: "transcript",
  SPEAKERS: "speakers",
  VOCABULARY_DE_AR: "vocabulary-de-ar",
  VERB_FORMS: "verb-principal-parts",
  EXERCISE_PROMPTS: "exercise-prompts",
  EXERCISE_ANSWERS: "exercise-answers",
  ENGLISH: "english",
  CEFR: "cefr-level",
  IPA: "ipa",
  GRAMMAR_EXPLANATION: "grammar-explanation",
  AUDIO_FILES: "audio-files"
});

export const SOURCES = Object.freeze([
  {
    id: "nicos-weg-a2-e2-l1-manuscript",
    path: "03_COURSE_CONTENT/VOCABULARY/Nicos-Weg-A2-E2-L1-Manuskript-und-Wortschatz-Arabisch.pdf",
    kind: SOURCE_KINDS.MANUSCRIPT,
    // All four printed on the document itself.
    title: "Nicos Weg | A2 — Manuskript und Wortschatz (Arabisch)",
    publisher: "Deutsche Welle",
    reference: "dw.com/nico/arabic",
    // "Nicos Weg | A2" is printed in the page header, so the level is stated, not inferred.
    cefrLevel: "A2",
    pages: 2,
    supports: Object.freeze([
      SUPPORTS.COURSE_IDENTITY, SUPPORTS.LESSON_IDENTITY, SUPPORTS.TRANSCRIPT,
      SUPPORTS.SPEAKERS, SUPPORTS.VOCABULARY_DE_AR, SUPPORTS.VERB_FORMS, SUPPORTS.CEFR
    ]),
    // Stated explicitly so a reader never has to infer absence from silence.
    absent: Object.freeze([
      SUPPORTS.ENGLISH, SUPPORTS.IPA, SUPPORTS.GRAMMAR_EXPLANATION,
      SUPPORTS.AUDIO_FILES, SUPPORTS.EXERCISE_ANSWERS
    ]),
    arabicVisualOrder: false        // verified: this producer emits logical order
  },
  {
    id: "nicos-weg-a2-e2-l1-exercises",
    path: "03_COURSE_CONTENT/REFERENCE/Nicos-Weg-A2-E2-L1-Lehrerhandreichung-und-Uebungen.pdf",
    kind: SOURCE_KINDS.EXERCISES,
    title: "Nicos Weg – A2 — Lehrerhandreichung und Übungen",
    publisher: "Deutsche Welle",
    reference: "dw.com/nico",
    cefrLevel: "A2",
    pages: 4,
    supports: Object.freeze([
      SUPPORTS.COURSE_IDENTITY, SUPPORTS.LESSON_IDENTITY, SUPPORTS.EXERCISE_PROMPTS
    ]),
    /*
     * The booklet is a teacher's handout: it prints the tasks and, for one task, a word
     * bank — but NO answer key. Exercises from it are therefore imported ungradeable.
     * Filling in the answers would be inventing them.
     */
    absent: Object.freeze([
      SUPPORTS.EXERCISE_ANSWERS, SUPPORTS.ENGLISH, SUPPORTS.VOCABULARY_DE_AR,
      SUPPORTS.IPA, SUPPORTS.AUDIO_FILES
    ]),
    arabicVisualOrder: false
  }
]);

export function sourceById(id) {
  return SOURCES.find(source => source.id === id) ?? null;
}

/** Whether a source may produce a given kind of information. */
export function supports(source, capability) {
  return Boolean(source?.supports?.includes(capability));
}

/**
 * Guard used by the mapper: producing an entity that needs a capability the source
 * lacks is a programming error, not a data problem, so it throws rather than warns.
 */
export function assertSupports(source, capability, what) {
  if (!supports(source, capability)) {
    throw new Error(
      `${source?.id ?? "unknown source"} does not support ${capability}; refusing to produce ${what}`
    );
  }
}
