/*
 * Netzwerk neu A2 — Kapitel intake adapter.
 *
 * Deliberately NOT a layout parser. The Netzwerk books in this repository are scans with
 * no usable text layer, so there is nothing to read from them; what exists instead is a
 * reviewed slice of official Klett/Allango metadata plus the technical identity of local
 * audio files. This adapter turns that reviewed evidence into canonical rows and refuses
 * everything else.
 *
 * Three refusals define it:
 *
 *   1. NO PUBLISHER WORDING. No transcript, task body, vocabulary list, grammar
 *      explanation or translation is imported. The slice is bibliographic and structural
 *      metadata plus source-asset identity — nothing a learner reads as teaching text.
 *
 *   2. NO GUESSED RELATIONSHIPS. Every audio row's page and exercise stay null, and no
 *      listening activity or lesson item is created. Component, disc, track and Kapitel
 *      are proven by the official transcript index; the page a track belongs to is not.
 *
 *   3. NO REPAIR. Validation reports; it never rewrites a value into the shape it
 *      expected. A mismatch between the slice and the audio index is an error, not
 *      something to reconcile.
 *
 * Everything here is pure: no file I/O, no database, no network. The caller supplies the
 * four committed JSON artifacts and receives evidence, a validation result and canonical
 * rows.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";
import { SEVERITY, mergeValidation } from "./validate.js";
import { IMPORTED_STATUS } from "./map-canonical.js";

/** The only hosts an official source may live on. Anything else is refused. */
export const OFFICIAL_HOSTS = Object.freeze([
  "www.klett-sprachen.de",
  "einstufungstests.klett-sprachen.de",
  "www.allango.net"
]);

/** Canonical entities this slice is permitted to produce. */
export const ALLOWED_TARGETS = Object.freeze([
  "course", "courseLevel", "courseUnit", "lesson", "curriculumText", "audioAsset"
]);

/** Namespaces, kept identical to the ones the fixture UUIDs were derived from. */
export const NS = Object.freeze({
  course: "deutschflow/intake/course",
  level: "deutschflow/intake/course_level",
  unit: "deutschflow/intake/course_unit",
  lesson: "deutschflow/intake/lesson",
  text: "deutschflow/intake/text",
  audio: "deutschflow/intake/audio_asset"
});

/** Repository/entity name for each safe-row target. */
const TARGET_ENTITY = Object.freeze({
  course: "courses",
  courseLevel: "courseLevels",
  courseUnit: "courseUnits",
  lesson: "lessons",
  curriculumText: "curriculumTexts",
  audioAsset: "audioAssets"
});

const issue = (severity, code, detail, where = null) => ({ severity, code, detail, where });
const error = (code, detail, where) => issue(SEVERITY.ERROR, code, detail, where);
const warn = (code, detail, where) => issue(SEVERITY.WARNING, code, detail, where);

function hostOf(url) {
  try { return new URL(String(url)).host; } catch { return null; }
}

/* --------------------------------------------------------------- selection */

/**
 * Select exactly the evidence one chapter needs. Selection only: nothing is extracted,
 * normalized or repaired, and no artifact is mutated.
 *
 * @param {object} input { manifest, structureIndex, audioAssetIndex, safeSlice }
 * @param {number} chapter
 */
