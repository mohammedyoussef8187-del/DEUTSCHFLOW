/*
 * Feature F — error learning.
 *
 * The two rules this suite defends hardest:
 *   - Arabic is recorded and taught from, but never classified deterministically and
 *     never allowed to drive practice.
 *   - Error learning suggests; it never schedules. No SRS field is read or written.
 */

import { describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_CATEGORIES, CATEGORY_TEXT_KINDS, ERROR_SCOPES, ERROR_SOURCES, PATTERN_STATUS,
  aggregatePatterns, buildErrorEvent, categoryForEvaluationType, classifyEvaluation,
  createErrorService, patternStatus, practiceQueue, recordEvaluation, remediationFor,
  summarizeErrors
} from "../../01_APPLICATION/CURRENT_APP/src/services/error-service.js";
import {
  evaluateArabicAdvisory, validateGermanAnswer
} from "../../01_APPLICATION/CURRENT_APP/src/exercises/answer-evaluator.js";
import { DEFAULT_SETTINGS } from "../../01_APPLICATION/CURRENT_APP/src/core/utils.js";
import { migrateToCanonical } from "../../01_APPLICATION/CURRENT_APP/src/migration/canonical-migration.js";

const NOW = 1775000000000;
const DAY = 86400000;
const PROFILE = "profile-1";
const meta = { contentStatus: "verified", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

const WORD = { id: 1, german: "das Haus", arabic: "بيت", itemType: "noun", article: "das", level: "A1" };

/* --------------------------------------------------------------- fixtures */

function categories() {
  return [
    { uuid: "cat-article-wrong", slug: "article-wrong", scope: ERROR_SCOPES.MORPHOLOGY, ordering: 1, ...meta },
    { uuid: "cat-typo", slug: "spelling-typo", scope: ERROR_SCOPES.ORTHOGRAPHY, ordering: 2, ...meta },
    { uuid: "cat-meaning", slug: "meaning-mismatch", scope: ERROR_SCOPES.LEXIS, ordering: 3, ...meta }
  ];
}

function event(uuid, over = {}) {
  return {
    uuid, profileUuid: PROFILE, occurredAt: NOW, sessionUuid: null, skill: "recall",
    answerLanguage: "de", contentType: "vocabulary", contentUuid: "v-haus",
    evaluationType: "article_wrong", scored: 1, expectedAnswer: "das Haus", userAnswer: "der Haus",
    ...linkMeta, ...over
  };
}

function link(uuid, eventUuid, categoryUuid, over = {}) {
  return { uuid, eventUuid, categoryUuid, source: ERROR_SOURCES.DETERMINISTIC, confidence: 1, ...linkMeta, ...over };
}

function canonical(over = {}) {
  return {
    errorCategories: categories(),
    errorCategoryTexts: [
      { uuid: "t1", categoryUuid: "cat-article-wrong", language: "en", kind: "name", text: "Wrong article", ...meta },
      { uuid: "t2", categoryUuid: "cat-article-wrong", language: "ar", kind: "name", text: "أداة خاطئة", ...meta },
      { uuid: "t3", categoryUuid: "cat-article-wrong", language: "en", kind: "advice", text: "Learn the gender with the noun.", ...meta }
      // No Arabic advice: untranslated, not broken.
    ],
    errorRemediations: [
      { uuid: "r1", categoryUuid: "cat-article-wrong", contentType: "grammar_rule", contentUuid: "rule-gender", ordering: 1, ...linkMeta },
      { uuid: "r2", categoryUuid: "cat-article-wrong", contentType: "exercise", contentUuid: "x-articles", ordering: 2, ...linkMeta }
    ],
    errorEvents: [
      event("e1", { occurredAt: NOW - 3 * DAY }),
      event("e2", { occurredAt: NOW - 2 * DAY }),
      event("e3", { occurredAt: NOW - DAY, contentUuid: "v-brot", evaluationType: "minor_typo", userAnswer: "Brott" })
    ],
    errorEventCategories: [
      link("l1", "e1", "cat-article-wrong"),
      link("l2", "e2", "cat-article-wrong"),
      link("l3", "e3", "cat-typo")
    ],
    errorPatterns: [],
    ...over
  };
}

/* ------------------------------------------------------------- taxonomy */

describe("taxonomy", () => {
  it("covers every verdict the deterministic evaluator can return", () => {
    const emitted = ["empty", "perfect", "capitalization", "punctuation", "article_missing",
      "article_wrong", "umlaut_variant", "wrong_order", "incomplete", "minor_typo", "wrong",
      "acceptable_paraphrase"];
    const unmapped = emitted.filter(type => type !== "perfect" && !categoryForEvaluationType(type));
    expect(unmapped).toEqual([]);
    // "perfect" deliberately has no category: there is nothing to learn from.
    expect(categoryForEvaluationType("perfect")).toBeNull();
  });

  it("exposes the built-in categories with stable slugs and scopes", () => {
    const slugs = BUILT_IN_CATEGORIES.map(c => c.slug);
    expect(slugs).toContain("article-wrong");
    expect(slugs).toContain("word-order");
    expect(new Set(slugs).size).toBe(slugs.length);      // no duplicates
    expect(BUILT_IN_CATEGORIES.find(c => c.slug === "word-order").scope).toBe(ERROR_SCOPES.SYNTAX);
  });
});

/* ------------------------------------------------------------ classifying */

describe("classifying a verdict", () => {
  it("classifies a real German article mistake deterministically", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    expect(evaluation.type).toBe("article_wrong");

    const verdict = classifyEvaluation(evaluation, { language: "de" });
    expect(verdict).toMatchObject({ recordable: true, isError: true, isNearMiss: false, scored: true });
    expect(verdict.categories[0]).toMatchObject({
      slug: "article-wrong", source: ERROR_SOURCES.DETERMINISTIC, confidence: 1
    });
  });

  it("classifies a typo from the evaluator's own verdict rather than re-deciding", () => {
    const evaluation = validateGermanAnswer("das Hause", WORD, DEFAULT_SETTINGS);
    expect(evaluation.type).toBe("minor_typo");
    expect(classifyEvaluation(evaluation, { language: "de" }).categories[0].slug).toBe("spelling-typo");
  });

  it("treats an accepted near miss as teachable but not a mistake", () => {
    const evaluation = validateGermanAnswer("das haus", WORD, DEFAULT_SETTINGS);
    expect(evaluation.isCorrect).toBe(true);
    const verdict = classifyEvaluation(evaluation, { language: "de" });
    expect(verdict).toMatchObject({ recordable: true, isError: false, isNearMiss: true });
    expect(verdict.categories[0].slug).toBe("capitalization");
  });

  it("records nothing for a perfect answer", () => {
    const evaluation = validateGermanAnswer("das Haus", WORD, DEFAULT_SETTINGS);
    expect(classifyEvaluation(evaluation, { language: "de" }).recordable).toBe(false);
    expect(recordEvaluation(evaluation, { profileUuid: PROFILE, answerLanguage: "de" })).toBeNull();
  });

  it("never classifies an Arabic answer deterministically", () => {
    const evaluation = evaluateArabicAdvisory("خبز", WORD);
    expect(evaluation.isCorrect).toBeNull();             // the evaluator surrendered its verdict

    const verdict = classifyEvaluation(evaluation, { language: "ar" });
    expect(verdict.scored).toBe(false);
    expect(verdict.categories.every(c => c.source === ERROR_SOURCES.ADVISORY)).toBe(true);
  });

  it("keeps English scoreable, so English mistakes classify deterministically", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    expect(classifyEvaluation(evaluation, { language: "en" }).categories[0].source)
      .toBe(ERROR_SOURCES.DETERMINISTIC);
    expect(classifyEvaluation(evaluation, { language: "ar" }).categories[0].source)
      .toBe(ERROR_SOURCES.ADVISORY);
  });

  it("normalizes a regional language tag before deciding", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    expect(classifyEvaluation(evaluation, { language: "en-GB" }).scored).toBe(true);
    expect(classifyEvaluation(evaluation, { language: "AR_EG" }).scored).toBe(false);
  });

  it("accepts an AI hint only as advisory, alongside the deterministic one", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    const verdict = classifyEvaluation(evaluation, {
      language: "de",
      advisory: [{ slug: "gender-confusion", confidence: 0.8 }]
    });
    expect(verdict.categories.map(c => [c.slug, c.source])).toEqual([
      ["article-wrong", ERROR_SOURCES.DETERMINISTIC],
      ["gender-confusion", ERROR_SOURCES.ADVISORY]
    ]);
  });

  it("clamps an out-of-range or missing AI confidence instead of trusting it", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    const verdict = classifyEvaluation(evaluation, {
      language: "de",
      advisory: [{ slug: "a", confidence: 9 }, { slug: "b", confidence: -1 }, { slug: "c" }]
    });
    expect(verdict.categories.slice(1).map(c => c.confidence)).toEqual([1, 0, 0]);
  });

  it("passes an AI hint through even when the answer was perfect, still as advisory", () => {
    const evaluation = validateGermanAnswer("das Haus", WORD, DEFAULT_SETTINGS);
    const verdict = classifyEvaluation(evaluation, {
      language: "de", advisory: [{ slug: "style", confidence: 0.5 }]
    });
    expect(verdict).toMatchObject({ recordable: true, isError: false, scored: false });
    expect(verdict.categories).toEqual([
      { slug: "style", source: ERROR_SOURCES.ADVISORY, confidence: 0.5 }
    ]);
  });
});

