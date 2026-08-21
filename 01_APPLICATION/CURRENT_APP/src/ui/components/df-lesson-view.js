/*
 * <df-lesson-view> — read-only assembly of one lesson's sections and items.
 *
 * Minimum UI to prove that a lesson composes mixed canonical content: a section can
 * hold vocabulary, sentences, grammar and exercises side by side, each referenced as
 * (contentType, contentUuid). Listening and pronunciation render the same way once
 * those content types exist, with no change here.
 *
 * It renders the structure, not the content bodies — resolving a contentUuid to a word
 * or an exercise belongs to the content services, not to this component. Nothing here
 * reads storage, scores an answer, or touches SRS state.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  untitled: "بدون عنوان",
  optional: "اختياري",
  empty: "لا يوجد درس",
  emptyLesson: "هذا الدرس بلا محتوى بعد",
  completed: "مكتمل"
});

const SECTION_LABEL = Object.freeze({
  intro: "مقدمة",
  vocabulary: "المفردات",
  grammar: "القواعد",
  reading: "القراءة",
  practice: "تدريب",
  review: "مراجعة"
});

const CONTENT_LABEL = Object.freeze({
  vocabulary: "مفردة",
  grammar_topic: "موضوع نحوي",
  grammar_rule: "قاعدة",
  sentence: "جملة",
  exercise: "تمرين",
  listening: "استماع",
  pronunciation: "نطق"
});

export class DfLessonView extends LitElement {
  static properties = {
    // Assembled lesson from the curriculum service.
    lesson: { attribute: false },
    // Optional per-lesson progress view from courseProgressFor().
    progress: { attribute: false }
  };

  static styles = css`
    :host { display: block; }
    .lesson {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .title { font-size: clamp(18px, 2.4vw, 22px); font-weight: 800; }
    .en { direction: ltr; unicode-bidi: isolate; }
    .subtitle { margin-block-start: 4px; color: var(--muted, #64748b); }
    .meta { display: flex; gap: 7px; flex-wrap: wrap; margin-block-start: 10px; }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    .section { margin-block-start: 18px; }
    .section-head { display: flex; gap: 8px; align-items: baseline; }
    .section-title { font-size: 14px; font-weight: 700; }
    .items { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .item {
      display: flex; gap: 10px; align-items: center;
      padding: 10px 12px; min-height: 44px; box-sizing: border-box;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
    }
    .ref { flex: 1; font-size: 12px; color: var(--muted, #64748b); direction: ltr; unicode-bidi: isolate; }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .lesson { padding: 22px; } }
  `;

  constructor() {
    super();
    this.lesson = null;
    this.progress = null;
  }

  #sectionStatus(sectionUuid) {
    return this.progress?.sections?.find(section => section.uuid === sectionUuid)?.status ?? null;
  }

  #renderItem(item) {
    return html`
      <li class="item" data-item=${item.uuid} data-content-type=${item.contentType}>
        <span class="pill">${CONTENT_LABEL[item.contentType] ?? item.contentType}</span>
        <span class="ref">${item.contentUuid}</span>
        ${item.required ? nothing : html`<span class="pill">${LABELS.optional}</span>`}
      </li>
    `;
  }

  #renderSection(section) {
    const status = this.#sectionStatus(section.uuid);
    const name = section.title?.en || SECTION_LABEL[section.kind] || section.slug;
    return html`
      <div class="section" data-section=${section.uuid} data-kind=${section.kind}>
        <div class="section-head">
          <span class="section-title">${name}</span>
          ${status === "completed" ? html`<span class="pill">${LABELS.completed}</span>` : nothing}
        </div>
        <ul class="items">${section.items.map(item => this.#renderItem(item))}</ul>
      </div>
    `;
  }

  render() {
    const lesson = this.lesson;
    if (!lesson) return html`<p class="empty">${LABELS.empty}</p>`;

    const title = lesson.title?.en || lesson.title?.de || lesson.slug || LABELS.untitled;

    return html`
      <article class="lesson">
        <h2 class="title en">${title}</h2>
        ${lesson.title?.ar ? html`<div class="subtitle">${lesson.title.ar}</div>` : nothing}
        <div class="meta">
          ${lesson.cefrLevel ? html`<span class="pill">${lesson.cefrLevel}</span>` : nothing}
          ${lesson.contentStatus ? html`<span class="pill">${lesson.contentStatus}</span>` : nothing}
        </div>
        ${lesson.sections.length
          ? lesson.sections.map(section => this.#renderSection(section))
          : html`<p class="empty">${LABELS.emptyLesson}</p>`}
      </article>
    `;
  }
}

if (!customElements.get("df-lesson-view")) {
  customElements.define("df-lesson-view", DfLessonView);
}
