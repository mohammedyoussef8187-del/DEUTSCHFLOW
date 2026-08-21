/*
 * Feature G — listening.
 *
 * The rules this suite defends hardest:
 *   - listening never grades; the exercise layer and the deterministic evaluator do
 *   - Arabic support text can never become a scoreable answer
 *   - offline availability is a fact in the data, not an assumption
 *   - segment order is authored, never inferred from timecodes
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIO_AVAILABILITY, LISTENING_ACTIVITY_TYPES, LISTENING_CONTENT_TYPE, LISTENING_TARGET_TYPES,
  LISTENING_TEXT_KINDS, buildListening, createListeningService, describeAsset,
  expectedAnswersForListening, isGradeable, isPlayableOffline, listeningErrorContext,
  listeningForTarget, offlineReady, segmentAt, segmentIssues, segmentsInOrder
} from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";
import { buildExercises } from "../../01_APPLICATION/CURRENT_APP/src/services/exercise-service.js";
import {
  ERROR_SOURCES, classifyEvaluation, recordEvaluation
} from "../../01_APPLICATION/CURRENT_APP/src/services/error-service.js";
import { buildCurriculum, CONTENT_TYPES } from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";
import {
  evaluateArabicAdvisory, validateGermanAnswer
} from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import { buildAudioAssetRows, slugFor, summarizeManifest } from "../../tools/listening/audio-manifest.js";

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, sourceReference: null, sourceType: "textbook",
  verifiedAt: NOW, verifiedBy: "author", createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (itemUuid, language, kind, value) =>
  ({ uuid: `lt-${itemUuid}-${language}-${kind}`, itemUuid, language, kind, text: value, ...meta });
const segText = (segmentUuid, language, value) =>
  ({ uuid: `st-${segmentUuid}-${language}`, segmentUuid, language, kind: LISTENING_TEXT_KINDS.TRANSCRIPT,
     text: value, ...meta });

function canonical(over = {}) {
  return {
    audioAssets: [
      { uuid: "a-1", slug: "am-bahnhof", availability: AUDIO_AVAILABILITY.BUNDLED,
        localPath: "audio/am-bahnhof.mp3", sourcePath: "03_COURSE_CONTENT/x/am-bahnhof.mp3",
        remoteUrl: null, mimeType: "audio/mpeg", byteSize: 512000, durationMs: 42000,
        checksum: "abc123", ...meta },
      { uuid: "a-2", slug: "im-cafe", availability: AUDIO_AVAILABILITY.SOURCE_ONLY,
        localPath: "", sourcePath: "03_COURSE_CONTENT/x/im-cafe.mp3",
        remoteUrl: "https://example.invalid/im-cafe.mp3", mimeType: "audio/mpeg",
        byteSize: 400000, durationMs: 30000, checksum: null, ...meta }
    ],
    listeningItems: [
      { uuid: "li-2", slug: "im-cafe", audioUuid: "a-2", activityType: LISTENING_ACTIVITY_TYPES.GIST,
        level: "A2", ordering: 2, ...meta },
      { uuid: "li-1", slug: "am-bahnhof", audioUuid: "a-1", activityType: LISTENING_ACTIVITY_TYPES.DIALOGUE,
        level: "A2", ordering: 1, ...meta }
    ],
    listeningTexts: [
      text("li-1", "de", LISTENING_TEXT_KINDS.TITLE, "Am Bahnhof"),
      text("li-1", "en", LISTENING_TEXT_KINDS.TITLE, "At the station"),
      text("li-1", "ar", LISTENING_TEXT_KINDS.TITLE, "في المحطة"),
      text("li-1", "de", LISTENING_TEXT_KINDS.TRANSCRIPT, "Guten Tag. Wann fährt der Zug nach Köln?"),
      text("li-1", "en", LISTENING_TEXT_KINDS.SUMMARY, "A traveller asks about the next train."),
      text("li-1", "ar", LISTENING_TEXT_KINDS.SUMMARY, "مسافر يسأل عن القطار التالي."),
      text("li-1", "ar", LISTENING_TEXT_KINDS.INSTRUCTION, "استمع مرتين ثم أجب."),
      text("li-2", "de", LISTENING_TEXT_KINDS.TITLE, "Im Café")
      // li-2 has no English or Arabic support: untranslated, not broken.
    ],
    listeningSpeakers: [
      { uuid: "sp-2", itemUuid: "li-1", label: "Angestellter", role: "staff", variety: "de-DE", ordering: 2, ...linkMeta },
      { uuid: "sp-1", itemUuid: "li-1", label: "Reisende", role: "traveller", variety: "de-AT", ordering: 1, ...linkMeta }
    ],
    listeningSegments: [
      { uuid: "sg-2", itemUuid: "li-1", speakerUuid: "sp-2", ordering: 2, startMs: 4000, endMs: 9000, ...linkMeta },
      { uuid: "sg-1", itemUuid: "li-1", speakerUuid: "sp-1", ordering: 1, startMs: 0, endMs: 4000, ...linkMeta },
      { uuid: "sg-3", itemUuid: "li-1", speakerUuid: null, ordering: 3, startMs: 9000, endMs: 14000, ...linkMeta }
    ],
    listeningSegmentTexts: [
      segText("sg-1", "de", "Wann fährt der Zug nach Köln?"),
      segText("sg-1", "en", "When does the train to Cologne leave?"),
      segText("sg-1", "ar", "متى يغادر القطار إلى كولونيا؟"),
      segText("sg-2", "de", "Um zehn Uhr fünfzehn."),
      segText("sg-2", "en", "At quarter past ten.")
      // sg-2 has no Arabic; sg-3 has nothing at all.
    ],
    listeningLinks: [
      { uuid: "ll-1", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.VOCABULARY, targetUuid: "v-zug", ordering: 1, ...linkMeta },
      { uuid: "ll-2", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.GRAMMAR_RULE, targetUuid: "r-wfrage", ordering: 1, ...linkMeta },
      { uuid: "ll-3", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.SENTENCE, targetUuid: "s-zug", ordering: 1, ...linkMeta },
      { uuid: "ll-4", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.EXERCISE, targetUuid: "x-de", ordering: 1, ...linkMeta },
      { uuid: "ll-5", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.EXERCISE, targetUuid: "x-ar", ordering: 2, ...linkMeta },
      { uuid: "ll-6", itemUuid: "li-1", targetType: LISTENING_TARGET_TYPES.GRAMMAR_TOPIC, targetUuid: "t-fragen", ordering: 1, ...linkMeta }
    ],
    ...over
  };
}

const activities = (over = {}) => buildListening(canonical(over));
const first = (over = {}) => activities(over)[0];

/* --------------------------------------------------------------- structure */

