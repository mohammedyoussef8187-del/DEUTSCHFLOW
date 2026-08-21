# CODEX HANDOFF — Netzwerk neu A2 Official Source Research

> **Scope of this handover:** external source research only. Codex does not write code.
> Claude remains the primary implementation agent.
> Every fact below was read from the repository or its audit artifacts on 2026-08-21.

---

## 1. PROJECT / BRANCH STATE

| Field | Value |
|---|---|
| Project | **DeutschFlow** — German learning app (German target; Arabic + English support) |
| Canonical root | `C:\ENGINEERING AI KNOWLEDGE BASE\EDUCATIONAL_COURSES\GERMAN_LANGUAGE\DEUTSCHFLOW` |
| Remote | `https://github.com/mohammedyoussef8187-del/DEUTSCHFLOW.git` |
| Active branch | **`mobile-foundation`** |
| Merge policy | **Do NOT merge to `main`.** |
| Latest commit | **`3fd6d8d`** — *feat: inventory Netzwerk sources, register its audio, refuse its PDFs* |
| Canonical schema version | **v10** (57 tables) |
| Tests | **979 passing / 979**, 63 test files |
| `learnerStorageSwitch` | **`false`** — learner SRS data stays in legacy IndexedDB |
| `canonicalRuntime` | **`true`** — the Feature A–I screens are reachable in the app |
| `canonicalNativeStore` | `false` — opening the canonical store on device is still gated |
| `nativeNotifications` | `false` — local notifications still gated |
| Physical iPhone/iPad validation | **Deferred release gate** (`physicalDeviceGate: "deferred-release-gate"`). The iOS **Simulator** gate passed on commit `16807f9`. |

---

## 2. PRODUCT RULES CODEX MUST KNOW

These are fixed and non-negotiable. They constrain what research findings are usable.

1. **German is the target language.**
2. **English and Arabic have equal educational importance.**
3. **Arabic NEVER affects scored-answer correctness.** It teaches; it never grades.
4. **German and English may participate in deterministic scoring** where explicitly supported.
5. **Deterministic scoring and the SRS scheduler are authoritative.**
6. **AI is advisory only** — it may suggest, never decide correctness.
7. **Offline-first.** Study must work with no network.
8. **iPad-first, iPhone-second.**
9. **Android and Desktop are deferred.**
10. **Existing learner/SRS data must never be altered by this research task.** Codex writes no
    data at all.

---

## 3. IMPLEMENTATION STATUS (what already exists)

- **Features A–I are complete architecturally**: multilingual content, grammar, sentences,
  exercises, courses/lessons/CEFR, error learning, listening, pronunciation, reminders.
- **Features A–I are routed and reachable through the real learner UI** — a sixth nav
  destination «المنهج» with a hub plus eight routes.
- **Canonical incremental write path is complete**: entity-scoped insert/update/upsert/
  soft-delete/find, per-entity write policy, and a dedicated SRS-only write path.
- **Runtime composition root is complete**: one place resolves the canonical source and
  builds all nine services.
- **The intake pipeline exists and is proven**:

  ```
  EXTRACT → NORMALIZE → PARSE → VALIDATE → MAP → PREVIEW/DIFF → IMPORT → VERIFY
  ```

- Imports are **transactional, deterministic, idempotent and provenance-aware**.
  Identity is derived from source keys, never allocated from a clock.
- **Claude owns all parser and application code.**

---

## 4. NICOS WEG STATUS

- **Imported successfully:** Nicos Weg A2 → Episode 2 → «Familiengeschichten» → Lektion 1.
- **Exact source files used** (both already in the repository):

  | File | Pages used | Extraction digest |
  |---|---|---|
  | `03_COURSE_CONTENT/VOCABULARY/Nicos-Weg-A2-E2-L1-Manuskript-und-Wortschatz-Arabisch.pdf` | 1–2 | `5dfbd5938e5fe263` |
  | `03_COURSE_CONTENT/REFERENCE/Nicos-Weg-A2-E2-L1-Lehrerhandreichung-und-Uebungen.pdf` | 2–4 | `1a6d1e848735a726` |

- **Imported entity summary (189 rows):**

  | Entity | Count |
  |---|---|
  | courses | 1 |
  | course_units | 1 |
  | lessons | 1 |
  | lesson_sections | 3 |
  | lesson_items | 26 |
  | curriculum_texts | 3 |
  | vocabulary_items | 11 |
  | vocabulary_meanings (Arabic) | 11 |
  | **translations (English)** | **0** |
  | accepted_answers | 11 |
  | sentences (dialogue turns) | 10 |
  | listening_items | 1 |
  | listening_speakers | 2 |
  | listening_segments | 10 |
  | exercises | 14 (3 from the booklet, ungradeable; 11 derived, gradeable) |
  | exercise_options | 31 |
  | exercise_targets | 11 |

