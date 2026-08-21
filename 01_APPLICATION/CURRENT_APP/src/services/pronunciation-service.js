/*
 * Pronunciation service (Feature H).
 *
 * Assembles a pronunciation practice item: the feature it trains, the authored
 * realizations (IPA, syllables, stress, regional variety), model audio, minimal pairs,
 * and links to the vocabulary, sentences, listening and exercises around it.
 *
 * The rule that shapes everything here:
 *
 *   PRODUCING SPEECH IS SELF-ASSESSED. DISCRIMINATING SOUNDS IS SCOREABLE.
 *
 * Judging whether someone SAID a word correctly needs acoustic recognition, and a wrong
 * verdict there would lapse a card for an accent. So this module produces no verdict on
 * speech: an attempt carries the learner's own rating, and anything a recognizer or model
 * offers is stored as `advisory` with its source named. There is no column for a machine
 * verdict of correctness anywhere in the schema, so none can later be read as authority.
 *
 * Deciding which of two words you HEARD is a different act. A minimal pair is an ordinary
 * German multiple-choice question, so it scores through the existing evaluator by way of
 * a linked exercise. That is the only route by which pronunciation practice can score,
 * and this module applies no answer rule of its own.
 *
 * Model audio reuses audio_assets and the offline rules from Feature G unchanged.
 */

import { ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, normalizeLanguage } from "../content/languages.js";
import { expectedAnswersFor } from "./exercise-service.js";
import { describeAsset } from "./listening-service.js";
import { isSelfAssessedSkill } from "../exercises/answer-evaluator.js";
import { deterministicUuid } from "../migration/uuid.js";

/** What kind of thing the feature is. */
export const FEATURE_KINDS = Object.freeze({
  PHONEME: "phoneme",
  CONTRAST: "contrast",
  STRESS: "stress",
  INTONATION: "intonation",
  GRAPHEME_SOUND: "grapheme_sound"
});

/**
 * What the learner does. Only DISCRIMINATE is objectively answerable; the rest are
 * production and are self-assessed.
 */
export const PRACTICE_MODES = Object.freeze({
  LISTEN_REPEAT: "listen_repeat",
  READ_ALOUD: "read_aloud",
  SHADOWING: "shadowing",
  MINIMAL_PAIR: "minimal_pair",
  DISCRIMINATE: "discriminate"
});

const SCOREABLE_MODES = Object.freeze([PRACTICE_MODES.DISCRIMINATE]);

export const PRONUNCIATION_TEXT_KINDS = Object.freeze({
  NAME: "name",
  EXPLANATION: "explanation",
  ADVICE: "advice",
  INSTRUCTION: "instruction"
});

export const OWNER_TYPES = Object.freeze({ FEATURE: "feature", ITEM: "item" });

export const TARGET_TYPES = Object.freeze({
  VOCABULARY: "vocabulary",
  SENTENCE: "sentence",
  GRAMMAR_RULE: "grammar_rule",
  LISTENING: "listening",
  EXERCISE: "exercise"
});

/** The content_type a pronunciation item uses in lesson_items and error events. */
export const PRONUNCIATION_CONTENT_TYPE = "pronunciation";

/** The skill name used when a spoken attempt reaches the evaluator or error learning. */
export const PRONUNCIATION_SKILL = "pronunciation";

/** Self-ratings the learner may give. Deliberately the learner's scale, not a score. */
export const SELF_RATINGS = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });

const notDeleted = row => !row.deleted;
const byOrdering = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0);

function groupBy(rows, key) {
  const map = new Map();
  for (const row of (rows ?? []).filter(notDeleted)) {
    const list = map.get(row[key]);
    if (list) list.push(row);
    else map.set(row[key], [row]);
  }
  return map;
}