describe("listening structure", () => {
  it("assembles activities in authored order", () => {
    expect(activities().map(a => a.slug)).toEqual(["am-bahnhof", "im-cafe"]);
  });

  it("carries level, activity type and provenance", () => {
    expect(first()).toMatchObject({
      level: "A2", activityType: LISTENING_ACTIVITY_TYPES.DIALOGUE, contentType: LISTENING_CONTENT_TYPE
    });
    expect(first().provenance).toMatchObject({ status: "verified", version: 1, verifiedAt: NOW });
  });

  it("keeps the German transcript as the transcript", () => {
    expect(first().transcript).toBe("Guten Tag. Wann fährt der Zug nach Köln?");
  });

  it("exposes optional speaker metadata in order", () => {
    expect(first().speakers.map(s => s.label)).toEqual(["Reisende", "Angestellter"]);
    expect(first().speakers[0]).toMatchObject({ role: "traveller", variety: "de-AT" });
  });

  it("links vocabulary, grammar, sentences and exercises", () => {
    const activity = first();
    expect(activity.vocabulary.map(l => l.uuid)).toEqual(["v-zug"]);
    expect(activity.grammarRules.map(l => l.uuid)).toEqual(["r-wfrage"]);
    expect(activity.grammarTopics.map(l => l.uuid)).toEqual(["t-fragen"]);
    expect(activity.sentences.map(l => l.uuid)).toEqual(["s-zug"]);
    expect(activity.exercises.map(l => l.uuid)).toEqual(["x-de", "x-ar"]);
  });

  it("finds activities practising a given piece of content", () => {
    const all = activities();
    expect(listeningForTarget(all, LISTENING_TARGET_TYPES.VOCABULARY, "v-zug").map(a => a.slug))
      .toEqual(["am-bahnhof"]);
    expect(listeningForTarget(all, LISTENING_TARGET_TYPES.VOCABULARY, "v-nope")).toEqual([]);
    expect(listeningForTarget(all, "not-a-type", "x")).toEqual([]);
  });

  it("skips soft-deleted rows at every level", () => {
    const data = canonical();
    data.listeningItems[0].deleted = 1;       // im-cafe
    data.listeningSegments[0].deleted = 1;    // sg-2
    data.listeningLinks[0].deleted = 1;       // the vocabulary link
    const built = buildListening(data);
    expect(built.map(a => a.slug)).toEqual(["am-bahnhof"]);
    expect(built[0].segments.map(s => s.uuid)).toEqual(["sg-1", "sg-3"]);
    expect(built[0].vocabulary).toEqual([]);
  });

  it("handles an empty catalogue", () => {
    expect(buildListening({})).toEqual([]);
  });
});

