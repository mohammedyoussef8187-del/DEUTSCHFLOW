# Claude Handoff — Current

- **branch:** `mobile-foundation` (isolated worktree `claude/open-content`, pushed with
  `git push origin claude/open-content:mobile-foundation`; never merged to `main`)
- **starting commit:** `65109d9`, plus the Gemini audit commit `4c6b280` cherry-picked as
  `8bc08c0`
- **commit SHA:** `e60d731` (`feat: integrate the completed A2 educator review`), on top of `6ac57a9`
- **phase:** Educator review INTEGRATED — Release Candidate

---

## A2 educator review integrated — 686 / 686

- **Gemini source branch:** `gemini/a2-educator-review`
- **Gemini source commit:** `e1710c3`
- **Decisions artifact:** `tools/intake/artifacts/educator_review_decisions.json`
  (brought in with `git checkout e1710c3 -- <two paths>`; the Gemini branch was not merged)
- **Reviewer recorded on every promoted row:** `Gemini / Antigravity AI Educator Reviewer`

### Validation before applying — 14 checks, all passed

JSON parses · 686 decisions · 686 unique UUIDs · 0 duplicates · VERIFY 686 · CORRECT 0 ·
GATE 0 · no other action values · 0 queue rows without a decision · 0 decisions outside the
queue · 0 entries missing a uuid · 0 missing a reason · 0 entity mismatches · 0 language
mismatches. Nothing was repaired or regenerated.

### The integration path

No new pipeline. The lifecycle already defined `draft → imported → verified`, the published
view already hid only `draft`, and the repository write API was already the authorised way
to move a row. What did not exist was the small piece that reads a decisions file and calls
it — recorded as the "exact next action" in the previous handoff — so that is what was
added:

```
node tools/intake/run-open-content.mjs --apply        # import the seven lessons
node tools/intake/apply-educator-review.mjs --apply   # promote the 686 approved rows
node tools/intake/run-open-content.mjs --apply        # create the links their targets unblocked
node tools/intake/export-canonical.mjs                # regenerate the shipped dataset
```

`apply-educator-review.mjs` refuses rather than interprets: a decision naming a row that is
neither queued nor in the store, an unknown action, a duplicate uuid, or an entity that
does not match. `CORRECT` and `GATE` are refused by design — a correction belongs in the
source artifact where the diff and provenance are visible, and a gate is the reviewer
saying "not yet". Only `contentStatus`, `verifiedAt` and `verifiedBy` change; uuid, text,
licence and citation are untouched.

### Three defects the integration exposed, each fixed

1. **Approved rows stayed unlinked.** The mapper computed publication from the artifact's
   own provenance markers, so after approval it still proposed `draft` and went on
   withholding the 309 lesson items, accepted answers and links pointing at the approved
   content. `publicationOf()` now takes the completed review into account: a row the
   educator released is published, and its links are written. **309 links created.**
2. **A child of an existing word could never be written again.** `writeBatch` skipped the
   whole vocabulary aggregate when the item already existed — a rule meant only to protect
   the ITEM's first citation. It also stranded the newly approved Arabic meanings and the
   sense pairings. The item is still never rewritten; its pruned children now are.
3. **A verified transcript line could be downgraded.** The listening aggregate was pruned
   all-or-nothing, so an unrelated change in the activity rewrote every text row in it,
   replacing `verified` with the artifact's `imported`. Its child rows are now pruned
   individually. Caught by counting reviewer signatures: 638 / 686 before, **686 / 686**
   after.

A fourth was found by the regression: lesson items reference grammar as `grammar_rule`, a
type `learn-controller.js` did not label or route, so a grammar item would have rendered
its uuid. Rules are now named from their assembled topic and open the grammar screen.

### Before → after

| | before | after |
|---|---:|---:|
| shipped canonical rows | 1849 | **2843** |
| rows at `verified` | 0 | **686** |
| rows at `imported` | 1088 | 1088 |
| draft rows shipped | 0 | **0** |
| educator-review queue | 686 | **0** |
| links withheld | 309 | **0** |