export function selectNetzwerkChapter(input, chapter = 2) {
  const { manifest, structureIndex, audioAssetIndex, safeSlice } = input ?? {};

  const allRows = safeSlice?.rows ?? [];
  const rows = allRows.filter(row => ALLOWED_TARGETS.includes(row.canonicalTargetEntity));
  /*
   * A target this adapter does not allow is REPORTED, not quietly dropped. Silently
   * skipping it would let a slice carrying educational rows still validate as safe.
   */
  const rejectedRows = allRows.filter(row => !ALLOWED_TARGETS.includes(row.canonicalTargetEntity));
  const audioRows = rows.filter(row => row.canonicalTargetEntity === "audioAsset");

  const manifestById = new Map((manifest?.sources ?? []).map(source => [source.id, source]));
  const structureById = new Map((structureIndex?.officialResources ?? []).map(entry => [entry.id, entry]));
  // Edition identity is declared in the MANIFEST; the structure index keeps its own,
  // differently-scoped edition records, so the two id spaces must not be conflated.
  const editionById = new Map((manifest?.editionIdentity ?? []).map(entry => [entry.id, entry]));
  const indexedByAssetId = new Map((audioAssetIndex?.assets ?? []).map(asset => [asset.sourceAssetId, asset]));

  /* Only the manifest/structure/edition records the slice actually names. */
  const referencedSourceIds = new Set(rows.flatMap(row => row.sourceRecordIds ?? []));
  const referencedStructureIds = new Set(rows.flatMap(row => row.structureEvidenceSourceIds ?? []));
  const referencedEditionIds = new Set(rows.flatMap(row => row.sourceEditionIds ?? []));

  return {
    chapter,
    safeSlice,
    rows,
    rejectedRows,
    audioRows,
    chapterRecord: (structureIndex?.chapters ?? []).find(entry => entry.chapter === chapter) ?? null,
    manifest,
    structureIndex,
    audioAssetIndex,
    manifestSources: [...referencedSourceIds].map(id => manifestById.get(id) ?? { id, missing: true }),
    structureResources: [...referencedStructureIds].map(id => structureById.get(id) ?? { id, missing: true }),
    editions: [...referencedEditionIds].map(id => editionById.get(id) ?? { id, missing: true }),
    /* Only the 16 chapter assets the slice names, matched by their own asset id. */
    selectedAssets: audioRows.map(row => ({
      row,
      indexed: indexedByAssetId.get(row.sourceAssetId) ?? null,
      manifestUnit: (manifest?.audioContentUnits ?? [])
        .find(unit => unit.localPath === row.sourceRecord?.relativePath) ?? null
    })),
    counts: {
      indexedAssets: (audioAssetIndex?.assets ?? []).length,
      manifestSources: (manifest?.sources ?? []).length,
      manifestAudioUnits: (manifest?.audioContentUnits ?? []).length,
      editionIdentities: (manifest?.editionIdentity ?? []).length,
      structureEditions: (structureIndex?.editions ?? []).length,
      structureResources: (structureIndex?.officialResources ?? []).length,
      structureChapters: (structureIndex?.chapters ?? []).length,
      safeRows: rows.length,
      selectedAudio: audioRows.length
    }
  };
}

/* -------------------------------------------------------------- validation */

/** Artifact versions this adapter understands. A newer artifact must be reviewed first. */
export const SUPPORTED_VERSIONS = Object.freeze({ manifest: 1, structureIndex: 1, audioAssetIndex: 1 });

/**
 * Validate the selected evidence. Reports; never repairs.
 * Every error means "importing this would state something the sources do not".
 */