/* ------------------------------------------------------------ multilingual */

describe("English and Arabic are peers", () => {
  it("renders titles in all three languages", () => {
    expect(first().title).toEqual({
      de: "Am Bahnhof", en: "At the station", ar: "في المحطة"
    });
  });

  it("gives English and Arabic support the same shape", () => {
    expect(first().support).toEqual({
      en: "A traveller asks about the next train.",
      ar: "مسافر يسأل عن القطار التالي."
    });
    expect(first().coverage.complete).toBe(true);
  });

  it("reports a missing language as null and names it, rather than hiding it", () => {
    const cafe = activities()[1];
    expect(cafe.support).toEqual({ en: null, ar: null });
    expect(cafe.coverage.missing).toEqual(["en", "ar"]);
    expect(cafe.title.de).toBe("Im Café");
  });

  it("supports Arabic-only instructions without Arabic gaining any other role", () => {
    expect(first().instruction.ar).toBe("استمع مرتين ثم أجب.");
    expect(first().instruction.en).toBeNull();
  });

  it("falls back to a translated transcript when there is no summary", () => {
    const data = canonical();
    data.listeningTexts = data.listeningTexts
      .filter(row => row.kind !== LISTENING_TEXT_KINDS.SUMMARY)
      .concat([text("li-1", "en", LISTENING_TEXT_KINDS.TRANSCRIPT, "Good day. When does the train leave?")]);
    expect(buildListening(data)[0].support.en).toBe("Good day. When does the train leave?");
  });
});

/* ---------------------------------------------------------------- segments */

describe("segments", () => {
  it("orders by authored ordering, not by timecode", () => {
    const data = canonical();
    // A mistyped start time must not reorder the dialogue.
    data.listeningSegments.find(s => s.uuid === "sg-1").startMs = 99000;
    expect(buildListening(data)[0].segments.map(s => s.uuid)).toEqual(["sg-1", "sg-2", "sg-3"]);
  });

  it("breaks ties deterministically", () => {
    const tied = [
      { uuid: "b", ordering: 1, startMs: 0 },
      { uuid: "a", ordering: 1, startMs: 0 },
      { uuid: "c", ordering: 1, startMs: 0 }
    ];
    expect(segmentsInOrder(tied).map(s => s.uuid)).toEqual(["a", "b", "c"]);
    expect(segmentsInOrder(tied).map(s => s.uuid)).toEqual(segmentsInOrder(tied).map(s => s.uuid));
  });

  it("carries timecodes, duration and speaker per segment", () => {
    const [segment] = first().segments;
    expect(segment).toMatchObject({ startMs: 0, endMs: 4000, durationMs: 4000 });
    expect(segment.speaker.label).toBe("Reisende");
    expect(first().segments[2].speaker).toBeNull();
  });

  it("carries per-segment German plus English and Arabic support", () => {
    const [segment] = first().segments;
    expect(segment.german).toBe("Wann fährt der Zug nach Köln?");
    expect(segment.support).toEqual({
      en: "When does the train to Cologne leave?", ar: "متى يغادر القطار إلى كولونيا؟"
    });
    expect(first().segments[1].support.ar).toBeNull();
    expect(first().segments[1].coverage.missing).toEqual(["ar"]);
  });

  it("finds the segment playing at a moment", () => {
    const activity = first();
    expect(segmentAt(activity, 0).uuid).toBe("sg-1");
    expect(segmentAt(activity, 3999).uuid).toBe("sg-1");
    expect(segmentAt(activity, 4000).uuid).toBe("sg-2");
    expect(segmentAt(activity, 99000)).toBeNull();
  });

  it("reports timecode problems instead of throwing them at the learner", () => {
    const data = canonical();
    data.listeningSegments.find(s => s.uuid === "sg-2").endMs = 1000;   // ends before it starts
    data.listeningSegments.find(s => s.uuid === "sg-3").endMs = 99000;  // past end of audio
    const issues = segmentIssues(buildListening(data)[0]);
    expect(issues.map(i => i.issue)).toContain("ends-before-it-starts");
    expect(issues.map(i => i.issue)).toContain("past-end-of-audio");
  });

  it("reports overlapping segments", () => {
    const data = canonical();
    data.listeningSegments.find(s => s.uuid === "sg-2").startMs = 2000;
    expect(segmentIssues(buildListening(data)[0]).map(i => i.issue)).toContain("overlaps-previous");
  });

  it("finds no problems in well-formed timecodes", () => {
    expect(segmentIssues(first())).toEqual([]);
  });
});

