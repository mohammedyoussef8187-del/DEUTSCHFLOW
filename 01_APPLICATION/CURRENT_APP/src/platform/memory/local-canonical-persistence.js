/*
 * Where the local canonical store keeps its two inputs in a browser.
 *
 * Both are deliberately thin and injectable, so the store itself has no idea whether it
 * is talking to a network, a disk or a test double.
 *
 * The learner state goes into its OWN IndexedDB database, not the legacy `deutschflow_v2`
 * one. The legacy database holds the vocabulary and the SRS history a learner has built
 * up over months; a new writer sharing it could corrupt that during an upgrade, and the
 * whole point of the storage gate is that nothing new touches it until the device
 * validation passes.
 */

/** The canonical store's own database. Separate from `deutschflow_v2`, on purpose. */
export const LOCAL_DB_NAME = "deutschflow_canonical_local";
export const LOCAL_DB_VERSION = 1;
export const LOCAL_STORE_NAME = "state";
export const LOCAL_STATE_KEY = "learner";

/**
 * Learner state persisted in IndexedDB.
 * Every method resolves rather than throwing on an unavailable database: losing
 * durability must not take the app down with it.
 */
export function createIndexedDbStatePersistence(options = {}) {
  const factory = options.indexedDB ?? globalThis.indexedDB ?? null;
  const name = options.name ?? LOCAL_DB_NAME;
  const key = options.key ?? LOCAL_STATE_KEY;

  const open = () => new Promise((resolve, reject) => {
    if (!factory) { reject(new Error("IndexedDB is unavailable")); return; }
    const request = factory.open(name, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE_NAME)) db.createObjectStore(LOCAL_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });

  const run = (mode, work) => open().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_STORE_NAME, mode);
    const store = transaction.objectStore(LOCAL_STORE_NAME);
    let result;
    try {
      work(store, value => { result = value; });
    } catch (error) {
      transaction.abort();
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  }));

  return Object.freeze({
    async read() {
      return run("readonly", (store, done) => {
        const request = store.get(key);
        request.onsuccess = () => done(request.result ?? null);
      });
    },

    async write(state) {
      // Structured-clone cannot carry a frozen prototype chain or a Proxy, and the store
      // hands over plain rows, so the state is written as-is.
      return run("readwrite", store => { store.put(state, key); });
    },

    async clear() {
      return run("readwrite", store => { store.delete(key); });
    }
  });
}

/**
 * The shipped content dataset, fetched as a static file.
 *
 * `cache: "no-cache"` asks for a revalidation rather than a blind reuse, so a rebuilt
 * dataset is picked up on the next launch; the service worker still serves it from the
 * cache when the device is offline, which is the case that matters most.
 */
export function createContentFetcher(options = {}) {
  const url = options.url ?? "data/canonical-content.json";
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis) ?? null;

  return async function loadContent() {
    if (!fetchImpl) throw new Error("fetch is unavailable");
    const response = await fetchImpl(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`content dataset ${response.status}`);
    return response.json();
  };
}
