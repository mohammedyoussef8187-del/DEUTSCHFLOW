/*
 * <df-word-panel> — read-only teaching panel for a vocabulary item.
 *
 * Second study-screen slice. It presents the German form, optional pronunciation, the
 * Arabic meaning, and descriptive pills. It renders no controls, so the intro actions
 * ("I already know it" / "test me later") stay as vanilla buttons outside the panel and
 * the SRS-mutating flow is untouched.
 *
 * The caller passes already-labelled strings (e.g. the item-type label), so the
 * component stays free of domain vocabulary mapping.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

export class DfWordPanel extends LitElement {
  static properties = {
    german: { type: String },
    pronunciation: { type: String },
    meaning: { type: String },
    article: { type: String },
    typelabel: { type: String },
    level: { type: String },
    badge: { type: String }
  };

  static styles = css`
    :host { display: block; }

    .panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 4px;
      min-block-size: 210px;
      padding: 28px;
      margin-block-end: 16px;
      border-radius: 20px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }

    .badge {
      align-self: center;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 11px;
      border-radius: 999px;
      background: rgb(37 99 235 / 14%);
      color: #1d4ed8;
      margin-block-end: 6px;
    }

    .german {
      /* Matches the existing question typography. */
      font-size: clamp(29px, 5vw, 42px);
      font-weight: 850;
      line-height: 1.25;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .pronunciation {
      font-size: 17px;
      color: var(--muted, #64748b);
      margin-block-start: 10px;
    }
    .meaning {
      font-size: 24px;
      font-weight: 850;
      margin-block-start: 18px;
    }

    .details {
      display: flex;
      gap: 7px;
      justify-content: center;
      flex-wrap: wrap;
      margin-block-start: 15px;
    }
    .pill {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0);
      color: var(--muted, #64748b);
    }
    .pill b { color: var(--text, #0f172a); direction: ltr; unicode-bidi: isolate; }

    /* Tablets have room for a more generous teaching panel. */
    @media (min-width: 900px) {
      .panel { min-block-size: 260px; padding: 36px; }
      .meaning { font-size: 27px; }
    }
    @media (max-width: 640px) {
      .panel { min-block-size: 190px; padding: 21px 16px; }
      .meaning { font-size: 21px; }
    }
  `;

  constructor() {
    super();
    this.german = "";
    this.pronunciation = "";
    this.meaning = "";
    this.article = "";
    this.typelabel = "";
    this.level = "";
    this.badge = "";
  }

  render() {
    const pills = [];
    if (this.article) pills.push(html`<span class="pill">الأداة: <b lang="de">${this.article}</b></span>`);
    if (this.typelabel) pills.push(html`<span class="pill">${this.typelabel}</span>`);
    if (this.level) pills.push(html`<span class="pill">${this.level}</span>`);

    return html`
      <section class="panel">
        ${this.badge ? html`<span class="badge">${this.badge}</span>` : nothing}
        <div class="german" lang="de">${this.german}</div>
        ${this.pronunciation ? html`<div class="pronunciation">${this.pronunciation}</div>` : nothing}
        ${this.meaning ? html`<div class="meaning">${this.meaning}</div>` : nothing}
        ${pills.length ? html`<div class="details">${pills}</div>` : nothing}
      </section>
    `;
  }
}

if (!customElements.get("df-word-panel")) {
  customElements.define("df-word-panel", DfWordPanel);
}
