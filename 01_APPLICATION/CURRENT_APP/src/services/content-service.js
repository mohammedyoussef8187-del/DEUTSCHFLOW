/*
 * Multilingual content application service (Feature A).
 *
 * Assembles a vocabulary entry from the canonical model into one object the UI can
 * render: the German target form, the Arabic meaning, the English translation, and the
 * accepted answers — with the scoreable ones kept strictly separate from the rest.
 *
 * Two invariants this module exists to enforce:
 *
 *   1. English and Arabic are peers. Neither is nested inside the other, and a missing
 *      English translation never degrades the Arabic meaning (or vice versa). An entry
 *      with only one support language is complete in that language, not "half broken".
 *
 *      Since schema 11 the tables say this too: a translation hangs off the vocabulary
 *      ITEM, not off the Arabic sense, so an entry whose Arabic is still a draft still
 *      shows its verified English. `meaningUuid` remains as an optional pairing for a
 *      polysemous word and is never consulted to decide whether English exists.
 *
 *   2. Only German and English answers can ever reach a grader. `scoringAnswers` is
 *      filtered through the language policy on the way out, so an Arabic row that was
 *      mis-stored with scoreable=1 still cannot influence correctness.
 *
 * Read-only: it derives views, never writes, and it does not grade anything itself.
 */

import {
  ARABIC, ENGLISH, GERMAN, isScoreable, normalizeLanguage
} from "../content/languages.js";

/** Index rows by a foreign key so assembly does not rescan per item. */
function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = row[key];
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

const notDeleted = row => !row.deleted;

/**
 * Build the multilingual view for every vocabulary item in a canonical dataset.
 *
 * @param {object} canonical { vocabularyItems, vocabularyMeanings, translations, acceptedAnswers }
 * @returns {Array} one entry per vocabulary item
 */
export function buildContentEntries(canonical = {}) {
  const items = (canonical.vocabularyItems ?? []).filter(notDeleted);
  const meaningsByVocab = indexBy((canonical.vocabularyMeanings ?? []).filter(notDeleted), "vocabUuid");
  const translationsByVocab = indexBy((canonical.translations ?? []).filter(notDeleted), "vocabUuid");
  const answersByVocab = indexBy((canonical.acceptedAnswers ?? []).filter(notDeleted), "vocabUuid");

  return items.map(item => {
    const meanings = meaningsByVocab.get(item.uuid) ?? [];
    const translations = translationsByVocab.get(item.uuid) ?? [];
    const answers = answersByVocab.get(item.uuid) ?? [];

    /*
     * Both languages are read from the ITEM and then paired, rather than one being read
     * through the other. Where a translation names the sense it matches, it is shown with
     * that sense; where it does not — the common case, and the only case for a word with
     * one meaning — it belongs to the word and appears whatever the Arabic is doing.
     */
    const pairedTranslations = new Set();
    const senses = meanings.map(meaning => {
      const matching = translations.filter(row => row.meaningUuid === meaning.uuid);
      for (const row of matching) pairedTranslations.add(row.uuid);
      const forSense = matching.length ? matching : unpaired(translations);
      const senseAnswers = answers.filter(answer =>
        answer.meaningUuid === meaning.uuid || answer.meaningUuid == null);
      return senseEntry(meaning, forSense, senseAnswers);
    });

    /*
     * English with no Arabic to sit beside is still English. A word whose Arabic sense is
     * absent or still a draft is presented as an entry that teaches in English only,
     * rather than as an entry with nothing in it.
     */
    const orphanEnglish = translations.filter(row =>
      !pairedTranslations.has(row.uuid) && (!meanings.length || row.meaningUuid == null));
    if (!senses.length && orphanEnglish.length) {
      senses.push(senseEntry(null, orphanEnglish, answers));
    }

    return {
      uuid: item.uuid,
      legacyId: item.legacyId ?? null,
      german: item.german,
      article: item.article ?? null,
      plural: item.plural || null,
      itemType: item.itemType,
      level: item.level || null,
      ignored: Boolean(item.ignored),
      favorite: Boolean(item.favorite),
      senses,
      // Convenience view of the primary sense, since most UI shows one.
      primary: senses[0] ?? null,
      coverage: coverageOf(senses)
    };
  });
}

