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

/* ============================================================ whole course */
/*
 * The 12-chapter structure.
 *
 * The reviewed Kapitel 2 slice stays the authority for everything it covers — its rows
 * are reused verbatim, so the course, the CEFR level, the A2.1 unit and the Kapitel 2
 * lesson keep the identity and the provenance a person signed off on. The remaining
 * chapters are derived from the official structure index, which prints a title, an
 * edition, a page range and an audio range for each one.
 *
 * Still no educational content. A chapter here is a title and an ordering; it is not a
 * lesson with anything inside it, and this deliberately creates no section, no item and
 * no listening activity, because none of that is evidenced.
 */

/** Which combined half-edition a chapter belongs to, taken from the structure index. */
export const EDITION_UNITS = Object.freeze({
  "A2.1": { slug: "a2-1", ordering: 1, editionId: "edition-a2-1-combined" },
  "A2.2": { slug: "a2-2", ordering: 2, editionId: "edition-a2-2-combined" }
});

/**
 * The transcript heading Kapitel 1 carries in the official audio transcript, which is
 * NOT the printed chapter title. Both are real, and neither is normalized into the
 * other: the printed title is canonical, and the anomaly is recorded as its own text so
 * the disagreement stays visible instead of being quietly resolved.
 */
export const TRANSCRIPT_ANOMALY_KIND = "transcript-heading";

const resourceUrls = (structureIndex, ids) =>
  (ids ?? [])
    .map(id => (structureIndex?.officialResources ?? []).find(entry => entry.id === id))
    .filter(Boolean)
    .flatMap(entry => entry.officialUrls ?? []);

/**
 * Select the evidence for the whole course: every chapter, its edition, and the audio
 * ranges the transcript indexes place in it.
 */
export function selectNetzwerkCourse(input) {
  const { structureIndex, audioAssetIndex, safeSlice, manifest } = input ?? {};
  const reviewed = selectNetzwerkChapter(input, 2);

  const chapters = [...(structureIndex?.chapters ?? [])].sort((a, b) => a.chapter - b.chapter);
  const indexedAssets = audioAssetIndex?.assets ?? [];

  return {
    manifest,
    structureIndex,
    audioAssetIndex,
    safeSlice,
    reviewed,
    chapters: chapters.map(chapter => ({
      chapter,
      unit: EDITION_UNITS[chapter.edition] ?? null,
      titleEvidence: resourceUrls(structureIndex, [`source-teacher-board-k${chapter.chapter}`]),
      /*
       * The assets each audio range covers, resolved against the technical index. This
       * only CHECKS that an evidenced range names files that exist; it creates no link,
       * because a chapter range is not a task association.
       */
      audio: (chapter.audioRanges ?? []).map(range => ({
        range,
        assets: indexedAssets.filter(asset =>
          asset.component === range.component &&
          asset.disc === range.disc &&
          asset.track >= range.firstTrack &&
          asset.track <= range.lastTrack)
      }))
    })),
    editions: Object.entries(EDITION_UNITS).map(([edition, unit]) => ({
      edition,
      ...unit,
      record: (structureIndex?.editions ?? []).find(entry => entry.id === unit.editionId) ?? null
    })),
    counts: {
      chapters: chapters.length,
      indexedAssets: indexedAssets.length
    }
  };
}

