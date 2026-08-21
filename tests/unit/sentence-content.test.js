/*
 * Feature C — sentences and contextual usage as first-class content.
 *
 * A sentence owns its German form, level, register, tags and support texts, and attaches
 * to vocabulary and grammar through many-to-many links. English and Arabic stay peers,
 * and only German is ever gradeable.
 */

import { describe, expect, it } from "vitest";
import {
  SENTENCE_TEXT_KINDS, buildSentences, createSentenceService, scoringFormsFor,
  sentencesForGrammarRule, sentencesForVocabulary
} from "../../01_APPLICATION/CURRENT_APP/src/services/sentence-service.js";
import { ARABIC, ENGLISH, GERMAN } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const NOW = 1775000000000;
const meta = {
  contentStatus: "draft", contentVersion: 1, sourceReference: null, sourceType: "editorial",
  verifiedAt: null, verifiedBy: null, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0
};
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

function text(sentenceUuid, language, kind, value, extra = {}) {
  return { uuid: `st-${sentenceUuid}-${language}-${kind}`, sentenceUuid, language, kind, text: value, ...meta, ...extra };
}

function canonical() {
  return {
    sentences: [
      { uuid: "s-2", german: "Ich fahre morgen nach Berlin.", normalizedGerman: "ich fahre morgen nach berlin",
        level: "A2", register: "neutral", ordering: 2, ...meta },
      { uuid: "s-1", german: "Das Haus ist groß.", normalizedGerman: "das haus ist gross",
        level: "A1", register: "neutral", ordering: 1, ...meta,
        contentStatus: "verified", contentVersion: 2, sourceType: "textbook",
        sourceReference: "Netzwerk A1 p.42", verifiedAt: NOW }
    ],
    sentenceTexts: [
      text("s-1", ENGLISH, SENTENCE_TEXT_KINDS.TRANSLATION, "The house is big."),
      text("s-1", ARABIC, SENTENCE_TEXT_KINDS.TRANSLATION, "البيت كبير.",
        { contentStatus: "verified", contentVersion: 4, verifiedAt: NOW }),
      text("s-1", ENGLISH, SENTENCE_TEXT_KINDS.EXPLANATION, "Predicative adjectives take no ending."),
      text("s-1", ARABIC, SENTENCE_TEXT_KINDS.NOTE, "الصفة الخبرية لا تُصرَّف."),
      // s-2 has English only: untranslated into Arabic, not broken.
      text("s-2", ENGLISH, SENTENCE_TEXT_KINDS.TRANSLATION, "I am going to Berlin tomorrow.")
    ],
    sentenceVocabulary: [
      { uuid: "sv-1", sentenceUuid: "s-1", vocabUuid: "v-haus", role: "target", ...linkMeta },
      { uuid: "sv-2", sentenceUuid: "s-1", vocabUuid: "v-gross", role: "supporting", ...linkMeta },
      { uuid: "sv-3", sentenceUuid: "s-2", vocabUuid: "v-fahren", role: "target", ...linkMeta }
    ],
    sentenceGrammar: [
      { uuid: "sg-1", sentenceUuid: "s-1", ruleUuid: "rule-adj", ...linkMeta },
      { uuid: "sg-2", sentenceUuid: "s-2", ruleUuid: "rule-adj", ...linkMeta }
    ],
    sentenceTags: [
      { uuid: "tg-1", sentenceUuid: "s-1", tag: "wohnen", ...linkMeta },
      { uuid: "tg-2", sentenceUuid: "s-1", tag: "alltag", ...linkMeta },
      { uuid: "tg-3", sentenceUuid: "s-2", tag: "reisen", ...linkMeta }
    ],
    vocabularyItems: [
      { uuid: "v-haus", german: "das Haus" },
      { uuid: "v-gross", german: "groß" },
      { uuid: "v-fahren", german: "fahren" }
    ],
    grammarRules: [{ uuid: "rule-adj", slug: "predicative-adjectives", topicUuid: "topic-adj" }]
  };
}

