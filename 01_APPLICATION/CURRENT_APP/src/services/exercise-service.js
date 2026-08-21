/*
 * Exercise service (Feature D).
 *
 * Assembles authored exercises from the canonical model into a runnable specification:
 * type, multilingual instructions, options, expected answers, and the content it
 * practises.
 *
 * Three boundaries this module exists to hold:
 *
 *   1. Scoring stays deterministic and stays where it already is. This service produces
 *      an exercise SPEC; it does not grade. `expectedAnswers` is what a grader may
 *      compare against, and the existing evaluator does the comparing.
 *
 *   2. Arabic never grades. An option's `scoreable` flag is re-checked against the
 *      language policy on the way out, exactly as accepted answers are, so an Arabic
 *      option stored with scoreable=1 still cannot become an expected answer. Arabic
 *      options remain available as choices and explanations.
 *
 *   3. Presentation order is deterministic. Options are ordered by their authored
 *      `ordering`, and any shuffling takes an explicit seed, so a session can be
 *      reproduced and a test can assert exact output. Nothing here calls Math.random.
 */

import {
  ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, isScoreable, normalizeLanguage
} from "../content/languages.js";

export const EXERCISE_TYPES = Object.freeze({
  TYPE_ANSWER: "type_answer",
  MULTIPLE_CHOICE: "multiple_choice",
  ORDER_TOKENS: "order_tokens",
  CLOZE: "cloze"
});

export const EXERCISE_TEXT_KINDS = Object.freeze({
  INSTRUCTION: "instruction",
  PROMPT: "prompt",
  HINT: "hint"
});

export const TARGET_TYPES = Object.freeze({
  VOCABULARY: "vocabulary",
  SENTENCE: "sentence",
  GRAMMAR_RULE: "grammar_rule"
});

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

