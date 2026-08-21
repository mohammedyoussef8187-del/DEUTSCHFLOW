/*
 * Listening service (Feature G).
 *
 * Assembles a listening activity: the audio file, its German transcript, English and
 * Arabic support, optional timecoded segments and speakers, and links to the vocabulary,
 * grammar, sentences and exercises it teaches.
 *
 * Four rules hold this together:
 *
 *   1. LISTENING DOES NOT GRADE. Comprehension is checked by ordinary exercises linked
 *      to the activity, so the deterministic evaluator stays the single grader. This
 *      module deliberately imports expectedAnswersFor from the exercise service rather
 *      than deciding anything about answers itself; there is no second grading engine.
 *
 *   2. ARABIC NEVER SCORES. Support text in any language is teaching material. The only
 *      answers that can decide correctness are the ones the exercise layer already
 *      filtered through the language policy.
 *
 *   3. OFFLINE-FIRST IS A PROPERTY OF THE DATA, NOT A HOPE. An asset records where it
 *      actually is. `playableOffline` is true only for a file on the device. A remote
 *      URL is a way to obtain a file, never a way to study, so an activity whose audio
 *      is remote is reported as unavailable rather than quietly requiring a network.
 *
 *   4. ORDER IS AUTHORED, NOT INFERRED. Segments sort by their authored ordering, with
 *      start time only as a tie-break, so a mistyped timecode cannot silently rearrange
 *      a dialogue.
 *
 * Lesson and course membership needs nothing here: lesson_items already references
 * content as (content_type, content_uuid), so an activity joins a lesson as 'listening'.
 */

import { ARABIC, ENGLISH, GERMAN, SUPPORT_LANGUAGES, normalizeLanguage } from "../content/languages.js";
import { expectedAnswersFor } from "./exercise-service.js";

/** Where the file actually is. Only the first two can be studied with no network. */
export const AUDIO_AVAILABILITY = Object.freeze({
  BUNDLED: "bundled",
  DOWNLOADED: "downloaded",
  SOURCE_ONLY: "source-only",
  REMOTE: "remote"
});

const OFFLINE_AVAILABLE = Object.freeze([AUDIO_AVAILABILITY.BUNDLED, AUDIO_AVAILABILITY.DOWNLOADED]);

export const LISTENING_ACTIVITY_TYPES = Object.freeze({
  GIST: "gist",
  DETAIL: "detail",
  DIALOGUE: "dialogue",
  DICTATION: "dictation",
  NOTE_TAKING: "note_taking"
});

export const LISTENING_TEXT_KINDS = Object.freeze({
  TITLE: "title",
  TRANSCRIPT: "transcript",
  SUMMARY: "summary",
  INSTRUCTION: "instruction",
  NOTE: "note"
});

export const LISTENING_TARGET_TYPES = Object.freeze({
  VOCABULARY: "vocabulary",
  GRAMMAR_TOPIC: "grammar_topic",
  GRAMMAR_RULE: "grammar_rule",
  SENTENCE: "sentence",
  EXERCISE: "exercise"
});

/** The content_type a listening activity uses inside lesson_items and error events. */
export const LISTENING_CONTENT_TYPE = "listening";

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

function textsByKind(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const langs = map.get(row.kind) ?? {};
    langs[normalizeLanguage(row.language)] = row.text;
    map.set(row.kind, langs);
  }
  return map;
}

