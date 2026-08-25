/*
 * The Learn area: the routes that make Features A–I reachable.
 *
 * This is integration, not new architecture. Every screen renders an existing component
 * fed by an existing service; nothing here re-implements assembly, grading, scheduling
 * or classification.
 *
 * Three boundaries it keeps:
 *
 *   1. IT CANNOT TOUCH SRS. It holds canonical services and a canonical source, and no
 *      legacy repository, card or scheduler. Marking a lesson complete, rating your own
 *      pronunciation or answering a listening exercise cannot move a due date.
 *
 *   2. IT DOES NOT GRADE. Answers go to the existing deterministic evaluator, and the
 *      set of answers it may compare against comes from the exercise layer's own filter.
 *      An Arabic-answer exercise arrives already marked ungradeable and is presented as
 *      self-checked, so Arabic teaches and never scores.
 *
 *   3. IT DOES NOT INVENT CONTENT. With no authored content — which is the state today —
 *      every route renders an honest empty state naming why, rather than demo data.
 *
 * Rendering follows the host app's existing style: HTML strings for layout, then a
 * hydrate pass that assigns object properties to the Lit components, because properties
 * cannot travel through innerHTML.
 */

import { validateGermanAnswer, evaluateArabicAdvisory } from "../exercises/answer-evaluator.js";
import { expectedAnswersFor } from "../services/exercise-service.js";
import { BUILT_IN_CATEGORIES, recordEvaluation } from "../services/error-service.js";
import {
  buildPronunciationAttempt, assessSpokenAttempt, pronunciationErrorContext
} from "../services/pronunciation-service.js";
import { listeningErrorContext } from "../services/listening-service.js";
import { isScoreable } from "../content/languages.js";

import "../ui/components/df-course-outline.js";
import "../ui/components/df-lesson-view.js";
import "../ui/components/df-sentence-card.js";
import "../ui/components/df-listening-player.js";
import "../ui/components/df-error-insights.js";
import "../ui/components/df-pronunciation-card.js";
import "../ui/components/df-reminder-settings.js";
import "../ui/components/df-choice-list.js";