- **Missing English is intentionally stored as absent.** The Deutsche Welle handout prints
  no English at all, so **no translation row was created** and the UI reports English as
  missing. This is deliberate, not a defect.
- **Re-import is idempotent:** second run plans **0 create / 0 update / 189 unchanged**;
  all 11 vocabulary items are reused, none rewritten.
- **Codex must not change existing Nicos content.**
- **Nicos intake is complete for the currently available local corpus.** Only the E2/L1
  handouts exist locally; there is no second Nicos lesson to import.

---

## 5. NETZWERK / NETZWERK NEU LOCAL SOURCE INVENTORY

Source of truth: `tools/intake/artifacts/netzwerk-inventory.json`.

### PDFs

| File | Edition | Level | Component | Pages | Chars | Chars/page | OCR suspect rate | Text-layer verdict |
|---|---|---|---|---|---|---|---|---|
| `03_COURSE_CONTENT/NETZWERK_A1/Netzwerk Neu A1 - Kursbuch.pdf` | neu | A1 | Kursbuch | 177 | 319 | **1.8** | 0 | `sparse` |
| `03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 KB.pdf` | neu | A2 | Kursbuch | 181 | 0 | **0** | 0 | `absent` |
| `03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 Kursbuch.pdf` | neu | A2 | Kursbuch | 180 | 0 | **0** | 0 | `absent` |
| `03_COURSE_CONTENT/NETZWERK_NEU_A2/Netzwerk neu A2 UB.pdf` | neu | A2 | Übungsbuch | 203 | 8 871 | **43.7** | **0.0214** | `sparse` |

### SHA-256 (full)

```
05bdd22869920e4118fb267d6ffc07b1599857a4e00d6c81bb1b5907f850e5c5  Netzwerk Neu A1 - Kursbuch.pdf
4f4e95787304f4369df2861359f7039b6c4aa12494e61f0bf4cc36a835fe8b21  Netzwerk neu A2 KB.pdf
f9eb63a6da62d4884e816c6c34564377733bd7eceb32ba84455479d1840810dc  Netzwerk neu A2 Kursbuch.pdf
f03893c91a08477b1141eb9173c3480b5c1cc7659416a20c50476081466b2df1  Netzwerk neu A2 UB.pdf
```

### Audio

- **189 MP3 files** under `03_COURSE_CONTENT/NETZWERK_NEU_A2/AUDIO/`.

### Duplicate rules (important)

- **The two A2 Kursbuch files are DIFFERENT by SHA-256** (`4f4e9578…` vs `f9eb63a6…`).
  Their sizes differ by ~0.5% (59 080 275 vs 58 771 601 bytes).
- **They must NOT be treated as duplicates based on size.**
- **Exact duplicate detection uses SHA-256 only.** Across the whole corpus:
  **0 exact duplicates**.
- **A2 is currently the richest local source set**: two Kursbuch scans + Übungsbuch +
  189 audio tracks, versus A1 which has a Kursbuch scan and no audio.

---

## 6. CURRENT NETZWERK BLOCKER

- **Both A2 Kursbuch scans have no usable text layer at all** — 181 and 180 pages at
  **0 characters per page**. They are pictures of a book.
- **The A1 Kursbuch is effectively the same** — 177 pages at 1.8 characters per page.
- **The A2 Übungsbuch has an OCR text layer, and it is degraded**: 43.7 characters per
  page with a **2.14% suspect-pattern rate**, containing real German corruption.
- **Claude intentionally refused to parse the corrupted OCR.** Storing it would put
  misspelled German in front of learners as verified vocabulary.
- **A text-layer quality gate is implemented** (`tools/intake/text-layer.js`): it
  classifies every document `digital` / `sparse` / `ocr-degraded` / `absent` **before**
  any parsing, from characters-per-page plus German-specific OCR fingerprints. It is
  deterministic and it never repairs text.
- **No Netzwerk parser was written**, because the source text cannot be trusted.
  Recorded status: `parserStatus: "not-written-no-readable-source"`.
- **0 Netzwerk lesson content imported.**
- **Existing Nicos Weg content remains intact.**

### Examples of the OCR corruption found (verbatim from the Übungsbuch text layer)

| OCR output | Correct German |
|---|---|
| `Stefanie Dcngler` | Stefanie **Dengler** |
| `Annerose Rcmus` | Annerose **Remus** |
| `Losungen` | **Lösungen** |
| `Tesrheft` | **Testheft** |
| `Klctt-Augmented-App` | **Klett**-Augmented-App |
| `Meyle ♦ Muller GmbH • Co. KG` | Meyle **&** **Müller** GmbH **&** Co. KG |
| `© Emst Klett` | © **Ernst** Klett |
| `Apple urxl das A^pleLogo sind Matken` | Apple **und** das **Apple-Logo** sind **Marken** |
| `Goo^e Play`, `Markender Googfe lnc_` | **Google** Play, Marken der **Google Inc.** |
| `Deutsch A2Tell1`, `Zertifikat A2Te\\ 2` | Deutsch A2 **Teil 1**, Zertifikat A2 **Teil 2** |
| `Code Audios zu Kapitel 7-12: NWn?kL?` | an access code that cannot be trusted |