/* -------------------------------------------------------------- recording */

describe("recording an event", () => {
  const context = { profileUuid: PROFILE, skill: "recall", answerLanguage: "de",
    contentType: "vocabulary", contentUuid: "v-haus", occurredAt: NOW };

  it("builds an event and its category links from one verdict", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    const recorded = recordEvaluation(evaluation, context, { now: NOW });

    expect(recorded.event).toMatchObject({
      profileUuid: PROFILE, occurredAt: NOW, skill: "recall", answerLanguage: "de",
      contentType: "vocabulary", contentUuid: "v-haus",
      evaluationType: "article_wrong", scored: 1,
      expectedAnswer: "das Haus", userAnswer: "der Haus"
    });
    expect(recorded.links).toHaveLength(1);
    expect(recorded.links[0]).toMatchObject({
      eventUuid: recorded.event.uuid, categoryUuid: "article-wrong", source: ERROR_SOURCES.DETERMINISTIC
    });
  });

  it("stores an Arabic mistake with scored = 0", () => {
    const evaluation = evaluateArabicAdvisory("خبز", WORD);
    const recorded = recordEvaluation(evaluation, { ...context, answerLanguage: "ar" }, { now: NOW });
    expect(recorded.event.scored).toBe(0);
    expect(recorded.event.answerLanguage).toBe("ar");
    expect(recorded.links[0].source).toBe(ERROR_SOURCES.ADVISORY);
  });

  it("is idempotent: replaying the same mistake produces the same identity", () => {
    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    const a = recordEvaluation(evaluation, context, { now: NOW });
    const b = recordEvaluation(evaluation, context, { now: NOW + 5000 });
    expect(b.event.uuid).toBe(a.event.uuid);
    expect(b.links[0].uuid).toBe(a.links[0].uuid);
  });

  it("gives different mistakes different identities", () => {
    const a = recordEvaluation(validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS), context, { now: NOW });
    const b = recordEvaluation(validateGermanAnswer("die Haus", WORD, DEFAULT_SETTINGS), context, { now: NOW });
    expect(b.event.uuid).not.toBe(a.event.uuid);
  });

  it("does not invent a timestamp when one is given", () => {
    const built = buildErrorEvent(
      { profileUuid: PROFILE, occurredAt: 123, evaluationType: "wrong" }, [], { now: NOW });
    expect(built.event.occurredAt).toBe(123);
    expect(built.event.createdAt).toBe(NOW);
  });

  it("stores scored as 0/1 rather than a truthy value", () => {
    const built = buildErrorEvent({ profileUuid: PROFILE, evaluationType: "wrong", scored: "yes" }, [], { now: NOW });
    expect(built.event.scored).toBe(1);
    expect(buildErrorEvent({ profileUuid: PROFILE, evaluationType: "wrong" }, [], { now: NOW }).event.scored).toBe(0);
  });
});

