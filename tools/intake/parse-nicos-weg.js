/*
 * Stage 3 of the intake pipeline: PARSE (Deutsche Welle "Nicos Weg" handouts).
 *
 * Pure: normalized pages in, intermediate records out. It reads the layout this
 * publisher actually prints — a header line naming the course and level, a title line
 * naming the episode, a speaker-labelled dialogue, a vocabulary list of
 * `Stichwort – Arabic` pairs with optional principal parts, and a footer carrying the
 * page number and the source URL.
 *
 * Where the layout does not say something, the record says nothing. A missing English
 * gloss is `null`, not a guess; an exercise with no printed answer key produces options
 * and no expected answer. The parser's job is to read, and reading stops at the edge of
 * the page.
 */

import { normalizePage, isArabic } from "./normalize.js";

const FOOTER = /Deutsch zum Mitnehmen\s*\|\s*(\S+)\s*\|\s*©\s*(.+?)\s*\|\s*Seite\s*(\d+)\s*\/\s*(\d+)/;
const HEADER = /^Nicos Weg\s*[|–-]\s*(A1|A2|B1)/;
const SPEAKER = /^([A-ZÄÖÜ][A-ZÄÖÜa-zäöüß.\s]{1,24}):$/;
const EPISODE = /^([^|]+?)\s*\|\s*(.+)$/;
const EXERCISE = /^Übung\s+(\d+)\s*:\s*(.+)$/;
const VOCAB_ENTRY = /^(.+?)\s+–\s+(.+)$/;
/* A principal-parts line is three comma-separated verb forms, or a comparative pair. */
const PRINCIPAL_PARTS = /^[a-zäöüß|]+\s*(?:\w+\s*)*,\s*[^,]+,\s*(?:ist|hat)\s+\S+$/;
const COMPARATIVE = /^\S+er,\s*am\s+\S+sten$/;

/** Pull the printed page metadata out of a footer line. */
export function parseFooter(text) {
  const match = FOOTER.exec(text);
  if (!match) return null;
  return { reference: match[1], publisher: match[2], page: Number(match[3]), pages: Number(match[4]) };
}

function stripChrome(page) {
  const lines = page.split("\n");
  return lines.filter(line => !FOOTER.test(line) && !HEADER.test(line));
}

/**
 * Parse the manuscript-and-vocabulary handout.
 * @param {object} extraction the artifact written by extract.mjs
 * @param {object} source     the registry entry
 */
export function parseManuscript(extraction, source) {
  const pages = extraction.pages.map(page => ({
    number: page.number,
    footer: parseFooter(page.text),
    text: normalizePage(page.text, { visualOrder: source.arabicVisualOrder === true })
  }));

  const first = pages[0];
  const level = HEADER.exec(extraction.pages[0].text)?.[1] ?? null;

  /*
   * The episode line prints as `Familiengeschichten | (2) العائلة`, but the digit and
   * the parentheses are bidi-mirrored, so in logical order they land AROUND the Arabic:
   * `Familiengeschichten | ( العائلة2)`. The number is therefore taken from wherever it
   * sits in the segment rather than from a fixed position, and the Arabic title is the
   * Arabic run in that same segment.
   */
  let episodeTitle = null;
  let episodeNumber = null;
  let episodeTitleArabic = null;
  /* Over the page WITHOUT its header and footer: the footer also contains a "|" and
     would otherwise be read as the episode title. */
  for (const line of stripChrome(first.text)) {
    const match = EPISODE.exec(line.trim());
    if (!match) continue;
    const german = match[1].trim();
    if (!german || isArabic(german) || /^Nicos Weg/.test(german)) continue;

    const segment = match[2];
    const digits = /(\d+)/.exec(segment);
    const arabic = segment.replace(/[()\d]/g, "").trim();

    episodeTitle = german;
    episodeNumber = digits ? Number(digits[1]) : null;
    episodeTitleArabic = arabic && isArabic(arabic) ? arabic : null;
    break;
  }
  return {
    sourceId: extraction.sourceId,
    digest: extraction.digest,
    course: {
      // Printed in the page header of every page.
      title: "Nicos Weg",
      publisher: source.publisher,
      reference: source.reference,
      cefrLevel: level
    },
    lesson: {
      number: episodeNumber,
      title: episodeTitle,
      titleArabic: episodeTitleArabic,
      // The document names an episode, not a unit hierarchy. Absent stays absent.
      unitTitle: null,
      cefrLevel: level
    },
    transcript: parseTranscript(pages[0]),
    vocabulary: parseVocabulary(pages.slice(1)),
    pages: pages.map(page => ({ number: page.number, footer: page.footer }))
  };
}

