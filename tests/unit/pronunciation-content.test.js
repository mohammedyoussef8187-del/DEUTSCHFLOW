/*
 * Feature H — pronunciation.
 *
 * The rule this suite defends hardest: producing speech is SELF-ASSESSED and
 * discriminating sounds is SCOREABLE, and the two never blur. No machine verdict about
 * how someone said a word may become correctness, an SRS input, or an error pattern.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FEATURE_KINDS, OWNER_TYPES, PRACTICE_MODES, PRONUNCIATION_CONTENT_TYPE, PRONUNCIATION_SKILL,
  PRONUNCIATION_TEXT_KINDS, SELF_RATINGS, TARGET_TYPES,
  assessSpokenAttempt, attemptsFor, buildPronunciation, buildPronunciationAttempt,
  createPronunciationService, expectedAnswersForPronunciation, gradeabilityOf, isGradeable,
  isSelfAssessedMode, offlineReady, pronunciationErrorContext, pronunciationForTarget,
  summarizeAttempts, syllablesOf, variantsInOrder
} from "../../01_APPLICATION/CURRENT_APP/src/services/pronunciation-service.js";
import { AUDIO_AVAILABILITY } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";
import { buildExercises } from "../../01_APPLICATION/CURRENT_APP/src/services/exercise-service.js";
import {
  ERROR_SOURCES, aggregatePatterns, recordEvaluation
} from "../../01_APPLICATION/CURRENT_APP/src/services/error-service.js";
import { buildCurriculum, CONTENT_TYPES } from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";
import {
  SELF_ASSESSED_SKILLS, isSelfAssessedSkill, validateGermanAnswer
} from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const NOW = 1775000000000;
const DAY = 86400000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, sourceReference: null, sourceType: "reference",
  verifiedAt: NOW, verifiedBy: "author", createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (ownerType, ownerUuid, language, kind, value) =>
  ({ uuid: `pt-${ownerUuid}-${language}-${kind}`, ownerType, ownerUuid, language, kind, text: value, ...meta });

function canonical(over = {}) {
  return {
    audioAssets: [
      { uuid: "a-model", slug: "ue-model", availability: AUDIO_AVAILABILITY.BUNDLED,
        localPath: "audio/ue.mp3", sourcePath: "", remoteUrl: null, mimeType: "audio/mpeg",
        byteSize: 1000, durationMs: 1500, ...meta },
      { uuid: "a-remote", slug: "oe-model", availability: AUDIO_AVAILABILITY.REMOTE,
        localPath: "", sourcePath: "", remoteUrl: "https://example.invalid/oe.mp3",
        mimeType: "audio/mpeg", byteSize: 1000, durationMs: 1200, ...meta }
    ],
    pronunciationFeatures: [
      { uuid: "f-ue", slug: "front-rounded-u", featureKind: FEATURE_KINDS.PHONEME, ipa: "yː",
        level: "A1", ordering: 1, ...meta },
      { uuid: "f-stress", slug: "compound-stress", featureKind: FEATURE_KINDS.STRESS, ipa: "",
        level: "A2", ordering: 2, ...meta }
    ],
    pronunciationTexts: [
      text(OWNER_TYPES.FEATURE, "f-ue", "en", PRONUNCIATION_TEXT_KINDS.NAME, "Front rounded ü"),
      text(OWNER_TYPES.FEATURE, "f-ue", "ar", PRONUNCIATION_TEXT_KINDS.NAME, "الضمة الأمامية ü"),
      text(OWNER_TYPES.FEATURE, "f-ue", "ar", PRONUNCIATION_TEXT_KINDS.ADVICE, "قل «i» ثم دوّر شفتيك."),
      text(OWNER_TYPES.ITEM, "pi-1", "ar", PRONUNCIATION_TEXT_KINDS.INSTRUCTION, "استمع ثم كرّر مرتين."),
      text(OWNER_TYPES.FEATURE, "f-stress", "en", PRONUNCIATION_TEXT_KINDS.NAME, "Compound stress")
      // f-stress has no Arabic name: untranslated, not broken.
    ],
    pronunciationItems: [
      { uuid: "pi-2", slug: "hoeren-lesen", featureUuid: "f-stress",
        practiceMode: PRACTICE_MODES.READ_ALOUD, targetType: TARGET_TYPES.SENTENCE,
        targetUuid: "s-1", modelAudioUuid: "a-remote", level: "A2", ordering: 2, ...meta },
      { uuid: "pi-1", slug: "buecher", featureUuid: "f-ue",
        practiceMode: PRACTICE_MODES.LISTEN_REPEAT, targetType: TARGET_TYPES.VOCABULARY,
        targetUuid: "v-buch", modelAudioUuid: "a-model", level: "A1", ordering: 1, ...meta },
      { uuid: "pi-3", slug: "ue-vs-u", featureUuid: "f-ue",
        practiceMode: PRACTICE_MODES.DISCRIMINATE, targetType: "", targetUuid: "",
        modelAudioUuid: null, level: "A1", ordering: 3, ...meta }
    ],
    pronunciationVariants: [
      { uuid: "pv-2", itemUuid: "pi-1", ipa: "ˈbyːxɐ", syllables: "Bü·cher", stressIndex: 0,
        variety: "de-AT", isPrimary: 0, audioUuid: null, ordering: 2, ...meta },
      { uuid: "pv-1", itemUuid: "pi-1", ipa: "ˈbyːçɐ", syllables: "Bü·cher", stressIndex: 0,
        variety: "de-DE", isPrimary: 1, audioUuid: "a-model", ordering: 1, ...meta }
    ],
    pronunciationPairs: [
      { uuid: "pp-1", featureUuid: "f-ue", aText: "Bücher", aVocabUuid: "v-buch", aAudioUuid: "a-model",
        bText: "Bucher", bVocabUuid: null, bAudioUuid: null, ordering: 1, ...meta },
      { uuid: "pp-2", featureUuid: "f-ue", aText: "Mütter", aVocabUuid: null, aAudioUuid: null,
        bText: "Mutter", bVocabUuid: null, bAudioUuid: null, ordering: 2, ...meta }
    ],
    pronunciationLinks: [
      { uuid: "pl-1", itemUuid: "pi-1", targetType: TARGET_TYPES.VOCABULARY, targetUuid: "v-buch", ordering: 1, ...linkMeta },
      { uuid: "pl-2", itemUuid: "pi-1", targetType: TARGET_TYPES.LISTENING, targetUuid: "li-1", ordering: 1, ...linkMeta },
      { uuid: "pl-3", itemUuid: "pi-3", targetType: TARGET_TYPES.EXERCISE, targetUuid: "x-de", ordering: 1, ...linkMeta },
      { uuid: "pl-4", itemUuid: "pi-3", targetType: TARGET_TYPES.EXERCISE, targetUuid: "x-ar", ordering: 2, ...linkMeta },
      { uuid: "pl-5", itemUuid: "pi-1", targetType: TARGET_TYPES.EXERCISE, targetUuid: "x-de", ordering: 2, ...linkMeta }
    ],
    pronunciationAttempts: [],
    ...over
  };
}

const items = (over = {}) => buildPronunciation(canonical(over));
const bySlug = slug => items().find(item => item.slug === slug);

/* --------------------------------------------------------------- structure */

