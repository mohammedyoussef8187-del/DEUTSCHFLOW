/*
 * What counts as corrupted text in THIS project.
 *
 * Every rule here had to be narrowed at least once, because the obvious version of each
 * one flags something DeutschFlow does on purpose:
 *
 *   `auf|stehen`      the pipe marks a separable verb; it is not a broken table cell
 *   `[dann]`          square brackets mark an optional word in a grammar formation
 *   `von ... bis`     an ellipsis is a slot the learner fills, not a truncation
 *   `der/die Deutsche` a slash joins two genders; sixteen entries rely on it
 *   `die IBAN`        Latin letters inside an Arabic gloss are usually correct
 *
 * A detector that fires on any of those does not find corruption — it manufactures work.
 * So each rule below asks for the company a defect actually keeps: a slash NEXT TO a
 * digit, a pipe NOT between two German letters, a bracket that never closes. The point is
 * to catch the residue extraction leaves behind while leaving the language alone.
 */

/** A workbook or table cross-reference: `A/3b`, `B/8c.`, `/i/3b`. Needs a digit. */
export const REFERENCE_CODE = /\b[A-Za-z]\s*\/\s*\d+[a-z]?\b|\/\s*\d+[a-z]?\b/;

/** A book reference spelled out: `Seite 42`, `Aufgabe 3b`. */
export const BOOK_REFERENCE = /\b(?:seite|aufgabe|lektion|kapitel|übung|modul)\s*\d+/i;

/** Characters no German text uses, and the Unicode replacement character. */
const HARD_DAMAGE = /[<>{}\\^~`]|�/;

/** A pipe that is NOT the separable-verb marker between two German letters. */
const STRAY_PIPE = /(^|[^\p{L}])\|| \|(?=[^\p{L}])|\|$/u;

/** A square bracket that is not a balanced `[optional]` around word characters. */
const STRAY_BRACKET = /\[(?![^\][]*\])|(?<!\[[^\][]*)\]/;

/** A slug printed where a human-readable label belongs: three or more kebab segments. */
export const LOOKS_LIKE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){2,}$/;

/** The two characters `\` and `n`, which mean a newline escape survived into the text. */
const LITERAL_NEWLINE_ESCAPE = String.fromCharCode(92) + "n";

const text = value => String(value ?? "");

/** Brackets of one kind opened and closed the same number of times. */
export function bracketsBalanced(value) {
  const s = text(value);
  return s.split("(").length === s.split(")").length;
}

/**
 * Every reason one learner-facing string looks corrupted. Empty means it is fine.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function corruptionReasons(value) {
  const s = text(value);
  const reasons = [];
  if (!s.trim()) return reasons;

  if (REFERENCE_CODE.test(s)) reasons.push("workbook or table reference code");
  if (BOOK_REFERENCE.test(s)) reasons.push("book reference inside learner text");
  if (HARD_DAMAGE.test(s)) reasons.push("characters German never uses");
  if (STRAY_PIPE.test(s)) reasons.push("stray pipe outside a separable-verb marker");
  if (STRAY_BRACKET.test(s)) reasons.push("unclosed square bracket");
  if (!bracketsBalanced(s)) reasons.push("unbalanced round bracket");
  if (s.includes(LITERAL_NEWLINE_ESCAPE)) reasons.push("literal newline escape");
  if (LOOKS_LIKE_SLUG.test(s.trim())) reasons.push("slug shown as learner text");
  return reasons;
}

export const isCorrupted = value => corruptionReasons(value).length > 0;

/**
 * Pull out every string a learner can read, with where it came from.
 *
 * Reading the dataset generically rather than naming each table means a field added later
 * is inspected the day it appears, instead of the day somebody remembers to list it.
 *
 * @param {object} entities entity name → rows
 * @returns {Array<{entity:string, field:string, uuid:string, value:string}>}
 */
export const LEARNER_TEXT_FIELDS = Object.freeze([
  "text", "german", "arabicText", "englishText", "plural", "article"
]);

export function learnerStrings(entities = {}) {
  const out = [];
  for (const [entity, rows] of Object.entries(entities)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row?.deleted) continue;
      for (const field of LEARNER_TEXT_FIELDS) {
        const value = row?.[field];
        if (typeof value === "string" && value.trim()) {
          out.push({ entity, field, uuid: row.uuid, value });
        }
      }
    }
  }
  return out;
}

/**
 * Every corrupted learner-facing string in a dataset.
 *
 * @returns {Array<{entity:string, field:string, uuid:string, value:string, reasons:string[]}>}
 */
export function findCorruptedStrings(entities = {}) {
  const found = [];
  for (const entry of learnerStrings(entities)) {
    const reasons = corruptionReasons(entry.value);
    if (reasons.length) found.push({ ...entry, reasons });
  }
  return found;
}

/**
 * Vocabulary rows that are the same word twice within one level.
 *
 * A word taught in two lessons is ONE row referenced twice, which is the point of
 * deterministic identity and is not duplication. Two ROWS carrying the same German and the
 * same meaning at the same level are — though where they carry different provenance, they
 * are two sources that happen to agree, and removing either would drop an attribution.
 *
 * @returns {Array<{german:string, level:string, uuids:string[], sameSource:boolean}>}
 */
export function findDuplicateVocabulary(entities = {}) {
  const alive = rows => (rows ?? []).filter(row => !row.deleted);
  const meanings = new Map();
  for (const row of alive(entities.vocabularyMeanings)) meanings.set(row.vocabUuid, row.arabicText);

  const groups = new Map();
  for (const row of alive(entities.vocabularyItems)) {
    const key = `${row.level}|${String(row.german ?? "").toLowerCase()}|${meanings.get(row.uuid) ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicates = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const sources = new Set(rows.map(row => row.sourceType));
    duplicates.push({
      german: rows[0].german,
      level: rows[0].level,
      uuids: rows.map(row => row.uuid),
      sameSource: sources.size === 1
    });
  }
  return duplicates;
}
