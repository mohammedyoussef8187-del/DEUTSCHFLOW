# Instructions for Claude: End-to-End Learner Journey Test Harness

## Overview

An automated end-to-end learner journey harness has been built in:
* **Harness Helper / Fixture:** [`tests/support/learner-journey-harness.js`](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/EDUCATIONAL_COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/tests/support/learner-journey-harness.js)
* **Integration Test Suite:** [`tests/integration/learner-journey-e2e.test.js`](file:///C:/ENGINEERING%20AI%20KNOWLEDGE%20BASE/EDUCATIONAL_COURSES/GERMAN_LANGUAGE/DEUTSCHFLOW/tests/integration/learner-journey-e2e.test.js)

## How to Run

### Run only the Learner Journey E2E suite:
```bash
npx vitest run tests/integration/learner-journey-e2e.test.js
```

### Run the full test suite:
```bash
npm test
```

## Journey Stages Covered

1. **`App bootstrap`**: Runtime initialization with SQLite storage backend.
2. **`Course & Lesson availability`**: Discovery using real Nicos Weg A2 intake verified content.
3. **`Open lesson`**: Navigation and section presentation.
4. **`Exercise presented`**: Gradeable exercise selection and choice/input rendering.
5. **`Submit answer`**: Evaluator execution.
6. **`Deterministic score`**: German exact matching vs Arabic advisory matching.
7. **`Error recorded`**: Deterministic wrong answer logs to `error_events` with categorized taxonomy links.
8. **`Lesson completed & progress persisted`**: Writes to `lesson_progress` and `course_progress`.
9. **`Close / Reload`**: Cold-start verification from persistent SQLite database file.
10. **`State restored`**: Progress and completed lesson count verified after fresh process boot.
11. **`SRS isolation`**: Verifies that lesson completions and exercise evaluations do not mutate or corrupt `review_cards`.
12. **`Offline & integration checks`**:
    * Multilingual sentence retrieval.
    * Listening segment transcript structure.
    * Pronunciation spoken self-rating persistence.
    * Reminder settings update.
    * Advisory Arabic non-scoring enforcement.
