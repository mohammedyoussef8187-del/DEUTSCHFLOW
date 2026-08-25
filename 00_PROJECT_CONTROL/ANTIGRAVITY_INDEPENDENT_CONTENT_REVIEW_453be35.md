# Independent Content Review — 28 DeutschFlow-original lessons

> **REVIEWER-INDEPENDENCE CAVEAT — READ FIRST.**
> This review was carried out by Claude, the same agent that **authored all 28 lessons
> under review** in the immediately preceding session. It is therefore a rigorous
> **self-review**, not an independent one. Every finding below is backed by repository or
> dataset evidence that any third party can re-run, and six confirmed defects in the
> reviewer's own work are reported — but the structural conflict of interest stands, and a
> genuinely independent reviewer remains a **required open gate**. The requested filename
> (`ANTIGRAVITY_…`) suggests this task was intended for a different agent; it was performed
> here because it was asked for here.

- **branch:** `mobile-foundation`
- **baseline reviewed:** `453be35` (worktree at `5520733`; curriculum content identical —
  `5520733` adds only the hardening handoff document)
- **previous gate:** `CANONICAL_EXPORT_HARDENED`
- **role:** reviewer only. No curriculum file, runtime file, `canonical-content.json`,
  `contentStatus` or `verifiedBy` was modified. One temporary diagnostic script was created
  and deleted; `git status` is clean apart from this document.

---

# Executive Result

Baseline: `453be35`
Authored lessons reviewed: **28 / 28**

| Count | |
| --- | ---: |
| CONFIRMED_ERROR | **6** |
| POTENTIAL_CONFLICT | **6** |
| WORDING_IMPROVEMENT | **7** |
| lessons ACCEPT | **15** |
| lessons ACCEPT_WITH_CORRECTIONS | **13** |
| lessons BLOCK | **0** |

No lesson is unusable. All six confirmed errors are localised and mechanically fixable.
Two of them (CE-2, CE-3) share a single root cause in the authoring engine and will recur
on any future authored lesson unless that cause is fixed rather than the two symptoms.

**Verified sound across all 28 lessons:** verb conjugation and irregular forms; Perfekt
participle formation and `haben`/`sein` auxiliary selection (all 10 participles checked
individually); Präteritum of `sein`/`haben`/modals; adjective endings after both the
definite and the indefinite article, nominative and accusative, singular and plural;
comparative and superlative formation including `teuer → teurer`, `groß → größer`,
`gut → besser/am besten`; two-way prepositions with the dative; subordinate-clause verb
placement for `weil`, `dass`, `wenn`, `als`; separable-verb splitting; `zu`-infinitive
placement inside separable verbs (`umzuziehen`); dative/accusative object order; formal
register in the email lesson. **Zero German grammar errors were found.** Every confirmed
error is a data-integrity, exercise-design, or lesson-coverage defect.

---

# A1 Lesson Review — 18 lessons

Columns: German / CEFR / Teaching / Exercises / Translation / Progression.

| # | Unit | Lesson | Ger | CEFR | Tea | Exe | Tra | Pro | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | erste-schritte | a1-l01-hallo | PASS | PASS | PASS | FIND | PASS | PASS | ACCEPT |
| 2 | erste-schritte | a1-l02-woher | FIND | PASS | PASS | PASS | PASS | PASS | ACCEPT_WITH_CORRECTIONS |
| 3 | erste-schritte | a1-l03-alphabet | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 4 | zahlen-und-zeit | a1-l04-zahlen | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 5 | zahlen-und-zeit | a1-l05-uhrzeit | PASS | PASS | PASS | **FIND** | PASS | PASS | ACCEPT_WITH_CORRECTIONS |
| 6 | zahlen-und-zeit | a1-l06-woche | PASS | PASS | **FIND** | **FIND** | PASS | PASS | ACCEPT_WITH_CORRECTIONS |
| 7 | familie-und-menschen | a1-l07-familie | PASS | PASS | PASS | PASS | PASS | FIND | ACCEPT_WITH_CORRECTIONS |
| 8 | familie-und-menschen | a1-l08-menschen | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 9 | alltag | a1-l09-tagesablauf | PASS | PASS | **FIND** | PASS | **FIND** | PASS | ACCEPT_WITH_CORRECTIONS |
| 10 | alltag | a1-l10-freizeit | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 11 | essen-und-einkaufen | a1-l11-lebensmittel | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 12 | essen-und-einkaufen | a1-l12-im-cafe | PASS | PASS | PASS | FIND | PASS | PASS | ACCEPT |
| 13 | wohnen | a1-l13-wohnung | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 14 | wohnen | a1-l14-wo-ist | PASS | PASS | FIND | **FIND** | FIND | PASS | ACCEPT_WITH_CORRECTIONS |
| 15 | stadt-und-wege | a1-l15-in-der-stadt | PASS | PASS | FIND | PASS | PASS | FIND | ACCEPT_WITH_CORRECTIONS |
| 16 | stadt-und-wege | a1-l16-modalverben | PASS | PASS | FIND | PASS | PASS | PASS | ACCEPT |
| 17 | termine-und-gesundheit | a1-l17-beim-arzt | PASS | PASS | PASS | PASS | FIND | PASS | ACCEPT |
| 18 | termine-und-gesundheit | a1-l18-perfekt | PASS | PASS | FIND | PASS | PASS | PASS | ACCEPT |

