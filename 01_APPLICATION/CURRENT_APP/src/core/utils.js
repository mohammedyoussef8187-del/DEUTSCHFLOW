export const DAY = 86400000;
export const MINUTE = 60000;

export const DEFAULT_SETTINGS = {
  schemaVersion: 5,
  theme: "auto",
  newPerDay: 12,
  reviewsPerDay: 40,
  sessionSize: 20,
  retryLimit: 2,
  showPronunciation: true,
  acceptAeOeUe: true,
  acceptSs: true,
  requireArticle: true,
  ignoreSentencePunctuation: true,
  dailyGoal: 25,
  autoPlayAudio: false,
  compactMode: false,
  difficultyMode: "hard",
  strictArabicAnswers: true,
  enableOrderPractice: false,
  typedArticleInHardMode: true,
  avoidRecentSessionOrder: true,
  maxSameItemTypeStreak: 2,
  useMeaningChoices: false,
  randomizeSession: true,
  retryGapMin: 5,
  retryGapMax: 8
};

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}

export function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, n)); }
export function round(n, d = 0) { const p = 10 ** d; return Math.round(n * p) / p; }

export function randomUnit() {
  if (globalThis.crypto?.getRandomValues) {
    const b = new Uint32Array(1); globalThis.crypto.getRandomValues(b); return b[0] / 4294967296;
  }
  return Math.random();
}

export function randomInt(max) { return max > 0 ? Math.floor(randomUnit() * max) : 0; }
export function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sample(list, n) { return shuffle(list).slice(0, n); }
export function uniqueBy(list, keyFn) { const seen = new Set(); return list.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; }); }

export function localDateKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(ts = Date.now()) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function formatDate(ts) { if (!ts) return "—"; return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(ts)); }
export function formatRelative(ts, now = Date.now()) {
  if (!ts) return "غير مجدولة";
  const diff = ts - now;
  const abs = Math.abs(diff);
  if (abs < 45 * MINUTE) { const m = Math.max(1, Math.round(abs / MINUTE)); return diff <= 0 ? `منذ ${m} دقيقة` : `بعد ${m} دقيقة`; }
  const days = Math.round(abs / DAY);
  if (days === 0) return diff <= 0 ? "مستحقة اليوم" : "لاحقاً اليوم";
  if (days === 1) return diff <= 0 ? "منذ يوم" : "غداً";
  return diff <= 0 ? `متأخرة ${days} أيام` : `بعد ${days} أيام`;
}
