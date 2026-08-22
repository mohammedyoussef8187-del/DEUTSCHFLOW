# Claude Handoff — Current

- **agent:** Claude
- **branch:** `mobile-foundation` (worked in an isolated worktree on `claude/open-content`, pushed to `origin/mobile-foundation`)
- **starting commit:** `8f5a12d`
- **final commit SHA:** `PENDING_FINAL` (see the last commit on `origin/mobile-foundation`)

## Work completed

### 1. English and Arabic are now independent educational languages (schema 11)

`translations.meaning_uuid` was `NOT NULL` and pointed at the Arabic sense, so English
could only exist where Arabic already did. Once the review lifecycle began holding
unreviewed Arabic back as `draft`, a **verified** English translation disappeared with it.

- `translations` and `accepted_answers` now hang off `vocabulary_items` (`vocab_uuid`),
  the German word both languages actually translate. `meaning_uuid` survives as an
  OPTIONAL sense pairing and has no authority over whether a row exists or may be read.
- `SCHEMA_VERSION` 10 → 11, documented in the schema docblock with the reason.
- The content service assembles both languages from the item and pairs them, instead of
  reading one through the other; a word with only English is an entry that teaches in
  English, not an empty entry.
- The same coupling existed in the legacy migration — German accepted answers were written
  inside the branch that required an Arabic meaning — and is fixed. Every accepted-answer
  identity a previous run produced is unchanged (`meaning_uuid` still seeds the uuid where
  a meaning exists).
- The open-content adapter no longer cascades a draft Arabic meaning onto English or
  German rows. Where a row named a sense that is not published, the PAIRING is dropped,
  never the row. An accepted answer is written only when the row that supplies its text is
  published: the meaning for `ar`, the translation for `en`, the word for `de`.
- Browser saved learner state is keyed on its own `stateVersion`, not the schema version,
  so a content-model release cannot silently discard a learner's progress.

**No migration of learner data was required:** `learnerStorageSwitch` and
`canonicalNativeStore` are both still `false`, so no canonical learner database exists at
any version. The only canonical stores are the rebuildable intake artifact and the
browser's content cache, which is replaced from the shipped dataset on every launch.

### 2. Open A2 Lesson 2 imported — *Reisen planen und von Reisen erzählen*

Cherry-picked `537a551` (Codex). Imported through the **same** adapter, review gate and
intake path as lesson 1; nothing was special-cased.

- Its artifact records provenance in a different shape (`fieldOrigins` keyed by field name,
  with origins that qualify themselves in prose). `originFor()` now reads both schemes and
  matches a source origin as a prefix, so a lesson is judged by what its own artifact says.
  Lesson 1's split is byte-identical after the change.
- Lesson 2 joins the existing `DeutschFlow Open A2` course in its own
  `Reisen und Mobilität` unit: preview reports exactly **5 unchanged** rows (course, CEFR
  level, three course titles) and 0 updates, 0 conflicts.
- `run-open-content.mjs` now imports every artifact in `OPEN_CONTENT_ARTIFACTS` in order.

## Files changed

**Schema / runtime:** `src/platform/sqlite/schema.js`, `src/services/content-service.js`,
`src/migration/canonical-migration.js`, `src/platform/memory/local-canonical-store.js`.

**Intake:** `tools/intake/map-open-content.js`, `tools/intake/map-canonical.js`,
`tools/intake/run-open-content.mjs`.

**Content:** `01_APPLICATION/CURRENT_APP/data/canonical-content.json` (rebuilt),
`tools/intake/artifacts/*.json` (regenerated audits).

**Tests:** new `tests/integration/language-independence.test.js` (11),
new `tests/integration/open-content-lesson-02.test.js` (18); updated
`tests/unit/multilingual-content.test.js`, `tests/integration/canonical-write-path.test.js`,
`tests/integration/open-content-intake.test.js`,
`tests/integration/learner-journey-local.test.js`.

**Docs:** `00_PROJECT_CONTROL/CURRENT_WORK_STATUS.md` (conflict resolved, both lesson
sections kept), this file.

## Tests / validation results

- Focused: language independence 11/11; lesson 2 18/18; lesson 1 30/30; multilingual 19/19;
  intake pipeline + import + batch + netzwerk 164/164.
