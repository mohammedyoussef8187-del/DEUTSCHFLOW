/*
 * The batch driver.
 *
 * Runs every discovered candidate through the whole pipeline, PREVIEWS them all, and
 * only then applies the ones that qualify. Nothing is imported while another candidate
 * is still unexamined, so a batch is a decision about a set rather than a race through
 * a list.
 *
 * The gate has one idea behind it: a warning about ABSENCE is fine, a warning about
 * AMBIGUITY is not. "This source prints no English" describes the source honestly and
 * the store records the gap. "This headword appears twice with different meanings" means
 * we do not know which one a learner should be shown, and guessing would put invented
 * teaching in front of them. The first imports; the second is quarantined for a human.
 */

import { discover } from "./discover.js";
import { extractSource } from "./extract.mjs";
import { parseExercises, parseManuscript } from "./parse-nicos-weg.js";
import { mergeValidation, validateExercises, validateManuscript } from "./validate.js";
import { mapLesson } from "./map-canonical.js";
import { applyImport, planImport } from "./import.js";

/**
 * Warnings that describe something the SOURCE does not contain.
 * They are expected, recorded, and never a reason to refuse a lesson.
 */
export const ABSENCE_WARNINGS = Object.freeze([
  "english-absent-in-source",
  "exercise-answers-absent",
  "lesson-number-missing",
  "transcript-empty",
  "vocabulary-arabic-missing",
  // The task is imported ungradeable, so a short option list cannot produce a wrong
  // verdict; it is the publisher's own printed set, captured as printed.
  "exercise-options-incomplete",
  "exercise-without-items"
]);

/**
 * Warnings that mean we do not know which reading is correct.
 * A lesson carrying one of these is quarantined rather than guessed at.
 */
export const AMBIGUITY_WARNINGS = Object.freeze([
  "duplicate-headword",
  "ambiguous-headword",
  "unresolved-speaker"
]);

export function classifyWarning(code) {
  if (ABSENCE_WARNINGS.includes(code)) return "absence";
  if (AMBIGUITY_WARNINGS.includes(code)) return "ambiguity";
  // Anything unclassified is treated as ambiguity: a new warning nobody has reasoned
  // about must not import by default.
  return "ambiguity";
}

export const DECISION = Object.freeze({
  IMPORT: "import",
  SKIP_VALIDATION: "skipped-validation-errors",
  SKIP_AMBIGUOUS: "quarantined-ambiguous-content",
  SKIP_CONFLICT: "skipped-source-conflict",
  SKIP_IDENTITY: "skipped-invalid-identity",
  SKIP_INCOMPLETE: "skipped-missing-required-source"
});

/** Identity a candidate must have before anything about it can be stored. */
export function checkIdentity(mapped) {
  const problems = [];
  const course = mapped?.course?.course;
  const lesson = mapped?.course?.lessons?.[0];
  if (!course?.slug) problems.push("course slug missing");
  if (!course?.sourceTitle) problems.push("course title missing");
  if (!lesson?.slug) problems.push("lesson slug missing");
  if (!lesson?.uuid || !course?.uuid) problems.push("derived uuid missing");
  return { ok: problems.length === 0, problems };
}

/**
 * Run everything up to the diff for one candidate. Writes nothing.
 *
 * @param {object} candidate from discover()
 * @param {object} repositories the canonical store to diff against
 */
export async function previewCandidate(candidate, repositories, options = {}) {
  const now = options.now ?? Date.now();
  const root = options.root ?? process.cwd();
  const load = options.loadExtraction ?? (source => extractSource(source.id, { root, now, source }));

  if (!candidate.importable) {
    return {
      lessonKey: candidate.lessonKey,
      decision: DECISION.SKIP_INCOMPLETE,
      reason: `missing ${candidate.missingRoles.join(", ")}`,
      digests: {}
    };
  }

  const manuscriptSource = candidate.sources.manuscript;
  const exerciseSource = candidate.sources.exercises ?? null;

  const manuscriptExtraction = load(manuscriptSource);
  const exerciseExtraction = exerciseSource ? load(exerciseSource) : null;

  const manuscript = parseManuscript(manuscriptExtraction, manuscriptSource);
  const exercises = exerciseExtraction ? parseExercises(exerciseExtraction, exerciseSource) : null;

  const validation = mergeValidation(
    validateManuscript(manuscript, manuscriptSource),
    ...(exercises ? [validateExercises(exercises, exerciseSource)] : [])
  );

  const digests = {
    manuscript: manuscriptExtraction.digest,
    ...(exerciseExtraction ? { exercises: exerciseExtraction.digest } : {})
  };

  if (!validation.ok) {
    return {
      lessonKey: candidate.lessonKey, decision: DECISION.SKIP_VALIDATION,
      reason: validation.errors.map(entry => entry.code).join(", "),
      validation, digests
    };
  }

  const ambiguous = validation.warnings.filter(entry => classifyWarning(entry.code) === "ambiguity");

  const mapped = mapLesson({
    manuscript, exercises,
    source: manuscriptSource, exerciseSource,
    extraction: manuscriptExtraction, exerciseExtraction,
    now
  });

  const identity = checkIdentity(mapped);
  if (!identity.ok) {
    return {
      lessonKey: candidate.lessonKey, decision: DECISION.SKIP_IDENTITY,
      reason: identity.problems.join(", "), validation, mapped, digests
    };
  }

  const plan = await planImport(repositories, mapped);
  const reuse = await detectReuse(repositories, mapped);

  let decision = DECISION.IMPORT;
  let reason = null;
  if (plan.conflicts.length) {
    decision = DECISION.SKIP_CONFLICT;
    reason = `${plan.conflicts.length} verified row(s) would change`;
  } else if (ambiguous.length) {
    decision = DECISION.SKIP_AMBIGUOUS;
    reason = ambiguous.map(entry => `${entry.code}${entry.where ? ` [${entry.where}]` : ""}`).join("; ");
  }

  return {
    lessonKey: candidate.lessonKey,
    episode: candidate.episode,
    lesson: candidate.lesson,
    decision, reason,
    validation, mapped, plan, reuse, digests,
    ambiguous
  };
}

