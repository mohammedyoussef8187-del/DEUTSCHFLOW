#!/usr/bin/env node
/*
 * Stage 1 of the intake pipeline: EXTRACT.
 *
 *   node tools/intake/extract.mjs <source-id> [--out dir]
 *
 * Runs the local `pdftotext` (poppler) with UTF-8 and layout preservation, splits the
 * result on the form feeds it emits between pages, and writes BOTH the raw text and a
 * page-indexed JSON artifact.
 *
 * The raw text is kept deliberately. Every later stage is a pure function of this file,
 * so a disputed import can be replayed exactly, and a parser change can be diffed
 * against text that never moved. Nothing downstream re-reads the PDF.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { sourceById } from "./sources.js";

export const ARTIFACT_ROOT = "tools/intake/artifacts";

/** Split poppler output into pages. It separates them with a form feed. */
export function splitPages(text) {
  return String(text ?? "")
    .split("\f")
    .map(page => page.replace(/\s+$/, ""))
    .filter((page, index, all) => page.length > 0 || index < all.length - 1)
    .map((text, index) => ({ number: index + 1, text }));
}

/** A cheap, stable digest so an artifact can be tied to the exact bytes it came from. */
export function digestOf(buffer) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < buffer.length; i++) {
    h1 = Math.imul(h1 ^ buffer[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 + buffer[i] + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/**
 * @param {string} sourceId registry id
 * @param {object} [options] `source` accepts a DISCOVERED descriptor directly, so a
 *   newly dropped-in handout can be extracted without first being written into the
 *   registry by hand. It still had to match a publisher template to become one.
 */
export function extractSource(sourceId, options = {}) {
  const source = options.source ?? sourceById(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);

  const root = options.root ?? process.cwd();
  const pdfPath = path.resolve(root, source.path);
  if (!fs.existsSync(pdfPath)) throw new Error(`Source file is not in this repository: ${source.path}`);

  const bytes = fs.readFileSync(pdfPath);
  const raw = execFileSync("pdftotext", ["-enc", "UTF-8", "-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  const pages = splitPages(raw);
  if (source.pages && pages.length !== source.pages) {
    // A page count that no longer matches means the file changed; that is a fact for
    // the operator, not something to silently accept.
    console.error(`warning: ${sourceId} extracted ${pages.length} pages, registry says ${source.pages}`);
  }

  return {
    sourceId,
    path: source.path,
    digest: digestOf(bytes),
    byteSize: bytes.length,
    extractedAt: options.now ?? Date.now(),
    tool: "pdftotext -enc UTF-8 -layout",
    pageCount: pages.length,
    pages,
    raw
  };
}

export function writeArtifacts(extraction, options = {}) {
  const root = options.root ?? process.cwd();
  const dir = path.resolve(root, options.out ?? path.join(ARTIFACT_ROOT, extraction.sourceId));
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, "raw.txt"), extraction.raw, "utf8");
  const { raw, ...meta } = extraction;
  fs.writeFileSync(path.join(dir, "pages.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  return dir;
}

if (import.meta.url === `file://${process.argv[1]?.split(path.sep).join("/")}` ||
    process.argv[1]?.endsWith("extract.mjs")) {
  const [sourceId] = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
  if (!sourceId) {
    console.error("usage: extract.mjs <source-id> [--out dir]");
    process.exit(2);
  }
  const outIndex = process.argv.indexOf("--out");
  const extraction = extractSource(sourceId);
  const dir = writeArtifacts(extraction, { out: outIndex === -1 ? undefined : process.argv[outIndex + 1] });
  console.log(`extracted ${extraction.pageCount} pages from ${extraction.path}`);
  console.log(`digest ${extraction.digest} -> ${dir}`);
}