/* ----------------------------------------------------------------- offline */

describe("offline-first audio", () => {
  it("treats a bundled file with a local path as playable offline", () => {
    expect(first().audio).toMatchObject({
      availability: AUDIO_AVAILABILITY.BUNDLED,
      playableOffline: true,
      localPath: "audio/am-bahnhof.mp3",
      durationMs: 42000
    });
    expect(first().studyable).toBe(true);
  });

  it("does not treat a remote URL as availability", () => {
    const cafe = activities()[1];
    expect(cafe.audio.playableOffline).toBe(false);
    expect(cafe.studyable).toBe(false);
    expect(cafe.audio.missingReason).toBe("not-on-device");
    // The URL is still recorded — as source metadata, kept apart from local reality.
    expect(cafe.audio.source.remoteUrl).toBe("https://example.invalid/im-cafe.mp3");
    expect(cafe.audio.localPath).toBeNull();
  });

  it("names why a remote-only asset cannot be studied", () => {
    const data = canonical();
    data.audioAssets[1].availability = AUDIO_AVAILABILITY.REMOTE;
    expect(buildListening(data)[1].audio.missingReason).toBe("remote-only");
  });

  it("does not call a downloaded file with no path playable", () => {
    expect(isPlayableOffline({ availability: AUDIO_AVAILABILITY.DOWNLOADED, localPath: "" })).toBe(false);
    expect(isPlayableOffline({ availability: AUDIO_AVAILABILITY.DOWNLOADED, localPath: "a.mp3" })).toBe(true);
    expect(isPlayableOffline(null)).toBe(false);
  });

  it("handles an activity with no audio at all", () => {
    const data = canonical();
    data.listeningItems.find(i => i.uuid === "li-1").audioUuid = null;
    const activity = buildListening(data)[0];
    expect(activity.audio.missingReason).toBe("no-audio");
    expect(activity.studyable).toBe(false);
    // The transcript is still readable: losing the file does not lose the teaching.
    expect(activity.transcript).toBeTruthy();
  });

  it("treats a soft-deleted asset as missing rather than using it", () => {
    const data = canonical();
    data.audioAssets[0].deleted = 1;
    expect(buildListening(data)[0].audio.missingReason).toBe("no-audio");
  });

  it("lists what can be studied with the network off", () => {
    expect(offlineReady(activities()).map(a => a.slug)).toEqual(["am-bahnhof"]);
  });

  it("separates where a file is from where it came from", () => {
    const described = describeAsset(canonical().audioAssets[0]);
    expect(Object.keys(described.source).sort()).toEqual(["path", "reference", "remoteUrl", "type"]);
    expect(described.source.path).toBe("03_COURSE_CONTENT/x/am-bahnhof.mp3");
    expect(described.localPath).toBe("audio/am-bahnhof.mp3");
  });
});

/* ----------------------------------------------------------------- scoring */

