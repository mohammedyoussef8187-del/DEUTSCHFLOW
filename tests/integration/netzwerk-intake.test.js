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
import {
  planNetzwerk, registerAudio, runNetzwerkChapter, runNetzwerkCourse
} from "../../tools/intake/run-netzwerk.mjs";
import {
  buildNetzwerkChapter, buildNetzwerkCourse
} from "../../tools/intake/map-netzwerk.js";
import { verifyImport } from "../../tools/intake/import.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import { isPlayableOffline } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";

const NOW = 1775000000000;
const INVENTORY = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "tools/intake/artifacts/netzwerk-inventory.json"), "utf8"));
const MIGRATION_FIXTURE = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "tests/fixtures/migration_snapshot.json"), "utf8"));

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

/* ====================================================================== */
/* Kapitel 2 — the reviewed rights-safe slice, end to end.                */
/*                                                                        */
/* The Netzwerk books here are unreadable scans, so this imports no       */
/* publisher wording at all: a course frame, one chapter, and the         */
/* identity of sixteen local audio files whose lesson placement is        */
/* deliberately left unresolved.                                          */
/* ====================================================================== */

describe("Kapitel 2 safe slice", () => {
  const CONTROL = path.resolve(process.cwd(), "00_PROJECT_CONTROL");
  const readControl = name => JSON.parse(fs.readFileSync(path.join(CONTROL, name), "utf8"));

  const artifacts = () => ({
    manifest: readControl("NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json"),
    structureIndex: readControl("NETZWERK_NEU_A2_STRUCTURE_INDEX.json"),
    audioAssetIndex: readControl("NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json"),
    safeSlice: readControl("NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json")
  });

  const built = (now = NOW) => buildNetzwerkChapter({ ...artifacts(), chapter: 2, now });

  const counts = async repositories => ({
    courses: await repositories.courses.count(),
    courseLevels: await repositories.courseLevels.count(),
    courseUnits: await repositories.courseUnits.count(),
    lessons: await repositories.lessons.count(),
    curriculumTexts: await repositories.curriculumTexts.count(),
    audioAssets: await repositories.audioAssets.count(),
    lessonSections: await repositories.lessonSections.count(),
    lessonItems: await repositories.lessonItems.count(),
    vocabulary: await repositories.vocabulary.count(),
    sentences: await repositories.sentences.count(),
    exercises: await repositories.exercises.count(),
    listeningItems: await repositories.listeningItems.count()
  });

  it("previews 22 creates and writes nothing", async () => {
    const repositories = await freshStore();
    const result = await runNetzwerkChapter(repositories, built(), { apply: false, now: NOW });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("preview-only");
    expect(result.plan.total).toBe(22);
    expect(result.plan.create).toHaveLength(22);
    expect(result.plan.update).toEqual([]);
    expect(result.plan.conflicts).toEqual([]);
    expect(result.plan.isNoop).toBe(false);

    // Nothing at all reached the store.
    expect(Object.values(await counts(repositories)).every(count => count === 0)).toBe(true);
  });

  it("applies and verifies exactly the 22-row slice", async () => {
    const repositories = await freshStore();
    const result = await runNetzwerkChapter(repositories, built(), { apply: true, now: NOW });

    expect(result.applied).toBe(true);
    expect(result.written).toMatchObject({
      courses: 1, audioAssets: 16, vocabulary: 0, sentences: 0, listening: 0, exercises: 0
    });
    expect(result.verification.ok).toBe(true);
    expect(result.verification.course).toMatchObject({ slug: "netzwerk-neu-a2", cefrLevel: "A2" });
    expect(result.verification.lesson).toMatchObject({ slug: "nach-der-schulzeit" });
    expect(result.verification.audioAssets).toMatchObject({
      expected: 16, found: 16, sourceOnly: 16, playable: 0, missingUuids: [], mismatchedUuids: []
    });

    expect(await counts(repositories)).toEqual({
      courses: 1, courseLevels: 1, courseUnits: 1, lessons: 1,
      curriculumTexts: 2, audioAssets: 16,
      // No educational content, and nothing to hang it on.
      lessonSections: 0, lessonItems: 0, vocabulary: 0, sentences: 0,
      exercises: 0, listeningItems: 0
    });
  });

  it("keeps every imported asset source-only and unplayable", async () => {
    const repositories = await freshStore();
    await runNetzwerkChapter(repositories, built(), { apply: true, now: NOW });

    const stored = await repositories.audioAssets.all();
    expect(stored).toHaveLength(16);
    for (const asset of stored) {
      expect(asset.availability).toBe("source-only");
      expect(asset.localPath).toBe("");
      expect(asset.remoteUrl).toBeNull();
      expect(asset.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(asset.durationMs).toBeGreaterThan(0);
      expect(asset.sourceReference).toContain("page/exercise unresolved");
      expect(isPlayableOffline(asset)).toBe(false);
    }
  });

  it("is a byte-identical no-op on the second run", async () => {
    const repositories = await freshStore();
    await runNetzwerkChapter(repositories, built(NOW), { apply: true, now: NOW });

    const before = await counts(repositories);
    const snapshot = async () => JSON.stringify([
      await repositories.courses.all(), await repositories.lessons.all(),
      await repositories.curriculumTexts.all(), await repositories.audioAssets.all()
    ]);
    const original = await snapshot();

    // A different clock must not make the same evidence look like a change.
    const second = await runNetzwerkChapter(repositories, built(NOW + 9_000_000),
      { apply: true, now: NOW + 9_000_000 });

    expect(second.applied).toBe(false);
    expect(second.reason).toBe("no-changes");
    expect(second.plan.unchanged).toHaveLength(22);
    expect(second.plan.create).toEqual([]);
    expect(second.plan.update).toEqual([]);
    expect(second.plan.isNoop).toBe(true);

    expect(await counts(repositories)).toEqual(before);
    expect(await snapshot()).toBe(original);
  });

  it("reuses the sixteen Kapitel uuids when the full inventory is registered", async () => {
    const repositories = await freshStore();
    await runNetzwerkChapter(repositories, built(), { apply: true, now: NOW });
    const chapterAssets = await repositories.audioAssets.all();

    const registration = await registerAudio(
      repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }), { now: NOW });

    // The reviewed rows already exist and are not written a second time.
    expect(registration).toEqual({ created: 173, reused: 16 });
    expect(await repositories.audioAssets.count()).toBe(189);
    for (const asset of chapterAssets) {
      // Measured duration and provenance survive the bulk registration untouched.
      expect(await repositories.audioAssets.get(asset.uuid)).toEqual(asset);
    }
  });

  it("refuses to apply when a verified row would change", async () => {
    const repositories = await freshStore();
    await runNetzwerkChapter(repositories, built(), { apply: true, now: NOW });

    const lesson = await repositories.lessons.findOne({ slug: "nach-der-schulzeit" });
    await repositories.lessons.update(lesson.uuid, { contentStatus: "verified" }, { now: NOW });

    const changed = built();
    changed.mapped.course.lessons[0].slug = "nach-der-schulzeit-neu";

    const result = await runNetzwerkChapter(repositories, changed, { apply: true, now: NOW });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("source-conflict");
    expect(result.plan.conflicts).toHaveLength(1);
    // The reviewed row survived untouched.
    expect((await repositories.lessons.get(lesson.uuid)).slug).toBe("nach-der-schulzeit");
  });

  it("refuses to apply a slice that failed validation", async () => {
    const repositories = await freshStore();
    const input = artifacts();
    input.safeSlice = structuredClone(input.safeSlice);
    input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
      .sourceRecord.page = 17;

    const result = await runNetzwerkChapter(
      repositories, buildNetzwerkChapter({ ...input, chapter: 2, now: NOW }),
      { apply: true, now: NOW });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("validation-failed");
    expect(result.plan).toBeNull();
    expect(await repositories.courses.count()).toBe(0);
  });

  it("rolls the entire batch back when a later audio row is invalid", async () => {
    const repositories = await freshStore();
    const broken = built();
    // A path the schema will not accept, part-way through the audio run.
    broken.mapped.audioAssets[8].sourcePath = null;

    await expect(runNetzwerkChapter(repositories, broken, { apply: true, now: NOW }))
      .rejects.toThrow();

    // Not one row survives: not the course written first, nor the earlier assets.
    expect(Object.values(await counts(repositories)).every(count => count === 0)).toBe(true);
  });

  it("reports an asset it cannot read back rather than passing verification", async () => {
    const repositories = await freshStore();
    const applied = built();
    await runNetzwerkChapter(repositories, applied, { apply: true, now: NOW });

    /*
     * Verification is what the orchestrator commits on, so it has to fail loudly when
     * the store does not hold what the batch claimed. Here it is asked about an asset
     * that was never written.
     */
    const phantom = { ...applied.mapped.audioAssets[0], uuid: "phantom-uuid", slug: "phantom" };
    const verification = await verifyImport(
      createServices(repositories),
      { ...applied.mapped, audioAssets: [...applied.mapped.audioAssets, phantom] },
      "local",
      { repositories }
    );

    expect(verification.ok).toBe(false);
    expect(verification.audioAssets).toMatchObject({ expected: 17, found: 16 });
    expect(verification.audioAssets.missingUuids).toEqual(["phantom-uuid"]);
  });

  it("reports an asset whose stored identity drifted", async () => {
    const repositories = await freshStore();
    const applied = built();
    await runNetzwerkChapter(repositories, applied, { apply: true, now: NOW });

    // A registered asset whose digest changed is a different file wearing the same name.
    const asset = applied.mapped.audioAssets[0];
    await repositories.audioAssets.update(asset.uuid,
      { checksum: `sha256:${"0".repeat(64)}` }, { now: NOW });

    const verification = await verifyImport(createServices(repositories), applied.mapped,
      "local", { repositories });
    expect(verification.ok).toBe(false);
    expect(verification.audioAssets.mismatchedUuids).toEqual([asset.uuid]);
  });
  it("preserves existing Nicos content and learner SRS rows", async () => {
    const repositories = await freshStore();

    // Real learner/SRS rows, produced by the migration from the committed snapshot.
    const { dataset } = migrateToCanonical(MIGRATION_FIXTURE.clean, { now: NOW });
    await repositories.lifecycle.importCanonical(dataset);

    const before = {
      cards: await repositories.cards.all(),
      events: await repositories.events.all(),
      vocabulary: await repositories.vocabulary.all(),
      profiles: await repositories.profiles.all()
    };
    expect(before.cards.length).toBeGreaterThan(0);

    await runNetzwerkChapter(repositories, built(), { apply: true, now: NOW });

    expect(await repositories.cards.all()).toEqual(before.cards);
    expect(await repositories.events.all()).toEqual(before.events);
    expect(await repositories.profiles.all()).toEqual(before.profiles);
    // The migrated vocabulary is untouched: this slice imports no vocabulary at all.
    expect(await repositories.vocabulary.all()).toEqual(before.vocabulary);
  });

  it("leaves a legacy card object byte-identical", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const snapshot = JSON.stringify(card);

    await runNetzwerkChapter(await freshStore(), built(), { apply: true, now: NOW });
    expect(JSON.stringify(card)).toBe(snapshot);
  });
});

