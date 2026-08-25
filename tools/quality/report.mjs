#!/usr/bin/env node
/* The data-quality numbers a release is judged on, for both content sources. */
import fs from "node:fs";
import vm from "node:vm";
import { triageLegacySource } from "../../01_APPLICATION/CURRENT_APP/src/content/legacy-triage.js";
import {
  findCorruptedStrings, findDuplicateVocabulary, learnerStrings
} from "../../01_APPLICATION/CURRENT_APP/src/content/content-quality.js";
import { loadLegacyCore } from "../../tests/support/load-legacy-core.js";

const DF = loadLegacyCore();
const box = { window: {} };
vm.runInNewContext(fs.readFileSync("01_APPLICATION/CURRENT_APP/data/seed-data.js", "utf8"), box);
const SEED = box.window.SEED;
const { counts } = triageLegacySource(SEED);

const words = SEED.map(entry => DF.applyPatchToSeed(entry));
const published = words.filter(word => !word.excluded);
const needsUser = published.filter(word => word.qualityStatus === "review");

const entities = JSON.parse(
  fs.readFileSync("01_APPLICATION/CURRENT_APP/data/canonical-content.json", "utf8")).entities;
const alive = rows => (rows ?? []).filter(row => !row.deleted);
const corrupted = findCorruptedStrings(entities);
const duplicates = findDuplicateVocabulary(entities);

const referenced = type => new Set(
  alive(entities.lessonItems).filter(item => item.contentType === type)
    .map(item => item.contentUuid)).size;

console.log("── legacy source ──");
console.log(`  LEGACY_SOURCE_TOTAL       ${counts.total}`);
console.log(`  LEGACY_VALID              ${counts.VALID}`);
console.log(`  LEGACY_CORRECTED          ${counts.CORRECTED}`);
console.log(`  LEGACY_ARTIFACT_EXCLUDED  ${counts.ARTIFACT}`);
console.log(`  LEGACY_QUARANTINED        ${counts.QUARANTINED}`);
console.log(`  legacy words published    ${published.length}`);

console.log("\n── learner-visible curriculum ──");
console.log(`  LEARNER_VISIBLE_VOCABULARY ${referenced("vocabulary")}`);
console.log(`  LEARNER_VISIBLE_EXERCISES  ${referenced("exercise")}`);
console.log(`  LEARNER_VISIBLE_LISTENING  ${referenced("listening")}`);
console.log(`  learner-readable strings   ${learnerStrings(entities).length}`);

console.log("\n── data quality ──");
console.log(`  DATA_QUALITY_QUEUE_TOTAL   ${needsUser.length}`);
console.log(`  USER_ACTION_REQUIRED       ${needsUser.length}`);
console.log(`  corrupted learner strings  ${corrupted.length}`);
for (const row of corrupted.slice(0, 10)) {
  console.log(`      ${row.entity}.${row.field}: ${JSON.stringify(row.value.slice(0, 80))}`);
  console.log(`         ${row.reasons.join(", ")}`);
}
console.log(`  duplicate vocabulary rows  ${duplicates.length}`);
for (const row of duplicates) {
  console.log(`      ${row.german} (${row.level}) — ${row.sameSource
    ? "DUPLICATE_ENTITY, one source" : "two sources, each attributed"}`);
}

process.exitCode = (needsUser.length || corrupted.length) ? 1 : 0;
