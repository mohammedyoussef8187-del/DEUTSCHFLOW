/*
 * Stage 1b: TEXT-LAYER ASSESSMENT.
 *
 * A PDF can carry three very different things behind the same file extension: a real
 * digital text layer, an OCR guess at a scan, or nothing at all. Only the first is a
 * source. The second is a probabilistic reading of a picture, and for a LANGUAGE COURSE
 * it is worse than useless — a scanner that reads "Dengler" as "Dcngler" and "Lösungen"
 * as "Losungen" will happily hand us misspelled German to store as verified vocabulary.
 *
 * So the pipeline measures the text layer before it parses anything, and refuses sources
 * that cannot support the claim "this is what the page says". The measurement is
 * deterministic and reproducible: same bytes, same verdict.
 *
 * Nothing here tries to REPAIR bad text. Correcting OCR means guessing what the page
 * probably said, which is precisely the kind of invention the intake rules forbid.
 */

export const TEXT_LAYER = Object.freeze({
  DIGITAL: "digital",        // a real text layer; parseable
  SPARSE: "sparse",          // far too little text for the page count
  OCR_DEGRADED: "ocr-degraded", // text exists but is a corrupted machine reading
  ABSENT: "absent"           // no text at all
});

/** Below this many characters per page, a book is a picture of a book. */
export const MIN_CHARS_PER_PAGE = 200;

/*
 * Fingerprints of scanner confusion, drawn from what German OCR actually gets wrong:
 * e/c, u/ü, n/r, tt/ct, and stray glyphs where ligatures or symbols used to be.
 * Each is a pattern that essentially never occurs in correctly typeset German.
 */
const OCR_SIGNALS = Object.freeze([
  { code: "impossible-consonant-run", pattern: /\b\w*[bcdfghjklmnpqrstvwxz]{5,}\w*\b/g },
  { code: "stray-symbol-in-word", pattern: /\w[♦§¤¦^~|_]+\w/g },
  { code: "lonely-digit-in-word", pattern: /[A-Za-zÄÖÜäöüß]\d[A-Za-zÄÖÜäöüß]/g },
  { code: "broken-umlaut-word", pattern: /\b(Losungen|Ubungen|Uber|fur|konnen|mussen|Bucher|horen|Lander)\b/g },
  { code: "mixed-case-inside-word", pattern: /\b[a-zäöüß]+[A-ZÄÖÜ][a-zäöüß]+\b/g }
]);

/** Words a correctly-read German page is overwhelmingly likely to contain. */
const GERMAN_MARKERS = /\b(und|der|die|das|Sie|nicht|mit|ein|eine|ist|zu|für|über|Übung|Kapitel|Seite)\b/g;

/**
 * Measure one document's text layer.
 *
 * @param {string} text   the full extracted text
 * @param {number} pages  how many pages it came from
 */
export function assessTextLayer(text, pages) {
  const content = String(text ?? "");
  const pageCount = Math.max(1, Number(pages) || 1);
  const stripped = content.replace(/\f/g, "");
  const charsPerPage = stripped.length / pageCount;

  const words = stripped.match(/[A-Za-zÄÖÜäöüß]{2,}/g) ?? [];
  const germanMarkers = (stripped.match(GERMAN_MARKERS) ?? []).length;

  const signals = OCR_SIGNALS.map(signal => ({
    code: signal.code,
    hits: (stripped.match(signal.pattern) ?? []).length
  })).filter(signal => signal.hits > 0);

  const suspectHits = signals.reduce((sum, signal) => sum + signal.hits, 0);
  // Suspect glyph patterns as a share of all words: a rate, so page count cannot flatter
  // a short document or condemn a long one.
  const suspectRate = words.length ? suspectHits / words.length : 0;

  let verdict;
  if (stripped.trim().length === 0) verdict = TEXT_LAYER.ABSENT;
  else if (charsPerPage < MIN_CHARS_PER_PAGE) verdict = TEXT_LAYER.SPARSE;
  else if (suspectRate > 0.02 || (germanMarkers === 0 && words.length > 200)) {
    verdict = TEXT_LAYER.OCR_DEGRADED;
  } else verdict = TEXT_LAYER.DIGITAL;

  return {
    verdict,
    parseable: verdict === TEXT_LAYER.DIGITAL,
    pages: pageCount,
    characters: stripped.length,
    charsPerPage: Math.round(charsPerPage * 10) / 10,
    words: words.length,
    germanMarkers,
    suspectHits,
    suspectRate: Math.round(suspectRate * 10000) / 10000,
    signals,
    reason: reasonFor(verdict)
  };
}

function reasonFor(verdict) {
  switch (verdict) {
    case TEXT_LAYER.ABSENT:
      return "the document carries no text layer at all; it is a picture of a book";
    case TEXT_LAYER.SPARSE:
      return "far too little text for the page count; the pages are images, not text";
    case TEXT_LAYER.OCR_DEGRADED:
      return "the text layer is a corrupted machine reading; storing it would store misspelled German";
    default:
      return null;
  }
}

/**
 * A short sample of the worst-looking lines, so a person can see WHY a document was
 * refused rather than having to trust a score.
 */
export function suspectSamples(text, limit = 5) {
  const lines = String(text ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const scored = lines.map(line => {
    const words = (line.match(/[A-Za-zÄÖÜäöüß]{2,}/g) ?? []).length;
    const hits = OCR_SIGNALS.reduce(
      (sum, signal) => sum + ((line.match(signal.pattern) ?? []).length), 0);
    return { line, hits, rate: words ? hits / words : 0 };
  });
  return scored
    .filter(entry => entry.hits > 0)
    .sort((a, b) => b.rate - a.rate || b.hits - a.hits)
    .slice(0, limit)
    .map(entry => entry.line.slice(0, 120));
}
