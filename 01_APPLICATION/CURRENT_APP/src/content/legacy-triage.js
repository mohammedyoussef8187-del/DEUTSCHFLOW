/*
 * What to do with a legacy vocabulary row, decided in code rather than by a person.
 *
 * The 2820 rows in `data/seed-data.js` were extracted from a spreadsheet, and extraction
 * left residue behind: a workbook cross-reference that ended up inside a German word, a
 * noun merged with the verb example printed beside it, a cell that split in the wrong
 * place. Those rows are not vocabulary and must never reach a learner.
 *
 * The previous arrangement detected some of them and then asked the LEARNER to sort it
 * out — a "Data Quality Review" queue of cards to approve one at a time. That is the wrong
 * shape twice over. It hands an editorial job to somebody who came to study German, and it
 * leaves broken rows live in the meantime, because a flag is not a filter.
 *
 * So every row is classified here, on the way in, into exactly one of four states:
 *
 *   VALID        a real learning object; it goes through untouched
 *   CORRECTED    the intended entry is unambiguous, and is restored from evidence
 *   ARTIFACT     extraction residue — a reference code, a table fragment; excluded
 *   QUARANTINED  broken in a way that cannot be restored confidently; excluded, kept
 *
 * ARTIFACT and QUARANTINED never become learner words. Neither becomes a task for anybody
 * either: the raw row stays exactly as it is in `seed-data.js`, which is the evidence, and
 * this module is the decision about it. Nothing is deleted to make a number look better.
 *
 * WHAT IS DELIBERATELY NOT AN ERROR. An ellipsis is how you write a slot — `von ... bis`,
 * `Was bedeutet ...?`, `zwar ... aber` are patterns a learner is meant to fill in, and the
 * old rule read them as truncation and flagged all eight. Latin letters inside an Arabic
 * gloss are usually right too (`die IBAN`, `der USB-Stick`). Detection here is contextual
 * for that reason: a digit or a slash is only suspicious in company that makes it so.
 */

/** The four states a legacy row can be in. */
export const VERDICT = Object.freeze({
  VALID: "VALID",
  CORRECTED: "CORRECTED",
  ARTIFACT: "ARTIFACT",
  QUARANTINED: "QUARANTINED"
});

/** Verdicts whose rows must not become learner-visible vocabulary. */
export const EXCLUDED_VERDICTS = Object.freeze([VERDICT.ARTIFACT, VERDICT.QUARANTINED]);

import {
  bracketsBalanced, BOOK_REFERENCE, corruptionReasons, REFERENCE_CODE
} from "./content-quality.js";

/**
 * A workbook or table cross-reference sitting inside a German entry.
 *
 * These look like `A/3b`, `B/8c.`, `/i/3b` — a section letter, a slash, an exercise
 * number, sometimes a sub-letter. They are printed in the margin of a course book and the
 * spreadsheet swallowed them into the neighbouring cell.
 *
 * Both halves require a DIGIT beside the slash, and that is what keeps the rule safe.
 * German uses a slash freely for a two-gender noun — `der/die Angestellte`,
 * `die/das Cola`, `die Ja-/Nein-Frage` — and sixteen such entries are in this source.
 * None of them contains a digit anywhere, so none can match, while `A/3b`, `B/8c.` and
 * `/i/3b` all do. The patterns themselves live in `content-quality.js`, so the legacy
 * source and the published curriculum are judged by exactly the same rules.
 */

/**
 * Rows whose intended entry is unambiguous, restored from the row's own evidence.
 *
 * Every correction here has to be readable as an argument, not a preference: what the row
 * says, what went wrong, and why the restored form is the only sensible reading. Anything
 * that needs a guess belongs in QUARANTINED instead, and the list stays short on purpose.
 */
export const CORRECTIONS = Object.freeze({
  1115: {
    german: "der Glaube",
    arabic: "الإيمان؛ الاعتقاد",
    /* The cell merged the noun with the verb example printed next to it —
       "der Glauben (Ich glaube" — losing the closing bracket in the process. The noun is
       the entry; `Ich glaube` is the example. German's noun is `der Glaube` (weak,
       genitive `des Glaubens`), which is also what the Arabic gloss describes. */
    reason: "noun merged with its verb example; the bracket never closed"
  },
  1990: {
    arabic: "حرف الجر المتغيّر (الذي يأخذ النصب أو الجر)",
    /* The gloss left the German stem untranslated — "حرف الجر Wechsel" — which tells an
       Arabic reader nothing. A Wechselpräposition is a preposition that takes either the
       accusative or the dative depending on meaning. */
    reason: "half-translated gloss left the German stem in the Arabic"
  }
});

const text = value => String(value ?? "").trim();

/**
 * Classify one raw legacy row.
 *
 * @param {{id:number, de:string, ar:string, it?:string, art?:string|null}} entry
 * @returns {{verdict:string, german:string, arabic:string, reason:string|null}}
 */
export function triageLegacyEntry(entry) {
  const german = text(entry?.de);
  const arabic = text(entry?.ar);
  const decided = (verdict, reason, over = {}) => ({
    verdict, reason, german: over.german ?? german, arabic: over.arabic ?? arabic
  });

  /* Nothing to teach and nothing to restore from. */
  if (!german || !arabic) {
    return decided(VERDICT.QUARANTINED, "German or Arabic side is empty");
  }

  /*
   * A correction is applied before the damage tests, because the whole point of a
   * correction is that the row's defect is understood — 1115 has an unbalanced bracket
   * and would otherwise be quarantined on that alone.
   */
  const correction = CORRECTIONS[entry?.id];
  if (correction) {
    return decided(VERDICT.CORRECTED, correction.reason, correction);
  }

  /* Extraction residue: diagnosable, and never vocabulary. */
  if (REFERENCE_CODE.test(german) || BOOK_REFERENCE.test(german)) {
    return decided(VERDICT.ARTIFACT, "workbook or table reference inside the entry");
  }

  /*
   * Broken shape with no confident reading. The shared detectors know this project's
   * conventions, so `ab|hauen` and `[dann]` are not mistaken for damage.
   */
  if (!bracketsBalanced(german)) {
    return decided(VERDICT.QUARANTINED, "unbalanced bracket in the German entry");
  }
  const damage = corruptionReasons(german);
  if (damage.length) {
    return decided(VERDICT.QUARANTINED, damage[0]);
  }
  /* Arabic script inside the German side means two columns merged. */
  if (/[؀-ۿ]/.test(german)) {
    return decided(VERDICT.QUARANTINED, "Arabic text inside the German entry");
  }

  return decided(VERDICT.VALID, null);
}

/**
 * Triage a whole legacy source and report what happened to it.
 *
 * @returns {{decisions: Map<number, object>, counts: object, excluded: Set<number>}}
 */
export function triageLegacySource(entries = []) {
  const decisions = new Map();
  const excluded = new Set();
  const counts = { total: 0, VALID: 0, CORRECTED: 0, ARTIFACT: 0, QUARANTINED: 0 };

  for (const entry of entries) {
    const decision = triageLegacyEntry(entry);
    decisions.set(entry.id, decision);
    counts.total += 1;
    counts[decision.verdict] += 1;
    if (EXCLUDED_VERDICTS.includes(decision.verdict)) excluded.add(entry.id);
  }

  return { decisions, counts, excluded };
}
