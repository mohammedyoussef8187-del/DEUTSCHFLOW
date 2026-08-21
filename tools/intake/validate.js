/*
 * Stage 4 of the intake pipeline: VALIDATE.
 *
 * This stage FLAGS. It never repairs, fills in or guesses, because a pipeline that
 * quietly fixes its input produces content nobody can trace back to a page.
 *
 * Warnings are for a human to read before the import runs. Errors block the import,
 * and the line between them is simple: a warning means "this content is thinner than
 * you might expect"; an error means "importing this would put something in the store
 * that the source does not say".
 */

import { hasBidiControls, hasPresentationForms, isArabic } from "./normalize.js";
import { SUPPORTS, supports } from "./sources.js";

export const SEVERITY = Object.freeze({ ERROR: "error", WARNING: "warning" });

const issue = (severity, code, detail, where = null) => ({ severity, code, detail, where });

/** Validate the parsed manuscript against what its source claims to support. */
export function validateManuscript(parsed, source) {
  const issues = [];

  if (!parsed.course?.title) issues.push(issue(SEVERITY.ERROR, "course-title-missing", "no course title on the page"));
  if (!parsed.lesson?.title) issues.push(issue(SEVERITY.ERROR, "lesson-title-missing", "no episode title on the page"));
  if (parsed.lesson?.number == null) {
    issues.push(issue(SEVERITY.WARNING, "lesson-number-missing", "episode number not printed"));
  }

  // A level is only allowed to exist if the document prints one.
  if (parsed.course?.cefrLevel && !supports(source, SUPPORTS.CEFR)) {
    issues.push(issue(SEVERITY.ERROR, "cefr-not-supported",
      "a level was parsed from a source that does not print one"));
  }

  if (!parsed.transcript?.length) {
    issues.push(issue(SEVERITY.WARNING, "transcript-empty", "no dialogue turns found"));
  }

  const speakers = new Set();
  for (const turn of parsed.transcript ?? []) {
    if (!turn.speaker) {
      issues.push(issue(SEVERITY.WARNING, "unresolved-speaker", "a turn has no speaker label",
        `turn ${turn.ordering}`));
    } else speakers.add(turn.speaker);
    if (isArabic(turn.german)) {
      issues.push(issue(SEVERITY.ERROR, "transcript-language-mixed",
        "a German turn contains Arabic text", `turn ${turn.ordering}`));
    }
  }

  issues.push(...validateVocabulary(parsed.vocabulary ?? [], source));

  return {
    issues,
    ok: !issues.some(entry => entry.severity === SEVERITY.ERROR),
    summary: {
      turns: parsed.transcript?.length ?? 0,
      speakers: [...speakers],
      vocabulary: parsed.vocabulary?.length ?? 0,
      // Counted, because "how much has no English" is the number a reviewer wants.
      withoutEnglish: (parsed.vocabulary ?? []).filter(entry => !entry.english).length,
      withPrincipalParts: (parsed.vocabulary ?? []).filter(entry => entry.principalParts).length
    }
  };
}

export function validateVocabulary(entries, source) {
  const issues = [];
  const seen = new Map();

  for (const entry of entries) {
    const where = `${entry.headword} (page ${entry.page})`;

    if (!entry.headword) issues.push(issue(SEVERITY.ERROR, "vocabulary-headword-missing", "entry with no headword", where));
    if (!entry.arabic) {
      issues.push(issue(SEVERITY.WARNING, "vocabulary-arabic-missing", "no Arabic gloss printed", where));
    } else {
      if (hasPresentationForms(entry.arabic)) {
        issues.push(issue(SEVERITY.ERROR, "arabic-presentation-forms",
          "Arabic still contains presentation forms after normalization", where));
      }
      if (hasBidiControls(entry.arabic)) {
        issues.push(issue(SEVERITY.ERROR, "arabic-bidi-controls",
          "Arabic still contains bidi control characters", where));
      }
      if (!isArabic(entry.arabic)) {
        issues.push(issue(SEVERITY.ERROR, "arabic-not-arabic",
          "the gloss column holds no Arabic", where));
      }
    }

    // The source prints no English. That is expected and recorded, never filled in.
    if (!entry.english && !supports(source, SUPPORTS.ENGLISH)) {
      issues.push(issue(SEVERITY.WARNING, "english-absent-in-source",
        "no English in this source; stored as untranslated", where));
    }

    // A headword can legitimately repeat with a different sense; that is ambiguity for a
    // human, not something to merge automatically.
    const key = entry.headword?.toLowerCase();
    if (key && seen.has(key)) {
      issues.push(issue(SEVERITY.WARNING, "duplicate-headword",
        `also on page ${seen.get(key)}`, where));
    } else if (key) seen.set(key, entry.page);

    if (entry.headword && /\s{2,}/.test(entry.headword)) {
      issues.push(issue(SEVERITY.WARNING, "ambiguous-headword",
        "headword contains column padding; may be two entries", where));
    }
  }

  return issues;
}

/** Validate parsed exercises. An absent answer key is a fact, not a defect to repair. */
export function validateExercises(parsed, source) {
  const issues = [];

  for (const exercise of parsed.exercises ?? []) {
    const where = `Übung ${exercise.number} (page ${exercise.page})`;
    if (!exercise.items.length) {
      issues.push(issue(SEVERITY.WARNING, "exercise-without-items", "no numbered items found", where));
    }
    if (!exercise.expected && !supports(source, SUPPORTS.EXERCISE_ANSWERS)) {
      issues.push(issue(SEVERITY.WARNING, "exercise-answers-absent",
        "the source prints no answer key; the exercise will be imported ungradeable", where));
    }
    if (exercise.expected && !supports(source, SUPPORTS.EXERCISE_ANSWERS)) {
      issues.push(issue(SEVERITY.ERROR, "exercise-answers-invented",
        "an expected answer appeared from a source that prints none", where));
    }
    if (exercise.options.length && exercise.items.length &&
        exercise.options.length < exercise.items.length) {
      issues.push(issue(SEVERITY.WARNING, "exercise-options-incomplete",
        `${exercise.options.length} options for ${exercise.items.length} items`, where));
    }
  }

  return {
    issues,
    ok: !issues.some(entry => entry.severity === SEVERITY.ERROR),
    summary: {
      exercises: parsed.exercises?.length ?? 0,
      gradeable: (parsed.exercises ?? []).filter(exercise => exercise.expected).length
    }
  };
}

/** Merge several validation results for one report. */
export function mergeValidation(...results) {
  const issues = results.flatMap(result => result.issues);
  return {
    issues,
    ok: results.every(result => result.ok),
    errors: issues.filter(entry => entry.severity === SEVERITY.ERROR),
    warnings: issues.filter(entry => entry.severity === SEVERITY.WARNING),
    summary: Object.assign({}, ...results.map(result => result.summary))
  };
}
