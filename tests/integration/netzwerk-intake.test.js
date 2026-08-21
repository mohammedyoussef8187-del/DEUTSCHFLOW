/*
 * Netzwerk intake: the source assessment that decides whether a parser can be written at
 * all, the audio registration that can be done, and the lesson import that cannot.
 *
 * The point of these tests is the refusal. A language course assembled from a corrupted
 * OCR layer would teach misspelled German with a straight face, so the gate that stops it
 * has to be as well tested as anything that imports.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIN_CHARS_PER_PAGE, TEXT_LAYER, assessTextLayer, suspectSamples
} from "../../tools/intake/text-layer.js";
import {
  classifyNetzwerkFile, parseAudioName, summarizeAudio
} from "../../tools/intake/netzwerk-inventory.mjs";
import {
  audioMappingReport, buildNetzwerkAudioAssets
} from "../../tools/intake/netzwerk-audio.js";
import { planNetzwerk, registerAudio } from "../../tools/intake/run-netzwerk.mjs";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { isPlayableOffline } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";

const NOW = 1775000000000;
const INVENTORY = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "tools/intake/artifacts/netzwerk-inventory.json"), "utf8"));

const cleanup = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()(); });

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return createCanonicalRepositories(adapter);
}

/* Real German prose, as a digital text layer would produce it. */
const GOOD_GERMAN = `
Kapitel 1: Meine Familie und ich
Lesen Sie den Text und beantworten Sie die Fragen. Über welche Personen wird gesprochen?
Die Mutter von Selma ist besorgt, weil sie nicht angerufen hat. Nico erzählt von seiner
eigenen Familie und davon, dass seine Eltern ihm nie zuhören.
Übung 3: Ergänzen Sie die Possessivartikel im Dativ und vergleichen Sie mit Ihrem Partner.
`.repeat(4);

/* The same page as a scanner reads it. */
const OCR_GERMAN = `
Autoren: Stefanie Dcngler, Paul Rusch, Helen Schmitz
Redaktion: Cornelia Rademacher und Annerose Rcmus
Reproduktion: Meyle ♦ Muller GmbH • Co. KG, Pforzheim
Losungen, Transkripte uwn. zum Download unter www.klett-sprachen.de
Tesrheft mit Audios     Klctt-Augmented-App kostenlos
Apple urxl das A^pleLogo sind Matken der Apple bK
`.repeat(4);

/* ------------------------------------------------------- text-layer gate */

describe("the text-layer gate", () => {
  it("passes a real digital text layer", () => {
    const assessment = assessTextLayer(GOOD_GERMAN, 4);
    expect(assessment.verdict).toBe(TEXT_LAYER.DIGITAL);
    expect(assessment.parseable).toBe(true);
    expect(assessment.germanMarkers).toBeGreaterThan(0);
    expect(assessment.reason).toBeNull();
  });

  it("refuses a corrupted machine reading, and says why", () => {
    const assessment = assessTextLayer(OCR_GERMAN, 1);
    expect(assessment.verdict).toBe(TEXT_LAYER.OCR_DEGRADED);
    expect(assessment.parseable).toBe(false);
    expect(assessment.reason).toContain("misspelled German");
    expect(assessment.suspectRate).toBeGreaterThan(0.02);
  });

  it("names the patterns it found, so a person can check the judgement", () => {
    const codes = assessTextLayer(OCR_GERMAN, 1).signals.map(signal => signal.code);
    expect(codes).toContain("broken-umlaut-word");     // "Losungen", "Muller"
    expect(codes).toContain("stray-symbol-in-word");   // "A^pleLogo"
  });

  it("refuses a page with far too little text for its size", () => {
    const assessment = assessTextLayer("Kapitel 1\n\nSeite 4\n", 180);
    expect(assessment.verdict).toBe(TEXT_LAYER.SPARSE);
    expect(assessment.charsPerPage).toBeLessThan(MIN_CHARS_PER_PAGE);
    expect(assessment.reason).toContain("images, not text");
  });

  it("refuses a document with no text at all", () => {
    expect(assessTextLayer("", 200).verdict).toBe(TEXT_LAYER.ABSENT);
    expect(assessTextLayer("\f\f\f", 4).verdict).toBe(TEXT_LAYER.ABSENT);
  });

  it("is deterministic: the same bytes always give the same verdict", () => {
    expect(assessTextLayer(OCR_GERMAN, 3)).toEqual(assessTextLayer(OCR_GERMAN, 3));
  });

  it("shows the worst lines rather than asking anyone to trust a score", () => {
    const samples = suspectSamples(OCR_GERMAN);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.join(" ")).toMatch(/Dcngler|Rcmus|A\^pleLogo|Losungen/);
  });

  it("measures the text and never rewrites it", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "tools/intake/text-layer.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    // No OCR correction of any kind: fixing a scanner's guess means guessing what the
    // page probably said, which is the invention the intake rules exist to prevent.
    for (const forbidden of ["correction", "spellcheck", "dictionary", "autofix", "repair"]) {
      expect(code, `must not ${forbidden}`).not.toContain(forbidden);
    }
    // Everything it exports is a measurement or a sample of the ORIGINAL text.
    const exported = [...source.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1]);
    expect(exported.sort()).toEqual(["MIN_CHARS_PER_PAGE", "TEXT_LAYER", "assessTextLayer", "suspectSamples"]);
    expect(suspectSamples(OCR_GERMAN).every(sample => OCR_GERMAN.includes(sample))).toBe(true);
  });
});

