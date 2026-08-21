#!/usr/bin/env node
/*
 * CLI wrapper around audio-manifest.js.
 *
 *   node tools/listening/register-audio-assets.mjs <directory> [--out file.json] [--source "Netzwerk neu A2"]
 *
 * Scans a directory of audio files that already exist in this repository and prints (or
 * writes) canonical audio_assets rows. It never downloads, converts or renames anything,
 * and it never invents a transcript, translation, duration or level.
 */

import fs from "node:fs";
import path from "node:path";
import { buildAudioAssetRows, mimeTypeFor, summarizeManifest } from "./audio-manifest.js";

const args = process.argv.slice(2);
const directory = args.find(arg => !arg.startsWith("--"));
const flag = name => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1] ?? null;
};

if (!directory) {
  console.error("usage: register-audio-assets.mjs <directory> [--out file.json] [--source title]");
  process.exit(2);
}

const root = process.cwd();
const absolute = path.resolve(root, directory);
if (!fs.existsSync(absolute)) {
  console.error(`no such directory: ${absolute}`);
  process.exit(1);
}

const files = fs.readdirSync(absolute, { withFileTypes: true })
  .filter(entry => entry.isFile() && mimeTypeFor(entry.name))
  .map(entry => {
    const full = path.join(absolute, entry.name);
    return {
      name: entry.name,
      relativePath: path.relative(root, full).split(path.sep).join("/"),
      byteSize: fs.statSync(full).size
    };
  });

const rows = buildAudioAssetRows(files, { sourceTitle: flag("source") });
const summary = summarizeManifest(rows);

const out = flag("out");
if (out) {
  fs.writeFileSync(path.resolve(root, out), `${JSON.stringify({ audioAssets: rows }, null, 2)}\n`);
  console.log(`wrote ${rows.length} audio_assets rows to ${out}`);
} else {
  console.log(JSON.stringify({ audioAssets: rows }, null, 2));
}

console.error(
  `${summary.count} files, ${(summary.bytes / 1048576).toFixed(1)} MiB, ` +
  `${summary.withDuration} with a measured duration, ${summary.playableOffline} playable offline`
);
