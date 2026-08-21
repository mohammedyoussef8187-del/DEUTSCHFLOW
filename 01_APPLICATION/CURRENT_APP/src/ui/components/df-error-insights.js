/*
 * <df-error-insights> — read-only view of what the learner keeps getting wrong.
 *
 * Minimum UI to prove the Feature F architecture end to end: error service summarizes →
 * component renders patterns and suggested practice. It is not the finished UI.
 *
 * It takes an already-derived summary and practice list. It counts nothing itself,
 * reads no storage, and cannot reschedule anything: selecting a suggestion dispatches
 * `practice-select` and the host decides. Suggestions are labelled as suggestions,
 * because the review queue remains the thing that decides what is actually due.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  heading: "أخطاؤك المتكررة",
  none: "لا توجد أخطاء متكررة بعد",
  times: "مرات",
  suggestions: "اقتراحات للتدريب",
  suggestionNote: "اقتراح فقط — لا يغيّر مواعيد المراجعة",
  advisoryNote: "أخطاء مسجَّلة للاطّلاع فقط ولا تُحتسب",
  unnamed: "غير مصنَّف",
  active: "نشط",
  improving: "يتحسّن",
  resolved: "معالَج"
});

const STATUS_LABEL = Object.freeze({
  active: LABELS.active,
  improving: LABELS.improving,
  resolved: LABELS.resolved
});

export class DfErrorInsights extends LitElement {
  static properties = {
    // summarizeErrors() output.
    summary: { attribute: false },
    // practiceQueue() output.
    practice: { attribute: false }
  };

  static styles = css`
    :host { display: block; }
    .panel {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .heading { font-size: clamp(17px, 2.2vw, 20px); font-weight: 800; }
    .note { margin-block-start: 4px; font-size: 12px; color: var(--muted, #64748b); }
    .patterns { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .pattern {
      display: flex; gap: 10px; align-items: center;
      padding: 12px 14px; min-height: 44px; box-sizing: border-box;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
    }
    .name { flex: 1; font-weight: 700; }
    .en { direction: ltr; unicode-bidi: isolate; }
    .advice { margin-block-start: 4px; font-weight: 400; font-size: 12px; color: var(--muted, #64748b); }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    .suggestions { margin-block-start: 18px; }
    .sub { font-size: 14px; font-weight: 700; }
    .list { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .suggestion {
      display: flex; gap: 10px; align-items: center; width: 100%;
      padding: 10px 12px; min-height: 44px; text-align: start;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit; font: inherit; cursor: pointer;
    }
    .ref { flex: 1; font-size: 12px; color: var(--muted, #64748b); direction: ltr; unicode-bidi: isolate; }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .panel { padding: 22px; } }
  `;

  constructor() {
    super();
    this.summary = null;
    this.practice = null;
  }

  #select(entry) {
    this.dispatchEvent(new CustomEvent("practice-select", {
      detail: {
        contentType: entry.contentType,
        contentUuid: entry.contentUuid,
        categorySlug: entry.categorySlug
      },
      bubbles: true,
      composed: true
    }));
  }

  #renderPattern(pattern) {
    const name = pattern.name?.en || pattern.categorySlug || LABELS.unnamed;
    const advice = pattern.advice?.ar || pattern.advice?.en || null;
    return html`
      <li class="pattern" data-category=${pattern.categorySlug} data-status=${pattern.status}>
        <div class="name">
          <span class="en">${name}</span>
          ${advice ? html`<div class="advice">${advice}</div>` : nothing}
        </div>
        <span class="pill">${pattern.occurrences} ${LABELS.times}</span>
        <span class="pill">${STATUS_LABEL[pattern.status] ?? pattern.status}</span>
      </li>
    `;
  }

  #renderSuggestion(entry) {
    return html`
      <li>
        <button
          class="suggestion"
          type="button"
          data-content-type=${entry.contentType}
          data-content=${entry.contentUuid}
          @click=${() => this.#select(entry)}
        >
          <span class="pill">${entry.contentType}</span>
          <span class="ref">${entry.contentUuid}</span>
          <span class="pill">${entry.categorySlug}</span>
        </button>
      </li>
    `;
  }

  render() {
    const summary = this.summary;
    const patterns = summary?.patterns ?? [];
    const practice = this.practice ?? [];

    return html`
      <section class="panel">
        <h2 class="heading">${LABELS.heading}</h2>
        ${summary?.unscoredEvents
          ? html`<div class="note">${summary.unscoredEvents} · ${LABELS.advisoryNote}</div>`
          : nothing}

        ${patterns.length
          ? html`<ul class="patterns">${patterns.map(pattern => this.#renderPattern(pattern))}</ul>`
          : html`<p class="empty">${LABELS.none}</p>`}

        ${practice.length
          ? html`
            <div class="suggestions">
              <div class="sub">${LABELS.suggestions}</div>
              <div class="note">${LABELS.suggestionNote}</div>
              <ul class="list">${practice.map(entry => this.#renderSuggestion(entry))}</ul>
            </div>`
          : nothing}
      </section>
    `;
  }
}

if (!customElements.get("df-error-insights")) {
  customElements.define("df-error-insights", DfErrorInsights);
}
