import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { normalizeArabic, normalizeGerman } from "../../01_APPLICATION/CURRENT_APP/src/core/text.js";
import { levenshtein, validateGermanAnswer } from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";

const settings = { ...DEFAULT_SETTINGS };

describe("legacy answer evaluation characterization", () => {
  it("normalizes German and Arabic text", () => {
    expect(normalizeGerman("  SCHÖN   ! ")).toBe("schön");
    expect(normalizeGerman("Das-Haus", { stripPunctuation: false })).toBe("das-haus");
    expect(normalizeArabic("  إِمْرَأَةٌ،  ")).toBe("امراه");
  });
  it("preserves exact answers and accepted alternatives", () => {
    const word = { german: "das Haus", article: "das", itemType: "noun", acceptedAnswers: ["Haus"] };
    expect(validateGermanAnswer("das Haus", word, settings).type).toBe("perfect");
    expect(validateGermanAnswer("Haus", word, settings).type).toBe("perfect");
    expect(validateGermanAnswer("", word, settings).type).toBe("empty");
  });
  it("characterizes article, punctuation, umlaut, order, and typo outcomes", () => {
    const noun = { german: "das Haus", article: "das", itemType: "noun", acceptedAnswers: [] };
    const word = { german: "groß", itemType: "word", acceptedAnswers: [] };
    const sentence = { german: "Ich lerne Deutsch.", itemType: "sentence", acceptedAnswers: [] };
    expect(validateGermanAnswer("das haus", noun, settings).type).toBe("capitalization");
    expect(validateGermanAnswer("das Haus!", noun, settings).type).toBe("punctuation");
    expect(validateGermanAnswer("Haus", noun, settings).type).toBe("article_missing");
    expect(validateGermanAnswer("gross", word, settings).type).toBe("umlaut_variant");
    expect(validateGermanAnswer("Deutsch lerne Ich", sentence, settings).type).toBe("wrong_order");
    expect(validateGermanAnswer("Ich lerne Deutch", sentence, settings).type).toBe("minor_typo");
  });
  it("keeps Levenshtein behavior stable", () => {
    expect(levenshtein("Haus", "Huas")).toBe(2);
    expect(validateGermanAnswer("fahre", { german: "fahren", itemType: "word" }, settings).type).toBe("minor_typo");
  });
  it("does not treat Arabic as German scoring input", () => {
    expect(validateGermanAnswer("بيت", { german: "Haus", arabic: "بيت", itemType: "word" }, settings).isCorrect).toBe(false);
  });
});
