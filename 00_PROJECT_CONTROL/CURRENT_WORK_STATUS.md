# Current Work Status (CURRENT_WORK_STATUS.md)

This is the single canonical handoff file for **DeutschFlow** to track progress across sequential agent invocations.

## Metadata
*   **Last AI/Agent Used:** OpenAI Codex — Netzwerk source-verification and implementation preparation only; Claude remains primary implementation agent
*   **baseline Git commit:** `80599f5bf1aa9ea6dcd52aa42339df2c8bb67e27`
*   **second pass Git commit:** `2ce3631946f6fe962c48488048a7eaf4ac144e68`
*   **audit Git commit:** `103970456900e24f6a8f6c85346248d34812aaa5`
*   **design Git commit:** `afb480b6d069dc756d0318552e31aa892ab014a4`
*   **phase 4 parity Git commit:** `d622413` (test: verify indexeddb to sqlite migration parity)
*   **backup gate Git commit:** `486e47b` (feat: add verified backup and restore safety gate)
*   **real-data dry-run Git commit:** `bb91fd6` (test: add read-only real-data migration dry-run)
*   **capacitor foundation Git commit:** `63b5226` (feat: add capacitor native sqlite executor)
*   **migration controller Git commit:** `0fe22dc` (feat: wire persistence bootstrap with automatic indexeddb fallback)
*   **Gate 4 Lit Git commit:** `da6993e` (feat: add iPad-first app shell layout foundation)
*   **UI consolidation Git commit:** `91f5804` (feat: migrate study progress strip to Lit)
*   **study presentation Git commit:** `c7a58ba` (feat: migrate the study teaching panel to Lit)
*   **UI migration complete Git commit:** `60f2526` (feat: migrate the multiple-choice answers to Lit)
*   **option (c) work Git commit:** `e872810` (fix: make the PWA actually work offline)
*   **Gate 5 simulator PASSED commit:** `16807f9` (validated in Codemagic)
*   **Last Update Timestamp:** 2026-08-22

## Current Context
*   **Current Phase:** PHASE 4 — MIGRATION MAPPING + SQLITE PARITY VALIDATION
*   **Current Delivery Priority:** MOBILE FIRST — iOS/iPadOS + Android
*   **Phase Status:** PHASE 2 AND PHASE 3 COMPLETE. PHASE 4 COMPLETE (migration mapping, SQLite parity, backup/restore Gate 2, real-data dry-run). PHASE 5 STARTED: Capacitor 8 mobile foundation and native SQLite executor implemented and contract-tested. Real learner storage NOT switched; on-device verification (Gate 5) NOT yet performed.
*   **Implementation Status:** ACTIVE ON `mobile-foundation`
*   **Current Task:** Netzwerk neu A2 Kapitel 2 adapter implementation is prepared from verified official-source metadata. No adapter/runtime implementation was made by Codex. Native storage remains GATED OFF; on-device verification still requires user-only device actions.

## Netzwerk neu A2 Adapter Preparation (documentation only, 2026-08-22)
*   Traced the successful Nicos Weg intake through extraction, normalization, parsing, validation, canonical mapping, preview/diff, repository transactions, service verification, and its unit/integration fixtures.
*   Added `NETZWERK_NEU_A2_KAPITEL_02_MANIFEST.json`: 3 edition identities, 23 official source records, and 16 source-only audio units for Kapitel 2. Exact audio page/exercise mappings remain 0 proven and are null in every audio record.
*   Added `NETZWERK_NEU_A2_CLAUDE_IMPLEMENTATION_BRIEF.md` with exact reusable exports, the minimal manifest-backed adapter contract, likely code touch points, canonical field rules, and required tests.
*   Smallest safe first slice is 22 canonical rows in an empty test store: course, level, A2.1 unit, Kapitel 2 lesson, two German title texts, and 16 unplayable source-only audio assets. It creates no vocabulary, translations, grammar, exercises, listening activities, lesson items, learner data, or SRS data.
*   Publisher wording/audio payload remains blocked by rights; exact audio page/task links remain blocked by official evidence. Neither blocks the metadata/source-asset slice.
*   Added the implementation-preparation indexes: all 189 local MP3s are readable, byte-identified by unique SHA-256, and measured by a complete MPEG frame scan; 189 chapter-level relationships are partially proven and all page/exercise mappings remain null. The rights-safe structure index contains 4 editions, 26 official resources, 12 chapters, and 24 component/chapter audio ranges while preserving the Kapitel 1 title anomaly.
*   Materialized the exact 22-row Kapitel 2 fixture with deterministic canonical UUIDs, explicit importable/null fields, provenance, and rights gates. This is documentation/data preparation only; runtime registration still remains unchanged until Claude implements and tests the adapter.

## Gate 4 — Lit Proof of Architecture (PASSED)
*   Lit **3.3.3**, vendored as a single ESM bundle at `01_APPLICATION/CURRENT_APP/vendor/lit.js` (`npm run build:vendor`), so the app remains a no-bundler static site that Capacitor can serve directly.
*   First component `<df-review-summary>` is real and useful: it replaced the dashboard's hand-built stat grid and shows genuine learner state (due = due + overdue, new, weak, mastered, plus vocabulary and learning totals). No invented statistics.
*   New application service `src/services/review-summary-service.js` derives the summary via the SRS `wordStatus` engine, reading through repositories only. Strictly read-only.
*   Boundary enforced and tested: the component imports Lit and nothing else — no IndexedDB, SQLite, Capacitor, repositories, or SRS internals — renders no interactive controls, and works against a frozen summary object, so it cannot mutate learner/SRS state.
*   Coexistence: styles are scoped in shadow DOM and inherit the existing CSS custom properties, so the global stylesheet, theming, and RTL are untouched. `app.js` gained two imports plus one hydrate call in the existing `afterRender` hook.
*   **Browser-verified** against the seeded app: element upgraded, 2820 real words rendered, reactive re-render without reload, existing topbar/nav/routing/training cards intact, and IndexedDB unchanged (2820 words / 0 cards / 0 attempts before and after).

## UI Consolidation and First Study-Screen Slice
*   **`<df-stat-tile>`** extracted as a shared presentation primitive. `<df-review-summary>` composes it, and `statCard()` emits it, so the statistics page and import preview migrated in one change. No `.stat-card` markup remains.
*   **`dashboardStats()` deleted** — it duplicated the review-summary application service. The statistics page now derives counts from the same `summarizeLearnerState()` service as the dashboard.
*   **Scope note:** `<df-review-summary>` was NOT placed on the statistics page. That page shows different metrics (first-attempt accuracy, attempt count, average answer time) and only "mastered" overlaps, so reusing it there would have added unrelated tiles and changed behavior. The genuine duplication was the tile primitive and the counts service; both are now shared.
*   **Bug fixed:** statistics tiles rendered `ليس رقمًا` (NaN) for accuracy and average answer time, because `statCard` coerced pre-formatted strings with `Number()`. Pre-existing, not a regression — the refactor reproduced it byte-identically and it was fixed in a separate commit.
*   **Study/SRS interaction tests added** (10 tests) driving the real app through the DOM: introduce → answer → rate, asserting card creation values, that evaluation does not commit until rated, SRS scheduling outcomes, attempt-log fields, session coherence, and that a wrong answer never deletes cards or pushes ease below 1.3.
*   **`<df-study-progress>`** is the first migrated study-screen slice, and deliberately the read-only part (progress bar, retry badge, correct/wrong/hint tally). It renders no controls and no `data-action`, so answering, revealing, hinting, and rating remain vanilla. Browser-verified.
*   **`<df-word-panel>`** is the second slice: the read-only teaching panel (German form, pronunciation, Arabic meaning, descriptive pills). Intro action buttons remain vanilla outside it. German text is marked `lang="de"` and bidi-isolated so it renders correctly inside the RTL page. Browser-verified with real seeded data; introducing a word still creates exactly one card.
*   **Study route safe areas:** the study screen renders full-screen outside `.layout`, so the shell insets did not reach it. It now has its own inline/top/bottom safe-area padding for notched iPhones and iPad landscape.
*   **Remaining study migration order:** session-end summary next (read-only), then the answer input, reveal, hint, and rating controls LAST, one at a time, re-running the study interaction suite after each.