describe("pronunciation structure", () => {
  it("assembles items in authored order", () => {
    expect(items().map(i => i.slug)).toEqual(["buecher", "hoeren-lesen", "ue-vs-u"]);
  });

  it("carries the feature, its IPA and its kind", () => {
    expect(bySlug("buecher").feature).toMatchObject({
      slug: "front-rounded-u", kind: FEATURE_KINDS.PHONEME, ipa: "yː"
    });
    expect(bySlug("hoeren-lesen").feature.kind).toBe(FEATURE_KINDS.STRESS);
  });

  it("carries level, practice mode and content type", () => {
    expect(bySlug("buecher")).toMatchObject({
      level: "A1", practiceMode: PRACTICE_MODES.LISTEN_REPEAT,
      contentType: PRONUNCIATION_CONTENT_TYPE, skill: PRONUNCIATION_SKILL
    });
  });

  it("keeps an explicit target alongside typed links", () => {
    expect(bySlug("buecher").target).toEqual({ type: "vocabulary", uuid: "v-buch" });
    expect(bySlug("buecher").listening.map(l => l.uuid)).toEqual(["li-1"]);
  });

  it("finds items practising a piece of content, by target or by link", () => {
    const all = items();
    expect(pronunciationForTarget(all, TARGET_TYPES.VOCABULARY, "v-buch").map(i => i.slug))
      .toEqual(["buecher"]);
    expect(pronunciationForTarget(all, TARGET_TYPES.LISTENING, "li-1").map(i => i.slug))
      .toEqual(["buecher"]);
    expect(pronunciationForTarget(all, TARGET_TYPES.SENTENCE, "s-1").map(i => i.slug))
      .toEqual(["hoeren-lesen"]);
    expect(pronunciationForTarget(all, TARGET_TYPES.VOCABULARY, "nope")).toEqual([]);
  });

  it("handles an item with no feature", () => {
    const data = canonical();
    data.pronunciationItems.find(i => i.uuid === "pi-1").featureUuid = null;
    const item = buildPronunciation(data).find(i => i.slug === "buecher");
    expect(item.feature).toBeNull();
    expect(item.pairs).toEqual([]);
  });

  it("skips soft-deleted rows at every level", () => {
    const data = canonical();
    data.pronunciationItems[0].deleted = 1;       // hoeren-lesen
    data.pronunciationVariants[0].deleted = 1;    // the de-AT variant
    data.pronunciationPairs[1].deleted = 1;       // Mütter/Mutter
    const built = buildPronunciation(data);
    expect(built.map(i => i.slug)).toEqual(["buecher", "ue-vs-u"]);
    expect(built[0].variants.map(v => v.variety)).toEqual(["de-DE"]);
    expect(built[0].pairs.map(p => p.uuid)).toEqual(["pp-1"]);
  });

  it("handles an empty catalogue", () => {
    expect(buildPronunciation({})).toEqual([]);
  });
});