/** Cut a label to a readable length without cutting a word in half mid-screen. */
function truncate(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

/** Shown against an exercise the evaluator is not allowed to score. */
const SELF_CHECKED = "تصحيح ذاتي";

const esc = value => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

export const LEARN_ROUTES = Object.freeze([
  { id: "learn", label: "المنهج", hub: true },
  { id: "learn-courses", label: "الدورات والدروس", icon: "📚" },
  { id: "learn-grammar", label: "القواعد", icon: "📐" },
  { id: "learn-sentences", label: "الجُمل والسياق", icon: "💬" },
  { id: "learn-exercises", label: "التمارين", icon: "✍" },
  { id: "learn-listening", label: "الاستماع", icon: "🎧" },
  { id: "learn-pronunciation", label: "النطق", icon: "🗣" },
  { id: "learn-errors", label: "تعلّم من الأخطاء", icon: "🔁" },
  { id: "learn-reminders", label: "التذكيرات", icon: "⏰" }
]);

export const LEARN_ROUTE_IDS = Object.freeze(LEARN_ROUTES.map(route => route.id));

export function isLearnRoute(route) {
  return LEARN_ROUTE_IDS.includes(route);
}

const STORE_REASON = Object.freeze({
  "web-target-has-no-canonical-store": "مخزن المحتوى غير متاح في المتصفح — يعمل في نسخة iPad/iPhone.",
  "canonical-native-store-gated": "مخزن المحتوى مقفل حتى اجتياز التحقق على الجهاز.",
  "canonical-runtime-disabled": "شاشات المنهج موقوفة حالياً.",
  "no-executor-supplied": "لم يُفتح مخزن المحتوى بعد."
});

function emptyState(title, detail) {
  return `<section class="card" style="text-align:center;padding:28px">
    <h2 style="margin:0 0 6px">${esc(title)}</h2>
    <p style="margin:0;color:var(--muted);font-size:13px">${esc(detail)}</p>
  </section>`;
}

/**
 * @param {object} runtime bootstrapCanonicalRuntime() result
 * @param {object} [options] { profileUuid, now, onChange, toast }
 */
export function createLearnController(runtime, options = {}) {
  const services = runtime.services;
  const source = runtime.source;
  const profileUuid = options.profileUuid ?? "local";
  const now = options.now ?? (() => Date.now());
  const notify = options.onChange ?? (() => {});
  const toast = options.toast ?? (() => {});

  /* View state, kept here rather than in the host app's state object so the Learn area
     owns its own navigation and cannot disturb a study session in progress. */
  const view = {
    courseSlug: null,
    lessonUuid: null,
    activityUuid: null,
    pronunciationUuid: null,
    exerciseUuid: null,
    answer: "",
    result: null,
    data: null,
    loading: false,
    error: null
  };

  const storeNote = () => (runtime.available
    ? ""
    : `<p class="store-note" style="margin:0 0 14px;color:var(--muted);font-size:12px">${
        esc(STORE_REASON[runtime.reason] ?? runtime.reason ?? "مخزن المحتوى غير متاح.")}</p>`);

  /* ------------------------------------------------------------- loading */

  /** Load exactly what the current route needs. Never throws into the host app. */
  async function load(route) {
    view.loading = true;
    view.error = null;
    try {
      view.data = await loaders[route]?.() ?? null;
    } catch (error) {
      view.error = error?.message ?? String(error);
      view.data = null;
    } finally {
      view.loading = false;
    }
    return view.data;
  }

  /**
   * Resolve every item in one lesson to something a learner can read.
   *
   * The lesson structure references content as (contentType, contentUuid). Rendering the
   * uuid is what the store knows, not what a learner needs, so each reference is looked
   * up through the service that owns that content type and reduced to a title and a
   * detail line. An item whose content is missing keeps its uuid — a dangling reference
   * should look wrong rather than be quietly dropped.
   */
  async function labelLessonItems(lesson) {
    const items = (lesson.sections ?? []).flatMap(section => section.items ?? []);
    if (!items.length) return {};
    const wanted = type => items.some(item => item.contentType === type);
    const labels = {};

    if (wanted("vocabulary")) {
      for (const entry of await services.content.allEntries()) {
        labels[entry.uuid] = {
          title: [entry.article, entry.german].filter(Boolean).join(" "),
          detail: entry.primary?.arabic ?? null,
          lang: "de"
        };
      }
    }
    if (wanted("exercise")) {
      for (const exercise of await services.exercises.all()) {
        labels[exercise.uuid] = {
          title: exercise.instruction?.de ?? exercise.prompt?.de ?? exercise.slug,
          detail: exercise.gradeable ? null : SELF_CHECKED,
          lang: "de"
        };
      }
    }
    if (wanted("listening")) {
      for (const activity of await services.listening.activities()) {
        labels[activity.uuid] = {
          title: activity.title?.de ?? activity.slug, detail: null, lang: "de"
        };
      }
    }
    if (wanted("sentence")) {
      for (const sentence of await services.sentences.all()) {
        labels[sentence.uuid] = {
          title: sentence.german, detail: sentence.translations?.ar ?? null, lang: "de"
        };
      }
    }
    /* A lesson points at a grammar TOPIC or at one of its RULES, and both need a name.
       The rules live inside the assembled topic, so one read covers both. */
    if (wanted("grammar") || wanted("grammar_rule") || wanted("grammar_topic")) {
      for (const topic of await services.grammar.topics()) {
        labels[topic.uuid] = { title: topic.title?.de ?? topic.slug, detail: null, lang: "de" };
        for (const rule of topic.rules ?? []) {
          labels[rule.uuid] = {
            title: rule.title?.de ?? rule.slug,
            detail: topic.title?.de ?? null,
            lang: "de"
          };
        }
      }
    }
    return labels;
  }

  /*
   * Which course a learner lands on when they have not chosen one.
   *
   * A course whose chapters are registered but carry no teachable section is real
   * structure, not a lesson: opening it first would greet a learner with a list of
   * chapters that all lead to a blank screen. So the landing course is the first one
   * that actually has something to study, and the empty ones stay listed and reachable
   * rather than hidden — the structure is true, it is just not where to begin.
   */
  function defaultCourseSlug(courses) {
    const studyable = courses.find(course =>
      (course.units ?? []).some(unit =>
        (unit.lessons ?? []).some(lesson => (lesson.sections ?? []).length > 0)));
    return (studyable ?? courses[0])?.slug ?? null;
  }

  const loaders = {
    "learn": async () => ({
      courses: (await services.curriculum.courses()).length,
      grammar: (await services.grammar.topics()).length,
      sentences: (await services.sentences.all()).length,
      exercises: (await services.exercises.all()).length,
      listening: (await services.listening.activities()).length,
      pronunciation: (await services.pronunciation.items()).length,
      errors: (await services.errors.summary(profileUuid, { now: now() })).active
    }),

    "learn-courses": async () => {
      const courses = await services.curriculum.courses();
      const slug = view.courseSlug ?? defaultCourseSlug(courses);
      view.courseSlug = slug;
      const course = slug ? courses.find(c => c.slug === slug) ?? null : null;
      const progress = slug ? await services.curriculum.progressForCourse(slug, profileUuid) : null;
      const lesson = view.lessonUuid
        ? (course?.units ?? []).flatMap(u => u.lessons).find(l => l.uuid === view.lessonUuid) ?? null
        : null;
      // Only for the lesson actually open: resolving every lesson in the course would
      // read the whole curriculum to render a list of titles nobody is looking at.
      const labels = lesson ? await labelLessonItems(lesson) : null;
      return { courses, course, progress, lesson, labels };
    },

    "learn-grammar": async () => ({ topics: await services.grammar.topics() }),

    "learn-sentences": async () => ({ sentences: await services.sentences.all() }),

    "learn-exercises": async () => {
      const exercises = await services.exercises.all();
      const chosen = view.exerciseUuid
        ? exercises.find(e => e.uuid === view.exerciseUuid) ?? null
        : exercises[0] ?? null;
      view.exerciseUuid = chosen?.uuid ?? null;
      return { exercises, exercise: chosen };
    },

    "learn-listening": async () => {
      const activities = await services.listening.activities();
      const chosen = view.activityUuid
        ? activities.find(a => a.uuid === view.activityUuid) ?? null
        : activities[0] ?? null;
      view.activityUuid = chosen?.uuid ?? null;
      return { activities, activity: chosen };
    },

    "learn-pronunciation": async () => {
      const items = await services.pronunciation.items();
      const chosen = view.pronunciationUuid
        ? items.find(i => i.uuid === view.pronunciationUuid) ?? null
        : items[0] ?? null;
      view.pronunciationUuid = chosen?.uuid ?? null;
      const history = chosen ? await services.pronunciation.history(profileUuid, chosen.uuid) : null;
      return { items, item: chosen, history };
    },

    "learn-errors": async () => ({
      summary: await services.errors.summary(profileUuid, { now: now() }),
      practice: await services.errors.practice(profileUuid, { now: now() })
    }),

    "learn-reminders": async () => ({
      settings: await services.reminders.settings(profileUuid),
      plan: await services.reminders.preview(profileUuid),
      permission: await services.reminders.permission()
    })
  };

  /* ------------------------------------------------------------ rendering */

  function head(title, subtitle) {
    return `<section class="page-head"><div><h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p></div></section>${storeNote()}`;
  }

  function backButton(label, action, extra = "") {
    return `<button class="ghost-btn" data-action="${action}" ${extra}
      style="min-height:44px">${esc(label)}</button>`;
  }

  const renderers = {
    "learn": data => {
      const counts = data ?? {};
      const tiles = LEARN_ROUTES.filter(route => !route.hub).map(route => {
        const key = route.id.replace("learn-", "");
        const count = counts[key] ?? 0;
        return `<button class="card training-card" data-action="learn-nav" data-route="${route.id}"
          style="min-height:88px;text-align:start">
          <span style="font-size:24px">${route.icon}</span>
          <strong style="display:block;margin-top:6px">${esc(route.label)}</strong>
          <span style="color:var(--muted);font-size:12px">${
            count ? `${count} عنصر` : "لا يوجد محتوى بعد"}</span>
        </button>`;
      }).join("");
      return `${head("المنهج", "الدورات والقواعد والجُمل والتمارين والاستماع والنطق.")}
        <section class="grid grid-3 training-grid">${tiles}</section>`;
    },

    "learn-courses": data => {
      if (!data?.courses?.length) {
        return `${head("الدورات والدروس", "المسار من الدورة إلى الوحدة إلى الدرس.")}
          ${emptyState("لا توجد دورات بعد", "لم تُستورد أي دورة إلى مخزن المحتوى حتى الآن.")}`;
      }
      if (data.lesson) {
        return `${head("الدرس", esc(data.lesson.title?.en || data.lesson.slug))}
          ${backButton("رجوع إلى الدورة", "learn-close-lesson")}
          <div style="height:12px"></div>
          <df-lesson-view id="learn-lesson"></df-lesson-view>
          <div style="height:12px"></div>
          <button class="primary-btn" data-action="learn-complete-lesson"
            data-lesson="${esc(data.lesson.uuid)}" style="min-height:44px">
            سجّل إتمام الدرس
          </button>`;
      }
      const picker = data.courses.length > 1
        ? `<div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-block-end:12px">${
            data.courses.map(course => `<button class="ghost-btn" data-action="learn-course"
              data-slug="${esc(course.slug)}" style="min-height:44px">${
              esc(course.title?.en || course.slug)}</button>`).join("")}</div>`
        : "";
      return `${head("الدورات والدروس", "المسار من الدورة إلى الوحدة إلى الدرس.")}
        ${picker}<df-course-outline id="learn-outline"></df-course-outline>`;
    },

    "learn-grammar": data => {
      if (!data?.topics?.length) {
        return `${head("القواعد", "الموضوعات والقواعد وأمثلتها.")}
          ${emptyState("لا توجد قواعد بعد", "لم تُستورد أي قاعدة إلى مخزن المحتوى حتى الآن.")}`;
      }
      const topics = data.topics.map(topic => `
        <section class="card" data-topic="${esc(topic.uuid)}" style="margin-block-end:12px">
          <h2 style="margin:0 0 4px" lang="de">${esc(topic.title?.de || topic.slug)}</h2>
          <p style="margin:0;color:var(--muted);font-size:13px" dir="ltr">${esc(topic.title?.en ?? "")}</p>
          <p style="margin:4px 0 0;color:var(--muted);font-size:13px">${esc(topic.title?.ar ?? "")}</p>
          ${topic.rules?.length ? `<ul style="margin:10px 0 0;padding-inline-start:18px">${
            topic.rules.map(rule => `<li style="margin-block-end:6px">
              <strong lang="de">${esc(rule.title?.de || rule.slug)}</strong>
              ${rule.explanation?.ar ? `<div style="color:var(--muted);font-size:12px">${esc(rule.explanation.ar)}</div>` : ""}
            </li>`).join("")}</ul>` : ""}
        </section>`).join("");
      return `${head("القواعد", "الموضوعات والقواعد وأمثلتها.")}${topics}`;
    },

    "learn-sentences": data => {
      if (!data?.sentences?.length) {
        return `${head("الجُمل والسياق", "جُمل ألمانية مع الإنجليزية والعربية.")}
          ${emptyState("لا توجد جُمل بعد", "لم تُستورد أي جملة إلى مخزن المحتوى حتى الآن.")}`;
      }
      return `${head("الجُمل والسياق", "جُمل ألمانية مع الإنجليزية والعربية.")}
        <div id="learn-sentences" style="display:grid;gap:12px">${
          data.sentences.map((_, index) =>
            `<df-sentence-card data-index="${index}"></df-sentence-card>`).join("")}</div>`;
    },

    "learn-exercises": data => {
      if (!data?.exercises?.length) {
        return `${head("التمارين", "تصحيح حتمي عبر المقيّم القائم.")}
          ${emptyState("لا توجد تمارين بعد", "لم يُستورد أي تمرين إلى مخزن المحتوى حتى الآن.")}`;
      }
      const exercise = data.exercise;
      /* The picker names each task the way the source does. A slug is an identifier,
         not a title, so it is the last resort rather than the first choice. */
      const pickerLabel = item => item.instruction?.ar || item.instruction?.de ||
        item.prompt?.de || item.prompt?.ar || item.slug;
      const picker = data.exercises.length > 1
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-end:12px">${
            data.exercises.map(item => `<button class="ghost-btn" data-action="learn-exercise"
              data-uuid="${esc(item.uuid)}" title="${esc(item.slug)}"
              style="min-height:44px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              ${item.uuid === exercise?.uuid ? 'aria-current="true"' : ""}
              >${esc(truncate(pickerLabel(item), 48))}</button>`).join("")}</div>`
        : "";

      /* German first because it is the target language, then the support languages.
         A vocabulary-recall task prompts in Arabic only, and must still be readable. */
      const prompt = exercise.prompt?.de || exercise.prompt?.en || exercise.prompt?.ar || exercise.slug;
      const promptLanguage = exercise.prompt?.de ? "de" : exercise.prompt?.en ? "en" : exercise.prompt?.ar ? "ar" : null;
      const instruction = exercise.instruction?.ar || exercise.instruction?.en || "";
      // The exercise TYPE decides the input, not whether options happen to exist:
      // a typed answer usually has an expected option too, and that is not a choice list.
      const body = exercise.type === "multiple_choice" && exercise.options?.length
        ? `<df-choice-list id="learn-choices"
             choices="${esc(JSON.stringify(exercise.options.map(o => ({ id: o.uuid, label: o.text }))))}"
             ${view.result ? "revealed" : ""}
             correctid="${esc(view.result?.correctId ?? "")}"
             chosenid="${esc(view.result?.chosenId ?? "")}"></df-choice-list>`
        : `<label class="field"><span class="field-label">إجابتك</span>
            <input id="learn-answer" class="text-input" type="text" autocomplete="off"
              value="${esc(view.answer)}" style="min-height:44px" /></label>
           <button class="primary-btn" data-action="learn-submit-exercise"
             style="min-height:44px;margin-block-start:10px">تحقّق</button>`;

      const verdict = view.result
        ? `<div class="feedback ${view.result.selfAssessed ? "" : view.result.correct ? "correct" : "wrong"}"
             data-verdict="${view.result.selfAssessed ? "self" : view.result.correct ? "correct" : "wrong"}"
             style="margin-block-start:12px">${esc(view.result.note)}</div>`
        : "";

      return `${head("التمارين", "تصحيح حتمي عبر المقيّم القائم.")}${picker}
        <section class="card">
          ${instruction ? `<p style="margin:0 0 8px;color:var(--muted);font-size:13px">${esc(instruction)}</p>` : ""}
          <h2 style="margin:0 0 12px" lang="${promptLanguage ?? "de"}" dir="${promptLanguage === "ar" ? "rtl" : "ltr"}">${esc(prompt)}</h2>
          ${exercise.gradeable ? "" : `<p class="pill" data-ungradeable="true"
             style="display:inline-block;margin-block-end:10px">تقييم ذاتي — لا يُحتسب</p>`}
          ${body}
          ${verdict}
        </section>`;
    },

    "learn-listening": data => {
      if (!data?.activities?.length) {
        return `${head("الاستماع", "تسجيلات مع النص والترجمات.")}
          ${emptyState("لا توجد تسجيلات بعد", "لم يُستورد أي نشاط استماع إلى مخزن المحتوى حتى الآن.")}`;
      }
      const picker = data.activities.length > 1
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-end:12px">${
            data.activities.map(item => `<button class="ghost-btn" data-action="learn-activity"
              data-uuid="${esc(item.uuid)}" style="min-height:44px">${esc(item.slug)}${
              item.studyable ? "" : " ⚠"}</button>`).join("")}</div>`
        : "";
      return `${head("الاستماع", "تسجيلات مع النص والترجمات.")}${picker}
        <df-listening-player id="learn-listening"></df-listening-player>`;
    },

    "learn-pronunciation": data => {
      if (!data?.items?.length) {
        return `${head("النطق", "النموذج والنسخ الصوتي والتقييم الذاتي.")}
          ${emptyState("لا توجد تمارين نطق بعد", "لم يُستورد أي تمرين نطق إلى مخزن المحتوى حتى الآن.")}`;
      }
      const picker = data.items.length > 1
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-end:12px">${
            data.items.map(item => `<button class="ghost-btn" data-action="learn-pronunciation-item"
              data-uuid="${esc(item.uuid)}" style="min-height:44px">${esc(item.slug)}</button>`).join("")}</div>`
        : "";
      return `${head("النطق", "النموذج والنسخ الصوتي والتقييم الذاتي.")}${picker}
        <df-pronunciation-card id="learn-pronunciation"></df-pronunciation-card>`;
    },

    "learn-errors": data => {
      const hasAny = (data?.summary?.totalEvents ?? 0) > 0;
      return `${head("تعلّم من الأخطاء", "أنماط أخطائك واقتراحات التدريب.")}
        ${hasAny ? "" : emptyState("لا توجد أخطاء مسجَّلة بعد",
          "تُسجَّل الأخطاء من التمارين المصحَّحة حتمياً.")}
        <df-error-insights id="learn-errors"></df-error-insights>`;
    },

    "learn-reminders": () => `${head("التذكيرات", "تذكيرات محلية تعمل دون إنترنت ودون حساب.")}
      <df-reminder-settings id="learn-reminders"></df-reminder-settings>`
  };

  function render(route) {
    if (view.error) {
      return `${head("المنهج", "تعذّر تحميل المحتوى.")}
        ${emptyState("تعذّر تحميل هذه الشاشة", view.error)}`;
    }
    const body = renderers[route]?.(view.data) ?? renderers["learn"](view.data);
    const back = route === "learn" ? "" :
      `<div style="margin-block-start:16px">${backButton("رجوع إلى المنهج", "learn-nav", 'data-route="learn"')}</div>`;
    return `${body}${back}`;
  }

  /* ------------------------------------------------------------- hydrate */

  function hydrate(route) {
    const data = view.data;
    if (!data) return;

    if (route === "learn-courses") {
      const outline = document.getElementById("learn-outline");
      if (outline) { outline.course = data.course; outline.progress = data.progress; }
      const lessonEl = document.getElementById("learn-lesson");
      if (lessonEl) {
        lessonEl.lesson = data.lesson;
        lessonEl.labels = data.labels ?? null;
        lessonEl.progress = data.progress?.lessons?.find(l => l.uuid === data.lesson?.uuid) ?? null;
      }
    }
    if (route === "learn-sentences") {
      for (const el of document.querySelectorAll("#learn-sentences df-sentence-card")) {
        el.sentence = data.sentences[Number(el.dataset.index)] ?? null;
      }
    }
    if (route === "learn-listening") {
      const el = document.getElementById("learn-listening");
      if (el) el.activity = data.activity;
    }
    if (route === "learn-pronunciation") {
      const el = document.getElementById("learn-pronunciation");
      if (el) { el.item = data.item; el.history = data.history; }
    }
    if (route === "learn-errors") {
      const el = document.getElementById("learn-errors");
      if (el) { el.summary = data.summary; el.practice = data.practice; }
    }
    if (route === "learn-reminders") {
      const el = document.getElementById("learn-reminders");
      if (el) { el.settings = data.settings; el.plan = data.plan; el.permission = data.permission; }
    }
  }

  /* -------------------------------------------------------------- grading */

  /**
   * Grade one answer.
   *
   * The evaluator is the existing one and the answers it may compare against come from
   * the exercise layer's own filter, so this adds no rule. An exercise whose answer
   * language cannot score is presented as self-checked and produces no verdict.
   */
  function grade(exercise, given) {
    const expected = expectedAnswersFor(exercise);
    if (!exercise?.gradeable || !expected.length) {
      const advisory = evaluateArabicAdvisory(given, { arabic: exercise?.expectedAnswers?.[0]?.text ?? "" });
      return {
        selfAssessed: true,
        correct: null,
        note: advisory.note,
        evaluation: advisory,
        language: exercise?.answerLanguage ?? null
      };
    }

    const primary = expected[0];
    const word = {
      german: primary.text,
      acceptedAnswers: expected.slice(1).map(answer => answer.text),
      itemType: "word",
      article: null
    };
    const evaluation = validateGermanAnswer(given, word);
    return {
      selfAssessed: false,
      correct: evaluation.isCorrect === true,
      note: evaluation.note,
      evaluation,
      language: primary.language
    };
  }

  /*
   * The built-in error taxonomy has to exist before an event can be linked to it:
   * error_event_categories has a foreign key onto error_categories. This is the app's
   * OWN taxonomy from Feature F, not authored course content, so writing it is not
   * fabricating anything — and it is an upsert, so it converges rather than duplicates.
   */
  let taxonomyReady = false;
  async function ensureTaxonomy() {
    if (taxonomyReady || !source.write) return taxonomyReady;
    const at = now();
    await source.write.content.saveErrorTaxonomy({
      categories: BUILT_IN_CATEGORIES.map(category => ({
        uuid: `errcat:${category.slug}`,
        slug: category.slug,
        scope: category.scope,
        ordering: category.ordering,
        contentStatus: "verified", contentVersion: 1,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      })),
      texts: [], remediations: []
    }, { now: at });
    taxonomyReady = true;
    return true;
  }

  /** Record a mistake, but only when the answer was deterministically scoreable. */
  async function recordError(exercise, result, contentContext) {
    if (!source.write || !result?.evaluation) return null;
    await ensureTaxonomy();
    const recorded = recordEvaluation(result.evaluation, {
      profileUuid,
      answerLanguage: result.language,
      occurredAt: now(),
      ...contentContext
    }, { now: now() });
    if (!recorded) return null;

    // The classifier names a category by slug; the store identifies it by uuid.
    recorded.links = recorded.links.map(link => ({
      ...link, categoryUuid: `errcat:${link.categoryUuid}`
    }));

    try {
      await source.write.errors.recordEvent(recorded, { now: now() });
    } catch (error) {
      // A failure to record a mistake must never break the exercise the learner is
      // doing — but it is reported rather than swallowed, because silently losing
      // error history looks identical to having made no mistakes.
      console.error("error event not recorded", error);
      return null;
    }
    return recorded;
  }

  /* -------------------------------------------------------------- actions */

  async function handleAction(action, dataset = {}) {
    switch (action) {
      case "learn-nav":
        view.lessonUuid = null;
        view.result = null;
        view.answer = "";
        return { route: dataset.route ?? "learn" };

      case "learn-course":
        view.courseSlug = dataset.slug ?? null;
        view.lessonUuid = null;
        return { reload: true };

      case "learn-close-lesson":
        view.lessonUuid = null;
        return { reload: true };

      case "learn-open-lesson":
        view.lessonUuid = dataset.lesson ?? null;
        return { reload: true };

      case "learn-complete-lesson":
        return completeLesson(dataset.lesson);

      case "learn-exercise":
        view.exerciseUuid = dataset.uuid ?? null;
        view.result = null;
        view.answer = "";
        return { reload: true };

      case "learn-submit-exercise":
        return submitExercise(dataset);

      case "learn-activity":
        view.activityUuid = dataset.uuid ?? null;
        return { reload: true };

      case "learn-pronunciation-item":
        view.pronunciationUuid = dataset.uuid ?? null;
        return { reload: true };

      default:
        return null;
    }
  }

  async function completeLesson(lessonUuid) {
    if (!source.write) {
      toast("لا يمكن حفظ التقدم بدون مخزن محتوى.", "error");
      return { reload: false };
    }
    const lesson = view.data?.lesson;
    const at = now();
    await source.write.progress.recordLessonProgress({
      lesson: {
        uuid: `lp:${profileUuid}:${lessonUuid}`, profileUuid, lessonUuid,
        status: "completed", startedAt: at, completedAt: at,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      },
      sections: (lesson?.sections ?? []).map(section => ({
        uuid: `sp:${profileUuid}:${section.uuid}`, profileUuid, sectionUuid: section.uuid,
        status: "completed", completedAt: at,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      })),
      course: lesson?.courseUuid ? {
        uuid: `cp:${profileUuid}:${lesson.courseUuid}`, profileUuid, courseUuid: lesson.courseUuid,
        status: "in_progress", startedAt: at, lastLessonUuid: lessonUuid,
        createdAt: at, updatedAt: at, revision: 1, deleted: 0
      } : null
    }, { now: at });

    view.lessonUuid = null;
    toast("سُجِّل إتمام الدرس.", "success");
    return { reload: true };
  }

  async function submitExercise(dataset) {
    const exercise = view.data?.exercise;
    if (!exercise) return { reload: false };

    const given = dataset.choice
      ? exercise.options?.find(option => option.uuid === dataset.choice)?.text ?? ""
      : (document.getElementById("learn-answer")?.value ?? view.answer ?? "").trim();
    view.answer = given;

    const result = grade(exercise, given);
    view.result = {
      ...result,
      chosenId: dataset.choice ?? null,
      correctId: exercise.options?.find(option => option.isExpected)?.uuid ?? null
    };

    if (!result.selfAssessed && result.correct === false) {
      await recordError(exercise, result, {
        contentType: "exercise", contentUuid: exercise.uuid, skill: "exercise"
      });
    }
    return { reload: false };
  }

  /* ------------------------------------------------------- component events */

  /** Custom events dispatched by the Lit components. */
  async function handleEvent(type, detail = {}) {
    switch (type) {
      case "lesson-select":
        view.lessonUuid = detail.lessonUuid ?? null;
        return { reload: true };

      case "item-select":
        return openLessonItem(detail);

      case "practice-select":
        return { reload: false };

      case "segment-select":
        return { reload: false };

      case "self-rate":
        return recordSpokenAttempt(detail);

      case "reminder-change":
        return changeReminder(detail);

      case "permission-request":
        await services.reminders.requestPermission();
        return { reload: true };

      default:
        return null;
    }
  }

  /**
   * Follow a lesson item to the screen that can actually teach it.
   *
   * A vocabulary item is already shown in full on the lesson screen — its German form
   * and its Arabic meaning are the content — so it stays where it is rather than
   * navigating to a screen that would repeat it.
   */
  async function openLessonItem(detail) {
    switch (detail.contentType) {
      case "exercise":
        view.exerciseUuid = detail.contentUuid;
        view.result = null;
        view.answer = "";
        return { route: "learn-exercises" };

      case "listening":
        view.activityUuid = detail.contentUuid;
        return { route: "learn-listening" };

      case "pronunciation":
        view.pronunciationUuid = detail.contentUuid;
        return { route: "learn-pronunciation" };

      case "sentence":
        return { route: "learn-sentences" };

      case "grammar":
      case "grammar_rule":
      case "grammar_topic":
        return { route: "learn-grammar" };

      default:
        return { reload: false };
    }
  }

  async function recordSpokenAttempt(detail) {
    if (!source.write) {
      toast("لا يمكن حفظ التقييم بدون مخزن محتوى.", "error");
      return { reload: false };
    }
    const at = now();
    const assessment = assessSpokenAttempt({ selfRating: detail.selfRating });
    const attempt = buildPronunciationAttempt({
      profileUuid, itemUuid: detail.itemUuid, occurredAt: at,
      selfRating: assessment.selfRating
    }, { now: at });

    await source.write.pronunciation.recordAttempt(attempt, { now: at });

    // A spoken attempt is self-assessed, so the error service classifies it advisory of
    // its own accord. Nothing here makes it deterministic.
    const context = pronunciationErrorContext(view.data?.item, {
      profileUuid, answerLanguage: "de", occurredAt: at
    });
    if (assessment.selfRating === 1) await recordError(null, { evaluation: assessment, language: "de" }, context);

    toast("سُجِّل تقييمك.", "success");
    return { reload: true };
  }

  async function changeReminder(detail) {
    if (!source.write) {
      toast("لا يمكن حفظ التذكيرات بدون مخزن محتوى.", "error");
      return { reload: false };
    }
    await services.reminders.update(profileUuid, { [detail.field]: detail.value });
    return { reload: true };
  }

  return Object.freeze({
    routes: LEARN_ROUTES,
    view,
    runtime,
    load,
    render,
    hydrate,
    handleAction,
    handleEvent,
    grade,
    notify,
    // Exposed for the listening screen's error context, which the host wires on demand.
    listeningErrorContext: activity =>
      listeningErrorContext(activity, { profileUuid, answerLanguage: "de", occurredAt: now() }),
    isScoreable
  });
}