## Arabic Scoring Removal (gated milestone, commit `ecfcab3`)
*   **Rule enforced:** Arabic can no longer decide correctness anywhere in the runtime. Recognition became a **self-assessed** skill: the learner still types the Arabic meaning and still gets feedback, but the SRS outcome comes from their own rating.
*   `evaluateArabicAdvisory` returns `isCorrect: null` — deliberately not `false`, because `false` reads as "answered incorrectly" and would lapse the card, punishing learners for spelling variants. It carries `selfAssessed`, `quality: 0`, and an `advisoryMatch` flag used only to inform the learner.
*   Suggested rating for self-assessed answers is a neutral 3; recorded correctness derives from the chosen rating; revealing still counts as a lapse (a learner action, not an Arabic decision).
*   Feedback panel is neutral (no red cross), always shows the Arabic meaning, offers the full hard/good/easy set, and states that Arabic wording is not auto-corrected.
*   **German/English scoring unchanged.** `validateArabicAnswer` survives as a pure matcher for non-scoring uses but is no longer in the submit path. `strictArabicAnswers` kept for settings compatibility; it now only tunes advisory wording.
*   **No history touched:** no attempt, card, due date, ease, lapse, mastery or streak modified or recomputed. A test migrates a recognition card built up under the old Arabic-scored rules and asserts all 14 SRS fields survive field-for-field, including through SQLite.
*   **Verification limit:** the in-app recognition flow was not reachable in a browser from a fresh seeded profile, because recognition cards unlock with future due dates. Covered by tests of the runtime wiring, the advisory evaluator, and the feedback component instead of a live session.

## PRODUCT COMPLETION AUDIT (2026-08-21, after Feature I)

### Working end-to-end for a learner today
*   Vocabulary study over **2,820 German↔Arabic items** (`data/seed-data.js`, `window.SEED`), on legacy IndexedDB.
*   SRS scheduling (`recall` + `recognition`), deterministic German/article scoring, Arabic advisory-only and self-assessed.
*   Full study loop: question prompt → answer input → reveal → hint → rating → session-end summary. Five routes: home, words, study, stats, settings.
*   Words list and editor, stats and charts, settings, backup/restore, import, PWA offline, iPad-first shell, focus/a11y handling.
*   **15 Lit components** are wired into `app.js`.

### Architecture-only — built, tested, NOT reachable by a learner
*   Features **A–I** (multilingual content, grammar, sentences, exercises, courses/lessons/CEFR, error learning, listening, pronunciation, reminders): schema + service + tests + a component each.
*   **None of their services is imported by `app.js`.** Only `review-summary-service` is.
*   **6 components are unreferenced by the runtime**: `df-sentence-card`, `df-course-outline`, `df-lesson-view`, `df-error-insights`, `df-listening-player`, `df-pronunciation-card`, plus `df-reminder-settings`.
*   `bootstrapPersistence()` and `createCanonicalRepositories()` are **never called from the running app** — only from tests and the CI simulator harness. The canonical model is entirely outside the runtime.

### Genuine functional gaps, ranked by what they block
1.  **No incremental write path on the canonical model.** `createSqliteAdapter` exposes only `initializeSchema`, `schemaVersion`, `importCanonical` (bulk, migration-only), `readCanonical`, `selectAll`, `verifyIntegrity`; `createCanonicalRepositories` exposes `all()` per entity and nothing else. **Nothing new can be recorded**: no review, no error event, no lesson/section completion, no pronunciation attempt, no reminder row. This blocks wiring every feature A–I, because they all need to write. **Small, well-bounded, and fully testable today with the existing `node:sqlite` test executor — no device needed.**
2.  **No authored canonical content exists anywhere.** Every content table is empty in every code path, by design (migration invents nothing, and there is no authoring pipeline). Even with reads wired, grammar/sentence/exercise/course/listening/pronunciation UI would render an empty state. Needs a content import pipeline plus real verified content; the Netzwerk PDFs are in `03_COURSE_CONTENT/` but nothing is extracted, and the 189 A2 MP3s stay `source-only` by explicit decision.
3.  **No runtime composition root for the new services.** No routes, no navigation entries, and nothing that constructs repositories and injects them into the services.
4.  **Learner storage is still legacy IndexedDB.** `learnerSwitchEnabled = false`, blocked on the physical-device gate, which is blocked on a paid Apple Developer account. Until then the canonical model holds no runtime data.
5.  **Reminders can never fire**: gate off, no Capacitor plugin installed, no bridge, and no settings screen renders `<df-reminder-settings>`.
6.  Known/deferred: physical-device gate; placeholder bundle id `com.deutschflow.app`; SQLCipher export-compliance review; `exportBackup` still writes `schemaVersion: 5` while the canonical schema is at 10.

### Highest-value next step
**Gap 1 — the incremental write path.** It unblocks gaps 2, 3 and 5, needs no hardware and no product decision, and is verifiable with the existing test executor. Wiring anything before it exists would produce read-only screens that cannot record what the learner does.
## Netzwerk Intake — BLOCKED ON SOURCE QUALITY (audio registered)
*   **Inventory (SHA-256 identified, text layer measured):**
    | File | Edition/Level | Component | Pages | chars/page | Verdict |
    |---|---|---|---|---|---|
    | `Netzwerk Neu A1 - Kursbuch.pdf` | neu A1 | Kursbuch | 177 | **1.8** | `sparse` |
    | `Netzwerk neu A2 KB.pdf` | neu A2 | Kursbuch | 181 | **0** | `absent` |
    | `Netzwerk neu A2 Kursbuch.pdf` | neu A2 | Kursbuch | 180 | **0** | `absent` |
    | `Netzwerk neu A2 UB.pdf` | neu A2 | Übungsbuch | 203 | **43.7** | `sparse` (OCR artefacts, 2.1% suspect rate) |
*   **0 of 4 documents are parseable.** The Kursbücher are scans with **no text layer at all**; the Übungsbuch has an OCR layer that is visibly corrupted — `Dcngler` for Dengler, `Rcmus` for Remus, `Losungen` for Lösungen, `Klctt`, `Tesrheft`, `A^pleLogo`. Importing that into a German course would store misspelled German as verified vocabulary.
*   **No Netzwerk parser was written.** There is no readable layout to parse, so a parser would be untested speculation. `parserStatus: not-written-no-readable-source`.
*   **New: the text-layer gate** (`tools/intake/text-layer.js`) classifies a document `digital` / `sparse` / `ocr-degraded` / `absent` **before** parsing, from chars-per-page plus German-specific OCR fingerprints. Deterministic, tested both ways, and it **never repairs text** — correcting a scanner's guess is guessing what the page said.
*   **The two A2 Kursbuch files are NOT duplicates.** Sizes differ by 0.5% but SHA-256 differs, so both are kept and reported separately. **0 exact duplicates** across the corpus.
*   **Audio: 189 files, all 189 distinct by SHA-256**, three complete groups with **no gaps** — KB disc 1 (63), KB disc 2 (59), UeB disc 1 (67, tracks 2–68). All **registered** as `audio_assets` with `checksum: sha256:…`, `availability: source-only`, `durationMs: 0`. Idempotent: second run 0 new / 189 present.
*   **0 tracks mapped to lessons.** The filename convention deterministically gives level, book, disc and track — and never a lesson. The track-to-lesson index is printed in the Kursbuch, which has no readable text. Mapping by order or duration is exactly the guess the rules forbid.
*   **No listening activity was created** for any track: nothing in the repository says what these recordings teach.
*   Existing Nicos Weg content, learner data and SRS rows untouched. **Suite 950 → 979.**

### What would unblock Netzwerk
A **digital-text** (not scanned) edition of the Kursbuch/Übungsbuch, or the publisher's downloadable **Lösungen/Transkripte** and **audio index** (the Übungsbuch's own imprint points at `klett-sprachen.de/netzwerk-neu`). With either, the parser is a day's work; without one, nothing honest can be imported.
## Controlled Batch Intake — Nicos Weg A2 (COMPLETE for the available corpus)
*   **Discovery replaces hard-coded paths.** `discover.js` scans `03_COURSE_CONTENT/`, matches filenames against a **publisher template**, and groups a lesson's documents by role. Capabilities (`supports`/`absent`) come from the template, so a newly dropped-in handout never has its contents guessed. **6 PDFs scanned → 1 Nicos Weg candidate; the 4 Netzwerk books are reported `no-template-matches`** and deliberately untouched.
*   **The corpus is one lesson.** Only `Nicos-Weg-A2-E2-L1-*` exists in the repository — there is no second Nicos Weg lesson to import. The batch machinery is built and proven; the material is not here yet.
*   **Preview-all-then-apply.** Every candidate is previewed against the pre-batch store before any of them is written.
*   **The gate: absence imports, ambiguity is quarantined.** `english-absent-in-source`, `exercise-answers-absent`, `exercise-options-incomplete` and friends describe the source honestly and import. `duplicate-headword`, `ambiguous-headword`, `unresolved-speaker` mean we do not know which reading is right, so the lesson is quarantined. **An unclassified warning defaults to ambiguity**, so a new one can never import unexamined.
*   **Cross-lesson identity fixed before it could bite.** Vocabulary uuids were **lesson-scoped**, so the same word in two episodes would have become two canonical items. Identity is now **course-scoped and keyed by (headword + gloss fingerprint)**: same word and same meaning is one item reused across lessons; the same spelling with a different gloss stays separate and is reported as a **homograph, never merged**. Lesson membership stays per-lesson in `lesson_items`, and a reused row **keeps the provenance of the page it was first read from**.
*   **Two real bugs found by building this:** (1) the episode-title scan read the page **footer** as a title, because it ran over the page with its chrome still attached; (2) `exercises.slug` is UNIQUE store-wide, so a second lesson's «Übung 1» and its `recall-<word>` exercises **would have silently taken over the first lesson's rows** — slugs are now lesson-tagged.
*   **Batch audit artifact** (`tools/intake/artifacts/batch-audit.json`): lessons discovered/imported/skipped, rows create/update/unchanged/conflicts, every warning labelled `absence` or `ambiguity`, errors, conflicts, reuse counts (both the pre-batch preview view and what was actually written), source digests, and unrecognised files.
*   **Result:** 1 discovered, 1 imported, 0 skipped, **189 rows created**, 0 errors, 0 conflicts, 15 warnings all `absence`. Second run: **0 create / 0 update / 189 unchanged**, vocabulary **reused 11 / written 0**.
*   **Suite 919 → 950.**
## Canonical Content Intake Pipeline (IMPLEMENTED — one verified lesson)
*   **Stages:** EXTRACT → NORMALIZE → PARSE → VALIDATE → MAP → PREVIEW/DIFF → IMPORT → VERIFY, in `tools/intake/`. Nothing writes straight from raw extraction: the plan is always computed and printable first.
*   **Sources imported** (both already in this repository, both Deutsche Welle *Nicos Weg A2*, Episode 2 «Familiengeschichten»):
    *   `03_COURSE_CONTENT/VOCABULARY/Nicos-Weg-A2-E2-L1-Manuskript-und-Wortschatz-Arabisch.pdf` — **pages 1–2**
    *   `03_COURSE_CONTENT/REFERENCE/Nicos-Weg-A2-E2-L1-Lehrerhandreichung-und-Uebungen.pdf` — **pages 2–4**
