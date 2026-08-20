const CACHE="deutschflow-v2.0.0";
const ASSETS=["./","./index.html","./styles.css","./data.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./js/core.js","./js/db.js","./js/learning.js","./js/import-export.js","./js/ui.js","./js/app.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response;
  }).catch(()=>caches.match("./index.html"))));
});
