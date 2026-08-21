/*
 * Runtime feature gates.
 *
 * There are TWO independent switches here, and keeping them independent is the point:
 *
 *   learnerStorageSwitch  — does a learner's SRS history live in SQLite?
 *                           STILL OFF. Blocked on physical-device validation. Flipping
 *                           it moves real, irreplaceable learner data.
 *
 *   canonicalRuntime      — are the Feature A–I screens backed by the canonical store
 *                           at runtime? Independent, because reading authored content
 *                           and recording course progress risks nothing a learner
 *                           earned: SRS rows are not involved, and the canonical
 *                           database is separate from the legacy one.
 *
 * Conflating the two would mean the new features could not be reached until the device
 * gate passed, which would hold nine finished features hostage to a hardware account.
 * Separating them means the new screens can be real now, while the SRS history stays
 * exactly where it is.
 *
 * On a web/PWA target the canonical runtime resolves to an EMPTY source rather than a
 * fabricated one: the screens render honest "nothing authored yet" states instead of
 * pretending. No second implementation of the canonical model is built for the browser.
 */

export const RUNTIME_GATES = Object.freeze({
  /** Unchanged. Learner SRS data stays in IndexedDB until the device gate passes. */
  learnerStorageSwitch: false,

  /** The A–I screens may be wired up and reached. */
  canonicalRuntime: true,

  /**
   * The canonical store may be OPENED on a native build. Off until the same device
   * validation that gates learner storage has been run, because opening a second
   * database on device is itself untested on hardware.
   */
  canonicalNativeStore: false,

  /** Local notifications may be scheduled. Off until device validation. */
  nativeNotifications: false
});

export function isEnabled(gate, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, gate)) return Boolean(overrides[gate]);
  return Boolean(RUNTIME_GATES[gate]);
}