Learner-visible A2 curriculum, read through the running app: 7 units · 7 lessons ·
139 words each with **both** English and Arabic · 7 grammar topics · 14 rules (all with
explanations) · 84 sentences · **70 exercises: 56 deterministic, 14 self-assessed** ·
7 listening activities.

### Rows still withheld — and why

**0 educator-review rows.** The queue is empty; every one of the 686 was approved and
integrated.

Two gates remain, untouched and unrelated to educator review:

- **7 remote media assets — `TECHNICAL_REVIEW_REQUIRED`.** Structurally valid and
  host-checked; reachability, checksum, duration, codec and redistribution still need the
  files themselves. All 7 remain `remote-only`, `playableOffline: false`.
- **7 pronunciation citations — metadata only.** No IPA, phoneme or model audio exists in
  the repository, so there is nothing to promote. 0 canonical pronunciation rows.

### Tests

`npx vitest run` — **1236 / 1236 passing across 73 files**, the same total as the
pre-integration baseline. Five tests failed mid-integration and every one was investigated:
one was the real `grammar_rule` defect above and was fixed in the runtime; four were
assertions pinning the pre-review state (grammar empty, Arabic withheld, 5 of 12 sentences
shipped) and were updated to record what the review released, keeping each assertion's
intent and adding the lifecycle checks that now distinguish the two groups.

### Runtime validation (real browser, real HTTP)

7 units and 7 lessons · lesson 1 shows 43 items (20 vocabulary, 10 sentences, 2 grammar
rules, 10 exercises, 1 listening) with **0 uuids on screen** · vocabulary renders German
with Arabic (`مفردة der Tagesablauf روتين يومي`) · a wrong answer scores `false`
deterministically and writes an error event, the right answer scores `true` ·
`open-a2-l07-production-1` returns `correct: null, selfAssessed: true` and writes no error
event · completing a lesson writes course and lesson progress, both survive a full reload ·
`review_cards` still 0 · 0 duplicate lessons · provenance intact (`verified`, CC BY 4.0
citation present) · pronunciation 0, remote-only audio 7, offline-ready 0.

### Files changed

| File | Change |
|---|---|
| `tools/intake/apply-educator-review.mjs` | **new** — reads the decisions, validates, promotes through the repository API |
| `tools/intake/map-open-content.js` | `publicationOf()` honours a completed review |
| `tools/intake/run-open-content.mjs` | reads the approved uuids and passes them to the mapper |
| `tools/intake/import.js` | vocabulary children no longer skipped; listening children pruned individually |
| `01_APPLICATION/CURRENT_APP/src/runtime/learn-controller.js` | labels and routes `grammar_rule` |
| `01_APPLICATION/CURRENT_APP/data/canonical-content.json` | regenerated: 1849 → 2843 rows |
| `tools/intake/artifacts/open-content-audit.json` | regenerated: queue 686 → 0 |
| `tools/intake/artifacts/educator_review_decisions.json` | **new** — from `e1710c3` |
| `00_PROJECT_CONTROL/GEMINI_HANDOFF_A2_EDUCATOR_REVIEW.md` | **new** — from `e1710c3` |
| three integration test files | assertions updated to the post-review state |

### Genuine blockers

**None.**

### Exact next action

Close the two remaining gates, in either order and independently of each other:
resolve the **7 remote media assets** (reachability, checksum, duration, codec,
redistribution) through the technical-review path, and run the **physical-device gates** —
native SQLite/Capacitor storage and native local notifications on real iPad/iPhone
hardware. Neither is closable from a desktop or browser.

---

## Review-queue artifact: discrepancy investigated and resolved — NOT a data loss

**Reported:** `tools/intake/artifacts/open-content-audit.json` is not present in commit
`c8e6914`.

**Confirmed and corrected:** the report is accurate about `c8e6914` and misleading about
the repository. `git show <commit>` prints only the DIFF that commit introduced, and
`c8e6914` is the documentation-only commit. The artifact was introduced one commit
earlier, in `8c5eebb`, and has been present in the repository tree ever since:

```
$ git ls-tree c8e6914 tools/intake/artifacts/
100644 blob 8c1843c2…  tools/intake/artifacts/open-content-audit.json

$ git ls-tree origin/mobile-foundation tools/intake/artifacts/open-content-audit.json
100644 blob 8c1843c2…  tools/intake/artifacts/open-content-audit.json
```

The same blob is on the pushed branch. No artifact was ever lost, and nothing had to be
recovered. The queue was nevertheless regenerated from the existing pipeline and
re-validated, which is what the rest of this section records.

### Regeneration

Regenerated with the existing mechanism — no second generator, no new format:

```
node tools/intake/run-open-content.mjs --db <scratch>.db --apply
```

The scratch database is outside the repository, so no tracked file other than the audit
itself could change. The regenerated artifact differs from the committed one **in exactly
one line**: `generatedAt`. Every queue entry, grouping and count is identical.

### Validation of the regenerated artifact

| check | result |
|---|---|
| file exists | ✅ `tools/intake/artifacts/open-content-audit.json`, 526,084 bytes |
| valid JSON | ✅ parses |
| queue entries | **686** |
| distinct UUIDs | **686** — deduplicated, no repeats |
| `educatorReview.total` | **686** — matches the previously reported count exactly |
| grouping present | ✅ `byLanguage`, `byEntity`, `byLesson` (7 lessons) |
| entries missing a required field | **0** (uuid, entity, contentType, language, kind, text, sourceReference, lessonUuid, lessonTitle, lessonSourceId, reviewStatus) |
| entries with no text | **0** |
| entries with no citation | **0** |
| technical review | 7 remote media + 7 pronunciation citations |

**Language breakdown:** `ar` 425 · `de` 121 · `en` 97 · untagged 43 (rows whose text lives
in a column rather than a language-tagged row — grammar topics, rules, exercises).

**Entity breakdown:** vocabularyMeanings 139 · exerciseTexts 114 · sentenceTexts 113 ·
grammarTexts 105 · curriculumTexts 61 · sentences 39 · listeningSegmentTexts 32 ·
grammarExamples 24 · exercises 22 · listeningTexts 16 · grammarRules 14 · grammarTopics 7.

**Count difference from the previously reported 686:** none. The regenerated count is 686.

### Git tracking verification

```
$ git status --short tools/intake/artifacts/open-content-audit.json
 M tools/intake/artifacts/open-content-audit.json          # tracked, timestamp only

$ git check-ignore -v tools/intake/artifacts/open-content-audit.json
(no output, exit 1)                                        # NOT ignored by any rule

$ git ls-files tools/intake/artifacts/open-content-audit.json
tools/intake/artifacts/open-content-audit.json             # tracked
```

`.gitignore` excludes only `tools/intake/artifacts/*.db`, with a comment stating that the
artifacts beside the database ARE committed. `.git/info/exclude` is empty. There is no
generated-artifact rule that could have excluded this file, and none was added or removed.

### Commands executed

- `node tools/intake/run-open-content.mjs --db <scratch>.db --apply` — regeneration
- `node -e` structural validation of the regenerated JSON (counts, dedupe, fields)
- `git ls-tree` / `git show` / `git status` / `git check-ignore -v` / `git ls-files`
- `npx vitest run tests/integration/educator-review-readiness.test.js` — **17/17**

No executable code changed, so the full regression was not re-run; it stood at
**1236/1236 across 73 files** at `8c5eebb` and is unaffected.

### Files changed by this task

| File | Change |
|---|---|
| `tools/intake/artifacts/open-content-audit.json` | regenerated (only `generatedAt` differs) |
| `00_PROJECT_CONTROL/CLAUDE_HANDOFF_CURRENT.md` | this section |

`01_APPLICATION/` untouched. The canonical learner-facing dataset, publication gates,
scoring, SRS, learner data, content statuses, IDs and every existing review decision are
unchanged.