/** Speaker-labelled turns, in printed order. */
export function parseTranscript(page) {
  const lines = stripChrome(page.text);
  const turns = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const speaker = SPEAKER.exec(line);
    if (speaker) {
      if (current) turns.push(current);
      current = { speaker: speaker[1].trim(), german: "", page: page.number, ordering: turns.length + 1 };
      continue;
    }
    if (!current) continue;                 // summary prose before the dialogue begins
    if (isArabic(line)) continue;           // the Arabic summary is not a dialogue turn
    current.german = current.german ? `${current.german} ${line}` : line;
  }
  if (current) turns.push(current);

  return turns
    .filter(turn => turn.german)
    .map((turn, index) => ({ ...turn, ordering: index + 1 }));
}

/**
 * `Stichwort – Arabic` entries, with the principal-parts or usage line that follows
 * attached to the entry it belongs to.
 */
export function parseVocabulary(pages) {
  const entries = [];
  for (const page of pages) {
    const lines = stripChrome(page.text);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const match = VOCAB_ENTRY.exec(line);
      if (match && isArabic(match[2]) && !isArabic(match[1])) {
        entries.push({
          headword: match[1].trim(),
          arabic: match[2].trim(),
          // The source prints no English at all. Absent, not empty.
          english: null,
          principalParts: null,
          note: null,
          page: page.number,
          ordering: entries.length + 1
        });
        continue;
      }

      const previous = entries[entries.length - 1];
      if (!previous || isArabic(line)) continue;
      if (PRINCIPAL_PARTS.test(line) || COMPARATIVE.test(line)) previous.principalParts = line;
      else if (line.length <= 40) previous.note = line;
    }
  }
  return entries;
}

/**
 * Parse the teacher's booklet.
 *
 * It prints tasks and, for one of them, a word bank. It prints NO answer key, so every
 * exercise comes out with `expected: null` and the reason recorded. Supplying answers
 * here would be inventing them.
 */
export function parseExercises(extraction, source) {
  const pages = extraction.pages.map(page => ({
    number: page.number,
    footer: parseFooter(page.text),
    text: normalizePage(page.text, { visualOrder: source.arabicVisualOrder === true })
  }));

  const exercises = [];
  for (const page of pages) {
    const lines = stripChrome(page.text);
    let current = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const heading = EXERCISE.exec(line);
      if (heading) {
        if (current) exercises.push(current);
        current = {
          number: Number(heading[1]),
          title: heading[2].trim(),
          instruction: "",
          items: [],
          options: [],
          expected: null,
          expectedAbsentReason: "no-answer-key-in-source",
          page: page.number
        };
        continue;
      }
      if (!current) continue;

      /* A word bank is a pipe-separated run of single words. */
      if (line.includes("|") && !/\d\./.test(line)) {
        for (const option of line.split("|").map(part => part.trim()).filter(Boolean)) {
          if (/^\S+$/.test(option)) current.options.push(option);
        }
        continue;
      }

      const numbered = /^(\d+)\.\s*(.+)$/.exec(line);
      if (numbered) {
        /* A matching task prints its two columns on one line: `1. ich      a) ihr`.
           Both halves are real content, so both are kept, in their own places. */
        const paired = /^(.*?)\s+([a-h])\)\s+(.+)$/.exec(numbered[2]);
        if (paired) {
          current.items.push({ number: Number(numbered[1]), text: paired[1].trim() });
          current.options.push(paired[3].trim());
        } else {
          current.items.push({ number: Number(numbered[1]), text: numbered[2].trim() });
        }
        continue;
      }

      const lettered = /^([a-h])\)\s*(.+)$/.exec(line);
      if (lettered) {
        current.options.push(lettered[2].trim());
        continue;
      }

      current.instruction = current.instruction ? `${current.instruction} ${line}` : line;
    }
    if (current) exercises.push(current);
  }

  const title = pages[0].text.split("\n").map(l => l.trim())
    .find(line => /\(\d+\)/.test(line) && !isArabic(line)) ?? null;

  return {
    sourceId: extraction.sourceId,
    digest: extraction.digest,
    lessonHint: title,
    exercises: exercises.map((exercise, index) => ({ ...exercise, ordering: index + 1 })),
    pages: pages.map(page => ({ number: page.number, footer: page.footer }))
  };
}