/* ------------------------------------------------------------ aggregating */

describe("patterns", () => {
  it("counts repeated mistakes per category and item", () => {
    const patterns = aggregatePatterns(canonical(), PROFILE);
    expect(patterns[0]).toMatchObject({
      categorySlug: "article-wrong", contentUuid: "v-haus", occurrences: 2, scoredOccurrences: 2
    });
    expect(patterns[1]).toMatchObject({ categorySlug: "spelling-typo", contentUuid: "v-brot", occurrences: 1 });
  });

  it("tracks first and last occurrence", () => {
    const [top] = aggregatePatterns(canonical(), PROFILE);
    expect(top.firstSeenAt).toBe(NOW - 3 * DAY);
    expect(top.lastSeenAt).toBe(NOW - 2 * DAY);
  });

  it("excludes advisory classifications from patterns by default", () => {
    const data = canonical({
      errorEvents: [event("e1", { answerLanguage: "ar", scored: 0 })],
      errorEventCategories: [link("l1", "e1", "cat-article-wrong", { source: ERROR_SOURCES.ADVISORY })]
    });
    expect(aggregatePatterns(data, PROFILE)).toEqual([]);
    expect(aggregatePatterns(data, PROFILE, { includeAdvisory: true })).toHaveLength(1);
  });

  it("ignores another learner's mistakes", () => {
    const data = canonical({ errorEvents: [event("e1", { profileUuid: "someone-else" })] });
    expect(aggregatePatterns(data, PROFILE)).toEqual([]);
  });

  it("ignores soft-deleted events and links", () => {
    const data = canonical();
    data.errorEvents[0].deleted = 1;
    data.errorEventCategories[1].deleted = 1;   // the other article-wrong link
    expect(aggregatePatterns(data, PROFILE).map(p => p.categorySlug)).toEqual(["spelling-typo"]);
  });

  it("drops a link whose event is missing rather than counting a ghost", () => {
    const data = canonical({ errorEventCategories: [link("l9", "e-missing", "cat-typo")] });
    expect(aggregatePatterns(data, PROFILE)).toEqual([]);
  });

  it("orders by frequency, then recency, then slug — deterministically", () => {
    const data = canonical({
      errorEvents: [
        event("e1", { occurredAt: NOW - DAY, contentUuid: "v-a" }),
        event("e2", { occurredAt: NOW, contentUuid: "v-b" })
      ],
      errorEventCategories: [link("l1", "e1", "cat-typo"), link("l2", "e2", "cat-article-wrong")]
    });
    const once = aggregatePatterns(data, PROFILE).map(p => p.contentUuid);
    expect(once).toEqual(["v-b", "v-a"]);                        // same count, newer first
    expect(aggregatePatterns(data, PROFILE).map(p => p.contentUuid)).toEqual(once);
  });

  it("reports a quiet pattern as improving and a stored resolution as resolved", () => {
    expect(patternStatus({ lastSeenAt: NOW }, { now: NOW })).toBe(PATTERN_STATUS.ACTIVE);
    expect(patternStatus({ lastSeenAt: NOW - 30 * DAY }, { now: NOW })).toBe(PATTERN_STATUS.IMPROVING);
    expect(patternStatus({ lastSeenAt: NOW, resolvedAt: NOW }, { now: NOW })).toBe(PATTERN_STATUS.RESOLVED);
  });
});

