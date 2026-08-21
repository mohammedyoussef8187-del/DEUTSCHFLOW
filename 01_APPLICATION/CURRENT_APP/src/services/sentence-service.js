/*
 * Sentence and context service (Feature C).
 *
 * A sentence is a structured entity, not a string hanging off a word: it owns its German
 * form, its CEFR level and register, its context tags, and its support texts. Vocabulary
 * and grammar attach through many-to-many links, so a sentence belongs to neither
 * exclusively and can illustrate several words and several rules at once.
 *
 * Support texts follow the pattern grammar established — one row per
 * (sentence, language, kind) — so English and Arabic are peers by construction, each
 * with its own verification state, and a third language needs no schema change.
 *
 * Scoring boundary: the ONLY scoreable form of a sentence is its German text. Arabic and
 * English support texts are teaching material. `scoringFormsFor` returns German only and
 * is the single sanctioned way to obtain a gradeable answer from a sentence, so an
 * exercise engine cannot accidentally grade a translation.
 */

import {
  ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, isScoreable, normalizeLanguage
} from "../content/languages.js";

export const SENTENCE_TEXT_KINDS = Object.freeze({
  TRANSLATION: "translation",
  EXPLANATION: "explanation",
  NOTE: "note"
});

const notDeleted = row => !row.deleted;
const byOrdering = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0);

function groupBy(rows, key) {
  const map = new Map();
  for (const row of (rows ?? []).filter(notDeleted)) {
    const id = row[key];
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

/** Every language a given kind of text exists in, with per-language provenance. */
function byLanguage(texts, kind) {
  const values = { [GERMAN]: null, [ENGLISH]: null, [ARABIC]: null };
  const provenance = {};
  for (const row of texts) {
    if (row.kind !== kind) continue;
    const language = normalizeLanguage(row.language);
    values[language] = row.text;
    provenance[language] = {
      status: row.contentStatus ?? null,
      version: row.contentVersion ?? null,
      sourceType: row.sourceType ?? null,
      sourceReference: row.sourceReference ?? null,
      verifiedAt: row.verifiedAt ?? null
    };
  }
  return { values, provenance };
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
 * Assemble full learning sentences from a canonical dataset.
 *
 * @param {object} canonical { sentences, sentenceTexts, sentenceVocabulary,
 *                             sentenceGrammar, sentenceTags, vocabularyItems, grammarRules }
 */
export function buildSentences(canonical = {}) {
  const textsBySentence = groupBy(canonical.sentenceTexts, "sentenceUuid");
  const vocabLinks = groupBy(canonical.sentenceVocabulary, "sentenceUuid");
  const grammarLinks = groupBy(canonical.sentenceGrammar, "sentenceUuid");
  const tagRows = groupBy(canonical.sentenceTags, "sentenceUuid");

  const vocabByUuid = new Map((canonical.vocabularyItems ?? []).map(v => [v.uuid, v]));
  const ruleByUuid = new Map((canonical.grammarRules ?? []).map(r => [r.uuid, r]));

  return (canonical.sentences ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(sentence => {
      const texts = textsBySentence.get(sentence.uuid) ?? [];
      const translation = byLanguage(texts, SENTENCE_TEXT_KINDS.TRANSLATION);
      const explanation = byLanguage(texts, SENTENCE_TEXT_KINDS.EXPLANATION);
      const note = byLanguage(texts, SENTENCE_TEXT_KINDS.NOTE);

      const vocabulary = (vocabLinks.get(sentence.uuid) ?? []).map(link => {
        const item = vocabByUuid.get(link.vocabUuid);
        return {
          vocabUuid: link.vocabUuid,
          role: link.role ?? null,
          german: item?.german ?? null,
          // Resolved lazily: a link can outlive the item only if data is inconsistent,
          // and reporting null is more honest than dropping the link silently.
          resolved: Boolean(item)
        };
      });

      const grammar = (grammarLinks.get(sentence.uuid) ?? []).map(link => {
        const rule = ruleByUuid.get(link.ruleUuid);
        return {
          ruleUuid: link.ruleUuid,
          slug: rule?.slug ?? null,
          topicUuid: rule?.topicUuid ?? null,
          resolved: Boolean(rule)
        };
      });

      return {
        uuid: sentence.uuid,
        german: sentence.german,
        level: sentence.level || null,
        register: sentence.register ?? null,
        ordering: sentence.ordering ?? 0,
        contentStatus: sentence.contentStatus ?? null,
        provenance: {
          sentence: {
            status: sentence.contentStatus ?? null,
            version: sentence.contentVersion ?? null,
            sourceType: sentence.sourceType ?? null,
            sourceReference: sentence.sourceReference ?? null,
            verifiedAt: sentence.verifiedAt ?? null
          },
          translation: translation.provenance,
          explanation: explanation.provenance
        },
        // English and Arabic side by side, same shape, neither nested in the other.
        translations: translation.values,
        explanations: explanation.values,
        notes: note.values,
        tags: (tagRows.get(sentence.uuid) ?? []).map(row => row.tag).sort(),
        vocabulary,
        grammar,
        coverage: coverageOf(translation.values)
      };
    });
}

/**
 * The only gradeable forms of a sentence: German.
 *
 * Support texts are excluded by construction rather than by filtering, and the result is
 * re-checked against the language policy so this cannot drift into grading a translation.
 */
export function scoringFormsFor(sentence) {
  if (!sentence?.german) return [];
  const forms = [{ text: sentence.german, language: GERMAN }];
  return forms.filter(form => isScoreable(form.language));
}

/** Sentences that demonstrate a given vocabulary item. */
export function sentencesForVocabulary(canonical, vocabUuid) {
  return buildSentences(canonical).filter(s => s.vocabulary.some(v => v.vocabUuid === vocabUuid));
}

/** Sentences that illustrate a given grammar rule. */
export function sentencesForGrammarRule(canonical, ruleUuid) {
  return buildSentences(canonical).filter(s => s.grammar.some(g => g.ruleUuid === ruleUuid));
}

/** Repository-backed service. Read-only; grades nothing. */
export function createSentenceService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function loadCanonical() {
    const [
      sentences, sentenceTexts, sentenceVocabulary, sentenceGrammar, sentenceTags,
      vocabularyItems, grammarRules
    ] = await Promise.all([
      repositories.sentences.all(),
      repositories.sentenceTexts.all(),
      repositories.sentenceVocabulary.all(),
      repositories.sentenceGrammar.all(),
      repositories.sentenceTags.all(),
      repositories.vocabulary.all(),
      repositories.grammarRules.all()
    ]);
    return {
      sentences, sentenceTexts, sentenceVocabulary, sentenceGrammar, sentenceTags,
      vocabularyItems, grammarRules
    };
  }

  return Object.freeze({
    async all() {
      return buildSentences(await loadCanonical());
    },

    async byLevel(level) {
      return (await this.all()).filter(s => s.level === level);
    },

    async byTag(tag) {
      return (await this.all()).filter(s => s.tags.includes(tag));
    },

    async forVocabulary(vocabUuid) {
      return sentencesForVocabulary(await loadCanonical(), vocabUuid);
    },

    async forGrammarRule(ruleUuid) {
      return sentencesForGrammarRule(await loadCanonical(), ruleUuid);
    },

    /** Where sentence translation work is still outstanding, per support language. */
    async coverageReport() {
      const all = await this.all();
      const covered = language => all.filter(s => s.coverage[language]).length;
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
