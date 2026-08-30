import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as utils from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import * as text from "../../01_APPLICATION/CURRENT_APP/src/core/text.js";
import * as evaluator from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import * as srs from "../../01_APPLICATION/CURRENT_APP/src/srs/scheduler.js";
import * as triage from "../../01_APPLICATION/CURRENT_APP/src/content/legacy-triage.js";

const appPath = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js");
const source = fs.readFileSync(appPath, "utf8");
const coreBoundary = /\r?\n\(function\(\)\{\r?\n\s*"use strict";\r?\n\s*const DF=window\.DF;/.exec(source);
const coreEnd = coreBoundary?.index ?? -1;

if (coreEnd < 0) throw new Error("Could not locate the legacy core boundary in app.js");

/*
 * The pure half of the legacy core, without the runtime it normally boots into.
 *
 * `app.js` is a browser script: it declares its helpers and then immediately wires an
 * IndexedDB adapter, a router and a render loop to them. Only the helpers are testable
 * outside a browser, so the source is cut twice — at the module boundary, and again just
 * before the first line that reaches for the platform.
 */
export function loadLegacyCore() {
  const window = {};
  const stripped = source.slice(0, coreEnd)
    .replace(/^import\s+[\s\S]*?from\s+"[^"]*";[ \t]*$/gm, "")
    .replace(/^import\s+"[^"]*";[ \t]*$/gm, "");

  const wiring = stripped.indexOf("const database=createIndexedDbAdapter");
  const coreSource = wiring === -1
    ? stripped
    : stripped.slice(0, stripped.lastIndexOf("\n", wiring));

  vm.runInNewContext(
    coreSource,
    { window, ...utils, ...text, ...evaluator, ...srs, ...triage },
    { filename: appPath }
  );
  return window.DF;
}
