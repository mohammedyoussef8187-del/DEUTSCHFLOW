/*
 * <df-course-outline> — read-only course → unit → lesson outline with progress.
 *
 * Minimum UI to prove the Feature E architecture end to end: curriculum service
 * assembles → component renders navigation, progress and the resume point. It is not
 * the finished course UI.
 *
 * It takes an already-assembled course and an already-derived progress summary. It
 * computes no progress of its own, reads no storage, and never touches SRS state — a
 * lesson shown as completed says nothing about the review cards for its vocabulary.
 *
 * Navigation is a request, not an action: selecting a lesson dispatches `lesson-select`
 * and the host decides what to do. Locked lessons dispatch nothing.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  untitled: "بدون عنوان",
  locked: "مقفل",
  resume: "تابع من هنا",
  completed: "مكتمل",
  in_progress: "قيد التقدم",
  not_started: "لم يبدأ",
  lessons: "دروس",
  empty: "لا توجد دورات بعد"
});

const STATUS_LABEL = Object.freeze({
  completed: LABELS.completed,
  in_progress: LABELS.in_progress,
  not_started: LABELS.not_started
});

export class DfCourseOutline extends LitElement {
  static properties = {
    // Assembled course from the curriculum service.
    course: { attribute: false },
    // Derived summary from courseProgressFor(); optional.
    progress: { attribute: false }
  };

  static styles = css`
    :host { display: block; }
    .course {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .title { font-size: clamp(18px, 2.4vw, 22px); font-weight: 800; }
    .en { direction: ltr; unicode-bidi: isolate; }
    .source { margin-block-start: 4px; font-size: 12px; color: var(--muted, #64748b); }
    .bar {
      margin-block-start: 12px; height: 8px; border-radius: 999px;
      background: var(--border, #e2e8f0); overflow: hidden;
    }
    .fill { height: 100%; background: var(--accent, #2563eb); }
    .count { margin-block-start: 6px; font-size: 12px; color: var(--muted, #64748b); }
    .unit { margin-block-start: 18px; }
    .unit-title { font-size: 14px; font-weight: 700; }
    .lessons { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .lesson {
      display: flex; gap: 10px; align-items: center; width: 100%;
      padding: 12px 14px; min-height: 44px; text-align: start;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit;
      font: inherit; cursor: pointer;
    }
    .lesson[disabled] { cursor: not-allowed; opacity: 0.6; }
    .lesson[data-resume="true"] { border-color: var(--accent, #2563eb); border-width: 2px; }
    .lesson-name { flex: 1; }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .course { padding: 22px; } }
  `;

  constructor() {
    super();
    this.course = null;
    this.progress = null;
  }

  #lessonProgress(lessonUuid) {
    return this.progress?.lessons?.find(lesson => lesson.uuid === lessonUuid) ?? null;
  }

  #select(lesson, unlocked) {
    if (!unlocked) return;
    this.dispatchEvent(new CustomEvent("lesson-select", {
      detail: { courseUuid: this.course?.uuid ?? null, lessonUuid: lesson.uuid, slug: lesson.slug },
      bubbles: true,
      composed: true
    }));
  }

  #renderLesson(lesson) {
    const state = this.#lessonProgress(lesson.uuid);
    // Without a progress summary every lesson is shown as available: the outline
    // reports what it was given rather than guessing at learner state.
    const unlocked = state ? state.unlocked : true;
    const status = state?.status ?? "not_started";
    const isResume = this.progress?.resume?.lessonUuid === lesson.uuid;
    const name = lesson.title?.en || lesson.title?.de || lesson.slug || LABELS.untitled;

    return html`
      <li>
        <button
          class="lesson"
          type="button"
          data-lesson=${lesson.uuid}
          data-status=${status}
          data-resume=${String(isResume)}
          ?disabled=${!unlocked}
          aria-disabled=${String(!unlocked)}
          @click=${() => this.#select(lesson, unlocked)}
        >
          <span class="lesson-name en">${name}</span>
          ${isResume ? html`<span class="pill">${LABELS.resume}</span>` : nothing}
          ${state && state.sectionsTotal
            ? html`<span class="pill">${state.sectionsCompleted}/${state.sectionsTotal}</span>`
            : nothing}
          <span class="pill">${unlocked ? STATUS_LABEL[status] ?? status : LABELS.locked}</span>
        </button>
      </li>
    `;
  }

  render() {
    const course = this.course;
    if (!course) return html`<p class="empty">${LABELS.empty}</p>`;

    const percent = this.progress?.percent ?? 0;
    const title = course.title?.en || course.title?.de || course.slug || LABELS.untitled;

    return html`
      <section class="course">
        <h2 class="title en">${title}</h2>
        ${course.cefrLevel ? html`<span class="pill">${course.cefrLevel}</span>` : nothing}
        ${course.source?.title
          ? html`<div class="source en">
              ${[course.source.title, course.source.publisher].filter(Boolean).join(" · ")}
            </div>`
          : nothing}

        <div class="bar" role="progressbar"
             aria-valuenow=${percent} aria-valuemin="0" aria-valuemax="100">
          <div class="fill" style="width:${percent}%"></div>
        </div>
        <div class="count">
          ${this.progress
            ? html`${this.progress.lessonsCompleted}/${this.progress.lessonsTotal} ${LABELS.lessons} · ${percent}%`
            : nothing}
        </div>

        ${course.units.map(unit => html`
          <div class="unit" data-unit=${unit.uuid}>
            <div class="unit-title en">${unit.title?.en || unit.slug}</div>
            <ul class="lessons">${unit.lessons.map(lesson => this.#renderLesson(lesson))}</ul>
          </div>
        `)}
      </section>
    `;
  }
}

if (!customElements.get("df-course-outline")) {
  customElements.define("df-course-outline", DfCourseOutline);
}
