/*
 * <df-order-builder> — the sentence-ordering exercise.
 *
 * Light DOM, so the delegated document click listener resolves data-action together
 * with data-index for the token buttons.
 *
 * Presentation only. Token selection state lives in the application (state.orderState)
 * and is passed in; this component neither reorders nor validates anything. The
 * enable/disable rules are carried over unchanged:
 *   - tokens are disabled once a result is showing
 *   - reset is disabled with a result, or while nothing has been selected
 *   - check is disabled with a result, or while tokens remain in the bank
 *   - reveal is removed entirely once a result is showing
 */

import { LitElement, html, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  empty: "اختر الكلمات بالترتيب",
  reset: "إعادة",
  check: "تحقق",
  reveal: "لا أعرفها — أظهر الإجابة"
});

export class DfOrderBuilder extends LitElement {
  static properties = {
    // JSON arrays of token strings.
    selected: { type: String },
    pool: { type: String },
    hasresult: { type: Boolean }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.selected = "";
    this.pool = "";
    this.hasresult = false;
  }

  #list(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  render() {
    const selected = this.#list(this.selected);
    const pool = this.#list(this.pool);

    return html`
      <div class="token-area">
        ${selected.length
          ? selected.map((token, index) => html`
              <button class="token" data-action="order-undo-at" data-index=${index} ?disabled=${this.hasresult}>${token}</button>
            `)
          : html`<span class="token-empty">${LABELS.empty}</span>`}
      </div>
      <div class="token-bank">
        ${pool.map((token, index) => html`
          <button class="token" data-action="order-pick" data-index=${index} ?disabled=${this.hasresult}>${token}</button>
        `)}
      </div>
      <div class="answer-actions">
        <button class="ghost-btn" data-action="order-reset" ?disabled=${this.hasresult || !selected.length}>${LABELS.reset}</button>
        <button class="primary-btn" data-action="order-submit" ?disabled=${this.hasresult || pool.length > 0}>${LABELS.check}</button>
      </div>
      ${this.hasresult
        ? nothing
        : html`<button class="reveal-btn" data-action="reveal-answer">${LABELS.reveal}</button>`}
    `;
  }
}

if (!customElements.get("df-order-builder")) {
  customElements.define("df-order-builder", DfOrderBuilder);
}
