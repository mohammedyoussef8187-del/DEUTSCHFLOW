# DeutschFlow Pro RC4 — Claude Upgrade Handoff

## Read order — minimize token use

1. Read this file.
2. Read `src/app.js`.
3. Read `index.html` only when changing UI structure.
4. Read `styles.css` only when changing presentation.
5. Do **not** read `data/seed-data.js` unless the task concerns vocabulary data. It contains 2,820 records and is the largest token consumer.
6. `deploy/standalone-index.html` is the exact single-file RC4 build. Use it only for regression comparison or final bundling.

## Product objective

An Arabic-interface German vocabulary PWA for adult practical language learning. It must work offline, preserve progress in IndexedDB, avoid childish/random multiple-choice meaning questions, and use difficult direct recall.

## Current architecture

- Vanilla HTML/CSS/JavaScript; no framework or build tool.
- IndexedDB stores: `words`, `cards`, `attempts`, `meta`.
- PWA: `manifest.webmanifest` + `sw.js`.
- Seed database: `window.SEED` in `data/seed-data.js`.
- Main namespace: `window.DF`.
- Main subsystems inside `src/app.js`:
  - normalization and answer validation
  - data quality and patches
  - IndexedDB wrapper
  - scheduling and session construction
  - import/export
  - UI rendering and event handling

## Current learning behaviour

- Hard+ mode is enabled by default.
- German → Arabic: user types the Arabic meaning.
- Arabic → German: user types German.
- Noun articles: user types `der`, `die`, or `das`.
- Random meaning distractors are disabled.
- Sentence-order cards are excluded from normal hard sessions and do not drive mastery.
- Wrong items return after a randomized gap.
- Session order is shuffled, item types are interleaved, and the previous session opening order is avoided.
- Pronunciation does not reveal a German recall answer in Hard mode.
- Arabic grading is strict and supports curated `acceptedArabicAnswers`.
- Suspect vocabulary can be flagged and quarantined from study.
- Progress denominator is based on initial questions; retries do not inflate it.

## Existing quality and analytics

- Structural data audit: exact duplicates, same German with conflicting Arabic meanings, malformed records, and user flags.
- Thirty-day analytics: first-attempt accuracy, per-skill accuracy, response time, and error taxonomy.
- Automatic local snapshot before backup restoration.
- IndexedDB schema version: 2.
- App settings schema: 5.
- Learning engine version: 6.

## Data warning

The 2,820 records have **not** received a complete human linguistic review. Automated checks cannot guarantee semantic accuracy. Do not claim the database is fully verified.

Known correction/quarantine rules are near `DATA_PATCHES` and `DATA_EXCLUSIONS` in `src/app.js`.

## Upgrade priorities

1. Refactor the monolithic `src/app.js` into modules without changing stored data or behaviour.
2. Add deterministic automated tests for:
   - answer validators
   - session counters and retry insertion
   - scheduling updates
   - migrations and backup restoration
   - PWA update behaviour
3. Improve linguistic schema:
   - lemma and part of speech
   - noun gender/plural
   - verb principal forms and separability
   - multiple senses and example sentences
   - curated accepted Arabic alternatives
4. Introduce a review workflow for flagged/conflicting records.
5. Consider FSRS only if implemented fully and migration-safe; do not merely rename the custom scheduler.
6. Test on real iPhone Safari/PWA:
   - fresh install
   - offline launch
   - close/reopen persistence
   - version update
   - backup/restore
   - long sessions

## Non-negotiable constraints

- Preserve all existing user progress during upgrades.
- Do not restore random semantic multiple-choice distractors.
- Do not follow Excel/source order in sessions.
- Do not expose pronunciation before German recall.
- Do not count introductions, answer reveals, or retries as new planned questions.
- Do not call a release linguistically final without full review.
- Keep Arabic RTL and German LTR handling correct.
- Keep the app usable without a server after first PWA load.

## Recommended workflow

- First make changes in the split source files.
- Run `node --check src/app.js` and `node --check sw.js`.
- Test migrations against a copy of an RC4 IndexedDB export.
- Rebuild the single-file deployment only after regression tests pass.
- Keep `data/seed-data.js` untouched unless data work is explicitly requested.

## Deliverables expected from an upgrade

- Updated split source.
- Updated standalone deployable build.
- Migration notes.
- Automated test report.
- Exact list of behavioural changes.
- Clear statement of anything not tested on real iPhone hardware.