function languageTriple(map, kind) {
  const found = map.get(kind) ?? {};
  // Absent languages are null, never missing keys, so "not translated" cannot be
  // mistaken for "not applicable".
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

/* -------------------------------------------------------------------- audio */

/** Whether this file can be played with no network at all. */
export function isPlayableOffline(asset) {
  return Boolean(asset) && OFFLINE_AVAILABLE.includes(asset.availability) && Boolean(asset.localPath);
}

/**
 * The asset as the UI should see it: local reality first, remote metadata clearly
 * separate and clearly optional.
 */
export function describeAsset(asset) {
  if (!asset) {
    return {
      uuid: null, slug: null, availability: null, playableOffline: false,
      localPath: null, durationMs: 0, byteSize: 0, mimeType: null,
      source: { path: null, remoteUrl: null, reference: null, type: null },
      missingReason: "no-audio"
    };
  }

  const playableOffline = isPlayableOffline(asset);
  return {
    uuid: asset.uuid,
    slug: asset.slug,
    availability: asset.availability,
    playableOffline,
    localPath: playableOffline ? asset.localPath : null,
    durationMs: asset.durationMs ?? 0,
    byteSize: asset.byteSize ?? 0,
    mimeType: asset.mimeType ?? null,
    checksum: asset.checksum ?? null,
    // Deliberately grouped apart from the fields above: this is where the file CAME
    // from, not where it IS. Nothing in study should read from here.
    source: {
      path: asset.sourcePath || null,
      remoteUrl: asset.remoteUrl ?? null,
      reference: asset.sourceReference ?? null,
      type: asset.sourceType ?? null
    },
    missingReason: playableOffline
      ? null
      : asset.availability === AUDIO_AVAILABILITY.REMOTE ? "remote-only"
      : asset.availability === AUDIO_AVAILABILITY.SOURCE_ONLY ? "not-on-device"
      : "no-local-path"
  };
}

/* ---------------------------------------------------------------- assembly */

/**
 * Assemble every listening activity.
 *
 * @param {object} canonical listening tables
 * @returns {Array} activities in authored order
 */
export function buildListening(canonical = {}) {
  const assetsByUuid = new Map(
    (canonical.audioAssets ?? []).filter(notDeleted).map(asset => [asset.uuid, asset])
  );
  const textsByItem = groupBy(canonical.listeningTexts, "itemUuid");
  const speakersByItem = groupBy(canonical.listeningSpeakers, "itemUuid");
  const segmentsByItem = groupBy(canonical.listeningSegments, "itemUuid");
  const segmentTextsBySegment = groupBy(canonical.listeningSegmentTexts, "segmentUuid");
  const linksByItem = groupBy(canonical.listeningLinks, "itemUuid");

  return (canonical.listeningItems ?? [])
    .filter(notDeleted)
    .sort(byOrdering)
    .map(item => {
      const texts = textsByKind(textsByItem.get(item.uuid) ?? []);
      const title = languageTriple(texts, LISTENING_TEXT_KINDS.TITLE);
      const transcript = languageTriple(texts, LISTENING_TEXT_KINDS.TRANSCRIPT);
      const summary = languageTriple(texts, LISTENING_TEXT_KINDS.SUMMARY);
      const instruction = languageTriple(texts, LISTENING_TEXT_KINDS.INSTRUCTION);

      const speakers = (speakersByItem.get(item.uuid) ?? []).sort(byOrdering).map(speaker => ({
        uuid: speaker.uuid,
        label: speaker.label || null,
        role: speaker.role || null,
        variety: speaker.variety || null
      }));
      const speakerByUuid = new Map(speakers.map(speaker => [speaker.uuid, speaker]));

      const segments = segmentsInOrder(segmentsByItem.get(item.uuid) ?? []).map(segment => {
        const segTexts = textsByKind(segmentTextsBySegment.get(segment.uuid) ?? []);
        const segTranscript = languageTriple(segTexts, LISTENING_TEXT_KINDS.TRANSCRIPT);
        return {
          uuid: segment.uuid,
          ordering: segment.ordering ?? 0,
          startMs: segment.startMs ?? 0,
          endMs: segment.endMs ?? 0,
          durationMs: Math.max(0, (segment.endMs ?? 0) - (segment.startMs ?? 0)),
          speaker: segment.speakerUuid ? speakerByUuid.get(segment.speakerUuid) ?? null : null,
          // German is the transcript; English and Arabic are support, side by side.
          german: segTranscript[GERMAN],
          support: { [ENGLISH]: segTranscript[ENGLISH], [ARABIC]: segTranscript[ARABIC] },
          coverage: coverageOf(segTranscript)
        };
      });

      const links = (linksByItem.get(item.uuid) ?? []).sort(byOrdering);
      const linksOf = type => links
        .filter(link => link.targetType === type)
        .map(link => ({ uuid: link.targetUuid, ordering: link.ordering ?? 0 }));

      const audio = describeAsset(assetsByUuid.get(item.audioUuid) ?? null);

      return {
        uuid: item.uuid,
        slug: item.slug,
        activityType: item.activityType || LISTENING_ACTIVITY_TYPES.GIST,
        level: item.level || null,
        ordering: item.ordering ?? 0,
        // The type this activity uses inside lesson_items, so a caller never guesses it.
        contentType: LISTENING_CONTENT_TYPE,
        audio,
        // Study needs the file on the device; everything else is still readable.
        studyable: audio.playableOffline,
        title,
        transcript: transcript[GERMAN],
        support: {
          [ENGLISH]: summary[ENGLISH] ?? transcript[ENGLISH],
          [ARABIC]: summary[ARABIC] ?? transcript[ARABIC]
        },
        instruction,
        coverage: coverageOf({
          [ENGLISH]: summary[ENGLISH] ?? transcript[ENGLISH],
          [ARABIC]: summary[ARABIC] ?? transcript[ARABIC]
        }),
        speakers,
        segments,
        vocabulary: linksOf(LISTENING_TARGET_TYPES.VOCABULARY),
        grammarTopics: linksOf(LISTENING_TARGET_TYPES.GRAMMAR_TOPIC),
        grammarRules: linksOf(LISTENING_TARGET_TYPES.GRAMMAR_RULE),
        sentences: linksOf(LISTENING_TARGET_TYPES.SENTENCE),
        // How this activity is scored: through these exercises, not through itself.
        exercises: linksOf(LISTENING_TARGET_TYPES.EXERCISE),
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

/**
 * Segments in playback order. Authored `ordering` wins; `startMs` only breaks a tie, and
 * uuid breaks that, so the order is total and identical on every run and device.
 */
export function segmentsInOrder(segments) {
  return [...(segments ?? []).filter(notDeleted)].sort(
    (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) ||
      (a.startMs ?? 0) - (b.startMs ?? 0) ||
      String(a.uuid).localeCompare(String(b.uuid))
  );
}

/**
 * Timecode problems worth showing an author, reported rather than thrown: a broken
 * timecode should not stop a learner listening to the recording.
 */
export function segmentIssues(activity) {
  const issues = [];
  const segments = activity?.segments ?? [];
  const durationMs = activity?.audio?.durationMs ?? 0;

  segments.forEach((segment, index) => {
    if (segment.endMs && segment.endMs < segment.startMs) {
      issues.push({ segmentUuid: segment.uuid, issue: "ends-before-it-starts" });
    }
    if (durationMs && segment.endMs > durationMs) {
      issues.push({ segmentUuid: segment.uuid, issue: "past-end-of-audio" });
    }
    const previous = segments[index - 1];
    if (previous && segment.startMs < previous.endMs) {
      issues.push({ segmentUuid: segment.uuid, issue: "overlaps-previous" });
    }
  });

  return issues;
}

/** The segment playing at a point in time, or null. Pure lookup, no playback. */
export function segmentAt(activity, positionMs) {
  return (activity?.segments ?? []).find(
    segment => positionMs >= segment.startMs && (segment.endMs === 0 || positionMs < segment.endMs)
  ) ?? null;
}

/* --------------------------------------------------------------- scoring */

/**
 * The gradeable answers for a listening activity.
 *
 * This is the whole of listening's involvement in scoring: it finds the linked
 * exercises and hands them to the exercise layer's own filter. It applies no rule of
 * its own, which is why Arabic cannot become gradeable by coming in through listening.
 */
export function expectedAnswersForListening(activity, exercises) {
  const linked = new Set((activity?.exercises ?? []).map(link => link.uuid));
  return (exercises ?? [])
    .filter(exercise => linked.has(exercise.uuid))
    .flatMap(exercise => expectedAnswersFor(exercise));
}

/** Whether any linked exercise can actually be graded. */
export function isGradeable(activity, exercises) {
  return expectedAnswersForListening(activity, exercises).length > 0;
}

/* -------------------------------------------------------- error learning */

/**
 * The context for recording a listening mistake, for the error service to classify.
 *
 * It deliberately carries no verdict of its own: whether the mistake is deterministic
 * or advisory is decided by the error service from the evaluator's result and the
 * answer language, so an Arabic listening answer stays advisory here exactly as it
 * does everywhere else. Nothing here touches SRS scheduling.
 */
export function listeningErrorContext(activity, { profileUuid, answerLanguage, skill, occurredAt, sessionUuid } = {}) {
  return {
    profileUuid,
    contentType: LISTENING_CONTENT_TYPE,
    contentUuid: activity?.uuid ?? "",
    skill: skill ?? "listening",
    answerLanguage,
    occurredAt,
    sessionUuid: sessionUuid ?? null
  };
}

/* ------------------------------------------------------------------ queries */

/** Activities that can be studied right now with no network. */
export function offlineReady(activities) {
  return (activities ?? []).filter(activity => activity.studyable);
}

/** Activities practising a particular piece of content. */
export function listeningForTarget(activities, targetType, targetUuid) {
  const key = {
    [LISTENING_TARGET_TYPES.VOCABULARY]: "vocabulary",
    [LISTENING_TARGET_TYPES.GRAMMAR_TOPIC]: "grammarTopics",
    [LISTENING_TARGET_TYPES.GRAMMAR_RULE]: "grammarRules",
    [LISTENING_TARGET_TYPES.SENTENCE]: "sentences",
    [LISTENING_TARGET_TYPES.EXERCISE]: "exercises"
  }[targetType];
  if (!key) return [];
  return (activities ?? []).filter(activity => activity[key].some(link => link.uuid === targetUuid));
}

/* ------------------------------------------------------------------ service */

/** Repository-backed service. Read-only; assembles activities and grades nothing. */
export function createListeningService(repositories) {
  if (!repositories) throw new TypeError("Repositories are required");

  async function load() {
    const [audioAssets, listeningItems, listeningTexts, listeningSpeakers,
           listeningSegments, listeningSegmentTexts, listeningLinks] = await Promise.all([
      repositories.audioAssets.all(), repositories.listeningItems.all(),
      repositories.listeningTexts.all(), repositories.listeningSpeakers.all(),
      repositories.listeningSegments.all(), repositories.listeningSegmentTexts.all(),
      repositories.listeningLinks.all()
    ]);
    return { audioAssets, listeningItems, listeningTexts, listeningSpeakers,
             listeningSegments, listeningSegmentTexts, listeningLinks };
  }

  return Object.freeze({
    async activities() {
      return buildListening(await load());
    },

    async activity(uuidOrSlug) {
      return (await this.activities())
        .find(item => item.uuid === uuidOrSlug || item.slug === uuidOrSlug) ?? null;
    },

    /** What a learner can do right now with the network off. */
    async offlineReady() {
      return offlineReady(await this.activities());
    },

    async forTarget(targetType, targetUuid) {
      return listeningForTarget(await this.activities(), targetType, targetUuid);
    },

    /** Authoring view: what is missing before this can be published or studied. */
    async readiness() {
      const activities = await this.activities();
      return activities.map(activity => ({
        uuid: activity.uuid,
        slug: activity.slug,
        studyable: activity.studyable,
        audioIssue: activity.audio.missingReason,
        hasTranscript: Boolean(activity.transcript),
        missingSupport: activity.coverage.missing,
        segmentIssues: segmentIssues(activity)
      }));
    }
  });
}
