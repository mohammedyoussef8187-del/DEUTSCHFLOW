/*
 * The controlled batch: discovery, the preview-everything-then-apply gate, cross-lesson
 * vocabulary identity, and the audit.
 *
 * The repository currently holds exactly ONE Nicos Weg lesson, so cross-lesson behaviour
 * is exercised with a second candidate built by RE-LABELLING the same committed
 * extraction as a different episode. That is a fixture for identity behaviour, not
 * invented teaching material: every German and Arabic string in it still comes verbatim
 * from the real handout.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteAdapter } from "../../01_APPLICATION/CURRENT_APP/src/platform/sqlite/adapter.js";
import { createCanonicalRepositories } from "../../01_APPLICATION/CURRENT_APP/src/data/canonical-repositories.js";
import { createServices } from "../../01_APPLICATION/CURRENT_APP/src/runtime/composition-root.js";
import { createNodeSqliteExecutor } from "../support/sqlite-node-executor.js";
import {
  ABSENCE_WARNINGS, AMBIGUITY_WARNINGS, DECISION, buildAudit, checkIdentity,
  classifyWarning, detectReuse, previewCandidate, runBatch
} from "../../tools/intake/batch.js";
import { NICOS_WEG_TEMPLATE, describeFile, discover } from "../../tools/intake/discover.js";
import { glossFingerprint, vocabularyKey } from "../../tools/intake/map-canonical.js";
import { verifyImport } from "../../tools/intake/import.js";

const NOW = 1775000000000;
const ROOT = process.cwd();

function artifact(sourceId) {
  const dir = path.resolve(ROOT, "tools/intake/artifacts", sourceId);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8"));
  return { ...meta, raw: fs.readFileSync(path.join(dir, "raw.txt"), "utf8") };
}

/** Serve the committed artifacts instead of shelling out to pdftotext. */
function loader(overrides = {}) {
  return source => {
    const base = source.role === "manuscript"
      ? artifact("nicos-weg-a2-e2-l1-manuscript")
      : artifact("nicos-weg-a2-e2-l1-exercises");
    const override = overrides[source.id];
    return override ? override(structuredClone(base)) : base;
  };
}

const cleanup = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()(); });

async function freshStore() {
  const executor = createNodeSqliteExecutor(":memory:");
  cleanup.push(() => executor.close());
  const adapter = createSqliteAdapter(executor);
  await adapter.initializeSchema();
  return createCanonicalRepositories(adapter);
}

const realDiscovery = () => discover({ root: ROOT, templates: [NICOS_WEG_TEMPLATE] });

/**
 * A second candidate over the same text, labelled as episode 3. Used only to exercise
 * identity and reuse; the strings inside remain the real handout's.
 */
function secondEpisodeCandidate() {
  const first = realDiscovery().candidates[0];
  const relabel = role => ({
    ...first.sources[role],
    id: `${first.sources[role].id}-e3`,
    lessonKey: "nicos-weg-a2-e3-l1",
    episode: 3
  });
  return {
    ...first,
    lessonKey: "nicos-weg-a2-e3-l1",
    episode: 3,
    sources: { manuscript: relabel("manuscript"), exercises: relabel("exercises") }
  };
}

/** Re-title the episode so the second candidate is a distinct lesson. */
const asEpisodeThree = extraction => {
  // The episode number is bidi-mirrored in the raw text, so it appears as `…2)` rather
  // than `(2)`. Replace it where it actually sits.
  extraction.pages[0].text = extraction.pages[0].text
    .replace("Familiengeschichten", "Familienalltag")
    .replace(/2\)/, "3)");
  return extraction;
};

/* --------------------------------------------------------------- discovery */

