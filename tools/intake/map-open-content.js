/*
 * Adapter for the open-licensed content artifact.
 *
 * Pure: no filesystem, no database, no network. It takes the intermediate JSON the
 * content build produced and returns the same mapped-batch shape the rest of the intake
 * already writes, plus an audit of what it decided and why.
 *
 * THE DECISION THIS FILE EXISTS TO MAKE. The artifact mixes two kinds of row that look
 * identical once they reach the schema:
 *
 *   - text transcribed from a CC BY source (Deutsch im Blick, Grimm Grammar, COERLL),
 *     whose provenance is checkable against a public page;
 *   - original DeutschFlow German and Arabic — definitions, translations, examples,
 *     exercise wording — that no German/Arabic educator has reviewed.
 *
 * Both belong in the store: the second cannot be reviewed if it was never imported. Only
 * the first may be presented to a learner as teaching material. The schema already has
 * the word for that difference — `content_status`, whose DDL default is `draft` — so this
 * adapter assigns it rather than inventing a lifecycle. Nothing here decides quality by
 * judgement: every assignment is read from the artifact's own `languageOrigins` and
 * `originalAdaptedStatus` markers, and the audit reports the counts both ways.
 *
 * Rows that carry no status column of their own — links, lesson items, segments — cannot
 * say "draft". A link into unpublished content is therefore not written at all, and
 * reappears when a later import finds its target promoted.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";
import { TABLE_SPECS, SCHEMA_VERSION } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js";
import { DRAFT_STATUS } from "../../01_APPLICATION/CURRENT_APP/src/content/publication.js";
import { IMPORTED_STATUS } from "./map-canonical.js";

export const ARTIFACT_TYPE = "deutschflow-open-content-intermediate-v1";
export const SUPPORTED_DATASET_VERSIONS = Object.freeze([1]);

/**
 * Canonical schema versions an artifact may declare and still be imported.
 *
 * Schema 11 only ADDED `translations.vocab_uuid` and `accepted_answers.vocab_uuid` and
 * relaxed `meaning_uuid` to optional, so every row an artifact written for 10 carries is
 * still valid; this adapter fills the new column from the vocabulary record the row
 * already belongs to. A version outside this list is refused rather than guessed at,
 * because a field that MOVED would be silently misplaced.
 */
export const COMPATIBLE_SCHEMA_VERSIONS = Object.freeze([10, SCHEMA_VERSION]);

/** The licence marker every canonical `sourceReference` must end up carrying. */
export const LICENCE_MARKER = "licence: CC BY 4.0";
export const LICENCE_ID = "cc-by-4.0";

/** Only official COERLL / University of Texas / Creative Commons hosts are accepted. */
export const OFFICIAL_HOSTS = Object.freeze([
  "coerll.utexas.edu", "media.la.utexas.edu", "creativecommons.org"
]);

/**
 * Origins that mean "this text came from the source". Everything else — an original
 * translation, an original definition, an original adaptation — is DeutschFlow wording
 * awaiting educator review.
 *
 * Matched as a PREFIX, because an artifact may qualify what it did: an origin recorded as
 * "source-adapted for natural written German; source meaning preserved" is still adapted
 * from the source, and the qualification is for a reader, not for this decision.
 */
export const SOURCE_ORIGINS = Object.freeze([
  "source-transcribed", "source-adapted", "source-corrected-and-lightly-adapted"
]);

/**
 * Where an artifact may record the origin of one language.
 *
 * Two schemes are in use. The first lesson keyed `languageOrigins` by language code; the
 * second keys `fieldOrigins` by the field it filled — `german`, `english`, `arabic` — or
 * by the part of the record it describes, such as `germanTranscript`. All of them are
 * read here so a lesson is judged by what its own artifact says, rather than by which
 * spelling the build happened to use.
 */
const ORIGIN_KEYS_BY_LANGUAGE = Object.freeze({
  de: ["de", "german", "germanTranscript"],
  en: ["en", "english", "englishTranscript"],
  ar: ["ar", "arabic", "arabicTranscript"]
});

/** Text kinds that are a label rather than teaching content. */
const LABEL_KINDS = Object.freeze(["title", "instruction", "objective", "subtitle"]);

/** Record-level statuses that carry no authored language body of their own. */
export const METADATA_STATUSES = Object.freeze(["source-metadata"]);

/**
 * The review states an artifact may declare on a record.
 *
 * These are the AUTHOR's summary of the record as a whole; `fieldOrigins` says which part
 * of it still needs a person. The two are read together and the stricter one wins: a
 * record whose review state is not `SOURCE_VERIFIED` can never publish a field the origin
 * markers do not vouch for, and a field the origins do vouch for is still refused if the
 * record was excluded outright.
 */
export const REVIEW_STATES = Object.freeze({
  SOURCE_VERIFIED: "SOURCE_VERIFIED",
  EDUCATOR_REVIEW_REQUIRED: "EDUCATOR_REVIEW_REQUIRED",
  TECHNICAL_REVIEW_REQUIRED: "TECHNICAL_REVIEW_REQUIRED",
  EXCLUDED: "EXCLUDED"
});

const SPEC_BY_ENTITY = new Map(TABLE_SPECS.map(spec => [spec.entity, spec]));