/* ------------------------------------------------------------ multilingual */

describe("English and Arabic are peers", () => {
  it("gives a feature a name in both support languages", () => {
    expect(bySlug("buecher").feature.name).toEqual({
      de: null, en: "Front rounded ü", ar: "الضمة الأمامية ü"
    });
    expect(bySlug("buecher").feature.coverage.complete).toBe(true);
  });

  it("reports a missing language as null and names it", () => {
    const stress = bySlug("hoeren-lesen").feature;
    expect(stress.name.ar).toBeNull();
    expect(stress.coverage.missing).toEqual(["ar"]);
  });

  it("allows Arabic-only advice and instructions without Arabic gaining another role", () => {
    expect(bySlug("buecher").feature.advice.ar).toBe("قل «i» ثم دوّر شفتيك.");
    expect(bySlug("buecher").feature.advice.en).toBeNull();
    expect(bySlug("buecher").instruction.ar).toBe("استمع ثم كرّر مرتين.");
  });
});

/* --------------------------------------------------------------- variants */

describe("authored realizations", () => {
  it("puts the primary variety first, then authored order", () => {
    expect(bySlug("buecher").variants.map(v => v.variety)).toEqual(["de-DE", "de-AT"]);
    expect(bySlug("buecher").primaryVariant.ipa).toBe("ˈbyːçɐ");
  });

  it("orders deterministically when nothing is primary", () => {
    const tied = [
      { uuid: "b", variety: "de-CH", ordering: 1 },
      { uuid: "a", variety: "de-AT", ordering: 1 },
      { uuid: "c", variety: "de-AT", ordering: 1 }
    ];
    expect(variantsInOrder(tied).map(v => v.uuid)).toEqual(["a", "c", "b"]);
    expect(variantsInOrder(tied).map(v => v.uuid)).toEqual(variantsInOrder(tied).map(v => v.uuid));
  });

  it("splits syllables and marks the stressed one", () => {
    expect(bySlug("buecher").primaryVariant.syllables).toEqual([
      { text: "Bü", stressed: true }, { text: "cher", stressed: false }
    ]);
    expect(syllablesOf({ syllables: "Ver-si-che-rung", stressIndex: 2 })[2])
      .toEqual({ text: "che", stressed: true });
    expect(syllablesOf({ syllables: "" })).toEqual([]);
    expect(syllablesOf(null)).toEqual([]);
  });

  it("carries a per-variant model recording when there is one", () => {
    expect(bySlug("buecher").variants[0].audio.playableOffline).toBe(true);
    expect(bySlug("buecher").variants[1].audio.missingReason).toBe("no-audio");
  });
});

