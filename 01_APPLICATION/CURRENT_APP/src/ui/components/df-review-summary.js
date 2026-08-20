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
import "./df-stat-tile.js";

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

    /* Tile presentation now lives in <df-stat-tile>; only layout remains here. */

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

    /* Phone portrait: two compact columns rather than a single tall stack.
       The tiles themselves shrink via their own internal breakpoint. */
    @media (max-width: 430px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
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

  #tile(tone, icon, value, label) {
    return html`
      <df-stat-tile
        tone=${tone}
        icon=${icon}
        value=${this.#format(value)}
        label=${label}
      ></df-stat-tile>
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
