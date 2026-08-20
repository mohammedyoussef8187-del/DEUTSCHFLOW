export const ARTICLES = ["der", "die", "das"];
const AR_DIACRITICS = /[ؐ-ًؚ-ٟۖ-ۭ]/g;

export function normalizeGerman(s, { stripPunctuation = true } = {}) {
  let r = String(s ?? "").trim().normalize("NFC").replace(/\s+/g, " ").toLowerCase();
  if (stripPunctuation) r = r.replace(/[.,!?;:()\[\]{}"'«»„“”\/\\-]+/g, " ").replace(/\s+/g, " ").trim();
  return r;
}

export function normalizeArabic(s) {
  return String(s ?? "").trim().replace(AR_DIACRITICS, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[.,!?;:،؛()\[\]{}"'«»]/g, " ").replace(/\s+/g, " ").trim();
}

export function foldGerman(s, { ae = true, ss = true } = {}) {
  let r = String(s ?? "");
  if (ae) r = r.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue");
  if (ss) r = r.replace(/ß/g, "ss");
  return r;
}

export function splitArticle(german) {
  const raw = String(german ?? "").trim();
  const parts = raw.split(/\s+/);
  const article = ARTICLES.includes((parts[0] || "").toLowerCase()) ? parts[0].toLowerCase() : null;
  return { article, rest: article ? parts.slice(1).join(" ") : raw };
}

export function inferItemType(german, article = null) {
  const g = String(german ?? "").trim();
  if (article || splitArticle(g).article) return "noun";
  const words = g.split(/\s+/).filter(Boolean);
  if (/[.!?]$/.test(g) || words.length >= 5) return "sentence";
  if (words.length >= 2) return "phrase";
  return "word";
}