**Bold FIND** = contains a CONFIRMED_ERROR. Plain FIND = POTENTIAL_CONFLICT or
WORDING_IMPROVEMENT only.

Notable positives: `a1-l05` teaches `halb sieben = 6:30` correctly and names it explicitly
as the trap for Arabic speakers; `a1-l04` correctly connects German unit-before-ten to the
identical Arabic pattern; `a1-l18` gets all ten Perfekt participles and both auxiliaries
right, including `besuchen → besucht` (no `ge-` after an inseparable prefix); `a1-l12`
teaches register (`Ich möchte` not `Ich will` in a café) rather than only form.

# A2 Authored Lesson Review — 10 lessons

| # | Unit | Lesson | Ger | CEFR | Tea | Exe | Tra | Pro | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 19 | gruende-und-meinungen | a2-l08-warum-weil | PASS | PASS | PASS | PASS | PASS | FIND | ACCEPT_WITH_CORRECTIONS |
| 20 | gruende-und-meinungen | a2-l09-meinung-dass | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |
| 21 | plaene-und-bedingungen | a2-l10-zukunft | PASS | PASS | PASS | PASS | PASS | FIND | ACCEPT_WITH_CORRECTIONS |
| 22 | plaene-und-bedingungen | a2-l11-wenn | PASS | PASS | PASS | FIND | PASS | PASS | ACCEPT |
| 23 | vergleichen-und-beschreiben | a2-l12-vergleich | PASS | PASS | PASS | PASS | FIND | FIND | ACCEPT_WITH_CORRECTIONS |
| 24 | vergleichen-und-beschreiben | a2-l13-adjektive | PASS | PASS | FIND | PASS | PASS | PASS | ACCEPT |
| 25 | kommunikation-und-alltag | a2-l14-email | PASS | PASS | **FIND** | PASS | PASS | PASS | ACCEPT_WITH_CORRECTIONS |
| 26 | kommunikation-und-alltag | a2-l15-reflexiv | PASS | PASS | PASS | PASS | PASS | FIND | ACCEPT_WITH_CORRECTIONS |
| 27 | erzaehlen-und-rueckblick | a2-l16-praeteritum | PASS | PASS | FIND | PASS | **FIND** | FIND | ACCEPT_WITH_CORRECTIONS |
| 28 | erzaehlen-und-rueckblick | a2-l17-geschichte | PASS | PASS | PASS | PASS | PASS | PASS | ACCEPT |

Notable positives: `a2-l08` exercise 4 is well designed — it tests `denn` by making `weil`
and `deshalb` fail on word order rather than on meaning; `a2-l13` states the ending tables
for both article classes accurately; `a2-l16` gets `als`/`wenn` right in both rule and
examples; `a2-l17`'s reading passage mixes Perfekt for events with Präteritum for states,
which is the genuinely idiomatic pattern.

---

# Cross-Curriculum Progression

**A1 internal sequence — sound.** Grammar arrives where it is needed: `sein`/`heißen` to
introduce yourself, W-questions to ask, numbers before time, possessives before family,
separable verbs with the daily routine, the accusative when shopping begins, the dative
when describing where things are, modals before appointments, Perfekt last. No sudden
difficulty jump was found.