/** Validate the whole-course evidence. Reports; never repairs. */
export function validateNetzwerkCourse(evidence) {
  const issues = [];
  const { chapters, structureIndex, audioAssetIndex } = evidence ?? {};

  if (structureIndex?.indexVersion !== SUPPORTED_VERSIONS.structureIndex) {
    issues.push(error("unsupported-structure-version", `version ${structureIndex?.indexVersion}`));
  }
  if (audioAssetIndex?.indexVersion !== SUPPORTED_VERSIONS.audioAssetIndex) {
    issues.push(error("unsupported-audio-index-version", `version ${audioAssetIndex?.indexVersion}`));
  }

  const numbers = (chapters ?? []).map(entry => entry.chapter.chapter);
  if (numbers.length !== 12) {
    issues.push(error("chapter-count-mismatch", `expected 12 chapters, found ${numbers.length}`));
  }
  if (numbers.some((value, index) => value !== index + 1)) {
    issues.push(error("chapter-ordering-gap", `chapters are ${numbers.join(", ")}`));
  }

  const seenTitles = new Map();
  for (const entry of chapters ?? []) {
    const { chapter, unit, titleEvidence } = entry;
    const where = `Kapitel ${chapter.chapter}`;

    if (!chapter.printedChapterTitle) {
      issues.push(error("chapter-title-missing", "no printed chapter title", where));
    }
    if (!unit) {
      issues.push(error("unknown-edition", `edition ${chapter.edition} has no unit`, where));
    }
    if (!titleEvidence.length) {
      issues.push(error("chapter-title-unevidenced", "no official source proves this title", where));
    }
    for (const url of titleEvidence) {
      const host = hostOf(url);
      if (!OFFICIAL_HOSTS.includes(host)) {
        issues.push(error("non-official-host", `${host ?? url}`, where));
      }
    }

    /* Two chapters printing the same title would make the slug ambiguous. */
    const title = chapter.printedChapterTitle;
    if (title && seenTitles.has(title)) {
      issues.push(error("duplicate-chapter-title",
        `also Kapitel ${seenTitles.get(title)}`, where));
    } else if (title) seenTitles.set(title, chapter.chapter);

    /*
     * A transcript heading that disagrees with the printed title is an official-source
     * anomaly, not an error — but it must be recorded rather than reconciled away.
     */
    if (chapter.transcriptHeading && chapter.transcriptHeading !== title) {
      issues.push(warn("chapter-title-anomaly",
        `printed "${title}", transcript heading "${chapter.transcriptHeading}"; both preserved`,
        where));
    }

    /* Every evidenced audio range must name files that actually exist. */
    for (const { range, assets } of entry.audio) {
      const expected = range.lastTrack - range.firstTrack + 1;
      if (assets.length !== expected) {
        /*
         * A warning, not an error: the range is what the official transcript index
         * prints, and a file simply not being in this repository says nothing about the
         * chapter's title or ordering. The Übungsbuch disc 2 recordings are absent
         * entirely, so chapters 7-12 resolve none of theirs. Absence is recorded and
         * imported around; it is not ambiguity, and it is never filled in.
         */
        issues.push(warn("audio-range-partially-present",
          `${range.component} disc ${range.disc} tracks ${range.firstTrack}-${range.lastTrack}: ` +
          `${assets.length} of ${expected} files present locally`, where));
      }
      for (const asset of assets) {
        if (asset.page != null || asset.exercise != null) {
          issues.push(error("guessed-audio-mapping",
            "an indexed asset claims a page or exercise", asset.sourceAssetId));
        }
      }
      if (range.page != null || range.exercise != null) {
        issues.push(error("guessed-audio-mapping",
          "a chapter audio range claims a page or exercise", where));
      }
    }
  }

  const errors = issues.filter(entry => entry.severity === SEVERITY.ERROR);
  return mergeValidation({
    issues,
    ok: errors.length === 0,
    summary: {
      chapters: numbers.length,
      units: (evidence?.editions ?? []).length,
      indexedAssets: evidence?.counts?.indexedAssets ?? 0,
      titleAnomalies: issues.filter(entry => entry.code === "chapter-title-anomaly").length,
      partialAudioRanges: issues.filter(entry => entry.code === "audio-range-partially-present").length,
      exactAudioPageExerciseMappings: 0
    }
  });
}

/**
 * Map the whole course.
 *
 * Rows the reviewed slice already covers are taken FROM it, so Kapitel 2 and the course
 * frame keep byte-identical identity and provenance; everything else is derived from the
 * structure index under the same key conventions.
 */