function indexTexts(texts) {
  const map = new Map();
  for (const row of (texts ?? []).filter(notDeleted)) {
    const key = `${row.ownerType}:${row.ownerUuid}:${row.kind}`;
    const langs = map.get(key) ?? {};
    langs[normalizeLanguage(row.language)] = row.text;
    map.set(key, langs);
  }
  return map;
}

function textFor(index, ownerType, ownerUuid, kind) {
  const found = index.get(`${ownerType}:${ownerUuid}:${kind}`) ?? {};
  return { [GERMAN]: found[GERMAN] ?? null, [ENGLISH]: found[ENGLISH] ?? null, [ARABIC]: found[ARABIC] ?? null };
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
 * Realizations in teaching order: the primary one first, then authored ordering, then
 * variety, then uuid. Total and identical on every run, so a session can be resumed and
 * a test can assert exact output.
 */
export function variantsInOrder(variants) {
  return [...(variants ?? []).filter(notDeleted)].sort(
    (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) ||
      (a.ordering ?? 0) - (b.ordering ?? 0) ||
      String(a.variety ?? "").localeCompare(String(b.variety ?? "")) ||
      String(a.uuid).localeCompare(String(b.uuid))
  );
}

/** Syllables as authored, split on the separator, with the stressed one marked. */
export function syllablesOf(variant) {
  const raw = String(variant?.syllables ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(/[·|\-·]/).map(part => part.trim()).filter(Boolean);
  const stressIndex = Number.isInteger(variant.stressIndex) ? variant.stressIndex : 0;
  return parts.map((text, index) => ({ text, stressed: index === stressIndex }));
}

/* ---------------------------------------------------------------- assembly */

/**
 * Assemble every pronunciation item.
 *
 * @param {object} canonical pronunciation tables (plus audioAssets)
 * @returns {Array} items in authored order
 */
export function buildPronunciation(canonical = {}) {
  const texts = indexTexts(canonical.pronunciationTexts);
  const assetsByUuid = new Map(
    (canonical.audioAssets ?? []).filter(notDeleted).map(asset => [asset.uuid, asset])
  );
  const featuresByUuid = new Map(
    (canonical.pronunciationFeatures ?? []).filter(notDeleted).map(feature => [feature.uuid, feature])
  );
  const variantsByItem = groupBy(canonical.pronunciationVariants, "itemUuid");
  const linksByItem = groupBy(canonical.pronunciationLinks, "itemUuid");
  const pairsByFeature = groupBy(canonical.pronunciationPairs, "featureUuid");

  return (canonical.pronunciationItems ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(item => {
      const featureRow = item.featureUuid ? featuresByUuid.get(item.featureUuid) ?? null : null;
      const featureName = featureRow
        ? textFor(texts, OWNER_TYPES.FEATURE, featureRow.uuid, PRONUNCIATION_TEXT_KINDS.NAME)
        : null;
      const featureAdvice = featureRow
        ? textFor(texts, OWNER_TYPES.FEATURE, featureRow.uuid, PRONUNCIATION_TEXT_KINDS.ADVICE)
        : null;

      const instruction = textFor(texts, OWNER_TYPES.ITEM, item.uuid, PRONUNCIATION_TEXT_KINDS.INSTRUCTION);

      const variants = variantsInOrder(variantsByItem.get(item.uuid) ?? []).map(variant => ({
        uuid: variant.uuid,
        ipa: variant.ipa || null,
        syllables: syllablesOf(variant),
        stressIndex: Number.isInteger(variant.stressIndex) ? variant.stressIndex : 0,
        variety: variant.variety || null,
        isPrimary: Boolean(variant.isPrimary),
        audio: describeAsset(variant.audioUuid ? assetsByUuid.get(variant.audioUuid) ?? null : null)
      }));

      const links = (linksByItem.get(item.uuid) ?? []).sort(byOrdering);
      const linksOf = type => links
        .filter(link => link.targetType === type)
        .map(link => ({ uuid: link.targetUuid, ordering: link.ordering ?? 0 }));

      const pairs = featureRow
        ? (pairsByFeature.get(featureRow.uuid) ?? []).sort(byOrdering).map(pair => ({
            uuid: pair.uuid,
            a: { text: pair.aText, vocabUuid: pair.aVocabUuid ?? null,
                 audio: describeAsset(pair.aAudioUuid ? assetsByUuid.get(pair.aAudioUuid) ?? null : null) },
            b: { text: pair.bText, vocabUuid: pair.bVocabUuid ?? null,
                 audio: describeAsset(pair.bAudioUuid ? assetsByUuid.get(pair.bAudioUuid) ?? null : null) }
          }))
        : [];

      const modelAudio = describeAsset(
        item.modelAudioUuid ? assetsByUuid.get(item.modelAudioUuid) ?? null : null
      );
      const practiceMode = item.practiceMode || PRACTICE_MODES.LISTEN_REPEAT;

      return {
        uuid: item.uuid,
        slug: item.slug,
        practiceMode,
        level: item.level || null,
        ordering: item.ordering ?? 0,
        contentType: PRONUNCIATION_CONTENT_TYPE,
        skill: PRONUNCIATION_SKILL,
        // The whole point, stated in the data: producing is self-assessed.
        selfAssessed: !SCOREABLE_MODES.includes(practiceMode),
        modelAudio,
        // A model recording is a teaching aid, not a precondition: an item with no local
        // audio is still practisable from its IPA and syllables.
        hasModelAudio: modelAudio.playableOffline,
        target: item.targetType ? { type: item.targetType, uuid: item.targetUuid } : null,
        feature: featureRow
          ? {
              uuid: featureRow.uuid,
              slug: featureRow.slug,
              kind: featureRow.featureKind,
              ipa: featureRow.ipa || null,
              name: featureName,
              advice: featureAdvice,
              coverage: coverageOf(featureName)
            }
          : null,
        instruction,
        variants,
        primaryVariant: variants[0] ?? null,
        pairs,
        vocabulary: linksOf(TARGET_TYPES.VOCABULARY),
        sentences: linksOf(TARGET_TYPES.SENTENCE),
        grammarRules: linksOf(TARGET_TYPES.GRAMMAR_RULE),
        listening: linksOf(TARGET_TYPES.LISTENING),
        // The only route by which this item can be scored.
        exercises: linksOf(TARGET_TYPES.EXERCISE),
        provenance: {
          status: item.contentStatus ?? null,
          version: item.contentVersion ?? null,
          reference: item.sourceReference ?? null,
          type: item.sourceType ?? null,
          verifiedAt: item.verifiedAt ?? null
        }
      };
    });
}

/* ----------------------------------------------------------------- scoring */

/**
 * The gradeable answers for a pronunciation item.
 *
 * Speech is never among them. Only a linked exercise can supply answers, and only the
 * exercise layer's own filter decides which of those may score, so neither Arabic nor a
 * recognizer's opinion can become a correctness verdict by coming in through here.
 */
export function expectedAnswersForPronunciation(item, exercises) {
  if (!item || item.selfAssessed) return [];
  const linked = new Set((item.exercises ?? []).map(link => link.uuid));
  return (exercises ?? [])
    .filter(exercise => linked.has(exercise.uuid))
    .flatMap(exercise => expectedAnswersFor(exercise));
}

/** Whether this item can be graded at all. Production items never can. */
export function isGradeable(item, exercises) {
  return expectedAnswersForPronunciation(item, exercises).length > 0;
}

/**
 * Why an item cannot be graded, so the reason is reported rather than inferred from an
 * empty list.
 */
export function gradeabilityOf(item, exercises) {
  if (!item) return { gradeable: false, reason: "no-item" };
  if (item.selfAssessed) return { gradeable: false, reason: "spoken-answer-is-self-assessed" };
  const answers = expectedAnswersForPronunciation(item, exercises);
  if (!answers.length) return { gradeable: false, reason: "no-scoreable-expected-answer" };
  return { gradeable: true, reason: null };
}

/* ------------------------------------------------------------- attempts */

const NS_ATTEMPT = "deutschflow/pronunciation_attempt";

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(SELF_RATINGS.EASY, Math.max(0, Math.round(n)));
}

function clampAdvisory(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

/**
 * Build the row for one spoken attempt. Pure: it returns a row, it does not persist it.
 *
 * The learner's rating is the only judgement recorded. An advisory score is kept only
 * with the name of whatever produced it, and the row carries no correctness field at
 * all, so nothing downstream can mistake a recognizer's opinion for a verdict.
 */
export function buildPronunciationAttempt(input, options = {}) {
  const now = options.now ?? Date.now();
  const occurredAt = input.occurredAt ?? now;
  const advisoryScore = clampAdvisory(input.advisoryScore);

  return {
    uuid: deterministicUuid(
      NS_ATTEMPT, `${input.profileUuid}:${input.itemUuid}:${occurredAt}`
    ),
    profileUuid: input.profileUuid,
    itemUuid: input.itemUuid,
    occurredAt,
    sessionUuid: input.sessionUuid ?? null,
    selfRating: clampRating(input.selfRating),
    advisoryScore,
    // A score with no named source is not admissible even as advice.
    advisorySource: advisoryScore === null ? null : (input.advisorySource ?? null),
    recordingAudioUuid: input.recordingAudioUuid ?? null,
    note: input.note ?? "",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  };
}

/**
 * The evaluator-shaped result for a spoken attempt.
 *
 * It mirrors evaluateArabicAdvisory deliberately: isCorrect is null rather than false,
 * so any code that tries to score from it fails loudly instead of quietly grading
 * speech, and quality is 0 so it contributes nothing to an automatic rating.
 */
export function assessSpokenAttempt({ selfRating, advisoryScore, advisorySource } = {}) {
  const rating = clampRating(selfRating);
  const advisory = clampAdvisory(advisoryScore);
  return {
    type: "spoken",
    isCorrect: null,
    selfAssessed: true,
    quality: 0,
    selfRating: rating,
    advisory: advisory === null ? null : { score: advisory, source: advisorySource ?? null },
    note: "قيّم نطقك بنفسك بعد مقارنته بالنموذج."
  };
}

/** A learner's spoken history for an item, newest first. Read-only. */
export function attemptsFor(canonical = {}, profileUuid, itemUuid) {
  return (canonical.pronunciationAttempts ?? [])
    .filter(notDeleted)
    .filter(row => row.profileUuid === profileUuid && row.itemUuid === itemUuid)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

/** Simple, honest summary: what the learner said about themselves, and how often. */
export function summarizeAttempts(canonical = {}, profileUuid, itemUuid) {
  const attempts = attemptsFor(canonical, profileUuid, itemUuid);
  const rated = attempts.filter(attempt => attempt.selfRating > 0);
  return {
    attempts: attempts.length,
    lastAttemptAt: attempts[0]?.occurredAt ?? null,
    lastSelfRating: attempts[0]?.selfRating ?? null,
    averageSelfRating: rated.length
      ? Math.round((rated.reduce((sum, a) => sum + a.selfRating, 0) / rated.length) * 100) / 100
      : null,
    // Reported separately and never mixed into the average above.
    advisoryScores: attempts
      .filter(attempt => attempt.advisoryScore !== null && attempt.advisoryScore !== undefined)
      .map(attempt => ({ score: attempt.advisoryScore, source: attempt.advisorySource ?? null }))
  };
}

/* -------------------------------------------------------- error learning */

/**
 * The context for recording a pronunciation mistake.
 *
 * Because a spoken attempt is self-assessed, the error service classifies it as
 * advisory of its own accord — the same tier Arabic occupies — so no deterministic
 * error pattern can be built out of an opinion about someone's accent. A minimal-pair
 * discrimination answer is an ordinary German exercise answer and classifies normally.
 */
export function pronunciationErrorContext(item, { profileUuid, answerLanguage, skill, occurredAt, sessionUuid } = {}) {
  return {
    profileUuid,
    contentType: PRONUNCIATION_CONTENT_TYPE,
    contentUuid: item?.uuid ?? "",
    skill: skill ?? (item?.selfAssessed === false ? "discrimination" : PRONUNCIATION_SKILL),
    answerLanguage,
    occurredAt,
    sessionUuid: sessionUuid ?? null
  };
}

/** True when this practice mode's answer is one the learner reports, not the app. */
export function isSelfAssessedMode(practiceMode) {
  return !SCOREABLE_MODES.includes(practiceMode);
}

/* ------------------------------------------------------------------ queries */

/** Items practising a particular piece of content, by explicit target or by link. */
export function pronunciationForTarget(items, targetType, targetUuid) {
  const key = {
    [TARGET_TYPES.VOCABULARY]: "vocabulary",
    [TARGET_TYPES.SENTENCE]: "sentences",
    [TARGET_TYPES.GRAMMAR_RULE]: "grammarRules",
    [TARGET_TYPES.LISTENING]: "listening",
    [TARGET_TYPES.EXERCISE]: "exercises"
  }[targetType];
  return (items ?? []).filter(item =>
    (item.target?.type === targetType && item.target?.uuid === targetUuid) ||
    (key ? item[key].some(link => link.uuid === targetUuid) : false)
  );
}

/** Items practisable right now with no network: model audio local, or none needed. */
export function offlineReady(items) {
  return (items ?? []).filter(item => item.hasModelAudio || item.primaryVariant?.ipa);
}

/* ------------------------------------------------------------------ service */

/** Repository-backed service. Read-only; assembles items and judges no speech. */
export function createPronunciationService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function load() {
    const [pronunciationFeatures, pronunciationTexts, pronunciationItems, pronunciationVariants,
           pronunciationPairs, pronunciationLinks, audioAssets] = await Promise.all([
      repositories.pronunciationFeatures.all(), repositories.pronunciationTexts.all(),
      repositories.pronunciationItems.all(), repositories.pronunciationVariants.all(),
      repositories.pronunciationPairs.all(), repositories.pronunciationLinks.all(),
      repositories.audioAssets.all()
    ]);
    return { pronunciationFeatures, pronunciationTexts, pronunciationItems, pronunciationVariants,
             pronunciationPairs, pronunciationLinks, audioAssets };
  }

  return Object.freeze({
    async items() {
      return buildPronunciation(await load());
    },

    async item(uuidOrSlug) {
      return (await this.items())
        .find(item => item.uuid === uuidOrSlug || item.slug === uuidOrSlug) ?? null;
    },

    async forTarget(targetType, targetUuid) {
      return pronunciationForTarget(await this.items(), targetType, targetUuid);
    },

    async offlineReady() {
      return offlineReady(await this.items());
    },

    /** A learner's own spoken history. Their ratings, never a machine's verdict. */
    async history(profileUuid, itemUuid) {
      const attempts = await repositories.pronunciationAttempts.all();
      return summarizeAttempts({ pronunciationAttempts: attempts }, profileUuid, itemUuid);
    },

    /** Authoring view: what is missing before an item can be taught. */
    async readiness() {
      return (await this.items()).map(item => ({
        uuid: item.uuid,
        slug: item.slug,
        selfAssessed: item.selfAssessed,
        hasModelAudio: item.hasModelAudio,
        audioIssue: item.modelAudio.missingReason,
        hasIpa: Boolean(item.primaryVariant?.ipa),
        varieties: item.variants.map(variant => variant.variety),
        missingSupport: item.feature?.coverage.missing ?? SUPPORT_LANGUAGES.slice()
      }));
    }
  });
}

/** Re-exported so a caller never has to keep its own list of self-assessed skills. */
export { isSelfAssessedSkill };
