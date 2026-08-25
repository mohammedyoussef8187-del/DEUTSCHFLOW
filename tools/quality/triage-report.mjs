#!/usr/bin/env node
/* Run the legacy triage over the shipped seed and report what it decided. */
import fs from "node:fs";
import vm from "node:vm";
import {
  triageLegacySource, VERDICT
} from "../../01_APPLICATION/CURRENT_APP/src/content/legacy-triage.js";

const box = { window: {} };
vm.runInNewContext(fs.readFileSync("01_APPLICATION/CURRENT_APP/data/seed-data.js", "utf8"), box);
const SEED = box.window.SEED;

const { decisions, counts } = triageLegacySource(SEED);

console.log("── legacy triage ──");
console.log(`  LEGACY_SOURCE_TOTAL      ${counts.total}`);
console.log(`  LEGACY_VALID             ${counts.VALID}`);
console.log(`  LEGACY_CORRECTED         ${counts.CORRECTED}`);
console.log(`  LEGACY_ARTIFACT_EXCLUDED ${counts.ARTIFACT}`);
console.log(`  LEGACY_QUARANTINED       ${counts.QUARANTINED}`);

const byId = new Map(SEED.map(e => [e.id, e]));
for (const verdict of [VERDICT.CORRECTED, VERDICT.ARTIFACT, VERDICT.QUARANTINED]) {
  const rows = [...decisions].filter(([, d]) => d.verdict === verdict);
  if (!rows.length) continue;
  console.log(`\n── ${verdict} (${rows.length}) ──`);
  for (const [id, d] of rows) {
    const raw = byId.get(id);
    console.log(`  [${id}] ${JSON.stringify(raw.de)} = ${JSON.stringify(raw.ar)}`);
    console.log(`         ${d.reason}`);
    if (verdict === VERDICT.CORRECTED) {
      console.log(`         → ${JSON.stringify(d.german)} = ${JSON.stringify(d.arabic)}`);
    }
  }
}
