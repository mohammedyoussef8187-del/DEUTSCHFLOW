#!/usr/bin/env node
/*
 * Netzwerk / Netzwerk neu source inventory.
 *
 *   node tools/intake/netzwerk-inventory.mjs [--out file.json]
 *
 * Before a parser can be written for a publisher, somebody has to establish what is
 * actually in the repository — not what the filenames suggest. This walks every Netzwerk
 * document and audio file, identifies each by SHA-256, classifies book/edition/level and
 * component from evidence, and measures whether each PDF's text layer can support an
 * import at all.
 *
 * It writes nothing into the canonical store. Its output is the inventory a person needs
 * in order to decide whether an import is possible.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assessTextLayer, suspectSamples } from "./text-layer.js";

export const NETZWERK_ROOTS = Object.freeze([
  "03_COURSE_CONTENT/NETZWERK_A1",
  "03_COURSE_CONTENT/NETZWERK_A2",
  "03_COURSE_CONTENT/NETZWERK_NEU_A2"
]);

export const INVENTORY_PATH = "tools/intake/artifacts/netzwerk-inventory.json";

/** Exact identity. Two files are the same file only when their bytes are. */
export function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * Classify a Netzwerk file from its name and location.
 * "neu" is a real edition distinction the publisher makes, so it is captured, not
 * flattened into the older Netzwerk.
 */
export function classifyNetzwerkFile(relativePath) {
  const name = path.basename(relativePath);
  const haystack = `${relativePath} ${name}`;

  const edition = /neu/i.test(haystack) ? "neu" : "original";
  const level = /\bA2\b|_A2|A2[ _-]/i.test(haystack) ? "A2"
    : /\bA1\b|_A1|A1[ _-]/i.test(haystack) ? "A1"
    : /\bB1\b/i.test(haystack) ? "B1" : null;

  let component = null;
  if (/\.mp3$/i.test(name)) component = "audio";
  else if (/Übungsbuch|Uebungsbuch|\bUB\b|_UeB_/i.test(haystack)) component = "uebungsbuch";
  else if (/Kursbuch|\bKB\b/i.test(haystack)) component = "kursbuch";
  else if (/Lehrerhandbuch/i.test(haystack)) component = "lehrerhandbuch";
  else if (/Intensivtrainer/i.test(haystack)) component = "intensivtrainer";
  else if (/Testheft/i.test(haystack)) component = "testheft";
  else if (/Glossar|Wortschatz|Vokabel/i.test(haystack)) component = "glossar";

  return { edition, level, component };
}

/**
 * Audio filenames follow `NWn_<LEVEL>_<BOOK>_Audio_<DISC>-<TRACK>.mp3`.
 * That deterministically yields book, disc and track — and NOTHING about which lesson a
 * track belongs to. The lesson mapping lives in the book's printed audio index.
 */
export function parseAudioName(name) {
  const match = /^NWn_(A1|A2|B1)_(KB|UeB)_Audio_(\d+)-(\d+)\.mp3$/i.exec(name);
  if (!match) return null;
  return {
    level: match[1].toUpperCase(),
    book: match[2].toUpperCase() === "KB" ? "kursbuch" : "uebungsbuch",
    disc: Number(match[3]),
    track: Number(match[4])
  };
}

function walk(root, dir, out = []) {
  const absolute = path.resolve(root, dir);
  if (!fs.existsSync(absolute)) return out;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(root, relative, out);
    else if (entry.isFile() && !/\.gitkeep$/.test(entry.name)) out.push(relative);
  }
  return out;
}

function extractText(absolutePath) {
  try {
    return execFileSync("pdftotext", ["-enc", "UTF-8", "-layout", absolutePath, "-"], {
      encoding: "utf8", maxBuffer: 256 * 1024 * 1024
    });
  } catch {
    return "";
  }
}

