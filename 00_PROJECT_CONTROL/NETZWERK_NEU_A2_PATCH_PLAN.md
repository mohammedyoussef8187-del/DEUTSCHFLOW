# Netzwerk neu A2 — Exact Kapitel 2 Patch Plan

Scope: implement the committed 22-row rights-safe Kapitel 2 slice only. Do not import publisher exercise/transcript/vocabulary/grammar/translation/audio payloads, create listening activities or lesson items, touch learner/SRS data, change schema, or infer audio page/exercise links.

## 1. File-level patch map

### Create

| File | Exports to add | Exact responsibility |
|---|---|---|
| `tools/intake/map-netzwerk.js` | `selectNetzwerkChapter()`, `validateNetzwerkChapter()`, `mapNetzwerkChapter()`, `buildNetzwerkChapter()` | Pure artifact selection, validation, deterministic mapping, and build orchestration. No file I/O, database access, or publisher-text extraction. |
| `tests/unit/netzwerk-adapter.test.js` | none | Artifact-contract, validation, deterministic-ID, canonical-shape, provenance, and no-guess tests. |

### Modify

| File | Existing/new symbols involved | Exact patch |
|---|---|---|
| `tools/intake/run-netzwerk.mjs` | keep `planNetzwerk()`, `registerAudio()`; add/export `runNetzwerkChapter()`; extend private `main()` | Read the four committed JSON inputs, call `buildNetzwerkChapter()`, open the existing isolated store, call `planImport()` before writes, refuse validation errors/conflicts, skip apply on `plan.isNoop`, apply and verify inside one outer repository transaction, and retain the existing document gate/full-inventory audio registration behavior. |
| `tools/intake/import.js` | `MEANINGFUL`, `flattenRows()`, `planImport()`, `applyImport()`, `verifyImport()` | Add source/audio fields to diff comparison; flatten top-level `mapped.audioAssets`; guard `mapped.listening`; write source-only assets with `repositories.audioAssets.upsert()`; make the whole batch atomic through `repositories.lifecycle.transaction()`; do not call `saveListening()` when listening is null; do not perform the second `saveCourse()` when there are no lesson items; make verification tolerate no listening and verify top-level audio through an optional repository argument. |
| `tests/integration/netzwerk-intake.test.js` | existing `freshStore()` and Netzwerk inventory/audio tests; new adapter/orchestrator tests | Add empty-store preview/apply/verify, true no-op second run, no duplicates, source-only readback, Nicos/SRS preservation, and whole-batch rollback tests. Keep all existing refusal and 189-file registration tests. |
| `tests/integration/intake-import.test.js` | existing `rolls an aggregate back whole when part of it fails` test | Strengthen the existing rollback test to assert earlier course rows also roll back, protecting the new whole-batch transaction without adding a duplicate generic test. |

Do not modify `tools/intake/netzwerk-audio.js`, schema, repositories, services, Nicos parsers/fixtures, application runtime, learner data, or SRS. `buildNetzwerkAudioAssets()` and `registerAudio()` remain the unchanged legacy full-inventory registration path; the Kapitel 2 path consumes the rights-reviewed safe-slice rows and verifies their audio UUIDs against the same path namespace.

## 2. Existing symbols to reuse unchanged