**A1 → A2 seam — acceptable, with one framing overlap.** A1 ends on the Perfekt; the
learner-visible A2 then opens on the seven imported units, whose unit 2 teaches the Perfekt
again. This is **not** a defect: the imported treatment extends to separable and
inseparable prefix verbs, which A1 does not cover, and Goethe material treats the Perfekt
as spanning A1 and A2 (see Source Evidence). The overlap is in how both lessons *announce*
themselves, not in what they teach → WI-8.

**A2 internal sequence — genuine duplication, requires a decision (PC-1, PC-2).**
The authored units 8–12 were written on the premise that the imported units 1–7 "covered
the situations but not the connective grammar". Comparing the two grammar inventories from
the shipped dataset shows that premise was **partly wrong**:

| Topic | Imported | Authored |
| --- | --- | --- |
| Komparativ / Superlativ | unit 5 `wohnen-und-arbeiten` | unit 10 `a2-l12-vergleich` |
| Reflexive Verben | unit 4 `gesundheit-und-termine` | unit 11 `a2-l15-reflexiv` |
| Infinitivsätze mit `zu` | unit 6 `bildung-und-umwelt` | unit 9 `a2-l10-zukunft` |
| Koordinierende Konjunktionen (`denn`) | unit 1 `alltag-und-services` | unit 8 `a2-l08-warum-weil` |
| Konjunktiv II Präsens | unit 5 `wohnen-und-arbeiten` | unit 11 `a2-l14-email` |
| Subordinierende Konjunktionen | unit 6 (general rule) | units 8, 9, 11 (`weil`, `dass`, `wenn`) |

Of 22 authored A2 rules, roughly six substantially re-cover imported ground; sixteen are
genuinely new — **adjective endings, the Präteritum, formal email structure, narrative
verb-second, future with `werden`, and dative/accusative object order have no imported
counterpart at all**, and adjective endings in particular were a real A2 gap.

The problem is **order, not content**: the duplicating authored units sit *after* the
imported ones, so a learner meets comparatives in unit 5 and again in unit 10 presented as
new. Related, **PC-2**: imported unit 7 teaches *Modalverben in der Vergangenheit* before
authored unit 12 introduces the Präteritum from scratch — a prerequisite inversion.

**No new lessons are recommended.** The fix is re-framing and re-sequencing, not expansion.

---

# CEFR Findings

**All 28 lessons are appropriate at their assigned level. Zero misplacements.**

- A1 grammar inventory (present tense, `sein`/`haben`, W-questions, possessives, accusative,
  separable verbs, modals, dative of location, Perfekt) matches standard A1 scope.
- A2 grammar inventory (subordinate clauses, comparatives, adjective endings, Präteritum of
  `sein`/`haben`/modals, reflexives, object order, formal writing) matches standard A2 scope.
- Adjective endings at A2 (`a2-l13`) sit at the upper edge of A2 and are the item most open
  to challenge; the lesson mitigates this by restricting itself to nominative and accusative
  and explicitly deferring the rest → **appropriate, slightly challenging but acceptable**.
- `ich hätte gern` (`a1-l06` listening) is formally Konjunktiv II but is taught here as an
  unanalysed politeness chunk, which is standard A1 practice → **appropriate**.

Two forward references were found and are **acceptable** rather than misplacements, because
neither is drilled: `sollen` in the `a1-l15` dialogue (modals arrive in `a1-l16`), and
`gefallen` + dative in `a2-l12` (dative verbs arrive in `a2-l15`).

---

# German Language Findings

**No German grammar, spelling, gender, plural, case, word-order or register error was found
in any of the 28 lessons.** One usage/naturalness issue:

**PC-3 — `a1-l02-woher`, unnatural model question.** `Was sprichst du?` is used twice (a
grammar example and the production prompt) with the Arabic gloss «ماذا تتحدّث؟», intended as
"which languages do you speak". A bare `Was sprichst du?` is not idiomatic German for that
question and reads closer to "what are you saying?". A learner will reproduce it.
→ `Welche Sprachen sprichst du?`