const unpaired = translations => translations.filter(row => row.meaningUuid == null);

/** One sense: the Arabic side, the English side, and what either may be graded against. */
function senseEntry(meaning, translations, answers) {
  return {
    uuid: meaning?.uuid ?? null,
    // English and Arabic sit side by side, deliberately at the same level.
    arabic: meaning?.arabicText || null,
    english: translations.length ? translations[0].englishText : null,
    englishAll: translations.map(row => row.englishText),
    explanations: {
      [ARABIC]: meaning?.explanation ?? null,
      [ENGLISH]: translations.length ? translations[0].explanation ?? null : null
    },
    pronunciation: meaning?.pronunciation || null,
    provenance: {
      arabic: meaning ? contentProvenance(meaning) : null,
      english: translations.length ? contentProvenance(translations[0]) : null
    },
    answers: partitionAnswers(answers)
  };
}

/** Split accepted answers into what may grade and what may only teach. */
function partitionAnswers(answers) {
  const scoring = [];
  const reference = [];
  for (const answer of answers) {
    const language = normalizeLanguage(answer.language);
    const entry = { text: answer.text, language };
    // Belt and braces: the stored flag AND the policy must agree before an answer can
    // reach a grader, so a bad import cannot make Arabic scoreable.
    if (answer.scoreable && isScoreable(language)) scoring.push(entry);
    else reference.push(entry);
  }
  return { scoring, reference };
}

function contentProvenance(row) {
  return {
    status: row.contentStatus ?? null,
    version: row.contentVersion ?? null,
    sourceType: row.sourceType ?? null,
    sourceReference: row.sourceReference ?? null,
    verifiedAt: row.verifiedAt ?? null
  };
}

/**
 * Which support languages this entry actually teaches in.
 * Reported rather than judged: an entry with Arabic but no English is not an error, it
 * is simply not yet translated, and the content-quality phase decides what to do.
 */
function coverageOf(senses) {
  const hasArabic = senses.some(s => Boolean(s.arabic));
  const hasEnglish = senses.some(s => Boolean(s.english));
  return {
    [GERMAN]: true,
    [ARABIC]: hasArabic,
    [ENGLISH]: hasEnglish,
    complete: hasArabic && hasEnglish
  };
}

/**
 * Every accepted answer that may legitimately decide correctness for an entry.
 * This is the ONLY sanctioned way for a grader to obtain answers from the content model.
 */
export function scoringAnswersFor(entry) {
  if (!entry) return [];
  return entry.senses.flatMap(sense => sense.answers.scoring);
}

/** Repository-backed service. Reads through the canonical repositories only. */
export function createContentService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  return Object.freeze({
    async allEntries() {
      const [vocabularyItems, vocabularyMeanings, translations, acceptedAnswers] = await Promise.all([
        repositories.vocabulary.all(),
        repositories.meanings.all(),
        repositories.translations.all(),
        repositories.acceptedAnswers.all()
      ]);
      return buildContentEntries({ vocabularyItems, vocabularyMeanings, translations, acceptedAnswers });
    },

    /** Coverage summary, for deciding where translation work is still needed. */
    async coverageReport() {
      const entries = await this.allEntries();
      const withEnglish = entries.filter(e => e.coverage[ENGLISH]).length;
      const withArabic = entries.filter(e => e.coverage[ARABIC]).length;
      return {
        total: entries.length,
        [ENGLISH]: withEnglish,
        [ARABIC]: withArabic,
        missingEnglish: entries.length - withEnglish,
        missingArabic: entries.length - withArabic
      };
    }
  });
}
