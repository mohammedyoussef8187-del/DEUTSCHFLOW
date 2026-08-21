/*
 * <df-activity-chart> — the seven-day study activity bars.
 *
 * Light DOM so the existing .activity-bars / .day-bar / .bar styles apply unchanged.
 *
 * Accessibility: a bar chart built from styled divs conveys nothing to a screen reader.
 * The chart is now a single labelled image with a text alternative listing each day and
 * its count, and the decorative bars are hidden from the accessibility tree.
 */

import { LitElement, html } from "../../../vendor/lit.js";

export class DfActivityChart extends LitElement {
  static properties = {
    // JSON array of { label, n }.
    days: { type: String },
    caption: { type: String }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.days = "";
    this.caption = "نشاط آخر 7 أيام";
  }

  #days() {
    if (!this.days) return [];
    try {
      const parsed = JSON.parse(this.days);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  render() {
    const days = this.#days();
    // The tallest bar defines the scale; at least 1 so an all-zero week stays flat.
    const max = Math.max(1, ...days.map(d => Number(d.n) || 0));
    const summary = days.map(d => `${d.label}: ${Number(d.n) || 0}`).join("، ");

    return html`
      <div class="activity-bars" role="img" aria-label="${this.caption} — ${summary}">
        ${days.map(day => {
          const n = Number(day.n) || 0;
          return html`
            <div class="day-bar" aria-hidden="true">
              <b>${n}</b>
              <div class="bar" style="height:${Math.max(3, (n / max) * 100)}%"></div>
              <small>${day.label}</small>
            </div>
          `;
        })}
      </div>
    `;
  }
}

if (!customElements.get("df-activity-chart")) {
  customElements.define("df-activity-chart", DfActivityChart);
}