Lexical presentation, non-blocking:
- **WI-1** `a1-l17` lists `Schmerzen` as `die Schmerzen`; it is the plural of `der Schmerz`.
- **WI-6** `a2-l12` lists `größer` and `besser` as vocabulary headwords rather than `groß`/`gut`.
- **WI-7** `a2-l13` teaches `dunkel` without noting that it drops its `-e-` when inflected
  (`ein dunkles Zimmer`, not `dunkeles`).
- **WI-2** `a2-l16` glosses `als` as marking "a single event in the past"; the lesson's own
  correct example `Als ich klein war` is a bounded *period*. Widen the wording.

---

# Exercise Findings

296 exercises were read; all 251 auto-graded items had their expected answers, options and
distractors inspected against the dataset.

**Sound:** every multiple-choice item has exactly one correct option, and no distractor is
accidentally also correct. Several are notably well built (`a2-l08-4` makes `weil` and
`deshalb` fail on word order; `a2-l12-5` makes `der billigste` fail on gender). All five
`order_tokens` items are constrained to a single valid order by token capitalisation.
`SELF_ASSESSED` items genuinely require judgement and carry no expected answers, so nothing
is falsely scored.

**CE-4 — `a1-l14-wo-ist`, exercise 4: the item is unanswerable as posed.**
Prompt `Die Tasche ist ___ dem Bett.`, instruction «أكمل بحرف الجر المناسب» ("fill in the
suitable preposition"), only `unter` accepted. `neben`, `vor`, `hinter`, `auf` and `in` are
all grammatically correct and semantically sensible with `dem Bett`; nothing in the prompt
selects `unter`. A correct answer is marked wrong.

**CE-6 — `a1-l05-uhrzeit`, exercise 5: ambiguous prompt rejects a legitimate answer.**
Prompt is the bare Arabic «الساعة», only `die Uhr` accepted. The **same lesson's vocabulary**
glosses `Stunde` as «الساعة (المدة)» and `Uhr` as «الساعة (الجهاز/التوقيت)». A learner who
writes `die Stunde` is marked wrong for a translation the lesson itself taught.

**CE-5 — `a1-l06-woche`: a graded answer is a word the lesson never teaches.**
Exercise 6 asks which day the appointment falls on; the correct answer is **`Mittwoch`**,
which appears only in the listening script. The lesson's vocabulary lists five of the seven
weekdays (`Mittwoch` and `Donnerstag` are missing) and **no month names at all**, while the
lesson objective promises «تسمّي أيام الأسبوع والشهور» — days *and* months.

Non-blocking: **WI-4**, three items (`a1-l01-7`, `a1-l05-6`, `a1-l12-5`) carry a placeholder
German prompt (`"…"` / `"…?"`), leaving the question only in the Arabic instruction.
**WI-5**, `a2-l11-4` has a sentence-initial gap with lowercase options (`als`), inconsistent
with the capitalised equivalent in `a2-l16-5`.

---

# Translation Findings

Arabic and English glosses were inspected for all 415 learner-referenced vocabulary items.
Arabic quality is generally high, with several disambiguations done deliberately and well
(`Uhr` vs `Stunde`, `alt` = «عمره؛ قديم», `groß` = «طويل؛ كبير», `Hals` = «الحلق؛ الرقبة»,
`günstig` = «بسعر مناسب» rather than "cheap").

**CE-2 — `a1-l09-tagesablauf`: two different words merged; the lesson shows the wrong one.**
`CONFIRMED_ERROR`. The authoring engine derives a vocabulary item's identity from
`normalizeGerman(de)`, which lower-cases. Within course `deutschflow-a1`, `der Morgen`
(«الصباح», from `a1-l09`) collides with `morgen` («غداً», from `a1-l06`). Dataset evidence:
exactly one item exists — `german: "morgen"`, `article: null`, `plural: null`,
`sourceReference: "DeutschFlow A1 — a1-l06-woche"` — and it is attached as a lesson item to
**both** `a1-l06-woche` and `a1-l09-tagesablauf`. Consequences: `a1-l09` teaches "tomorrow"
where it intends "morning"; the noun `der Morgen` with its article and plural is **absent
from the entire A1 curriculum**, although `am Morgen` is used in explanations.

**CE-3 — `a2-l16-praeteritum`: same root cause, and it lands on the lesson's own topic.**
`CONFIRMED_ERROR`. `als` (temporal, «عندما (للماضي)», from `a2-l16`) collides with `als`
(comparative, «من (في المقارنة)», from `a2-l12`). Dataset evidence: one item
`20c36880-3c5b-5126-9304-de8ea4f3b395`, meaning «من (في المقارنة)», English `than`,
displayed in both `a2-l12-vergleich` and `a2-l16-praeteritum`. The lesson whose entire
subject is temporal `als` versus `wenn` shows the learner the *comparison* gloss.

A repository-wide scan found **exactly these two collisions** and no others.

**POTENTIAL_AMBIGUITY, non-blocking:** `Freund` glossed only «الصديق» (also "boyfriend");
`Tasche` only «الحقيبة» (also "pocket"); `Post` glossed «البريد» where the building sense is
«مكتب البريد». **WI-3:** `liegen` glossed «يرقد؛ موجود مستلقياً» — «يرقد» is unnatural for
objects in Arabic.

No `CONFIRMED_ERROR` of straightforward mistranslation was found.

---

# Listening Review

Verified independently against the shipped dataset — the reported figures are exact:

```
LISTENING_ENTITY_TOTAL        15
LISTENING_CANONICAL_TOTAL     15
LISTENING_LEARNER_REFERENCED  14
LISTENING_WITH_AUDIO           7   (all AUDIO_BACKED are cc-by-4.0-open-content)
LISTENING_WITHOUT_AUDIO        7   (all SCRIPT_ONLY are deutschflow-original)
```

The split is clean: every imported activity has a real audio asset; every authored activity
is script-only. The one unreferenced entity is `familiengeschichten-dialog`, whose lesson
belongs to the retired `nicos-weg-a2` — correctly retained, not a defect.

**Linguistic review of the seven SCRIPT_ONLY authored activities: all PASS.**
`a1-l01` (language course), `a1-l06` (booking by phone), `a1-l09` (Lena's day, monologue),
`a1-l12` (café), `a1-l15` (directions), `a1-l17` (doctor's practice), `a2-l09` (opinion
exchange). The dialogue is natural and level-appropriate throughout, with genuinely
idiomatic turns — `Was fehlt Ihnen?`, `Sonst noch etwas?`, `Passt Ihnen Mittwoch um halb
elf?`, `Zusammen oder getrennt?`. Each has a clear pedagogical purpose tied to its lesson.

**The audio gap is reported separately and is not counted against the linguistic content.**
Seven learner-referenced activities are currently reading exercises presented under a
listening heading; no audio was invented and no activity should be removed to improve the
number. Until audio exists, the UI should label them as scripts rather than as listening —
recorded below as a required correction (**RC-7**) because it is a truthfulness issue, not
a production one.

---

# Source Evidence Used

**Internal (primary — all findings above are reproducible from these):**

- `tools/curriculum/a1-units-1-2.js`, `a1-units-3-5.js`, `a1-units-6-8.js`,
  `a2-units-8-12.js`, `a1.js`, `a2.js`, `build-lesson.js`, `a2-open-teaching.mjs`
- `01_APPLICATION/CURRENT_APP/data/canonical-content.json` (the shipped dataset)
- `01_APPLICATION/CURRENT_APP/src/platform/sqlite/schema.js` (entity/field mapping)
- `tools/intake/release-metrics.mjs`, `tools/intake/integrity-check.mjs`
- `00_PROJECT_CONTROL/CLAUDE_HANDOFF_CANONICAL_EXPORT_HARDENING.md`
- Programmatic checks run for this review: exercise/option/expected-answer dump for all 296
  exercises; vocabulary identity-collision scan across both levels; listening
  audio-backing classification; grammar-inventory diff of imported vs authored A2.

**External (one search, used only where cited):**

- [Perfekt in Deutsch A1 & A2 — Klett Übungsgrammatik](https://www.klett.gr/media/wysiwyg/dls/PerfektiD_LHBS_1-51.pdf) —
  supports treating the Perfekt as spanning A1 and A2, i.e. the A1→A2 Perfekt overlap is
  normal progression rather than redundancy.
- [Goethe-Zertifikat A1 Start Deutsch 1 — Prüfungsziele/Testbeschreibung](https://www.goethe.de/pro/relaunch/prf/de/Pruefungsziele_Testbeschreibung_A1_SD1.pdf)
- [Goethe-Zertifikat A1 Wortliste](https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf)
- [Goethe-Zertifikat A2 Wortliste](https://www.goethe.de/pro/relaunch/prf/es/Goethe-Zertifikat_A2_Wortliste.pdf)

**Stated limitation, deliberately not papered over:** the Goethe documents above were
located but **not read line by line**, and no vocabulary list was diffed against the A1/A2
word inventories. The CEFR verdicts in this review therefore rest on the reviewer's own
knowledge of standard A1/A2 scope, corroborated only at the single point cited. No citation
has been invented to make the CEFR section look better sourced than it is. A
word-list-level CEFR audit remains an open gate.

---

# A2 Provenance Recommendation

**Observed.** Provenance is precise and correct at every level *below* the course:
units and lessons 1–7 carry `cc-by-4.0-open-content` with per-unit COERLL URLs and
`imported`; units and lessons 8–12 carry `deutschflow-original`, `verified`,
`verifiedBy DeutschFlow`. Inside the seven imported lessons, the original sections remain
`cc-by-4.0-open-content` and only the 14 teaching-frame sections added later are
`deutschflow-original`. **No row-level mixing.**

The single ambiguity is the **course row** `deutschflow-open-a2`, which still declares
`sourceTitle "Deutsch im Blick / Grimm Grammar"`,
`sourcePublisher "COERLL, The University of Texas at Austin"` and
`sourceType cc-by-4.0-open-content` while the course now contains ten DeutschFlow-original
lessons. Course-level attribution over-claims COERLL origin for material COERLL did not
write.

**Recommendation: OPTION A.** Keep one unified DeutschFlow A2 course; change course-level
provenance to a composite/mixed model that names both origins, retaining exact CC BY 4.0
attribution unchanged at unit, lesson and content-object level.

Reasons: it is the least disruptive correct solution; unit/lesson/content provenance is
already correct and needs no change; CC BY attribution obligations are satisfied where the
licensed material actually lives; and Option B would split a level in two and undo the
single coherent A1→A2 path that the previous phase was built to produce. Option B would
only become preferable if a licence audit found course-level composite attribution
insufficient — no evidence of that was found.

**Not implemented.** Decision belongs to the next owner.

---

# Required Corrections for Claude

Implementation-ready. Ordered by severity.

### RC-1 — Fix the vocabulary identity collision at its root (causes CE-2 and CE-3)

- **Object:** `tools/curriculum/build-lesson.js`, vocabulary uuid derivation
- **Current:** identity key is `` `${frame.slug}:${normalizeGerman(word.de)}` ``;
  `normalizeGerman` lower-cases, so `Morgen`/`morgen` and two senses of `als` collapse.
- **Required:** make the key distinguish entries that are genuinely different lexemes —
  e.g. include `word.article ?? ""` and `word.wordClass` in the key, or honour the existing
  optional `word.key` as an identity override when present.
- **Reason:** two distinct words are currently merged into one row; the loser's article,
  plural and meaning are discarded.
- **Evidence:** collision scan over `A1` and `A2_EXTRA` returns exactly two keys —
  `"morgen"` (2 entries, 2 different) and `"als"` (2 entries, 2 different). Dataset:
  a single `morgen` item with `article: null` attached to both `a1-l06-woche` and
  `a1-l09-tagesablauf`; a single `als` item glossed «من (في المقارنة)» attached to both
  `a2-l12-vergleich` and `a2-l16-praeteritum`.
- **After fixing, re-run** `run-curriculum.mjs --apply` and `export-canonical.mjs`, and
  confirm `der Morgen` («الصباح») and temporal `als` («عندما (للماضي)») both exist.

### RC-2 — CE-1: literal `\n` shown to the learner in the formal-email template

- **Object:** `tools/curriculum/a2-units-8-12.js` line 605, rule `formelle-email/email-aufbau`,
  text kind `formation`
- **Current:** `de: "Sehr geehrte Damen und Herren,\\nich schreibe Ihnen, weil …\\nKönnten Sie mir bitte … ?\\nMit freundlichen Grüßen\\nAmir Hassan"`
- **Required:** single-escaped `\n`, matching the reading passage 27 lines below which is
  already correct.
- **Reason:** `\\n` in a JS string literal is a backslash followed by `n`, not a newline.
  The learner sees the escape characters, in the one lesson whose subject is the *layout* of
  a formal letter.
- **Evidence:** a scan of every string field in the shipped dataset finds exactly one field
  containing a literal backslash-`n`: `grammarTexts.text` for this rule.

### RC-3 — CE-4: `a1-l14-wo-ist` exercise 4 is unanswerable

- **Object:** `a1-units-6-8.js`, `a1-l14-wo-ist` exercises, the `unter` item
- **Current:** prompt `Die Tasche ist ___ dem Bett.`, expected `["unter"]`
- **Required (either):** constrain the prompt so one answer follows — e.g. instruction
  «أكمل بحرف الجر الذي يعني "تحت"» — **or** re-target the item at the case rather than the
  preposition: `Die Tasche ist unter ___ Bett.` → `dem`.
- **Reason:** `neben`/`vor`/`hinter`/`auf`/`in dem Bett` are all correct German; a correct
  answer is currently graded wrong.

### RC-4 — CE-6: `a1-l05-uhrzeit` exercise 5 rejects a legitimate answer

- **Object:** `a1-units-1-2.js`, `a1-l05-uhrzeit`, the «الساعة» → `die Uhr` item
- **Current:** prompt «الساعة», expected `["die Uhr"]`
- **Required:** disambiguate the prompt to «الساعة (الجهاز/التوقيت)» — matching the gloss the
  lesson's own vocabulary already uses — **or** add `die Stunde` as an accepted answer.
- **Reason:** the same lesson glosses `Stunde` as «الساعة (المدة)», so the bare prompt has
  two correct answers and accepts one.

### RC-5 — CE-5: `a1-l06-woche` tests an untaught word and under-delivers its objective

- **Object:** `a1-units-1-2.js`, `a1-l06-woche` vocabulary and objective
- **Current:** vocabulary lists `Montag, Dienstag, Freitag, Samstag, Sonntag, Woche, Monat,
  heute, morgen, Termin`; exercise 6's correct answer is `Mittwoch`; objective promises
  «تسمّي أيام الأسبوع والشهور».
- **Required (either):** add `Mittwoch` and `Donnerstag` to the vocabulary and at least a
  representative set of month names — **or** narrow the objective to weekdays and change
  exercise 6's correct answer to a day the lesson teaches.
- **Reason:** a graded answer must be a word the lesson taught, and a stated objective must
  be delivered.

### RC-6 — PC-3: unnatural model question in `a1-l02-woher`

- **Object:** `a1-units-1-2.js`, `a1-l02-woher` — grammar example under `w-wort-position`,
  and the `self_assessed` production prompt
- **Current:** `Was sprichst du?` («ماذا تتحدّث؟») in both places
- **Required:** `Welche Sprachen sprichst du?` in both places
- **Reason:** the current form is not idiomatic German for asking about languages and will
  be reproduced by learners. Keeping `sprichst` preserves the word-order point being taught.

### RC-7 — Label the seven script-only activities honestly

- **Object:** the listening screen / `df-lesson-view` section label, or the activity's own
  presentation
- **Current:** seven authored activities with no audio asset appear under a listening
  heading (🎧) indistinguishable from the seven that have real audio.
- **Required:** distinguish `SCRIPT_ONLY` from `AUDIO_BACKED` in the learner-facing label,
  e.g. «نص الحوار» / "dialogue script" until an audio asset exists.
- **Reason:** truthfulness — a reading exercise presented as listening misrepresents what
  the learner is getting. This is a labelling correction, **not** a request to produce audio.

### RC-8 — PC-1 / PC-2: resolve the A2 duplication and the prerequisite inversion

- **Object:** A2 unit ordering and lesson framing (`a2.js` orderings; `a2-open-teaching.mjs`
  objectives)
- **Current:** comparatives, reflexives, `zu`-infinitives, `denn` and Konjunktiv II are each
  taught twice — once in imported units 1–7, once in authored units 8–12, with the authored
  treatment arriving second and presented as new. Imported unit 7 teaches modal past forms
  before authored unit 12 introduces the Präteritum.
- **Required:** a **curriculum decision, not new content**. Recommended minimum: re-frame
  the six overlapping authored rules as consolidation/extension (adjust their `summary` and
  the lesson objective to say what is being *added*), and move `a2-l16-praeteritum` ahead of
  the imported `stadt-kultur-und-wege` unit, or add a prerequisite note there.
- **Reason:** the duplication is real and was introduced by the authoring phase on a premise
  the dataset does not support. No lesson should be deleted — sixteen of the twenty-two
  authored A2 rules are genuinely new and fill real gaps.
- **Do not** resolve this by authoring more lessons.

---

# Non-Blocking Improvements

Separate from the required corrections above. None of these should gate a release.

- **WI-1** `a1-l17`: present `Schmerzen` as `der Schmerz, die Schmerzen`.
- **WI-2** `a2-l16`: widen the `als` rule from "a single event" to "a single event or a
  bounded period in the past", so it covers its own example `Als ich klein war`.
- **WI-3** `a1-l14`: replace the Arabic gloss for `liegen` («يرقد») with wording natural for
  objects.
- **WI-4** `a1-l01-7`, `a1-l05-6`, `a1-l12-5`: replace the placeholder German prompt (`"…"`)
  with the actual question.
- **WI-5** `a2-l11-4`: capitalise the sentence-initial option (`Als`), matching `a2-l16-5`.
- **WI-6** `a2-l12`: list `groß` and `gut` as vocabulary headwords rather than the
  comparative forms `größer`/`besser`.
- **WI-7** `a2-l13`: note that `dunkel` drops its `-e-` when inflected (`ein dunkles Zimmer`).
- **WI-8** A1→A2 seam: re-frame the imported Perfekt unit's objective as consolidation, so
  it does not read as a first introduction after `a1-l18` already taught it.
- **PC-5 (systemic, low)** across A1, example sentences, listening scripts and exercise
  prompts use words absent from the lesson's own vocabulary — `Geschwister`, `Bus`, `Auto`,
  `Geld`, `Nachmittag`, `U-Bahn`, `rauchen`, `üben`, `streng`, `Lösung`. Individually
  harmless; worth a coverage pass. `Bus` (`a1-l15`) is the most exposed, since a graded item
  requires knowing it is masculine.
- **PC-6 (low)** vocabulary listed but never used anywhere in its own lesson: `zwischen`
  (`a1-l14`), `vielleicht` (`a1-l16`), `schön`, `müde`, `treffen` (`a1-l18`),
  `sich entscheiden` (`a2-l12`), `gemütlich`, `modern`, `dunkel` (`a2-l13`).

---

# Remaining External Gates

Kept separate from content findings, and none of them is affected by this review:

- **audio production** — 7 learner-referenced activities are script-only (see RC-7 for the
  labelling correction, which is separate from producing the audio)
- **pronunciation** — no content authored; the route is honestly empty
- **native iPad / iPhone SQLite + Capacitor** on real devices
- **native notifications** on device

Additional gates surfaced by this review:

- **genuinely independent content review** — see the caveat at the top of this document
- **word-list-level CEFR audit** against the Goethe A1/A2 vocabulary lists (located but not
  diffed for this review)

---

# Handoff

- **branch:** `mobile-foundation` — not merged to `main`
- **baseline reviewed:** `453be35`
- **files modified by this task:** this document only. No curriculum file, runtime file,
  `canonical-content.json`, `contentStatus` or `verifiedBy` was touched.
- **content acceptance metadata:** left exactly as found — the 28 authored lessons remain
  `contentStatus = verified`, `verifiedBy = DeutschFlow`. No reviewer identity, review
  evidence, policy version or provenance was created or altered.
- **genuine blockers:** none for usability. Six confirmed errors should be corrected before
  a release claim; `RC-1` should be fixed at the engine, not at the two symptoms.
- **next owner:** **Claude — corrections and integration only.** Work `RC-1` through `RC-8`.
  Do not author new lessons; `RC-8` in particular is a sequencing and framing decision, and
  resolving it by adding content would make it worse.

---

# Final Classification

`INDEPENDENT_CONTENT_REVIEW_PASS_WITH_CORRECTIONS`

— qualified by the reviewer-independence caveat recorded at the top of this document.
