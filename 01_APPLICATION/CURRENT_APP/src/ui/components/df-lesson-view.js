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
 *
 * What it will not do is show a learner a uuid. Resolution stays outside, but the
 * resolved LABEL is accepted as a property: the host looks each item up through the
 * services and hands the result over. Without one an item falls back to its identifier,
 * which is a visible defect rather than a silent one.
 *
 * Each item is a button that announces `item-select` with the item it stands for. The
 * component decides nothing about what that means — the host routes it — but a lesson
 * whose parts cannot be opened is a table of contents, not a lesson.
 *
 * It also renders what the lesson TEACHES. A section carries text as well as items — the
 * objective it opens with, the situation it happens in, a reading passage, the mistakes to
 * watch for, the summary at the end — and a screen that showed only the items would be a
 * list of exercises rather than a lesson. Each kind is presented as what it is.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  untitled: "بدون عنوان",
  optional: "اختياري",
  empty: "لا يوجد درس",
  emptyLesson: "هذا الدرس بلا محتوى بعد",
  completed: "مكتمل"
});

/** How each kind of section text is introduced to the learner. */
const TEACHING_LABEL = Object.freeze({
  objective: "الهدف",
  "can-do": "بعد هذا الدرس",
  context: "الموقف",
  passage: "النص",
  "passage-translation": "الترجمة",
  summary: "الخلاصة",
  mistake: "خطأ شائع"
});

/* The order teaching text is read in: why we are here, then the situation, then the text
   itself, then what to avoid, then what to carry away. */
const TEACHING_ORDER = Object.freeze([
  "objective", "can-do", "context", "title", "passage", "passage-translation",
  "summary", "mistake"
]);

/** Kinds whose body is German and must be read left to right inside an RTL page. */
const GERMAN_TEACHING = Object.freeze(["passage"]);

const SECTION_LABEL = Object.freeze({
  intro: "مقدمة",
  vocabulary: "المفردات",
  context: "الجمل في السياق",
  listening: "الاستماع",
  production: "التعبير",
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
    progress: { attribute: false },
    // contentUuid -> { title, detail, lang }, resolved by the host through the services.
    labels: { attribute: false }
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
    .teaching { display: grid; gap: 10px; margin-block-start: 10px; }
    .teach {
      border-inline-start: 3px solid var(--border, #e2e8f0);
      padding-inline-start: 10px;
    }
    .teach-label {
      display: block; font-size: 12px; font-weight: 700;
      color: var(--muted, #64748b); margin-block-end: 2px;
    }
    .teach-body { margin: 0; line-height: 1.7; white-space: pre-wrap; }
    .teach.mistake { border-inline-start-color: var(--warning, #d97706); }
    .teach.objective { border-inline-start-color: var(--accent, #2563eb); }
    .teach .de { direction: ltr; unicode-bidi: isolate; text-align: start; }
    .detail { color: var(--muted); font-size: 12px; }
    .item:hover, .item:focus-visible { border-color: var(--accent, currentColor); }
    .item {
      display: flex; gap: 10px; align-items: center; width: 100%; text-align: start;
      padding: 10px 12px; min-height: 44px; box-sizing: border-box;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: none; color: inherit; font: inherit; cursor: pointer;
    }
    .ref { flex: 1; font-size: 12px; color: var(--muted, #64748b); direction: ltr; unicode-bidi: isolate; }
    .label { flex: 1; font-weight: 600; unicode-bidi: isolate; }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .lesson { padding: 22px; } }
  `;

  constructor() {
    super();
    this.lesson = null;
    this.progress = null;
    this.labels = null;
  }

  #sectionStatus(sectionUuid) {
    return this.progress?.sections?.find(section => section.uuid === sectionUuid)?.status ?? null;
  }

  #labelFor(item) {
    return this.labels?.[item.contentUuid] ?? null;
  }

  #select(item) {
    this.dispatchEvent(new CustomEvent("item-select", {
      bubbles: true,
      composed: true,
      detail: {
        itemUuid: item.uuid,
        contentType: item.contentType,
        contentUuid: item.contentUuid
      }
    }));
  }

  #renderItem(item) {
    const label = this.#labelFor(item);
    return html`
      <li>
        <button
          class="item"
          type="button"
          data-item=${item.uuid}
          data-content-type=${item.contentType}
          @click=${() => this.#select(item)}
        >
          <span class="pill">${CONTENT_LABEL[item.contentType] ?? item.contentType}</span>
          <span class=${label?.title ? "label" : "ref"} lang=${label?.lang ?? "ar"} dir="auto"
            >${label?.title ?? item.contentUuid}</span>
          ${label?.detail ? html`<span class="detail" dir="auto">${label.detail}</span>` : nothing}
          ${item.required ? nothing : html`<span class="pill">${LABELS.optional}</span>`}
        </button>
      </li>
    `;
  }

  /** One piece of what the section teaches, labelled by what kind of thing it is. */
  #renderTeaching(kind, values) {
    const arabic = values?.ar ?? null;
    const german = values?.de ?? null;
    const english = values?.en ?? null;
    const body = arabic ?? german ?? english;
    if (!body) return nothing;
    const isGerman = !arabic && (german || GERMAN_TEACHING.includes(kind));

    return html`
      <div class="teach ${kind}">
        <span class="teach-label">${TEACHING_LABEL[kind] ?? kind}</span>
        <p class="teach-body ${isGerman ? "de" : ""}" lang=${isGerman ? "de" : "ar"} dir="auto"
          >${body}</p>
        ${arabic && german ? html`<p class="teach-body de" lang="de" dir="ltr">${german}</p>` : nothing}
      </div>
    `;
  }

  #renderSection(section) {
    const status = this.#sectionStatus(section.uuid);
    const name = SECTION_LABEL[section.kind] || section.title?.ar || section.title?.en || section.slug;
    const teaching = section.teaching ?? {};
    const kinds = TEACHING_ORDER.filter(kind => teaching[kind])
      .concat(Object.keys(teaching).filter(kind => !TEACHING_ORDER.includes(kind)));

    return html`
      <div class="section" data-section=${section.uuid} data-kind=${section.kind}>
        <div class="section-head">
          <span class="section-title">${name}</span>
          ${status === "completed" ? html`<span class="pill">${LABELS.completed}</span>` : nothing}
        </div>
        ${kinds.length
          ? html`<div class="teaching">${kinds.map(kind => this.#renderTeaching(kind, teaching[kind]))}</div>`
          : nothing}
        ${section.items.length
          ? html`<ul class="items">${section.items.map(item => this.#renderItem(item))}</ul>`
          : nothing}
      </div>
    `;
  }

  render() {
    const lesson = this.lesson;
    if (!lesson) return html`<p class="empty">${LABELS.empty}</p>`;

    const title = lesson.title?.de || lesson.title?.en || lesson.slug || LABELS.untitled;

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
