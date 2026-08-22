# Claude Handoff — Current

- **agent:** Claude
- **branch:** `mobile-foundation` (worked in an isolated worktree on `claude/open-content`, pushed to `origin/mobile-foundation`)
- **starting commit:** `fa23863`
- **final commit SHA:** `PENDING_FINAL`
- **cherry-picked from Codex:** `877e580` (lesson-02 dataset rebuild, superseded), `2853d65` (seven-lesson curriculum), `4581f79` (curriculum handoff)

## Seven-lesson import status — 7/7 imported, verified, no conflicts

The complete A2 curriculum imports through the existing production path
(`validate → map → preview/diff → apply → verify`) with no architectural change.

| # | Lesson | preview | reused | verify |
|---:|---|---:|---:|---|
| 1 | Alltag organisieren und einkaufen | 298 create | 0 | ok |
| 2 | Familie und Feiern | 319 create | 5 | ok |
| 3 | Reisen planen | 307 create | 5 | ok |
| 4 | Gesund leben und beim Arzt sprechen | 302 create | 5 | ok |
| 5 | Über Wohnen, Beziehungen und Arbeit | 300 create | 5 | ok |
| 6 | Über Bildung und umweltbewusstes Handeln | 300 create | 5 | ok |
| 7 | In der Stadt nach dem Weg fragen | 301 create | 5 | ok |

0 updates, 0 conflicts anywhere. The "reused 5" is exactly the course row, its CEFR level
and its three course titles — so **one** `DeutschFlow Open A2` course with **seven** units
and **seven** lessons, no duplicates.

**What changed in code (three small things, no redesign):**

1. `OPEN_CONTENT_ARTIFACTS` is now read from
   `00_PROJECT_CONTROL/A2_COMPLETE_CONTENT_MANIFEST.json` in `curriculumOrder`, so the
   curriculum is a content fact rather than a hard-coded list. The two standalone
   artifacts it used to name are **superseded**: manifest lessons 2 and 3 carry the same
   course/unit/lesson identities, so they were the same lessons from an older build.
2. `pronunciationMetadata` is validated and deliberately **not mapped**. A record is
   refused if it claims `learnerReady`, or carries an IPA string, phoneme or model audio,
   or carries a `canonicalTarget` at all. Seven citations are recorded in the audit with
   `canonicalRows: 0`.
3. `reviewStatus` is validated against the manifest's four states and can only ever
   **restrict**: an `EXCLUDED` record is refused outright and never published. The
   field-level gate (`fieldOrigins` / `languageOrigins`) continues to decide which part of
   an educator-review-required record may be shown — the policy accepted for lessons 1–2,
   unchanged.

## Learner-visible counts (shipped dataset — published rows only)

Open-content curriculum:

| content type | count | language |
|---|---:|---|
| course / units / lessons / sections | 1 / 7 / 7 / 40 | — |
| vocabulary items | 139 | German (source-transcribed) |
| English translations | 139 | English (source-transcribed) |
| Arabic meanings | **0** | Arabic — all 139 in review |
| accepted answers | 290 (whole store) | German + English only, never Arabic |
| sentences / sentence texts | 35 / 35 | German + English |
| exercises | 48 | German answers, all gradeable |
| exercise texts | 96 | German + English |
| listening activities / segments | 7 / 42 | German + English transcript |
| remote media assets | 7 | remote-only, non-playable |
| grammar topics / rules | **0 / 0** | all in review |
| pronunciation items | **0** | metadata cited, nothing imported |
| curriculum texts | 122 | German + English titles |

Whole shipped dataset: **1849 rows**, 0 of them `draft`.

## Review-gated counts

**692 draft rows held back** across the seven lessons (111/110/106/119/115/115/115
published; 92/118/110/90/94/94/94 draft), plus **309 link rows withheld** because their
target is not published.

By entity: 139 Arabic meanings (with their original German definitions), 7 grammar topics,
14 rules, 24 examples, 105 grammar texts, 39 sentences DeutschFlow wrote, 113 Arabic
sentence texts, 22 exercises, 114 exercise texts, 61 Arabic structure titles, 16 listening
texts, 32 Arabic segment texts.

