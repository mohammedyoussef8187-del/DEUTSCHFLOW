/*
 * <df-review-summary> — the first real Lit component.
 *
 * Presentation only. It receives an already-derived summary object from the application
 * service and renders it. It has NO access to IndexedDB, SQLite, Capacitor plugins, or
 * SRS scheduling internals, performs no I/O, and cannot mutate learner or SRS data: it
 * never writes, and it only reads numbers off the object handed to it.
 *
 * Interaction is limited to requesting navigation/session start by dispatching a
 * composed DOM event. The host application decides what to do; the component itself
 * changes nothing.
 *
 * Layout is iPad-first: a fluid auto-fit grid that yields 4 columns on tablet
 * landscape, 2 on tablet portrait / large phones, and stays readable down to small
 * phones, without any device sniffing. Styles are scoped in shadow DOM so the existing
 * global stylesheet keeps working untouched during incremental migration; theme colors
 * are inherited from the app's existing CSS custom properties, so light/dark and RTL
 * continue to work with no duplication.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  heading: "نظرة عامة",
  due: "مستحقة",
  new: "جديدة",
  weak: "ضعيفة",
  mastered: "متقنة",
  learning: "قيد التعلم",
  vocabulary: "إجمالي المفردات",
  empty: "لا توجد بيانات لعرضها بعد.",
  start: "ابدأ المراجعة"
});

const NUMBER_LOCALE = "ar-EG";

export class DfReviewSummary extends LitElement {
  static properties = {
    // Plain data from the application service. Reassigning it re-renders reactively.
    summary: { attribute: false },
    compact: { type: Boolean, reflect: true }
  };

  static styles = css`
    :host {
      display: block;
      /* Inherit the app's existing design tokens rather than redefining them. */
      color: var(--text, #0f172a);
      font-family: inherit;
    }
    :host([hidden]) { display: none; }

    .grid {
      display: grid;
      gap: 12px;
      /* iPad-first: fills 4 across in landscape, 2 in portrait, 1 on small phones. */
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    :host([compact]) .grid {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
    }

    .tile {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      /* Comfortable touch target on tablets and phones. */
      min-height: 64px;
    }

    .icon {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border-radius: 12px;
      font-size: 18px;
      background: var(--metric-bg, rgb(15 118 110 / 12%));
      color: var(--metric-fg, #0f766e);
      flex: none;
    }
    .tile.due .icon    { background: rgb(217 119 6 / 14%);  color: #b45309; }
    .tile.new .icon    { background: rgb(37 99 235 / 14%);  color: #1d4ed8; }
    .tile.weak .icon   { background: rgb(220 38 38 / 14%);  color: #b91c1c; }
    .tile.mastered .icon { background: rgb(22 163 74 / 14%); color: #15803d; }

    .value {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      min-inline-size: 0;
    }
    .value strong {
      font-size: 22px;
      font-variant-numeric: tabular-nums;
    }
    .value span {
      font-size: 13px;
      color: var(--muted, #64748b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .totals {
      margin-block-start: 10px;
      font-size: 13px;
      color: var(--muted, #64748b);
    }

    .empty {
      padding: 16px;
      border-radius: 16px;
      border: 1px dashed var(--border, #e2e8f0);
      color: var(--muted, #64748b);
      font-size: 14px;
    }

    /* Phone portrait: two compact columns rather than a single tall stack. */
    @media (max-width: 430px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .tile { padding: 11px 12px; gap: 9px; min-height: 58px; }
      .icon { inline-size: 32px; block-size: 32px; font-size: 16px; }
      .value strong { font-size: 19px; }
      .value span { font-size: 12px; }
    }

    /* Large tablet landscape / desktop-width windows: keep tiles from stretching. */
    @media (min-width: 1180px) {
      .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }

    @media (prefers-reduced-motion: no-preference) {
      .tile { transition: border-color 120ms ease; }
    }
  `;

  constructor() {
    super();
    this.summary = null;
    this.compact = false;
  }

  /** Format counts using the app's existing numeral convention. */
  #format(value) {
    return Number(value ?? 0).toLocaleString(NUMBER_LOCALE);
  }

  #tile(kind, icon, value, label) {
    return html`
      <div class="tile ${kind}" part="tile">
        <span class="icon" aria-hidden="true">${icon}</span>
        <span class="value">
          <strong>${this.#format(value)}</strong>
          <span>${label}</span>
        </span>
      </div>
    `;
  }

  render() {
    const summary = this.summary;
    if (!summary || !summary.counts) {
      return html`<div class="empty" role="status">${LABELS.empty}</div>`;
    }

    const counts = summary.counts;
    // "Due" mirrors the existing dashboard: items due plus items already overdue.
    const dueTotal = (counts.due ?? 0) + (counts.overdue ?? 0);

    return html`
      <div class="grid" role="group" aria-label=${LABELS.heading}>
        ${this.#tile("due", "↻", dueTotal, LABELS.due)}
        ${this.#tile("new", "✦", counts.new, LABELS.new)}
        ${this.#tile("weak", "!", counts.weak, LABELS.weak)}
        ${this.#tile("mastered", "✓", counts.mastered, LABELS.mastered)}
      </div>
      ${summary.vocabularyTotal
        ? html`<p class="totals">
            ${LABELS.vocabulary}: ${this.#format(summary.vocabularyTotal)}
            · ${LABELS.learning}: ${this.#format(counts.learning)}
          </p>`
        : nothing}
    `;
  }
}

if (!customElements.get("df-review-summary")) {
  customElements.define("df-review-summary", DfReviewSummary);
}