/* -------------------------------------------------------------- summarizing */

describe("summary", () => {
  it("groups patterns into categories with multilingual names", () => {
    const summary = summarizeErrors(canonical(), PROFILE, { now: NOW });
    expect(summary.totalEvents).toBe(3);
    expect(summary.categories[0]).toMatchObject({ categorySlug: "article-wrong", occurrences: 2, items: 1 });
    expect(summary.patterns[0].name.en).toBe("Wrong article");
    expect(summary.patterns[0].name.ar).toBe("أداة خاطئة");
  });

  it("reports a missing translation as null rather than hiding the language", () => {
    const summary = summarizeErrors(canonical(), PROFILE, { now: NOW });
    expect(summary.patterns[0].advice.en).toBe("Learn the gender with the noun.");
    expect(summary.patterns[0].advice.ar).toBeNull();
  });

  it("counts unscored events without letting them become patterns", () => {
    const data = canonical();
    data.errorEvents.push(event("e4", { answerLanguage: "ar", scored: 0, occurredAt: NOW }));
    data.errorEventCategories.push(link("l4", "e4", "cat-meaning", { source: ERROR_SOURCES.ADVISORY }));

    const summary = summarizeErrors(data, PROFILE, { now: NOW });
    expect(summary.totalEvents).toBe(4);
    expect(summary.unscoredEvents).toBe(1);
    expect(summary.patterns.map(p => p.categorySlug)).not.toContain("meaning-mismatch");
  });

  it("honours a stored resolution", () => {
    const data = canonical({
      errorPatterns: [{ uuid: "p1", profileUuid: PROFILE, categoryUuid: "cat-article-wrong",
        contentType: "vocabulary", contentUuid: "v-haus", occurrences: 2,
        firstSeenAt: NOW - 3 * DAY, lastSeenAt: NOW - 2 * DAY, resolvedAt: NOW - DAY,
        status: PATTERN_STATUS.RESOLVED, ...linkMeta }]
    });
    const summary = summarizeErrors(data, PROFILE, { now: NOW });
    expect(summary.patterns[0].status).toBe(PATTERN_STATUS.RESOLVED);
    expect(summary.active).toBe(1);                     // only the typo is still active
  });

  it("summarizes an empty history without inventing anything", () => {
    const summary = summarizeErrors({}, PROFILE, { now: NOW });
    expect(summary).toMatchObject({ totalEvents: 0, unscoredEvents: 0, active: 0 });
    expect(summary.patterns).toEqual([]);
  });
});