**The 22 gated exercises** are the 14 learner-production prompts — which have no answer key
to trace, and are stored with no expected option so they could never grade anyone — plus 8
deterministic exercises whose answer key is a *grammar rule* that is itself in review. The
other **48 of 56** deterministic exercises are published and score.

Codex's declared gate is preserved exactly: 372 `EDUCATOR_REVIEW_REQUIRED`, 7
`TECHNICAL_REVIEW_REQUIRED` (the media), 7 `SOURCE_VERIFIED` (pronunciation citations,
`learnerReady: false`), 0 `EXCLUDED`.

## Tests

- **New:** `tests/integration/a2-curriculum.test.js` — 26 tests covering the manifest,
  seven lesson identities and order, one-course/no-duplicates, lifecycle gating across all
  seven, deterministic scoring of every published exercise both ways, the 14 production
  prompts staying ungraded, multilingual independence at curriculum scale, remote media,
  whole-curriculum no-op, Nicos unchanged, learner/SRS untouched, per-lesson rollback, and
  the shipped dataset.
- **Retargeted, not weakened:** `open-content-intake.test.js` (30) and
  `open-content-lesson-02.test.js` (18) now name their datasets explicitly
  (`A2_LESSON_02_FAMILY_EVENTS.json`, `A2_LESSON_03_TRAVEL.json`) instead of indexing into
  the artifact list, and their counts follow the superseding builds (10 exercises per
  lesson rather than 8; 6 gated rather than 4).
- **Full regression: 1217/1217 across 71 files** — the current `mobile-foundation`
  baseline, up from 1191/70 at `fa23863`.

## Browser validation (real Chromium over HTTP, worktree build)

- Course outline renders **7 units, 7 lessons** in curriculum order.
- Opened lessons **1, 4 and 7** — not only the first two. Lesson 4 shows 35 items
  (20 vocabulary, 6 sentences, 8 exercises, 1 listening); lesson 7 shows 33. No uuid ever
  reaches the screen.
- Deterministic scoring in every lesson opened: `die Gesundheit` (L4) and lesson 7's word
  each scored `false` for a wrong answer and `true` for the right one, `selfAssessed: false`.
- 4 error events written across the session.
- Completing lesson 7 wrote course + lesson progress; **after a full reload** progress and
  error history survived, `review_cards` still 0.
- Gated content confirmed absent on the device: 0 grammar topics, 0 pronunciation items,
  and the only 11 Arabic meanings present are Nicos's.
- English independence at scale: 139 of 139 words show their English with **no** Arabic.

## Remaining work

1. **German/Arabic educator review** of the 692 draft rows. It is the only thing between
   them and a learner, and the only way the 8 grammar-keyed exercises and 14 production
   prompts become visible.
2. **No promotion tool.** Moving a row from `draft` to `verified` still means editing the
   artifact and re-importing; the 309 withheld links are recreated by that same run.
3. **Pronunciation stays a citation.** IPA, phonemes and model audio are unresolved for all
   seven lessons and are refused rather than guessed.
4. **Seven remote recordings stay remote-only** — reachability, checksum, duration, codec
   and redistribution rights unresolved, and not invented.
5. **Editorial A2 label** still needs pedagogical sign-off before being presented as CEFR
   alignment.
6. Two superseded artifacts remain on disk for history —
   `A2_OPEN_CONTENT_FIRST_IMPORT.json` and `A2_OPEN_CONTENT_LESSON_02_IMPORT.json`. Nothing
   reads them any more; the manifest drives the import.

## Exact next action

Build the reviewer-facing promotion path: take a list of row uuids an educator approved,
rewrite `content_status` from `draft` to `verified` through the repository write API (never
raw SQL), re-run `tools/intake/run-open-content.mjs` so the withheld links are recreated,
then re-run `tools/intake/export-canonical.mjs`. Start from `publicationOf()` in
`tools/intake/map-open-content.js` and
`01_APPLICATION/CURRENT_APP/src/content/publication.js`.

## Genuine blockers

None for this task. Two facts a next agent must know:

- Other agents repeatedly re-point the shared working tree at their own branches. All work
  was done in an isolated worktree (`git worktree add … claude/open-content`) and pushed
  with `git push origin claude/open-content:mobile-foundation`. The shared tree is untouched.
- The educator review in item 1 is a human task with no engineering workaround. Learner-
  visible counts must not be raised by lowering the gate.
