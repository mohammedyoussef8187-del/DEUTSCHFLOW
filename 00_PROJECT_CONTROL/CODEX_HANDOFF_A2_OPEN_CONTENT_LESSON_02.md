# A2 Open Content Lesson 02 — Claude Handoff

## Artifact and scope

Import `00_PROJECT_CONTROL/A2_OPEN_CONTENT_LESSON_02_IMPORT.json` through the same open-content adapter and canonical intake path as lesson 1.

Lesson: **Reisen planen und von Reisen erzählen**. It adds a new `Reisen und Mobilität` unit to `DeutschFlow Open A2` and contains:

- 1 lesson with 5 sections
- 20 vocabulary items
- 12 contextual sentences
- 1 grammar topic with 2 rules and 7 examples
- 8 deterministic type-answer exercises
- 1 listening interview with 4 ordered segments and 1 remote-only media asset

The A2 classification is explicitly editorial; Deutsch im Blick does not make a CEFR claim for this chapter.

## Rights and exact sources

All source-derived content is CC BY 4.0 from COERLL / The University of Texas at Austin:

- OER licence record: `https://coerll.utexas.edu/coerll/oer/deutsch-im-blick/`
- Textbook licence and edition: `https://coerll.utexas.edu/dib/pdfs/DeutschImBlick-textbook.pdf`
- Kapitel 6 scope: `https://coerll.utexas.edu/dib/toc.php?k=6`
- Kapitel 6 vocabulary: `https://coerll.utexas.edu/dib/voc.php?k=6`
- Jan — Reisen transcript: `https://coerll.utexas.edu/dib/vidt.php?f=06_07_int_ju_reisen`
- Perfekt with separable verbs: `https://coerll.utexas.edu/gg/gr/vcp_07.html`
- Perfekt with inseparable verbs: `https://coerll.utexas.edu/gg/gr/vcp_08.html`
- Licence: `https://creativecommons.org/licenses/by/4.0/`

Preserve the dataset's `attributionBundle`, per-record `attribution`, `licence`, provenance, source relationships, and changes notice. German definitions, Arabic translations, objectives, contextual additions, and exercises are original/adapted DeutschFlow content and remain `EDUCATOR_REVIEW_REQUIRED`.

## Additive identity and deduplication

Lesson 1 baseline: commit `2f18fb2e9efcc65fd860dee683fcd452877d24c4`, artifact SHA-256 `0395aa1a186ecd921867ef872c9dac9ed9d999717e7f43b01cb56109a1371766`.

- Reuse the lesson-1 course, CEFR level, and three course-title rows byte-for-byte: 5 canonical rows total.
- Create the new travel unit and lesson; do not place lesson 2 in the lesson-1 `Alltag und Beziehungen` unit.
- The only high-level `sourceId` shared with lesson 1 is `open-a2:course:deutschflow-open-a2`.
- Lesson-2 vocabulary overlap with lesson 1 is zero.
- On a store already containing lesson 1, expected preview is **353 create / 5 unchanged / 0 update / 0 conflict**.
- On an empty store, expected preview is **358 create**.
- An identical second import must report **358 unchanged**, perform no write, and leave revisions/timestamps unchanged.

## Canonical mapping

Treat each `canonicalTarget` row as authoritative and recompute its deterministic identity before preview.

Map:

1. `structure.course` to the unchanged course/level/text aggregate.
2. `structure.unit` to `courseUnits` plus `curriculumTexts`.
3. `structure.lesson` and `structure.sections` to lessons, sections, and curriculum texts.
4. `vocabulary[*].canonicalTarget` to vocabulary items, meanings, English translations, accepted answers, and lesson items.
5. `sentences[*].canonicalTarget` to sentences, support texts, vocabulary links, grammar links, and lesson items.
6. `grammar.topic` plus `grammar.rules` to `saveGrammarTopic`-compatible aggregates and grammar lesson items.
7. `exercises[*].canonicalTarget` to exercise aggregates and lesson items.
8. `listening.item.canonicalTarget` to the listening aggregate, including its two grammar links and lesson item.
9. Register the audio row once. It is referenced both by `listening.mediaAsset.canonicalTarget.row` and `listening.item.canonicalTarget.audio`; do not put it in both `mapped.audioAssets` and `mapped.listening.audio`.

Expected canonical rows by entity are recorded by the artifact and validate to 358 total. Important counts include 60 accepted answers, 43 lesson items, 27 curriculum texts, 15 grammar texts, 24 sentence texts, 24 exercise texts, 12 listening segment texts, and 2 listening links.

## Existing implementation to reuse

- `01_APPLICATION/CURRENT_APP/src/migration/uuid.js`: `deterministicUuid`
- `01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js`: `TABLE_SPECS`
- `01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js`: `createCanonicalRepositories`, `saveCourse`, `saveVocabulary`, `saveGrammarTopic`, `saveSentence`, `saveExercise`, `saveListening`
- `tools/intake/import.js`: `flattenRows`, `planImport`, `pruneUnchanged`, `applyImport`, `verifyImport`
- Existing intake tests: `tests/unit/intake-pipeline.test.js`, `tests/integration/intake-import.test.js`, `tests/integration/intake-batch.test.js`
- Existing content tests: `tests/unit/grammar-content.test.js`, `tests/unit/listening-content.test.js`

If the lesson-1 open-content adapter has already extended `tools/intake/import.js` for grammar rows, sentence links, and listening links, reuse it unchanged. Otherwise the existing intake stages must add these already-supported canonical entities; do not create a second importer or redesign the schema.

## Validation and safety assertions

- All 53 high-level records have unique deterministic source IDs and UUIDs.
- All 358 canonical rows match `TABLE_SPECS`; all 395 UUID references resolve.
- Every exercise has exactly one non-empty, German, scoreable expected answer matching its declared accepted answer.
- Arabic accepted answers are always `scoreable: 0`.
- No multiple-choice item is present; the four-option coaching rule is therefore not applicable.
- The official media endpoint is currently unreachable. Keep `availability: remote`, empty local/source paths, zero unknown byte/duration values, null checksum, and `offlinePlayable: false`. Do not infer timecodes.
- `EDUCATOR_REVIEW_REQUIRED`: 52 records. `TECHNICAL_REVIEW_REQUIRED`: 1 media record. Nothing is final-verified.
- Preview before apply, one outer repository transaction, service/repository read-back verification, and complete rollback on any failure remain mandatory.
- Import no learner profile, progress, settings, favourite/ignored flag, review card/event, or SRS data. Existing learner/SRS and Nicos/Netzwerk content must remain byte-identical.

Run `npm test` after focused adapter/import tests.

## Remaining review work

- Educator review of the original/adapted German definitions, Arabic translations, objectives, context sentences, grammar explanations, and exercises.
- Pedagogical sign-off for the editorial A2 classification.
- Technical verification of the remote media's reachability, byte size, duration, checksum, and codec details. No app-bundled media is approved by this artifact.