/* ----------------------------------------------------------- minimal pairs */

describe("minimal pairs", () => {
  it("lists the feature's pairs in order with both sides", () => {
    const pairs = bySlug("ue-vs-u").pairs;
    expect(pairs.map(p => [p.a.text, p.b.text])).toEqual([["Bücher", "Bucher"], ["Mütter", "Mutter"]]);
    expect(pairs[0].a.vocabUuid).toBe("v-buch");
    expect(pairs[0].a.audio.playableOffline).toBe(true);
    expect(pairs[0].b.audio.missingReason).toBe("no-audio");
  });

  it("shares pairs across every item training the same feature", () => {
    expect(bySlug("buecher").pairs.map(p => p.uuid)).toEqual(["pp-1", "pp-2"]);
  });
});

/* ------------------------------------------------------------------ audio */

describe("offline-first model audio", () => {
  it("treats a bundled model recording as playable offline", () => {
    expect(bySlug("buecher").hasModelAudio).toBe(true);
    expect(bySlug("buecher").modelAudio.localPath).toBe("audio/ue.mp3");
  });

  it("does not treat a remote model recording as available", () => {
    expect(bySlug("hoeren-lesen").hasModelAudio).toBe(false);
    expect(bySlug("hoeren-lesen").modelAudio.missingReason).toBe("remote-only");
    expect(bySlug("hoeren-lesen").modelAudio.localPath).toBeNull();
  });

  it("still counts an item as practisable from its IPA when audio is missing", () => {
    const ready = offlineReady(items()).map(i => i.slug);
    expect(ready).toContain("buecher");         // has local audio
    expect(ready).not.toContain("ue-vs-u");     // no audio and no IPA
  });

  it("treats a model recording as a teaching aid, not a precondition", () => {
    const data = canonical();
    data.pronunciationItems.find(i => i.uuid === "pi-1").modelAudioUuid = null;
    const item = buildPronunciation(data).find(i => i.slug === "buecher");
    expect(item.hasModelAudio).toBe(false);
    expect(item.primaryVariant.ipa).toBe("ˈbyːçɐ");     // still teachable
    expect(offlineReady([item])).toHaveLength(1);
  });
});

/* ------------------------------------------- speech is never machine-graded */

describe("producing speech is self-assessed", () => {
  it("marks production modes self-assessed and discrimination scoreable", () => {
    expect(bySlug("buecher").selfAssessed).toBe(true);
    expect(bySlug("hoeren-lesen").selfAssessed).toBe(true);
    expect(bySlug("ue-vs-u").selfAssessed).toBe(false);
    expect(isSelfAssessedMode(PRACTICE_MODES.SHADOWING)).toBe(true);
    expect(isSelfAssessedMode(PRACTICE_MODES.DISCRIMINATE)).toBe(false);
  });

  it("is registered in the evaluator's single list of self-assessed skills", () => {
    expect(SELF_ASSESSED_SKILLS).toContain("pronunciation");
    expect(isSelfAssessedSkill(PRONUNCIATION_SKILL)).toBe(true);
    // The existing self-assessed skill is untouched.
    expect(SELF_ASSESSED_SKILLS).toContain("recognition");
    expect(isSelfAssessedSkill("recall")).toBe(false);
  });

  it("returns isCorrect: null for a spoken attempt, never false", () => {
    const result = assessSpokenAttempt({ selfRating: SELF_RATINGS.GOOD });
    expect(result.isCorrect).toBeNull();      // false would lapse a card for an accent
    expect(result).toMatchObject({ selfAssessed: true, quality: 0, selfRating: 3 });
  });

  it("keeps a recognizer's opinion as advice with its source named", () => {
    const result = assessSpokenAttempt({ selfRating: 2, advisoryScore: 0.71, advisorySource: "asr" });
    expect(result.advisory).toEqual({ score: 0.71, source: "asr" });
    expect(result.isCorrect).toBeNull();
    expect(result.quality).toBe(0);
  });

  it("clamps an out-of-range advisory score and rating", () => {
    expect(assessSpokenAttempt({ selfRating: 99, advisoryScore: 5 }))
      .toMatchObject({ selfRating: 4, advisory: { score: 1 } });
    expect(assessSpokenAttempt({ selfRating: -3, advisoryScore: -1 }))
      .toMatchObject({ selfRating: 0, advisory: { score: 0 } });
    expect(assessSpokenAttempt({}).advisory).toBeNull();
  });

  it("has no column anywhere for a machine verdict of correctness", async () => {
    const { TABLE_SPECS } = await import("../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js");
    const attempts = TABLE_SPECS.find(spec => spec.entity === "pronunciationAttempts");
    const columns = attempts.columns.map(([column]) => column);
    for (const forbidden of ["correct", "scored", "quality", "is_correct", "passed"]) {
      expect(columns, `pronunciation_attempts must not have ${forbidden}`).not.toContain(forbidden);
    }
    expect(columns).toContain("self_rating");
    expect(columns).toContain("advisory_score");
    expect(columns).toContain("advisory_source");
  });
});

