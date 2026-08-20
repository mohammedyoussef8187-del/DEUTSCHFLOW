import { describe, expect, it } from "vitest";
import { loadLegacyCore } from "../support/load-legacy-core.js";

const DF = loadLegacyCore();
const settings = { ...DF.DEFAULT_SETTINGS };

describe("legacy answer evaluation characterization", () => {
  it("normalizes German and Arabic text", () => {
    expect(DF.normalizeGerman("  SCHÖN   ! ")).toBe("schön");
    expect(DF.normalizeGerman("Das-Haus", { stripPunctuation: false })).toBe("das-haus");
    expect(DF.normalizeArabic("  إِمْرَأَةٌ،  ")).toBe("امراه");
  });
  it("preserves exact answers and accepted alternatives", () => {
    const word = { german: "das Haus", article: "das", itemType: "noun", acceptedAnswers: ["Haus"] };
    expect(DF.validateGermanAnswer("das Haus", word, settings).type).toBe("perfect");
    expect(DF.validateGermanAnswer("Haus", word, settings).type).toBe("perfect");
    expect(DF.validateGermanAnswer("", word, settings).type).toBe("empty");
  });
  it("characterizes article, punctuation, umlaut, order, and typo outcomes", () => {
    const noun = { german: "das Haus", article: "das", itemType: "noun", acceptedAnswers: [] };
    const word = { german: "groß", itemType: "word", acceptedAnswers: [] };
    const sentence = { german: "Ich lerne Deutsch.", itemType: "sentence", acceptedAnswers: [] };
    expect(DF.validateGermanAnswer("das haus", noun, settings).type).toBe("capitalization");
    expect(DF.validateGermanAnswer("das Haus!", noun, settings).type).toBe("punctuation");
    expect(DF.validateGermanAnswer("Haus", noun, settings).type).toBe("article_missing");
    expect(DF.validateGermanAnswer("gross", word, settings).type).toBe("umlaut_variant");
    expect(DF.validateGermanAnswer("Deutsch lerne Ich", sentence, settings).type).toBe("wrong_order");
    expect(DF.validateGermanAnswer("Ich lerne Deutch", sentence, settings).type).toBe("minor_typo");
  });
  it("keeps Levenshtein behavior stable", () => {
    expect(DF.levenshtein("Haus", "Huas")).toBe(2);
    expect(DF.validateGermanAnswer("fahre", { german: "fahren", itemType: "word" }, settings).type).toBe("minor_typo");
  });
  it("does not treat Arabic as German scoring input", () => {
    expect(DF.validateGermanAnswer("بيت", { german: "Haus", arabic: "بيت", itemType: "word" }, settings).isCorrect).toBe(false);
  });
});
