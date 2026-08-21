/*
 * Authoring tool: register audio files that already exist in this repository as
 * canonical audio_assets rows.
 *
 * This REGISTERS files; it does not create them, download them, or describe what is in
 * them. No transcript, translation, duration or CEFR level is produced here, because
 * none of those can be read from a filename. Duration stays 0 until something actually
 * measures the audio.
 *
 * Everything it emits is `availability: 'source-only'`: the files live in the authoring
 * repository, not in the app bundle. Marking them 'bundled' is a separate, deliberate
 * packaging decision — the schema keeps "where the file is" and "where it came from"
 * apart precisely so that decision stays visible.
 *
 * Pure functions here; the CLI wrapper is register-audio-assets.mjs.
 */

import { deterministicUuid } from "../../01_APPLICATION/CURRENT_APP/src/migration/uuid.js";

const NS_AUDIO = "deutschflow/audio_asset";

const MIME_BY_EXTENSION = Object.freeze({
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus"
});

export function mimeTypeFor(fileName) {
  const dot = String(fileName).lastIndexOf(".");
  if (dot === -1) return null;
  return MIME_BY_EXTENSION[String(fileName).slice(dot).toLowerCase()] ?? null;
}

/** A stable, readable slug from a file name. Not a title: it is an identifier. */
export function slugFor(fileName) {
  return String(fileName)
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build audio_assets rows for a list of real files.
 *
 * @param {Array} files    [{ name, relativePath, byteSize }]
 * @param {object} options { now, sourceTitle, sourceType, availability }
 */
export function buildAudioAssetRows(files, options = {}) {
  const now = options.now ?? Date.now();
  const availability = options.availability ?? "source-only";
  const sourceType = options.sourceType ?? "textbook";
  const sourceTitle = options.sourceTitle ?? null;

  return [...(files ?? [])]
    // Sorted by path so a rescan produces byte-identical output.
    .sort((a, b) => String(a.relativePath).localeCompare(String(b.relativePath)))
    .map(file => {
      const slug = slugFor(file.name);
      return {
        uuid: deterministicUuid(NS_AUDIO, file.relativePath),
        slug,
        availability,
        // Empty on purpose: the file is not on a device yet.
        localPath: "",
        sourcePath: file.relativePath,
        remoteUrl: null,
        mimeType: mimeTypeFor(file.name) ?? "application/octet-stream",
        byteSize: file.byteSize ?? 0,
        // Unknown until measured. A guessed duration would be a fabricated fact.
        durationMs: 0,
        checksum: null,
        contentStatus: "draft",
        contentVersion: 1,
        sourceReference: sourceTitle ? `${sourceTitle} — ${file.name}` : file.name,
        sourceType,
        verifiedAt: null,
        verifiedBy: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        deleted: 0
      };
    });
}

/** Summary for a human running the tool. */
export function summarizeManifest(rows) {
  const byType = {};
  let bytes = 0;
  for (const row of rows) {
    byType[row.mimeType] = (byType[row.mimeType] ?? 0) + 1;
    bytes += row.byteSize ?? 0;
  }
  return {
    count: rows.length,
    bytes,
    byMimeType: byType,
    withDuration: rows.filter(row => row.durationMs > 0).length,
    playableOffline: rows.filter(row => row.availability === "bundled" || row.availability === "downloaded").length
  };
}