*   **Extraction** uses the local `pdftotext -enc UTF-8 -layout`, splits on form feeds, and commits `raw.txt` + `pages.json` (with a byte digest) as the audit trail. Every later stage is a pure function of those files, so tests are hermetic and a parser change can be diffed against text that never moved.
*   **Normalization** strips bidi controls and applies NFKC **to Arabic runs only** — applied to the whole string it would rewrite German typography, which would be a silent edit to source text. Umlauts and ß are asserted byte-identical. A visual-order reverser exists and is **off** for this publisher, which verifiably emits logical order.
*   **Nothing is invented.** No English row is created at all (the source prints none). No answer key exists in the booklet, so its three Übungen import **ungradeable** with the reason recorded. No timecodes are printed, so segments carry none. No audio file for this episode is in the repo, so **no asset is registered** and the activity is honestly unplayable while the transcript still teaches.
*   **One derivation, labelled as such:** 11 vocabulary-recall exercises whose prompt is the Arabic gloss and whose expected answer is the German headword — both verbatim from the same page. Marked `sourceType: "derived-from-vocabulary"` so a reviewer can tell them from publisher-written tasks.
*   **Provenance** on every row: document title, publisher, the publisher's own reference URL, and the **printed page number** (`… — dw.com/nico/arabic — Seite 2`), plus `contentStatus: "imported"` — deliberately not `verified`.
*   **Identity is derived**, never allocated: a re-run with a different clock yields identical uuids. Second import = **0 create, 0 update, 189 unchanged**, row counts unchanged.
*   **Source-change safety:** a differing row that is still `imported` updates; a differing row a human marked `verified` becomes a **CONFLICT** that stops the import and prints both texts. `--accept-changes` is required to proceed.
*   **Canonical entities created:** 1 course, 1 CEFR level, 1 unit, 1 lesson, 3 sections, 26 lesson items, 3 curriculum texts, 11 vocabulary items + 11 Arabic meanings + 11 accepted answers, 10 sentences, 1 listening item + 2 speakers + 10 segments + 10 segment texts, 14 exercises + 31 options + 11 targets. **189 rows.**
*   **End-to-end through the real Learn UI:** course → lesson (3 sections, 26 items) → vocabulary → sentences → listening (10 segments, 2 speakers, no audio) → exercise graded by the existing evaluator → error event recorded → lesson completion → resume `course-complete`. English shows as missing throughout.
*   **Suite 844 → 919.**
## Features A–I Reachable in the Running App (IMPLEMENTED, commit `124de14`)
*   A sixth nav destination **«المنهج»** hosts a hub plus eight routes: courses/lessons, grammar, sentences, exercises, listening, pronunciation, error learning, reminders. Feature A's multilingual content appears through these screens rather than as a separate area.
*   **The canonical runtime boots after study and independently of it**, so a content-store failure cannot stop vocabulary revision. `learnerStorageSwitch` stays **false**; the legacy IndexedDB study flow is unchanged.
*   **Real interactions, not stubs:** open a lesson from the outline and mark it complete (writes lesson + section + course progress in one transaction, resume point moves); answer an exercise (graded by the **existing** deterministic evaluator over the exercise layer's own filtered answers); a wrong answer records an error event; a spoken attempt records the learner's own rating; reminder settings persist and reload.
*   **Arabic still cannot score through the UI.** An Arabic-answer exercise arrives ungradeable, is labelled self-checked, returns `correct: null`, and produces no scored mistake.
*   **Empty content is shown honestly.** Each route names what is missing; the browser build states the content store lives in the iPad/iPhone app. No demo data anywhere.
*   **The built-in error taxonomy** (Feature F's own categories) is upserted on first use, because `error_event_categories` has a foreign key onto it. That is the app's taxonomy, not authored course content.
*   Bottom nav moved from a hard-coded 5-column grid to auto columns; the ≥900px side rail flows back into rows explicitly.
*   **Browser smoke test** at 1024×768, 768×1024 and 390×844: all eight routes reachable by clicking, no horizontal overflow, no touch target under 44px, RTL preserved with German isolated LTR, and a study session built (12 cards), entered, exited and survived a tour of the Learn area with the card array byte-identical. Screenshots were unavailable in this environment (browser pane not composited); layout was verified numerically instead.
*   **Suite 815 → 844.**

## Content Intake Pipeline (STARTED)
*   **Verified sources present in the repository:** `03_COURSE_CONTENT/NETZWERK_A1/` (Kursbuch PDF), `NETZWERK_NEU_A2/` (3 PDFs + 189 MP3s), `REFERENCE/Nicos-Weg-A2-E2-L1-Lehrerhandreichung-und-Uebungen.pdf`, `VOCABULARY/Nicos-Weg-A2-E2-L1-Manuskript-und-Wortschatz-Arabisch.pdf`, plus `data/seed-data.js` (2,820 verified German↔Arabic items).
*   **Extraction proven:** `pdftotext -enc UTF-8 -layout` recovers German umlauts AND the Arabic glosses from the Nicos Weg source (`erwachsen – بالغ؛ راشد`). Arabic arrives in presentation forms and needs normalising to logical order — real data, no fabrication required.
*   **Best first sample:** Nicos Weg A2, Episode 2 «Familiengeschichten», Lektion 1 — it carries a course, a lesson, a speaker-labelled transcript (listening), German↔Arabic vocabulary with verb principal parts, page-numbered provenance (`dw.com/nico/arabic`, `Seite 1 / 2`), and a companion exercises booklet. Enough to prove course → lesson → content → exercise end to end **without inventing anything**.
*   **Not yet built:** the pipeline itself, the source registry, and the provenance-preserving importer.
## Canonical Incremental Write Path (IMPLEMENTED, commit `473bd98`)
*   The adapter gained `insert`, `insertAll`, `update`, `upsert`, `softDelete`, `restore`, `hardDelete`, `getByUuid`, `exists`, `find`, `findOne`, `countWhere`, `transaction`. Every one is **entity-scoped**: the entity resolves to a `TABLE_SPEC` and only columns that spec declares are written or filtered on. Unknown field → rejected. Unknown order field → rejected. Every value is **bound**.
*   **`write-policy.js` decides what each entity may do**, so the shape of a repository IS the invariant: append-only history has `insert` and no `update`; anything a learner earned is soft-deleted, never removed; **`review_cards` is refused by the generic surface entirely** and moves only through `srs.applyScheduledCard`.
*   **Upsert conflict targets are derived from the schema's own UNIQUE constraints**, so a constraint and the upsert relying on it cannot drift. An upsert is idempotent for the *thing* (one settings row per profile, one progress row per learner+lesson), not for a reused uuid. Identity and `created_at` survive the update half.
*   `revision`/`updated_at` are advanced by the adapter; `expectedRevision` turns a write into an optimistic-concurrency check that reports a conflict rather than overwriting.
*   **Aggregates are atomic**: sentence+texts+links, course+lessons, lesson+section progress, error event+classifications, scheduled card+review event. Each is driven to failure in tests with nothing surviving. Nested transactions run inline rather than issuing a second `BEGIN`.
*   Both executors now report change counts. Migration round-trips field-for-field and migrated SRS rows are byte-identical after incremental writes happen around them.

## Runtime Composition Root (IMPLEMENTED, commit `d13123f`)
*   **Two independent gates.** `learnerStorageSwitch` stays **false** (SRS history blocked on device validation); `canonicalRuntime` is **true** (the A–I screens may be reached). Conflating them would hold nine finished features hostage to a hardware account.
*   Native + `canonicalNativeStore` gate open → real SQLite canonical store. Web/PWA/gate closed/failed open → **empty source**: real read shape, no writes, honest "nothing authored yet". No second model implementation for the browser.
*   A failed open is **reported, never thrown** — study must survive a broken content store.
*   The root **cannot reach legacy learner storage**: no legacy import, no SRS identifier, and a card proven byte-identical across a full bootstrap plus writes. Reminder due counts arrive as a *number* from a caller-supplied reader.

### Remaining for end-to-end reachability
1.  **`app.js` route wiring** — the composition root is built and tested but no route renders the A–I screens yet. This is the next step.
2.  **Authored content** — every content table is still empty; the screens will render empty states until a content import pipeline exists.
3.  Device gates (learner storage, canonical native store, notifications) remain deferred.
## Feature I — Reminders / Notifications (IMPLEMENTED)
*   **Canonical schema v10**, 57 tables: `reminder_settings` (what the learner asked for) and `reminder_schedule` (what was scheduled, delivered or cancelled). Neither stores a due date, a card, a count of work or any progress — deleting every row changes nothing a learner earned.
*   **A reminder time is wall-clock, not an instant.** `19:30` means half past seven in the learner's own evening, which is a different absolute instant after a flight or a clock change, so only `HH:MM` is stored and the instant is derived at planning time.
*   **DST is handled by deriving the offset twice** — at `now` to find the candidate, then at the candidate itself, because the offset that applies to a future instant is the future one — with a guard so a forward jump never fires the reminder immediately. Tests cover spring-forward, fall-back, a half-hour zone (UTC+4:30) and a negative offset, all with **injected** offsets so nothing depends on the machine's timezone.
*   **Scheduling is pure and device-free.** `planReminders()` takes settings plus plain numbers (`dueCount`, `lastStudiedAt`, `lastDelivered`) and returns a plan. Nothing in `reminder-schedule.js` or `reminder-service.js` can reach a card, an ease, an interval or a progress row — a test greps both modules for those identifiers.
*   **Silence is a feature, and every skip states its reason:** `reminders-disabled`, `permission-<state>`, `kind-disabled`, `already-studied-today`, `below-due-minimum`, `too-soon-after-last`, `invalid-time`. The settings UI shows those reasons, so a quiet reminder reads as a decision rather than a bug.
*   **Rescheduling is a diff**, so a changed time reschedules only that reminder, an unchanged one is left alone (no visible flicker of a pending iOS notification), a switched-off kind is cancelled, and a leftover notification the plan does not recognise is cancelled as stale. Disabling cancels everything pending in one call.
*   **One stable notification id per kind**, so re-syncing replaces rather than piling up duplicates.
*   **No cloud push, no account.** The adapter imports **nothing at all** — it reads the plugin off the global Capacitor bridge exactly as `detectNativePlatform` does — so the PWA build stays dependency-free. A test asserts the module contains no `fcm`/`apns`/`firebase`/`token`/`login`/`http` reference in code.
*   **Gated like native storage was.** `NATIVE_NOTIFICATION_STATUS.learnerSwitchEnabled = false`; `selectNotificationBackend()` returns the no-op adapter on web, when the gate is off, and when the bridge is missing. **Physical-device notification validation stays a deferred RELEASE gate** — a simulator cannot stand in for Focus modes, Scheduled Summary or system rate limiting.
*   **A failing notification call can never break study**: every adapter call degrades to a reported non-result instead of throwing.
*   **Migration creates no reminders** — migrating a learner must not switch on a notification they never asked for. Reminders are opt-in (`enabled: false` by default).
*   **Minimum settings UI:** `<df-reminder-settings>` — enable/disable, per-kind toggles, time fields, due-review minimum, the real permission state (with the prompt offered only while it is still askable), and the plan preview with its reasons. Every control dispatches an event; the component applies nothing itself.
*   **Suite 647 → 729.**
## Feature H — Pronunciation (IMPLEMENTED)
*   **Canonical schema v9**, 55 tables: `pronunciation_features`, `pronunciation_texts` (owner_type/owner_uuid, language as a ROW), `pronunciation_items`, `pronunciation_variants` (IPA, syllables, stress index, regional variety, is_primary), `pronunciation_pairs` (minimal pairs), `pronunciation_links`, `pronunciation_attempts`.
*   **The governing rule: producing speech is SELF-ASSESSED; discriminating sounds is SCOREABLE.** Judging how someone SAID a word needs acoustic recognition, and a wrong verdict there would lapse a card for an accent. Deciding which of two words you HEARD is an ordinary German multiple-choice question and scores through the existing evaluator.
*   **`pronunciation_attempts` has no column for a machine verdict of correctness** — no `correct`, no `scored`, no `quality`. There is `self_rating` (the learner's) and `advisory_score` + `advisory_source` (a recognizer's or model's, always attributed). A field that does not exist cannot later be quietly read as authority. A test asserts the absent columns directly against `TABLE_SPECS`.
*   **`assessSpokenAttempt()` returns `isCorrect: null`, never `false`**, mirroring `evaluateArabicAdvisory`, with `quality: 0` so it contributes nothing to an automatic rating. An advisory score with no named source is recorded but not attributed; a source with no score is dropped.
*   **`pronunciation` was added to the evaluator's single `SELF_ASSESSED_SKILLS` list**, so there is still one source of truth for "the learner reports this". The legacy scheduler still creates only `recall` and `recognition` cards — a test pins that, so no SRS behaviour changed.
*   **Scoring has exactly one route.** `expectedAnswersForPronunciation()` returns `[]` for any production item and otherwise delegates to the exercise layer's own filter, so neither Arabic nor a recognizer's opinion can become correctness by coming in through pronunciation. `gradeabilityOf()` names the reason instead of returning a bare empty list.
*   **Error learning integrates by consequence, not by special case.** A spoken attempt is self-assessed, so the error service classifies it **advisory** on its own and no deterministic pattern can form out of an opinion about an accent. A minimal-pair answer classifies deterministically like any German answer.
*   **Model audio reuses `audio_assets` and the Feature G offline rules unchanged** — no new mechanism. An item with no local recording is still practisable from its authored IPA and syllables: losing the file does not lose the teaching.
*   **Deterministic ordering:** variants sort primary → authored ordering → variety → uuid; a total order, identical on every run and device.
*   **Migration invents no pronunciation.** All seven tables migrate empty. A legacy `pronunciation` hint is **not** promoted to authored IPA, because it is not IPA. SRS fields, course progress, error history and quarantine behaviour are untouched.
*   **Minimum UI:** `<df-pronunciation-card>` shows IPA, stressed syllable, accepted regional realizations, minimal pairs and the model recording, and for a spoken item offers **only the learner's own rating** alongside the statement that the app does not judge pronunciation automatically. An advisory score is shown labelled with its source and never replaces the learner's rating.
*   **Suite 578 → 647.**
## Feature G — Listening (IMPLEMENTED)
*   **Canonical schema v8**, 48 tables. The audio FILE and the listening ACTIVITY are separate entities: `audio_assets` (availability, local_path, source_path, remote_url, mime, bytes, duration, checksum, provenance) and `listening_items` (slug, audio, activity type, level, ordering, lifecycle), plus `listening_texts`, `listening_speakers`, `listening_segments`, `listening_segment_texts`, `listening_links`.
*   **Offline-first is in the schema, not in convention.** `availability` records where the file actually IS — `bundled`, `downloaded`, `source-only`, `remote` — separately from `remote_url`, which is optional source metadata. `playableOffline` is true only for a file on the device, and an activity whose audio is remote is reported `studyable: false` with a named reason rather than quietly requiring a network. The transcript and translations still render when the file is missing: losing the file must not lose the teaching.
*   **Listening does not grade.** There is no listening-specific scoring column anywhere. Comprehension is checked by ordinary exercises linked through `listening_links`, and `expectedAnswersForListening()` delegates to the exercise layer's own `expectedAnswersFor`. A test greps the module to prove it implements no matching, normalisation or verdict of its own — **no second grading engine**.
*   **Arabic still cannot score.** An option authored as expected AND scoreable in Arabic is still excluded when it is reached through a listening activity, because listening applies no rule of its own and the policy filter is the only route to answers.
*   **Segment order is authored, never inferred.** `ordering` decides; `start_ms` only breaks a tie and uuid breaks that, so a mistyped timecode cannot silently rearrange a dialogue. Timecode problems (`ends-before-it-starts`, `past-end-of-audio`, `overlaps-previous`) are **reported to authors, not thrown at learners**.
*   **Lesson and course membership needed no new table**: `lesson_items` already references `(content_type, content_uuid)`, so an activity joins a lesson as `content_type = 'listening'` — the reserved type from Feature E, now in use.
*   **Error-learning integration** goes through `listeningErrorContext()`, which carries no verdict of its own. A German listening mistake becomes a deterministic error event with `content_type: 'listening'`; an Arabic one stays advisory and forms no pattern. Nothing touches SRS scheduling.
*   **Real audio, no fabrication.** `tools/listening/register-audio-assets.mjs` registers files that already exist in this repository (189 Netzwerk neu A2 MP3s, 410 MiB, tracked in git) as deterministic `audio_assets` rows. It creates **no transcript, translation, duration or level** — duration stays 0 until something measures it. Everything it emits is `source-only`: the files are in the authoring repository, **not in the app bundle**. Bundling 410 MiB of publisher audio is a deliberate packaging and licensing decision, left to the user.
*   **Migration invents no listening content.** All seven tables migrate empty; SRS fields, course progress and error history are untouched, and quarantine behaviour is unchanged.
*   **Minimum UI:** `<df-listening-player>` — audio presentation, transcript and both support languages as peers, segment navigation with timecodes and speakers, and the offline state made visible. It renders **no `<audio>` element and no URL at all** when the file is not on the device.
*   **Suite 509 → 578.**
## Feature F — Error Learning (IMPLEMENTED)
*   **Canonical schema v7**, split the same way as Feature E. **Authored taxonomy:** `error_categories` (slug, scope: orthography/morphology/syntax/lexis/usage), `error_category_texts` (name/explanation/advice per language), `error_remediations` (what to study, as `(content_type, content_uuid)`). **Recorded mistakes:** `error_events`, `error_event_categories`, `error_patterns`. 41 tables total.
*   **The service never decides correctness.** It reads the deterministic evaluator's verdict and classifies it. Re-deriving correctness here would create a second grader that could disagree with the first.
*   **A classification is deterministic only if the language could score it.** Arabic answers are evaluated advisorily (the evaluator returns `isCorrect: null` on purpose), so an Arabic mistake is recorded and shown but classified with `source: "advisory"` and excluded from patterns, from the practice queue, and from every count that drives practice. Arabic can teach; it can never grade, and it can never decide what the learner is made to drill.
*   **AI occupies exactly that same advisory tier.** It may add a category with a confidence (clamped to 0..1); nothing that drives practice reads advisory rows.
*   **Error learning suggests, it does not schedule.** Nothing in the module reads or writes `review_cards`; a test greps for SRS identifiers and asserts they are absent, and another asserts a card object is unchanged across classify → record → summarize → practice. Every practice suggestion carries `affectsScheduling: false` **in the data**, not just in the docs.
*   **Near misses are separated from mistakes.** A capitalization or punctuation difference was ACCEPTED as correct, so it is recorded as teachable (`isNearMiss`) and never counted or displayed as an error.
*   **Event identity is deterministic** over (profile, time, content, skill, answer), so replaying a session cannot duplicate an event.
*   **`error_patterns` is a cache, not the truth.** `aggregatePatterns()` rebuilds it from raw events, so a corrupt or missing aggregate is recoverable.
*   **Migration records no errors.** All six tables migrate empty; a past wrong attempt is not reclassified after the fact, because that would be guessing. SRS fields still migrate intact.
*   **Minimum UI:** `<df-error-insights>` renders patterns, counts, status, authored advice, the advisory-only count, and the suggestion list; it dispatches `practice-select` rather than starting anything.
*   **Not yet wired into the running app, deliberately:** recording live error events needs the canonical store to be the learner store. The legacy IndexedDB schema must NOT be extended with the richer model, so the recorders stay pure builders until the native switch.
*   **Suite 453 → 509.**
## Feature E — Lessons / Courses / CEFR Structure (IMPLEMENTED)
*   **Canonical schema v6** adds two deliberately separate groups. **Content:** `courses` (slug, CEFR level, ordering, book source metadata), `course_levels`, `course_units`, `lessons`, `lesson_sections` (kind: intro/vocabulary/grammar/reading/practice/review), `lesson_items`, `lesson_prerequisites`, `curriculum_texts`. **Progress:** `course_progress`, `lesson_progress`, `section_progress`, `cefr_progress`. 35 tables total.
*   **Content and progress never share a table.** A lesson row knows nothing about who studied it; a progress row carries a `profile_uuid` and points at content by uuid. This is what keeps a course shareable and a learner's history private and per-profile.
*   **Course progress does not touch SRS.** Nothing in `curriculum-service.js` reads or writes `review_cards`; a test greps the module for SRS identifiers and asserts they are absent, and another asserts a card object is unchanged across a completion. "I studied this lesson" and "I remember this word" stay separate claims, so a learner can finish a lesson and still owe reviews on its vocabulary.
*   **Lesson items reference `(content_type, content_uuid)`**, so a section mixes vocabulary, sentences, grammar rules and exercises today, and `listening` / `pronunciation` become valid content types later with **no schema change**.
*   **Progress percentages are derived, never stored**, so they cannot drift out of step with the lesson rows they summarize.
*   **Resume is explicit about why**: `stored` (the saved point is still valid), `stored-point-stale` (it was completed, so move on), `first-available`, or `course-complete`.
*   **Prerequisites fail safe.** A lesson requiring a lesson that does not exist stays locked rather than silently unlocking.
*   **English and Arabic are peers** in `curriculum_texts`; a missing title is reported as `coverage.missing` rather than hidden, so "untranslated" is distinguishable from "not applicable".
*   **Netzwerk A1 / Netzwerk neu A2 are representable as course sources** (title, publisher, edition, ISBN) — **no lesson content was authored or imported**.
*   **Migration invents no curriculum.** All twelve curriculum and progress tables migrate empty, and no CEFR placement is guessed from a word's level. A test asserts this while confirming SRS fields still migrate intact.
*   **Minimum UI:** `<df-course-outline>` (course → unit → lesson navigation, progress bar, locked lessons, resume marker; it dispatches `lesson-select` rather than navigating itself) and `<df-lesson-view>` (section and mixed-content assembly). Both read-only, both fed by the service, neither reaches storage.
*   **Suite 399 → 453.**

## Feature D — Exercises (IMPLEMENTED)
*   **Canonical schema v5**: `exercises` (slug, type, level, ordering, `answer_language`, lifecycle), `exercise_texts` (instruction/prompt/hint per language), `exercise_options` (choices and distractors with `is_expected` + `scoreable`), `exercise_targets` (links to vocabulary, sentence, or grammar rule).
*   **The service assembles specs; it never grades.** Deterministic scoring stays in the existing evaluator. `expectedAnswers` is what a grader may compare against.
*   **Arabic can never grade an exercise.** An option's stored `scoreable` flag is re-checked against the language policy during assembly, so an Arabic option authored as expected+scoreable is still excluded from `expectedAnswers` — while remaining visible as a choice. `expectedAnswersFor()` re-filters on the way out, so a caller that mutates the spec cannot bypass it.
*   **`gradeable`** is explicit: an exercise whose answer language cannot score, or which has no scoreable expected answer, is reported as ungradeable with a reason rather than silently grading nothing.
*   **Deterministic ordering.** Options follow authored order by default; shuffling requires an explicit seed (xorshift32). A test replaces `Math.random` with a thrower to prove it is never used, so a session can be reproduced and resumed.
*   Migration leaves all exercise tables empty; the legacy model has no exercises and none are invented.
*   Learner data, SRS scheduler and scoring semantics untouched.

## Feature C — Sentences / Context (IMPLEMENTED)
*   **Canonical schema v4**: `sentences` (German form, normalized form, CEFR level, register, ordering, full content lifecycle) plus `sentence_texts`, `sentence_vocabulary`, `sentence_grammar`, `sentence_tags`.
*   **Support texts keyed by (sentence, language, kind)** — translation, explanation, note. Language is a ROW, matching grammar, so English and Arabic are peers and each can be verified independently.
*   **Many-to-many in both directions**: a sentence can demonstrate several words and illustrate several grammar rules, and neither side owns the other. Links resolve to the real item and report `resolved: false` instead of silently disappearing when data is inconsistent.
*   **Context/domain tags are rows**, not a JSON blob, so they can be queried and curated.
*   **Scoring boundary:** `scoringFormsFor()` returns the German sentence only, and re-checks the language policy on the way out. Arabic and English support texts can never be returned as gradeable, so a future exercise engine cannot accidentally grade a translation.
*   **Migration leaves all sentence tables empty**: the legacy model has sentence-*type* vocabulary rows but no structured sentence entities or translations, and none are invented. Legacy sentence-type words still migrate normally as vocabulary.
*   Minimal UI proof: `<df-sentence-card>` renders an assembled sentence, showing a missing translation as "لم تُترجم بعد" rather than hiding the language.
*   Learner data, SRS scheduler and deterministic scoring untouched.

## Feature B — Grammar as First-Class Structured Content (IMPLEMENTED)
*   **Canonical schema v3**: `grammar_topics` → `grammar_rules` → `grammar_examples`, plus `vocabulary_grammar` linking words to the rules they demonstrate without either owning the other.
*   **`grammar_texts` keys every string by (owner, language, kind), so LANGUAGE IS A ROW, not a column.** That makes English and Arabic peers by construction, lets a language be added with no schema change, and gives each language its own content lifecycle — an Arabic explanation can be verified while its English counterpart is still draft.
*   `grammar-service.js` assembles ordered topics/rules/examples, reports an untranslated language as `null` rather than omitting it (so "not translated" is never confused with "not applicable"), and reports coverage per support language.
*   Grammar grades nothing. Any future grammar exercise must still obtain scoreable answers through the language policy, where Arabic is excluded.
*   Empty after migration by design: the legacy model contains no grammar, and none is invented.

## Gate 5 — iOS Simulator: PASSED (commit `16807f9`)
*   Validated in Codemagic on an iOS Simulator, unsigned, with no Apple Developer account:
    *   Capacitor 8 SPM project generated, `CapacitorCommunitySqlite` linked into the app target, Xcode project compiled.
    *   Native SQLite write/read-back, exact value preservation, PRAGMA round-trip, transaction rollback leaving no partial rows.
    *   Data survived a real process termination and relaunch, proven by a second launch re-reading it — not a same-session read-back.
    *   Real first-launch migration ran the full BACKUP → READ → VALIDATE → TRANSFORM → WRITE → VERIFY → SWITCH sequence in order, with the source left intact, SRS fields preserved exactly, the orphan card quarantined with its lapses and ease, and a sabotaged verification correctly refusing to switch.
    *   Database confirmed at the configured `Library/CapacitorDatabase` location; the production `deutschflowSQLite.db` was never created.
*   **Physical iPhone/iPad validation: DEFERRED — a RELEASE gate, not a failure.** A simulator shares the SQLite implementation but not real device storage pressure, iCloud/iTunes backup-restore behaviour, or OS eviction under low storage. Those must be validated on hardware before any learner is switched.

## Canonical Model: ACTIVE FOR DEVELOPMENT (learner switch still OFF)
*   `CANONICAL_MODEL_STATUS` in `src/platform/bootstrap-persistence.js` records the gate state in code: `developmentActive: true`, `learnerSwitchEnabled: false`.
*   New features are built against the canonical model. **No learner is served from SQLite**: `nativeStorageEnabled` still defaults to false, IndexedDB remains the recovery source, and the CI guard asserting that still runs before any native work.
*   Rollback path preserved unchanged: any migration failure falls back to IndexedDB automatically.

## Feature A — English + Arabic Multilingual Content Model (IMPLEMENTED)
*   **Canonical schema v2**: adds the `translations` table (English, with the same content-lifecycle columns as Arabic meanings) and `accepted_answers.scoreable`. v1 was never activated for learners, so v2 is the first version any learner database will see.
*   **`src/content/languages.js`** is the single source of truth, deliberately separating two questions that are easy to conflate: which languages *teach* (German, English, Arabic) and which may *decide correctness* (German and English only).
*   **Arabic never scores.** Enforced in three places: the migration derives `scoreable` from the policy rather than accepting it from a caller; the content service re-checks the policy when partitioning answers, so a bad import or hand-edited row marked `scoreable=1` still cannot grade; and `assertScoreable()` throws rather than silently degrading.
*   **English and Arabic are peers** in the assembled view — neither nested inside the other, and an entry with only one support language is reported as complete in that language rather than broken.
*   **No English content invented.** The legacy model stores none, so `translations` is empty after a legacy migration by design; a coverage report shows where translation work is genuinely needed.
*   Existing runtime evaluator untouched: SRS scheduler, scoring semantics, and learner data unchanged.

## Option (c) Work — Everything Not Requiring the Native SQLite Switch
Decision recorded: build the richer canonical model ONCE, after Gate 5. The legacy IndexedDB schema is NOT extended with grammar/lessons/CEFR/English content.

*   **Study screen fully migrated** (15 Lit components total): order builder completes it, alongside progress, word panel, question prompt, answer input, answer actions, rating row, feedback, and choice list.
*   **Settings rows** migrated to `df-setting-row` (toggle + number variants).
*   **Stats charts** migrated to `df-skill-bar` and `df-activity-chart`; dead `skillBar()` removed.
*   **Vocabulary list**: `df-word-row`, two-column iPad layout, accessible search/filters.

### Defects found and fixed (each separate from its refactor)
1.  **Statistics tiles rendered NaN** (`ليس رقمًا`) for accuracy and average answer time.
2.  **Session-summary vs audit formatting** — a shared helper would have silently localized raw values and dropped the `+` from the XP tile.
3.  **Focus lost on every render** — typing in vocabulary search dropped focus and reset the caret every 160ms; on iPad/iPhone this dismissed the keyboard mid-search. `render()` now captures and restores focus and selection.
4.  **Dialogs unusable by keyboard** — no focus move on open, no Tab trap, no focus return on close. All three now implemented, plus `aria-labelledby` from the dialog heading.
5.  **PWA did not work offline** — the service worker never wrote to its cache, so the entire module graph missed on every offline request. Runtime caching added; strategy still network-first.

### Performance
*   Card lookups were O(words × cards) on the vocabulary page (per keystroke) and the dashboard summary. Now indexed by word: **14.9ms → 1.8ms** on the real 2820-word deck, zero result differences. Deliberately not cached across renders, because `state.cards` is mutated in place and a stale index would show wrong statuses after studying.

### Accessibility
*   Settings toggles are now `role=switch` with accessible names (previously empty buttons announcing only state); filter chips expose `aria-pressed`; the result count is a polite live region; the skill bar is a real progressbar; the activity chart is a labelled image with a per-day text alternative; search has proper `type=search` semantics and mobile keyboard hints.
*   **All touch targets now meet the 44pt HIG minimum**, verified across every route at phone and tablet sizes. The switch keeps its 48×28 look via an invisible expanded hit area.

## Study/SRS UI Migration (COMPLETE) and Main-Screen Migration
*   All five interactive study controls migrated one at a time, each verified against the study interaction suite and in the browser: **answer input**, **hint**, **reveal**, **rating controls**, plus the **session-end summary** consolidation.
*   Study presentation migrated: **df-study-progress**, **df-word-panel**, **df-question-prompt**, **df-answer-feedback**, **df-choice-list**.
*   Main list migrated: **df-word-row** (renders up to 200x per page).
*   **Light vs shadow DOM rule established:** components containing dispatched controls render in LIGHT DOM, because the app routes every control through one delegated `document` click listener resolving `e.target.closest("[data-action]")`, and because `answer-input` is located via `document.getElementById` and `document.activeElement.id`. A shadow root would silently break typing, focus, Enter-to-submit, and every button. Read-only components use shadow DOM.
*   **SRS untouched:** scheduler unchanged; rating values, labels, and classes preserved exactly. Browser-verified that clicking rating 3 while the engine suggested 4 moved the card reps 0->1, ease 2.5->2.52, interval 1, state review, and logged the attempt at rating 3.
*   Two pre-existing bugs fixed separately from refactors: statistics tiles rendering `ليس رقمًا` (NaN), and the session-summary/audit formatting difference that a shared helper would have silently changed.
*   11 Lit components; `app.js` at 942 lines.

## iPad/iPhone UX Validation (browser-verified)
*   **Touch targets:** every control now meets the 44x44pt Apple HIG minimum (the theme toggle was the only one below it).
*   **Viewport:** `100vh` replaced with `100dvh` (vh fallback first) on page and study layouts, and on modal max-height, so iOS dynamic chrome no longer pushes content out of view.
*   **Virtual keyboard:** at a keyboard-sized 375x380 viewport the answer field is fully visible, the action row reachable, no horizontal overflow; scroll margins keep the field clear of the keyboard.
*   **External keyboard:** Enter-to-submit verified working through the migrated input.
*   **German input:** the answer field carries `lang="de"`; German text is bidi-isolated so it renders correctly inside the RTL page.
*   **Safe areas:** insets applied on all edges for both `.layout` and the full-screen study route.
*   **iPad workspace:** vocabulary list is two columns from tablet landscape (rows 514px instead of a stretched 1030px), study column centred at 920px with a taller prompt card; iPhone stays single column.

## iPad-First App Shell Foundation
*   Additive CSS layer only; existing rules and phone layouts unchanged.
*   iOS safe-area insets now respected on top and both inline edges (bottom was already handled); `viewport-fit=cover` already present.
*   From tablet landscape (>=900px) the bottom pill becomes a vertical side rail with 64px touch targets; phones and tablet portrait keep the existing bottom bar.
*   Logical properties throughout, so RTL places the rail on the correct edge.
*   Verified at iPad landscape 1180x820 (side rail, content clears it by 28px), iPad portrait 820x1180 (bottom bar), iPhone 375x812 (bottom bar, 2-column summary, no horizontal overflow).

## First-Launch Migration Controller (implemented, gated OFF)
*   Sequence enforced: **BACKUP -> READ OLD -> VALIDATE -> TRANSFORM -> WRITE SQLITE -> VERIFY -> SWITCH**.
*   Refuses to start without a durable backup sink. The IndexedDB source is read-only for the whole run and is never cleared, rewritten, or repaired.
*   The target must be empty before writing, so an interrupted or repeated run cannot double-import.
*   ANY failure at ANY stage aborts without switching; the app remains on IndexedDB automatically. The switch flag is written only after verification passes. A failed verify or failed switch clears only the NEW database.
*   Verification compares the read-back field-for-field against the transformed dataset, checks referential integrity, requires identical SRS state, and requires every source word to be accounted for.
*   `bootstrap-persistence.js` composes detection + selection + migration so the fallback is guaranteed by the wiring: on any failure the learner still gets a working IndexedDB store.
*   **Real-scale rehearsal:** the full sequence was run against the real 2026-08-20 export loaded into a throwaway IndexedDB (2811 words / 337 cards / 2528 attempts) and completed with 0 lost cards, 0 SRS mismatches, integrity OK, and the source unchanged. The real export file was only ever read (sha256 unchanged).

## Mobile Foundation (DF-014, verified against official docs 2026-08-21)
*   Capacitor **8.5.0** (core/cli/ios/android); `@capacitor-community/sqlite` **8.1.1** (peer `@capacitor/core >=8.0.0`).
*   Platform requirements: **Xcode 26.0+**, **iOS 15.0** deployment target, **Android Studio Otter 2025.2.1+**, **minSdk 24 / compileSdk 36 / targetSdk 36**, **NodeJS 22+**.
*   `capacitor.config.json`: `webDir` = `01_APPLICATION/CURRENT_APP`; `iosDatabaseLocation` = `Library/CapacitorDatabase`.
*   Encryption OFF on both platforms pending the SQLCipher export-compliance review (DF-010 condition 6).
*   `appId` `com.deutschflow.app` is a PLACEHOLDER to confirm before any store submission.
*   Native platform folders NOT added — `cap add ios` needs macOS + Xcode 26, `cap add android` needs the Android SDK.
*   Known advisory: `uuid@7.0.3` via `@capacitor/cli > xcode`. devDependency build tooling only, never shipped; `npm audit fix --force` would downgrade the Capacitor CLI, so it is deliberately left in place.
*   **Last Completed Task:** Implemented backup/validate/restore/parity comparison (explicit-call, no launch-time side effect) and a read-only migration dry-run, then ran it against the real 2026-08-20 learner export. The dry-run exposed genuine unmapped fields and one orphan SRS card; both were closed by preserving all remaining fields and adding a `migration_quarantine` table so unresolved records are preserved rather than dropped. Regression suite 45 -> 61, all passing. No learner data modified (source export verified byte-identical by sha256 and mtime).

## Real-Data Dry-Run Result (2026-08-21, source: `DeutschFlow-backup-2026-08-20.json`, READ-ONLY)
*   Source: 2811 words / 337 cards / 2528 attempts. Canonical: 2811 items, 2811 meanings, 60 accepted answers, 336 active cards, 2527 events, 2 quarantined.
*   SRS: 0 lost cards, 0 field mismatches, 0 ease values out of bounds.
*   Relationship integrity: clean (no orphan meanings, answers, cards, or events; no duplicate card identity).
*   Isolated SQLite write/read-back: PASS.
*   Unmapped source fields: NONE.
*   Quarantined and preserved: 1 SRS card (`2691:recall`, word deleted by learner) and its 1 attempt.
*   Verdict: no blocking risks; persistence switch APPEARS SAFE (advisory only — the switch itself remains a separate approved step).

## Decision Status
*   **Decision 1 (Packaging):** RESOLVED (APPROVED WITH CONDITION)
*   **Decision 2 (Synchronization):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 3 (Cloud Account):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 4 (AI Grading):** RESOLVED (APPROVED WITH CONDITION AND FUTURE EXTENSION)
*   **Decision 5 (Pronunciation):** RESOLVED (APPROVED WITH STAGED IMPLEMENTATION)
*   **Decision 6 (Notifications):** RESOLVED (APPROVED WITH CONDITION)
*   **Technical Decision 1 (Mobile SQLite):** RESOLVED (APPROVED WITH CONDITIONS)
*   **Technical Decision 2 (Desktop SQLite):** DEFERRED UNTIL DESKTOP PHASE
*   **Technical Decision 3 (UI Framework):** RESOLVED (APPROVED WITH STAGED MIGRATION)
*   **Technical Implementation:** ACTIVE — PHASE 3 COMPLETE / PHASE 4 SAFETY PREPARATION STARTED
*   **Architecture Phase:** COMPLETE (DESIGN & PLANNING ONLY)

## Audit & Design Metrics
*   **current application version:** DeutschFlow Pro RC4 (`pro-rc1-2026-07-25`)
*   **implementation plan files created:**
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_FIRST_IMPLEMENTATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/IMPLEMENTATION_PHASE_GATES.md`
    *   `05_TECHNICAL/DOCUMENTATION/REGRESSION_PROTECTION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/DATA_PRESERVATION_AND_ROLLBACK_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/LIT_INCREMENTAL_MIGRATION_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/MOBILE_PLATFORM_ROLLOUT_PLAN.md`
    *   `05_TECHNICAL/DOCUMENTATION/FIRST_IMPLEMENTATION_TASK.md`
*   **unresolved questions:** None. Implementation plan complete.
*   **last agent:** OpenAI Codex

## Next Approved Action
*   Storage selection seam, migration controller, and bootstrap wiring are DONE and gated OFF. Remaining, in order:
    1.  **USER-ONLY (iOS first):** run `npx cap add ios` on macOS with Xcode 26.0+, then `npx cap sync ios`. Android is explicitly deprioritized for now.
    2.  **Gate 5 on-device verification (iPad/iPhone):** offline launch, native SQLite persistence across app restarts and force-quit, touch study controls, and virtual-keyboard behavior over the answer input.
    3.  **Device-side migration rehearsal:** run the controller on-device with `nativeStorageEnabled` still OFF for the app, verifying the backup sink writes to native storage and the verification stage passes with real data on the device.
    4.  **Live switch (requires approval):** only after 2 and 3 pass, enable `nativeStorageEnabled` and keep IndexedDB as the recovery source until parity is confirmed in production.
*   Before iOS signing/release (NOT blockers for the stages above): confirm the real bundle identifier (currently placeholder `com.deutschflow.app`) and complete the SQLCipher export-compliance review if encryption is to be enabled.
*   Next UI increments (no device needed), in order: migrate the study **question card** presentation (word, pronunciation, meaning, detail pills) — read-only, so still no interaction risk; then the **session-end summary**, which can reuse `<df-stat-tile>`. Answer input, reveal, hint, and rating controls migrate LAST, one at a time, each re-running the study interaction suite.
*   Do NOT switch real learner persistence or delete IndexedDB support until Gate 5 passes.
*   Do NOT start educational-content rewriting. Do NOT big-bang rewrite `app.js`.

## Open Observation (non-blocking)
*   The deployed RC build writes backups with `schemaVersion: 6` plus `appVersion` / `build` / `dbVersion` / `engineVersion`, while `src/app.js` `exportBackup` writes `schemaVersion: 5` without them. The backup module accepts both and preserves the extra metadata, so nothing is at risk; the source/deploy divergence is simply recorded here for a later reconciliation task.

## Learner Journey Reachable On The Web/PWA Target (2026-08-22, commit `34bcf46`)

**What changed, in one sentence:** the curriculum is now reachable by a learner, because the
canonical model got a storage backend that exists outside a packaged native build.

*   **The blocker that was removed.** `resolveCanonicalSource()` returned an EMPTY source for
    every non-native target, so the web and PWA build — the only build anybody can run today —
    showed "nothing authored yet" on all nine Feature A–I screens while a fully imported Nicos
    Weg A2 lesson sat in `tools/intake/artifacts/intake.db`. Reads, writes, services, components
    and routes were all already wired; there was simply no store behind them.
*   **The local canonical store** (`src/platform/memory/`): the SAME schema, write policy,
    repository layer and services over an in-memory adapter. It is a second STORAGE backend, not
    a second model — `canonical-memory-adapter.js` derives DEFAULTs, NOT NULL columns, UNIQUE
    keys and foreign keys from the same DDL SQLite is given, via `columnConstraintsFor()` in
    `write-policy.js`. 21 parity tests drive both adapters through the repositories and compare
    the results, including the real imported lesson field for field.
*   **Content ships with the app.** `tools/intake/export-canonical.mjs` writes the content tables
    to `01_APPLICATION/CURRENT_APP/data/canonical-content.json` (408 rows: 2 courses, 13 lessons,
    11 vocabulary items, 10 sentences, 14 exercises, 1 listening activity, 189 source-only audio
    assets). Learner-owned tables are refused by the exporter, so no one's history can ride along
    in the bundle. The file is precached by `sw.js`.
*   **Learner rows persist locally** in `deutschflow_canonical_local`, a database of its own.
    `PERSISTED_ENTITIES` deliberately EXCLUDES `reviewCards` and `reviewEvents`: SRS history
    stays in `deutschflow_v2` until the device gate passes, and a test asserts the exclusion so
    an accidental addition cannot fork a learner's history in two. **`learnerStorageSwitch`
    remains `false`.**
*   **The lesson screen became a lesson.** `<df-lesson-view>` rendered each item as a raw uuid.
    Items now carry a label resolved by the controller through the services (German word + Arabic
    meaning, the task's instruction, the activity's title) and are buttons that open the exercise,
    listening activity or reading they stand for. The exercise picker names each task instead of
    listing slugs. `learn-courses` also lands on the first course that has something to study, so
    a learner does not open on Netzwerk's twelve registered-but-empty chapters.
*   **Verified in a real browser** (`python -m http.server`, `.claude/launch.json`), not only in
    tests: runtime kind `local`, available and writable; lesson items read
    "مفردة ab|hauen غادر" rather than a uuid; clicking a practice item opens that exercise;
    a wrong answer scores `false` and writes one error event; a right answer scores `true`;
    completing the lesson writes 1 lesson + 1 course + 3 section progress rows; **after a full
    page reload** all of it is still there, content still loads, `reviewCards` is still 0, and
    both IndexedDB databases exist side by side. The legacy SRS study loop still creates a real
    card (recall, ease 2.5) from the same app.

### Genuine remaining product gaps (not worked around, not faked)
1.  **Error learning and SRS review are two islands.** A mistake in the curriculum writes a
    canonical `error_events` row; the SRS reviews the 2,820-word legacy vocabulary in IndexedDB.
    Joining them means writing canonical vocabulary into learner storage, which is exactly what
    `learnerStorageSwitch` gates. Both steps of the journey work; the arrow between them does not
    exist yet, and building it before the device gate would be the merge the gate exists to stop.
2.  **No pronunciation content exists.** `learn-pronunciation` renders an honest empty state.
    The service, component, write path and self-rating flow are all wired and tested; nothing has
    been authored or imported for any course.
3.  **No grammar content exists,** for the same reason.
4.  **No audio is playable.** Nicos Weg audio was never downloaded; the 189 Netzwerk MP3s are
    registered `source-only` by explicit rights decision. The listening screen says so and shows
    the transcript.
5.  **Netzwerk's twelve chapters carry no teachable content** — structure only, by rights
    decision. They are listed and openable but are never the landing course.
6.  **Service-worker offline could not be verified locally**: `register-sw.js` registers only on
    `https:`, so the local http preview never installs it. The precache list is unit-tested and
    now includes the dataset; on-device offline remains part of Gate 5.

## First Open-Licensed Lesson Imported, With A Review Gate (2026-08-22)

**Source:** Deutsch im Blick and Grimm Grammar, Dr. Zsuzsanna Abrams, COERLL, The University
of Texas at Austin, CC BY 4.0; adapted by DeutschFlow. Artifact:
`00_PROJECT_CONTROL/A2_OPEN_CONTENT_FIRST_IMPORT.json` (Codex commit `2f18fb2`, cherry-picked).

### The review gate, and why it is `draft`
Codex flagged that an educator still has to review the original German and Arabic. The
schema already had the word for that: 24 content tables declare
`content_status TEXT NOT NULL DEFAULT 'draft'`, giving `draft → imported → verified`.
Nothing had ever enforced the first step — a draft row read back exactly like a published
one — so `src/content/publication.js` now provides one published-only view of the canonical
source, and `createServices()` hands it to all nine services at once. No new lifecycle, no
new column, no per-service filter to forget.

`tools/intake/map-open-content.js` assigns the status from the artifact's OWN markers
(`languageOrigins`, `originalAdaptedStatus`) rather than by judgement:

*   **Published (91 rows):** text the artifact declares `source-adapted` or
    `source-corrected-and-lightly-adapted` — 19 vocabulary items, 5 transcribed sentences,
    the listening activity with its German and English transcript, course/unit/lesson/
    section structure, and 4 exercises.
*   **Held as draft (129 rows):** every original DeutschFlow body — 19 Arabic meanings with
    their original German definitions, 19 English translations that hang off them, 7
    sentences whose German DeutschFlow wrote, all 19 Arabic sentence texts, the whole
    Perfekt grammar topic (1 topic, 2 rules, 7 examples, 15 texts), 16 exercise texts, 8
    Arabic structure titles, and 12 Arabic listening texts.
*   **Withheld links (109):** a lesson item, accepted answer, option or link has no status
    column of its own, so one pointing at unpublished content is not written at all. A
    later import creates it once its target is promoted.

An exercise is published only when **every expected answer equals a published vocabulary
form from the same batch** — a property the adapter verifies rather than accepts. Four pass
(`parents`, `gift`, `invite`, `wedding`); the four Perfekt exercises answer to a grammar
rule that is still a draft, so they wait with it.

**Nothing unreviewed reaches a device.** `verifyImport` now checks both halves on every
import — each draft row IS stored (it cannot be reviewed if it was never imported) and is
invisible through the published view — and `export-canonical.mjs` ships published rows only,
using the same `isPublished` predicate, so the file and the screens cannot disagree.

### Media
The COERLL MP4 is registered as `availability: "remote"`, `localPath: ""`,
`checksum: null`, `durationMs: 0`, `byteSize: 0`. Validation REFUSES the artifact if any of
those is invented. `isPlayableOffline()` is false and the listening screen reports
`remote-only`. No binary is bundled.

### Intake path extended, not duplicated
`tools/intake/import.js` now flattens, plans, prunes, writes and verifies grammar topics/
rules/examples/texts, sentence-vocabulary and sentence-grammar links, and listening links —
the existing stages, extended for existing schema entities and existing aggregate writers.
Two corrections fell out of it: `classifyRow` treated a stored `draft` as a conflict (it is
unreviewed, not signed off, so it is updatable), and the derived `normalized*` columns were
briefly in the meaningful set, where they reported a change whenever a mapper left them to
the column default.

### Verified in a real browser
Course list shows `deutschflow-open-a2` with its COERLL attribution; the lesson opens with
29 items (19 vocabulary, 5 sentences, 4 exercises, 1 listening); a wrong answer scores
`false` deterministically and writes one error event; the right answer scores `true`;
completing the lesson writes course and lesson progress; after a full reload progress and
error history survive, `review_cards` is still 0, and the device holds 0 grammar topics
because the drafts were never shipped.

### Remaining, and what unblocks it
1.  **A German/Arabic educator review** is the only thing standing between the 129 draft
    rows and a learner. Promoting them is a status change plus a re-import; the withheld
    links are recreated by the same run. Until then the open lesson teaches 19 German words
    without their Arabic gloss, 5 sentences, and 4 exercises.
2.  **The editorial A2 label** is DeutschFlow's, recorded as
    `EDITORIAL_A2_ASSIGNMENT` with `noSourceLevelClaim: true`. It needs pedagogical sign-off
    before it can be presented as CEFR alignment.
3.  **The media URL is metadata only** — reachability, checksum, duration, codec and
    redistribution rights are deliberately unresolved.
4.  **No promotion tool exists yet.** Moving a row from `draft` to `imported` currently means
    editing the artifact and re-importing. A reviewer-facing path is the natural next task.

## Open-Licensed A2 Lesson 02 Preparation (2026-08-22)

*   Documentation/content branch `codex/a2-open-content-lesson-02` adds an implementation-ready second lesson, **Reisen planen und von Reisen erzählen**, from official COERLL Deutsch im Blick Kapitel 6 and Grimm Grammar sources under CC BY 4.0.
*   The artifact contains 20 vocabulary items, 12 sentences, 1 grammar topic / 2 rules, 8 deterministic exercises, and a 4-segment interview with remote-only media metadata. Original/adapted German and Arabic remain explicitly educator-review pending.
*   Validation: 53 unique high-level records, 358 schema-compatible canonical rows, 395 resolved UUID references, zero lesson-1 vocabulary overlap, and exactly 5 byte-identical shared course rows. No learner/SRS/runtime data or application code was modified.
*   Next step after merging the content branch: ingest through the same open-content adapter as lesson 1, preview before apply, verify 353 creates plus 5 unchanged rows when lesson 1 is present, then require a 358-row no-op second import.