| Path | Symbol | Use |
|---|---|---|
| `01_APPLICATION/CURRENT_APP/src/migration/uuid.js` | `deterministicUuid(namespace, name)` | Recompute and validate structural and path-based audio UUIDs. |
| `tools/intake/validate.js` | `SEVERITY`, `mergeValidation(...results)` | Emit the established `{ issues, ok, errors, warnings, summary }` validation shape. |
| `tools/intake/import.js` | `repositoryFor()`, `CHANGE`, `meaningfulFields()`, `classifyRow()`, `planImport()` | Repository lookup and read-only preview/diff. `flattenRows()`, `applyImport()`, and `verifyImport()` receive only the narrow changes above. |
| `tools/intake/map-canonical.js` | `IMPORTED_STATUS` | Canonical lifecycle value `imported`; do not call Nicos-specific `mapLesson()`. |
| `tools/intake/netzwerk-audio.js` | `buildNetzwerkAudioAssets()`, `audioMappingReport()` | Preserve the existing 189-file inventory/registration route unchanged. Not the Kapitel 2 safe-slice mapper. |
| `tools/intake/run-netzwerk.mjs` | `planNetzwerk()`, `registerAudio()` | Preserve current document refusal and full audio-registration behavior. |
| `01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js` | `createSqliteAdapter()` | Existing persistence adapter and nested transaction behavior. |
| `01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js` | `createCanonicalRepositories()`, `repositories.write.content.saveCourse()`, `repositories.audioAssets.upsert()`, `repositories.lifecycle.transaction()` | Only canonical write boundary. |
| `01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js` | `createServices()`, `REPOSITORY_ALIASES` | Service readback and entity-to-repository aliasing. |
| `01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js` | `TABLE_SPECS` | Test-only assertion that every mapped canonical key is an existing field. |
| `01_APPLICATION/CURRENT_APP/src/services/listening-service.js` | `isPlayableOffline()` | Assert all source-only assets remain unplayable; do not create a listening activity. |
| `tests/support/sqlite-node-executor.js` | `createNodeSqliteExecutor(":memory:")` | Isolated integration stores only. |
| `01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js` | `migrateToCanonical()` | Test setup only: turn the `clean` snapshot in `tests/fixtures/migration_snapshot.json` into actual canonical learner/SRS rows before the preservation assertion. |

## 3. Exact call flow

```text
run-netzwerk.mjs/private main()
  -> read JSON only:
       NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json
       NETZWERK_NEU_A2_STRUCTURE_INDEX.json
       NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json
       NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json
  -> buildNetzwerkChapter(input)
       -> selectNetzwerkChapter(input, 2)
       -> validateNetzwerkChapter(evidence)
       -> mergeValidation(...)
       -> mapNetzwerkChapter(evidence, { now })
            -> deterministicUuid() for every UUID
            -> canonical lifecycle/provenance fields
  -> createSqliteAdapter(executor).initializeSchema()
  -> createCanonicalRepositories(adapter)
  -> runNetzwerkChapter(repositories, built, { apply, now })
       -> planImport(repositories, mapped)              [read-only preview/diff]
       -> reject validation errors or plan.conflicts
       -> return immediately for preview or plan.isNoop
       -> repositories.lifecycle.transaction(...)
            -> applyImport(repositories, mapped, { now })
                 -> repositories.write.content.saveCourse(...)
                 -> repositories.audioAssets.upsert(...) x 16
            -> createServices(repositories)
            -> verifyImport(services, mapped, "local", { repositories })
            -> throw unless verification.ok
       -> executor transaction COMMIT; any throw -> ROLLBACK
  -> existing registerAudio(repositories, fullInventoryAssets) only after a successful
       Kapitel 2 apply/verify; the 16 Kapitel 2 UUIDs are reused and the remaining
       source-only inventory assets retain the pre-existing registration behavior
```

Transaction ownership is exact: `repositories.lifecycle.transaction()` calls `adapter.transaction()`. The outermost adapter call invokes `executor.transaction()` (`BEGIN`/`COMMIT`; `ROLLBACK` on throw). Nested transactions opened by `saveCourse()` or `applyImport()` run inline because `adapter.js` tracks transaction depth. Verification therefore completes before commit for the Kapitel 2 orchestration path.

`main()` must compute the Kapitel 2 preview before any `registerAudio()` call. On `--apply`, commit the verified Kapitel 2 batch first, then run the existing full-inventory registration; otherwise pre-registering the 16 selected assets would turn the required empty-store 22-create plan into 6 creates plus 16 updates. Because `registerAudio()` checks UUID existence, it cannot overwrite the measured/provenanced Kapitel 2 rows.

## 4. Adapter input and validation contracts

### `buildNetzwerkChapter()`

```js
buildNetzwerkChapter({
  manifest,          // committed Kapitel 2 manifest object
  structureIndex,    // committed official structure index object
  audioAssetIndex,   // committed 189-asset technical index object
  safeSlice,         // committed 22-row fixture object
  chapter: 2,
  now
}) => { evidence, validation, mapped }
```

