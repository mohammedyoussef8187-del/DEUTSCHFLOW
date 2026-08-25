# Claude Handoff — Canonical Export Hardening

- **branch:** `mobile-foundation` (isolated worktree `claude/open-content`, pushed with
  `git push origin claude/open-content:mobile-foundation`; never merged to `main`)
- **baseline commit:** `79a85ea`
- **result commit:** see `RESULT` below
- **scope:** canonical export referential-integrity hardening + release metrics correction.
  No curriculum authored, changed, or removed.

---

## Confirmed root cause

`publishedRows` / `publishedOnly` decide publication **per row**. A dataset is a **graph**.
`exportCanonicalContent` applied the row filter to each table independently and never
cascaded the exclusion to dependent rows, so withholding a parent left its children in the
exported file pointing at a uuid the file does not contain.

Evidence: every orphan's parent is **present in the source store and marked `draft`** —
all of them demoted by `retireSourceCourses`, which drafts courses, units, lessons and
sections but nothing below them.

| orphan | parent | parent state in source |
| --- | --- | --- |
| 26 `lessonItems` | 3 `lesson_sections` | present, `draft` |
| 2 `courseLevels` | `netzwerk-neu-a2`, `nicos-weg-a2` | present, `draft` |
| 17 `curriculumTexts` | 13 `lessons` + 2 `courses` | present, `draft` |

These rows were **never learner-visible**: every reader walks the tree from a course
downwards and never reached them. The damage was to the shipped bytes and to every count
taken from a flat table — which is how the previous report came to state more exercises
and vocabulary than a learner can meet.

## Fix

New `01_APPLICATION/CURRENT_APP/src/content/referential-integrity.js`:

- `declaredReferences()` parses `FOREIGN KEY … REFERENCES …(uuid)` out of
  `SCHEMA_STATEMENTS` and maps table/column to entity/field via `TABLE_SPECS`. Relationships
  are therefore **derived from the schema**, not hard-coded; nullability is read from the
  same DDL so `listening_items.audio_uuid` stays legitimately optional.
- `POLYMORPHIC_REFERENCES` declares the two edges SQL cannot express —
  `lessonItems(contentType → contentUuid)` and `curriculumTexts(ownerType → ownerUuid)`.
  `contentType = "grammar"` resolves against **either** `grammarRules` or `grammarTopics`
  (the open-content intake emits it for a rule).
- `pruneOrphans()` runs to a fixed point, because dropping a course orphans its units,
  which orphans their lessons, and so on.

`tools/intake/export-canonical.mjs` now runs `pruneOrphans` after `publishedRows` and
refuses to report success if the written file is not closed (`exitCode 4`).

### No source data deleted

Pruning is a **filter over the exported dataset**. Verified after the change:
source `lesson_items` 991, `course_levels` 4, `curriculum_texts` 600, `courses` 4,
`lessons` 48, `lesson_sections` 263 — unchanged. A row withheld from a learner is not a
row that stopped existing, and it reappears if its parent is ever released.

## Before / after

| | before | after |
| --- | ---: | ---: |
| orphan `courseLevels` | 2 | 0 |
| orphan `lessonItems` | 26 (11 vocabulary, 14 exercise, 1 listening) | 0 |
| orphan `curriculumTexts` | 17 (15 lesson-owned, 2 course-owned) | 0 |
| other invalid references | 0 | 0 |
| **total** | **45** | **0** |

Exported row counts changed accordingly: `lessonItems` 991 → 965, `courseLevels` 4 → 2,
`curriculumTexts` 600 → 583.

## Release metrics — scopes separated

`tools/intake/release-metrics.mjs`. `ENTITY_TOTAL` above `CANONICAL_TOTAL` is drafts and
retired material the source keeps on purpose; `ORPHANED` above zero is a defect.

