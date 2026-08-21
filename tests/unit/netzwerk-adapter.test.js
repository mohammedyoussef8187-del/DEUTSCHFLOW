/*
 * The Netzwerk neu A2 Kapitel adapter: artifact acceptance, canonical mapping, stable
 * identity, and the refusals that keep the slice honest.
 *
 * What is being protected here is mostly what the adapter must NOT produce. The Netzwerk
 * books in this repository are unreadable scans, so the only importable evidence is
 * reviewed official metadata plus the technical identity of local audio files. A single
 * guessed page number, or one line of publisher wording, would turn a rights-safe
 * metadata slice into something else entirely.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TARGETS, NS, OFFICIAL_HOSTS, SUPPORTED_VERSIONS,
  buildNetzwerkChapter, entityForTarget, expectedUuid, mapNetzwerkChapter,
  selectNetzwerkChapter, validateNetzwerkChapter
} from "../../tools/intake/map-netzwerk.js";
import { flattenRows } from "../../tools/intake/import.js";
import { IMPORTED_STATUS } from "../../tools/intake/map-canonical.js";
import { TABLE_SPECS } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js";
import { isPlayableOffline } from "../../01_APPLICATION/CURRENT_APP/src/services/listening-service.js";

const NOW = 1775000000000;
const CONTROL = path.resolve(process.cwd(), "00_PROJECT_CONTROL");

const read = name => JSON.parse(fs.readFileSync(path.join(CONTROL, name), "utf8"));

const artifacts = () => ({
  manifest: read("NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json"),
  structureIndex: read("NETZWERK_NEU_A2_STRUCTURE_INDEX.json"),
  audioAssetIndex: read("NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json"),
  safeSlice: read("NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json")
});

const build = (overrides = {}, now = NOW) =>
  buildNetzwerkChapter({ ...artifacts(), chapter: 2, now, ...overrides });

/** Deep clone one artifact so a mutation test cannot leak into another test. */
const clone = value => structuredClone(value);

const INVENTORY = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "tools/intake/artifacts/netzwerk-inventory.json"), "utf8"));

/* ------------------------------------------------------- artifact contract */

