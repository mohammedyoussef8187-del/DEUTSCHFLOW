/*
 * Product rule: ARABIC MUST NEVER AFFECT SCORED ANSWER CORRECTNESS.
 *
 * Arabic remains first-class educational content — it is displayed, explained, hinted
 * and used for feedback — but it can no longer decide whether an answer was right, and
 * therefore can no longer move ease, interval, lapses or mastery.
 *
 * German and English keep their deterministic accepted-answer scoring.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateArabicAdvisory, isSelfAssessedSkill, SELF_ASSESSED_SKILLS,
  validateArabicAnswer, validateGermanAnswer, validateArticleAnswer
} from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { isScoreable, ARABIC } from "../../01_APPLICATION/CURRENT_APP/src/content/languages.js";

const APP = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js"), "utf8"
);

const word = {
  id: 1, german: "das Haus", arabic: "بيت", pronunciation: "هاوس",
  itemType: "noun", article: "das", level: "A1",
  acceptedAnswers: ["das Haus", "Haus"],
  acceptedArabicAnswers: ["منزل"]
};

describe("Arabic cannot produce a scored correct result", () => {
  it("returns no correctness verdict at all, even for an exact match", () => {
    const exact = evaluateArabicAdvisory("بيت", word, null, DEFAULT_SETTINGS);
    // Not true, and deliberately not false either: false would lapse the card.
    expect(exact.isCorrect).toBeNull();
    expect(exact.selfAssessed).toBe(true);
    expect(exact.advisoryMatch).toBe(true);   // reported to the learner only
  });

  it("returns no verdict for a wrong answer either", () => {
    const wrong = evaluateArabicAdvisory("سيارة", word, null, DEFAULT_SETTINGS);
    expect(wrong.isCorrect).toBeNull();
    expect(wrong.selfAssessed).toBe(true);
    expect(wrong.advisoryMatch).toBe(false);
  });

  it("contributes nothing to an automatic rating", () => {
    for (const typed of ["بيت", "منزل", "سيارة", ""]) {
      expect(evaluateArabicAdvisory(typed, word, null, DEFAULT_SETTINGS).quality).toBe(0);
    }
  });

  it("is unaffected by the legacy strictArabicAnswers setting for scoring purposes", () => {
    const strict = evaluateArabicAdvisory("بيت", word, null, { ...DEFAULT_SETTINGS, strictArabicAnswers: true });
    const lenient = evaluateArabicAdvisory("بيت", word, null, { ...DEFAULT_SETTINGS, strictArabicAnswers: false });
    // The setting may still tune advisory wording, but neither can score.
    expect(strict.isCorrect).toBeNull();
    expect(lenient.isCorrect).toBeNull();
    expect(strict.selfAssessed && lenient.selfAssessed).toBe(true);
  });

  it("marks recognition as self-assessed", () => {
    expect(isSelfAssessedSkill("recognition")).toBe(true);
    expect(SELF_ASSESSED_SKILLS).toContain("recognition");
    expect(isSelfAssessedSkill("recall")).toBe(false);
    expect(isSelfAssessedSkill("article")).toBe(false);
  });

  it("agrees with the canonical language policy", () => {
    expect(isScoreable(ARABIC)).toBe(false);
  });
});

describe("Arabic is still preserved educationally", () => {
  it("still shows the expected Arabic meaning for display and feedback", () => {
    const result = evaluateArabicAdvisory("سيارة", word, null, DEFAULT_SETTINGS);
    expect(result.correctAnswer).toBe("بيت");
    expect(result.userAnswer).toBe("سيارة");
    expect(result.note).toContain("المعنى");
  });

  it("still recognises accepted Arabic wordings, as advisory feedback", () => {
    expect(evaluateArabicAdvisory("منزل", word, null, DEFAULT_SETTINGS).advisoryMatch).toBe(true);
  });

  it("keeps the underlying matcher available for non-scoring uses", () => {
    // The pure matcher still works; it is simply not wired into scoring.
    expect(validateArabicAnswer("بيت", word, null, DEFAULT_SETTINGS).isCorrect).toBe(true);
  });

  it("still derives the Arabic word-count hint", () => {
    expect(APP).toContain("عدد كلمات المعنى التقريبي");
  });
});

describe("German and English scoring still works", () => {
  it("scores an exact German answer correct", () => {
    const result = validateGermanAnswer("das Haus", word, DEFAULT_SETTINGS);
    expect(result.isCorrect).toBe(true);
    expect(result.quality).toBeGreaterThan(0);
  });

  it("scores a wrong German answer incorrect", () => {
    expect(validateGermanAnswer("das Auto", word, DEFAULT_SETTINGS).isCorrect).toBe(false);
  });

  it("still scores articles", () => {
    expect(validateArticleAnswer("das", word).isCorrect).toBe(true);
    expect(validateArticleAnswer("der", word).isCorrect).toBe(false);
  });
});

describe("the runtime scoring path never grades Arabic", () => {
  it("routes self-assessed skills to the advisory evaluator, not the matcher", () => {
    expect(APP).toContain("isSelfAssessedSkill(q.skill))answer=evaluateArabicAdvisory(");
    // The old scoring call must be gone from the submit path.
    expect(APP).not.toContain('q.skill==="recognition")answer=DF.validateArabicAnswer(');
  });

  it("lets the learner's rating decide, not the matcher", () => {
    expect(APP).toContain("const selfAssessed=r.answer.selfAssessed===true;");
    expect(APP).toContain("selfAssessed?Number(rating||r.suggestedRating||3)");
  });

  it("derives recorded correctness from the learner's rating for self-assessed answers", () => {
    expect(APP).toContain("const correct=selfAssessed?(!r.revealed&&finalRating>=3):r.answer.isCorrect===true;");
  });

  it("suggests a neutral rating rather than one derived from Arabic text", () => {
    expect(APP).toContain("answer.selfAssessed?3:DF.automaticRating(");
  });

  it("still treats a revealed answer as a lapse regardless of skill", () => {
    // Revealing is a learner action, not an Arabic-text decision, so it may still score.
    expect(APP).toContain("const finalRating=r.revealed?1");
  });
});
