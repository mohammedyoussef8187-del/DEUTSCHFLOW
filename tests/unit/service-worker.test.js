/*
 * Service worker offline contract.
 *
 * The app is offline-first, but the previous worker only precached the shell and never
 * wrote to the cache afterwards, so modules, styles, and seed data missed on every
 * offline request. These tests run the real worker against fake caches/fetch.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SW_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/sw.js"), "utf8"
);

function makeWorker({ online = true } = {}) {
  const store = new Map();
  const cache = {
    add: vi.fn(async req => { if (!online) throw new Error("offline"); store.set(String(req.url ?? req), "shell"); }),
    put: vi.fn(async (req, res) => { store.set(String(req.url ?? req), res); }),
    match: vi.fn(async req => store.get(String(req.url ?? req)))
  };
  const listeners = {};
  const context = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
      location: { origin: "https://app.test" }
    },
    caches: {
      open: vi.fn(async () => cache),
      keys: vi.fn(async () => ["deutschflow-old"]),
      delete: vi.fn(async () => true),
      match: cache.match
    },
    fetch: vi.fn(async () => {
      if (!online) throw new Error("offline");
      return { ok: true, type: "basic", clone: () => ({ body: "copy" }) };
    }),
    Request: class { constructor(url, opts) { this.url = url; this.opts = opts; } },
    URL
  };
  vm.createContext(context);
  vm.runInContext(SW_SOURCE, context);
  return { listeners, cache, store, context };
}

const waitUntil = () => { let p; return { waitUntil: v => { p = v; }, get promise() { return p; } }; };

describe("service worker", () => {
  it("precaches the shell including the app entry, styles, and seed data", async () => {
    const { listeners, store } = makeWorker();
    const e = waitUntil();
    listeners.install(e);
    await e.promise;
    const cached = [...store.keys()];
    for (const asset of ["/index.html", "/styles.css", "/src/app.js", "/data/seed-data.js"]) {
      expect(cached, `missing ${asset}`).toContain(asset);
    }
  });

  it("survives an asset that cannot be precached", async () => {
    const { listeners, context } = makeWorker({ online: false });
    const e = waitUntil();
    listeners.install(e);
    // Install must complete rather than reject when a single asset fails.
    await expect(e.promise).resolves.toBeUndefined();
    expect(context.self.skipWaiting).toHaveBeenCalled();
  });

  it("stores successful same-origin responses so the next offline load works", async () => {
    const { listeners, cache } = makeWorker();
    let responded;
    listeners.fetch({
      request: { method: "GET", mode: "cors", url: "https://app.test/vendor/lit.js" },
      respondWith: p => { responded = p; }
    });
    await responded;
    await new Promise(r => setTimeout(r, 0));
    expect(cache.put).toHaveBeenCalled();
  });

  it("falls back to the cache when the network is gone", async () => {
    const { listeners, store, context } = makeWorker({ online: false });
    store.set("https://app.test/src/app.js", "cached-module");
    let responded;
    listeners.fetch({
      request: { method: "GET", mode: "cors", url: "https://app.test/src/app.js" },
      respondWith: p => { responded = p; }
    });
    expect(await responded).toBe("cached-module");
    expect(context.fetch).toHaveBeenCalled();
  });

  it("serves the shell for navigations when offline", async () => {
    const { listeners, store } = makeWorker({ online: false });
    store.set("/index.html", "shell-html");
    let responded;
    listeners.fetch({
      request: { method: "GET", mode: "navigate", url: "https://app.test/words" },
      respondWith: p => { responded = p; }
    });
    expect(await responded).toBe("shell-html");
  });

  it("ignores non-GET and cross-origin requests", async () => {
    const { listeners } = makeWorker();
    let called = false;
    const respondWith = () => { called = true; };
    listeners.fetch({ request: { method: "POST", mode: "cors", url: "https://app.test/x" }, respondWith });
    listeners.fetch({ request: { method: "GET", mode: "cors", url: "https://other.test/x" }, respondWith });
    expect(called).toBe(false);
  });

  it("drops caches from previous versions on activate", async () => {
    const { listeners, context } = makeWorker();
    const e = waitUntil();
    listeners.activate(e);
    await e.promise;
    expect(context.caches.delete).toHaveBeenCalledWith("deutschflow-old");
  });
});
