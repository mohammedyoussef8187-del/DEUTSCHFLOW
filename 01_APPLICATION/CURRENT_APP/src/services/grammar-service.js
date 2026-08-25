/*
 * Grammar content service (Feature B).
 *
 * Grammar is first-class structured content, not prose attached to vocabulary: topics
 * contain rules, rules carry examples, and every human-readable string lives in
 * grammar_texts keyed by (owner, language, kind).
 *
 * Because language is a row rather than a column, English and Arabic are peers by
 * construction: neither is the "default" the other hangs off, a rule explained in only
 * one language is simply not yet translated, and adding a language needs no schema
 * change.
 *
 * Grammar never grades anything here. Assembling an explanation is a teaching concern;
 * any future grammar exercise must still obtain its scoreable answers through the
 * language policy, where Arabic is excluded.
 */

import {
  ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, normalizeLanguage
} from "../content/languages.js";

export const TEXT_KINDS = Object.freeze({
  TITLE: "title",
  SUMMARY: "summary",
  EXPLANATION: "explanation",
  NOTE: "note",
  TRANSLATION: "translation"
});

export const OWNER_TYPES = Object.freeze({
  TOPIC: "topic",
  RULE: "rule",
  EXAMPLE: "example"
});

const notDeleted = row => !row.deleted;
const byOrdering = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0);

/** Group texts by owner, then by kind, then by language. */
function indexTexts(texts) {
  const byOwner = new Map();
  for (const text of (texts ?? []).filter(notDeleted)) {
    const ownerKey = `${text.ownerType}:${text.ownerUuid}`;
    let kinds = byOwner.get(ownerKey);
    if (!kinds) { kinds = new Map(); byOwner.set(ownerKey, kinds); }
    let langs = kinds.get(text.kind);
    if (!langs) { langs = new Map(); kinds.set(text.kind, langs); }
    langs.set(normalizeLanguage(text.language), text);
  }
  return byOwner;
}

/**
 * All languages a piece of text exists in, as a plain object.
 * Absent languages are null rather than missing, so a caller cannot accidentally treat
 * "not translated yet" as "this language does not apply".
 */
function textsFor(index, ownerType, ownerUuid, kind) {
  const langs = index.get(`${ownerType}:${ownerUuid}`)?.get(kind);
  const out = { [GERMAN]: null, [ENGLISH]: null, [ARABIC]: null };
  const provenance = {};
  if (langs) {
    for (const [language, row] of langs) {
      out[language] = row.text;
      provenance[language] = {
        status: row.contentStatus ?? null,
        version: row.contentVersion ?? null,
        sourceType: row.sourceType ?? null,
        verifiedAt: row.verifiedAt ?? null
      };
    }
  }
  return { texts: out, provenance };
}

/** Which support languages actually carry this text. */
function coverageOf(texts) {
  const covered = SUPPORT_LANGUAGES.filter(language => Boolean(texts[language]));
  return {
    [ENGLISH]: Boolean(texts[ENGLISH]),
    [ARABIC]: Boolean(texts[ARABIC]),
    complete: covered.length === SUPPORT_LANGUAGES.length,
    missing: SUPPORT_LANGUAGES.filter(language => !texts[language])
  };
}

/**
 * Assemble the grammar curriculum from a canonical dataset.
 *
 * @param {object} canonical { grammarTopics, grammarRules, grammarExamples, grammarTexts }
 * @returns {Array} topics, ordered, each with ordered rules and examples
 */
