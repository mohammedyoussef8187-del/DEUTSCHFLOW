import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP");
const read = file => readFileSync(path.join(appRoot, file), "utf8");

describe("installable web application", () => {
  it("uses deploy-path-relative manifest and icon URLs", () => {
    const html = read("index.html");
    const manifest = JSON.parse(read("manifest.webmanifest"));

    expect(html).toContain('href="./manifest.webmanifest"');
    expect(html).toContain('href="./icon-192.png"');
    expect(manifest.id).toBe("./");
    expect(manifest.start_url).toBe("./index.html");
    expect(manifest.scope).toBe("./");
    expect(manifest.icons.every(icon => icon.src.startsWith("./"))).toBe(true);
    expect(manifest.display).toBe("standalone");
  });

  it("registers a scope-relative service worker on HTTPS and localhost", () => {
    const registration = read("src/register-sw.js");
    expect(registration).toContain('navigator.serviceWorker.register("./sw.js",{scope:"./"})');
    expect(registration).toContain('location.protocol==="https:"');
    expect(registration).toContain('["localhost","127.0.0.1","[::1]"]');
  });

  it("pre-caches the app, curriculum, and iOS installation guidance", () => {
    const worker = read("sw.js");
    for (const asset of [
      "./index.html",
      "./manifest.webmanifest",
      "./styles.css",
      "./src/app.js",
      "./src/install-help.js",
      "./data/seed-data.js",
      "./data/canonical-content.json"
    ]) expect(worker).toContain(`"${asset}"`);
    expect(worker).toContain("new URL(path, self.registration.scope).href");
  });

  it("explains the iOS Add to Home Screen flow without requiring a developer account", () => {
    const help = read("src/install-help.js");
    expect(help).toContain("iPad|iPhone|iPod");
    expect(help).toContain("navigatorRef.standalone");
    expect(help).toContain("إضافة إلى الشاشة الرئيسية");
  });
});