---

## Work completed (previous task — Release Candidate preparation)

No new audit was run and no product scope was added. Three changes, each needed to make
release preparation possible without touching a review gate.

### 1. An import run after approval no longer fights the reviewer — `tools/intake/import.js`

This was a genuine release blocker, found by exercising the promotion path rather than by
auditing. An artifact always proposes the status the content STARTED at (`draft`). Once an
educator moved a row on to `verified`, the next import compared the two, saw a difference,
saw a `verified` stored row, and reported a **conflict** — refusing the whole lesson.
Re-import would have become impossible the moment review began, which is now.

`classifyRow` now compares the row BODY separately from its lifecycle column:

- body identical, stored row further along → **UNCHANGED**. The reviewer's decision stands
  and the importer's stale news is ignored.
- body identical, incoming status further along → **UPDATE**. An import may still promote.
- body **differs** and the stored row is `verified` → **CONFLICT**, exactly as before. A
  real source change over reviewed content is still refused.

Verified end to end: approve one Arabic gloss, then re-import the lesson → 0 conflicts,
0 creates, 0 updates, `isNoop: true`, and the approval byte-identical afterwards.

### 2. The review queue is now an artifact, not a terminal scrollback — `run-open-content.mjs`, `map-open-content.js`

`run-batch.mjs` and `run-netzwerk.mjs` have always written an audit JSON; the open-content
runner printed its review split and discarded it. So the only record of WHICH rows an
educator must look at existed for as long as a terminal window. It now follows the same
convention and writes `tools/intake/artifacts/open-content-audit.json` containing:

- **`educatorReview.queue`** — one entry per gated row: `uuid`, `entity`, `contentType`,
  `language`, `kind`, the actual `text`, its `sourceReference`, and the lesson it belongs
  to (`lessonUuid`, `lessonTitle`, `lessonSourceId`).
- **`educatorReview.byLanguage` / `byEntity` / `byLesson`** — so review can be taken one
  language, one content type or one lesson at a time.
- **`technicalReview.remoteMedia`** and **`technicalReview.pronunciationMetadata`** — kept
  apart from educator review, because they need different people and different evidence.

The aggregate queue is deduplicated by uuid: every lesson declares the shared course
record, so its Arabic title would otherwise appear seven times as seven separate tasks.
**686 distinct rows to review** (692 per-lesson entries, 6 of them repeats of one row).

### 3. Structural verification of the seven remote recordings — `describeRemoteMedia()`

Checks only what can be checked without the network: the URL parses, is `https:`, sits on
an official COERLL/UT host, and ends in a file extension; and the stored row still says
`availability: "remote"` with no local path. Everything that needs the file itself —
reachability, checksum, duration, codec, redistribution — is listed as `unresolved` and the
asset stays `TECHNICAL_REVIEW_REQUIRED`. All 7 are structurally valid; **0** are
offline-ready, and none is advertised as such.

### 4. Pronunciation — gate preserved, nothing promoted

The repository contains no IPA, no phoneme inventory and no model audio for any of the
seven lessons: `pronunciation_features`, `pronunciation_items`, `pronunciation_variants`
and `pronunciation_pairs` are all empty. There is therefore no evidence to promote
anything on, and nothing was promoted or synthesised. The 7 records stay
`SOURCE_VERIFIED` citations with `learnerReady: false` and `canonicalRows: 0`.

---

## Files changed

| File | Change |
|---|---|
| `tools/intake/import.js` | `classifyRow` separates body from lifecycle so approval and re-import coexist |
| `tools/intake/map-open-content.js` | builds the per-lesson review queue into the audit |
| `tools/intake/run-open-content.mjs` | writes the audit artifact; `describeRemoteMedia()` and `buildOpenContentAudit()` |
| `tools/intake/artifacts/open-content-audit.json` | **new** — the review queue and technical-review record |
| `tests/integration/educator-review-readiness.test.js` | **new**, 17 tests |

