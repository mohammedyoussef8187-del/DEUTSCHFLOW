/*
 * Stage 0b: DISCOVERY.
 *
 * Finds candidate lessons in the repository instead of naming them in code, so adding a
 * handout means dropping a file in, not editing a path list.
 *
 * Discovery is still not a licence to import anything it finds. A file only becomes a
 * candidate if its name matches a PUBLISHER TEMPLATE — a declared naming convention that
 * also states what documents of that kind contain. The template is what carries
 * `supports`/`absent`, so a newly discovered file never has to have its capabilities
 * guessed: they come from the format it belongs to, which a human declared once.
 *
 * A file that matches nothing is reported as unrecognised and skipped. Silence about a
 * file nobody registered would be the worst outcome, so it is listed either way.
 */

import fs from "node:fs";
import path from "node:path";
import { SOURCE_KINDS, SUPPORTS } from "./sources.js";

/**
 * Deutsche Welle "Nicos Weg" handouts.
 *
 * Filenames encode everything needed to place a document:
 *   Nicos-Weg-<LEVEL>-E<EPISODE>-L<LESSON>-<Kind>.pdf
 *
 * Both kinds print their course, level and episode inside the document too, so the
 * filename is used to GROUP files, never as the source of a fact that ends up stored.
 */
export const NICOS_WEG_TEMPLATE = Object.freeze({
  id: "nicos-weg",
  publisher: "Deutsche Welle",
  courseTitle: "Nicos Weg",
  filename: /^Nicos-Weg-(A1|A2|B1)-E(\d+)-L(\d+)-(.+)\.pdf$/i,
  kinds: Object.freeze([
    {
      // The Arabic manuscript-and-vocabulary handout.
      match: /Manuskript/i,
      kind: SOURCE_KINDS.MANUSCRIPT,
      role: "manuscript",
      titleSuffix: "Manuskript und Wortschatz (Arabisch)",
      reference: "dw.com/nico/arabic",
      supports: Object.freeze([
        SUPPORTS.COURSE_IDENTITY, SUPPORTS.LESSON_IDENTITY, SUPPORTS.TRANSCRIPT,
        SUPPORTS.SPEAKERS, SUPPORTS.VOCABULARY_DE_AR, SUPPORTS.VERB_FORMS, SUPPORTS.CEFR
      ]),
      absent: Object.freeze([
        SUPPORTS.ENGLISH, SUPPORTS.IPA, SUPPORTS.GRAMMAR_EXPLANATION,
        SUPPORTS.AUDIO_FILES, SUPPORTS.EXERCISE_ANSWERS
      ])
    },
    {
      // The teacher's booklet. It prints tasks and never an answer key.
      match: /Lehrerhandreichung|Uebungen|Übungen/i,
      kind: SOURCE_KINDS.EXERCISES,
      role: "exercises",
      titleSuffix: "Lehrerhandreichung und Übungen",
      reference: "dw.com/nico",
      supports: Object.freeze([
        SUPPORTS.COURSE_IDENTITY, SUPPORTS.LESSON_IDENTITY, SUPPORTS.EXERCISE_PROMPTS
      ]),
      absent: Object.freeze([
        SUPPORTS.EXERCISE_ANSWERS, SUPPORTS.ENGLISH, SUPPORTS.VOCABULARY_DE_AR,
        SUPPORTS.IPA, SUPPORTS.AUDIO_FILES
      ])
    }
  ]),
  arabicVisualOrder: false,
  parser: "nicos-weg"
});

export const TEMPLATES = Object.freeze([NICOS_WEG_TEMPLATE]);

/** Directories that may hold educational source documents. */
export const CONTENT_ROOTS = Object.freeze(["03_COURSE_CONTENT"]);

function listFiles(root, dir) {
  const absolute = path.resolve(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(root, relative);
    return entry.isFile() ? [relative] : [];
  });
}

/** Build a source descriptor from a template match. Nothing here is guessed. */
export function describeFile(relativePath, template = NICOS_WEG_TEMPLATE) {
  const name = relativePath.split("/").pop();
  const match = template.filename.exec(name);
  if (!match) return null;

  const [, level, episode, lesson, rest] = match;
  const kind = template.kinds.find(candidate => candidate.match.test(rest));
  if (!kind) return { unrecognisedKind: true, path: relativePath, name };

  const lessonKey = `${template.id}-${level.toLowerCase()}-e${episode}-l${lesson}`;
  return {
    id: `${lessonKey}-${kind.role}`,
    lessonKey,
    templateId: template.id,
    role: kind.role,
    path: relativePath,
    kind: kind.kind,
    title: `${template.courseTitle} | ${level.toUpperCase()} — ${kind.titleSuffix}`,
    publisher: template.publisher,
    reference: kind.reference,
    // Printed in the document header as well; the filename only groups.
    cefrLevel: level.toUpperCase(),
    episode: Number(episode),
    lesson: Number(lesson),
    supports: kind.supports,
    absent: kind.absent,
    arabicVisualOrder: template.arabicVisualOrder,
    parser: template.parser,
    pages: null                  // learned at extraction, not asserted here
  };
}

/**
 * Scan the repository for candidate lessons.
 *
 * @returns {{ candidates, unrecognised, files }} candidates grouped by lesson, each with
 *   the roles found for it. A lesson missing its manuscript cannot be imported, and says
 *   so rather than being quietly dropped.
 */
export function discover(options = {}) {
  const root = options.root ?? process.cwd();
  const templates = options.templates ?? TEMPLATES;
  const roots = options.roots ?? CONTENT_ROOTS;

  const files = roots.flatMap(dir => listFiles(root, dir)).filter(file => /\.pdf$/i.test(file));
  const byLesson = new Map();
  const unrecognised = [];

  for (const file of files) {
    let described = null;
    for (const template of templates) {
      described = describeFile(file, template);
      if (described) break;
    }
    if (!described || described.unrecognisedKind) {
      unrecognised.push({ path: file, reason: described ? "unknown-document-kind" : "no-template-matches" });
      continue;
    }

    const existing = byLesson.get(described.lessonKey) ?? {
      lessonKey: described.lessonKey,
      templateId: described.templateId,
      courseTitle: templates.find(t => t.id === described.templateId).courseTitle,
      cefrLevel: described.cefrLevel,
      episode: described.episode,
      lesson: described.lesson,
      parser: described.parser,
      sources: {}
    };
    existing.sources[described.role] = described;
    byLesson.set(described.lessonKey, existing);
  }

  const candidates = [...byLesson.values()]
    .map(candidate => ({
      ...candidate,
      // A manuscript carries the course, lesson, transcript and vocabulary. Without one
      // there is no lesson to import, whatever else was found.
      importable: Boolean(candidate.sources.manuscript),
      missingRoles: ["manuscript"].filter(role => !candidate.sources[role])
    }))
    // Episode order, so a batch reads like the course does.
    .sort((a, b) => a.episode - b.episode || a.lesson - b.lesson);

  return { candidates, unrecognised, files };
}