export function inventory(options = {}) {
  const root = options.root ?? process.cwd();
  const files = (options.roots ?? NETZWERK_ROOTS).flatMap(dir => walk(root, dir));

  const documents = [];
  const audio = [];
  const byDigest = new Map();

  for (const relative of files) {
    const absolute = path.resolve(root, relative);
    const size = fs.statSync(absolute).size;
    const digest = sha256(absolute);
    const classification = classifyNetzwerkFile(relative);

    const seen = byDigest.get(digest);
    if (seen) seen.push(relative); else byDigest.set(digest, [relative]);

    if (classification.component === "audio") {
      audio.push({
        path: relative, size, sha256: digest,
        ...classification,
        naming: parseAudioName(path.basename(relative))
      });
      continue;
    }

    const text = extractText(absolute);
    const pages = (text.match(/\f/g) ?? []).length + 1;
    const assessment = assessTextLayer(text, pages);

    documents.push({
      path: relative, size, sha256: digest,
      ...classification,
      textLayer: assessment,
      samples: assessment.parseable ? [] : suspectSamples(text)
    });
  }

  // Exact duplicates only: identical bytes. Two scans of the same book are two files.
  const duplicates = [...byDigest.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([digest, paths]) => ({ sha256: digest, paths }));

  return {
    generatedAt: options.now ?? Date.now(),
    documents,
    audio: summarizeAudio(audio),
    duplicates,
    parseableDocuments: documents.filter(document => document.textLayer.parseable).map(d => d.path),
    blockedDocuments: documents
      .filter(document => !document.textLayer.parseable)
      .map(document => ({
        path: document.path, verdict: document.textLayer.verdict, reason: document.textLayer.reason
      }))
  };
}

/** Group audio by the book and disc its filename states, and report gaps in numbering. */
export function summarizeAudio(files) {
  const groups = new Map();
  for (const file of files) {
    const key = file.naming ? `${file.naming.level}:${file.naming.book}:${file.naming.disc}` : "unrecognised";
    const group = groups.get(key) ?? { key, count: 0, tracks: [], unrecognised: key === "unrecognised" };
    group.count += 1;
    if (file.naming) group.tracks.push(file.naming.track);
    groups.set(key, group);
  }

  return {
    // The entries themselves, so a later stage can register them without rescanning.
    files,
    total: files.length,
    // Identity is bytes, not size: two different recordings can be the same length.
    distinct: new Set(files.map(file => file.sha256)).size,
    groups: [...groups.values()].map(group => {
      const tracks = group.tracks.sort((a, b) => a - b);
      const expected = tracks.length ? tracks[tracks.length - 1] - tracks[0] + 1 : 0;
      return {
        key: group.key, count: group.count,
        firstTrack: tracks[0] ?? null, lastTrack: tracks[tracks.length - 1] ?? null,
        // A gap is a fact about the corpus, not something to paper over.
        missingTracks: expected - tracks.length
      };
    }),
    /*
     * The filename gives book, disc and track. It does NOT give a lesson, and the printed
     * audio index that would is inside the Kursbuch. Until that index is readable, any
     * track-to-lesson mapping would be an ordering guess, which the intake rules forbid.
     */
    lessonMapping: "unresolved-no-deterministic-index"
  };
}

if (process.argv[1]?.endsWith("netzwerk-inventory.mjs")) {
  const outIndex = process.argv.indexOf("--out");
  const result = inventory();

  console.log("── documents ──");
  for (const document of result.documents) {
    console.log(`  ${document.path}`);
    console.log(`    ${document.edition} ${document.level} ${document.component}  ` +
      `${(document.size / 1048576).toFixed(1)} MiB  sha256 ${document.sha256.slice(0, 16)}…`);
    console.log(`    text layer: ${document.textLayer.verdict}  ` +
      `${document.textLayer.pages} pages, ${document.textLayer.charsPerPage} chars/page, ` +
      `suspect rate ${document.textLayer.suspectRate}`);
    if (document.textLayer.reason) console.log(`    -> ${document.textLayer.reason}`);
    for (const sample of document.samples.slice(0, 3)) console.log(`       "${sample}"`);
  }

  console.log("── audio ──");
  console.log(`  ${result.audio.total} files, ${result.audio.distinct} distinct by SHA-256`);
  for (const group of result.audio.groups) {
    console.log(`  ${group.key}: ${group.count} tracks ` +
      `(${group.firstTrack}–${group.lastTrack}, ${group.missingTracks} missing)`);
  }
  console.log(`  lesson mapping: ${result.audio.lessonMapping}`);

  console.log("── duplicates (identical bytes) ──");
  console.log(result.duplicates.length ? JSON.stringify(result.duplicates, null, 2) : "  none");

  console.log("── verdict ──");
  console.log(`  parseable documents: ${result.parseableDocuments.length}`);
  for (const blocked of result.blockedDocuments) {
    console.log(`  blocked: ${path.basename(blocked.path)} — ${blocked.verdict}`);
  }

  const out = outIndex === -1 ? INVENTORY_PATH : process.argv[outIndex + 1];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`inventory -> ${out}`);
}
