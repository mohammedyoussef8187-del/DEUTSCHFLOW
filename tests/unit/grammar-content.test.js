/*
 * Feature B — grammar as first-class structured content.
 *
 * Grammar is topics -> rules -> examples, with every human-readable string in
 * grammar_texts keyed by (owner, language, kind). Language being a ROW rather than a
 * column is the point: English and Arabic are peers, and neither is the default the
 * other hangs off.
 */

import { describe, expect, it } from "vitest";
import {
  OWNER_TYPES, TEXT_KINDS, buildGrammarTopics, createGrammarService,
  grammarRulesForVocabulary
} from "../../01_APPLICATION/CURRENT_APP/src/services/grammar-service.js";
import { ARABIC, ENGLISH, GERMAN } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";

const NOW = 1775000000000;
const meta = { contentStatus: "draft", contentVersion: 1, sourceReference: null,
  sourceType: "editorial", verifiedAt: null, verifiedBy: null,
  createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

function text(ownerType, ownerUuid, language, kind, value, extra = {}) {
  return { uuid: `t-${ownerUuid}-${language}-${kind}`, ownerType, ownerUuid, language, kind, text: value, ...meta, ...extra };
}

/** Two topics, deliberately out of order, to prove ordering is applied. */
function canonical() {
  return {
    grammarTopics: [
      { uuid: "topic-2", slug: "praepositionen", level: "A2", category: "syntax", ordering: 2, ...meta },
      { uuid: "topic-1", slug: "artikel", level: "A1", category: "morphology", ordering: 1, ...meta }
    ],
    grammarRules: [
      { uuid: "rule-1b", topicUuid: "topic-1", slug: "definite-article", ordering: 2, ...meta },
      { uuid: "rule-1a", topicUuid: "topic-1", slug: "gender", ordering: 1, ...meta },
      { uuid: "rule-2a", topicUuid: "topic-2", slug: "dative-prepositions", ordering: 1, ...meta }
    ],
    grammarExamples: [
      { uuid: "ex-2", ruleUuid: "rule-1a", german: "die Frau", ordering: 2, ...meta },
      { uuid: "ex-1", ruleUuid: "rule-1a", german: "das Haus", ordering: 1, ...meta }
    ],
    grammarTexts: [
      text(OWNER_TYPES.TOPIC, "topic-1", ENGLISH, TEXT_KINDS.TITLE, "Articles"),
      text(OWNER_TYPES.TOPIC, "topic-1", ARABIC, TEXT_KINDS.TITLE, "أدوات التعريف"),
      text(OWNER_TYPES.TOPIC, "topic-2", ENGLISH, TEXT_KINDS.TITLE, "Prepositions"),
      // topic-2 has no Arabic title yet: not an error, just untranslated.
      text(OWNER_TYPES.RULE, "rule-1a", ENGLISH, TEXT_KINDS.EXPLANATION, "Every noun has a gender."),
      text(OWNER_TYPES.RULE, "rule-1a", ARABIC, TEXT_KINDS.EXPLANATION, "لكل اسم جنس نحوي.",
        { contentStatus: "verified", contentVersion: 3, verifiedAt: NOW }),
      text(OWNER_TYPES.EXAMPLE, "ex-1", ENGLISH, TEXT_KINDS.TRANSLATION, "the house"),
      text(OWNER_TYPES.EXAMPLE, "ex-1", ARABIC, TEXT_KINDS.TRANSLATION, "البيت")
    ],
    vocabularyGrammar: [
      { uuid: "vg-1", vocabUuid: "vocab-1", ruleUuid: "rule-1a", createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 }
    ]
  };
}

describe("grammar structure", () => {
  const topics = buildGrammarTopics(canonical());

  it("returns topics in their authored order, not storage order", () => {
    expect(topics.map(t => t.slug)).toEqual(["artikel", "praepositionen"]);
  });

  it("nests ordered rules under their topic", () => {
    expect(topics[0].rules.map(r => r.slug)).toEqual(["gender", "definite-article"]);
    expect(topics[1].rules.map(r => r.slug)).toEqual(["dative-prepositions"]);
  });

  it("nests ordered examples under their rule", () => {
    expect(topics[0].rules[0].examples.map(e => e.german)).toEqual(["das Haus", "die Frau"]);
  });

  it("carries CEFR level and category on the topic", () => {
    expect(topics[0].level).toBe("A1");
    expect(topics[0].category).toBe("morphology");
    expect(topics[1].level).toBe("A2");
  });
});

describe("English and Arabic are peers", () => {
  const topics = buildGrammarTopics(canonical());

  it("exposes both languages side by side, neither nested in the other", () => {
    expect(topics[0].title[ENGLISH]).toBe("Articles");
    expect(topics[0].title[ARABIC]).toBe("أدوات التعريف");
    // Same shape for both; no "primary" language.
    expect(Object.keys(topics[0].title).sort()).toEqual([ARABIC, ENGLISH, GERMAN].sort());
  });

  it("reports an untranslated language as null rather than omitting it", () => {
    // Omitting would let a caller confuse "not translated" with "not applicable".
    expect(topics[1].title[ENGLISH]).toBe("Prepositions");
    expect(topics[1].title[ARABIC]).toBeNull();
    expect(topics[1].coverage[ARABIC]).toBe(false);
    expect(topics[1].coverage.missing).toEqual([ARABIC]);
  });

  it("treats a fully translated rule as complete", () => {
    const gender = topics[0].rules[0];
    expect(gender.explanation[ENGLISH]).toBe("Every noun has a gender.");
    expect(gender.explanation[ARABIC]).toBe("لكل اسم جنس نحوي.");
    expect(gender.coverage.complete).toBe(true);
  });

  it("lets each language carry its own verification state", () => {
    // The Arabic explanation is verified while the English one is still draft.
    const provenance = topics[0].rules[0].provenance.explanation;
    expect(provenance[ARABIC].status).toBe("verified");
    expect(provenance[ARABIC].version).toBe(3);
    expect(provenance[ENGLISH].status).toBe("draft");
  });

  it("translates examples in both languages", () => {
    const example = topics[0].rules[0].examples[0];
    expect(example.german).toBe("das Haus");
    expect(example.translations[ENGLISH]).toBe("the house");
    expect(example.translations[ARABIC]).toBe("البيت");
    expect(example.coverage.complete).toBe(true);
  });
});

describe("grammar linked to vocabulary", () => {
  it("finds the rules a word demonstrates without either owning the other", () => {
    const rules = grammarRulesForVocabulary(canonical(), "vocab-1");
    expect(rules.map(r => r.slug)).toEqual(["gender"]);
    expect(rules[0].topicSlug).toBe("artikel");
  });

  it("returns nothing for a word with no grammar links", () => {
    expect(grammarRulesForVocabulary(canonical(), "vocab-unknown")).toEqual([]);
  });
});

describe("grammar edge cases", () => {
  it("handles an empty curriculum", () => {
    expect(buildGrammarTopics({})).toEqual([]);
  });

  it("skips soft-deleted topics, rules, examples and texts", () => {
    const data = canonical();
    data.grammarTopics[1].deleted = 1;                       // artikel
    data.grammarExamples[0].deleted = 1;                     // die Frau
    data.grammarTexts[0].deleted = 1;                        // English topic title
    const topics = buildGrammarTopics(data);
    expect(topics.map(t => t.slug)).toEqual(["praepositionen"]);
    expect(topics[0].rules[0].examples).toEqual([]);
  });

  it("tolerates a rule with no texts at all", () => {
    const data = canonical();
    data.grammarTexts = [];
    const rule = buildGrammarTopics(data)[0].rules[0];
    expect(rule.explanation[ENGLISH]).toBeNull();
    expect(rule.coverage.complete).toBe(false);
  });
});

describe("grammar service", () => {
  function repositoriesFor(data) {
    return {
      grammarTopics: { all: async () => data.grammarTopics },
      grammarRules: { all: async () => data.grammarRules },
      grammarExamples: { all: async () => data.grammarExamples },
      grammarTexts: { all: async () => data.grammarTexts },
      vocabularyGrammar: { all: async () => data.vocabularyGrammar }
    };
  }

  it("reads through repositories only", async () => {
    const topics = await createGrammarService(repositoriesFor(canonical())).topics();
    expect(topics).toHaveLength(2);
  });

  it("reports where each language still needs translating", async () => {
    const report = await createGrammarService(repositoriesFor(canonical())).coverageReport();
    expect(report.topics).toBe(2);
    expect(report.rules).toBe(3);
    expect(report.topicsMissing[ARABIC]).toBe(1);   // prepositions
    expect(report.rulesMissing[ENGLISH]).toBe(2);   // only "gender" is explained
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createGrammarService(null)).toThrow(/Repositories are required/);
  });
});
