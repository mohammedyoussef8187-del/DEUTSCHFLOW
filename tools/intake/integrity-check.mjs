#!/usr/bin/env node
/* Report referential integrity of a canonical dataset file. */
import fs from "node:fs";
import path from "node:path";
import { integrityReport } from "../../01_APPLICATION/CURRENT_APP/src/content/referential-integrity.js";

const file = path.resolve(process.cwd(), process.argv[2]
  ?? "01_APPLICATION/CURRENT_APP/data/canonical-content.json");
const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
const report = integrityReport(dataset.entities);

console.log(`dataset: ${file.split(path.sep).join("/")}`);
console.log(`orphaned rows: ${report.total}`);
for (const [entity, count] of Object.entries(report.counts)) {
  console.log(`  ${entity}: ${count}`);
  const byReason = {};
  for (const row of report.orphans[entity]) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
  for (const [reason, n] of Object.entries(byReason)) console.log(`      ${reason}: ${n}`);
}
if (report.unknownTypes.length) {
  console.log(`unknown reference types: ${report.unknownTypes.length}`);
  for (const row of report.unknownTypes.slice(0, 10)) {
    console.log(`  ${row.entity} ${row.uuid} type=${row.type}`);
  }
}
process.exitCode = report.ok ? 0 : 1;