describe("the committed artifacts", () => {
  it("carries the record counts the adapter was written against", () => {
    const { manifest, structureIndex, audioAssetIndex, safeSlice } = artifacts();

    expect(manifest.manifestVersion).toBe(SUPPORTED_VERSIONS.manifest);
    expect(manifest.editionIdentity).toHaveLength(3);
    expect(manifest.sources).toHaveLength(23);
    expect(manifest.audioContentUnits).toHaveLength(16);

    expect(structureIndex.editions).toHaveLength(4);
    expect(structureIndex.officialResources).toHaveLength(26);
    expect(structureIndex.chapters).toHaveLength(12);

    expect(audioAssetIndex.assets).toHaveLength(189);
    expect(safeSlice.rows).toHaveLength(22);
    expect(safeSlice.expectedCounts).toMatchObject({
      totalRows: 22, course: 1, courseLevel: 1, courseUnit: 1,
      lesson: 1, curriculumText: 2, audioAsset: 16,
      educationalEntities: 0, listeningEntities: 0, lessonSections: 0, lessonItems: 0
    });
  });

  it("accepts the committed safe slice and all 189 indexed assets", () => {
    const built = build();
    expect(built.validation.errors).toEqual([]);
    expect(built.validation.ok).toBe(true);
    expect(built.validation.summary).toMatchObject({
      chapter: 2, safeRows: 22, sourceAssets: 16, indexedAssets: 189,
      // The number that must never move: no track's page or exercise is proven.
      exactAudioPageExerciseMappings: 0
    });
  });

  it("names Kapitel 2 and its A2.1 page ranges exactly as the source prints them", () => {
    const chapter = build().evidence.chapterRecord;
    expect(chapter.printedChapterTitle).toBe("Nach der Schulzeit");
    expect(chapter.officialPageRanges).toEqual({ kursbuch: "16-25", uebungsbuch: "90-101" });
    expect(chapter.edition).toBe("A2.1");
  });

  it("cites only official publisher hosts", () => {
    const { safeSlice, manifest } = artifacts();
    const urls = safeSlice.rows.flatMap(row =>
      row.provenance?.officialUrls ?? [row.provenance?.officialUrl].filter(Boolean));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(OFFICIAL_HOSTS, url).toContain(new URL(url).host);
    }
    for (const source of manifest.sources) {
      expect(OFFICIAL_HOSTS, source.id).toContain(source.officialDomain);
    }
  });

  it("selects only the sixteen Kapitel 2 tracks out of the 189-asset index", () => {
    const { evidence } = build();
    expect(evidence.counts.indexedAssets).toBe(189);
    expect(evidence.selectedAssets).toHaveLength(16);
    expect(evidence.selectedAssets.every(entry => entry.indexed)).toBe(true);
    expect(evidence.selectedAssets.every(entry => entry.row.sourceRecord.chapter === 2)).toBe(true);
  });

  it("matches every selected asset to the inventory by path, size and SHA-256", () => {
    const byPath = new Map(INVENTORY.audio.files.map(file => [file.path, file]));
    for (const { row } of build().evidence.selectedAssets) {
      const record = row.sourceRecord;
      const scanned = byPath.get(record.relativePath);
      expect(scanned, record.relativePath).toBeDefined();
      expect(record.sha256).toBe(scanned.sha256);
      expect(record.fileSizeBytes).toBe(scanned.size);
    }
  });

  it("covers exactly KB 1.8–1.17 and ÜB 1.11–1.16", () => {
    const tracks = component => build().evidence.selectedAssets
      .map(entry => entry.row.sourceRecord)
      .filter(record => record.component === component)
      .map(record => record.track)
      .sort((a, b) => a - b);

    expect(tracks("kursbuch")).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(tracks("uebungsbuch")).toEqual([11, 12, 13, 14, 15, 16]);
    expect(build().evidence.selectedAssets
      .every(entry => entry.row.sourceRecord.disc === 1)).toBe(true);
  });
});

/* ------------------------------------------------------------ the mapping */

