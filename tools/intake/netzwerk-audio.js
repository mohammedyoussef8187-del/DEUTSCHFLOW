/*
 * Netzwerk audio registration.
 *
 * The 189 Netzwerk neu A2 recordings are real, verified files whose identity is certain,
 * so they can be REGISTERED. What cannot be done is say which lesson each one belongs to:
 * the filename deterministically gives book, disc and track, and the printed audio index
 * that maps a track to a lesson lives inside a Kursbuch with no readable text layer.
 *
 * Mapping them anyway — by order, by duration, by "track 3 is probably Kapitel 1" — is
 * exactly the guess the intake rules forbid, and a wrong mapping would play the wrong
 * recording to a learner reading the right transcript. So each asset is registered with
 * its true identity and availability, and NO listening activity is created for it.
 *
 * Availability is `source-only`: the files are in the authoring repository, not in the
 * app bundle. That is the truthful state, and it is what keeps the UI honest.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";

const NS_AUDIO = "deutschflow/intake/audio_asset";

export const NETZWERK_AUDIO_SOURCE = Object.freeze({
  title: "Netzwerk neu A2 — Audios",
  publisher: "Ernst Klett Sprachen",
  reference: "klett-sprachen.de/netzwerk-neu/medienA2"
});

/**
 * Build canonical audio_assets rows for inventoried Netzwerk audio.
 *
 * @param {Array} files inventory entries: { path, size, sha256, naming }
 * @param {object} options { now }
 */
export function buildNetzwerkAudioAssets(files, options = {}) {
  const now = options.now ?? Date.now();

  return [...(files ?? [])]
    .filter(file => file.naming)              // an unnamed file has no verifiable identity
    // Sorted by the publisher's own numbering, so a rescan emits identical output.
    .sort((a, b) =>
      a.naming.book.localeCompare(b.naming.book) ||
      a.naming.disc - b.naming.disc ||
      a.naming.track - b.naming.track)
    .map(file => {
      const { level, book, disc, track } = file.naming;
      const slug = `netzwerk-neu-${level}-${book}-${disc}-${String(track).padStart(3, "0")}`
        .toLowerCase();

      return {
        // Identity from the repository path: the same file always yields the same uuid.
        uuid: deterministicUuid(NS_AUDIO, file.path),
        slug,
        // The file is in the authoring repository, not on any device.
        availability: "source-only",
        localPath: "",
        sourcePath: file.path,
        remoteUrl: null,
        mimeType: "audio/mpeg",
        byteSize: file.size,
        // Unknown until something measures the audio. A guessed duration is a fabricated fact.
        durationMs: 0,
        // SHA-256, so two files are the same file only when their bytes are.
        checksum: `sha256:${file.sha256}`,
        contentStatus: "imported",
        contentVersion: 1,
        // Everything the publisher's own numbering states, and nothing it does not.
        sourceReference:
          `${NETZWERK_AUDIO_SOURCE.title} — ${book === "kursbuch" ? "Kursbuch" : "Übungsbuch"} ` +
          `Audio ${disc}-${String(track).padStart(3, "0")} — ${NETZWERK_AUDIO_SOURCE.reference}`,
        sourceType: "audio",
        verifiedAt: null,
        verifiedBy: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        deleted: 0
      };
    });
}

/**
 * What a track's filename establishes, and what it does not.
 * Returned so an audit can state the gap rather than leave it implied.
 */
export function audioMappingReport(files) {
  const named = (files ?? []).filter(file => file.naming);
  return {
    discovered: (files ?? []).length,
    identified: named.length,
    unidentified: (files ?? []).length - named.length,
    // Book, disc and track come from the filename convention and are certain.
    deterministicFields: ["level", "book", "disc", "track"],
    // A lesson does not, and no other evidence in the repository supplies it.
    mappedToLessons: 0,
    unresolvedMappings: named.length,
    unresolvedReason:
      "the track-to-lesson index is printed in the Kursbuch, which has no readable text layer; " +
      "mapping by order or duration would be a guess"
  };
}
