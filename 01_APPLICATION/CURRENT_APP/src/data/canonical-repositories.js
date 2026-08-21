/*
 * Canonical repository layer over the SQLite persistence adapter.
 *
 * This is the seam the learning/domain engines and UI use to reach durable storage.
 * They call these repositories; the repositories call the injected persistence adapter;
 * only the adapter speaks SQL. No SQLite driver, SQL string, or table name leaks above
 * this layer (DECISION_LOG DF-004 / DF-010: Application Core -> Repository -> Persistence
 * Adapter -> Platform Storage).
 */

export function createCanonicalRepositories(adapter) {
  if (!adapter) throw new TypeError("A persistence adapter is required");

  const readOnly = entity => Object.freeze({ all: () => adapter.selectAll(entity) });

  return Object.freeze({
    lifecycle: Object.freeze({
      initializeSchema: () => adapter.initializeSchema(),
      schemaVersion: () => adapter.schemaVersion(),
      importCanonical: dataset => adapter.importCanonical(dataset),
      readCanonical: () => adapter.readCanonical(),
      verifyIntegrity: () => adapter.verifyIntegrity()
    }),
    profiles: readOnly("profiles"),
    settings: readOnly("settings"),
    vocabulary: readOnly("vocabularyItems"),
    meanings: readOnly("vocabularyMeanings"),
    translations: readOnly("translations"),
    acceptedAnswers: readOnly("acceptedAnswers"),
    grammarTopics: readOnly("grammarTopics"),
    grammarRules: readOnly("grammarRules"),
    grammarExamples: readOnly("grammarExamples"),
    grammarTexts: readOnly("grammarTexts"),
    vocabularyGrammar: readOnly("vocabularyGrammar"),
    sentences: readOnly("sentences"),
    sentenceTexts: readOnly("sentenceTexts"),
    sentenceVocabulary: readOnly("sentenceVocabulary"),
    sentenceGrammar: readOnly("sentenceGrammar"),
    sentenceTags: readOnly("sentenceTags"),
    exercises: readOnly("exercises"),
    exerciseTexts: readOnly("exerciseTexts"),
    exerciseOptions: readOnly("exerciseOptions"),
    exerciseTargets: readOnly("exerciseTargets"),
    courses: readOnly("courses"),
    courseLevels: readOnly("courseLevels"),
    courseUnits: readOnly("courseUnits"),
    lessons: readOnly("lessons"),
    lessonSections: readOnly("lessonSections"),
    lessonItems: readOnly("lessonItems"),
    lessonPrerequisites: readOnly("lessonPrerequisites"),
    curriculumTexts: readOnly("curriculumTexts"),
    courseProgress: readOnly("courseProgress"),
    lessonProgress: readOnly("lessonProgress"),
    sectionProgress: readOnly("sectionProgress"),
    cefrProgress: readOnly("cefrProgress"),
    errorCategories: readOnly("errorCategories"),
    errorCategoryTexts: readOnly("errorCategoryTexts"),
    errorRemediations: readOnly("errorRemediations"),
    errorEvents: readOnly("errorEvents"),
    errorEventCategories: readOnly("errorEventCategories"),
    errorPatterns: readOnly("errorPatterns"),
    audioAssets: readOnly("audioAssets"),
    listeningItems: readOnly("listeningItems"),
    listeningTexts: readOnly("listeningTexts"),
    listeningSpeakers: readOnly("listeningSpeakers"),
    listeningSegments: readOnly("listeningSegments"),
    listeningSegmentTexts: readOnly("listeningSegmentTexts"),
    listeningLinks: readOnly("listeningLinks"),
    pronunciationFeatures: readOnly("pronunciationFeatures"),
    pronunciationTexts: readOnly("pronunciationTexts"),
    pronunciationItems: readOnly("pronunciationItems"),
    pronunciationVariants: readOnly("pronunciationVariants"),
    pronunciationPairs: readOnly("pronunciationPairs"),
    pronunciationLinks: readOnly("pronunciationLinks"),
    pronunciationAttempts: readOnly("pronunciationAttempts"),
    reminderSettings: readOnly("reminderSettings"),
    reminderSchedule: readOnly("reminderSchedule"),
    cards: readOnly("reviewCards"),
    events: readOnly("reviewEvents")
  });
}
