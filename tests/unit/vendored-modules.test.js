/*
 * The app ships plain ES modules with no bundler, so a bare specifier like
 * "@capacitor-community/sqlite" cannot resolve in the WebView. Third-party packages must
 * be vendored as relative ESM bundles (npm run build:vendor). A regression here would
 * only surface on a device, so it is pinned in CI instead.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = rel => fs.readFileSync(path.resolve(root, rel), "utf8");

const EXECUTOR = "01_APPLICATION/CURRENT_APP/src/platform/sqlite/capacitor-executor.js";
const VENDOR_DIR = "01_APPLICATION/CURRENT_APP/vendor";

describe("vendored browser modules", () => {
  it("ships the vendored SQLite plugin bundle", () => {
    const bundle = read(`${VENDOR_DIR}/capacitor-sqlite.js`);
    expect(bundle.length).toBeGreaterThan(1000);
    for (const name of ["CapacitorSQLite", "SQLiteConnection"]) {
      expect(bundle, `missing export ${name}`).toContain(name);
    }
  });

  it("ships the vendored Lit bundle", () => {
    expect(read(`${VENDOR_DIR}/lit.js`).length).toBeGreaterThan(1000);
  });

  it("has no unresolvable bare imports in the vendored bundles", () => {
    for (const file of ["capacitor-sqlite.js", "lit.js"]) {
      const bare = [...read(`${VENDOR_DIR}/${file}`).matchAll(/^import\s+.*?from\s+["']([^"']+)["']/gm)]
        .map(m => m[1])
        .filter(spec => !spec.startsWith(".") && !spec.startsWith("/"));
      expect(bare, `${file} has bare imports: ${bare.join(", ")}`).toEqual([]);
    }
  });

  it("loads the SQLite plugin by relative path, never by bare specifier", () => {
    const src = read(EXECUTOR);
    expect(src).toContain('import("../../../vendor/capacitor-sqlite.js")');
    expect(src).not.toContain('import("@capacitor-community/sqlite")');
  });

  it("resolves the vendored path correctly from the executor's location", () => {
    const from = path.dirname(path.resolve(root, EXECUTOR));
    const target = path.resolve(from, "../../../vendor/capacitor-sqlite.js");
    expect(fs.existsSync(target), `expected bundle at ${target}`).toBe(true);
  });

  it("keeps a build script so the bundles can be regenerated", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts["build:vendor"]).toBeTruthy();
    expect(scripts["build:vendor:sqlite"]).toContain("@capacitor-community/sqlite");
  });
});
