/*
 * <df-word-row> — one entry in the vocabulary list.
 *
 * Light DOM: the row itself is the edit affordance, dispatched through the app's
 * delegated document click listener as data-action="edit-word", and the list is styled
 * by the existing global stylesheet.
 *
 * Presentation only. Mastery and status are computed by the domain layer and passed in;
 * the row never reads cards or recomputes learner state.
 */

import { LitElement, html, nothing } from "../../../vendor/lit.js";

export class DfWordRow extends LitElement {
  static properties = {
    wordid: { type: String },
    german: { type: String },
    arabic: { type: String },
    pronunciation: { type: String },
    favorite: { type: Boolean },
    flagged: { type: Boolean },
    mastery: { type: Number },
    // Already-resolved status class and label from the domain layer.
    statusclass: { type: String },
    statuslabel: { type: String }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.wordid = "";
    this.german = "";
    this.arabic = "";
    this.pronunciation = "";
    this.favorite = false;
    this.flagged = false;
    this.mastery = 0;
    this.statusclass = "";
    this.statuslabel = "";
  }

  render() {
    return html`
      <article class="word-row" data-action="edit-word" data-id=${this.wordid}>
        <div class="word-main">
          <div class="word-german" lang="de">${this.german}</div>
          <div class="word-arabic">
            ${this.arabic}${this.pronunciation ? ` · ${this.pronunciation}` : ""}
          </div>
        </div>
        <div class="word-side">
          ${this.favorite ? "⭐" : nothing}
          ${this.flagged ? html`<span class="pill due">بيانات</span>` : nothing}
          <span class="pill">${this.mastery}%</span>
          ${this.statuslabel
            ? html`<span class="pill ${this.statusclass}">${this.statuslabel}</span>`
            : nothing}
        </div>
      </article>
    `;
  }
}

if (!customElements.get("df-word-row")) {
  customElements.define("df-word-row", DfWordRow);
}