describe("listening does not grade", () => {
  const exerciseData = {
    exercises: [
      { uuid: "x-de", slug: "train-time", exerciseType: "type_answer", level: "A2",
        ordering: 1, answerLanguage: "de", ...meta },
      { uuid: "x-ar", slug: "train-meaning", exerciseType: "type_answer", level: "A2",
        ordering: 2, answerLanguage: "ar", ...meta }
    ],
    exerciseTexts: [],
    exerciseOptions: [
      { uuid: "o-1", exerciseUuid: "x-de", text: "um zehn Uhr fünfzehn", language: "de",
        isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta },
      // Authored as expected AND scoreable in Arabic: the policy must still refuse it.
      { uuid: "o-2", exerciseUuid: "x-ar", text: "العاشرة والربع", language: "ar",
        isExpected: 1, scoreable: 1, ordering: 1, ...linkMeta }
    ],
    exerciseTargets: []
  };
  const exercises = buildExercises(exerciseData);

  it("delegates gradeable answers to the exercise layer", () => {
    const answers = expectedAnswersForListening(first(), exercises);
    expect(answers.map(a => a.language)).toEqual(["de"]);
    expect(answers[0].text).toBe("um zehn Uhr fünfzehn");
  });

  it("cannot make Arabic scoreable by routing it through listening", () => {
    const answers = expectedAnswersForListening(first(), exercises);
    expect(answers.some(a => a.language === "ar")).toBe(false);
    expect(isGradeable(first(), exercises)).toBe(true);
  });

  it("reports an activity with only Arabic exercises as ungradeable", () => {
    const data = canonical();
    data.listeningLinks = data.listeningLinks.filter(l => l.targetUuid !== "x-de");
    expect(isGradeable(buildListening(data)[0], exercises)).toBe(false);
  });

  it("ignores exercises that are not linked to the activity", () => {
    expect(expectedAnswersForListening({ exercises: [] }, exercises)).toEqual([]);
    expect(expectedAnswersForListening(null, exercises)).toEqual([]);
  });

  it("defines no grading of its own anywhere in the module", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/listening-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["levenshtein", "iscorrect", "validate", "normalizegerman", "quality"]) {
      expect(code, `must not implement ${forbidden}`).not.toContain(forbidden);
    }
    // The single sanctioned route to answers.
    expect(source).toContain('import { expectedAnswersFor } from "./exercise-service.js"');
  });
});

/* --------------------------------------------------------- lesson integration */