/* ------------------------------------------------------------- remediation */

describe("remediation and practice", () => {
  it("returns authored remediation content in order", () => {
    expect(remediationFor("article-wrong", canonical())).toEqual([
      { contentType: "grammar_rule", contentUuid: "rule-gender", ordering: 1 },
      { contentType: "exercise", contentUuid: "x-articles", ordering: 2 }
    ]);
  });

  it("returns nothing for an unknown category rather than guessing", () => {
    expect(remediationFor("no-such-category", canonical())).toEqual([]);
  });

  it("suggests remediation content for the strongest pattern first", () => {
    const queue = practiceQueue(canonical(), PROFILE, { now: NOW });
    expect(queue.slice(0, 2)).toEqual([
      { contentType: "grammar_rule", contentUuid: "rule-gender", categorySlug: "article-wrong",
        occurrences: 2, lastSeenAt: NOW - 2 * DAY, reason: "remediation", affectsScheduling: false },
      { contentType: "exercise", contentUuid: "x-articles", categorySlug: "article-wrong",
        occurrences: 2, lastSeenAt: NOW - 2 * DAY, reason: "remediation", affectsScheduling: false }
    ]);
  });

  it("falls back to the item itself when nothing is authored", () => {
    const typo = practiceQueue(canonical(), PROFILE, { now: NOW })
      .find(entry => entry.categorySlug === "spelling-typo");
    expect(typo).toMatchObject({ contentType: "vocabulary", contentUuid: "v-brot", reason: "repeat-the-item" });
  });

  it("skips resolved patterns", () => {
    const data = canonical({
      errorPatterns: [{ uuid: "p1", profileUuid: PROFILE, categoryUuid: "cat-article-wrong",
        contentType: "vocabulary", contentUuid: "v-haus", resolvedAt: NOW - DAY,
        status: PATTERN_STATUS.RESOLVED, ...linkMeta }]
    });
    expect(practiceQueue(data, PROFILE, { now: NOW }).map(e => e.categorySlug)).toEqual(["spelling-typo"]);
  });

  it("respects a limit and does not repeat an entry", () => {
    expect(practiceQueue(canonical(), PROFILE, { now: NOW, limit: 1 })).toHaveLength(1);
    const queue = practiceQueue(canonical(), PROFILE, { now: NOW });
    const keys = queue.map(e => `${e.categorySlug}:${e.contentUuid}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is deterministic and never reaches for randomness", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("practice order must not be random");
    });
    try {
      expect(practiceQueue(canonical(), PROFILE, { now: NOW }))
        .toEqual(practiceQueue(canonical(), PROFILE, { now: NOW }));
    } finally {
      random.mockRestore();
    }
  });
});

/* ------------------------------------------------------- SRS independence */

describe("error learning never schedules", () => {
  it("does not read or write SRS state anywhere in the module", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/services/error-service.js"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["reviewcards", "schedulecard", "dueat", "intervaldays",
      "ease", "lapses", "mastery", "indexeddb", "sqlite"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves a card untouched across classify, record, summarize and practice", () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1781234567890,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);

    const evaluation = validateGermanAnswer("der Haus", WORD, DEFAULT_SETTINGS);
    classifyEvaluation(evaluation, { language: "de" });
    recordEvaluation(evaluation, { profileUuid: PROFILE, contentUuid: "v-haus" }, { now: NOW });
    summarizeErrors(canonical(), PROFILE, { now: NOW });
    practiceQueue(canonical(), PROFILE, { now: NOW });

    expect(JSON.stringify(card)).toBe(before);
  });

  it("marks every practice suggestion as not affecting scheduling", () => {
    const queue = practiceQueue(canonical(), PROFILE, { now: NOW });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every(entry => entry.affectsScheduling === false)).toBe(true);
  });
});

/* ---------------------------------------------------------------- migration */

describe("migration records no errors", () => {
  it("creates no taxonomy, events or patterns from legacy data", () => {
    const { dataset } = migrateToCanonical({
      words: [{ id: 1, german: "das Haus", arabic: "بيت", itemType: "noun", level: "A1" }],
      cards: [{ key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: 1, intervalDays: 3,
        ease: 2.5, reps: 2, lapses: 1, streak: 0, mastery: 40 }],
      attempts: [{ id: 1, wordId: 1, cardKey: "1:recall", skill: "recall", correct: false,
        answerType: "article_wrong", userAnswer: "der Haus", correctAnswer: "das Haus", createdAt: NOW }],
      settings: null, profile: null
    }, { now: NOW });

    for (const entity of ["errorCategories", "errorCategoryTexts", "errorRemediations",
      "errorEvents", "errorEventCategories", "errorPatterns"]) {
      expect(dataset[entity], `${entity} should be empty`).toEqual([]);
    }
    // A past wrong attempt is NOT reclassified after the fact.
    expect(dataset.reviewEvents.length).toBeGreaterThan(0);
    expect(dataset.reviewCards[0].lapses).toBe(1);
    expect(dataset.reviewCards[0].ease).toBe(2.5);
  });
});

/* ------------------------------------------------------------------ service */

describe("error service", () => {
  function repositoriesFor(data) {
    const wrap = rows => ({ all: async () => rows ?? [] });
    return {
      errorCategories: wrap(data.errorCategories), errorCategoryTexts: wrap(data.errorCategoryTexts),
      errorRemediations: wrap(data.errorRemediations), errorEvents: wrap(data.errorEvents),
      errorEventCategories: wrap(data.errorEventCategories), errorPatterns: wrap(data.errorPatterns)
    };
  }

  it("reads through repositories only", async () => {
    const service = createErrorService(repositoriesFor(canonical()));
    expect((await service.categories()).map(c => c.slug))
      .toEqual(["article-wrong", "spelling-typo", "meaning-mismatch"]);
  });

  it("summarizes, aggregates and suggests through the service", async () => {
    const service = createErrorService(repositoriesFor(canonical()));
    expect((await service.summary(PROFILE, { now: NOW })).totalEvents).toBe(3);
    expect((await service.patterns(PROFILE))[0].categorySlug).toBe("article-wrong");
    expect((await service.practice(PROFILE, { now: NOW }))[0].contentUuid).toBe("rule-gender");
    expect(await service.remediation("article-wrong")).toHaveLength(2);
  });

  it("exposes no way to write a card or a schedule", () => {
    const service = createErrorService(repositoriesFor(canonical()));
    expect(Object.keys(service).sort())
      .toEqual(["categories", "patterns", "practice", "remediation", "summary"]);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it("requires repositories rather than reaching for storage", () => {
    expect(() => createErrorService(null)).toThrow(/Repositories are required/);
  });
});
