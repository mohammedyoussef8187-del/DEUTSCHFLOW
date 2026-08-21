/*
 * <df-skill-bar> — accuracy bar for one study skill on the statistics page.
 *
 * Light DOM here, unlike the other read-only components: the bar styling
 * (.mini-progress) already exists in the global stylesheet and is shared with other
 * views, so duplicating it into a shadow root would mean maintaining it twice. There is
 * no naming conflict to isolate against.
 *
 * Accessibility: the bar was a bare styled div, invisible to assistive technology. It is
 * now a real progressbar with its value and an accessible name.
 */

import { LitElement, html } from "../../../vendor/lit.js";

export class DfSkillBar extends LitElement {
  static properties = {
    label: { type: String },
    accuracy: { type: Number },
    attempts: { type: String },
    detail: { type: String }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.label = "";
    this.accuracy = 0;
    this.attempts = "";
    this.detail = "";
  }

  render() {
    const pct = Math.max(0, Math.min(100, Number(this.accuracy) || 0));
    return html`
      <div class="skill-row">
        <div class="skill-head">
          <span>${this.label}${this.attempts ? ` · ${this.attempts}` : ""}</span>
          <strong>${pct}%</strong>
        </div>
        <div
          class="mini-progress"
          role="progressbar"
          aria-label=${this.label}
          aria-valuenow=${pct}
          aria-valuemin="0"
          aria-valuemax="100"
        ><span style="width:${pct}%"></span></div>
        ${this.detail ? html`<small class="skill-detail">${this.detail}</small>` : ""}
      </div>
    `;
  }
}

if (!customElements.get("df-skill-bar")) {
  customElements.define("df-skill-bar", DfSkillBar);
}
