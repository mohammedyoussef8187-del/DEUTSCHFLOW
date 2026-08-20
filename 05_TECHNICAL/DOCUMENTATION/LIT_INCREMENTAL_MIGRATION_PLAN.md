# Lit Incremental Migration Plan (LIT_INCREMENTAL_MIGRATION_PLAN.md)

This document details the proof-of-architecture strategy, architectural boundaries, and ordered screen migration plan for introducing Lit Web Components into DeutschFlow.

---

## 1. Proof-of-Architecture Strategy

To prevent big-bang rewrite risks, Lit infrastructure is introduced with a single, low-risk, isolated UI component: **`df-status-pill`**.

```
┌────────────────────────────────────────────────────────┐
│               Proof of Architecture                    │
│                 `<df-status-pill>`                     │
├────────────────────────────────────────────────────────┤
│ • Validates Lit runtime packaging & bundling (~5KB)    │
│ • Renders mastery status badge (New/Learning/Mastered) │
│ • Receives properties via standard HTML attributes     │
│ • Emits custom DOM events on tap                       │
│ • Zero state mutations or database calls               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Migration Roadmap

UI migration follows a strict risk-graded sequence. Higher-risk study views are converted only after isolated components pass regression checks:

```
Step 1: df-status-pill (LOW RISK)
   │
   ▼
Step 2: df-settings-modal (LOW RISK)
   │
   ▼
Step 3: df-vocab-card (MEDIUM RISK)
   │
   ▼
Step 4: df-answer-input & df-feedback (MEDIUM RISK)
   │
   ▼
Step 5: df-study-session & df-review-queue (HIGH RISK)
```

| Step | Component Name | Responsibility | Risk | Required Pre-conditions | Rollback Strategy |
|---|---|---|---|---|---|
| **1** | `df-status-pill` | Renders status badges. | LOW | Phase 5 Lit setup | Revert to standard `<span>` |
| **2** | `df-settings-modal` | Renders settings controls. | LOW | Step 1 verified | Revert to standard `<dialog>` |
| **3** | `df-vocab-card` | Displays German entry, gender, plural, Arabic notes. | MEDIUM | Step 2 verified | Revert to legacy template card |
| **4** | `df-answer-input` | Handles user typing, German keyboard helpers (`ä`, `ö`, `ß`). | MEDIUM | Step 3 verified | Revert to standard `<input>` |
| **5** | `df-study-session` | Orchestrates active review session views. | HIGH | Step 4 verified & Gate 4 | Revert to legacy `app.js` render loop |

---

## 3. Strict Component Isolation Rules

1.  **Presentation Only:** Lit components handle only HTML rendering, CSS styling, and user gesture events.
2.  **No Core Logic:** Lit components must NOT contain SRS rating formulas, Levenshtein distance calculations, or answer evaluation logic.
3.  **No Storage Access:** Lit components must NEVER import or call database repositories (`data/`), SQLite plugins (`@capacitor-community/sqlite`), or IndexedDB drivers directly.
4.  **Unidirectional Data Flow:** Properties (`@property`) flow down into Lit components; custom events (`CustomEvent`) bubble up to Application Services.

```
       ┌────────────────────────┐
       │   Application Service   │
       │   (e.g., StudySession) │
       └───────────┬────────────┘
                   │ Pass Data (Properties)
                   ▼
       ┌────────────────────────┐
       │    Lit Component UI    │
       │  (`<df-vocab-card>`)   │
       └───────────┬────────────┘
                   │ Emit Custom Event (`df-answer-submitted`)
                   ▼
       ┌────────────────────────┐
       │   Application Service   │
       │   (Grades answer, SRS) │
       └────────────────────────┘
```
