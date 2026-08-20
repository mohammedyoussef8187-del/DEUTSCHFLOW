# Current Learning Capability Matrix (CURRENT_LEARNING_CAPABILITY_MATRIX.md)

This matrix compares the educational capabilities of the current DeutschFlow application against target German Learning System requirements.

---

## 1. Learning Capability Matrix

| Area | Capability | Current Status | Evidence | Classification | Impact | Priority |
|---|---|---|---|---|---|---|
| **Vocabulary** | Active Recall (Arabic -> German) | **IMPLEMENTED** | `validateGermanAnswer` typed spelling check in `app.js`. | Verified Current Capability | High educational value. Enforces spelling retention. | P0 |
| **Vocabulary** | Recognition (German -> Arabic) | **IMPLEMENTED** | `validateArabicAnswer` typed meaning check in `app.js`. | Verified Current Capability | Tests vocabulary recognition. | P1 |
| **Vocabulary** | Synonyms and Context | **PARTIALLY IMPLEMENTED** | `acceptedAnswers` and `acceptedArabicAnswers` fields exist in edit modal. | Product / Learning Gap | Manual alternatives only; no structural sense grouping. | P2 |
| **Grammar** | Case Training (Nom/Acc/Dat/Gen) | **NOT IMPLEMENTED** | No logic or data structures for cases exist in `app.js`. | Product / Learning Gap | Major pedagogical gap. User cannot learn German cases. | P1 |
| **Grammar** | Conjugation & Tenses | **NOT IMPLEMENTED** | Verb conjugation exercises or tables are absent. | Product / Learning Gap | User cannot study verb conjugations. | P1 |
| **Grammar** | Adjective Endings | **NOT IMPLEMENTED** | No logic for adjective endings is implemented. | Product / Learning Gap | Critical German grammar area is missing. | P2 |
| **Listening** | Listening Exercises | **NOT IMPLEMENTED** | No audio playing capabilities exist. | Product / Learning Gap | User cannot train auditory recognition. | P1 |
| **Speaking** | Pronunciation Feedback | **NOT IMPLEMENTED** | No voice inputs or speech-to-text validation exists. | Product / Learning Gap | User cannot practice speaking or pronunciation. | P3 |
| **Course** | CEFR Level Progression | **PARTIALLY IMPLEMENTED** | Words have `level` field, but no unlock logic exists. | Product / Learning Gap | No structured learning path. Words are studied randomly. | P1 |
| **Course** | Book / Lesson Structure | **NOT IMPLEMENTED** | No chapters, units, or lesson-unlock flows exist. | Product / Learning Gap | Cannot structure course around Netzwerk books. | P1 |
| **Sentences** | Word Order / Syntax | **PARTIALLY IMPLEMENTED** | Scrambled sentence tokens ordering is coded but disabled. | Product / Learning Gap | Sentence practice is blocked in default Hard mode. | P2 |
| **Multi-Lang** | English Language Support | **NOT IMPLEMENTED** | English field does not exist in vocabulary database. | Product / Learning Gap | Violates principle of equal Arabic/English pedagogical weight. | P1 |

---

## 2. Gap Explanations and Rationale

### Grammar Integration
*   **Gap:** Currently, grammar is absent. The decision log `[DF-003]` requires a model-driven, interactive grammar learning system rather than static text.
*   **Implication:** A structured data schema for grammar models (rules, conjugations, declensions) must be planned in the database.

### English-Arabic Pedagogical Equality
*   **Gap:** The legacy system is purely German-to-Arabic. German-to-English translations are completely missing.
*   **Implication:** The database schema must be upgraded to support `english` and `englishAlternatives` fields. A new `recall_english` card skill must be introduced to participate in scoring, while Arabic grading must be decoupled from the scoring math to serve as explanations.

### Audio Integration
*   **Gap:** Audio is currently not implemented.
*   **Implication:** Audio path fields must be added to the word entity schema, and a playback engine (integrating Netzwerk Neu A2 media) must be implemented.