describe("sentence structure", () => {
  const sentences = buildSentences(canonical());

  it("returns sentences in authored order", () => {
    expect(sentences.map(s => s.german)).toEqual([
      "Das Haus ist groß.", "Ich fahre morgen nach Berlin."
    ]);
  });

  it("carries CEFR level, register and context tags as structured data", () => {
    expect(sentences[0].level).toBe("A1");
    expect(sentences[0].register).toBe("neutral");
    expect(sentences[0].tags).toEqual(["alltag", "wohnen"]);   // sorted, not a blob
    expect(sentences[1].tags).toEqual(["reisen"]);
  });

  it("exposes sentence-level provenance and verification state", () => {
    const p = sentences[0].provenance.sentence;
    expect(p.status).toBe("verified");
    expect(p.version).toBe(2);
    expect(p.sourceType).toBe("textbook");
    expect(p.sourceReference).toBe("Netzwerk A1 p.42");
    expect(p.verifiedAt).toBe(NOW);
  });
});

describe("English and Arabic remain peers", () => {
  const sentences = buildSentences(canonical());

  it("presents both translations side by side in the same shape", () => {
    expect(sentences[0].translations[ENGLISH]).toBe("The house is big.");
    expect(sentences[0].translations[ARABIC]).toBe("البيت كبير.");
    expect(Object.keys(sentences[0].translations).sort()).toEqual([ARABIC, ENGLISH, GERMAN].sort());
  });

  it("reports a missing translation as null rather than omitting the language", () => {
    expect(sentences[1].translations[ENGLISH]).toBe("I am going to Berlin tomorrow.");
    expect(sentences[1].translations[ARABIC]).toBeNull();
    expect(sentences[1].coverage[ARABIC]).toBe(false);
    expect(sentences[1].coverage.complete).toBe(false);
    expect(sentences[1].coverage.missing).toEqual([ARABIC]);
  });

  it("lets each language hold its own verification state", () => {
    const provenance = sentences[0].provenance.translation;
    expect(provenance[ARABIC].status).toBe("verified");
    expect(provenance[ARABIC].version).toBe(4);
    expect(provenance[ENGLISH].status).toBe("draft");
  });

  it("keeps explanations and notes separate from translations, per language", () => {
    expect(sentences[0].explanations[ENGLISH]).toBe("Predicative adjectives take no ending.");
    expect(sentences[0].explanations[ARABIC]).toBeNull();
    expect(sentences[0].notes[ARABIC]).toBe("الصفة الخبرية لا تُصرَّف.");
    expect(sentences[0].notes[ENGLISH]).toBeNull();
  });
});

describe("Arabic never leaks into scoring", () => {
  const sentences = buildSentences(canonical());

  it("offers only the German sentence as a gradeable form", () => {
    const forms = scoringFormsFor(sentences[0]);
    expect(forms).toEqual([{ text: "Das Haus ist groß.", language: GERMAN }]);
  });

  it("never returns Arabic or English support text as gradeable", () => {
    for (const sentence of sentences) {
      const forms = scoringFormsFor(sentence);
      expect(forms.every(f => f.language === GERMAN)).toBe(true);
      const texts = forms.map(f => f.text);
      expect(texts).not.toContain(sentence.translations[ARABIC]);
      expect(texts).not.toContain(sentence.translations[ENGLISH]);
    }
  });

  it("returns nothing for a sentence with no German form", () => {
    expect(scoringFormsFor(null)).toEqual([]);
    expect(scoringFormsFor({ german: "" })).toEqual([]);
  });
});

describe("links to vocabulary and grammar", () => {
  const data = canonical();
  const sentences = buildSentences(data);

  it("resolves linked vocabulary with its role", () => {
    expect(sentences[0].vocabulary).toEqual([
      { vocabUuid: "v-haus", role: "target", german: "das Haus", resolved: true },
      { vocabUuid: "v-gross", role: "supporting", german: "groß", resolved: true }
    ]);
  });

  it("resolves linked grammar rules back to their topic", () => {
    expect(sentences[0].grammar).toEqual([
      { ruleUuid: "rule-adj", slug: "predicative-adjectives", topicUuid: "topic-adj", resolved: true }
    ]);
  });

  it("reports an unresolvable link instead of silently dropping it", () => {
    const broken = canonical();
    broken.vocabularyItems = [];
    const link = buildSentences(broken)[0].vocabulary[0];
    expect(link.resolved).toBe(false);
    expect(link.german).toBeNull();
    expect(link.vocabUuid).toBe("v-haus");
  });

  it("finds every sentence demonstrating a word, many-to-many in both directions", () => {
    expect(sentencesForVocabulary(data, "v-haus").map(s => s.uuid)).toEqual(["s-1"]);
    expect(sentencesForGrammarRule(data, "rule-adj").map(s => s.uuid)).toEqual(["s-1", "s-2"]);
    expect(sentencesForVocabulary(data, "v-unknown")).toEqual([]);
  });
});