/* ------------------------------------------------------- the real corpus */

describe("what is actually in the repository", () => {
  it("classifies every Netzwerk document by edition, level and component", () => {
    expect(classifyNetzwerkFile("03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 UB.pdf"))
      .toEqual({ edition: "neu", level: "A2", component: "uebungsbuch" });
    expect(classifyNetzwerkFile("03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 KB.pdf"))
      .toEqual({ edition: "neu", level: "A2", component: "kursbuch" });
    expect(classifyNetzwerkFile("03_COURSE_CONTENT/NETZWERK_A1/Netzwerk Neu A1 - Kursbuch.pdf"))
      .toEqual({ edition: "neu", level: "A1", component: "kursbuch" });
  });

  it("finds four documents, none of which can be parsed", () => {
    expect(INVENTORY.documents).toHaveLength(4);
    expect(INVENTORY.parseableDocuments).toEqual([]);
    expect(INVENTORY.blockedDocuments).toHaveLength(4);
    for (const blocked of INVENTORY.blockedDocuments) {
      expect([TEXT_LAYER.ABSENT, TEXT_LAYER.SPARSE, TEXT_LAYER.OCR_DEGRADED])
        .toContain(blocked.verdict);
    }
  });

  it("records the measurement behind each refusal", () => {
    const kursbuch = INVENTORY.documents.find(document => /A2 KB\.pdf$/.test(document.path));
    expect(kursbuch.textLayer.pages).toBeGreaterThan(150);
    expect(kursbuch.textLayer.charsPerPage).toBeLessThan(1);
    expect(kursbuch.textLayer.verdict).toBe(TEXT_LAYER.ABSENT);
  });

  it("treats the two A2 Kursbuch files as different files, not duplicates", () => {
    const kursbuecher = INVENTORY.documents.filter(document => document.component === "kursbuch"
      && document.level === "A2");
    expect(kursbuecher).toHaveLength(2);
    // Similar size, different bytes: size is never identity.
    expect(kursbuecher[0].sha256).not.toBe(kursbuecher[1].sha256);
    expect(Math.abs(kursbuecher[0].size - kursbuecher[1].size) / kursbuecher[0].size)
      .toBeLessThan(0.02);
    expect(INVENTORY.duplicates).toEqual([]);
  });

  it("identifies every file by SHA-256", () => {
    for (const document of INVENTORY.documents) {
      expect(document.sha256, document.path).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("plans no lesson and states that no parser was written", () => {
    const plan = planNetzwerk(INVENTORY);
    expect(plan.lessonsPossible).toBe(0);
    expect(plan.parserStatus).toBe("not-written-no-readable-source");
    expect(plan.blocked).toHaveLength(4);
    expect(plan.documents.every(document => document.decision === "blocked-malformed-source")).toBe(true);
  });

  it("reports coverage per level from evidence", () => {
    const plan = planNetzwerk(INVENTORY);
    const a2 = plan.coverage.find(entry => entry.level === "A2");
    expect(a2.components).toContain("uebungsbuch");
    expect(a2.parseableComponents).toEqual([]);
    expect(a2.audioTracks).toBe(189);
  });
});

/* ------------------------------------------------------------------ audio */

describe("audio identity and mapping", () => {
  it("reads book, disc and track from the publisher's naming convention", () => {
    expect(parseAudioName("NWn_A2_KB_Audio_1-001.mp3"))
      .toEqual({ level: "A2", book: "kursbuch", disc: 1, track: 1 });
    expect(parseAudioName("NWn_A2_UeB_Audio_1-068.mp3"))
      .toEqual({ level: "A2", book: "uebungsbuch", disc: 1, track: 68 });
    expect(parseAudioName("something-else.mp3")).toBeNull();
  });

  it("finds 189 recordings, every one distinct by SHA-256", () => {
    expect(INVENTORY.audio.total).toBe(189);
    expect(INVENTORY.audio.distinct).toBe(189);
  });

  it("groups the tracks by book and disc, with no gaps", () => {
    const keys = INVENTORY.audio.groups.map(group => group.key).sort();
    expect(keys).toEqual(["A2:kursbuch:1", "A2:kursbuch:2", "A2:uebungsbuch:1"]);
    for (const group of INVENTORY.audio.groups) expect(group.missingTracks).toBe(0);
  });

  it("counts a gap when one really exists", () => {
    const summary = summarizeAudio([
      { sha256: "a", naming: { level: "A2", book: "kursbuch", disc: 1, track: 1 } },
      { sha256: "b", naming: { level: "A2", book: "kursbuch", disc: 1, track: 3 } }
    ]);
    expect(summary.groups[0].missingTracks).toBe(1);
  });

  it("maps no track to any lesson, and says why", () => {
    const report = audioMappingReport(INVENTORY.audio.files);
    expect(report.identified).toBe(189);
    expect(report.mappedToLessons).toBe(0);
    expect(report.unresolvedMappings).toBe(189);
    expect(report.unresolvedReason).toContain("no readable text layer");
    expect(report.deterministicFields).toEqual(["level", "book", "disc", "track"]);
  });

  it("registers an asset with its true identity and availability", () => {
    const [asset] = buildNetzwerkAudioAssets(INVENTORY.audio.files.slice(0, 1), { now: NOW });
    expect(asset).toMatchObject({
      availability: "source-only", localPath: "", remoteUrl: null,
      mimeType: "audio/mpeg", durationMs: 0, contentStatus: "imported"
    });
    expect(asset.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(asset.sourceReference).toContain("Audio");
    // The file is in the repository, not on a device, so it is not playable.
    expect(isPlayableOffline(asset)).toBe(false);
  });

  it("derives identity from the path, so a rescan produces the same uuids", () => {
    const first = buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW });
    const later = buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW + 9_000_000 });
    expect(later.map(asset => asset.uuid)).toEqual(first.map(asset => asset.uuid));
    expect(new Set(first.map(asset => asset.uuid)).size).toBe(first.length);
    expect(new Set(first.map(asset => asset.slug)).size).toBe(first.length);
  });

  it("orders by the publisher's own numbering", () => {
    const assets = buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW });
    expect(assets[0].slug).toBe("netzwerk-neu-a2-kursbuch-1-001");
    expect(assets.at(-1).slug).toBe("netzwerk-neu-a2-uebungsbuch-1-068");
  });

  it("skips a file whose name establishes no identity", () => {
    expect(buildNetzwerkAudioAssets([{ path: "x/y.mp3", size: 1, sha256: "z", naming: null }]))
      .toEqual([]);
  });
});