export function validateNetzwerkChapter(evidence) {
  const issues = [];
  const { manifest, structureIndex, audioAssetIndex, safeSlice, rows, chapter } = evidence ?? {};

  /* ---- artifact versions and declared counts ---- */
  if (manifest?.manifestVersion !== SUPPORTED_VERSIONS.manifest) {
    issues.push(error("unsupported-manifest-version", `manifest version ${manifest?.manifestVersion}`));
  }
  if (structureIndex?.indexVersion !== SUPPORTED_VERSIONS.structureIndex) {
    issues.push(error("unsupported-structure-version", `structure index version ${structureIndex?.indexVersion}`));
  }
  if (audioAssetIndex?.indexVersion !== SUPPORTED_VERSIONS.audioAssetIndex) {
    issues.push(error("unsupported-audio-index-version", `audio index version ${audioAssetIndex?.indexVersion}`));
  }

  const declared = safeSlice?.expectedCounts ?? {};
  const actual = countTargets(rows ?? []);
  for (const [target, expected] of Object.entries({
    course: declared.course, courseLevel: declared.courseLevel, courseUnit: declared.courseUnit,
    lesson: declared.lesson, curriculumText: declared.curriculumText, audioAsset: declared.audioAsset
  })) {
    if (expected === undefined) continue;
    if ((actual[target] ?? 0) !== expected) {
      issues.push(error("row-count-mismatch",
        `expected ${expected} ${target} rows, selected ${actual[target] ?? 0}`, target));
    }
  }
  if (declared.totalRows !== undefined && (rows ?? []).length !== declared.totalRows) {
    issues.push(error("total-row-mismatch",
      `expected ${declared.totalRows} rows, selected ${(rows ?? []).length}`));
  }

  for (const row of evidence?.rejectedRows ?? []) {
    issues.push(error("disallowed-target-entity",
      `${row.canonicalTargetEntity} is not importable in this slice`,
      row.externalId ?? row.canonicalTargetEntity));
  }

  /* ---- the excluded entity list is a promise the slice must keep ---- */
  for (const excluded of safeSlice?.excludedCanonicalEntityTypes ?? []) {
    if ((rows ?? []).some(row => row.canonicalTargetEntity === excluded)) {
      issues.push(error("excluded-entity-present", `${excluded} is excluded from this slice`, excluded));
    }
  }

  /* ---- identity: unique external ids and unique canonical uuids ---- */
  const seenExternal = new Set();
  const seenUuid = new Set();
  for (const row of rows ?? []) {
    const where = row.externalId ?? row.canonicalTargetEntity;
    if (seenExternal.has(row.externalId)) issues.push(error("duplicate-external-id", "repeated", where));
    seenExternal.add(row.externalId);

    const uuid = row.fieldsAllowedForImport?.uuid;
    if (!uuid) issues.push(error("missing-uuid", "row has no canonical uuid", where));
    else if (seenUuid.has(uuid)) issues.push(error("duplicate-uuid", uuid, where));
    seenUuid.add(uuid);

    /* Rights: a row that permits embedding publisher payload cannot be in a safe slice. */
    const rights = row.rightsClassification ?? {};
    if (rights.publisherAudioPayload && rights.publisherAudioPayload !== "CLEARLY_RESTRICTED") {
      issues.push(error("rights-permit-payload",
        `publisherAudioPayload is ${rights.publisherAudioPayload}`, where));
    }
    if (!row.verificationStatus) issues.push(error("missing-verification-status", "absent", where));

    /*
     * Provenance must survive into the canonical row — except on course_levels, which is
     * a link table with no content-lifecycle columns. Its evidence lives in the slice.
     */
    if (row.canonicalTargetEntity !== "courseLevel") {
      if (!row.fieldsAllowedForImport?.sourceReference) {
        issues.push(error("missing-source-reference", "row has no source reference", where));
      }
      if (row.fieldsAllowedForImport?.contentStatus !== IMPORTED_STATUS) {
        issues.push(error("wrong-content-status",
          `expected ${IMPORTED_STATUS}, found ${row.fieldsAllowedForImport?.contentStatus}`, where));
      }
    }
    for (const field of ["verifiedAt", "verifiedBy"]) {
      if (row.fieldsAllowedForImport?.[field] != null) {
        issues.push(error("premature-verification", `${field} must stay null until human QA`, where));
      }
    }

    /* Official hosts only. */
    for (const url of row.provenance?.officialUrls ?? [row.provenance?.officialUrl].filter(Boolean)) {
      const host = hostOf(url);
      if (!OFFICIAL_HOSTS.includes(host)) {
        issues.push(error("non-official-host", `${host ?? url} is not an official publisher host`, where));
      }
    }
  }

  /* ---- chapter identity ---- */
  const chapterRecord = evidence?.chapterRecord;
  if (!chapterRecord) issues.push(error("chapter-missing", `no structure record for chapter ${chapter}`));
  else {
    if (!chapterRecord.printedChapterTitle) {
      issues.push(error("chapter-title-missing", "structure index has no printed chapter title"));
    }
    const lessonRow = (rows ?? []).find(row => row.canonicalTargetEntity === "lesson");
    if (lessonRow && lessonRow.fieldsAllowedForImport?.ordering !== chapter) {
      issues.push(error("lesson-ordering-mismatch",
        `lesson ordering ${lessonRow.fieldsAllowedForImport?.ordering} is not chapter ${chapter}`));
    }
  }

  /* ---- manifest / structure references must resolve ---- */
  for (const source of evidence?.manifestSources ?? []) {
    if (source.missing) issues.push(error("unresolved-manifest-reference", source.id));
    else if (!OFFICIAL_HOSTS.includes(source.officialDomain)) {
      issues.push(error("non-official-host", `${source.officialDomain}`, source.id));
    }
  }
  for (const resource of evidence?.structureResources ?? []) {
    if (resource.missing) issues.push(error("unresolved-structure-reference", resource.id));
  }
  for (const edition of evidence?.editions ?? []) {
    if (edition.missing) issues.push(error("unresolved-edition-reference", edition.id));
  }

  issues.push(...validateAudioEvidence(evidence));

  const errors = issues.filter(entry => entry.severity === SEVERITY.ERROR);
  const warnings = issues.filter(entry => entry.severity === SEVERITY.WARNING);

  return mergeValidation({
    issues,
    ok: errors.length === 0,
    summary: {
      chapter,
      safeRows: (rows ?? []).length,
      sourceAssets: (evidence?.audioRows ?? []).length,
      indexedAssets: evidence?.counts?.indexedAssets ?? 0,
      // The number that must stay zero for this slice to remain honest.
      exactAudioPageExerciseMappings: 0
    }
  });
}

