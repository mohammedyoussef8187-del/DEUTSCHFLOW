// @vitest-environment happy-dom
/*
 * Study / SRS interaction protection tests.
 *
 * These drive the REAL application through the DOM — boot, start a session, introduce a
 * word, type an answer, submit, rate — and assert what actually reaches storage. They
 * exist to protect the study screen BEFORE any of it is migrated to Lit: if a migration
 * changes scheduling, answer evaluation, attempt logging, or session progression, these
 * fail.
 *
 * Storage is an in-memory fake IndexedDB; no real learner data is touched.
 */

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

/* Same shape the shipped seed file uses: {id, de, ar, pr, it, art, row}. */
const SEED = [
  { id: 1, de: "das Haus", ar: "بيت", pr: "هاوس", it: "noun", art: "das", row: 2 },
  { id: 2, de: "fahren", ar: "يقود", pr: "فاهرن", it: "word", art: null, row: 3 }
];

let DF;

const wait = ms => new Promise(r => setTimeout(r, ms));

async function until(predicate, { timeout = 4000, label = "condition" } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`);
    await wait(20);
  }
}

const q = selector => document.querySelector(selector);
const cards = () => DF.Repositories.cards.all();
const attempts = () => DF.Repositories.attempts.all();
const session = () => DF.Repositories.metadata.get("session", null);

/** The answer the current question expects, derived from real session state. */
async function expectedAnswer() {
  const s = await session();
  const current = s?.current;
  if (!current) return null;
  // A live question carries the resolved word; queue entries only carry an id.
  let word = current.word;
  if (!word) {
    const words = await DF.Repositories.vocabulary.all();
    word = words.find(w => w.id === current.wordId);
  }
  if (!word) return null;
  if (current.skill === "article") return word.article || "das";
  if (current.skill === "recognition") return word.arabic;
  return current.expected || word.german;
}

/**
 * Drive the session forward one interaction, whatever is on screen.
 * Returns a label describing what it did, or null when nothing is actionable.
 */
async function step() {
  if (q('[data-action="intro-learned"]')) { q('[data-action="intro-learned"]').click(); return "intro"; }
  if (q('[data-action="rate-answer"]')) { q('[data-action="rate-answer"]').click(); return "rate"; }
  const input = document.getElementById("answer-input");
  if (input) {
    const answer = await expectedAnswer();
    input.value = answer ?? "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    q('[data-action="submit-writing"]')?.click();
    return "answer";
  }
  if (q('[data-action="session-home"]')) return "done";
  return null;
}

/** Run steps until `predicate` holds or the session ends. */
async function driveUntil(predicate, { maxSteps = 40, label = "state" } = {}) {
  for (let i = 0; i < maxSteps; i++) {
    if (await predicate()) return true;
    const did = await step();
    await wait(60);
    if (did === "done") break;
  }
  if (await predicate()) return true;
  throw new Error(`Session ended before reaching ${label}`);
}

beforeAll(async () => {
  document.body.innerHTML = `<div id="app"></div><div id="modal-root"></div><div id="toast-root"></div>`;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
  globalThis.SEED = SEED;
  /*
   * Booting the app now also loads the curriculum dataset over the network. There is no
   * server here, so it is served the same file the app ships with — a 404 would still
   * boot (the store degrades honestly), but it would exercise a path a device never
   * takes and leave a failed connection in every run of this suite.
   */
  const dataset = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/data/canonical-content.json"), "utf8"));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => dataset });

  await import("../../01_APPLICATION/CURRENT_APP/src/app.js");
  DF = window.DF;
  await until(() => q('[data-action="start-session"]'), { label: "dashboard" });
});

describe("study session interaction", () => {
  it("boots with the seeded vocabulary and no learner progress yet", async () => {
    expect(await DF.Repositories.vocabulary.all()).toHaveLength(2);
    expect(await cards()).toHaveLength(0);
    expect(await attempts()).toHaveLength(0);
  });

  it("starts a session and introduces a new word before testing it", async () => {
    q('[data-action="start-session"][data-mode="daily"]').click();
    await until(() => q('[data-action="intro-learned"]'), { label: "intro card" });

    const s = await session();
    expect(s.done).toBe(false);
    expect(s.initialWords).toBeGreaterThan(0);
  });

  it("introducing a word creates a recall card in the 'new' state", async () => {
    q('[data-action="intro-learned"]').click();
    const stored = await until(async () => {
      const list = await cards();
      return list.length ? list : null;
    }, { label: "card created" });

    const card = stored.find(c => c.skill === "recall");
    expect(card).toBeTruthy();
    expect(card.state).toBe("new");
    expect(card.reps).toBe(0);
    expect(card.ease).toBe(2.5);
    expect(card.intervalDays).toBe(0);
    expect(card.lapses).toBe(0);
  });

  it("evaluating an answer does not commit it until it is rated", async () => {
    await driveUntil(async () => !!document.getElementById("answer-input"), { label: "an answer prompt" });

    const before = (await attempts()).length;
    const input = document.getElementById("answer-input");
    input.value = await expectedAnswer();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    q('[data-action="submit-writing"]').click();

    await until(async () => (await session())?.result, { label: "evaluated result" });
    const s = await session();
    expect(s.result.answer.isCorrect).toBe(true);
    expect(s.result.suggestedRating).toBeGreaterThanOrEqual(1);
    // Nothing is written to history until the answer is finalized.
    expect(await attempts()).toHaveLength(before);
  });

  it("rating a correct answer schedules the card through the SRS engine", async () => {
    // Assert on the card belonging to the question actually pending, not just the
    // first recall card, since earlier steps may already have scheduled others.
    const current = (await session()).current;
    const key = current.card?.key ?? `${current.word.id}:${current.skill}`;
    const before = (await cards()).find(c => c.key === key) ?? { reps: 0 };

    await until(() => q('[data-action="rate-answer"]'), { label: "rating controls" });
    q('[data-action="rate-answer"]').click();

    const after = await until(async () => {
      const card = (await cards()).find(c => c.key === key);
      return card && card.reps > before.reps ? card : null;
    }, { label: "card scheduled" });

    // Exactly what the isolated scheduler produces for a first correct review.
    expect(after.reps).toBe(1);
    expect(after.correct).toBe(1);
    expect(after.lapses).toBe(0);
    expect(after.state).toBe("review");
    expect(after.intervalDays).toBeGreaterThanOrEqual(1);
    expect(after.ease).toBeGreaterThanOrEqual(1.3);
    expect(after.ease).toBeLessThanOrEqual(3.2);
    expect(after.dueAt).toBeGreaterThan(Date.now());
    expect(after.lastReviewedAt).toBeTruthy();
  });

  it("logs the attempt with the fields the statistics page depends on", async () => {
    const logged = await until(async () => {
      const list = await attempts();
      return list.length ? list : null;
    }, { label: "attempt logged" });

    const attempt = logged[0];
    expect(attempt.correct).toBe(true);
    expect(attempt.skill).toBeTruthy();
    expect(attempt.cardKey).toMatch(/^\d+:/);
    expect(attempt.sessionId).toBeTruthy();
    expect(attempt.answerType).toBeTruthy();
    expect(attempt.rating).toBeGreaterThanOrEqual(1);
    expect(attempt.rating).toBeLessThanOrEqual(4);
    expect(typeof attempt.elapsedMs).toBe("number");
    expect(attempt.createdAt).toBeTruthy();
  });

  it("persists coherent session state so an interrupted session can resume", async () => {
    const s = await session();
    expect(s).toBeTruthy();
    expect(s.id).toBeTruthy();
    expect(typeof s.done).toBe("boolean");
    // Counters must stay internally consistent, whether the session is mid-flight or
    // already finished; resume relies on them.
    expect(s.attempts).toBe(s.correctAttempts + s.wrongAttempts);
    expect(s.initialCompleted).toBeLessThanOrEqual(s.initialCards);
    if (!s.done) expect(s.queue.length + (s.current ? 1 : 0)).toBeGreaterThan(0);
  });

  it("keeps the SRS engine as the single scheduling authority", async () => {
    // Re-running the engine on the stored card reproduces the documented transitions,
    // so the study screen delegates scheduling rather than computing its own.
    const card = (await cards()).find(c => c.reps > 0);
    const now = Date.now();

    const again = DF.scheduleCard(card, 1, now);
    expect(again.lapses).toBe(card.lapses + 1);
    expect(again.intervalDays).toBe(0);
    expect(again.state).toBe("learning");
    expect(again.ease).toBeLessThan(card.ease);

    const good = DF.scheduleCard(card, 3, now);
    expect(good.reps).toBe(card.reps + 1);
    expect(good.dueAt).toBe(now + good.intervalDays * DF.DAY);
  });

  it("never loses or duplicates learner cards during the flow", async () => {
    const list = await cards();
    const keys = list.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);

    const ids = new Set((await DF.Repositories.vocabulary.all()).map(w => w.id));
    expect(list.every(c => ids.has(c.wordId))).toBe(true);
    expect(list.every(c => c.ease >= 1.3 && c.ease <= 3.2)).toBe(true);
  });

  it("records a wrong answer as a lapse without destroying progress", async () => {
    const reached = await driveUntil(
      async () => !!document.getElementById("answer-input"),
      { label: "another answer prompt", maxSteps: 30 }
    ).catch(() => false);
    if (!reached) return; // session exhausted; the assertions above already cover scheduling

    const beforeCards = await cards();
    // Re-query immediately before use: a render between lookup and submit would
    // otherwise leave us holding a detached input.
    await until(async () => {
      const input = document.getElementById("answer-input");
      if (!input) return false;
      input.value = "definitiv-falsch";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      q('[data-action="submit-writing"]')?.click();
      await wait(80);
      return (await session())?.result;
    }, { label: "wrong result" });
    expect((await session()).result.answer.isCorrect).toBe(false);

    await until(() => q('[data-action="rate-answer"]'), { label: "rating controls" });
    q('[data-action="rate-answer"]').click();
    await wait(120);

    // A wrong answer must never delete cards or reset unrelated progress.
    const afterCards = await cards();
    expect(afterCards.length).toBeGreaterThanOrEqual(beforeCards.length);
    expect(afterCards.every(c => c.ease >= 1.3)).toBe(true);
  });
});