describe("canonical mapping", () => {
  it("maps exactly 22 rows and no educational entity", () => {
    const { mapped } = build();
    expect(mapped.stats).toEqual({
      courses: 1, courseLevels: 1, courseUnits: 1, lessons: 1,
      curriculumTexts: 2, audioAssets: 16, totalRows: 22
    });

    const counts = {};
    for (const { entity } of flattenRows(mapped)) counts[entity] = (counts[entity] ?? 0) + 1;
    expect(counts).toEqual({
      courses: 1, courseLevels: 1, courseUnits: 1, lessons: 1,
      curriculumTexts: 2, audioAssets: 16
    });
    expect(flattenRows(mapped)).toHaveLength(22);

    // Nothing a learner reads as teaching text, and nothing to hang it on.
    expect(mapped.vocabulary).toEqual([]);
    expect(mapped.sentences).toEqual([]);
    expect(mapped.exercises).toEqual([]);
    expect(mapped.listening).toBeNull();
    expect(mapped.course.sections).toEqual([]);
    expect(mapped.course.items).toEqual([]);
    expect(mapped.course.prerequisites).toEqual([]);
  });

  it("writes only fields the canonical schema declares", () => {
    const fieldsFor = entity => new Set(
      TABLE_SPECS.find(spec => spec.entity === entity).columns.map(([, field]) => field));

    for (const { entity, row } of flattenRows(build().mapped)) {
      const known = fieldsFor(entity);
      for (const field of Object.keys(row)) {
        expect(known.has(field), `${entity}.${field} is not a schema field`).toBe(true);
      }
    }
  });

  it("keeps the course a product family, with no edition or ISBN claimed", () => {
    const course = build().mapped.course.course;
    expect(course).toMatchObject({
      slug: "netzwerk-neu-a2", cefrLevel: "A2",
      sourceTitle: "Netzwerk neu A2", sourcePublisher: "Ernst Klett Sprachen"
    });
    // Edition and ISBN identify a component, not the family, so neither is asserted here.
    expect(course.sourceEdition).toBeNull();
    expect(course.sourceIsbn).toBeNull();
  });

  it("titles the lesson from the printed chapter title", () => {
    const { mapped } = build();
    expect(mapped.course.lessons[0]).toMatchObject({
      slug: "nach-der-schulzeit", cefrLevel: "A2", ordering: 2
    });
    const titles = mapped.course.texts.map(text => text.text);
    expect(titles).toContain("Nach der Schulzeit");
    expect(titles).toContain("Netzwerk neu A2");
    // German only: no official English or Arabic title exists, so none is invented.
    expect(mapped.course.texts.every(text => text.language === "de")).toBe(true);
  });

  it("registers each audio file as source-only and unplayable", () => {
    const assets = build().mapped.audioAssets;
    expect(assets).toHaveLength(16);
    for (const asset of assets) {
      expect(asset.availability).toBe("source-only");
      expect(asset.localPath).toBe("");
      expect(asset.remoteUrl).toBeNull();
      expect(asset.mimeType).toBe("audio/mpeg");
      expect(asset.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(asset.durationMs).toBeGreaterThan(0);
      expect(isPlayableOffline(asset)).toBe(false);
    }
  });

  it("uses the measured duration, never one derived from size or bitrate", () => {
    const indexed = new Map(artifacts().audioAssetIndex.assets.map(a => [a.relativePath, a]));
    for (const { row } of build().evidence.selectedAssets) {
      const asset = build().mapped.audioAssets.find(a => a.uuid === row.fieldsAllowedForImport.uuid);
      expect(asset.durationMs).toBe(indexed.get(asset.sourcePath).durationMs);
    }
  });

  it("marks everything imported, never verified", () => {
    for (const { entity, row } of flattenRows(build().mapped)) {
      if (row.contentStatus !== undefined) {
        expect(row.contentStatus, entity).toBe(IMPORTED_STATUS);
      }
      if (row.verifiedAt !== undefined) expect(row.verifiedAt, entity).toBeNull();
      if (row.verifiedBy !== undefined) expect(row.verifiedBy, entity).toBeNull();
    }
  });

  it("carries an official source reference on every content row", () => {
    for (const { entity, row } of flattenRows(build().mapped)) {
      // course_levels is a link table with no lifecycle columns.
      if (entity === "courseLevels") continue;
      expect(row.sourceReference, entity).toBeTruthy();
      expect(row.sourceType, entity).toBeTruthy();
    }
  });

  it("says in the audio reference that the page and exercise are unresolved", () => {
    for (const asset of build().mapped.audioAssets) {
      expect(asset.sourceReference).toContain("page/exercise unresolved");
      expect(asset.sourceReference).toMatch(/disc 1 track \d+/);
      expect(asset.sourceReference).toContain("Kapitel 2");
    }
  });

  it("copies no publisher wording into any row", () => {
    const text = JSON.stringify(flattenRows(build().mapped));
    // Instruction verbs and task bodies are what a transcript or exercise would contain.
    for (const wording of ["Lesen Sie", "Hören Sie", "Ergänzen", "Schreiben Sie", "Übung"]) {
      expect(text, wording).not.toContain(wording);
    }
  });

  it("maps each safe-row target to its repository entity", () => {
    expect(ALLOWED_TARGETS.map(entityForTarget)).toEqual([
      "courses", "courseLevels", "courseUnits", "lessons", "curriculumTexts", "audioAssets"
    ]);
    expect(entityForTarget("vocabularyItem")).toBeNull();
  });
});

/* ------------------------------------------------------- stable identity */

describe("identity is derived, not allocated", () => {
  it("produces the same uuids whatever the clock says", () => {
    const early = build({}, NOW);
    const later = build({}, NOW + 9_000_000);

    expect(later.mapped.keys).toEqual(early.mapped.keys);
    expect(flattenRows(later.mapped).map(entry => entry.row.uuid))
      .toEqual(flattenRows(early.mapped).map(entry => entry.row.uuid));

    // Only the timestamps move.
    expect(later.mapped.course.course.createdAt).toBe(NOW + 9_000_000);
    expect(early.mapped.course.course.createdAt).toBe(NOW);
  });

  it("reproduces every structural uuid from its documented namespace and key", () => {
    const { keys } = build().mapped;
    expect(keys.courseUuid).toBe(expectedUuid("course", "netzwerk-neu-a2"));
    expect(keys.levelUuid).toBe(expectedUuid("level", "netzwerk-neu-a2:A2"));
    expect(keys.unitUuid).toBe(expectedUuid("unit", "netzwerk-neu-a2:a2-1"));
    expect(keys.lessonUuid).toBe(expectedUuid("lesson", "netzwerk-neu-a2:chapter:2"));
  });

  it("reproduces every audio uuid from its repository path", () => {
    for (const asset of build().mapped.audioAssets) {
      expect(asset.uuid).toBe(expectedUuid("audio", asset.sourcePath));
    }
  });

  it("keeps the fixture's own stable keys", () => {
    expect(build().mapped.keys).toMatchObject(artifacts().safeSlice.stableKeys);
  });

  it("gives every row a unique identity", () => {
    const uuids = flattenRows(build().mapped).map(entry => entry.row.uuid);
    expect(new Set(uuids).size).toBe(uuids.length);
    const slugs = build().mapped.audioAssets.map(asset => asset.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

/* --------------------------------------------------------- the refusals */

describe("rejects every guessed relationship", () => {
  const withMutation = mutate => {
    const input = artifacts();
    mutate(input);
    return buildNetzwerkChapter({ ...input, chapter: 2, now: NOW });
  };

  it("refuses an audio page number", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
        .sourceRecord.page = 17;
    });
    expect(built.validation.ok).toBe(false);
    expect(built.mapped).toBeNull();
    expect(built.validation.errors.some(entry => entry.code === "guessed-audio-mapping")).toBe(true);
  });

  it("refuses an audio exercise reference", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
        .sourceRecord.exercise = "7d";
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "guessed-audio-mapping")).toBe(true);
  });

  it("refuses a listening or lesson-item link on a source-only asset", () => {
    for (const field of ["listeningItemUuid", "lessonItemUuid"]) {
      const built = withMutation(input => {
        input.safeSlice = clone(input.safeSlice);
        input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
          .fieldsAllowedForImport[field] = "any-uuid";
      });
      expect(built.validation.ok, field).toBe(false);
      expect(built.validation.errors.some(entry => entry.code === "audio-activity-link")).toBe(true);
    }
  });

  it("refuses an asset that claims to be on a device", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      const row = input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset");
      row.fieldsAllowedForImport.availability = "bundled";
      row.fieldsAllowedForImport.localPath = "audio/track.mp3";
    });
    expect(built.validation.ok).toBe(false);
    const codes = built.validation.errors.map(entry => entry.code);
    expect(codes).toContain("audio-not-source-only");
    expect(codes).toContain("audio-has-local-path");
  });

  it("refuses an excluded educational entity", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.push({
        externalId: "smuggled", canonicalTargetEntity: "vocabularyItem",
        fieldsAllowedForImport: { uuid: "x" }
      });
    });
    expect(built.validation.ok).toBe(false);
    // Reported, not silently dropped: a slice carrying an educational row is not the
    // slice this adapter was reviewed against.
    expect(built.validation.errors.some(entry => entry.code === "disallowed-target-entity")).toBe(true);
    expect(built.mapped).toBeNull();
  });

  it("refuses a source that is not on an official publisher host", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows[0].provenance.officialUrls = ["https://example.invalid/netzwerk.pdf"];
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "non-official-host")).toBe(true);
  });

  it("refuses an asset whose digest disagrees with the index", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
        .sourceRecord.sha256 = "0".repeat(64);
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "audio-sha-mismatch")).toBe(true);
  });

  it("refuses a duration that is not the measured one", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
        .fieldsAllowedForImport.durationMs = 60000;
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "audio-duration-mismatch")).toBe(true);
  });

  it("refuses an artifact version it has not been reviewed against", () => {
    const built = withMutation(input => {
      input.manifest = { ...clone(input.manifest), manifestVersion: 99 };
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "unsupported-manifest-version")).toBe(true);
  });

  it("refuses a row that claims human verification it has not had", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows[0].fieldsAllowedForImport.verifiedBy = "someone";
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "premature-verification")).toBe(true);
  });

  it("refuses rights that would permit embedding the publisher's audio", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset")
        .rightsClassification.publisherAudioPayload = "PERMITTED";
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "rights-permit-payload")).toBe(true);
  });

  it("refuses an unresolvable manifest reference", () => {
    const built = withMutation(input => {
      input.safeSlice = clone(input.safeSlice);
      input.safeSlice.rows[0].sourceRecordIds = ["does-not-exist"];
    });
    expect(built.validation.ok).toBe(false);
    expect(built.validation.errors.some(entry => entry.code === "unresolved-manifest-reference")).toBe(true);
  });

  it("never repairs a value it rejected", () => {
    const input = artifacts();
    input.safeSlice = clone(input.safeSlice);
    const row = input.safeSlice.rows.find(row => row.canonicalTargetEntity === "audioAsset");
    row.sourceRecord.page = 17;

    buildNetzwerkChapter({ ...input, chapter: 2, now: NOW });
    // The rejected value is still there: validation reports, it does not rewrite.
    expect(row.sourceRecord.page).toBe(17);
  });

  it("reports partial audio evidence as a warning rather than hiding it", () => {
    const warnings = build().validation.warnings.filter(entry => entry.code === "audio-mapping-partial");
    expect(warnings).toHaveLength(16);
    expect(warnings[0].detail).toContain("page and exercise are not");
  });
});