function byLanguage(texts, kind) {
  const values = { [GERMAN]: null, [ENGLISH]: null, [ARABIC]: null };
  for (const row of texts) {
    if (row.kind !== kind) continue;
    values[normalizeLanguage(row.language)] = row.text;
  }
  return values;
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
 * Deterministic shuffle. Requires an explicit seed, so option order is reproducible
 * across a resumed session and assertable in tests.
 */
export function seededShuffle(items, seed) {
  const out = [...items];
  let state = Number(seed) >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    // xorshift32: small, dependency-free, and stable across platforms.
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Assemble exercises from a canonical dataset.
 *
 * @param {object} canonical { exercises, exerciseTexts, exerciseOptions, exerciseTargets }
 * @param {object} [options] { shuffleSeed } — when given, choice options are shuffled
 *                           deterministically instead of using authored order.
 */
export function buildExercises(canonical = {}, { shuffleSeed = null } = {}) {
  const textsByExercise = groupBy(canonical.exerciseTexts, "exerciseUuid");
  const optionsByExercise = groupBy(canonical.exerciseOptions, "exerciseUuid");
  const targetsByExercise = groupBy(canonical.exerciseTargets, "exerciseUuid");

  return (canonical.exercises ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(exercise => {
      const texts = textsByExercise.get(exercise.uuid) ?? [];
      const instruction = byLanguage(texts, EXERCISE_TEXT_KINDS.INSTRUCTION);
      const prompt = byLanguage(texts, EXERCISE_TEXT_KINDS.PROMPT);
      const hint = byLanguage(texts, EXERCISE_TEXT_KINDS.HINT);

      const rawOptions = (optionsByExercise.get(exercise.uuid) ?? []).sort(byOrdering);
      const options = (shuffleSeed == null ? rawOptions : seededShuffle(rawOptions, shuffleSeed))
        .map(option => {
          const language = normalizeLanguage(option.language);
          // Stored flag AND policy must agree, so a bad import cannot make Arabic score.
          const scoreable = Boolean(option.scoreable) && isScoreable(language);
          return {
            uuid: option.uuid,
            text: option.text,
            language,
            isExpected: Boolean(option.isExpected),
            scoreable
          };
        });

      /*
       * The answers a grader may compare against: expected AND scoreable. An expected
       * Arabic option is deliberately excluded here — it can still be shown, but it
       * cannot decide correctness.
       */
      const expectedAnswers = options
        .filter(option => option.isExpected && option.scoreable)
        .map(option => ({ text: option.text, language: option.language }));

      const answerLanguage = normalizeLanguage(exercise.answerLanguage || GERMAN);

      return {
        uuid: exercise.uuid,
        slug: exercise.slug,
        type: exercise.exerciseType,
        level: exercise.level || null,
        ordering: exercise.ordering ?? 0,
        answerLanguage,
        // An exercise whose answers are not in a scoreable language cannot be graded.
        gradeable: isScoreable(answerLanguage) && expectedAnswers.length > 0,
        instruction,
        prompt,
        hint,
        options,
        expectedAnswers,
        targets: (targetsByExercise.get(exercise.uuid) ?? []).map(target => ({
          type: target.targetType,
          uuid: target.targetUuid
        })),
        contentStatus: exercise.contentStatus ?? null,
        provenance: {
          status: exercise.contentStatus ?? null,
          version: exercise.contentVersion ?? null,
          sourceType: exercise.sourceType ?? null,
          sourceReference: exercise.sourceReference ?? null,
          verifiedAt: exercise.verifiedAt ?? null
        },
        coverage: coverageOf(instruction)
      };
    });
}

/**
 * The only sanctioned way to obtain gradeable answers for an exercise.
 * Re-filters through the policy so no caller can bypass it.
 */
export function expectedAnswersFor(exercise) {
  if (!exercise) return [];
  return (exercise.expectedAnswers ?? []).filter(answer => isScoreable(answer.language));
}

/** Exercises practising a particular piece of content. */
export function exercisesForTarget(canonical, targetType, targetUuid, options = {}) {
  return buildExercises(canonical, options)
    .filter(exercise => exercise.targets.some(t => t.type === targetType && t.uuid === targetUuid));
}

/** Repository-backed service. Read-only; assembles specs and grades nothing. */
export function createExerciseService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function loadCanonical() {
    const [exercises, exerciseTexts, exerciseOptions, exerciseTargets] = await Promise.all([
      repositories.exercises.all(),
      repositories.exerciseTexts.all(),
      repositories.exerciseOptions.all(),
      repositories.exerciseTargets.all()
    ]);
    return { exercises, exerciseTexts, exerciseOptions, exerciseTargets };
  }

  return Object.freeze({
    async all(options = {}) {
      return buildExercises(await loadCanonical(), options);
    },

    async byLevel(level, options = {}) {
      return (await this.all(options)).filter(exercise => exercise.level === level);
    },

    async byType(type, options = {}) {
      return (await this.all(options)).filter(exercise => exercise.type === type);
    },

    async forTarget(targetType, targetUuid, options = {}) {
      return exercisesForTarget(await loadCanonical(), targetType, targetUuid, options);
    },

    /** Exercises that cannot currently be graded, and why. */
    async gradeabilityReport() {
      const all = await this.all();
      const ungradeable = all.filter(exercise => !exercise.gradeable);
      return {
        total: all.length,
        gradeable: all.length - ungradeable.length,
        ungradeable: ungradeable.map(exercise => ({
          slug: exercise.slug,
          reason: isScoreable(exercise.answerLanguage)
            ? "no scoreable expected answer"
            : `answer language "${exercise.answerLanguage}" cannot score`
        }))
      };
    },

    async coverageReport() {
      const all = await this.all();
      const covered = language => all.filter(exercise => exercise.coverage[language]).length;
      return {
        total: all.length,
        [ENGLISH]: covered(ENGLISH),
        [ARABIC]: covered(ARABIC),
        missingEnglish: all.length - covered(ENGLISH),
        missingArabic: all.length - covered(ARABIC)
      };
    }
  });
}