/* ====================================================================== */
/* The whole 12-chapter structure, end to end.                            */
/* ====================================================================== */

describe("Netzwerk neu A2 course structure", () => {
  const CONTROL = path.resolve(process.cwd(), "00_PROJECT_CONTROL");
  const readControl = name => JSON.parse(fs.readFileSync(path.join(CONTROL, name), "utf8"));

  const artifacts = () => ({
    manifest: readControl("NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json"),
    structureIndex: readControl("NETZWERK_NEU_A2_STRUCTURE_INDEX.json"),
    audioAssetIndex: readControl("NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json"),
    safeSlice: readControl("NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json")
  });

  const course = (now = NOW) => buildNetzwerkCourse({ ...artifacts(), now });

  const structureCounts = async repositories => ({
    courses: await repositories.courses.count(),
    courseLevels: await repositories.courseLevels.count(),
    courseUnits: await repositories.courseUnits.count(),
    lessons: await repositories.lessons.count(),
    curriculumTexts: await repositories.curriculumTexts.count()
  });

  const contentCounts = async repositories => ({
    vocabulary: await repositories.vocabulary.count(),
    meanings: await repositories.meanings.count(),
    translations: await repositories.translations.count(),
    acceptedAnswers: await repositories.acceptedAnswers.count(),
    sentences: await repositories.sentences.count(),
    grammarTopics: await repositories.grammarTopics.count(),
    grammarRules: await repositories.grammarRules.count(),
    exercises: await repositories.exercises.count(),
    listeningItems: await repositories.listeningItems.count(),
    listeningTexts: await repositories.listeningTexts.count(),
    lessonSections: await repositories.lessonSections.count(),
    lessonItems: await repositories.lessonItems.count()
  });

  it("previews 30 creates and writes nothing", async () => {
    const repositories = await freshStore();
    const result = await runNetzwerkCourse(repositories, course(), { apply: false, now: NOW });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("preview-only");
    expect(result.plan.create).toHaveLength(30);
    expect(result.plan.conflicts).toEqual([]);
    expect(Object.values(await structureCounts(repositories)).every(count => count === 0)).toBe(true);
  });

  it("imports all twelve chapters and verifies them through the services", async () => {
    const repositories = await freshStore();
    const result = await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    expect(result.applied).toBe(true);
    expect(result.verification.ok).toBe(true);
    expect(result.verification.claimedLessons).toBe(12);
    expect(result.verification.missingLessons).toEqual([]);
    expect(result.verification.lessons).toBe(12);

    expect(await structureCounts(repositories)).toEqual({
      courses: 1, courseLevels: 1, courseUnits: 2, lessons: 12, curriculumTexts: 14
    });
  });

  it("reads the twelve chapters back in printed order through the curriculum service", async () => {
    const repositories = await freshStore();
    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    const [assembled] = await createServices(repositories).curriculum.courses();
    expect(assembled.slug).toBe("netzwerk-neu-a2");
    expect(assembled.units.map(unit => unit.slug)).toEqual(["a2-1", "a2-2"]);

    const lessons = assembled.units.flatMap(unit => unit.lessons);
    expect(lessons).toHaveLength(12);
    expect(lessons.map(lesson => lesson.title.de)).toEqual([
      "Und was machst du?", "Nach der Schulzeit", "Immer online?",
      "Große und kleine Gefühle", "Leben in der Stadt", "Arbeitswelten",
      "Ganz schön mobil", "Gelernt ist gelernt!", "Sportlich, sportlich",
      "Zusammen leben", "Wie die Zeit vergeht!", "Gute Unterhaltung!"
    ]);
    // No official English or Arabic title exists, so the UI shows them missing.
    expect(lessons.every(lesson => lesson.title.en === null && lesson.title.ar === null)).toBe(true);
  });

  it("shows every chapter as empty rather than as a lesson with blank screens", async () => {
    const repositories = await freshStore();
    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    const [assembled] = await createServices(repositories).curriculum.courses();
    for (const lesson of assembled.units.flatMap(unit => unit.lessons)) {
      // A chapter with no eligible content has no section and therefore no item: the
      // learner sees a chapter that is not ready, not an empty exercise screen.
      expect(lesson.sections, lesson.slug).toEqual([]);
    }
  });

  it("keeps the Kapitel 1 anomaly in the store, and out of the chapter title", async () => {
    const repositories = await freshStore();
    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    const first = await repositories.lessons.findOne({ ordering: 1 });
    const texts = await repositories.curriculumTexts.find({ ownerUuid: first.uuid });
    expect(texts.map(text => [text.kind, text.text]).sort()).toEqual([
      ["title", "Und was machst du?"],
      ["transcript-heading", "Das bin ich."]
    ].sort());

    // The service renders the printed title; the anomaly is stored but never shown as one.
    const [assembled] = await createServices(repositories).curriculum.courses();
    const lesson = assembled.units.flatMap(unit => unit.lessons).find(entry => entry.ordering === 1);
    expect(lesson.title.de).toBe("Und was machst du?");
  });

  it("is a byte-identical no-op on the second run", async () => {
    const repositories = await freshStore();
    await runNetzwerkCourse(repositories, course(NOW), { apply: true, now: NOW });

    const before = await structureCounts(repositories);
    const snapshot = async () => JSON.stringify([
      await repositories.courses.all(), await repositories.courseUnits.all(),
      await repositories.lessons.all(), await repositories.curriculumTexts.all()
    ]);
    const original = await snapshot();

    const second = await runNetzwerkCourse(repositories, course(NOW + 9_000_000),
      { apply: true, now: NOW + 9_000_000 });

    expect(second.applied).toBe(false);
    expect(second.reason).toBe("no-changes");
    expect(second.plan.unchanged).toHaveLength(30);
    expect(await structureCounts(repositories)).toEqual(before);
    expect(await snapshot()).toBe(original);
  });

  it("imports zero educational entities", async () => {
    const repositories = await freshStore();
    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    const counts = await contentCounts(repositories);
    for (const [entity, count] of Object.entries(counts)) {
      expect(count, `${entity} must stay empty`).toBe(0);
    }
  });

  it("reuses the 189 registered assets and creates none", async () => {
    const repositories = await freshStore();
    // The full inventory is registered first, as it is on a real run.
    const registered = await registerAudio(
      repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }), { now: NOW });
    expect(registered).toEqual({ created: 189, reused: 0 });

    const before = await repositories.audioAssets.all();
    const result = await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    expect(result.written.audioAssets).toBe(0);
    expect(await repositories.audioAssets.count()).toBe(189);
    // Byte-identical: uuids, provenance and measured duration all survive.
    expect(await repositories.audioAssets.all()).toEqual(before);
    expect(new Set(before.map(asset => asset.uuid)).size).toBe(189);
  });

  it("leaves the Kapitel 2 slice's rows untouched when the whole course is imported", async () => {
    const repositories = await freshStore();
    const chapter = buildNetzwerkChapter({ ...artifacts(), chapter: 2, now: NOW });
    await runNetzwerkChapter(repositories, chapter, { apply: true, now: NOW });

    const reviewed = {
      course: await repositories.courses.get(chapter.mapped.keys.courseUuid),
      unit: await repositories.courseUnits.get(chapter.mapped.keys.unitUuid),
      lesson: await repositories.lessons.get(chapter.mapped.keys.lessonUuid),
      assets: await repositories.audioAssets.all()
    };

    const result = await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });
    expect(result.applied).toBe(true);
    // Only the chapters the slice did not cover are new.
    expect(result.plan.create).toHaveLength(30 - 6);
    expect(result.plan.unchanged).toHaveLength(6);

    /*
     * Byte-identical, `revision` and `updatedAt` included: rows the diff planned as
     * `unchanged` are never written, so nothing about them moves. Anything less than
     * whole-row equality here would hide exactly the defect this proves is gone.
     */
    expect(await repositories.courses.get(reviewed.course.uuid)).toEqual(reviewed.course);
    expect(await repositories.courseUnits.get(reviewed.unit.uuid)).toEqual(reviewed.unit);
    // The reviewed Kapitel 2 lesson keeps its uuid, slug, ordering, citation and revision.
    expect(await repositories.lessons.get(reviewed.lesson.uuid)).toEqual(reviewed.lesson);
    // The registered assets are never touched by a structural import.
    expect(await repositories.audioAssets.all()).toEqual(reviewed.assets);
  });

  it("registers no audio link of any kind", async () => {
    const repositories = await freshStore();
    await registerAudio(repositories, buildNetzwerkAudioAssets(INVENTORY.audio.files, { now: NOW }));
    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    expect(await repositories.listeningItems.count()).toBe(0);
    expect(await repositories.listeningLinks.count()).toBe(0);
    expect(await repositories.lessonItems.count()).toBe(0);
    for (const asset of await repositories.audioAssets.all()) {
      expect(isPlayableOffline(asset)).toBe(false);
    }
  });

  it("preserves Nicos content and learner SRS rows", async () => {
    const repositories = await freshStore();
    const { dataset } = migrateToCanonical(MIGRATION_FIXTURE.clean, { now: NOW });
    await repositories.lifecycle.importCanonical(dataset);

    const before = {
      cards: await repositories.cards.all(),
      events: await repositories.events.all(),
      profiles: await repositories.profiles.all(),
      vocabulary: await repositories.vocabulary.all()
    };
    expect(before.cards.length).toBeGreaterThan(0);

    await runNetzwerkCourse(repositories, course(), { apply: true, now: NOW });

    expect(await repositories.cards.all()).toEqual(before.cards);
    expect(await repositories.events.all()).toEqual(before.events);
    expect(await repositories.profiles.all()).toEqual(before.profiles);
    expect(await repositories.vocabulary.all()).toEqual(before.vocabulary);
  });

  it("rolls the whole course back when one chapter is invalid", async () => {
    const repositories = await freshStore();
    const broken = course();
    broken.mapped.course.lessons[7].slug = null;

    await expect(runNetzwerkCourse(repositories, broken, { apply: true, now: NOW }))
      .rejects.toThrow();
    expect(Object.values(await structureCounts(repositories)).every(count => count === 0)).toBe(true);
  });
});