`selectNetzwerkChapter()` must select only chapter 2, the manifest records named by each safe row, the structure records named by `structureEvidenceSourceIds`, the edition records named by `sourceEditionIds`, and the 16 audio assets named by `sourceAssetId`. It must not read PDFs/MP3 payloads or normalize educational text.

### Manifest source metadata (input only; no canonical source table exists)

Each selected `manifest.sources[]` record has the existing fields:

```js
{
  id, sourceUrl, officialDomain, access, sourceComponentType,
  edition, isbn, chapter, page, exercise, language, contentType,
  verificationStatus, provenanceEvidence, redistributionStatus,
  localSourceRelation, intakeStatus
}
```

Required for selection/validation: `id`, `sourceUrl`, `officialDomain`, `sourceComponentType`, `chapter`, `verificationStatus`, `redistributionStatus`, and `intakeStatus`. `edition`, `isbn`, `page`, `exercise`, and `localSourceRelation` are nullable. Rich source metadata remains in `evidence`/validation reporting; the canonical schema stores only the applicable source fields listed below.

### Technical source asset metadata (input only)

Each `audioAssetIndex.assets[]` input row has this exact committed shape:

```js
{
  sourceAssetId, canonicalAudioAssetUuid, relativePath, filename,
  sha256, fileSizeBytes, readable,
  codec, codecDescription, mpegVersion, layer, bitrateMode,
  bitrateBps, bitrateKbps, sampleRateHz, channels, channelMode,
  durationMs, durationSeconds, frameCount, firstFrameOffset,
  scannedFrameBytes, resyncBytes,
  discIdentifier, trackIdentifier, disc, track, component,
  bookIdentityEvidence, chapter,
  page: null,
  exercise: null,
  verificationStatus,
  availability: "source-only",
  provenance: { localIdentity, officialChapterEvidence, evidenceScope }
}
```

All fields are required for index validation except the two explicitly nullable mapping fields. Canonical mapping consumes only the schema fields shown in section 5; codec/frame-scan facts remain source evidence because `audio_assets` has no codec-detail/frame columns.

### Safe-row provenance (input only)

Every safe row must retain `sourceRecordIds[]`, `structureEvidenceSourceIds[]`, `sourceEditionIds[]`, `rightsClassification`, and `verificationStatus`. Structural rows carry `provenance.officialUrls[]` plus `structureIndex` or `structureIndexRecordId`; audio rows carry:

```js
{
  officialUrl,
  evidence,
  localIdentity,
  evidenceScope
}
```

These fields are validated and reported but are not passed to the strict SQLite adapter as undeclared columns.

### Validation result

Use the existing validation shape:

```js
{
  issues: [{ severity, code, detail, where }],
  ok,
  errors: [...],
  warnings: [...],
  summary: {
    chapter: 2,
    safeRows: 22,
    sourceAssets: 16,
    indexedAssets: 189,
    exactAudioPageExerciseMappings: 0
  }
}
```

Errors must include: unsupported manifest/index version; missing/duplicate reference or ID; non-official host; count mismatch; UUID mismatch; SHA/size/path mismatch; chapter/component/disc/track mismatch; a non-null audio page/exercise; any listening/lesson-item link; any excluded educational target type; or a rights classification that permits payload embedding. No validator may repair a value.

## 5. Exact canonical payloads

All field names below come from `TABLE_SPECS`. Timestamps are supplied from `now`; no timestamp participates in identity.

### Course aggregate

```js
mapped.course = {
  course: {
    uuid, slug, cefrLevel, ordering,
    sourceTitle, sourcePublisher,
    sourceEdition: null, sourceIsbn: null,
    contentStatus: "imported", contentVersion: 1,
    sourceReference, sourceType,
    verifiedAt: null, verifiedBy: null,
    createdAt, updatedAt, revision: 1, deleted: 0
  },
  levels: [{
    uuid, courseUuid, cefrLevel, ordering,
    createdAt, updatedAt, revision: 1, deleted: 0
  }],
  units: [{
    uuid, courseUuid, courseLevelUuid, slug, ordering,
    contentStatus: "imported", contentVersion: 1,
    sourceReference, sourceType,
    verifiedAt: null, verifiedBy: null,
    createdAt, updatedAt, revision: 1, deleted: 0
  }],
  lessons: [{
    uuid, unitUuid, slug, cefrLevel, ordering,
    contentStatus: "imported", contentVersion: 1,
    sourceReference, sourceType,
    verifiedAt: null, verifiedBy: null,
    createdAt, updatedAt, revision: 1, deleted: 0
  }],
  sections: [], items: [], prerequisites: [],
  texts: [courseTitleText, lessonTitleText]
}
```

