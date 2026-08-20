import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const appPath = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/app.js");
const source = fs.readFileSync(appPath, "utf8");
const coreEnd = source.indexOf('\n(function(){\n  "use strict";\n  const DF=window.DF;');

if (coreEnd < 0) throw new Error("Could not locate the legacy core boundary in app.js");

export function loadLegacyCore() {
  const window = {};
  vm.runInNewContext(source.slice(0, coreEnd), { window }, { filename: appPath });
  return window.DF;
}
