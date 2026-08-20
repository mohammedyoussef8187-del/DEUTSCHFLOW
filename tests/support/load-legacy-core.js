import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as utils from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import * as text from "../../01_APPLICATION/CURRENT_APP/src/core/text.js";
import * as evaluator from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import * as srs from "../../01_APPLICATION/CURRENT_APP/src/srs/scheduler.js";

const appPath = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js");
const source = fs.readFileSync(appPath, "utf8");
const coreEnd = source.indexOf('\n(function(){\n  "use strict";\n  const DF=window.DF;');

if (coreEnd < 0) throw new Error("Could not locate the legacy core boundary in app.js");

export function loadLegacyCore() {
  const window = {};
  const coreSource = source.slice(0, coreEnd).replace(/^import .*;\r?\n/gm, "");
  vm.runInNewContext(coreSource, { window, ...utils, ...text, ...evaluator, ...srs }, { filename: appPath });
  return window.DF;
}