Each title text is exactly:

```js
{
  uuid, ownerType, ownerUuid, language: "de", kind: "title", text,
  contentStatus: "imported", contentVersion: 1,
  sourceReference, sourceType,
  verifiedAt: null, verifiedBy: null,
  createdAt, updatedAt, revision: 1, deleted: 0
}
```

Only the two already-approved title metadata strings from the safe slice are allowed. No unit/description/support-language text is created.

### Canonical source-only audio asset

```js
{
  uuid, slug,
  availability: "source-only",
  localPath: "",
  sourcePath,
  remoteUrl: null,
  mimeType: "audio/mpeg",
  byteSize,
  durationMs,
  checksum: `sha256:${sha256}`,
  contentStatus: "imported", contentVersion: 1,
  sourceReference, sourceType: "audio",
  verifiedAt: null, verifiedBy: null,
  createdAt, updatedAt, revision: 1, deleted: 0
}
```

`page`, `exercise`, `listeningItemUuid`, and `lessonItemUuid` are not `audio_assets` schema fields. They must remain absent from canonical rows and null in evidence. `remoteUrl`, `verifiedAt`, and `verifiedBy` are real nullable schema fields and must be written as null.

### Provenance mapping

The safe row's rich `provenance`, `sourceRecordIds`, `structureEvidenceSourceIds`, `sourceEditionIds`, rights classification, and verification status stay in adapter evidence/validation. Canonical rows receive only:

```js
{
  contentStatus: "imported",
  contentVersion: 1,
  sourceReference,       // exact official URL/evidence scope; no publisher body text
  sourceType,
  verifiedAt: null,
  verifiedBy: null,
  createdAt: now,
  updatedAt: now,
  revision: 1,
  deleted: 0
}
```

There is no JSON provenance column and no source-metadata entity; do not add either.

### Mapped import batch

```js
{
  keys: { courseSlug, courseUuid, levelUuid, unitUuid, lessonUuid },
  course: { course, levels, units, lessons, sections: [], items: [], prerequisites: [], texts },
  audioAssets: [/* 16 canonical source-only rows */],
  vocabulary: [],
  sentences: [],
  exercises: [],
  listening: null,
  stats: {
    courses: 1, courseLevels: 1, courseUnits: 1,
    lessons: 1, curriculumTexts: 2, audioAssets: 16,
    totalRows: 22
  }
}
```

`flattenRows(mapped)` must emit exactly: `courses` 1, `courseLevels` 1, `courseUnits` 1, `lessons` 1, `curriculumTexts` 2, `audioAssets` 16; total 22. It emits no vocabulary, sentence, exercise, listening, section, item, progress, learner, card, or event row.

### Preview result

Existing `planImport()` shape remains:

```js
{
  entries: [{ entity, uuid, change, reason?, before?, after? }],
  create: [], update: [], unchanged: [], conflicts: [],
  total,
  isNoop
}
```

On an empty store: `total = 22`, `create.length = 22`, all other arrays empty, `isNoop = false`, and all table counts remain zero. After a successful first import: `unchanged.length = 22`, create/update/conflicts empty, `isNoop = true`; `runNetzwerkChapter()` must skip writes so rows remain byte-identical.

Extend `MEANINGFUL` with the schema fields needed to detect Netzwerk changes: `courseUuid`, `courseLevelUuid`, `unitUuid`, `ownerType`, `ownerUuid`, `sourceEdition`, `sourceIsbn`, `sourceType`, `contentVersion`, `availability`, `localPath`, `sourcePath`, `remoteUrl`, `mimeType`, `byteSize`, `durationMs`, and `checksum`. Continue ignoring UUID/timestamps/revision and verifier fields; an unchanged human-verified row must still classify unchanged.

