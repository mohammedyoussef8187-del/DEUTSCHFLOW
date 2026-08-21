// @vitest-environment happy-dom
/*
 * Minimum proof that the Feature G architecture works end to end:
 * canonical rows -> listening service -> component render.
 *
 * The offline case matters most: no <audio> element and no URL may appear for a file
 * that is not on the device, and the teaching must still be readable.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-listening-player.js";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-lesson-view.js";
import {
  AUDIO_AVAILABILITY, LISTENING_ACTIVITY_TYPES, LISTENING_TEXT_KINDS, buildListening
} from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";
import {
  CONTENT_TYPES, SECTION_KINDS, buildCurriculum
} from "../../01_APPLICATION/CURRENT_APP/src/services/curriculum-service.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-listening-player.js"), "utf8");

const NOW = 1775000000000;
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (itemUuid, language, kind, value) =>
  ({ uuid: `lt-${itemUuid}-${language}-${kind}`, itemUuid, language, kind, text: value, ...meta });
const segText = (segmentUuid, language, value) =>
  ({ uuid: `st-${segmentUuid}-${language}`, segmentUuid, language,
     kind: LISTENING_TEXT_KINDS.TRANSCRIPT, text: value, ...meta });

function activity({ availability = AUDIO_AVAILABILITY.BUNDLED, localPath = "audio/am-bahnhof.mp3" } = {}) {
  return buildListening({
    audioAssets: [
      { uuid: "a-1", slug: "am-bahnhof", availability, localPath,
        sourcePath: "03_COURSE_CONTENT/x/am-bahnhof.mp3",
        remoteUrl: "https://example.invalid/am-bahnhof.mp3",
        mimeType: "audio/mpeg", byteSize: 512000, durationMs: 42000, ...meta }
    ],
    listeningItems: [
      { uuid: "li-1", slug: "am-bahnhof", audioUuid: "a-1",
        activityType: LISTENING_ACTIVITY_TYPES.DIALOGUE, level: "A2", ordering: 1, ...meta }
    ],
    listeningTexts: [
      text("li-1", "de", LISTENING_TEXT_KINDS.TITLE, "Am Bahnhof"),
      text("li-1", "de", LISTENING_TEXT_KINDS.TRANSCRIPT, "Wann fährt der Zug nach Köln?"),
      text("li-1", "en", LISTENING_TEXT_KINDS.SUMMARY, "A traveller asks about the next train."),
      text("li-1", "ar", LISTENING_TEXT_KINDS.SUMMARY, "مسافر يسأل عن القطار التالي.")
    ],
    listeningSpeakers: [
      { uuid: "sp-1", itemUuid: "li-1", label: "Reisende", role: "traveller", variety: "de-DE", ordering: 1, ...linkMeta }
    ],
    listeningSegments: [
      { uuid: "sg-2", itemUuid: "li-1", speakerUuid: null, ordering: 2, startMs: 4000, endMs: 9000, ...linkMeta },
      { uuid: "sg-1", itemUuid: "li-1", speakerUuid: "sp-1", ordering: 1, startMs: 0, endMs: 4000, ...linkMeta }
    ],
    listeningSegmentTexts: [
      segText("sg-1", "de", "Wann fährt der Zug nach Köln?"),
      segText("sg-1", "en", "When does the train to Cologne leave?"),
      segText("sg-1", "ar", "متى يغادر القطار إلى كولونيا؟"),
      segText("sg-2", "de", "Um zehn Uhr fünfzehn.")
    ],
    listeningLinks: []
  })[0];
}

async function mount(tag, props) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);
const all = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

afterEach(() => { document.body.innerHTML = ""; });

describe("listening player", () => {
  it("presents the activity with its level, type and duration", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    expect(sr(el, ".title").textContent.trim()).toBe("Am Bahnhof");
    expect(sr(el, ".title").getAttribute("lang")).toBe("de");
    const pills = all(el, ".pill").map(p => p.textContent.trim());
    expect(pills).toContain("A2");
    expect(pills).toContain("dialogue");
    expect(pills).toContain("00:42");
  });

  it("renders the German transcript and both support languages as peers", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    expect(sr(el, ".transcript").textContent.trim()).toBe("Wann fährt der Zug nach Köln?");
    const lines = all(el, ".support .line");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toContain("A traveller asks about the next train.");
    expect(lines[1].textContent).toContain("مسافر يسأل عن القطار التالي.");
  });

  it("says a support language is missing rather than hiding it", async () => {
    const bare = activity();
    bare.support = { en: null, ar: null };
    const el = await mount("df-listening-player", { activity: bare });
    expect(all(el, ".support .line")).toHaveLength(2);
    expect(all(el, ".missing")).toHaveLength(2);
  });

  it("plays a bundled file from its local path", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    const audio = sr(el, "audio");
    expect(audio).not.toBeNull();
    expect(audio.getAttribute("src")).toBe("audio/am-bahnhof.mp3");
    expect(audio.dataset.availability).toBe("bundled");
  });

  it("renders no audio element and no URL when the file is not on the device", async () => {
    const el = await mount("df-listening-player", {
      activity: activity({ availability: AUDIO_AVAILABILITY.SOURCE_ONLY, localPath: "" })
    });
    expect(sr(el, "audio")).toBeNull();
    expect(sr(el, ".unavailable").dataset.reason).toBe("not-on-device");
    expect(el.shadowRoot.innerHTML).not.toContain("https://");
  });

  it("still shows the transcript and translations when the audio is unavailable", async () => {
    const el = await mount("df-listening-player", {
      activity: activity({ availability: AUDIO_AVAILABILITY.REMOTE, localPath: "" })
    });
    expect(sr(el, ".unavailable").dataset.reason).toBe("remote-only");
    expect(sr(el, ".transcript").textContent.trim()).toBe("Wann fährt der Zug nach Köln?");
    expect(all(el, ".support .line")).toHaveLength(2);
  });

  it("marks an offline-ready activity", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    expect(sr(el, '[data-offline="true"]')).not.toBeNull();
    const remote = await mount("df-listening-player", {
      activity: activity({ availability: AUDIO_AVAILABILITY.REMOTE, localPath: "" })
    });
    expect(sr(remote, '[data-offline="true"]')).toBeNull();
  });

  it("lists segments in authored order with timecodes and speakers", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    const segments = all(el, ".segment");
    expect(segments.map(s => s.dataset.segment)).toEqual(["sg-1", "sg-2"]);
    expect(segments[0].querySelector(".time").textContent.trim()).toBe("00:00");
    expect(segments[1].querySelector(".time").textContent.trim()).toBe("00:04");
    expect(segments[0].textContent).toContain("Reisende");
  });

  it("shows per-segment support next to the German", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    const support = all(el, ".segment")[0].querySelector(".seg-support").textContent;
    expect(support).toContain("When does the train to Cologne leave?");
    expect(support).toContain("متى يغادر القطار إلى كولونيا؟");
    expect(all(el, ".segment")[1].querySelector(".seg-support")).toBeNull();
  });

  it("seeks the local audio and announces the choice", async () => {
    const el = await mount("df-listening-player", { activity: activity() });
    const events = [];
    el.addEventListener("segment-select", e => events.push(e.detail));
    sr(el, '[data-segment="sg-2"]').click();
    expect(events).toEqual([{ activityUuid: "li-1", segmentUuid: "sg-2", startMs: 4000 }]);
    expect(sr(el, "audio").currentTime).toBe(4);
  });

  it("still announces a segment choice when there is no audio to seek", async () => {
    const el = await mount("df-listening-player", {
      activity: activity({ availability: AUDIO_AVAILABILITY.SOURCE_ONLY, localPath: "" })
    });
    const events = [];
    el.addEventListener("segment-select", e => events.push(e.detail));
    sr(el, '[data-segment="sg-1"]').click();
    expect(events).toHaveLength(1);
  });

  it("marks the current segment", async () => {
    const el = await mount("df-listening-player", { activity: activity(), currentsegment: "sg-2" });
    expect(sr(el, '[aria-current="true"]').dataset.segment).toBe("sg-2");
  });

  it("renders nothing without an activity", async () => {
    const el = await mount("df-listening-player", { activity: null });
    expect(sr(el, ".activity")).toBeNull();
    expect(sr(el, ".empty")).not.toBeNull();
  });

  it("is read-only and never reaches storage, scoring or scheduling", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard",
      "reviewcard", "dueat", "mastery", "fetch(", "http"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves SRS card data untouched while rendering and seeking", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const el = await mount("df-listening-player", { activity: activity() });
    sr(el, '[data-segment="sg-2"]').click();
    expect(JSON.stringify(card)).toBe(before);
  });
});

describe("lesson integration", () => {
  it("shows a listening activity as a lesson item with no new UI plumbing", async () => {
    const lesson = buildCurriculum({
      courses: [{ uuid: "c-1", slug: "netzwerk-neu-a2", cefrLevel: "A2", ordering: 1, ...meta }],
      courseUnits: [{ uuid: "u-1", courseUuid: "c-1", slug: "unit-1", ordering: 1, ...meta }],
      lessons: [{ uuid: "l-1", unitUuid: "u-1", slug: "reisen", cefrLevel: "A2", ordering: 1, ...meta }],
      lessonSections: [{ uuid: "s-1", lessonUuid: "l-1", slug: "hoeren",
        sectionKind: SECTION_KINDS.READING, ordering: 1, ...meta }],
      lessonItems: [
        { uuid: "i-1", sectionUuid: "s-1", contentType: CONTENT_TYPES.LISTENING,
          contentUuid: "li-1", ordering: 1, required: 1, ...linkMeta }
      ]
    })[0].units[0].lessons[0];

    const el = await mount("df-lesson-view", { lesson });
    const item = sr(el, ".item");
    expect(item.dataset.contentType).toBe("listening");
    expect(item.textContent).toContain("li-1");
    expect(item.textContent).toContain("استماع");
  });
});
