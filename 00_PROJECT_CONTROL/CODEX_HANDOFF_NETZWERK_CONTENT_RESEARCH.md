# Codex Handoff — Netzwerk neu A2 Content Research

## Completed

- Audited rights-safe ingestion boundaries for all 12 Netzwerk neu A2 chapters using official Klett/Allango evidence only.
- Classified all reviewed educational/resource categories.
- Materialized the rights-safe educational dataset. It is intentionally empty because no reviewed official notice authorizes app ingestion/redistribution of publisher-authored educational content.
- Preserved all existing official-source metadata findings, including the Kapitel 1 printed/transcript title anomaly and all unresolved audio page/exercise mappings.

## Source branch

`codex/netzwerk-content-research`, based on `origin/mobile-foundation` at `9f07498`.

## Files

- `00_PROJECT_CONTROL/NETZWERK_NEU_A2_RIGHTS_SAFE_DATASET.json`
- `00_PROJECT_CONTROL/NETZWERK_NEU_A2_CONTENT_RIGHTS_MATRIX.md`
- `00_PROJECT_CONTROL/CODEX_HANDOFF_NETZWERK_CONTENT_RESEARCH.md`

## Counts

Counts use one row per reviewed content/resource category:

- `SAFE_TO_INGEST`: 0
- `METADATA_ONLY`: 6
- `REFERENCE_ONLY`: 4
- `BLOCKED_BY_RIGHTS`: 14
- `UNVERIFIED`: 4
- Rights-safe educational dataset rows: 0
- Chapter coverage: 12/12
- Local audio: 189 component/chapter/track mappings partially proven; 0 exact page/exercise mappings proven; 189 page/exercise mappings unresolved

## Coverage

All chapters 1–12 have official structural/source coverage and zero publisher-authored educational rows authorized for ingestion. Exact chapter titles, A2.1/A2.2 ISBNs, edition-scoped page ranges, explicit task references, and audio chapter ranges remain metadata-only. Kapitel 1 canonical printed title is **Und was machst du?**; official audio-transcript heading **Das bin ich.** remains a separate source anomaly.

## Rights conclusions

- Public, non-password-protected official links may be retained and opened externally.
- Public download availability does not grant copying, extraction, re-upload, app bundling, or redistribution rights.
- Vocabulary, English/Arabic meanings, grammar wording, examples, exercises, accepted answers, transcripts, tests, teacher resources, Landeskunde worksheet bodies, and publisher audio/video are not authorized for DeutschFlow ingestion under the reviewed notices.
- Public/App Store distribution of publisher content requires explicit written permission/licensing from Ernst Klett Sprachen.

## Unresolved

- Written rights-holder permission/licence for any publisher-authored educational text or media.
- Exact page/exercise mapping for every one of the 189 local audio tracks.
- Authoritative correction status of the Kapitel 1 transcript heading anomaly.
- Degraded/image-only test OCR and local scans remain unsuitable as official educational-content evidence.

## Claude action

Read first:

1. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_RIGHTS_SAFE_DATASET.json`
2. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_CONTENT_RIGHTS_MATRIX.md`
3. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_STRUCTURE_INDEX.json`
4. `00_PROJECT_CONTROL/NETZWERK_NEU_A2_AUDIO_ASSET_INDEX.json`

Do not ingest Netzwerk publisher-authored educational content from the audited sources. Continue using only the already-approved metadata/source-asset boundary unless written Klett permission is added and verified. Keep all audio `page` and `exercise` fields null.

## Commit / cherry-pick

Content commit SHA: `fc0129eebc0de4f031ccd38920da82c1967478ae`

Cherry-pick that documentation commit onto the implementation branch. A handoff-only follow-up commit may also be listed if needed to record the content SHA.

## Genuine blocker

Publisher rights are the blocker for any non-empty Netzwerk educational-content dataset. No engineering blocker exists for retaining metadata-only source relationships.