/**
 * Audio evidence: identity must match the index exactly, and every page/exercise or
 * activity relationship must be absent.
 */
export function validateAudioEvidence(evidence) {
  const issues = [];

  for (const { row, indexed, manifestUnit } of evidence?.selectedAssets ?? []) {
    const where = row.externalId;
    const fields = row.fieldsAllowedForImport ?? {};
    const record = row.sourceRecord ?? {};

    if (!indexed) {
      issues.push(error("unindexed-audio-asset", `${row.sourceAssetId} is not in the audio index`, where));
      continue;
    }

    /* Identity is bytes and path, never size alone. */
    if (record.sha256 !== indexed.sha256) {
      issues.push(error("audio-sha-mismatch", "slice and index disagree on SHA-256", where));
    }
    if (record.fileSizeBytes !== indexed.fileSizeBytes) {
      issues.push(error("audio-size-mismatch", "slice and index disagree on byte size", where));
    }
    if (record.relativePath !== indexed.relativePath) {
      issues.push(error("audio-path-mismatch", "slice and index disagree on path", where));
    }
    if (fields.checksum !== `sha256:${indexed.sha256}`) {
      issues.push(error("audio-checksum-mismatch", "canonical checksum is not the indexed digest", where));
    }
    if (fields.byteSize !== indexed.fileSizeBytes) {
      issues.push(error("audio-bytesize-mismatch", "canonical byte size is not the indexed size", where));
    }
    /* Duration is measured, never derived from bitrate or file size. */
    if (fields.durationMs !== indexed.durationMs) {
      issues.push(error("audio-duration-mismatch", "canonical duration is not the measured duration", where));
    }

    /* Component, disc, track and chapter are proven; they must agree everywhere. */
    for (const [field, indexField] of [["component", "component"], ["disc", "disc"],
      ["track", "track"], ["chapter", "chapter"]]) {
      if (record[field] !== indexed[indexField]) {
        issues.push(error("audio-placement-mismatch",
          `${field}: slice ${record[field]} vs index ${indexed[indexField]}`, where));
      }
    }
    if (manifestUnit && manifestUnit.chapter !== record.chapter) {
      issues.push(error("audio-chapter-mismatch", "manifest and slice disagree on chapter", where));
    }

    /* The page and the exercise are exactly what the sources do NOT establish. */
    for (const [holder, label] of [[record, "slice"], [indexed, "index"], [manifestUnit ?? {}, "manifest"]]) {
      for (const field of ["page", "exercise"]) {
        if (holder[field] !== null && holder[field] !== undefined) {
          issues.push(error("guessed-audio-mapping",
            `${label} ${field} is set; the source proves component/disc/track/Kapitel only`, where));
        }
      }
    }

    /* An asset is a file, not an activity. */
    for (const field of ["listeningItemUuid", "lessonItemUuid", "listeningUuid", "lessonUuid"]) {
      if (fields[field] != null || record[field] != null) {
        issues.push(error("audio-activity-link",
          `${field} links a source-only asset to an activity that is not proven`, where));
      }
    }

    /* Registered, never playable. */
    if (fields.availability !== "source-only") {
      issues.push(error("audio-not-source-only", `availability is ${fields.availability}`, where));
    }
    if (fields.localPath !== "") {
      issues.push(error("audio-has-local-path", "a source-only asset has no device path", where));
    }
    if (fields.remoteUrl != null) {
      issues.push(error("audio-remote-url", "publisher audio must not carry a fetchable URL", where));
    }
    if (row.verificationStatus === "PROVEN_EXACT_MAPPING") {
      issues.push(error("overstated-verification",
        "page/exercise are unresolved, so the mapping cannot be exact", where));
    }
    if (row.verificationStatus === "PARTIALLY_PROVEN") {
      issues.push(warn("audio-mapping-partial",
        "component, disc, track and Kapitel are proven; page and exercise are not", where));
    }
  }

  /* The whole index is validated technically, even though only 16 assets are selected. */
  for (const asset of evidence?.audioAssetIndex?.assets ?? []) {
    if (asset.page != null || asset.exercise != null) {
      issues.push(error("indexed-asset-has-mapping",
        "an indexed asset claims a page or exercise", asset.sourceAssetId));
    }
    if (asset.availability !== "source-only") {
      issues.push(error("indexed-asset-not-source-only", asset.availability, asset.sourceAssetId));
    }
  }

  return issues;
}

