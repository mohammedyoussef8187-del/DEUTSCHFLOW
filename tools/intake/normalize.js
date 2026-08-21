/*
 * Stage 2 of the intake pipeline: NORMALIZE.
 *
 * Text out of a PDF is not wrong, but it is dressed for a page rather than for storage:
 * Arabic arrives wrapped in bidi control characters and partly in presentation forms,
 * lines are padded for layout, and German may or may not be composed.
 *
 * Everything here is REVERSIBLE PRESENTATION CLEANUP. Nothing rewrites meaning: no
 * translation, no spelling correction, no expansion of abbreviations. If a string comes
 * out of this module different from how it went in, the difference is an artifact of
 * printing, not of language.
 *
 * The German rule is the strict one: umlauts and ß must survive byte-for-byte, so NFKC
 * is applied ONLY to Arabic runs. Applied to the whole string it would also rewrite
 * German typography — a real ellipsis becoming three dots, for instance — which would be
 * a silent edit to source text.
 */

/** Bidi formatting characters. Layout instructions, never content. */
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩؜]/g;

/** Arabic and Arabic-presentation ranges, including the shared punctuation. */
const ARABIC_RUN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿][؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿\s،؛؟]*/g;

const PRESENTATION_FORMS = /[ﭐ-﷿ﹰ-﻿]/;

/** Arabic-Indic and extended digits, which should read as ordinary digits when stored. */
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

export function hasPresentationForms(text) {
  return PRESENTATION_FORMS.test(String(text ?? ""));
}

export function hasBidiControls(text) {
  BIDI_CONTROLS.lastIndex = 0;
  return BIDI_CONTROLS.test(String(text ?? ""));
}

export function isArabic(text) {
  return /[؀-ۿﭐ-﷿ﹰ-﻿]/.test(String(text ?? ""));
}

/**
 * Put one Arabic run into logical order and base letters.
 *
 * NFKC maps presentation forms (ARABIC LETTER BEH ISOLATED FORM and friends) back to
 * the base letters they were drawn from. That is exactly the right transform here and
 * it is why it is applied to Arabic only.
 *
 * @param {string} run
 * @param {object} [options] { visualOrder } set only for a source known to emit
 *   right-to-left text reversed. It is NOT inferred: guessing wrongly would silently
 *   reverse correct text, and no reliable automatic test for it exists.
 */
export function normalizeArabicRun(run, { visualOrder = false } = {}) {
  let text = String(run ?? "").replace(BIDI_CONTROLS, "");
  text = text.normalize("NFKC");
  if (visualOrder) text = reverseVisualOrder(text);
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Reverse text a producer emitted in visual order.
 * Words are reversed as units and each word's letters are reversed with them, which is
 * what visual-order output actually is.
 */
export function reverseVisualOrder(text) {
  return String(text ?? "")
    .split(/(\s+)/)
    .reverse()
    .map(part => (/^\s+$/.test(part) ? part : [...part].reverse().join("")))
    .join("");
}

/** Digits stored as digits, whichever script they were printed in. */
export function normalizeDigits(text) {
  return String(text ?? "").replace(ARABIC_DIGITS, digit => {
    const code = digit.codePointAt(0);
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Normalize a mixed German/Arabic line.
 *
 * German is composed (NFC) and otherwise left alone. Arabic runs are normalized in
 * place. Layout whitespace collapses; line content does not move.
 */
export function normalizeLine(line, options = {}) {
  const withoutControls = String(line ?? "").replace(BIDI_CONTROLS, "");
  const withArabic = withoutControls.replace(ARABIC_RUN, run => normalizeArabicRun(run, options));
  return withArabic
    .normalize("NFC")
    .replace(/[\t ​]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trimEnd();
}

/** Normalize a whole extracted page, keeping line structure for the parser. */
export function normalizePage(text, options = {}) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map(line => normalizeLine(line, options))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * What normalization changed, for the audit trail.
 * A stage that quietly rewrites source text is indistinguishable from a stage that
 * corrupts it, so every run reports what it touched.
 */
export function normalizationReport(before, after) {
  return {
    presentationFormsRemoved: hasPresentationForms(before) && !hasPresentationForms(after),
    bidiControlsRemoved: hasBidiControls(before) && !hasBidiControls(after),
    lengthBefore: String(before ?? "").length,
    lengthAfter: String(after ?? "").length,
    // Germanic characters must survive exactly; a change here is a bug, not a cleanup.
    germanPreserved: countGerman(before) === countGerman(after)
  };
}

function countGerman(text) {
  return (String(text ?? "").match(/[äöüÄÖÜß]/g) ?? []).length;
}
