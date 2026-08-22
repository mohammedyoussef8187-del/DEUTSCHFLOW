# Codex Handoff — Complete A2 Content

## Deliverable

Seven ordered CC BY 4.0 A2 lesson datasets are listed in `00_PROJECT_CONTROL/A2_COMPLETE_CONTENT_MANIFEST.json`. Each dataset has a colocated per-lesson handoff so work can resume from another account without rescanning sources.

## Intake boundary

- Use the existing open-content intake validator and canonical mapper unchanged.
- Process lessons in manifest order and require preview/diff before each apply.
- Apply only through the repository transaction boundary.
- Do not write learner, SRS, progress, settings, favorite, ignored, or flag state.
- Preserve deterministic source IDs and canonical UUIDs exactly.
- Keep Arabic accepted answers non-scoreable.
- Do not bundle remote media; retain source URL, attribution, and CC BY changes notice.
- Pronunciation records are metadata-only and must not be promoted to learner-ready content.

## Review gates

- Educator review required: 372 records.
- Technical media review required: 7 records.
- Source-verified pronunciation metadata: 7 records.
- Open production prompts are intentionally ungraded.

## Exact continuation sequence

1. Open `00_PROJECT_CONTROL/A2_COMPLETE_CONTENT_MANIFEST.json`.
2. For the current lesson, open its JSON and adjacent `A2_LESSON_XX_HANDOFF.md`.
3. Run the existing open-content validator and preview/diff without applying.
4. Complete educator review; complete technical review for the remote media record.
5. Import transactionally through the existing repository path and run post-import verification.
6. Repeat in manifest order; do not alter Nicos, learner, or SRS rows.

## Validation command

`npm test`

The content-artifact validation result and exact branch commit are reported with the delivery; no runtime file is modified by this branch.
