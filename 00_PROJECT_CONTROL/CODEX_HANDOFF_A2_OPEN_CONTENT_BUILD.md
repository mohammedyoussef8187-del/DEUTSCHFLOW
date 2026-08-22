# A2 Open Content — Claude Implementation Handoff

## Import artifact

Use `00_PROJECT_CONTROL/A2_OPEN_CONTENT_FIRST_IMPORT.json` directly. It is an intermediate, content-only payload for canonical schema version 10.

Expected authored records:

- 1 course, 1 unit, 1 lesson, 5 lesson sections
- 19 vocabulary items, each with German/English/Arabic support and accepted-answer metadata
- 12 sentences
- 1 grammar topic and 2 grammar rules
- 8 deterministic exercises
- 1 listening item, 10 transcript segments, and 1 remote-only media asset

Do not create learner profiles, review cards/events, progress, settings, favourites, ignored flags, or any SRS row.

## Rights and attribution gate

All adapted source material is from official COERLL/University of Texas pages under CC BY 4.0:

- Deutsch im Blick catalogue and licence: `https://coerll.utexas.edu/coerll/oer/deutsch-im-blick/`
- Deutsch im Blick, Second Edition (2017), ISBN 978-1-937963-01-9: `https://coerll.utexas.edu/dib/pdfs/DeutschImBlick-textbook.pdf`
- Chapter 5 structure: `https://coerll.utexas.edu/dib/toc.php?k=5`
- Chapter 5 vocabulary: `https://coerll.utexas.edu/dib/voc.php?k=5`
- Family interview: `https://coerll.utexas.edu/dib/vidt.php?f=05_07_int_scl_familie`
- Birthday interview/transcript: `https://coerll.utexas.edu/dib/vidt.php?f=05_26_int_ek_geburtstag`
- Grimm Grammar Perfekt: `https://coerll.utexas.edu/gg/gr/vcp_01.html`
- Licence terms: `https://creativecommons.org/licenses/by/4.0/`

Preserve `licence`, `attributionRequirement`, `provenance`, and `attributionBundle` in the import audit. The schema has no licence column, so retain the dataset's CC BY marker in each canonical `sourceReference`; do not silently discard the audit metadata. Display the supplied attribution and changes notice wherever product attribution is presented.

The A2 label is a visible DeutschFlow editorial assignment, not a CEFR claim made by COERLL. Keep `cefrAssignment.status = EDITORIAL_A2_ASSIGNMENT` and `noSourceLevelClaim = true` in the audit. No Klett content is present or permitted in this import.

## Existing code to open and reuse

- `01_APPLICATION/CURRENT_APP/src/migration/uuid.js`: reuse `deterministicUuid`; recompute and reject any mismatched UUID.
- `01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js`: canonical schema and `ENTITY_MAPPINGS`; do not redesign it.
- `01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js`: reuse `createCanonicalRepositories` and the aggregate writers `saveCourse`, `saveVocabulary`, `saveGrammarTopic`, `saveSentence`, `saveExercise`, and `saveListening`.
- `tools/intake/import.js`: reuse `repositoryFor`, `flattenRows`, `planImport`, `pruneUnchanged`, `applyImport`, and `verifyImport`.
- `tools/intake/map-canonical.js`: follow the aggregate shape returned by `mapLesson`; reuse `IMPORTED_STATUS`, `vocabularyKey`, and `glossFingerprint` where applicable.
- `tests/unit/intake-pipeline.test.js`, `tests/integration/intake-import.test.js`, and `tests/integration/intake-batch.test.js`: reuse deterministic mapping, preview/apply, rollback, idempotency, and learner/SRS-preservation patterns.
- `tests/unit/grammar-content.test.js` and `tests/unit/listening-content.test.js`: reuse canonical grammar/listening assembly assertions.

## Required adapter mapping

Treat every `canonicalTarget` row as authoritative. High-level record UUIDs use the dataset's `deutschflow/open-content/{contentType}` namespace; canonical target UUIDs use their target entity namespaces and may therefore differ.

Build one mapped batch with these exact transfers:

1. `structure.course.canonicalTarget.row` to `mapped.course.course`; its `.level` to `mapped.course.levels`.
2. `structure.unit.canonicalTarget.row` to `mapped.course.units`.
3. `structure.lesson.canonicalTarget.row` to `mapped.course.lessons`.
4. `structure.sections[*].canonicalTarget.row` to `mapped.course.sections`.
5. All structure `canonicalTarget.texts` to `mapped.course.texts`.
6. Every vocabulary `canonicalTarget` to `mapped.vocabulary`; collect its `lessonItem` in `mapped.course.items`.
7. Every sentence `canonicalTarget` to `mapped.sentences`, including `vocabulary` and `grammar` link arrays; collect its `lessonItem`.
8. Grammar topic/rules to a `mapped.grammar` collection suitable for `saveGrammarTopic`; collect rule examples, texts, and lesson items without changing their rows.
9. Exercises to `mapped.exercises`; collect lesson items.
10. `listening.item.canonicalTarget` to `mapped.listening`, including links and lesson item.
11. Register the media row exactly once. The same row is referenced by `listening.mediaAsset.canonicalTarget.row` and `listening.item.canonicalTarget.audio`; use the listening aggregate's `audio` and do not also add it to `mapped.audioAssets`.

The current `tools/intake/import.js` does not flatten, prune, write, or verify grammar topics/rules/examples/texts, sentence-vocabulary links, sentence-grammar links, or listening links. Extend those existing stages for these existing schema entities and aggregate writers. Do not bypass repositories and do not add tables.

## Safe execution sequence

1. Parse and validate the artifact, licence/source references, counts, UUIDs, and foreign keys.
2. Produce the mapped batch without writes.
3. Run `planImport`; reject conflicts and expose the complete preview before apply.
4. Run `applyImport` only through the existing outer `repositories.lifecycle.transaction`.
5. Read back through services/repositories with `verifyImport` extended for grammar/link rows.
6. Re-run the identical import and require `planImport().isNoop === true`, zero writes, unchanged revisions/timestamps, and byte-identical learner/SRS rows.

## Tests required

Add a focused open-content intake fixture/test file and reuse the existing helpers. Assert:

- JSON schema/version, all official source references, CC BY evidence, and exact authored counts above.
- Unique `sourceId` values and deterministic record/canonical UUIDs.
- One preview covers every canonical row and performs no write.
- One transactional apply persists course structure, multilingual vocabulary/sentences, grammar, exercises, listening transcript/links, and the single remote-only asset.
- The media asset is not duplicated, has no bundled/local binary, and is not treated as offline-playable.
- Every exercise's unique expected answer is present in its accepted-answer/options data; Arabic remains non-scoreable.
- Read-back verification includes grammar and all relationship rows.
- A second import is a byte-identical no-op with no duplicate rows.
- A forced late failure rolls back the entire content batch.
- Existing Nicos and Netzwerk intake tests remain green; existing learner/SRS rows remain byte-identical.

Run `npm test`. A focused Vitest path may be run first, but the complete suite is the release gate.

## Known remaining gaps

- A German/Arabic educator should review the original definitions, translations, examples, and exercise wording before changing their status from imported to verified.
- The editorial A2 classification needs pedagogical sign-off if the product requires formally certified CEFR alignment.
- The official media URL is metadata only: reachability, checksum, duration, codec, and redistribution as an app-bundled binary are deliberately unresolved. Keep it remote-only and non-offline-playable.
- No pronunciation asset or separate downloadable audio file is included.
