/*
 * What a learner is allowed to see.
 *
 * The canonical schema has carried a content lifecycle since version 1: 24 content
 * tables declare `content_status TEXT NOT NULL DEFAULT 'draft'`, and the three legacy
 * vocabulary tables default to 'legacy'. The intended progression is
 *
 *     draft -> imported -> verified
 *
 * `draft` means authored but not published; `imported` means it came from a source
 * through the intake pipeline; `verified` means a human signed it off, and the intake
 * refuses to overwrite it.
 *
 * Until now nothing enforced the first step: a draft row read back exactly like a
 * published one, so the default the DDL declares had no effect. That is the gap this
 * module closes, and it closes it in ONE place — a read-only view of the canonical
 * source — rather than by adding a filter to each of the nine services, where the tenth
 * would eventually forget.
 *
 * WHY IT MATTERS NOW. The first open-licensed import contains two kinds of row side by
 * side: text transcribed from a CC BY source, and original DeutschFlow German and Arabic
 * that no educator has reviewed. Both are worth keeping — the second cannot be reviewed
 * if it was never imported — but only the first may be shown to a learner as teaching
 * material. `draft` is exactly that distinction, and the schema already had the word for
 * it.
 *
 * The filter is per ROW, not per aggregate, because the schema puts each language in its
 * own row: a sentence transcribed from the source can be published while its unreviewed
 * Arabic translation stays a draft, and the learner simply sees no Arabic. A row without
 * a `contentStatus` (a link, a segment, a speaker, a learner's own record) has no
 * lifecycle of its own and is never filtered; it appears or disappears with its parent.
 */

/** Not published. The DDL default for every authored content table. */
export const DRAFT_STATUS = "draft";

/**
 * True when a row may be shown to a learner.
 *
 * A row with no `contentStatus` at all is not content with a lifecycle — it is a link,
 * a timing, or a learner's own row — so it passes.
 */
export function isPublished(row) {
  if (!row || row.contentStatus === undefined || row.contentStatus === null) return true;
  return row.contentStatus !== DRAFT_STATUS;
}

export function publishedRows(rows) {
  return (rows ?? []).filter(isPublished);
}

/**
 * A read-only view of a canonical source in which draft rows do not exist.
 *
 * Writes, the SRS path and lifecycle are passed through by reference: this hides content
 * from a reader, it does not change what may be written. An importer therefore still
 * writes drafts, and an editor who later promotes one sees it appear — which is the
 * whole point of keeping it.
 */
export function publishedOnly(source) {
  if (!source) return source;

  const view = Object.create(null);
  for (const [key, value] of Object.entries(source)) {
    view[key] = looksLikeRepository(value) ? guard(value) : value;
  }
  return Object.freeze(view);
}

function looksLikeRepository(value) {
  return Boolean(value) && typeof value === "object" && typeof value.all === "function";
}

function guard(repository) {
  const guarded = Object.create(null);
  for (const [name, value] of entriesOf(repository)) {
    guarded[name] = typeof value === "function" ? value.bind(repository) : value;
  }

  if (typeof repository.all === "function") {
    guarded.all = async (...args) => publishedRows(await repository.all(...args));
  }
  if (typeof repository.find === "function") {
    guarded.find = async (...args) => publishedRows(await repository.find(...args));
  }
  if (typeof repository.get === "function") {
    guarded.get = async (...args) => onlyPublished(await repository.get(...args));
  }
  if (typeof repository.findOne === "function") {
    guarded.findOne = async (...args) => onlyPublished(await repository.findOne(...args));
  }
  if (typeof repository.exists === "function" && typeof repository.get === "function") {
    // Asked through this view, a draft row does not exist.
    guarded.exists = async uuid => isPublished(await repository.get(uuid)) &&
      Boolean(await repository.get(uuid));
  }
  if (typeof repository.count === "function" && typeof repository.find === "function") {
    // Counted from the same rows the view would return, so a screen and its number agree.
    guarded.count = async (where, options) =>
      publishedRows(await repository.find(where ?? {}, options)).length;
  }
  return Object.freeze(guarded);
}

function onlyPublished(row) {
  return isPublished(row) ? row : null;
}

function entriesOf(object) {
  const seen = new Set();
  const out = [];
  for (let current = object; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (key === "constructor" || seen.has(key)) continue;
      seen.add(key);
      out.push([key, object[key]]);
    }
  }
  return out;
}