| category | ENTITY | CANONICAL | REFERENCED | VISIBLE | ORPHANED |
| --- | ---: | ---: | ---: | ---: | ---: |
| Courses | 4 | 2 | 2 | 2 | 0 |
| Units | 23 | 20 | 20 | 20 | 0 |
| Lessons | 48 | 35 | 35 | 35 | 0 |
| Sections | 263 | 260 | 260 | 260 | 0 |
| Lesson items | 991 | 965 | 965 | 965 | 0 |
| Vocabulary | 426 | 426 | 415 | 415 | 0 |
| Grammar rules | 64 | 64 | 64 | 64 | 0 |
| Grammar topics | 35 | 35 | 35 | 35 | 0 |
| Sentences | 196 | 196 | 186 | 186 | 0 |
| Exercises | 296 | 296 | 282 | 282 | 0 |
| Listening | 15 | 15 | 14 | 14 | 0 |

Grammar topics are counted through the rules that reference them; no lesson item names a
topic directly, so a direct count would read 0 for material a learner plainly meets.

### Listening — reported, not padded

```
LISTENING_ENTITY_TOTAL        15
LISTENING_CANONICAL_TOTAL     15
LISTENING_LEARNER_REFERENCED  14
LISTENING_WITH_AUDIO           7
LISTENING_WITHOUT_AUDIO        7
```

No audio invented, no reference synthesised, no activity removed. The one unreferenced
activity is `familiengeschichten-dialog`, whose lesson belongs to the retired
`nicos-weg-a2`; it is kept because it becomes reachable again if that course is released.

## Tests

- **new** `tests/integration/canonical-integrity.test.js` — 15 tests, run against the
  shipped `data/canonical-content.json`, not a fixture. Asserts the six named
  `ORPHAN_* = 0`, `INVALID_REFERENCES = 0` across every entity including ones nobody named,
  `INVALID_LISTENING_REFERENCES = 0`, the full
  `course → level/unit → lesson → section → item → referenced content` chain, that the
  spine is derived from the DDL, and that pruning converges and removes a whole broken
  chain rather than its first link.
- **full regression:** 1279 passed / 76 files (was 1264 / 75).
- `tools/intake/integrity-check.mjs` — standalone check, non-zero exit on any orphan.

## Learner-journey regression — PASS

Chromium against the regenerated dataset, from a cleared IndexedDB:

1. new learner resumes at A1 lesson 1 (`Hallo! Ich heiße …`); paths A1 = 18L/8U, A2 = 17L/12U
2. lesson renders — 8 sections, 25 items, 0 unlabelled, 2 teaching sections
3. A2 reachable
4. deterministic scoring — `bin` rejected, `heiße` accepted
5. completion advances 1/18 (6%), lesson 1 `completed`
6. resume moves to `Woher kommst du?`
7. survives reload — resume and 6% both persist
8. A2 imported lesson (43 items) and authored lesson (24 items) both render, 0 unlabelled

## A2 provenance — observation only, nothing restructured

Correct and precise **below the course**:

- units 1–7 and their lessons: `cc-by-4.0-open-content`, each with its COERLL URL, `imported`
- units 8–12 and their lessons: `deutschflow-original`, `verified`, `verifiedBy DeutschFlow`
- sections inside the imported lessons stay `cc-by-4.0-open-content`; the 14 teaching-frame
  sections added on top are `deutschflow-original`. No mixing at row level.

**Genuine ambiguity, one place:** the `deutschflow-open-a2` **course row** still carries
`sourceTitle "Deutsch im Blick / Grimm Grammar"`, `sourcePublisher "COERLL, The University
of Texas at Austin"`, `sourceType cc-by-4.0-open-content` while the course now contains 10
DeutschFlow-original lessons. Attribution at course level therefore over-claims COERLL
origin for material COERLL did not write. This is **not** a data-integrity failure and was
left alone per scope. Decide separately: either split the courses, or change the course-level
provenance to composite while keeping the CC BY attribution the seven imported units require.

## Content acceptance — untouched

`deutschflow-original` rows remain `contentStatus = verified`, `verifiedBy = DeutschFlow`,
exactly as found. No reviewer identity, review evidence, policy version or provenance was
changed or fabricated. Independent educator verification is a separate later gate.

## Remaining external / content gates

- independent educator review of the 28 `deutschflow-original` lessons
- 7 learner-referenced listening activities have no audio asset
- pronunciation: no content authored
- native SQLite / Capacitor on a real iPad and iPhone
- native notifications on device

## Blockers

None.

## Next owner

Independent content acceptance (the 28 authored lessons), and the A2 course-level
provenance decision above.