const fromSource = origin => typeof origin === "string" &&
  SOURCE_ORIGINS.some(prefix => origin.startsWith(prefix));

/**
 * What the artifact says about one language of one row, or undefined if it says nothing.
 * A title or instruction is answered by the record's own note about its labels when it
 * has one, because those are written by DeutschFlow even where the body is transcribed.
 */
export function originFor(record, language, kind = null) {
  const declared = { ...(record?.fieldOrigins ?? {}), ...(record?.languageOrigins ?? {}) };
  if (kind && LABEL_KINDS.includes(kind) && declared.titlesAndInstructions !== undefined) {
    return declared.titlesAndInstructions;
  }
  for (const key of ORIGIN_KEYS_BY_LANGUAGE[language] ?? [language]) {
    if (declared[key] !== undefined) return declared[key];
  }
  return undefined;
}

/* ------------------------------------------------------------- validation */

class Issues {
  constructor() { this.errors = []; this.warnings = []; }
  error(code, detail, where) { this.errors.push({ code, detail, where }); }
  warn(code, detail, where) { this.warnings.push({ code, detail, where }); }
}

/** Every record in the artifact, flattened with the path it was found at. */
export function openContentRecords(dataset) {
  const records = [];
  const push = (record, where) => { if (record) records.push({ record, where }); };

  push(dataset.structure?.course, "structure.course");
  push(dataset.structure?.unit, "structure.unit");
  push(dataset.structure?.lesson, "structure.lesson");
  (dataset.structure?.sections ?? []).forEach((s, i) => push(s, `structure.sections[${i}]`));
  (dataset.vocabulary ?? []).forEach((v, i) => push(v, `vocabulary[${i}]`));
  (dataset.sentences ?? []).forEach((s, i) => push(s, `sentences[${i}]`));
  push(dataset.grammar?.topic, "grammar.topic");
  (dataset.grammar?.rules ?? []).forEach((r, i) => push(r, `grammar.rules[${i}]`));
  (dataset.exercises ?? []).forEach((e, i) => push(e, `exercises[${i}]`));
  push(dataset.listening?.mediaAsset, "listening.mediaAsset");
  push(dataset.listening?.item, "listening.item");
  return records;
}

/**
 * Check the artifact before anything is mapped.
 *
 * Refusals are errors; things worth saying but not worth stopping for are warnings. An
 * error means nothing is imported, because a batch that is wrong in one place has no
 * claim to be right in another.
 */
export function validateOpenContent(dataset) {
  const issues = new Issues();

  if (dataset?.importContract?.artifactType !== ARTIFACT_TYPE) {
    issues.error("unexpected-artifact-type",
      `expected ${ARTIFACT_TYPE}, found ${dataset?.importContract?.artifactType}`, "importContract");
  }
  if (!SUPPORTED_DATASET_VERSIONS.includes(Number(dataset?.datasetVersion))) {
    issues.error("unreviewed-dataset-version",
      `version ${dataset?.datasetVersion} has not been reviewed`, "datasetVersion");
  }
  if (!COMPATIBLE_SCHEMA_VERSIONS.includes(Number(dataset?.importContract?.canonicalSchemaVersion))) {
    issues.error("schema-version-mismatch",
      `artifact targets ${dataset?.importContract?.canonicalSchemaVersion}, ` +
      `this build reads ${COMPATIBLE_SCHEMA_VERSIONS.join(" or ")}`,
      "importContract");
  }

  validateLicensing(dataset, issues);
  validateRecords(dataset, issues);
  validateCounts(dataset, issues);
  validateMedia(dataset, issues);
  validatePronunciationMetadata(dataset, issues);

  return { ok: issues.errors.length === 0, errors: issues.errors, warnings: issues.warnings };
}

function validateLicensing(dataset, issues) {
  const licence = (dataset.licences ?? []).find(entry => entry.id === LICENCE_ID);
  if (!licence) {
    issues.error("missing-licence-record", `no ${LICENCE_ID} licence record`, "licences");
  } else if (!licence.url?.startsWith("https://creativecommons.org/licenses/by/4.0")) {
    issues.error("licence-url-not-official", licence.url ?? "(none)", "licences");
  }

  if (!(dataset.attributionBundle?.texts ?? []).length) {
    issues.error("missing-attribution", "no attribution texts to display", "attributionBundle");
  }
  if (!dataset.attributionBundle?.changesNotice) {
    // CC BY requires indicating changes; adapted content without that notice is not
    // attributable, whatever else the bundle says.
    issues.error("missing-changes-notice", "CC BY requires a changes notice", "attributionBundle");
  }

  for (const [index, source] of (dataset.sources ?? []).entries()) {
    const where = `sources[${index}]`;
    if (source.licence !== LICENCE_ID) {
      issues.error("source-not-cc-by", `${source.id} is ${source.licence}`, where);
    }
    if (!source.licenceEvidence) {
      issues.error("source-without-licence-evidence", source.id, where);
    }
    if (!isOfficial(source.url)) {
      issues.error("source-host-not-official", source.url ?? "(none)", where);
    }
  }
}