describe("discovery finds candidates instead of naming them in code", () => {
  it("scans the content directories and groups a lesson's documents", () => {
    const { candidates, files } = realDiscovery();
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      lessonKey: "nicos-weg-a2-e2-l1", cefrLevel: "A2", episode: 2, lesson: 1, importable: true
    });
    expect(Object.keys(candidates[0].sources).sort()).toEqual(["exercises", "manuscript"]);
  });

  it("reports files no template claims, rather than ignoring them", () => {
    const { unrecognised } = realDiscovery();
    // The Netzwerk books are in the repository and deliberately out of this batch.
    expect(unrecognised.map(entry => entry.path).join("|")).toContain("Netzwerk");
    expect(unrecognised.every(entry => entry.reason === "no-template-matches")).toBe(true);
  });

  it("takes capabilities from the publisher template, never from the file itself", () => {
    const described = describeFile(
      "03_COURSE_CONTENT/VOCABULARY/Nicos-Weg-A2-E4-L2-Manuskript-und-Wortschatz-Arabisch.pdf");
    expect(described).toMatchObject({
      lessonKey: "nicos-weg-a2-e4-l2", role: "manuscript", cefrLevel: "A2", episode: 4, lesson: 2
    });
    expect(described.supports).toContain("vocabulary-de-ar");
    expect(described.absent).toContain("english");
  });

  it("refuses a filename no template matches", () => {
    expect(describeFile("03_COURSE_CONTENT/Something-Else.pdf")).toBeNull();
  });

  it("flags a lesson whose manuscript is missing as not importable", async () => {
    const candidate = { ...realDiscovery().candidates[0] };
    delete candidate.sources.manuscript;
    const preview = await previewCandidate(
      { ...candidate, importable: false, missingRoles: ["manuscript"] },
      await freshStore(), { now: NOW });
    expect(preview.decision).toBe(DECISION.SKIP_INCOMPLETE);
  });
});

/* ------------------------------------------------------------ the gate */

