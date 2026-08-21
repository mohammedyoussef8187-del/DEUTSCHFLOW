/*
 * Language policy for DeutschFlow's multilingual content model.
 *
 * This is the single source of truth for two DIFFERENT questions that are easy to
 * conflate:
 *
 *   1. Which languages carry educational weight?
 *      German, English and Arabic all do. English and Arabic are equal in teaching
 *      importance: neither is a second-class gloss of the other.
 *
 *   2. Which languages may decide whether a typed answer is CORRECT?
 *      Only German and English. Arabic content is never a scoring input in this model.
 *
 * Those are deliberately separate flags. Arabic being non-scoreable is not a statement
 * about its educational value; it is a statement about deterministic grading, because
 * Arabic orthography (diacritics, hamza forms, alif variants, synonym breadth) makes
 * exact-match grading unreliable enough to distort SRS scheduling.
 *
 * Scope note: this policy governs the CANONICAL content model. It does not retroactively
 * change the existing runtime evaluator, whose recognition-skill behaviour is unchanged
 * and remains covered by its own tests.
 */

export const GERMAN = "de";
export const ENGLISH = "en";
export const ARABIC = "ar";

/** The language being learned. Everything else exists to explain it. */
export const TARGET_LANGUAGE = GERMAN;

/**
 * Languages that may carry meanings, explanations and context.
 * English and Arabic are listed together, and in that order, only for determinism.
 */
export const EDUCATIONAL_LANGUAGES = Object.freeze([GERMAN, ENGLISH, ARABIC]);

/** Support languages: the learner's explanation languages, of equal standing. */
export const SUPPORT_LANGUAGES = Object.freeze([ENGLISH, ARABIC]);

/**
 * Languages whose accepted answers may affect scored correctness.
 * Arabic is deliberately absent. Adding it here would let Arabic text change a card's
 * SRS outcome, which the product rules forbid.
 */
export const SCOREABLE_LANGUAGES = Object.freeze([GERMAN, ENGLISH]);

/** True when answers in this language may decide correctness. */
export function isScoreable(language) {
  return SCOREABLE_LANGUAGES.includes(normalizeLanguage(language));
}

/** True when this language may carry educational content. */
export function isEducational(language) {
  return EDUCATIONAL_LANGUAGES.includes(normalizeLanguage(language));
}

/**
 * Normalize a language tag to the codes used throughout the model.
 * Accepts regional tags such as "en-GB" or "ar-EG" and casing variants.
 */
export function normalizeLanguage(language) {
  if (!language) return "";
  return String(language).trim().toLowerCase().split(/[-_]/)[0];
}

/**
 * Guard for anything about to treat a language as a grading input.
 * Throws rather than silently degrading, so a scoring path can never quietly start
 * accepting Arabic.
 */
export function assertScoreable(language) {
  const code = normalizeLanguage(language);
  if (!isScoreable(code)) {
    throw new RangeError(
      `Language "${code || language}" must not affect scored correctness. ` +
      `Scoreable languages: ${SCOREABLE_LANGUAGES.join(", ")}.`
    );
  }
  return code;
}
