# Netzwerk neu A2 — Claude Implementation Brief

Scope: implement the smallest evidence-backed Kapitel 2 intake slice. Do not ingest publisher wording, create listening activities, infer audio page/task mappings, touch learner/SRS data, or redesign the canonical schema.

## 1. Open these files

Evidence and input:

1. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json`
2. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_IMPLEMENTATION_INPUT.md`
3. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_OFFICIAL_SOURCE_AUDIT.md`
4. `tools/intake/artifacts/netzwerk-inventory.json`

Existing intake implementation:

1. `tools/intake/run-netzwerk.mjs`
2. `tools/intake/netzwerk-audio.js`
3. `tools/intake/netzwerk-inventory.mjs`
4. `tools/intake/run-intake.mjs`
5. `tools/intake/batch.js`
6. `tools/intake/import.js`
7. `tools/intake/map-canonical.js`
8. `tools/intake/validate.js`
9. `tools/intake/parse-nicos-weg.js`
10. `tools/intake/normalize.js`
11. `tools/intake/extract.mjs`
12. `tools/intake/sources.js`

Canonical write/read path:

1. `01_APPLICATION/CURRENT_APP/src/migration/uuid.js`
2. `01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js`
3. `01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js`
4. `01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js`
5. `01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js`
6. `tests/support/sqlite-node-executor.js`

Tests and fixtures:

1. `tests/unit/intake-pipeline.test.js`
2. `tests/integration/intake-import.test.js`
3. `tests/integration/intake-batch.test.js`
4. `tests/integration/netzwerk-intake.test.js`
5. `tools/intake/artifacts/nicos-weg-a2-e2-l1-manuscript/pages.json`
6. `tools/intake/artifacts/nicos-weg-a2-e2-l1-manuscript/raw.txt`
7. `tools/intake/artifacts/nicos-weg-a2-e2-l1-exercises/pages.json`
8. `tools/intake/artifacts/nicos-weg-a2-e2-l1-exercises/raw.txt`

## 2. Exact existing modules to reuse

| Concern | File | Export / component | Reuse |
|---|---|---|---|
| Single-lesson entry | `tools/intake/run-intake.mjs` | `buildLesson()` | Pattern for pure build before opening SQLite. Do not reuse its Nicos parser. |
| Netzwerk entry | `tools/intake/run-netzwerk.mjs` | `planNetzwerk()`, `registerAudio()` | Extend this separate entry; do not route Netzwerk through Nicos discovery. |
| Discovery | `tools/intake/discover.js` | `discover()`, `describeFile()`, `NICOS_WEG_TEMPLATE` | Nicos-only. No change needed for the manifest-first Kapitel 2 slice. |
| Extraction | `tools/intake/extract.mjs` | `extractSource()`, `writeArtifacts()`, `splitPages()`, `digestOf()` | Reuse later for legitimately local digital-text sources. The first slice reads committed JSON, not publisher PDFs. |
| Normalization | `tools/intake/normalize.js` | `normalizeLine()`, `normalizePage()`, Arabic/bidi helpers | Reuse only when educational text intake is rights-cleared. No text normalization in the first slice. |
| Nicos parser | `tools/intake/parse-nicos-weg.js` | `parseManuscript()`, `parseTranscript()`, `parseVocabulary()`, `parseExercises()` | Layout-specific; do not call for Netzwerk. |
| Validation | `tools/intake/validate.js` | `SEVERITY`, `mergeValidation()` | Reuse result shape. Add Netzwerk-specific checks separately. |
| Warning gate | `tools/intake/batch.js` | `classifyWarning()`, `DECISION`, `checkIdentity()` | Reuse concepts. Do not generalize `previewCandidate()` in the first slice; it imports Nicos functions directly. |
| Preview/diff | `tools/intake/import.js` | `repositoryFor()`, `classifyRow()`, `flattenRows()`, `planImport()` | Reuse. Make only the optional-aggregate change described below. |
| Import | `tools/intake/import.js` | `applyImport()` | Reuse repository-only transactional path; add top-level `audioAssets` and optional `listening`. |
| Verification | `tools/intake/import.js` | `verifyImport()` | Reuse service readback; make listening optional and report source-only audio count. |
| Nicos mapper | `tools/intake/map-canonical.js` | `IMPORTED_STATUS`, `vocabularyKey()`, `glossFingerprint()`, `mapLesson()` | Reuse `IMPORTED_STATUS` only. `mapLesson()` assumes Nicos transcript/vocabulary and must not receive Netzwerk data. |
| Stable IDs | `src/migration/uuid.js` | `deterministicUuid()` | Reuse with the established intake namespaces listed below. |
| Audio mapping | `tools/intake/netzwerk-audio.js` | `buildNetzwerkAudioAssets()`, `audioMappingReport()` | Reuse UUID, checksum, slug, and `source-only` behavior. Enrich `sourceReference` from the manifest; never add page/task. |
| Persistence | `src/platform/sqlite/adapter.js` | `createSqliteAdapter()` | Existing adapter only; no direct SQL from intake. |
| Repositories | `src/data/canonical-repositories.js` | `createCanonicalRepositories()`, `write.content.saveCourse()` | Required write boundary. Audio assets use their repository `upsert`; no learner repository is involved. |
| Services | `src/runtime/composition-root.js` | `createServices()`, `REPOSITORY_ALIASES` | Verify course readback through `services.curriculum`; verify audio through repository/service as available. |
| Test SQLite | `tests/support/sqlite-node-executor.js` | `createNodeSqliteExecutor()` | All implementation tests use `:memory:`. |

The successful Nicos flow is:

`run-intake/buildLesson` or `discover/runBatch` → `extractSource` → `normalizePage` inside the parser → Nicos parser → validators → `mapLesson` → `planImport` → `applyImport` → `verifyImport`.

Provenance is built in private `provenance()` and `textRow()` helpers in `map-canonical.js`; stable identities use `deterministicUuid()`. Writes go through `createCanonicalRepositories()` aggregate methods, then `createSqliteAdapter()`, whose executor transaction supplies rollback.

## 3. Minimal Netzwerk adapter contract

Do not refactor the Nicos batch adapter first. Add a manifest-backed Netzwerk builder parallel to `buildLesson()`:

```js
buildNetzwerkChapter({ manifest, chapter = 2, now }) => {
  evidence,
  validation,
  mapped
}
```

Internally it needs only three pure operations:

```js
selectNetzwerkChapter(manifest, chapter)  // selection only; no extraction or repair
validateNetzwerkChapter(evidence)         // existing validation result shape
mapNetzwerkChapter(evidence, { now })     // canonical rows; no writes
```

Expected mapped shape for this slice:

```js
{
  keys: { courseSlug, courseUuid, unitUuid, lessonUuid },
  course: { course, levels, units, lessons, sections: [], items: [], prerequisites: [], texts },
  audioAssets: [/* 16 source-only assets */],
  vocabulary: [],
  sentences: [],
  exercises: [],
  listening: null,
  stats: { courses: 1, lessons: 1, audioAssets: 16 }
}
```

Stable keys/namespaces:

- course: namespace `deutschflow/intake/course`, key/slug `netzwerk-neu-a2`
- level: namespace `deutschflow/intake/course_level`, key `netzwerk-neu-a2:A2`
- unit: namespace `deutschflow/intake/course_unit`, key `netzwerk-neu-a2:a2-1`, slug `a2-1`
- lesson: namespace `deutschflow/intake/lesson`, key `netzwerk-neu-a2:chapter:2`, slug `nach-der-schulzeit`, ordering `2`
- curriculum title text: namespace `deutschflow/intake/text`, same owner/language/kind identity convention as `textRow()`
- audio: retain `buildNetzwerkAudioAssets()` namespace `deutschflow/intake/audio_asset` and path-based UUIDs

### Field contract

`SOURCE-ONLY` means retain in the manifest/provenance but do not create educational content from it.

| Field | Class | Canonical target / rule |
|---|---|---|
| manifest version | REQUIRED | Validate before mapping. |
| publisher | REQUIRED | `courses.sourcePublisher = "Ernst Klett Sprachen"`. |
| course title | REQUIRED | `courses.sourceTitle`; German `curriculumTexts` course title. |
| CEFR level | REQUIRED | `courses.cefrLevel`, `courseLevels.cefrLevel`, `lessons.cefrLevel`. |
| chapter number | REQUIRED | Lesson ordering and deterministic lesson key. |
| chapter title | REQUIRED | German lesson title text and slug. |
| official source URL/domain | REQUIRED | `sourceReference`; reject non-Klett/Allango hosts. |
| verification status/evidence | REQUIRED | Validation/audit input; canonical `contentStatus` remains `imported`, never `verified`, until human content QA. |
| redistribution status | REQUIRED | Gate content mapping. Restricted/licence-required material cannot produce embedded text/audio. |
| component/access type | REQUIRED | Provenance and source selection. |
| edition | OPTIONAL | Store only where the official source identifies it. Course spans a product family, so do not collapse all editions into one value. |
| ISBN | OPTIONAL | Store only on the exact edition/component it identifies. `courses.sourceIsbn` is `null` for the product-family course row. |
| page | MUST-NOT-GUESS | Only A2.1 K2 ranges KB 16–25 and ÜB 90–101 are source-proven; keep edition/component attached. |
| exercise/task | MUST-NOT-GUESS | Use only explicit source refs (KB 7d; online 2/3c/4a/7d; KB 6a; templates A2/A7d). |
| audio disc/track | REQUIRED for audio | Asset source reference; KB 1.8–1.17, ÜB 1.11–1.16. |
| audio filename/path/SHA-256/byte size | SOURCE-ONLY | `audioAssets.sourcePath`, checksum, byteSize; availability remains `source-only`, `localPath = ""`. |
| audio duration | MUST-NOT-GUESS | Keep `durationMs = 0`. |
| audio page/exercise | MUST-NOT-GUESS | Must remain `null` for all 16 records. |
| publisher audio payload | SOURCE-ONLY | Never copy/bundle/serve; asset remains unplayable. |
| transcript/solution/exercise/glossary wording | SOURCE-ONLY | No `sentences`, `listeningTexts`, `exercises`, vocabulary, meanings, translations, or accepted answers in this slice. |
| vocabulary headword/sense | MUST-NOT-GUESS | Skip until rights-cleared, typography-aware extraction is record-validated. |
| English/Arabic text | MUST-NOT-GUESS | Skip; do not fabricate translations. |
| grammar rule/explanation | MUST-NOT-GUESS | Explicit topic references are metadata only; no grammar entities yet. |
| listening activity/segment/speaker/timecode | MUST-NOT-GUESS | No listening entity or lesson item until a task/activity relationship is proven and content rights allow it. |
| provenance lifecycle | REQUIRED | `contentStatus: imported`, version 1, exact URL/evidence, null verifier, normal timestamps/revision/deleted fields. |

### Canonical entity eligibility

| Entity group | First slice | Reason |
|---|---|---|
| course, course level, A2.1 unit, Kapitel 2 lesson, German title texts | CREATE | Official identity/title/level evidence is complete and non-expressive metadata is approved as safe input. |
| audio assets (16) | CREATE/UPDATE source-only | File identity and component/chapter track range are proven; payload redistribution and page/task are not. |
| vocabulary, meanings, translations, accepted answers | SKIP | Educational wording/extraction rights and record QA unresolved. |
| sentences and support texts | SKIP | Transcript wording is not cleared for app embedding. |
| grammar topics/rules/examples | SKIP | References exist, but no rights-cleared structured rule dataset exists. |
| exercises/options/answers/targets | SKIP | Do not copy publisher tasks or infer answer keys. |
| listening items/texts/speakers/segments/links | SKIP | Exact activity/task mapping is unproven; source-only audio is not a learning activity. |
| lesson sections/items | SKIP | Empty invented sections add no learner value; create when eligible content exists. |

## 4. Exact first implementation slice

Use these manifest records:

- `k2-allango-a2-1-product` and `combined-a2-1` edition identity for A2.1 product identity
- `k2-a2-1-plan` for CEFR/chapter pagination metadata
- `k2-teacher-board` for the exact chapter title and KB 7d reference
- `k2-kb-audio-transcript` for KB tracks 1.8–1.17
- `k2-ueb-audio-transcript` for ÜB tracks 1.11–1.16
- all 16 `audioContentUnits` for filename/path/hash/size identity

Expected empty-store output: **22 rows** — 1 course, 1 course level, 1 A2.1 unit, 1 lesson, 2 German curriculum title rows, and 16 source-only audio assets. Expected educational entities: **0** vocabulary, meanings, translations, accepted answers, sentences, grammar records, exercises, listening activities, sections, and lesson items.

`sourceReference` may contain exact URLs, chapter/component, disc/track, and the statement `page/exercise unresolved`. It must not contain copied transcript text.

## 5. Files likely to create or modify

Create:

- `tools/intake/map-netzwerk.js` — manifest selection, validation, and pure mapping (or split validation only if the file becomes unwieldy)
- `tests/unit/netzwerk-adapter.test.js`

Modify:

- `tools/intake/run-netzwerk.mjs` — add manifest-backed preview/apply after existing inventory gate
- `tools/intake/import.js` — allow `listening: null`; flatten/apply top-level `audioAssets`; verify optional listening and source-only assets
- `tests/integration/netzwerk-intake.test.js` — retain all refusal/audio tests and add end-to-end manifest slice tests

Do not modify schema, repositories, application runtime, Nicos parser/fixtures, learner data, SRS, or the manifest during implementation.

## 6. Required tests

Reuse the patterns already protected by:

- `intake-pipeline.test.js`: deterministic IDs, provenance, `imported` rather than `verified`, and no invented fields
- `intake-import.test.js`: preview writes nothing, empty-store create plan, idempotency, verified-content conflict, aggregate rollback, service readback, SRS untouched
- `intake-batch.test.js`: incomplete/ambiguous source refusal and Nicos preservation
- `netzwerk-intake.test.js`: exact SHA identity, `source-only`, unplayable audio, idempotent registration, Nicos/SRS untouched

Add assertions for:

1. manifest parses and reports 3 edition identities, 23 official source records, and 16 audio units
2. every source domain is exactly `www.klett-sprachen.de`, `einstufungstests.klett-sprachen.de`, or `www.allango.net`
3. Kapitel 2 title and A2.1 page ranges are exact
4. all 16 audio records match `netzwerk-inventory.json` path, byte size, and SHA-256
5. KB tracks are exactly 1.8–1.17 and ÜB tracks exactly 1.11–1.16
6. every audio page/exercise is `null`; validation rejects a non-null value without explicit evidence
7. mapping is deterministic across different `now` values
8. mapping emits exactly the 22 rows above and no educational/listening/lesson-item rows
9. preview on an empty `:memory:` store plans 22 creates and writes nothing
10. apply/readback returns the course, A2.1 unit, and Kapitel 2 lesson; all 16 assets remain source-only and unplayable
11. second apply is a no-op; pre-registered audio UUIDs are reused/updated, never duplicated
12. an existing verified row produces a conflict rather than overwrite
13. existing Nicos rows remain byte-identical
14. review cards/events counts and a supplied legacy card object remain unchanged
15. full regression suite remains green

## 7. Known blockers only

- Exact page/exercise mapping is unproven for all 16 Kapitel 2 tracks. Do not create listening activities or lesson links.
- Klett text/audio redistribution is not licensed by the audited standard notices. Do not embed publisher wording or audio payloads.
- Glossary/Kapitelwortschatz typography needs layout reconstruction and record-level QA after rights clearance.
- Exact Allango page associations require legitimate licensed access; do not bypass it.

None blocks the 22-row metadata/source-asset slice.