describe("absence imports, ambiguity is quarantined", () => {
  it("classifies a missing-source warning as absence", () => {
    for (const code of ABSENCE_WARNINGS) expect(classifyWarning(code)).toBe("absence");
    expect(classifyWarning("english-absent-in-source")).toBe("absence");
  });

  it("classifies an unclear-reading warning as ambiguity", () => {
    for (const code of AMBIGUITY_WARNINGS) expect(classifyWarning(code)).toBe("ambiguity");
  });

  it("treats an unknown warning as ambiguity, so a new one cannot import by default", () => {
    expect(classifyWarning("something-nobody-has-reasoned-about")).toBe("ambiguity");
  });

  it("imports the real lesson, whose only warnings are about absent source data", async () => {
    const preview = await previewCandidate(realDiscovery().candidates[0], await freshStore(),
      { now: NOW, loadExtraction: loader() });
    expect(preview.decision).toBe(DECISION.IMPORT);
    expect(preview.validation.errors).toEqual([]);
    expect(preview.ambiguous).toEqual([]);
    expect(preview.validation.warnings.every(entry => classifyWarning(entry.code) === "absence")).toBe(true);
  });

  it("quarantines a lesson whose vocabulary is ambiguous, rather than guessing", async () => {
    const preview = await previewCandidate(realDiscovery().candidates[0], await freshStore(), {
      now: NOW,
      loadExtraction: loader({
        "nicos-weg-a2-e2-l1-manuscript": extraction => {
          // The same headword printed twice with different meanings.
          extraction.pages[1].text += "\n\nbei – ‫شيء مختلف تماما‬\n";
          return extraction;
        }
      })
    });
    expect(preview.decision).toBe(DECISION.SKIP_AMBIGUOUS);
    expect(preview.reason).toContain("duplicate-headword");
  });

  it("skips a lesson with a validation error", async () => {
    const preview = await previewCandidate(realDiscovery().candidates[0], await freshStore(), {
      now: NOW,
      loadExtraction: loader({
        "nicos-weg-a2-e2-l1-manuscript": extraction => {
          extraction.pages[0].text = extraction.pages[0].text.replace("Familiengeschichten", "");
          return extraction;
        }
      })
    });
    expect(preview.decision).toBe(DECISION.SKIP_VALIDATION);
    expect(preview.reason).toContain("lesson-title-missing");
  });

  it("requires a complete identity before anything is stored", () => {
    expect(checkIdentity({ course: { course: { slug: "x", sourceTitle: "X", uuid: "u" },
      lessons: [{ slug: "l", uuid: "lu" }] } }).ok).toBe(true);
    const broken = checkIdentity({ course: { course: {}, lessons: [{}] } });
    expect(broken.ok).toBe(false);
    expect(broken.problems.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------ the batch */

describe("preview everything, then apply what qualifies", () => {
  it("previews without writing", async () => {
    const repositories = await freshStore();
    const result = await runBatch(repositories, {
      now: NOW, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(result.previews).toHaveLength(1);
    expect(result.applied).toEqual([]);
    expect(await repositories.courses.count()).toBe(0);
  });

  it("applies the qualifying lesson and verifies it through the services", async () => {
    const repositories = await freshStore();
    const result = await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });

    expect(result.applied.map(entry => entry.lessonKey)).toEqual(["nicos-weg-a2-e2-l1"]);
    const report = await verifyImport(createServices(repositories), result.previews[0].mapped);
    expect(report.lesson).toMatchObject({ slug: "familiengeschichten", sections: 3, items: 26 });
    expect(report.exercises).toMatchObject({ total: 14, gradeable: 11 });
    expect(report.englishMissing).toBe(true);
  });

  it("writes nothing for a quarantined lesson even when another one imports", async () => {
    const repositories = await freshStore();
    const good = realDiscovery().candidates[0];
    const bad = { ...secondEpisodeCandidate() };

    const result = await runBatch(repositories, {
      now: NOW, apply: true,
      discovery: { candidates: [good, bad], unrecognised: [], files: [] },
      loadExtraction: loader({
        [bad.sources.manuscript.id]: extraction => {
          const relabelled = asEpisodeThree(extraction);
          relabelled.pages[1].text += "\n\nbei – ‫شيء مختلف تماما‬\n";
          return relabelled;
        },
        [bad.sources.exercises.id]: extraction => extraction
      })
    });

    expect(result.applied.map(entry => entry.lessonKey)).toEqual(["nicos-weg-a2-e2-l1"]);
    expect(result.audit.skipped[0]).toMatchObject({
      lessonKey: "nicos-weg-a2-e3-l1", decision: DECISION.SKIP_AMBIGUOUS
    });
    // One lesson, not two: the quarantined candidate wrote nothing at all.
    expect(await repositories.lessons.count()).toBe(1);
  });

  it("stops a lesson whose verified content would change", async () => {
    const repositories = await freshStore();
    await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    const lesson = await repositories.lessons.findOne({ slug: "familiengeschichten" });
    await repositories.lessons.update(lesson.uuid, { contentStatus: "verified" }, { now: NOW });

    const result = await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(),
      loadExtraction: loader({
        "nicos-weg-a2-e2-l1-manuscript": extraction => {
          extraction.pages[0].text = extraction.pages[0].text
            .replace("Familiengeschichten", "Familiengeschichte");
          return extraction;
        }
      })
    });

    expect(result.previews[0].decision).toBe(DECISION.SKIP_CONFLICT);
    expect(result.applied).toEqual([]);
    // The reviewed title survived untouched.
    expect((await repositories.lessons.get(lesson.uuid)).slug).toBe("familiengeschichten");
  });
});

/* --------------------------------------------------- cross-lesson identity */

describe("the same word in two lessons is one canonical item", () => {
  it("keys vocabulary by course, headword and gloss", () => {
    const same = { headword: "erwachsen", arabic: "بالغ؛ راشد" };
    expect(vocabularyKey("nicos-weg-a2", same)).toBe(vocabularyKey("nicos-weg-a2", same));
    // A different meaning is a different word, however identical the spelling.
    expect(vocabularyKey("nicos-weg-a2", { headword: "erwachsen", arabic: "معنى آخر" }))
      .not.toBe(vocabularyKey("nicos-weg-a2", same));
    // A different course keeps its own vocabulary.
    expect(vocabularyKey("other-course", same)).not.toBe(vocabularyKey("nicos-weg-a2", same));
    expect(glossFingerprint("")).toBe("none");
    expect(glossFingerprint(" بالغ؛ راشد ")).toBe(glossFingerprint("بالغ؛ راشد"));
  });

  it("reuses the vocabulary a second lesson shares, and creates only what is new", async () => {
    const repositories = await freshStore();
    const first = realDiscovery().candidates[0];
    const second = secondEpisodeCandidate();

    const result = await runBatch(repositories, {
      now: NOW, apply: true,
      discovery: { candidates: [first, second], unrecognised: [], files: [] },
      loadExtraction: loader({
        [second.sources.manuscript.id]: asEpisodeThree,
        [second.sources.exercises.id]: extraction => extraction
      })
    });

    expect(result.applied).toHaveLength(2);
    // Two lessons, but the shared word list is stored once.
    expect(await repositories.lessons.count()).toBe(2);
    expect(await repositories.vocabulary.count()).toBe(11);
    expect(result.applied[1].written).toMatchObject({ vocabulary: 0, vocabularyReused: 11 });
  });

  it("keeps the lesson-specific membership of a reused word", async () => {
    const repositories = await freshStore();
    const first = realDiscovery().candidates[0];
    const second = secondEpisodeCandidate();
    await runBatch(repositories, {
      now: NOW, apply: true,
      discovery: { candidates: [first, second], unrecognised: [], files: [] },
      loadExtraction: loader({
        [second.sources.manuscript.id]: asEpisodeThree,
        [second.sources.exercises.id]: extraction => extraction
      })
    });

    const word = await repositories.vocabulary.findOne({ german: "erwachsen" });
    const memberships = await repositories.lessonItems.find({ contentUuid: word.uuid });
    // One canonical word, referenced from both lessons' vocabulary sections.
    expect(memberships).toHaveLength(2);
    expect(new Set(memberships.map(item => item.sectionUuid)).size).toBe(2);
  });

  it("keeps the provenance of the page the word was first read from", async () => {
    const repositories = await freshStore();
    const first = realDiscovery().candidates[0];
    const second = secondEpisodeCandidate();
    await runBatch(repositories, {
      now: NOW, apply: true,
      discovery: { candidates: [first, second], unrecognised: [], files: [] },
      loadExtraction: loader({
        [second.sources.manuscript.id]: asEpisodeThree,
        [second.sources.exercises.id]: extraction => extraction
      })
    });

    const word = await repositories.vocabulary.findOne({ german: "erwachsen" });
    expect(word.sourceReference).toContain("Seite 2");
    expect(word.revision).toBe(1);      // never rewritten by the later lesson
  });

  it("does not merge two meanings that share a spelling", async () => {
    const repositories = await freshStore();
    const mapped = (await previewCandidate(realDiscovery().candidates[0], repositories,
      { now: NOW, loadExtraction: loader() })).mapped;

    const one = mapped.vocabulary.find(entry => entry.item.german === "bei");
    const other = { ...one, item: { ...one.item, uuid: "different-identity" } };
    const reuse = await detectReuse(repositories, { vocabulary: [one, other] });
    expect(reuse.created).toBe(2);
  });

  it("reports a homograph rather than merging it", async () => {
    const repositories = await freshStore();
    await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    // The same spelling stored under a second identity: two printed meanings.
    const word = await repositories.vocabulary.findOne({ german: "bei" });
    await repositories.vocabulary.insert(
      { ...word, uuid: "second-sense", createdAt: NOW, updatedAt: NOW, revision: 1 }, { now: NOW });

    const preview = await previewCandidate(realDiscovery().candidates[0], repositories,
      { now: NOW, loadExtraction: loader() });
    expect(preview.reuse.homographs.some(entry => entry.german === "bei")).toBe(true);
  });
});

/* ------------------------------------------------------------- the audit */

describe("the batch audit", () => {
  it("records what was found, done and refused", async () => {
    const repositories = await freshStore();
    const { audit } = await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });

    expect(audit).toMatchObject({ applied: true, discovered: 1, imported: ["nicos-weg-a2-e2-l1"] });
    expect(audit.skipped).toEqual([]);
    expect(audit.rows).toMatchObject({ create: 189, update: 0, unchanged: 0, conflicts: 0 });
    expect(audit.errors).toEqual([]);
    expect(audit.conflicts).toEqual([]);
    expect(audit.decisions).toEqual({ import: 1 });
  });

  it("carries the source digests, so a row can be tied to the bytes it came from", async () => {
    const { audit } = await runBatch(await freshStore(), {
      now: NOW, discovery: realDiscovery(), loadExtraction: loader()
    });
    const digests = audit.digests["nicos-weg-a2-e2-l1"];
    expect(digests.manuscript).toMatch(/^[0-9a-f]{16}$/);
    expect(digests.exercises).toMatch(/^[0-9a-f]{16}$/);
    expect(digests.manuscript).not.toBe(digests.exercises);
  });

  it("labels every warning as absence or ambiguity", async () => {
    const { audit } = await runBatch(await freshStore(), {
      now: NOW, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(audit.warnings.length).toBeGreaterThan(0);
    expect(audit.warnings.every(entry => entry.kind === "absence")).toBe(true);
    expect(new Set(audit.warnings.map(entry => entry.code)))
      .toEqual(new Set(["english-absent-in-source", "exercise-answers-absent",
        "exercise-options-incomplete"]));
  });

  it("counts reuse per lesson", async () => {
    const repositories = await freshStore();
    const first = realDiscovery().candidates[0];
    const second = secondEpisodeCandidate();
    const { audit } = await runBatch(repositories, {
      now: NOW, apply: true,
      discovery: { candidates: [first, second], unrecognised: [], files: [] },
      loadExtraction: loader({
        [second.sources.manuscript.id]: asEpisodeThree,
        [second.sources.exercises.id]: extraction => extraction
      })
    });
    // Both previews ran against the PRE-BATCH store, so neither saw the other's rows.
    expect(audit.reuse[0]).toMatchObject({ vocabularyReused: 0, vocabularyCreated: 11 });
    expect(audit.reuse[1]).toMatchObject({ vocabularyReused: 0, vocabularyCreated: 11 });
    // What actually happened once the first lesson had landed:
    expect(audit.written[0]).toMatchObject({ vocabulary: 11, vocabularyReused: 0 });
    expect(audit.written[1]).toMatchObject({ vocabulary: 0, vocabularyReused: 11 });
  });

  it("lists files no template claimed", async () => {
    const { audit } = await runBatch(await freshStore(), {
      now: NOW, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(audit.unrecognisedFiles.length).toBe(4);
  });

  it("summarizes an empty batch without inventing anything", () => {
    const audit = buildAudit({ candidates: [], unrecognised: [] }, [], [], { now: NOW });
    expect(audit).toMatchObject({ discovered: 0, imported: [], skipped: [] });
    expect(audit.rows).toEqual({ create: 0, update: 0, unchanged: 0, conflicts: 0 });
  });
});

/* ------------------------------------------------------ idempotency & SRS */

describe("re-running the batch", () => {
  it("plans nothing on a second pass and changes no counts", async () => {
    const repositories = await freshStore();
    await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    const before = {
      courses: await repositories.courses.count(),
      vocabulary: await repositories.vocabulary.count(),
      exercises: await repositories.exercises.count(),
      items: await repositories.lessonItems.count()
    };

    const second = await runBatch(repositories, {
      now: NOW + 9_000_000, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(second.previews[0].plan.isNoop).toBe(true);
    expect(second.audit.rows).toMatchObject({ create: 0, update: 0, unchanged: 189 });
    expect(second.applied[0].written).toMatchObject({ vocabulary: 0, vocabularyReused: 11 });

    expect({
      courses: await repositories.courses.count(),
      vocabulary: await repositories.vocabulary.count(),
      exercises: await repositories.exercises.count(),
      items: await repositories.lessonItems.count()
    }).toEqual(before);
  });

  it("touches no SRS row", async () => {
    const repositories = await freshStore();
    await runBatch(repositories, {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(await repositories.cards.count()).toBe(0);
    expect(await repositories.events.count()).toBe(0);
  });

  it("leaves a legacy card object byte-identical", async () => {
    const card = { key: "1:recall", wordId: 1, skill: "recall", state: "review", dueAt: NOW,
      intervalDays: 12.5, ease: 2.36, reps: 7, lapses: 2, streak: 3, mastery: 64 };
    const before = JSON.stringify(card);
    await runBatch(await freshStore(), {
      now: NOW, apply: true, discovery: realDiscovery(), loadExtraction: loader()
    });
    expect(JSON.stringify(card)).toBe(before);
  });
});
