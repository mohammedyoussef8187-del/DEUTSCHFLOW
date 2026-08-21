/*
 * <df-stat-tile> — shared presentation primitive for a single metric tile.
 *
 * Extracted because the same tile markup and styling was repeated across the dashboard,
 * the statistics page, and the import preview. It is deliberately "dumb": it renders the
 * strings it is given and knows nothing about learners, SRS, storage, or where the
 * numbers came from.
 *
 * Everything is a plain string attribute, so the existing vanilla views can keep
 * rendering HTML strings (`<df-stat-tile icon="✓" value="12" label="…">`) with no
 * post-render hydration step. That is what makes the migration incremental.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

export class DfStatTile extends LitElement {
  static properties = {
    icon: { type: String },
    value: { type: String },
    label: { type: String },
    // Visual accent only: due | new | weak | mastered | neutral.
    tone: { type: String, reflect: true }
  };

  static styles = css`
    :host {
      display: block;
      color: var(--text, #0f172a);
      font-family: inherit;
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
      block-size: 100%;
      box-sizing: border-box;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border-radius: 12px;
      font-size: 18px;
      background: rgb(15 118 110 / 12%);
      color: #0f766e;
      flex: none;
    }
    :host([tone="due"])      .icon { background: rgb(217 119 6 / 14%);  color: #b45309; }
    :host([tone="new"])      .icon { background: rgb(37 99 235 / 14%);  color: #1d4ed8; }
    :host([tone="weak"])     .icon { background: rgb(220 38 38 / 14%);  color: #b91c1c; }
    :host([tone="mastered"]) .icon { background: rgb(22 163 74 / 14%);  color: #15803d; }

    /* Icon-less variant: a compact stacked metric, used by the session summary and the
       data-audit row. Text alignment is inherited from the host so it keeps matching
       whichever container it sits in. */
    .tile.plain {
      display: block;
      padding: 15px;
      border-radius: 15px;
      min-height: 0;
    }
    .tile.plain .value strong { display: block; font-size: 24px; }
    .tile.plain .value span { font-size: 12px; white-space: normal; }

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

    @media (max-width: 430px) {
      .tile { padding: 11px 12px; gap: 9px; min-height: 58px; }
      .icon { inline-size: 32px; block-size: 32px; font-size: 16px; }
      .value strong { font-size: 19px; }
      .value span { font-size: 12px; }
    }
  `;

  constructor() {
    super();
    this.icon = "";
    this.value = "";
    this.label = "";
    this.tone = "neutral";
  }

  render() {
    // No icon means the compact stacked variant; existing icon tiles are unaffected.
    const plain = !this.icon;
    return html`
      <div class="tile ${plain ? "plain" : ""}" part="tile">
        ${plain ? nothing : html`<span class="icon" aria-hidden="true">${this.icon}</span>`}
        <span class="value">
          <strong>${this.value}</strong>
          <span>${this.label}</span>
        </span>
      </div>
    `;
  }
}

if (!customElements.get("df-stat-tile")) {
  customElements.define("df-stat-tile", DfStatTile);
}