function isOfficial(url) {
  try {
    return OFFICIAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function validateRecords(dataset, issues) {
  const sourceIds = new Set(dataset.sources?.map(source => source.id) ?? []);
  const seen = new Set();

  for (const { record, where } of openContentRecords(dataset)) {
    if (!record.sourceId) issues.error("record-without-source-id", "", where);
    else if (seen.has(record.sourceId)) issues.error("duplicate-source-id", record.sourceId, where);
    seen.add(record.sourceId);

    // The record uuid is derivable, so a wrong one is caught rather than trusted.
    const expected = deterministicUuid(`deutschflow/open-content/${record.contentType}`, record.sourceId);
    if (record.uuid !== expected) {
      issues.error("record-uuid-mismatch", `${record.uuid} should be ${expected}`, where);
    }

    for (const id of record.source ?? []) {
      if (!sourceIds.has(id)) issues.error("unresolved-source-reference", id, where);
    }
    for (const url of record.provenance?.sourceUrls ?? []) {
      if (!isOfficial(url)) issues.error("provenance-host-not-official", url, where);
    }
    if (!(record.attributionRequirement ?? []).length) {
      issues.error("record-without-attribution", record.sourceId, where);
    }
    if (record.licence !== LICENCE_ID) {
      issues.error("record-not-cc-by", `${record.sourceId} is ${record.licence}`, where);
    }
    if (record.reviewStatus !== undefined && !(record.reviewStatus in REVIEW_STATES)) {
      issues.error("unknown-review-state", record.reviewStatus, where);
    }
    if (record.reviewStatus === REVIEW_STATES.EXCLUDED) {
      // An excluded record has no business being in a batch that will be written.
      issues.error("excluded-record-present", record.sourceId, where);
    }

    validateCanonicalRows(record, where, issues);
  }
}

/** Every canonical row must name an entity this build has, and only fields it declares. */
function validateCanonicalRows(record, where, issues) {
  for (const { entity, row, at } of canonicalRowsOf(record)) {
    const spec = SPEC_BY_ENTITY.get(entity);
    if (!spec) {
      issues.error("unknown-canonical-entity", entity, `${where}.${at}`);
      continue;
    }
    const declared = new Set(spec.columns.map(([, field]) => field));
    for (const field of Object.keys(row ?? {})) {
      if (!declared.has(field)) {
        issues.error("unknown-canonical-field", `${entity}.${field}`, `${where}.${at}`);
      }
    }
    if (declared.has("contentStatus") && row.contentStatus !== IMPORTED_STATUS) {
      issues.error("unexpected-content-status",
        `expected ${IMPORTED_STATUS}, found ${row.contentStatus}`, `${where}.${at}`);
    }
    if (declared.has("verifiedAt") && (row.verifiedAt !== null || row.verifiedBy !== null)) {
      // Nothing in this artifact has been reviewed; a row claiming otherwise is refused.
      issues.error("premature-verification", entity, `${where}.${at}`);
    }
  }
}

function validateCounts(dataset, issues) {
  const declared = dataset.recordCounts ?? {};
  const actual = {
    courses: dataset.structure?.course ? 1 : 0,
    units: dataset.structure?.unit ? 1 : 0,
    lessons: dataset.structure?.lesson ? 1 : 0,
    lessonSections: (dataset.structure?.sections ?? []).length,
    vocabulary: (dataset.vocabulary ?? []).length,
    sentences: (dataset.sentences ?? []).length,
    grammarTopics: dataset.grammar?.topic ? 1 : 0,
    grammarRules: (dataset.grammar?.rules ?? []).length,
    exercises: (dataset.exercises ?? []).length,
    listeningItems: dataset.listening?.item ? 1 : 0,
    remoteMediaAssets: dataset.listening?.mediaAsset ? 1 : 0,
    listeningSegments: (dataset.listening?.item?.canonicalTarget?.segments ?? []).length
  };
  for (const [key, count] of Object.entries(actual)) {
    if (declared[key] !== undefined && declared[key] !== count) {
      issues.error("declared-count-mismatch",
        `${key}: declared ${declared[key]}, found ${count}`, "recordCounts");
    }
  }
}

/**
 * The media asset stays remote metadata.
 *
 * Its checksum, duration, codec and redistributable binary are all unresolved, and
 * inventing any of them would make an unverified file look verified. So the row is
 * refused unless it says exactly that: remote, no local path, no invented numbers.
 */
function validateMedia(dataset, issues) {
  const asset = dataset.listening?.mediaAsset?.canonicalTarget?.row;
  const where = "listening.mediaAsset";
  if (!asset) {
    issues.error("missing-media-asset", "", where);
    return;
  }
  if (asset.availability !== "remote") {
    issues.error("media-not-remote", asset.availability, where);
  }
  if (asset.localPath) {
    issues.error("media-claims-local-binary", asset.localPath, where);
  }
  if (asset.checksum) {
    issues.error("media-checksum-not-verified", String(asset.checksum), where);
  }
  if (Number(asset.durationMs) !== 0 || Number(asset.byteSize) !== 0) {
    issues.error("media-metadata-fabricated",
      `durationMs ${asset.durationMs}, byteSize ${asset.byteSize}`, where);
  }
  if (!isOfficial(asset.remoteUrl)) {
    issues.error("media-host-not-official", asset.remoteUrl ?? "(none)", where);
  }

  const item = dataset.listening?.item?.canonicalTarget;
  if (item?.audio && item.audio.uuid !== asset.uuid) {
    issues.error("media-asset-duplicated",
      `listening audio ${item.audio.uuid} is not the registered asset ${asset.uuid}`, where);
  }
}

/**
 * Pronunciation is metadata until it is measured.
 *
 * A lesson may record that an official pronunciation page exists for its chapter. That is
 * a citation, not teaching material: IPA, phonemes and model audio are exactly the things
 * that cannot be inferred from a page, so a record claiming any of them — or claiming to
 * be learner-ready — is refused rather than imported and quietly believed. Nothing here
 * maps to a canonical row, so no pronunciation screen can ever show it.
 */
function validatePronunciationMetadata(dataset, issues) {
  for (const [index, record] of (dataset.pronunciationMetadata ?? []).entries()) {
    const where = `pronunciationMetadata[${index}]`;
    if (record.learnerReady !== false) {
      issues.error("pronunciation-claims-learner-ready", String(record.learnerReady), where);
    }
    for (const field of ["ipa", "phoneme", "modelAudio"]) {
      if (record[field] !== null && record[field] !== undefined) {
        issues.error("pronunciation-metadata-fabricated", `${field}: ${record[field]}`, where);
      }
    }
    if (record.canonicalTarget) {
      issues.error("pronunciation-metadata-would-be-written", record.sourceId, where);
    }
    if (!isOfficial(record.sourceUrl)) {
      issues.error("pronunciation-host-not-official", record.sourceUrl ?? "(none)", where);
    }
  }
}

/** Canonical rows a record carries, with the key they sit under. */
function canonicalRowsOf(record) {
  const target = record.canonicalTarget ?? {};
  const rows = [];
  const add = (entity, row, at) => { if (row) rows.push({ entity, row, at }); };
  const addAll = (entity, list, at) =>
    (list ?? []).forEach((row, index) => add(entity, row, `${at}[${index}]`));

  switch (record.contentType) {
    case "course":
      add("courses", target.row, "row");
      add("courseLevels", target.level, "level");
      addAll("curriculumTexts", target.texts, "texts");
      break;
    case "course-unit":
      add("courseUnits", target.row, "row");
      addAll("curriculumTexts", target.texts, "texts");
      break;
    case "lesson":
      add("lessons", target.row, "row");
      addAll("curriculumTexts", target.texts, "texts");
      break;
    case "lesson-section":
      add("lessonSections", target.row, "row");
      addAll("curriculumTexts", target.texts, "texts");
      break;
    case "vocabulary":
      add("vocabularyItems", target.item, "item");
      addAll("vocabularyMeanings", target.meanings, "meanings");
      addAll("translations", target.translations, "translations");
      addAll("acceptedAnswers", target.acceptedAnswers, "acceptedAnswers");
      add("lessonItems", target.lessonItem, "lessonItem");
      break;
    case "sentence":
      add("sentences", target.sentence, "sentence");
      addAll("sentenceTexts", target.texts, "texts");
      addAll("sentenceVocabulary", target.vocabulary, "vocabulary");
      addAll("sentenceGrammar", target.grammar, "grammar");
      add("lessonItems", target.lessonItem, "lessonItem");
      break;
    case "grammar-topic":
      add("grammarTopics", target.row, "row");
      addAll("grammarTexts", target.texts, "texts");
      break;
    case "grammar-rule":
      add("grammarRules", target.rule, "rule");
      addAll("grammarTexts", target.texts, "texts");
      addAll("grammarExamples", target.examples, "examples");
      add("lessonItems", target.lessonItem, "lessonItem");
      break;
    case "exercise":
      add("exercises", target.exercise, "exercise");
      addAll("exerciseTexts", target.texts, "texts");
      addAll("exerciseOptions", target.options, "options");
      addAll("exerciseTargets", target.targets, "targets");
      add("lessonItems", target.lessonItem, "lessonItem");
      break;
    case "audio-asset":
      add("audioAssets", target.row, "row");
      break;
    case "listening":
      add("audioAssets", target.audio, "audio");
      add("listeningItems", target.item, "item");
      addAll("listeningTexts", target.texts, "texts");
      addAll("listeningSpeakers", target.speakers, "speakers");
      addAll("listeningSegments", target.segments, "segments");
      addAll("listeningSegmentTexts", target.segmentTexts, "segmentTexts");
      addAll("listeningLinks", target.links, "links");
      add("lessonItems", target.lessonItem, "lessonItem");
      break;
    default:
      break;
  }
  return rows;
}

/* --------------------------------------------------------- publication */

/**
 * Whether one canonical row may be published, decided from the artifact's own markers.
 *
 * A row that carries a language (a text row) is judged by that language's origin. A row
 * that carries an authored body in a column — a sentence's German, an example — is judged
 * by the record's German origin or its adaptation status. A row that carries no authored
 * text at all is a container and is published with its record.
 */
export function publicationOf(record, entity, row, context = {}) {
  /*
   * A record the author excluded is never published, whatever its fields say. Every other
   * review state is a statement that a PERSON still has to look, which the field origins
   * then localise — so it restricts rather than permits, and the field rules below decide.
   */
  if (record.reviewStatus === REVIEW_STATES.EXCLUDED) return DRAFT_STATUS;

  /*
   * A completed review outranks every heuristic below it.
   *
   * The origin markers exist to decide what a person still has to look at. Once that
   * person has looked and approved the row, the question they were asked is answered, and
   * re-deriving `draft` from provenance would hold back content the reviewer released —
   * and, worse, would keep withholding the lesson items and links that point at it.
   */
  if (context.approved?.has(row.uuid)) return IMPORTED_STATUS;

  if (row?.language) {
    /* A language the artifact declares as source-derived is published. Anything else is
       DeutschFlow wording: the changes notice states in the artifact itself that the
       Arabic translations, the German definitions and the examples were newly written,
       and every Arabic origin any artifact declares is an original translation. So an
       undeclared language is published only when it is not Arabic. */
    const origin = originFor(record, row.language, row.kind);
    if (origin !== undefined) return fromSource(origin) ? IMPORTED_STATUS : DRAFT_STATUS;
    return row.language === "ar" ? DRAFT_STATUS : IMPORTED_STATUS;
  }

  if (record.contentType === "exercise") {
    /* An exercise is published when its answer key is checkable, not when its wording
       reads well: every expected answer must equal a published vocabulary form from this
       same batch. That is a property this adapter verifies for itself rather than a
       claim it takes from the artifact — and it is what keeps a graded answer traceable
       to the CC BY source rather than to unreviewed prose. */
    return context.exerciseVerdicts?.get(record.sourceId) === false
      ? DRAFT_STATUS
      : IMPORTED_STATUS;
  }

  switch (entity) {
    case "sentences":
      // The sentence row IS its German text.
      return fromSource(originFor(record, "de")) ? IMPORTED_STATUS : DRAFT_STATUS;

    case "vocabularyMeanings":
      // The meaning row is the Arabic gloss plus an original German definition.
      return fromSource(originFor(record, "ar")) ? IMPORTED_STATUS : DRAFT_STATUS;

    case "grammarTopics":
    case "grammarRules":
    case "grammarExamples":
      /* Every word of the grammar — explanations in three languages and the example
         sentences — is original DeutschFlow prose adapted from Grimm Grammar. A rule
         published without them would be a heading that teaches nothing, so the whole
         topic waits for review together. */
      return DRAFT_STATUS;

    default:
      /* Containers and structure: a course, a unit, a lesson, a section, a vocabulary
         item, an exercise, a listening activity, the remote asset. They hold ordering,
         identity and provenance rather than authored teaching text, and the text they do
         reference lives in its own row and is judged there. */
      return IMPORTED_STATUS;
  }
}

/** Parent of a row, for cascading a draft down foreign keys. */
const PARENT_OF = Object.freeze({
  /*
   * `translations` and `acceptedAnswers` are deliberately ABSENT. Since schema 11 both
   * hang off the vocabulary item, not off the Arabic sense, and cascading a draft from
   * that sense is exactly the coupling the schema change removed: a verified English
   * translation must not disappear because the Arabic beside it is still being reviewed.
   */
  sentenceTexts: row => row.sentenceUuid,
  grammarExamples: row => row.ruleUuid,
  grammarRules: row => row.topicUuid,
  grammarTexts: row => row.ownerUuid,
  curriculumTexts: row => row.ownerUuid,
  listeningTexts: row => row.itemUuid,
  listeningSegmentTexts: row => row.segmentUuid,
  exerciseTexts: row => row.exerciseUuid
});

/**
 * Which exercises have an answer key traceable to published vocabulary.
 *
 * Every expected option must equal a vocabulary form this batch publishes, with or
 * without its article. An exercise whose answer comes from anywhere else — an unreviewed
 * grammar rule, a newly written example — cannot be scored against verified content, so
 * it waits with the content it depends on.
 */
export function verifyExerciseAnswerKeys(dataset) {
  const forms = new Set();
  for (const record of dataset.vocabulary ?? []) {
    const item = record.canonicalTarget?.item;
    if (!item) continue;
    forms.add(normalizeAnswer(item.german));
    if (item.article) forms.add(normalizeAnswer(`${item.article} ${item.german}`));
    for (const accepted of record.acceptedAnswers?.de ?? []) forms.add(normalizeAnswer(accepted));
  }

  const verdicts = new Map();
  for (const record of dataset.exercises ?? []) {
    const expected = (record.canonicalTarget?.options ?? [])
      .filter(option => option.isExpected)
      .map(option => normalizeAnswer(option.text));
    verdicts.set(record.sourceId,
      expected.length > 0 && expected.every(answer => forms.has(answer)));
  }
  return verdicts;
}

function normalizeAnswer(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/* -------------------------------------------------------------- mapping */

/**
 * Map the artifact into the canonical batch the intake writes.
 *
 * @param {object} dataset the parsed artifact
 * @param {object} [options] { now }
 * @returns {{ mapped: object, audit: object }}
 */
export function mapOpenContent(source, options = {}) {
  const now = options.now ?? Date.now();
  /* Rows an educator has already approved. Empty until a review has been integrated. */
  const approved = options.approved instanceof Set
    ? options.approved
    : new Set(options.approved ?? []);
  // Worked on a copy: deciding a status rewrites rows, and the caller's artifact — often
  // a parsed file a test reuses — must read the same on the second call as on the first.
  const dataset = structuredClone(source);
  const statuses = new Map();          // uuid -> imported | draft
  const records = openContentRecords(dataset);
  const exerciseVerdicts = verifyExerciseAnswerKeys(dataset);
  const context = { exerciseVerdicts, approved };

  // Pass 1: decide each row's own status and stamp the licence into its provenance.
  for (const { record } of records) {
    for (const { entity, row } of canonicalRowsOf(record)) {
      if ("sourceReference" in row) row.sourceReference = withLicence(row.sourceReference);
      if (!("contentStatus" in row)) continue;
      row.contentStatus = publicationOf(record, entity, row, context);
      statuses.set(row.uuid, row.contentStatus);
    }
  }

  // Pass 2: a child of a draft parent cannot be published on its own — it would be
  // unreachable in the app and a dangling reference in the exported dataset.
  let changed = true;
  while (changed) {
    changed = false;
    for (const { record } of records) {
      for (const { entity, row } of canonicalRowsOf(record)) {
        const parentUuid = PARENT_OF[entity]?.(row);
        if (!parentUuid || !("contentStatus" in row)) continue;
        if (statuses.get(parentUuid) === DRAFT_STATUS && row.contentStatus !== DRAFT_STATUS) {
          row.contentStatus = DRAFT_STATUS;
          statuses.set(row.uuid, DRAFT_STATUS);
          changed = true;
        }
      }
    }
  }

  const published = uuid => statuses.get(uuid) !== DRAFT_STATUS;
  const withheldLinks = [];

  /*
   * A row with no status column cannot wait in the store: it is either written or it is
   * not. Anything that only exists to join two rows — a lesson item, an accepted answer,
   * an option, a link — is written only when EVERY row it references is published.
   *
   * Both ends matter. Pointing at unpublished content would render a lesson item that
   * leads nowhere; hanging off an unpublished parent would leave a row referencing a
   * table entry that was never exported, which is a broken foreign key the moment the
   * dataset is loaded somewhere else.
   */
  const keepLink = (entity, row, ...references) => {
    const unpublished = references.filter(uuid => uuid && !published(uuid));
    if (!unpublished.length) return true;
    withheldLinks.push({ entity, uuid: row.uuid, targets: unpublished });
    return false;
  };

  const mapped = emptyBatch();
  const structure = dataset.structure ?? {};

  applyStructure(mapped, structure);
  applyVocabulary(mapped, dataset.vocabulary ?? [], keepLink, published);
  applySentences(mapped, dataset.sentences ?? [], keepLink);
  applyGrammar(mapped, dataset.grammar ?? {}, keepLink);
  applyExercises(mapped, dataset.exercises ?? [], keepLink);
  applyListening(mapped, dataset.listening ?? {}, keepLink);

  return {
    mapped,
    audit: buildAudit(dataset, records, statuses, withheldLinks, now)
  };
}

function withLicence(reference) {
  const text = String(reference ?? "").trim();
  if (!text) return LICENCE_MARKER;
  return text.includes(LICENCE_MARKER) ? text : `${text} | ${LICENCE_MARKER}`;
}

function emptyBatch() {
  return {
    course: {
      course: null, levels: [], units: [], lessons: [], sections: [],
      items: [], prerequisites: [], texts: []
    },
    vocabulary: [],
    sentences: [],
    grammar: [],
    exercises: [],
    listening: null,
    audioAssets: [],
    keys: {}
  };
}

function applyStructure(mapped, structure) {
  const course = structure.course?.canonicalTarget;
  if (course) {
    mapped.course.course = course.row;
    if (course.level) mapped.course.levels.push(course.level);
    mapped.course.texts.push(...(course.texts ?? []));
    mapped.keys.courseUuid = course.row?.uuid ?? null;
  }
  const unit = structure.unit?.canonicalTarget;
  if (unit) {
    mapped.course.units.push(unit.row);
    mapped.course.texts.push(...(unit.texts ?? []));
    mapped.keys.unitUuid = unit.row?.uuid ?? null;
  }
  const lesson = structure.lesson?.canonicalTarget;
  if (lesson) {
    mapped.course.lessons.push(lesson.row);
    mapped.course.texts.push(...(lesson.texts ?? []));
    mapped.keys.lessonUuid = lesson.row?.uuid ?? null;
  }
  for (const section of structure.sections ?? []) {
    mapped.course.sections.push(section.canonicalTarget.row);
    mapped.course.texts.push(...(section.canonicalTarget.texts ?? []));
  }
}

function applyVocabulary(mapped, records, keepLink, published) {
  for (const record of records) {
    const target = record.canonicalTarget;
    const vocabUuid = target.item.uuid;

    /*
     * Both support languages are attached to the WORD.
     *
     * Where a row names an Arabic sense that is not published, the PAIRING is dropped
     * rather than the row: the English or the German answer is still real, it simply has
     * no reviewed sense to sit beside yet. A later import restores the pairing once the
     * sense is promoted, exactly as it restores a withheld link.
     */
    const unpair = row => ({
      ...row,
      vocabUuid,
      meaningUuid: row.meaningUuid && published(row.meaningUuid) ? row.meaningUuid : null
    });

    mapped.vocabulary.push({
      item: target.item,
      meanings: target.meanings ?? [],
      translations: (target.translations ?? []).map(unpair),
      /*
       * An accepted answer has no status column of its own, so it is written only when
       * the row that SUPPLIES ITS TEXT is published: the Arabic meaning for an `ar`
       * answer, the English translation for an `en` one, the word itself for German.
       * That keeps an unreviewed Arabic gloss from reappearing as an answer, and keeps a
       * German or English answer from vanishing because the Arabic is still in review.
       */
      acceptedAnswers: (target.acceptedAnswers ?? [])
        .filter(answer => keepLink("acceptedAnswers", answer,
          textSourceOf(answer, target, vocabUuid)))
        .map(unpair)
    });
    if (target.lessonItem && keepLink("lessonItems", target.lessonItem, vocabUuid)) {
      mapped.course.items.push(target.lessonItem);
    }
  }
}

/** The row whose text an accepted answer repeats, and therefore whose review it shares. */
function textSourceOf(answer, target, vocabUuid) {
  switch (answer.language) {
    case "ar": return answer.meaningUuid ?? target.meanings?.[0]?.uuid ?? vocabUuid;
    case "en": return answer.translationUuid ?? target.translations?.[0]?.uuid ?? vocabUuid;
    default: return vocabUuid;
  }
}

function applySentences(mapped, records, keepLink) {
  for (const record of records) {
    const target = record.canonicalTarget;
    mapped.sentences.push({
      sentence: target.sentence,
      texts: target.texts ?? [],
      vocabulary: (target.vocabulary ?? [])
        .filter(link => keepLink("sentenceVocabulary", link, link.sentenceUuid, link.vocabUuid)),
      grammar: (target.grammar ?? [])
        .filter(link => keepLink("sentenceGrammar", link, link.sentenceUuid, link.ruleUuid)),
      tags: []
    });
    if (target.lessonItem && keepLink("lessonItems", target.lessonItem, target.sentence.uuid)) {
      mapped.course.items.push(target.lessonItem);
    }
  }
}

function applyGrammar(mapped, grammar, keepLink) {
  if (!grammar.topic) return;
  const topic = grammar.topic.canonicalTarget;
  const entry = {
    topic: topic.row,
    rules: [],
    examples: [],
    texts: [...(topic.texts ?? [])]
  };
  for (const rule of grammar.rules ?? []) {
    const target = rule.canonicalTarget;
    entry.rules.push(target.rule);
    entry.examples.push(...(target.examples ?? []));
    entry.texts.push(...(target.texts ?? []));
    if (target.lessonItem && keepLink("lessonItems", target.lessonItem, target.rule.uuid)) {
      mapped.course.items.push(target.lessonItem);
    }
  }
  mapped.grammar.push(entry);
}

function applyExercises(mapped, records, keepLink) {
  for (const record of records) {
    const target = record.canonicalTarget;
    mapped.exercises.push({
      exercise: target.exercise,
      texts: target.texts ?? [],
      options: (target.options ?? [])
        .filter(option => keepLink("exerciseOptions", option, option.exerciseUuid)),
      targets: (target.targets ?? [])
        .filter(link => keepLink("exerciseTargets", link, link.exerciseUuid, link.targetUuid))
    });
    if (target.lessonItem && keepLink("lessonItems", target.lessonItem, target.exercise.uuid)) {
      mapped.course.items.push(target.lessonItem);
    }
  }
}

function applyListening(mapped, listening, keepLink) {
  const target = listening.item?.canonicalTarget;
  if (!target) return;

  mapped.listening = {
    // The media row is registered once, through the listening aggregate. It is the same
    // row the artifact also lists as `mediaAsset`, so it is not added twice.
    audio: target.audio ?? null,
    item: target.item,
    texts: target.texts ?? [],
    speakers: target.speakers ?? [],
    segments: target.segments ?? [],
    segmentTexts: target.segmentTexts ?? [],
    links: (target.links ?? [])
      .filter(link => keepLink("listeningLinks", link, link.itemUuid, link.targetUuid))
  };
  if (target.lessonItem && keepLink("lessonItems", target.lessonItem, target.item.uuid)) {
    mapped.course.items.push(target.lessonItem);
  }
  mapped.keys.listeningUuid = target.item.uuid;
  mapped.keys.audioUuid = target.audio?.uuid ?? null;
}

/* ---------------------------------------------------------------- audit */

/**
 * Every row this batch holds back, as a person can act on it.
 *
 * The counts alone do not make content reviewable: an educator needs to know WHICH gloss,
 * in which lesson, in which language, and what it says. This is that list — one entry per
 * gated row, carrying its identity so approving it is a status change on the same uuid
 * and nothing about the row moves.
 */
function buildReviewQueue(dataset, records) {
  const lesson = dataset.structure?.lesson;
  const context = {
    lessonSourceId: lesson?.sourceId ?? null,
    lessonUuid: lesson?.canonicalTarget?.row?.uuid ?? null,
    lessonTitle: (lesson?.canonicalTarget?.texts ?? [])
      .find(text => text.kind === "title" && text.language === "de")?.text ?? null
  };

  const queue = [];
  for (const { record } of records) {
    for (const { entity, row } of canonicalRowsOf(record)) {
      if (row.contentStatus !== DRAFT_STATUS) continue;
      queue.push({
        ...context,
        uuid: row.uuid,
        entity,
        contentType: record.contentType,
        sourceId: record.sourceId,
        /* What a reviewer sorts and filters by: the language and the kind of text. */
        language: row.language ?? languageOfBody(entity),
        kind: row.kind ?? null,
        reviewStatus: record.reviewStatus ?? null,
        origin: row.language ? originFor(record, row.language, row.kind) ?? null : null,
        text: readableText(entity, row),
        sourceReference: row.sourceReference ?? null
      });
    }
  }
  return queue;
}

/** For a row whose text lives in a column rather than in a language-tagged row. */
function languageOfBody(entity) {
  switch (entity) {
    case "vocabularyMeanings": return "ar";
    case "sentences":
    case "grammarExamples": return "de";
    default: return null;
  }
}

function readableText(entity, row) {
  switch (entity) {
    case "vocabularyMeanings": return row.arabicText ?? null;
    case "translations": return row.englishText ?? null;
    case "sentences":
    case "grammarExamples": return row.german ?? null;
    case "exercises":
    case "grammarTopics":
    case "grammarRules": return row.slug ?? null;
    default: return row.text ?? null;
  }
}

function buildAudit(dataset, records, statuses, withheldLinks, now) {
  const byEntity = { published: {}, draft: {} };
  const counted = new Set();
  let publishedTotal = 0;
  let draftTotal = 0;

  for (const { record } of records) {
    for (const { entity, row } of canonicalRowsOf(record)) {
      // The media asset appears under both `mediaAsset` and the listening activity; it
      // is one row and is counted once.
      if (!("contentStatus" in row) || counted.has(row.uuid)) continue;
      counted.add(row.uuid);
      const bucket = row.contentStatus === DRAFT_STATUS ? "draft" : "published";
      byEntity[bucket][entity] = (byEntity[bucket][entity] ?? 0) + 1;
      if (bucket === "draft") draftTotal += 1; else publishedTotal += 1;
    }
  }

  const origins = {};
  for (const { record } of records) {
    const declared = { ...(record.fieldOrigins ?? {}), ...(record.languageOrigins ?? {}) };
    for (const [field, origin] of Object.entries(declared)) {
      const key = `${field}:${origin}`;
      origins[key] = (origins[key] ?? 0) + 1;
    }
  }

  const reviewStates = {};
  for (const { record } of records) {
    if (!record.reviewStatus) continue;
    reviewStates[record.reviewStatus] = (reviewStates[record.reviewStatus] ?? 0) + 1;
  }

  return {
    generatedAt: now,
    artifactType: dataset.importContract?.artifactType ?? null,
    /* Metadata the artifact cites but deliberately does not import. */
    pronunciationMetadata: (dataset.pronunciationMetadata ?? []).map(record => ({
      sourceId: record.sourceId, sourceUrl: record.sourceUrl ?? null,
      reviewStatus: record.reviewStatus ?? null, learnerReady: record.learnerReady === true,
      canonicalRows: 0
    })),
    datasetVersion: dataset.datasetVersion ?? null,
    licence: LICENCE_ID,
    licenceUrl: dataset.attributionBundle?.licenceUrl ?? null,
    attributionRequired: dataset.attributionBundle?.displayRequired === true,
    attributionTexts: dataset.attributionBundle?.texts ?? [],
    changesNotice: dataset.attributionBundle?.changesNotice ?? null,
    cefrAssignment: dataset.cefrAssignment ?? null,
    sources: (dataset.sources ?? []).map(source => ({
      id: source.id, url: source.url, licence: source.licence,
      licenceEvidence: source.licenceEvidence ?? null
    })),
    /* The whole point of the review gate, in numbers a reviewer can act on. */
    /* One entry per gated row, so review is a task list rather than a number. */
    reviewQueue: buildReviewQueue(dataset, records),
    review: {
      publishedRows: publishedTotal,
      draftRows: draftTotal,
      /* What the artifact itself says still needs a person, by state. */
      reviewStates,
      publishedByEntity: byEntity.published,
      draftByEntity: byEntity.draft,
      fieldOrigins: origins,
      withheldLinks: withheldLinks.length,
      withheldLinkDetail: withheldLinks,
      reason: "original DeutschFlow German/Arabic awaits educator review; " +
        "source-transcribed CC BY text is published"
    }
  };
}

/* --------------------------------------------------------------- facade */

/**
 * Validate and map in one call, the way a runner or a test wants it.
 * Throws on a validation error: a batch that fails its own contract is not imported.
 */
export function buildOpenContentLesson(options = {}) {
  const { dataset, now = Date.now(), approved = null } = options;
  const validation = validateOpenContent(dataset);
  if (!validation.ok) {
    const detail = validation.errors
      .map(error => `${error.code} at ${error.where}: ${error.detail}`).join("; ");
    throw new Error(`open-content artifact refused: ${detail}`);
  }
  const { mapped, audit } = mapOpenContent(dataset, { now, approved });
  return { dataset, mapped, audit, validation };
}
