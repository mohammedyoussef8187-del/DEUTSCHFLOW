/*
 * Deterministic, platform-neutral identifier generation for structural migration.
 *
 * Requirements:
 *   - Stable: the same (namespace, name) always yields the same UUID, so re-running
 *     migration is idempotent and child records (cards, events) can be linked to their
 *     parents purely by legacy identity without a shared mutable counter.
 *   - Dependency-free: pure integer math only, so identical output on Node (tests) and
 *     inside the Capacitor WebView (device) without Node crypto or async WebCrypto.
 *
 * The output is formatted as an RFC-4122-shaped UUID string (version/variant nibbles set)
 * for schema compatibility. It is a deterministic hash, not a random v4 UUID.
 */

function hash128(input) {
  const str = String(input);
  // xmur3-style seeded state, then pulled four times for 16 bytes.
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    const v = next();
    bytes[i * 4] = (v >>> 24) & 0xff;
    bytes[i * 4 + 1] = (v >>> 16) & 0xff;
    bytes[i * 4 + 2] = (v >>> 8) & 0xff;
    bytes[i * 4 + 3] = v & 0xff;
  }
  return bytes;
}

export function deterministicUuid(namespace, name) {
  const bytes = hash128(`${namespace}::${name}`);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5 (name-based) nibble
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

// Fixed namespace tokens so identity is derived consistently across runs and modules.
export const NS = Object.freeze({
  profile: "deutschflow/profile",
  settings: "deutschflow/settings",
  vocab: "deutschflow/vocabulary_item",
  meaning: "deutschflow/vocabulary_meaning",
  acceptedAnswer: "deutschflow/accepted_answer",
  card: "deutschflow/review_card",
  event: "deutschflow/review_event"
});
