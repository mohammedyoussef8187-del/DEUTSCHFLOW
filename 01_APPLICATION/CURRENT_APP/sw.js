/*
 * DeutschFlow service worker.
 *
 * Strategy: network-first with a cache fallback, so an online learner always gets fresh
 * code and an offline one still gets the app.
 *
 * Previously the cache was only ever seeded with the shell (index.html, manifest,
 * icons) and nothing wrote to it afterwards, so every module, stylesheet, and the seed
 * data fell through to `caches.match` and missed. The app therefore did not actually
 * work offline despite being an offline-first PWA. Successful same-origin GETs are now
 * copied into the cache as they are fetched, which covers the ES module graph
 * (src/app.js and everything it imports, including vendor/lit.js) without having to
 * list every file here.
 */

const CACHE = "deutschflow-pro-rc5-2026-08-22";

// Enough to boot offline even before anything else has been visited.
const SHELL = [
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/styles.css",
  "/src/app.js",
  "/data/seed-data.js",
  // The curriculum has to be on the device before the device goes offline.
  "/data/canonical-content.json"
];

self.addEventListener("install", e => e.waitUntil(
  caches.open(CACHE)
    // Individually, so one missing asset cannot fail the whole install.
    .then(c => Promise.all(SHELL.map(url =>
      c.add(new Request(url, { cache: "reload" })).catch(() => null)
    )))
    .then(() => self.skipWaiting())
));

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(
      keys.filter(k => k.startsWith("deutschflow-") && k !== CACHE).map(k => caches.delete(k))
    ))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Keep a copy so the next offline launch can serve it.
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