/* ------------------------------------------------ the index as a whole */

describe("the 189-asset index", () => {
  it("has no asset claiming a page or an exercise", () => {
    for (const asset of artifacts().audioAssetIndex.assets) {
      expect(asset.page, asset.sourceAssetId).toBeNull();
      expect(asset.exercise, asset.sourceAssetId).toBeNull();
    }
  });

  it("keeps every asset source-only", () => {
    expect(artifacts().audioAssetIndex.assets
      .every(asset => asset.availability === "source-only")).toBe(true);
  });

  it("identifies every asset uniquely by digest and uuid", () => {
    const assets = artifacts().audioAssetIndex.assets;
    expect(new Set(assets.map(asset => asset.sha256)).size).toBe(189);
    expect(new Set(assets.map(asset => asset.canonicalAudioAssetUuid)).size).toBe(189);
    expect(new Set(assets.map(asset => asset.sourceAssetId)).size).toBe(189);
  });

  it("selects sixteen of them without touching the rest", () => {
    const { mapped } = build();
    expect(mapped.audioAssets).toHaveLength(16);
    // The other 173 stay in the index; this slice creates nothing for them.
    expect(mapped.stats.totalRows).toBe(22);
  });
});

/* ---------------------------------------------------- selection is pure */

describe("selection and validation are pure", () => {
  it("does not mutate the artifacts it reads", () => {
    const input = artifacts();
    const before = JSON.stringify(input);
    const evidence = selectNetzwerkChapter(input, 2);
    validateNetzwerkChapter(evidence);
    mapNetzwerkChapter(evidence, { now: NOW });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("opens no file and reaches no database", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "tools/intake/map-netzwerk.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["readfilesync", "node:fs", "execfilesync", "pdftotext",
      "repositories", "adapter", "fetch("]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("uses the namespaces the fixture uuids were derived from", () => {
    expect(NS.course).toBe("deutschflow/intake/course");
    expect(NS.audio).toBe("deutschflow/intake/audio_asset");
  });
});
