# Claude Handoff — Current

- **branch:** `mobile-foundation` (isolated worktree `claude/open-content`, pushed with
  `git push origin claude/open-content:mobile-foundation`; never merged to `main`)
- **starting commit:** `65109d9`, plus the Gemini audit commit `4c6b280` cherry-picked as
  `8bc08c0`
- **commit SHA:** `PENDING_FINAL`
- **phase:** Educator Review / Release Candidate preparation

---

## Work completed

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
one hardware validation. No engineering work is waiting on anything else.

## Exact next action

Hand `tools/intake/artifacts/open-content-audit.json` to the German/Arabic educator and
work the queue by language. To apply an approval: set `content_status` to `verified` on the
listed `uuid` through the repository write API (never raw SQL), re-run
`tools/intake/run-open-content.mjs --apply` so the links withheld from unpublished content
are recreated, then `tools/intake/export-canonical.mjs`. Both steps are now safe to repeat:
the re-import treats an approved row as unchanged rather than as a conflict.
