# Regression Protection Plan (REGRESSION_PROTECTION_PLAN.md)

This document details the characterization test strategy, safety net design, and golden dataset specification required before refactoring the DeutschFlow codebase.

---

## 1. Safety Net Scope & Critical Behaviors

Before modularizing `app.js`, automated unit and integration tests must characterize the following core behaviors:

```
┌────────────────────────────────────────────────────────┐
│               Linguistic Normalization                 │
│ (normalizeGerman, normalizeArabic, Levenshtein typos)  │
├────────────────────────────────────────────────────────┤
│               Answer Evaluation Engine                 │
│ (validateGermanAnswer: casing, punctuation, articles)  │
├────────────────────────────────────────────────────────┤
│                 SRS Interval Mathematics               │
│   (ease bounds [1.3, 3.2], due date calculations)      │
├────────────────────────────────────────────────────────┤
│                Card State Transitions                  │
│       (new -> learning -> review -> mastered)          │
├────────────────────────────────────────────────────────┤
│               Backup & Restore Serializer              │
│       (JSON export/import verification, schema check)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Characterization Test Suite Structure

Test suites run in standard Node via **Vitest**, targeting exported pure functions without DOM dependencies:

```
tests/
├── unit/
│   ├── normalizers.test.js      # German & Arabic text normalization
│   ├── evaluator.test.js        # Answer validation & Levenshtein typo thresholds
│   └── srs_math.test.js         # Spaced repetition interval & ease formulas
├── integration/
│   ├── backup_restore.test.js   # JSON backup serialization & restore fidelity
│   └── card_state.test.js       # Card state machine transitions
└── fixtures/
    └── golden_vocab_dataset.json # Reference test fixture with edge cases
```

---

## 3. Golden Dataset Specification (`golden_vocab_dataset.json`)

The golden dataset fixture contains representative entries and edge cases extracted from seed data and legacy audit findings:

```json
{
  "vocabulary": [
    {
      "id": 1,
      "german": "Haus",
      "article": "das",
      "plural": "Häuser",
      "arabic": "بيت",
      "acceptedAnswers": ["das Haus", "Haus", "das haus"],
      "itemType": "noun",
      "level": "A1"
    },
    {
      "id": 2,
      "german": "fahren",
      "article": null,
      "plural": null,
      "arabic": "قاد / سافر",
      "acceptedAnswers": ["fahren", "to drive", "to travel"],
      "itemType": "word",
      "level": "A2"
    },
    {
      "id": 3,
      "german": "groß",
      "article": null,
      "plural": null,
      "arabic": "كبير",
      "acceptedAnswers": ["gross", "groß"],
      "itemType": "word",
      "level": "A1"
    }
  ],
  "cards": [
    {
      "key": "1:recall",
      "wordId": 1,
      "skill": "recall",
      "state": "review",
      "dueAt": 1771497600000,
      "intervalDays": 3.5,
      "ease": 2.5,
      "reps": 2,
      "lapses": 0,
      "streak": 2,
      "mastery": 50
    }
  ]
}
```

---

## 4. Execution Workflow

1.  **Test Run Command:** `npm test`
2.  **Pass Condition:** 100% of assertion checks pass.
3.  **Refactoring Guardrail:** During app.js decomposition, `npm test` must run after every extracted module. Any assertion mismatch halts refactoring immediately.