### Apply result

```js
{
  courses: 1,
  audioAssets: 16,
  vocabulary: 0,
  vocabularyReused: 0,
  sentences: 0,
  listening: 0,
  exercises: 0
}
```

No call may reach `repositories.srs`, `cards`, `events`, learner progress, or legacy IndexedDB.

### Verification result

Keep existing Nicos fields and add source-asset verification plus `ok`:

```js
{
  ok,
  course: { slug, cefrLevel, title } | null,
  lessons,
  lesson: { slug, sections, items } | null,
  listening: null,
  audioAssets: {
    expected: 16,
    found: 16,
    sourceOnly: 16,
    playable: 0,
    missingUuids: [],
    mismatchedUuids: []
  },
  exercises: { total: 0, gradeable: 0, ungradeable: 0 },
  vocabulary: 0,
  progress: { lessonsTotal: 1, resume: "first-available" } | null,
  englishMissing: true
}
```

Extend the signature compatibly:

```js
verifyImport(services, mapped, profileUuid = "local", options = {})
```

For `mapped.audioAssets.length > 0`, require `options.repositories`, read each asset by UUID, and compare the canonical audio fields above. Existing three-argument Nicos callers remain valid. `ok` requires the mapped course and lesson, all expected audio rows with exact source-only metadata, and all expected vocabulary/exercise rows; listening is required only when `mapped.listening` is non-null.

## 6. Kapitel 2 execution contract

Input is `00_PROJECT_CONTROL/NETZWERK_NEU_A2_KAPITEL_02_SAFE_SLICE.json`, cross-validated against the manifest, structure index, and full audio index. There is no extraction or text normalizer stage for this metadata-only slice.

```text
four JSON artifacts
  -> select/validate (189-index integrity; select 16 K2 assets)
  -> map (22 canonical rows; deterministic IDs; timestamps only vary with now)
  -> planImport (read-only; 22 creates on empty store)
  -> applyImport (one transaction; 22 rows)
  -> verifyImport (service course/lesson + repository audio readback)
  -> commit only when verification.ok
```

## 7. Exact test matrix

| Suggested file / test name | Fixture/input | Required assertion | Failure condition |
|---|---|---|---|
| `tests/unit/netzwerk-adapter.test.js` — `accepts the committed safe slice and all 189 indexed assets` | Four committed JSON artifacts | Validation `ok`; index 189; safe rows 22; selected K2 audio 16; unique IDs/SHA; official hosts only; zero educational/listening entities. | Parse/version/count/reference/host/identity mismatch or any content entity emitted. |
| `tests/unit/netzwerk-adapter.test.js` — `maps exactly 22 schema-valid canonical rows` | `buildNetzwerkChapter(..., now: NOW)` | `flattenRows()` entity counts are 1/1/1/1/2/16; every output key belongs to the matching `TABLE_SPECS`; actual rows contain no page/exercise/link pseudo-fields. | Unknown schema field, missing required field, wrong count, or excluded entity. |
| `tests/unit/netzwerk-adapter.test.js` — `recomputes stable IDs and preserves provenance` | Same artifacts at `NOW` and `NOW + 9_000_000` | UUID lists identical and equal fixture UUIDs; only timestamps differ; source references/types/status/version/null verifier fields survive. | UUID depends on time, fixture identity mismatch, or provenance disappears/changes. |
| `tests/unit/netzwerk-adapter.test.js` — `rejects every guessed audio relationship` | Deep clones with one audio `page`, `exercise`, listening link, or lesson-item link set | Each mutation yields `ok: false` and a named error; unmodified input stays valid. | Mutation validates, is repaired, or reaches mapped canonical rows. |
| `tests/unit/netzwerk-adapter.test.js` — `accepts the 189-asset index without ingesting content` | Full audio index | All 189 records validate technically and remain source-only; build selects only 16 K2 assets and creates no educational/listening row. | Any payload is read/copied, asset becomes playable, or non-K2 asset becomes lesson content. |
| `tests/integration/netzwerk-intake.test.js` — `previews before apply and verifies the 22-row slice` | `:memory:` store + four artifacts | Preview leaves all counts zero and plans 22 creates; apply returns 1 course/16 audio; verification `ok`; readback counts exactly 1/1/1/1/2/16 and zero listening/items/content. | Any pre-preview write, count mismatch, unplayable rule violation, or verification before apply/passing falsely. |
| `tests/integration/netzwerk-intake.test.js` — `is a byte-identical no-op on the second run` | Store after first run | Second plan has 22 unchanged, no create/update/conflict, `isNoop`; orchestrator skips apply; canonical 22-row snapshot and counts unchanged; UUIDs remain unique. | Revision/timestamp/content changes or duplicate rows. |
| `tests/integration/netzwerk-intake.test.js` — `preserves existing Nicos and learner SRS rows` | Existing Nicos course setup plus `migrateToCanonical(MIGRATION_FIXTURE.clean).dataset` from `tests/fixtures/migration_snapshot.json`, loaded into the same isolated store | Nicos rows and actual stored card/event objects are field-identical before/after; counts unchanged. | Any application import call reaches or alters learner/SRS rows. |
| `tests/integration/netzwerk-intake.test.js` — `rolls back the entire Kapitel 2 batch on a late audio failure` | Valid mapped batch with a deliberately invalid later audio `sourcePath: null` passed directly to import | Promise rejects; course, level, unit, lesson, texts, and all audio counts remain as before. | Any earlier row survives. |
| `tests/integration/intake-import.test.js` — rename/strengthen existing rollback test to `rolls the whole import batch back when a later aggregate fails` | Existing broken Nicos mapped sample | Existing listening assertions plus `courses.count() === 0`. | Course aggregate commits before later failure. |
| existing `tests/unit/intake-pipeline.test.js` and `tests/integration/intake-batch.test.js` | Existing Nicos fixtures | Run unchanged; all mapping, provenance, preview, idempotency, and Nicos preservation tests remain green. | Any existing assertion regresses. |