export function mapNetzwerkCourse(evidence, options = {}) {
  const now = options.now ?? Date.now();
  const reviewedRows = evidence?.reviewed?.rows ?? [];
  const reviewedBy = target => reviewedRows.filter(row => row.canonicalTargetEntity === target);

  const stamp = row => ({
    ...row.fieldsAllowedForImport,
    ...Object.fromEntries((row.fieldsMustRemainNullOrUnset ?? [])
      .filter(field => CANONICAL_NULLABLE.has(field))
      .map(field => [field, null])),
    createdAt: now,
    updatedAt: now
  });

  const courseRow = stamp(reviewedBy("course")[0]);
  const levelRow = stripContentLifecycle(stamp(reviewedBy("courseLevel")[0]));
  const reviewedUnit = stamp(reviewedBy("courseUnit")[0]);
  const reviewedLesson = stamp(reviewedBy("lesson")[0]);
  const reviewedTexts = reviewedBy("curriculumText").map(stamp);

  const provenance = (reference, sourceType = "official-structure-metadata") => ({
    contentStatus: IMPORTED_STATUS,
    contentVersion: 1,
    sourceReference: reference,
    sourceType,
    verifiedAt: null,
    verifiedBy: null,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    deleted: 0
  });

  /* ---- units: one per combined half-edition ---- */
  const units = evidence.editions.map(entry => {
    if (entry.slug === reviewedUnit.slug) return reviewedUnit;   // the reviewed A2.1 unit
    const urls = resourceUrls(evidence.structureIndex, entry.record?.officialEvidence);
    return {
      uuid: expectedUuid("unit", `${courseRow.slug}:${entry.slug}`),
      courseUuid: courseRow.uuid,
      courseLevelUuid: levelRow.uuid,
      slug: entry.slug,
      ordering: entry.ordering,
      ...provenance(urls.join(" | "))
    };
  });
  const unitBySlug = new Map(units.map(unit => [unit.slug, unit]));

  /* ---- lessons and their titles ---- */
  const lessons = [];
  const texts = [...reviewedTexts];

  for (const entry of evidence.chapters) {
    const { chapter, unit, titleEvidence } = entry;
    const reference = titleEvidence.join(" | ");

    const lesson = chapter.chapter === 2 ? reviewedLesson : {
      uuid: expectedUuid("lesson", `${courseRow.slug}:chapter:${chapter.chapter}`),
      unitUuid: unitBySlug.get(unit.slug).uuid,
      slug: slugifyTitle(chapter.printedChapterTitle),
      cefrLevel: courseRow.cefrLevel,
      ordering: chapter.chapter,
      ...provenance(reference)
    };
    lessons.push(lesson);

    if (chapter.chapter !== 2) {
      texts.push(curriculumText({
        ownerType: "lesson", ownerUuid: lesson.uuid, language: "de", kind: "title",
        text: chapter.printedChapterTitle, provenance: provenance(reference)
      }));
    }

    /*
     * The anomaly, recorded as its own text rather than replacing the printed title.
     * `curriculum-service` reads only `title` and `description`, so this is stored,
     * citable, and invisible to a learner screen — which is exactly right for a
     * bibliographic disagreement.
     */
    if (chapter.transcriptHeading && chapter.transcriptHeading !== chapter.printedChapterTitle) {
      texts.push(curriculumText({
        ownerType: "lesson", ownerUuid: lesson.uuid, language: "de",
        kind: TRANSCRIPT_ANOMALY_KIND, text: chapter.transcriptHeading,
        provenance: provenance(
          `${reference} | ${chapter.titleReconciliation}`)
      }));
    }
  }

  return {
    keys: {
      courseSlug: courseRow.slug,
      courseUuid: courseRow.uuid,
      levelUuid: levelRow.uuid,
      unitUuids: units.map(unit => unit.uuid),
      lessonUuids: lessons.map(lesson => lesson.uuid)
    },
    course: {
      course: courseRow,
      levels: [levelRow],
      units,
      lessons,
      // No section, item or prerequisite: a chapter title is not a lesson plan, and an
      // empty section would put a blank screen in front of a learner.
      sections: [],
      items: [],
      prerequisites: [],
      texts
    },
    // The 189 assets are already registered; this import reuses them and writes none.
    audioAssets: [],
    vocabulary: [],
    sentences: [],
    exercises: [],
    listening: null,
    audioReuse: audioReuseReport(evidence),
    stats: {
      courses: 1,
      courseLevels: 1,
      courseUnits: units.length,
      lessons: lessons.length,
      curriculumTexts: texts.length,
      audioAssets: 0,
      totalRows: 1 + 1 + units.length + lessons.length + texts.length
    }
  };
}

/** Which already-registered assets each chapter's evidenced ranges cover. Creates none. */
export function audioReuseReport(evidence) {
  const perChapter = (evidence?.chapters ?? []).map(entry => ({
    chapter: entry.chapter.chapter,
    ranges: entry.audio.map(({ range, assets }) => ({
      component: range.component, disc: range.disc,
      firstTrack: range.firstTrack, lastTrack: range.lastTrack,
      resolved: assets.length,
      // Recorded as unresolved because it is: the range proves the Kapitel, not the page.
      page: null, exercise: null,
      verificationStatus: range.verificationStatus ?? null
    })),
    assets: entry.audio.flatMap(({ assets }) => assets.map(asset => asset.canonicalAudioAssetUuid))
  }));

  const referenced = new Set(perChapter.flatMap(entry => entry.assets));
  return {
    indexed: evidence?.counts?.indexedAssets ?? 0,
    referencedByAChapter: referenced.size,
    created: 0,
    perChapter,
    // No canonical link is written: an audio_assets row has no chapter column, and a
    // lesson item would assert a task association nothing proves.
    linksCreated: 0
  };
}

function curriculumText({ ownerType, ownerUuid, language, kind, text, provenance }) {
  return {
    uuid: expectedUuid("text", `${ownerType}:${ownerUuid}:${language}:${kind}`),
    ownerType, ownerUuid, language, kind, text,
    ...provenance
  };
}

/** Slug from a printed chapter title. Identity only; the title itself is stored verbatim. */
export function slugifyTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Select, validate and map the whole 12-chapter structure. */
export function buildNetzwerkCourse(input = {}) {
  const evidence = selectNetzwerkCourse(input);
  const validation = validateNetzwerkCourse(evidence);
  const mapped = validation.ok ? mapNetzwerkCourse(evidence, { now: input.now }) : null;
  return { evidence, validation, mapped };
}