function countTargets(rows) {
  const counts = {};
  for (const row of rows) {
    counts[row.canonicalTargetEntity] = (counts[row.canonicalTargetEntity] ?? 0) + 1;
  }
  return counts;
}

/* ----------------------------------------------------------------- mapping */

const lifecycle = now => ({ createdAt: now, updatedAt: now });

/**
 * Turn reviewed evidence into canonical rows.
 *
 * Identity comes from the slice, which derived it with `deterministicUuid` — and every
 * uuid is recomputed here from its documented namespace and key, so a fixture that
 * drifted from the convention fails rather than importing under a stale identity.
 */
export function mapNetzwerkChapter(evidence, options = {}) {
  const now = options.now ?? Date.now();
  const rows = evidence?.rows ?? [];

  const pick = target => rows.filter(row => row.canonicalTargetEntity === target);
  const canonical = row => ({
    ...row.fieldsAllowedForImport,
    // Fields the slice declares must stay empty are written as null, not omitted.
    ...Object.fromEntries((row.fieldsMustRemainNullOrUnset ?? [])
      .filter(field => CANONICAL_NULLABLE.has(field))
      .map(field => [field, null])),
    ...lifecycle(now)
  });

  const course = pick("course")[0];
  const level = pick("courseLevel")[0];
  const unit = pick("courseUnit")[0];
  const lesson = pick("lesson")[0];

  const courseRow = course ? canonical(course) : null;
  const levelRow = level ? stripContentLifecycle(canonical(level)) : null;
  const unitRow = unit ? canonical(unit) : null;
  const lessonRow = lesson ? canonical(lesson) : null;

  const audioAssets = pick("audioAsset").map(canonical);

  return {
    keys: {
      courseSlug: courseRow?.slug ?? null,
      courseUuid: courseRow?.uuid ?? null,
      levelUuid: levelRow?.uuid ?? null,
      unitUuid: unitRow?.uuid ?? null,
      lessonUuid: lessonRow?.uuid ?? null
    },
    course: {
      course: courseRow,
      levels: levelRow ? [levelRow] : [],
      units: unitRow ? [unitRow] : [],
      lessons: lessonRow ? [lessonRow] : [],
      // No section or item: an empty section teaches nothing, and no content is eligible.
      sections: [],
      items: [],
      prerequisites: [],
      texts: pick("curriculumText").map(canonical)
    },
    audioAssets,
    vocabulary: [],
    sentences: [],
    exercises: [],
    // Source-only audio is not a learning activity, so there is no listening entity.
    listening: null,
    stats: {
      courses: courseRow ? 1 : 0,
      courseLevels: levelRow ? 1 : 0,
      courseUnits: unitRow ? 1 : 0,
      lessons: lessonRow ? 1 : 0,
      curriculumTexts: pick("curriculumText").length,
      audioAssets: audioAssets.length,
      totalRows: rows.length
    }
  };
}

/** Nullable canonical columns a slice row may declare as "must remain null". */
const CANONICAL_NULLABLE = new Set([
  "sourceEdition", "sourceIsbn", "verifiedAt", "verifiedBy", "remoteUrl", "checksum"
]);

/** course_levels is a link table: it carries no content lifecycle columns. */
function stripContentLifecycle(row) {
  const { contentStatus, contentVersion, sourceReference, sourceType, verifiedAt, verifiedBy, ...rest } = row;
  return rest;
}

/** Recompute a uuid from its documented namespace and key. */
export function expectedUuid(kind, key) {
  return deterministicUuid(NS[kind], key);
}

/* ------------------------------------------------------------ orchestration */

/**
 * Select, validate and map one chapter.
 * Returns evidence and validation even when validation fails, so a caller can report
 * exactly what was refused; `mapped` is null unless the evidence is sound.
 */
export function buildNetzwerkChapter(input = {}) {
  const chapter = input.chapter ?? 2;
  const evidence = selectNetzwerkChapter(input, chapter);
  const validation = validateNetzwerkChapter(evidence);
  const mapped = validation.ok ? mapNetzwerkChapter(evidence, { now: input.now }) : null;
  return { evidence, validation, mapped };
}

/** The repository entity each safe-row target writes to. Test and audit helper. */
export function entityForTarget(target) {
  return TARGET_ENTITY[target] ?? null;
}