The verification-after-import assertion is part of the first integration test: stub/spying is unnecessary because `runNetzwerkChapter()` returns a non-null verification only on the apply path, and a forced verification mismatch must reject and roll back.

## 8. Shortest safe implementation order

1. Create `tools/intake/map-netzwerk.js`: add the four pure exports, cross-artifact validation, deterministic IDs, and exact mapped shape.
2. Create `tests/unit/netzwerk-adapter.test.js`: protect artifact acceptance, schema-valid 22-row mapping, stable IDs/provenance, and rejection of guessed relationships.
3. Modify `tools/intake/import.js`: meaningful audio/source diff fields, top-level audio flattening, nullable listening, outer batch transaction, audio upserts, conditional final course-item save, and optional repository-backed audio verification.
4. Strengthen the existing rollback assertion in `tests/integration/intake-import.test.js`.
5. Modify `tools/intake/run-netzwerk.mjs`: load artifacts, export `runNetzwerkChapter()`, enforce preview/conflict/no-op/apply/verify ordering, and keep current inventory behavior intact.
6. Extend `tests/integration/netzwerk-intake.test.js` with the four Kapitel 2 integration tests above.
7. Run targeted tests:

   ```powershell
   npm test -- tests/unit/netzwerk-adapter.test.js tests/unit/intake-pipeline.test.js tests/integration/netzwerk-intake.test.js tests/integration/intake-import.test.js tests/integration/intake-batch.test.js
   ```

8. Run the full repository suite:

   ```powershell
   npm test
   ```

The repository currently exposes only the `test` package script; no unimplemented CLI flag is prescribed here. Preserve `run-netzwerk.mjs` default non-writing behavior when wiring the Kapitel 2 preview. No application runtime or learner database switch is part of this patch.

## 9. Non-blocking unresolved fields

- Audio page/exercise: null for all 189 index assets and all 16 Kapitel 2 assets.
- Audio-to-listening and audio-to-lesson-item links: absent.
- Publisher educational wording/audio redistribution: not licensed by the accepted audit.
- Course-family `sourceEdition`/`sourceIsbn`: null; edition/ISBN remain evidence-scoped.

None blocks this 22-row metadata/source-asset implementation.
