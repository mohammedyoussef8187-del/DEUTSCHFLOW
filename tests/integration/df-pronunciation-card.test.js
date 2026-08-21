// @vitest-environment happy-dom
/*
 * Minimum proof that the Feature H architecture works end to end:
 * canonical rows -> pronunciation service -> component render.
 *
 * The self-assessment case matters most: for a spoken item the only controls are the
 * learner's own rating, and the card says outright that the app does not judge speech.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-pronunciation-card.js";
import {
  FEATURE_KINDS, OWNER_TYPES, PRACTICE_MODES, PRONUNCIATION_TEXT_KINDS, TARGET_TYPES,
  buildPronunciation, buildPronunciationAttempt, summarizeAttempts
} from "../../01_APPLICATION/CURRENT_APP/src/services/pronunciation-service.js";
import { AUDIO_AVAILABILITY } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-pronunciation-card.js"), "utf8");

const NOW = 1775000000000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const text = (ownerType, ownerUuid, language, kind, value) =>
  ({ uuid: `pt-${ownerUuid}-${language}-${kind}`, ownerType, ownerUuid, language, kind, text: value, ...meta });

function build({ availability = AUDIO_AVAILABILITY.BUNDLED, localPath = "audio/ue.mp3",
                 practiceMode = PRACTICE_MODES.LISTEN_REPEAT } = {}) {
  return buildPronunciation({
    audioAssets: [
      { uuid: "a-1", slug: "ue", availability, localPath, sourcePath: "",
        remoteUrl: "https://example.invalid/ue.mp3", mimeType: "audio/mpeg",
        byteSize: 1000, durationMs: 1500, ...meta }
    ],
    pronunciationFeatures: [
      { uuid: "f-ue", slug: "front-rounded-u", featureKind: FEATURE_KINDS.PHONEME,
        ipa: "yː", level: "A1", ordering: 1, ...meta }
    ],
    pronunciationTexts: [
      text(OWNER_TYPES.FEATURE, "f-ue", "en", PRONUNCIATION_TEXT_KINDS.NAME, "Front rounded ü"),
      text(OWNER_TYPES.FEATURE, "f-ue", "ar", PRONUNCIATION_TEXT_KINDS.ADVICE, "قل «i» ثم دوّر شفتيك.")
    ],
    pronunciationItems: [
      { uuid: "pi-1", slug: "buecher", featureUuid: "f-ue", practiceMode,
        targetType: TARGET_TYPES.VOCABULARY, targetUuid: "v-buch",
        modelAudioUuid: "a-1", level: "A1", ordering: 1, ...meta }
    ],
    pronunciationVariants: [
      { uuid: "pv-1", itemUuid: "pi-1", ipa: "ˈbyːçɐ", syllables: "Bü·cher", stressIndex: 0,
        variety: "de-DE", isPrimary: 1, audioUuid: "a-1", ordering: 1, ...meta },
      { uuid: "pv-2", itemUuid: "pi-1", ipa: "ˈbyːxɐ", syllables: "Bü·cher", stressIndex: 0,
        variety: "de-AT", isPrimary: 0, audioUuid: null, ordering: 2, ...meta }
    ],
    pronunciationPairs: [
      { uuid: "pp-1", featureUuid: "f-ue", aText: "Bücher", aVocabUuid: "v-buch", aAudioUuid: "a-1",
        bText: "Bucher", bVocabUuid: null, bAudioUuid: null, ordering: 1, ...meta }
    ],
    pronunciationLinks: [
      { uuid: "pl-1", itemUuid: "pi-1", targetType: TARGET_TYPES.EXERCISE, targetUuid: "x-de", ordering: 1, ...linkMeta }
    ]
  })[0];
}

async function mount(props) {
  const el = document.createElement("df-pronunciation-card");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);
const all = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

afterEach(() => { document.body.innerHTML = ""; });

describe("pronunciation card", () => {
  it("presents IPA, syllables and the stressed syllable", async () => {
    const el = await mount({ item: build() });
    expect(sr(el, ".ipa").textContent.trim()).toBe("[ˈbyːçɐ]");
    const syllables = all(el, ".syl");
    expect(syllables.map(s => s.textContent.trim())).toEqual(["Bü", "cher"]);
    expect(syllables[0].dataset.stressed).toBe("true");
    expect(syllables[1].dataset.stressed).toBe("false");
  });

  it("shows the level, practice mode and the feature's IPA", async () => {
    const el = await mount({ item: build() });
    const pills = all(el, ".pill").map(p => p.textContent.trim());
    expect(pills).toContain("A1");
    expect(pills).toContain("listen_repeat");
    expect(pills).toContain("yː");
  });

  it("lists accepted regional realizations, primary first", async () => {
    const el = await mount({ item: build() });
    const variants = all(el, ".variant");
    expect(variants.map(v => v.dataset.variety)).toEqual(["de-DE", "de-AT"]);
    expect(variants[0].querySelector('[data-primary="true"]')).not.toBeNull();
    expect(variants[1].querySelector('[data-primary="true"]')).toBeNull();
  });

  it("shows the feature's advice in the language it exists in", async () => {
    const el = await mount({ item: build() });
    expect(el.shadowRoot.textContent).toContain("قل «i» ثم دوّر شفتيك.");
  });

  it("shows minimal pairs", async () => {
    const el = await mount({ item: build() });
    const pair = sr(el, ".pair");
    expect(pair.dataset.pair).toBe("pp-1");
    expect(pair.textContent).toContain("Bücher");
    expect(pair.textContent).toContain("Bucher");
  });

  it("plays a bundled model recording from its local path", async () => {
    const el = await mount({ item: build() });
    expect(sr(el, "audio").getAttribute("src")).toBe("audio/ue.mp3");
    expect(sr(el, '[data-offline="true"]')).not.toBeNull();
  });

  it("renders no audio element and no URL when the model is not on the device", async () => {
    const el = await mount({
      item: build({ availability: AUDIO_AVAILABILITY.REMOTE, localPath: "" })
    });
    expect(sr(el, "audio")).toBeNull();
    expect(sr(el, ".unavailable").dataset.reason).toBe("remote-only");
    expect(el.shadowRoot.innerHTML).not.toContain("https://");
    // The teaching survives the missing file.
    expect(sr(el, ".ipa").textContent.trim()).toBe("[ˈbyːçɐ]");
  });
});

describe("self-assessment is visible, not implied", () => {
  it("offers only the learner's own rating for a spoken item", async () => {
    const el = await mount({ item: build() });
    expect(sr(el, '[data-self-assessed="true"]')).not.toBeNull();
    expect(all(el, ".rating").map(b => b.dataset.rating)).toEqual(["1", "2", "3", "4"]);
    expect(el.shadowRoot.textContent).toContain("التطبيق لا يحكم على نطقك آلياً");
  });

  it("announces the learner's rating rather than deciding anything", async () => {
    const el = await mount({ item: build() });
    const events = [];
    el.addEventListener("self-rate", e => events.push(e.detail));
    sr(el, '[data-rating="3"]').click();
    expect(events).toEqual([{ itemUuid: "pi-1", selfRating: 3 }]);
  });

  it("marks the learner's last rating", async () => {
    const attempt = buildPronunciationAttempt(
      { profileUuid: PROFILE, itemUuid: "pi-1", occurredAt: NOW, selfRating: 2 }, { now: NOW });
    const el = await mount({
      item: build(),
      history: summarizeAttempts({ pronunciationAttempts: [attempt] }, PROFILE, "pi-1")
    });
    expect(sr(el, '[aria-pressed="true"]').dataset.rating).toBe("2");
  });

  it("shows a recognizer's score as labelled advice, never as a verdict", async () => {
    const attempt = buildPronunciationAttempt(
      { profileUuid: PROFILE, itemUuid: "pi-1", occurredAt: NOW, selfRating: 4,
        advisoryScore: 0.31, advisorySource: "asr" }, { now: NOW });
    const el = await mount({
      item: build(),
      history: summarizeAttempts({ pronunciationAttempts: [attempt] }, PROFILE, "pi-1")
    });
    const advisory = sr(el, '[data-advisory="true"]');
    expect(advisory.textContent).toContain("31%");
    expect(advisory.textContent).toContain("asr");
    expect(advisory.textContent).toContain("تقدير استرشادي");
    // The learner said 4 and the recognizer said 31%. The learner's rating still stands.
    expect(sr(el, '[aria-pressed="true"]').dataset.rating).toBe("4");
  });

  it("offers no self-rating for a discrimination item, which the evaluator scores", async () => {
    const el = await mount({ item: build({ practiceMode: PRACTICE_MODES.DISCRIMINATE }) });
    expect(sr(el, '[data-self-assessed="true"]')).toBeNull();
    expect(all(el, ".rating")).toHaveLength(0);
    expect(sr(el, '[data-mode="discriminate"]')).not.toBeNull();
  });

  it("renders nothing without an item", async () => {
    const el = await mount({ item: null });
    expect(sr(el, ".card")).toBeNull();
    expect(sr(el, ".empty")).not.toBeNull();
  });
});

describe("the card is read-only", () => {
  it("never reaches storage, scoring or scheduling", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard",
      "reviewcard", "dueat", "mastery", "iscorrect", "fetch(", "http"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves SRS card data untouched while rendering and rating", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    const el = await mount({ item: build() });
    sr(el, '[data-rating="1"]').click();
    expect(JSON.stringify(card)).toBe(before);
  });
});