describe("sentence edge cases", () => {
  it("handles an empty dataset", () => {
    expect(buildSentences({})).toEqual([]);
  });

  it("skips soft-deleted sentences, texts, links and tags", () => {
    const data = canonical();
    data.sentences[0].deleted = 1;          // s-2
    data.sentenceTexts[1].deleted = 1;      // Arabic translation of s-1
    data.sentenceTags[0].deleted = 1;       // wohnen
    data.sentenceVocabulary[1].deleted = 1; // groß link
    const sentences = buildSentences(data);

    expect(sentences.map(s => s.uuid)).toEqual(["s-1"]);
    expect(sentences[0].translations[ARABIC]).toBeNull();
    expect(sentences[0].tags).toEqual(["alltag"]);
    expect(sentences[0].vocabulary.map(v => v.vocabUuid)).toEqual(["v-haus"]);
  });

  it("handles a sentence with no texts, links or tags at all", () => {
    const bare = { sentences: [{ uuid: "s-x", german: "Guten Tag.", ordering: 1, ...meta }] };
    const [sentence] = buildSentences(bare);
    expect(sentence.translations[ENGLISH]).toBeNull();
    expect(sentence.tags).toEqual([]);
    expect(sentence.vocabulary).toEqual([]);
    expect(sentence.grammar).toEqual([]);
    expect(scoringFormsFor(sentence)).toHaveLength(1);   // German is still gradeable
  });
});

describe("migration leaves sentence content empty", () => {
  it("fabricates no sentences or translations from legacy data", () => {
    const fixture = {
      words: [{ id: 1, german: "Das ist ein Haus.", arabic: "هذا بيت", itemType: "sentence", level: "A1" }],
      cards: [], attempts: [], settings: null, profile: null
    };
    const { dataset } = migrateToCanonical(fixture, { now: NOW });

    // The legacy model has sentence-TYPE words but no structured sentence entities.
    expect(dataset.sentences).toEqual([]);
    expect(dataset.sentenceTexts).toEqual([]);
    expect(dataset.sentenceVocabulary).toEqual([]);
    expect(dataset.sentenceGrammar).toEqual([]);
    expect(dataset.sentenceTags).toEqual([]);

    // The legacy word itself still migrates normally.
    expect(dataset.vocabularyItems).toHaveLength(1);
    expect(dataset.vocabularyItems[0].itemType).toBe("sentence");
  });
});

describe("sentence service", () => {
  function repositoriesFor(data) {
    return {
      sentences: { all: async () => data.sentences },
      sentenceTexts: { all: async () => data.sentenceTexts },
      sentenceVocabulary: { all: async () => data.sentenceVocabulary },
      sentenceGrammar: { all: async () => data.sentenceGrammar },
      sentenceTags: { all: async () => data.sentenceTags },
      vocabulary: { all: async () => data.vocabularyItems },
      grammarRules: { all: async () => data.grammarRules }
    };
  }

  it("reads through repositories only", async () => {
    expect(await createSentenceService(repositoriesFor(canonical())).all()).toHaveLength(2);
  });

  it("filters by CEFR level and by context tag", async () => {
    const service = createSentenceService(repositoriesFor(canonical()));
    expect((await service.byLevel("A1")).map(s => s.uuid)).toEqual(["s-1"]);
    expect((await service.byTag("reisen")).map(s => s.uuid)).toEqual(["s-2"]);
    expect(await service.byTag("nichts")).toEqual([]);
  });

  it("finds sentences for a word and for a grammar rule", async () => {
    const service = createSentenceService(repositoriesFor(canonical()));
    expect((await service.forVocabulary("v-fahren")).map(s => s.uuid)).toEqual(["s-2"]);
    expect((await service.forGrammarRule("rule-adj"))).toHaveLength(2);
  });

  it("reports outstanding translation work per language", async () => {
    const report = await createSentenceService(repositoriesFor(canonical())).coverageReport();
    expect(report.total).toBe(2);
    expect(report[ENGLISH]).toBe(2);
    expect(report[ARABIC]).toBe(1);
    expect(report.missingArabic).toBe(1);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createSentenceService(null)).toThrow(/Repositories are required/);
  });
});