/* ------------------------------------------------------------ registration */

describe("registering the audio", () => {
  it("writes the assets and nothing else", async () => {
    const repositories = await freshStore();
    const assets = buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW });
    const result = await registerAudio(repositories, assets, { now: NOW });

    expect(result).toEqual({ created: 189, reused: 0 });
    expect(await repositories.audioAssets.count()).toBe(189);
    // No listening activity: nothing in the repository says what these recordings teach.
    expect(await repositories.listeningItems.count()).toBe(0);
    expect(await repositories.lessons.count()).toBe(0);
    expect(await repositories.vocabulary.count()).toBe(0);
  });

  it("is idempotent", async () => {
    const repositories = await freshStore();
    const assets = buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW });
    await registerAudio(repositories, assets, { now: NOW });
    const second = await registerAudio(repositories, assets, { now: NOW + 9_000_000 });

    expect(second).toEqual({ created: 0, reused: 189 });
    expect(await repositories.audioAssets.count()).toBe(189);
  });

  it("keeps every asset unplayable until it is genuinely on a device", async () => {
    const repositories = await freshStore();
    await registerAudio(repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }));
    const stored = await repositories.audioAssets.find({ availability: "source-only" });
    expect(stored).toHaveLength(189);
    expect(stored.every(asset => isPlayableOffline(asset) === false)).toBe(true);
  });

  it("leaves existing Nicos content untouched", async () => {
    const repositories = await freshStore();
    await repositories.courses.insert({
      uuid: "c-nicos", slug: "nicos-weg-a2", cefrLevel: "A2", ordering: 1,
      sourceTitle: "Nicos Weg", sourcePublisher: "Deutsche Welle",
      contentStatus: "imported", contentVersion: 1, createdAt: NOW, updatedAt: NOW,
      revision: 1, deleted: 0
    }, { now: NOW });
    const before = await repositories.courses.get("c-nicos");

    await registerAudio(repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }));
    expect(await repositories.courses.get("c-nicos")).toEqual(before);
    expect(await repositories.courses.count()).toBe(1);
  });

  it("touches no SRS row", async () => {
    const repositories = await freshStore();
    await registerAudio(repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }));
    expect(await repositories.cards.count()).toBe(0);
    expect(await repositories.events.count()).toBe(0);
  });
});