export function buildGrammarTopics(canonical = {}) {
  const textIndex = indexTexts(canonical.grammarTexts);
  const rulesByTopic = new Map();
  for (const rule of (canonical.grammarRules ?? []).filter(notDeleted)) {
    const list = rulesByTopic.get(rule.topicUuid);
    if (list) list.push(rule);
    else rulesByTopic.set(rule.topicUuid, [rule]);
  }
  const examplesByRule = new Map();
  for (const example of (canonical.grammarExamples ?? []).filter(notDeleted)) {
    const list = examplesByRule.get(example.ruleUuid);
    if (list) list.push(example);
    else examplesByRule.set(example.ruleUuid, [example]);
  }

  return (canonical.grammarTopics ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(topic => {
      const title = textsFor(textIndex, OWNER_TYPES.TOPIC, topic.uuid, TEXT_KINDS.TITLE);
      const summary = textsFor(textIndex, OWNER_TYPES.TOPIC, topic.uuid, TEXT_KINDS.SUMMARY);

      const rules = (rulesByTopic.get(topic.uuid) ?? []).sort(byOrdering).map(rule => {
        const ruleTitle = textsFor(textIndex, OWNER_TYPES.RULE, rule.uuid, TEXT_KINDS.TITLE);
        const explanation = textsFor(textIndex, OWNER_TYPES.RULE, rule.uuid, TEXT_KINDS.EXPLANATION);

        const examples = (examplesByRule.get(rule.uuid) ?? []).sort(byOrdering).map(example => {
          const translation = textsFor(textIndex, OWNER_TYPES.EXAMPLE, example.uuid, TEXT_KINDS.TRANSLATION);
          return {
            uuid: example.uuid,
            german: example.german,
            translations: translation.texts,
            provenance: translation.provenance,
            coverage: coverageOf(translation.texts)
          };
        });

        return {
          uuid: rule.uuid,
          slug: rule.slug,
          ordering: rule.ordering ?? 0,
          title: ruleTitle.texts,
          explanation: explanation.texts,
          /* How the form is built, when it is used, and what learners get wrong — the
             parts that turn a rule from a label into something that teaches. */
          formation: textsFor(textIndex, OWNER_TYPES.RULE, rule.uuid, "formation").texts,
          usage: textsFor(textIndex, OWNER_TYPES.RULE, rule.uuid, "usage").texts,
          mistake: textsFor(textIndex, OWNER_TYPES.RULE, rule.uuid, "mistake").texts,
          provenance: { title: ruleTitle.provenance, explanation: explanation.provenance },
          contentStatus: rule.contentStatus ?? null,
          examples,
          coverage: coverageOf(explanation.texts)
        };
      });

      return {
        uuid: topic.uuid,
        slug: topic.slug,
        level: topic.level || null,
        category: topic.category ?? null,
        ordering: topic.ordering ?? 0,
        title: title.texts,
        summary: summary.texts,
        contentStatus: topic.contentStatus ?? null,
        rules,
        coverage: coverageOf(title.texts)
      };
    });
}

/** Rules a vocabulary item demonstrates, via the join table. */
export function grammarRulesForVocabulary(canonical = {}, vocabUuid) {
  const links = (canonical.vocabularyGrammar ?? [])
    .filter(notDeleted)
    .filter(link => link.vocabUuid === vocabUuid);
  const wanted = new Set(links.map(link => link.ruleUuid));
  return buildGrammarTopics(canonical)
    .flatMap(topic => topic.rules.map(rule => ({ ...rule, topicSlug: topic.slug })))
    .filter(rule => wanted.has(rule.uuid));
}

/** Repository-backed service. Read-only; grades nothing. */
export function createGrammarService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function loadCanonical() {
    const [grammarTopics, grammarRules, grammarExamples, grammarTexts, vocabularyGrammar] =
      await Promise.all([
        repositories.grammarTopics.all(),
        repositories.grammarRules.all(),
        repositories.grammarExamples.all(),
        repositories.grammarTexts.all(),
        repositories.vocabularyGrammar.all()
      ]);
    return { grammarTopics, grammarRules, grammarExamples, grammarTexts, vocabularyGrammar };
  }

  return Object.freeze({
    async topics() {
      return buildGrammarTopics(await loadCanonical());
    },

    async rulesForVocabulary(vocabUuid) {
      return grammarRulesForVocabulary(await loadCanonical(), vocabUuid);
    },

    /** Where grammar still needs translating, per support language. */
    async coverageReport() {
      const topics = await this.topics();
      const rules = topics.flatMap(topic => topic.rules);
      const count = (list, language) => list.filter(item => item.coverage[language]).length;
      return {
        topics: topics.length,
        rules: rules.length,
        topicsMissing: {
          [ENGLISH]: topics.length - count(topics, ENGLISH),
          [ARABIC]: topics.length - count(topics, ARABIC)
        },
        rulesMissing: {
          [ENGLISH]: rules.length - count(rules, ENGLISH),
          [ARABIC]: rules.length - count(rules, ARABIC)
        }
      };
    }
  });
}