**No application/runtime source changed** (`01_APPLICATION/` untouched) and the shipped
`data/canonical-content.json` is byte-identical to the audited build — 1849 rows, 0 draft.
Learner-facing behaviour is therefore exactly the state Gemini passed.

---

## Tests / validation

- Focused: `educator-review-readiness.test.js` 17/17; `a2-curriculum.test.js` +
  `a2-final-integration-audit.test.js` 28/28.
- **Full regression: 1236/1236 across 73 files** — above the 1219/72 baseline, no
  regressions, +17 for the new behaviour.
- Re-import after approval verified directly against a real SQLite store: 0 conflicts,
  `isNoop: true`, approval preserved field-for-field.
- Re-export produced an identical dataset (only rebuild timestamps differed, so the
  audited file was kept rather than churned).

---

## Release Candidate readiness

**The software is Release-Candidate ready.** Everything outstanding is an intentional
human gate, not a defect.

| | state |
|---|---|
| approved learner content functional | ✅ 7 lessons, 48 deterministic exercises, 139 words with English, 7 listening activities |
| review-gated content safely gated | ✅ 686 rows, 0 visible through any service |
| no draft leak in the shipped dataset | ✅ 0 draft rows of 1849 |
| no duplicate structures | ✅ 1 course / 7 units / 7 lessons |
| learner + SRS data preserved | ✅ 0 rows written by any import |
| no unnecessary migration | ✅ no schema change this task; saved learner state keyed on its own `stateVersion` |
| re-import idempotent | ✅ including after approval |
| deterministic scoring unchanged | ✅ Arabic still never scores |
| remote media marked remote-only | ✅ 7/7, none offline-ready |
| pronunciation metadata-only | ✅ 0 canonical rows |
| `learnerStorageSwitch` / `canonicalNativeStore` | ✅ both `false`, untouched |

---

## Educator-review items still pending — 686 rows

| content | rows | language |
|---|---:|---|
| Arabic vocabulary meanings | 139 | ar |
| grammar topics / rules / examples / texts | 7 / 14 / 24 / 105 | de + en + ar |
| sentences DeutschFlow wrote | 39 | de |
| sentence support texts | 113 | ar + en |
| exercises (14 production prompts + 8 grammar-keyed) | 22 | de |
| exercise texts | 114 | de + en + ar |
| structure titles | 61 | ar |
| listening texts and segment texts | 48 | ar |

Split available by language (425 ar / 121 de / 97 en / 43 untagged), by entity and by
lesson in `tools/intake/artifacts/open-content-audit.json`.

**Nothing here was approved, and nothing was made visible to raise coverage.**

## Technical-review items still pending — 7 media + 7 pronunciation

- 7 remote recordings: structurally valid, host-checked, `offlineReady: false`.
  Unresolved and not guessed: reachability, checksum, duration, codec, redistribution.
- 7 pronunciation citations: no IPA, phoneme or model audio exists in the repository, so
  there is nothing to verify and nothing was promoted.

## Physical-device gates still pending

Not closable from a desktop or browser, and deliberately not attempted:

1. Native SQLite / Capacitor storage validation on real iPad and iPhone hardware
   (`learnerStorageSwitch`, `canonicalNativeStore`).
2. Native local notification delivery on real iOS/iPadOS hardware
   (`nativeNotifications`).

---

## Genuine blockers

**None.** The three pending categories above are intentional gates: two human reviews and
one hardware validation. No engineering work is waiting on anything else, and the review
queue is present, tracked and validated.

## Exact next action

**Resume Gemini/Antigravity educator review using
`tools/intake/artifacts/open-content-audit.json` as the authoritative review queue.**

To apply an approval afterwards: set `content_status` to `verified` on the listed `uuid`
through the repository write API (never raw SQL), re-run
`tools/intake/run-open-content.mjs --apply` so the links withheld from unpublished content
are recreated, then `tools/intake/export-canonical.mjs`. Both steps are safe to repeat: the
re-import treats an approved row as unchanged rather than as a conflict.