The failure mode is systematic scanner confusion (`e↔c`, `ü↔u`, `n↔r`, `tt↔ct`) plus lost
symbols. It cannot be fixed by better parsing, because the characters are already wrong in
the source. Repairing it would mean guessing what the page said.

---

## 7. AUDIO STATUS

- **189 MP3 files discovered.**
- **189 SHA-256 identities registered** as canonical `audio_assets`.
- **0 exact duplicates** (all 189 digests distinct).
- **3 complete audio groups discovered:**

  | Group | Tracks | Range | Gaps inside range |
  |---|---|---|---|
  | A2 · Kursbuch · disc 1 | 63 | 001–063 | 0 |
  | A2 · Kursbuch · disc 2 | 59 | 001–059 | 0 |
  | A2 · Übungsbuch · disc 1 | 67 | **002–068** | 0 |

  *(Übungsbuch numbering begins at track 002; track 001 is not present locally. There are
  no gaps within the observed range.)*

- **All are currently `source-only`** — present in the authoring repository, **not** in the
  app bundle, not playable, `durationMs: 0` (never guessed).
- **0 tracks mapped to lessons.**
- **The filename convention reliably gives** `level / book / disc / track`:
  `NWn_<LEVEL>_<KB|UeB>_Audio_<DISC>-<TRACK>.mp3`.
- **It does NOT reliably give lesson mapping.** The track-to-lesson index is printed inside
  the Kursbuch, which has no readable text layer.
- **Codex must never infer lesson mapping by order, duration, file size or proximity.**
  A wrong mapping would play the wrong recording under the right transcript.
- **Deterministic official publisher evidence is required** — an audio index, a track list,
  or an explicit per-exercise reference.

---

## 8. WHAT CODEX IS BEING ASKED TO DO

**OFFICIAL SOURCE RESEARCH ONLY.**

Research official Ernst Klett Sprachen / Allango sources for **Netzwerk neu A2** that can
safely support the existing intake pipeline. Look for:

- Kapitel (chapter) structure
- official lesson references
- Kursbuch / Übungsbuch task references
- vocabulary material
- grammar material
- exercises
- official solutions (Lösungen)
- transcripts (Transkripte)
- audio indexes / track mappings
- downloadable digital materials
- which material is public versus licensed

Priority question to answer: **is there a digital-text (born-PDF, not scanned) edition, or
an official Lösungen/Transkripte/audio-index download, that would let the pipeline import
Netzwerk neu A2 honestly?**

The Übungsbuch's own imprint points at `klett-sprachen.de/netzwerk-neu` for
*"Lösungen, Transkripte usw. zum Download"* and at
`klett-sprachen.de/netzwerk-neu/medienA2` for audio downloads. Those are the first leads.

---

## 9. ALLOWED SOURCES

Use only legitimate official publisher sources, such as:

- `klett-sprachen.de`
- `hilfe.klett-sprachen.de`
- `einstufungstests.klett-sprachen.de`
- `allango.net` — when legitimately accessible

Prohibited:

- **No third-party mirrors.**
- **No pirated copies.**
- **No reconstruction from corrupted OCR.**
- **No bypassing authentication, paywalls or licence controls.**

---

## 10. RESEARCH OUTPUT REQUIRED FROM CODEX

Codex must create:

```
00_PROJECT_CONTROL/NETZWERK_NEU_A2_OFFICIAL_SOURCE_AUDIT.md
```

It must contain:

- official sources discovered
- Kapitel coverage
- exact URLs
- public / importable content
- licensed / inaccessible content
- solutions and transcripts availability
- exact exercise and page references
- proven audio mappings
- unresolved audio mappings
- recommended first Kapitel for Claude to implement against
- exact URLs / files Claude should consume

---

## 11. STRICT ROLE BOUNDARY

**CODEX:**
- research
- verify sources
- document findings

**CLAUDE:**
- parser implementation
- canonical mapping
- database writes
- application code
- tests
- commits

**Codex must NOT modify:**
- application code
- schema
- migration logic
- SRS
- learner data
- existing intake parsers

---

## 12. CURRENT NEXT STEP

**NEXT OWNER:** Codex
**NEXT TASK:** Official Netzwerk neu A2 source discovery and audio-index research.
**RETURN OWNER AFTER RESEARCH:** Claude