- **Full regression: 1191/1191 across 70 files** (was 1173/69 after task 1, 1162/68 before).
- Browser validation (real Chromium over HTTP, worktree build):
  - `deutschflow-open-a2` shows 2 units, 1 lesson each.
  - Lesson 2 opens with 33 items — 20 vocabulary, 8 sentences, 4 exercises, 1 listening.
  - `Reise` renders with English `trip, journey` and **no** Arabic — coverage `en: true`,
    `ar: false`. This is the multilingual fix, live.
  - Exercise `open-a2-l02-reise`: a wrong answer scores `false` deterministically and
    writes 1 error event; `die Reise` scores `true`.
  - Completing the lesson writes course + lesson progress; after a full reload progress and
    error history survive, `review_cards` is still 0.
  - Device holds 11 Arabic meanings (Nicos only) and 0 grammar topics: the 39 open-content
    Arabic meanings and both grammar topics were never shipped.

## Learner-visible content counts (shipped dataset, published rows only)

| | count |
|---|---|
| courses / units / lessons / sections | 3 / 5 / 15 / 13 |
| vocabulary items | 50 |
| — with Arabic meaning | 11 (Nicos) |
| — with English translation only | 39 (open content; Arabic in review) |
| English translations | 39 |
| Arabic meanings | 11 |
| accepted answers (de + en) | 90 |
| sentences / sentence texts | 23 / 13 |
| exercises (all gradeable German) | 22 |
| grammar topics / rules | 0 / 0 |
| listening activities / segments | 3 / 24 |
| audio assets (189 Netzwerk source-only + 2 remote-only) | 191 |
| lesson items | 88 |
| **total shipped rows** | **812** |

## Withheld / draft counts

| artifact | published | draft | links withheld |
|---|---|---|---|
| Lesson 1 — *Familie und Feiern* | 110 | 110 | 70 |
| Lesson 2 — *Reisen planen* | 106 | 102 | 54 |

**211 draft rows are held back from the shipped dataset**: 39 Arabic meanings with their
original German definitions, 2 grammar topics, 4 rules, 14 examples, 30 grammar texts,
11 sentences DeutschFlow wrote, 35 Arabic sentence texts, 8 exercises, 32 exercise texts,
17 Arabic structure titles, 6 listening texts and 14 Arabic segment texts. Every one is
stored in the intake database — it cannot be reviewed if it was never imported — and
`verifyImport` asserts on every run that each is stored AND invisible to every service.

## Remaining work

1. **German/Arabic educator review** of the 211 draft rows. This is the only thing between
   them and a learner.
2. **No promotion tool.** Moving a row from `draft` to `imported` currently means editing
   the artifact and re-importing. The withheld links are recreated automatically by that
   same run.
3. **Editorial A2 label** (`EDITORIAL_A2_ASSIGNMENT`, `noSourceLevelClaim: true`) needs
   pedagogical sign-off before it can be presented as CEFR alignment.
4. **Both remote media assets stay remote-only.** Reachability, checksum, duration, codec
   and redistribution rights are unresolved and are not invented.
5. Service-worker offline is still unverifiable locally: `register-sw.js` registers only on
   `https:`. Covered by unit tests; on-device offline remains part of Gate 5.

## Exact next action

Build the reviewer-facing promotion path: a tool that takes a list of row uuids an educator
has approved, rewrites their `content_status` from `draft` to `verified` through the
repository write API (never raw SQL), re-runs `run-open-content.mjs` so the withheld links
are recreated, and re-runs `export-canonical.mjs`. Start from
`tools/intake/map-open-content.js` `publicationOf()` and
`01_APPLICATION/CURRENT_APP/src/content/publication.js`.

## Genuine blockers

None for this task. Two facts a next agent must know:

- Other agents repeatedly re-point the shared working tree at their own branches. All work
  here was done in an isolated worktree (`git worktree add … claude/open-content`) and
  pushed with `git push origin claude/open-content:mobile-foundation`. The shared tree was
  left untouched.
- The educator review in item 1 is a human task with no engineering workaround; imported
  counts must not be raised by lowering the gate.
