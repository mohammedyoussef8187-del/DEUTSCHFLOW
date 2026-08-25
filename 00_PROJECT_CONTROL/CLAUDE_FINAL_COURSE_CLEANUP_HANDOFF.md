# Claude Final Course Cleanup Handoff

- **branch:** `mobile-foundation` — not merged to `main`
- **starting commit:** `6189b1d`
- **final commit:** see `FINAL` below

---

## Systemic causes fixed

**1. A flag is not a filter.** The runtime detected suspect legacy rows and set
`qualityStatus = "review"`, which put them in a "Data Quality Review" queue for the learner
to resolve one card at a time — while leaving the rows live in the meantime. Classification
now happens on the way in (`src/content/legacy-triage.js`), every row gets one of four
verdicts, and the two excluded verdicts are dropped by the seed bootstrap before anything
is stored. Nothing that reaches a learner is also proposed to them as an editorial task.

**2. The detectors were both too narrow and too wide.** They missed `brauchen /i/3b braun`
entirely, and flagged eight legitimate entries as truncated because `von ... bis`,
`Was bedeutet ...?` and `zwar ... aber` contain an ellipsis. An ellipsis is a SLOT. Every
rule now asks for the company a defect actually keeps, and the detectors live in one place
(`src/content/content-quality.js`) so the legacy spreadsheet and the published curriculum
are judged by identical rules.

**3. Nothing knew this project's own conventions.** `auf|stehen` uses a pipe to mark a
separable verb and `[dann]` marks an optional word in a grammar formation — a naive
"structural damage" rule flags six shipped strings. The rules are contextual: a pipe
between two German letters is a marker, a slash is only suspicious next to a digit.

**4. A slash rule would have destroyed sixteen correct entries.** `der/die Angestellte`,
`die/das Cola`, `die Ja-/Nein-Frage`. None contains a digit; the artifacts all do. That is
the discriminator, and it is now asserted by test.

## Files changed

```
01_APPLICATION/CURRENT_APP/src/content/legacy-triage.js     new — four-verdict triage
01_APPLICATION/CURRENT_APP/src/content/content-quality.js   new — shared detectors
01_APPLICATION/CURRENT_APP/src/app.js                       triage wired into applyPatchToSeed;
                                                            ellipsis false positive removed
01_APPLICATION/CURRENT_APP/src/platform/indexeddb/adapter.js excluded rows never stored
01_APPLICATION/CURRENT_APP/sw.js                            cache bumped to rc7-2026-08-25
tests/support/load-legacy-core.js                           repaired (see below)
tests/integration/content-quality.test.js                   new — 44 tests
tools/quality/triage-report.mjs                             new — per-row triage decisions
tools/quality/report.mjs                                    new — the release numbers
```

`data/canonical-content.json` was regenerated through the real pipeline
(`run-curriculum.mjs --apply` → `a2-open-teaching.mjs --apply` → `export-canonical.mjs`) and
came out **byte-identical**. That is the correct result, not a skipped step: the authored
curriculum contained no corruption under the new detectors, so the whole cleanup landed on
the legacy side. The generated file was not hand-edited.

`tests/support/load-legacy-core.js` was already broken before this task — its import strip
handled only single-line imports, and `app.js` has a multi-line one, so any test calling it
would have thrown. No test did. It now strips multi-line imports and stops before the
runtime wiring, and the new suite uses it.

## Legacy processing

```
LEGACY_SOURCE_TOTAL        2820
LEGACY_VALID               2815
LEGACY_CORRECTED              2
LEGACY_ARTIFACT_EXCLUDED      3
LEGACY_QUARANTINED            0
legacy words published     2817
```

**Corrected (2)** — both restored from the row's own evidence, not guessed:

| id | was | now | why |
| --- | --- | --- | --- |
| 1115 | `der Glauben (Ich glaube` = «الاعتقاد (أعتقد)» | `der Glaube` = «الإيمان؛ الاعتقاد» | the cell merged the noun with the verb example beside it and lost the closing bracket |
| 1990 | `die Wechselpräposition` = «حرف الجر Wechsel» | «حرف الجر المتغيّر (الذي يأخذ النصب أو الجر)» | the gloss left the German stem untranslated |

**Artifacts excluded (3)** — workbook cross-references swallowed into a German cell:
`brauchen /i/3b braun`, `der Planen A/3b Platz`, `der Sofort B/8c. Sohn`.

**Quarantined (0).** Nothing was ambiguous enough to need it; the mechanism exists and is
tested, so a future unrestorable row is held back rather than published or delegated.

**No source data was deleted.** `seed-data.js` still holds all 2820 rows including the
three excluded ones — that file is the evidence, and the triage is the decision about it.
A test asserts the count and the presence of each excluded id.

## Learner-visible result

```
LEARNER_VISIBLE_VOCABULARY   431
LEARNER_VISIBLE_EXERCISES    282
LEARNER_VISIBLE_LISTENING     14
learner-readable strings    6439   (all inspected, 0 corrupted)

DATA_QUALITY_QUEUE_TOTAL       0
USER_ACTION_REQUIRED           0
```

Confirmed in the running application by reading its IndexedDB after a cleared first launch:
2817 words stored, review queue 0, every screenshot example absent, `der Glaube` restored,
the Wechselpräposition gloss corrected, all 8 ellipsis slots kept, all 16 slash entries kept.
The home screen no longer offers a data-quality task.

**Duplicates: 1, deliberately kept.** `sich treffen` = «يلتقي» exists twice at A2 — once
imported from COERLL (unit 5) and once authored (unit 11). Two rows for one lexeme is
duplication by the strict reading, but each carries its own provenance and licence, and
removing either would drop an attribution. Duplication *within* one source is asserted to
be zero; this cross-source pair is reported rather than silently merged.

## Canonical integrity

```
ORPHAN_REFERENCES  = 0
INVALID_REFERENCES = 0
```

`export-canonical.mjs` reports `referential integrity: closed`; `integrity-check.mjs`
exits 0. Release metrics unchanged: A1 18 lessons / 8 units, A2 17 lessons / 12 units,
0 empty learner-visible lessons.

## Tests

**1336 passing / 78 files**, zero failures (baseline 1292 / 77). Forty-four added, and half
of them exist to stop the detectors overreaching — every convention the product relies on
(`auf|stehen`, `[dann]`, `von ... bis`, `der/die Deutsche`, `die IBAN`, `km/h`) is asserted
to be clean, alongside the residue that must be caught. The named invariants
(`MANDATORY_USER_DATA_CLEANUP_ITEMS`, `LEARNER_VISIBLE_SLUGS`,
`LEARNER_VISIBLE_CORRUPTED_REFERENCE_CODES`, `LEARNER_VISIBLE_TRUNCATED_ENTRIES`,
`LEARNER_VISIBLE_OBVIOUS_TABLE_ARTIFACTS`) each have a test.

## Learner journey — PASS

Chromium, cleared IndexedDB, on the regenerated dataset: fresh learner resumes at A1
lesson 1; lesson renders 8 sections / 25 items / 0 unlabelled; `bin` rejected and `heiße`
accepted; completion moves progress to 1/18 (6%); resume advances to `Woher kommst du?`;
survives reload; A2 reachable; six representative lessons (A1 #1/#6/#18, A2 #1/#9/#17) all
render with 0 corrupted labels.

## Genuine blockers

None. External conditions unchanged: native device verification (needs macOS/Xcode or the
Codemagic run), Apple signing credentials, audio production for the 7 script-only listening
activities, pronunciation content.

Recorded, out of scope, unchanged from the previous handoff: the 24 authored A2 vocabulary
entries whose `de` field repeats its own article — the renderer compensates so nothing is
learner-visible, but the clean fix is to drop the prefix in `a2-units-8-12.js`.