/**
 * Which vocabulary this lesson would REUSE rather than create.
 *
 * A word already in the store under the same course-scoped identity is the same word
 * with the same meaning, so the lesson joins it through lesson_items instead of writing
 * a second copy — and the row keeps the provenance of the page it was first read from.
 */
export async function detectReuse(repositories, mapped) {
  const existing = [];
  const fresh = [];
  const homographs = new Map();

  for (const entry of mapped.vocabulary) {
    const stored = await repositories.vocabulary.get(entry.item.uuid);
    (stored ? existing : fresh).push({ uuid: entry.item.uuid, german: entry.item.german });

    // Same spelling, different identity: two meanings the source kept apart.
    const sameSpelling = await repositories.vocabulary.find({ german: entry.item.german });
    const others = sameSpelling.filter(row => row.uuid !== entry.item.uuid);
    if (others.length) homographs.set(entry.item.german, others.length + 1);
  }

  return {
    reused: existing.length,
    created: fresh.length,
    reusedItems: existing,
    // Reported, never merged: identical spelling is not identical meaning.
    homographs: [...homographs.entries()].map(([german, count]) => ({ german, count }))
  };
}

/**
 * Preview every candidate, then apply the ones that qualify.
 *
 * @param {object} repositories canonical store
 * @param {object} options { root, now, apply, discovery }
 */
export async function runBatch(repositories, options = {}) {
  const now = options.now ?? Date.now();
  const root = options.root ?? process.cwd();
  const discovery = options.discovery ?? discover({ root });

  // Preview EVERY candidate before anything is written.
  const previews = [];
  for (const candidate of discovery.candidates) {
    previews.push(await previewCandidate(candidate, repositories, { ...options, now, root }));
  }

  const applied = [];
  if (options.apply) {
    for (const preview of previews) {
      if (preview.decision !== DECISION.IMPORT) continue;
      const written = await applyImport(repositories, preview.mapped, { now });
      applied.push({ lessonKey: preview.lessonKey, written });
    }
  }

  return { discovery, previews, applied, audit: buildAudit(discovery, previews, applied, { now, applied: Boolean(options.apply) }) };
}

/** The batch audit: what was found, what was done, and what was refused. */
export function buildAudit(discovery, previews, applied, options = {}) {
  const totals = { create: 0, update: 0, unchanged: 0, conflicts: 0 };
  for (const preview of previews) {
    if (!preview.plan) continue;
    totals.create += preview.plan.create.length;
    totals.update += preview.plan.update.length;
    totals.unchanged += preview.plan.unchanged.length;
    totals.conflicts += preview.plan.conflicts.length;
  }

  const byDecision = {};
  for (const preview of previews) {
    byDecision[preview.decision] = (byDecision[preview.decision] ?? 0) + 1;
  }

  return {
    generatedAt: options.now ?? Date.now(),
    applied: Boolean(options.applied),
    discovered: discovery.candidates.length,
    unrecognisedFiles: discovery.unrecognised,
    imported: applied.map(entry => entry.lessonKey),
    skipped: previews
      .filter(preview => preview.decision !== "import")
      .map(preview => ({ lessonKey: preview.lessonKey, decision: preview.decision, reason: preview.reason })),
    rows: totals,
    warnings: previews.flatMap(preview =>
      (preview.validation?.warnings ?? []).map(entry => ({
        lessonKey: preview.lessonKey, code: entry.code,
        kind: classifyWarning(entry.code), where: entry.where
      }))),
    errors: previews.flatMap(preview =>
      (preview.validation?.errors ?? []).map(entry => ({
        lessonKey: preview.lessonKey, code: entry.code, where: entry.where
      }))),
    conflicts: previews.flatMap(preview =>
      (preview.plan?.conflicts ?? []).map(entry => ({
        lessonKey: preview.lessonKey, entity: entry.entity, uuid: entry.uuid, reason: entry.reason
      }))),
    /*
     * Two views of reuse, and they legitimately differ. `reuse` is what each preview saw
     * BEFORE the batch ran — every candidate is previewed against the pre-batch store,
     * which is what makes "preview everything, then apply" meaningful. `written` is what
     * actually happened once earlier lessons in the same batch had landed.
     */
    written: applied.map(entry => ({ lessonKey: entry.lessonKey, ...entry.written })),
    reuse: previews
      .filter(preview => preview.reuse)
      .map(preview => ({
        lessonKey: preview.lessonKey,
        vocabularyReused: preview.reuse.reused,
        vocabularyCreated: preview.reuse.created,
        homographs: preview.reuse.homographs
      })),
    digests: Object.fromEntries(previews.map(preview => [preview.lessonKey, preview.digests])),
    decisions: byDecision
  };
}