/* ----------------------------------------------------------------- scoring */

describe("scoring goes through the existing evaluator only", () => {
  const exercises = buildExercises({
    exercises: [
      { uuid: "x-de", slug: "hear-ue", exerciseType: "multiple_choice", level: "A1",
        ordering: 1, answerLanguage: "de", ...meta },
      { uuid: "x-ar", slug: "meaning", exerciseType: "type_answer", level: "A1",
        ordering: 2, answerLanguage: "ar", ...meta }
    ],
    exerciseTexts: [],
    exerciseOptions: [
      { uuid: "o-1", exerciseUuid: "x-de", text: "Bücher", language: "de",
        isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta },
      { uuid: "o-2", exerciseUuid: "x-de", text: "Bucher", language: "de",
        isExpected: 0, scoreable: 1, ordering: 2, ...linkMeta },
      // Authored as expected AND scoreable in Arabic: the policy must still refuse it.
      { uuid: "o-3", exerciseUuid: "x-ar", text: "كتب", language: "ar",
        isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta }
    ],
    exerciseTargets: []
  });

  it("scores a discrimination item through its linked German exercise", () => {
    const answers = expectedAnswersForPronunciation(bySlug("ue-vs-u"), exercises);
    expect(answers.map(a => a.text)).toEqual(["Bücher"]);
    expect(isGradeable(bySlug("ue-vs-u"), exercises)).toBe(true);
  });

  it("refuses to grade a production item even when an exercise is linked", () => {
    // pi-1 links x-de too, but saying a word is not answering a question.
    expect(expectedAnswersForPronunciation(bySlug("buecher"), exercises)).toEqual([]);
    expect(gradeabilityOf(bySlug("buecher"), exercises))
      .toEqual({ gradeable: false, reason: "spoken-answer-is-self-assessed" });
  });

  it("cannot make Arabic scoreable by routing it through pronunciation", () => {
    const answers = expectedAnswersForPronunciation(bySlug("ue-vs-u"), exercises);
    expect(answers.some(a => a.language === "ar")).toBe(false);
  });

  it("names why an item cannot be graded instead of returning a bare empty list", () => {
    const data = canonical();
    data.pronunciationLinks = data.pronunciationLinks.filter(l => l.targetUuid !== "x-de");
    const item = buildPronunciation(data).find(i => i.slug === "ue-vs-u");
    expect(gradeabilityOf(item, exercises))
      .toEqual({ gradeable: false, reason: "no-scoreable-expected-answer" });
    expect(gradeabilityOf(null, exercises)).toEqual({ gradeable: false, reason: "no-item" });
  });

  it("implements no answer matching of its own", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/pronunciation-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["levenshtein", "normalizegerman", "validategerman", "acceptedanswers"]) {
      expect(code, `must not implement ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).toContain('import { expectedAnswersFor } from "./exercise-service.js"');
  });
});

/* -------------------------------------------------------------- attempts */

describe("spoken attempts", () => {
  const context = { profileUuid: PROFILE, itemUuid: "pi-1", occurredAt: NOW };

  it("records the learner's own rating and nothing about correctness", () => {
    const attempt = buildPronunciationAttempt({ ...context, selfRating: SELF_RATINGS.GOOD }, { now: NOW });
    expect(attempt).toMatchObject({ profileUuid: PROFILE, itemUuid: "pi-1", selfRating: 3, occurredAt: NOW });
    expect(attempt).not.toHaveProperty("correct");
    expect(attempt).not.toHaveProperty("scored");
    expect(attempt.advisoryScore).toBeNull();
  });

  it("refuses an advisory score with no named source", () => {
    const attempt = buildPronunciationAttempt(
      { ...context, selfRating: 3, advisoryScore: 0.8 }, { now: NOW });
    expect(attempt.advisoryScore).toBe(0.8);
    expect(attempt.advisorySource).toBeNull();     // recorded, but not attributed
    const attributed = buildPronunciationAttempt(
      { ...context, selfRating: 3, advisoryScore: 0.8, advisorySource: "asr" }, { now: NOW });
    expect(attributed.advisorySource).toBe("asr");
  });

  it("drops a source when there is no score to attribute it to", () => {
    const attempt = buildPronunciationAttempt(
      { ...context, selfRating: 3, advisorySource: "asr" }, { now: NOW });
    expect(attempt.advisoryScore).toBeNull();
    expect(attempt.advisorySource).toBeNull();
  });

  it("is idempotent for the same attempt", () => {
    const a = buildPronunciationAttempt({ ...context, selfRating: 3 }, { now: NOW });
    const b = buildPronunciationAttempt({ ...context, selfRating: 4 }, { now: NOW + 9000 });
    expect(b.uuid).toBe(a.uuid);
  });

  it("summarizes a learner's own history without mixing in advisory scores", () => {
    const attempts = [
      buildPronunciationAttempt({ ...context, occurredAt: NOW - 2 * DAY, selfRating: 2 }, { now: NOW }),
      buildPronunciationAttempt({ ...context, occurredAt: NOW - DAY, selfRating: 4,
        advisoryScore: 0.2, advisorySource: "asr" }, { now: NOW })
    ];
    const summary = summarizeAttempts({ pronunciationAttempts: attempts }, PROFILE, "pi-1");
    expect(summary).toMatchObject({ attempts: 2, lastSelfRating: 4, averageSelfRating: 3 });
    expect(summary.lastAttemptAt).toBe(NOW - DAY);
    // The recognizer said 0.2 while the learner said 4. Both are reported; neither
    // overrides the other, and the average is the learner's.
    expect(summary.advisoryScores).toEqual([{ score: 0.2, source: "asr" }]);
  });

  it("ignores another learner's attempts and other items", () => {
    const attempts = [
      buildPronunciationAttempt({ ...context, selfRating: 4 }, { now: NOW }),
      buildPronunciationAttempt({ ...context, profileUuid: "someone-else", selfRating: 1 }, { now: NOW }),
      buildPronunciationAttempt({ ...context, itemUuid: "pi-2", selfRating: 1 }, { now: NOW })
    ];
    expect(attemptsFor({ pronunciationAttempts: attempts }, PROFILE, "pi-1")).toHaveLength(1);
  });

  it("summarizes an empty history without inventing anything", () => {
    expect(summarizeAttempts({}, PROFILE, "pi-1")).toMatchObject({
      attempts: 0, lastAttemptAt: null, lastSelfRating: null, averageSelfRating: null
    });
  });
});

/* ------------------------------------------------ error-learning integration */

describe("error-learning integration", () => {
  const WORD = { id: 1, german: "Bücher", arabic: "كتب", itemType: "noun" };

  it("keeps a spoken attempt advisory, so no deterministic pattern forms from an accent", () => {
    const evaluation = assessSpokenAttempt({ selfRating: 1, advisoryScore: 0.3, advisorySource: "asr" });
    const recorded = recordEvaluation(
      evaluation,
      pronunciationErrorContext(bySlug("buecher"), {
        profileUuid: PROFILE, answerLanguage: "de", occurredAt: NOW
      }),
      { now: NOW, advisory: [{ slug: "front-rounded-u", confidence: 0.7 }] }
    );

    expect(recorded.event).toMatchObject({ contentType: "pronunciation", contentUuid: "pi-1", scored: 0 });
    expect(recorded.links.every(l => l.source === ERROR_SOURCES.ADVISORY)).toBe(true);

    const patterns = aggregatePatterns({
      errorEvents: [recorded.event], errorEventCategories: recorded.links, errorCategories: []
    }, PROFILE);
    expect(patterns).toEqual([]);              // advisory alone never becomes a pattern
  });

  it("classifies a discrimination mistake deterministically, like any German answer", () => {
    const evaluation = validateGermanAnswer("Bucher", { ...WORD, german: "Bücher" }, DEFAULT_SETTINGS);
    expect(evaluation.isCorrect).toBe(false);

    const recorded = recordEvaluation(
      evaluation,
      pronunciationErrorContext(bySlug("ue-vs-u"), {
        profileUuid: PROFILE, answerLanguage: "de", occurredAt: NOW
      }),
      { now: NOW }
    );
    expect(recorded.event).toMatchObject({ contentType: "pronunciation", skill: "discrimination", scored: 1 });
    expect(recorded.links[0].source).toBe(ERROR_SOURCES.DETERMINISTIC);
  });

  it("carries no verdict of its own into the error context", () => {
    const context = pronunciationErrorContext(bySlug("buecher"), { profileUuid: PROFILE, answerLanguage: "de" });
    expect(context).not.toHaveProperty("scored");
    expect(context).not.toHaveProperty("isCorrect");
    expect(context.skill).toBe(PRONUNCIATION_SKILL);
  });

  it("handles a missing item without inventing a content uuid", () => {
    expect(pronunciationErrorContext(null, { profileUuid: PROFILE }).contentUuid).toBe("");
  });
});

/* --------------------------------------------------------- lesson integration */

describe("lesson integration", () => {
  it("joins a lesson through existing lesson_items with no new table", () => {
    const lesson = buildCurriculum({
      courses: [{ uuid: "c-1", slug: "netzwerk-a1", cefrLevel: "A1", ordering: 1, ...meta }],
      courseUnits: [{ uuid: "u-1", courseUuid: "c-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [{ uuid: "l-1", unitUuid: "u-1", slug: "laute", cefrLevel: "A1", ordering: 1, ...meta }],
      lessonSections: [{ uuid: "s-1", lessonUuid: "l-1", slug: "aussprache", sectionKind: "practice", ordering: 1, ...meta }],
      lessonItems: [
        { uuid: "i-1", sectionUuid: "s-1", contentType: CONTENT_TYPES.PRONUNCIATION,
          contentUuid: "pi-1", ordering: 1, required: 1, ...linkMeta },
        { uuid: "i-2", sectionUuid: "s-1", contentType: CONTENT_TYPES.LISTENING,
          contentUuid: "li-1", ordering: 2, required: 0, ...linkMeta }
      ]
    })[0].units[0].lessons[0];

    expect(lesson.sections[0].items.map(i => i.contentType)).toEqual(["pronunciation", "listening"]);
    expect(bySlug("buecher").contentType).toBe(CONTENT_TYPES.PRONUNCIATION);
  });
});

/* --------------------------------------------------------- SRS independence */

describe("pronunciation never schedules", () => {
  it("does not read or write SRS state anywhere in the module", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/pronunciation-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["reviewcards", "schedulecard", "dueat", "intervaldays",
      "lapses", "mastery", "indexeddb", "sqlite"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves a card untouched across assembly, assessment and attempt building", () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    const item = bySlug("buecher");
    assessSpokenAttempt({ selfRating: 1, advisoryScore: 0 });
    buildPronunciationAttempt({ profileUuid: PROFILE, itemUuid: item.uuid, selfRating: 1 }, { now: NOW });
    pronunciationErrorContext(item, { profileUuid: PROFILE, answerLanguage: "de" });

    expect(JSON.stringify(card)).toBe(before);
  });

  it("does not change which skills the legacy scheduler creates", async () => {
    const scheduler = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/srs/scheduler.js"), "utf8");
    // Adding pronunciation to SELF_ASSESSED_SKILLS must not create pronunciation cards.
    expect(scheduler).toContain('const skills=["recall","recognition"]');
    expect(scheduler).not.toContain("pronunciation");
  });
});

/* --------------------------------------------------------------- migration */

describe("migration invents no pronunciation content", () => {
  it("creates no features, items, variants, pairs or attempts from legacy data", () => {
    const { dataset } = migrateToCanonical({
      words: [{ id: 1, german: "Bücher", arabic: "كتب", itemType: "noun", level: "A1",
        pronunciation: "BUE-cher" }],
      cards: [{ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1, intervalDays: 3,
        ease: 2.5, reps: 2, lapses: 1, streak: 1, mastery: 40 }],
      attempts: [], settings: null, profile: null
    }, { now: NOW });

    for (const entity of ["pronunciationFeatures", "pronunciationTexts", "pronunciationItems",
      "pronunciationVariants", "pronunciationPairs", "pronunciationLinks", "pronunciationAttempts"]) {
      expect(dataset[entity], `${entity} should be empty`).toEqual([]);
    }
    // A legacy pronunciation hint is NOT promoted to authored IPA: it is not IPA.
    expect(dataset.pronunciationVariants).toEqual([]);
    // Everything earned is still preserved.
    expect(dataset.reviewCards[0]).toMatchObject({ ease: 2.5, mastery: 40, lapses: 1 });
    expect(dataset.audioAssets).toEqual([]);
    expect(dataset.quarantine).toEqual([]);
  });
});

/* ------------------------------------------------------------------ service */

describe("pronunciation service", () => {
  function repositoriesFor(data) {
    const wrap = rows => ({ all: async () => rows ?? [] });
    return {
      pronunciationFeatures: wrap(data.pronunciationFeatures),
      pronunciationTexts: wrap(data.pronunciationTexts),
      pronunciationItems: wrap(data.pronunciationItems),
      pronunciationVariants: wrap(data.pronunciationVariants),
      pronunciationPairs: wrap(data.pronunciationPairs),
      pronunciationLinks: wrap(data.pronunciationLinks),
      pronunciationAttempts: wrap(data.pronunciationAttempts),
      audioAssets: wrap(data.audioAssets)
    };
  }

  it("reads through repositories only", async () => {
    const service = createPronunciationService(repositoriesFor(canonical()));
    expect((await service.items()).map(i => i.slug)).toEqual(["buecher", "hoeren-lesen", "ue-vs-u"]);
    expect((await service.item("buecher")).uuid).toBe("pi-1");
    expect((await service.item("pi-1")).slug).toBe("buecher");
    expect(await service.item("nope")).toBeNull();
  });

  it("reports a learner's own spoken history", async () => {
    const attempts = [
      buildPronunciationAttempt({ profileUuid: PROFILE, itemUuid: "pi-1", occurredAt: NOW, selfRating: 4 }, { now: NOW })
    ];
    const service = createPronunciationService(repositoriesFor(canonical({ pronunciationAttempts: attempts })));
    expect(await service.history(PROFILE, "pi-1")).toMatchObject({ attempts: 1, lastSelfRating: 4 });
    expect(await service.history("someone-else", "pi-1")).toMatchObject({ attempts: 0 });
  });

  it("reports authoring readiness without blocking anything", async () => {
    const service = createPronunciationService(repositoriesFor(canonical()));
    const readiness = await service.readiness();
    expect(readiness[0]).toMatchObject({
      slug: "buecher", selfAssessed: true, hasModelAudio: true, hasIpa: true
    });
    expect(readiness[0].varieties).toEqual(["de-DE", "de-AT"]);
    expect(readiness[1]).toMatchObject({ slug: "hoeren-lesen", audioIssue: "remote-only" });
    expect(readiness[1].missingSupport).toEqual(["ar"]);
  });

  it("lists what is practisable offline and what targets an item", async () => {
    const service = createPronunciationService(repositoriesFor(canonical()));
    // hoeren-lesen has remote-only audio and no authored IPA, so it is not practisable
    // with the network off; ue-vs-u has neither audio nor IPA.
    expect((await service.offlineReady()).map(i => i.slug)).toEqual(["buecher"]);
    expect((await service.forTarget(TARGET_TYPES.VOCABULARY, "v-buch")).map(i => i.slug)).toEqual(["buecher"]);
  });

  it("exposes no way to grade speech or to schedule", () => {
    const service = createPronunciationService(repositoriesFor(canonical()));
    expect(Object.keys(service).sort())
      .toEqual(["forTarget", "history", "item", "items", "offlineReady", "readiness"]);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createPronunciationService(null)).toThrow(/Repositories are required/);
  });
});