describe("lesson and course integration", () => {
  it("joins a lesson through existing lesson_items with no new table", () => {
    const course = buildCurriculum({
      courses: [{ uuid: "c-1", slug: "netzwerk-neu-a2", cefrLevel: "A2", ordering: 1, ...meta }],
      courseUnits: [{ uuid: "u-1", courseUuid: "c-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [{ uuid: "l-1", unitUuid: "u-1", slug: "reisen", cefrLevel: "A2", ordering: 1, ...meta }],
      lessonSections: [{ uuid: "s-1", lessonUuid: "l-1", slug: "hoeren", sectionKind: "reading", ordering: 1, ...meta }],
      lessonItems: [
        { uuid: "i-1", sectionUuid: "s-1", contentType: CONTENT_TYPES.LISTENING, contentUuid: "li-1", ordering: 1, required: 1, ...linkMeta },
        { uuid: "i-2", sectionUuid: "s-1", contentType: CONTENT_TYPES.EXERCISE, contentUuid: "x-de", ordering: 2, required: 1, ...linkMeta }
      ]
    })[0];

    const items = course.units[0].lessons[0].sections[0].items;
    expect(items.map(i => i.contentType)).toEqual(["listening", "exercise"]);
    expect(items[0].contentUuid).toBe("li-1");
    // The activity names the same content type the lesson used.
    expect(first().contentType).toBe(CONTENT_TYPES.LISTENING);
  });
});

/* ---------------------------------------------------- error-learning integration */

describe("error-learning integration", () => {
  const WORD = { id: 1, german: "der Zug", arabic: "قطار", itemType: "noun", article: "der" };

  it("records a German listening mistake as a deterministic listening error", () => {
    const evaluation = validateGermanAnswer("die Zug", WORD, DEFAULT_SETTINGS);
    const context = listeningErrorContext(first(), {
      profileUuid: PROFILE, answerLanguage: "de", skill: "listening", occurredAt: NOW
    });
    const recorded = recordEvaluation(evaluation, context, { now: NOW });

    expect(recorded.event).toMatchObject({
      contentType: "listening", contentUuid: "li-1", skill: "listening", scored: 1
    });
    expect(recorded.links[0].source).toBe(ERROR_SOURCES.DETERMINISTIC);
  });

  it("keeps an Arabic listening answer advisory, so it forms no deterministic pattern", () => {
    const evaluation = evaluateArabicAdvisory("بيت", WORD);
    const context = listeningErrorContext(first(), {
      profileUuid: PROFILE, answerLanguage: "ar", skill: "listening", occurredAt: NOW
    });
    const recorded = recordEvaluation(evaluation, context, { now: NOW });

    expect(recorded.event.scored).toBe(0);
    expect(recorded.links.every(l => l.source === ERROR_SOURCES.ADVISORY)).toBe(true);
    expect(classifyEvaluation(evaluation, { language: "ar" }).scored).toBe(false);
  });

  it("carries no verdict of its own into the error context", () => {
    const context = listeningErrorContext(first(), { profileUuid: PROFILE, answerLanguage: "de" });
    expect(context).not.toHaveProperty("scored");
    expect(context).not.toHaveProperty("isCorrect");
    expect(context).toMatchObject({ contentType: "listening", contentUuid: "li-1" });
  });

  it("handles a missing activity without inventing a content uuid", () => {
    expect(listeningErrorContext(null, { profileUuid: PROFILE }).contentUuid).toBe("");
  });
});

/* --------------------------------------------------------- SRS independence */

describe("listening never schedules", () => {
  it("does not read or write SRS state anywhere in the module", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/listening-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["reviewcards", "schedulecard", "dueat", "intervaldays",
      "ease", "lapses", "mastery", "indexeddb", "sqlite"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves a card untouched across assembly, playback lookup and error context", () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    const activity = first();
    segmentAt(activity, 5000);
    segmentIssues(activity);
    listeningErrorContext(activity, { profileUuid: PROFILE, answerLanguage: "de" });
    offlineReady([activity]);

    expect(JSON.stringify(card)).toBe(before);
  });
});

/* --------------------------------------------------------------- migration */

describe("migration invents no listening content", () => {
  it("creates no assets, activities, transcripts or segments from legacy data", () => {
    const { dataset } = migrateToCanonical({
      words: [{ id: 1, german: "der Zug", arabic: "قطار", itemType: "noun", level: "A2" }],
      cards: [{ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1, intervalDays: 3,
        ease: 2.5, reps: 2, lapses: 1, streak: 1, mastery: 40 }],
      attempts: [], settings: null, profile: null
    }, { now: NOW });

    for (const entity of ["audioAssets", "listeningItems", "listeningTexts", "listeningSpeakers",
      "listeningSegments", "listeningSegmentTexts", "listeningLinks"]) {
      expect(dataset[entity], `${entity} should be empty`).toEqual([]);
    }
    // Everything earned is still preserved, field for field.
    expect(dataset.reviewCards[0]).toMatchObject({ ease: 2.5, mastery: 40, lapses: 1, intervalDays: 3 });
    // And the features before this one are still not fabricated either.
    expect(dataset.courses).toEqual([]);
    expect(dataset.errorEvents).toEqual([]);
    expect(dataset.quarantine).toEqual([]);
  });
});

/* --------------------------------------------------- authoring tool: real files */

describe("audio asset registration", () => {
  const AUDIO_DIR = "03_COURSE_CONTENT/NETZWERK_NEU_A2/AUDIO";

  it("builds deterministic rows from real files", () => {
    const files = [
      { name: "NWn_A2_KB_Audio_1-002.mp3", relativePath: `${AUDIO_DIR}/NWn_A2_KB_Audio_1-002.mp3`, byteSize: 2 },
      { name: "NWn_A2_KB_Audio_1-001.mp3", relativePath: `${AUDIO_DIR}/NWn_A2_KB_Audio_1-001.mp3`, byteSize: 1 }
    ];
    const rows = buildAudioAssetRows(files, { now: NOW, sourceTitle: "Netzwerk neu A2" });
    expect(rows.map(r => r.slug)).toEqual(["nwn-a2-kb-audio-1-001", "nwn-a2-kb-audio-1-002"]);
    expect(rows.map(r => r.uuid)).toEqual(
      buildAudioAssetRows(files, { now: NOW + 1000, sourceTitle: "Netzwerk neu A2" }).map(r => r.uuid)
    );
  });

  it("registers files without inventing anything about their contents", () => {
    const [row] = buildAudioAssetRows(
      [{ name: "NWn_A2_KB_Audio_1-001.mp3", relativePath: `${AUDIO_DIR}/NWn_A2_KB_Audio_1-001.mp3`, byteSize: 1204411 }],
      { now: NOW, sourceTitle: "Netzwerk neu A2" }
    );
    expect(row.durationMs).toBe(0);            // unknown, not guessed
    expect(row.checksum).toBeNull();
    expect(row.contentStatus).toBe("draft");
    expect(row.verifiedAt).toBeNull();
    expect(row.sourceReference).toBe("Netzwerk neu A2 — NWn_A2_KB_Audio_1-001.mp3");
  });

  it("marks repository files as source-only, never as available on a device", () => {
    const rows = buildAudioAssetRows(
      [{ name: "a.mp3", relativePath: "x/a.mp3", byteSize: 1 }], { now: NOW });
    expect(rows[0].availability).toBe(AUDIO_AVAILABILITY.SOURCE_ONLY);
    expect(rows[0].localPath).toBe("");
    expect(isPlayableOffline(rows[0])).toBe(false);
    expect(summarizeManifest(rows).playableOffline).toBe(0);
  });

  it("slugs a file name into an identifier", () => {
    expect(slugFor("NWn_A2_KB_Audio_1-001.mp3")).toBe("nwn-a2-kb-audio-1-001");
    expect(slugFor("Im Café (Teil 2).m4a")).toBe("im-caf-teil-2");
  });

  it("registers the real Netzwerk neu A2 audio that is already in this repository", () => {
    const absolute = path.resolve(process.cwd(), AUDIO_DIR);
    if (!fs.existsSync(absolute)) return;      // media not present in this checkout

    const files = fs.readdirSync(absolute)
      .filter(name => name.toLowerCase().endsWith(".mp3"))
      .map(name => ({ name, relativePath: `${AUDIO_DIR}/${name}`, byteSize: 1 }));
    expect(files.length).toBeGreaterThan(0);

    const rows = buildAudioAssetRows(files, { now: NOW, sourceTitle: "Netzwerk neu A2" });
    expect(new Set(rows.map(r => r.uuid)).size).toBe(rows.length);   // no collisions
    expect(new Set(rows.map(r => r.slug)).size).toBe(rows.length);
    expect(rows.every(r => r.mimeType === "audio/mpeg")).toBe(true);
    expect(rows.every(r => r.availability === AUDIO_AVAILABILITY.SOURCE_ONLY)).toBe(true);
    expect(rows.every(r => r.durationMs === 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------ service */

describe("listening service", () => {
  function repositoriesFor(data) {
    const wrap = rows => ({ all: async () => rows ?? [] });
    return {
      audioAssets: wrap(data.audioAssets), listeningItems: wrap(data.listeningItems),
      listeningTexts: wrap(data.listeningTexts), listeningSpeakers: wrap(data.listeningSpeakers),
      listeningSegments: wrap(data.listeningSegments),
      listeningSegmentTexts: wrap(data.listeningSegmentTexts),
      listeningLinks: wrap(data.listeningLinks)
    };
  }

  it("reads through repositories only", async () => {
    const service = createListeningService(repositoriesFor(canonical()));
    expect((await service.activities()).map(a => a.slug)).toEqual(["am-bahnhof", "im-cafe"]);
    expect((await service.activity("am-bahnhof")).uuid).toBe("li-1");
    expect((await service.activity("li-1")).slug).toBe("am-bahnhof");
    expect(await service.activity("nope")).toBeNull();
  });

  it("reports what is studyable offline", async () => {
    const service = createListeningService(repositoriesFor(canonical()));
    expect((await service.offlineReady()).map(a => a.slug)).toEqual(["am-bahnhof"]);
  });

  it("reports authoring readiness without blocking anything", async () => {
    const service = createListeningService(repositoriesFor(canonical()));
    const readiness = await service.readiness();
    expect(readiness[0]).toMatchObject({ slug: "am-bahnhof", studyable: true, hasTranscript: true });
    expect(readiness[1]).toMatchObject({
      slug: "im-cafe", studyable: false, audioIssue: "not-on-device", hasTranscript: false
    });
    expect(readiness[1].missingSupport).toEqual(["en", "ar"]);
  });

  it("finds activities for a target through the service", async () => {
    const service = createListeningService(repositoriesFor(canonical()));
    expect((await service.forTarget(LISTENING_TARGET_TYPES.SENTENCE, "s-zug")).map(a => a.slug))
      .toEqual(["am-bahnhof"]);
  });

  it("exposes no way to grade or to schedule", () => {
    const service = createListeningService(repositoriesFor(canonical()));
    expect(Object.keys(service).sort())
      .toEqual(["activities", "activity", "forTarget", "offlineReady", "readiness"]);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createListeningService(null)).toThrow(/Repositories are required/);
  });
});
