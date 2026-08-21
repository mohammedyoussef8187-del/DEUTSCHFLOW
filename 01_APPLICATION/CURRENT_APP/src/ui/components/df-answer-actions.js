/*
 * <df-answer-actions> — the hint, check, and reveal controls under the answer field.
 *
 * Light DOM, for the same reason as <df-answer-input>: the application dispatches every
 * control through one delegated document click listener that resolves
 * `e.target.closest("[data-action]")`. Inside a shadow root the event would retarget to
 * the host and the inner button's data-action would be invisible, so hint, check, and
 * reveal would all silently stop working.
 *
 * The component owns the conditional markup only — which buttons appear and when they
 * are disabled. It performs no hinting, no revealing, and no scoring; those stay in the
 * existing handlers, and the rules for when a control is available are unchanged:
 *   - hint is disabled once a result is showing, or once a hint was already used
 *   - check is disabled once a result is showing
 *   - reveal is hidden entirely once a result is showing
 */

import { LitElement, html, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  hint: "تلميح محدود",
  check: "تحقق",
  reveal: "لا أعرفها — أظهر الإجابة"
});

export class DfAnswerActions extends LitElement {
  static properties = {
    // A result is on screen, so the answer is locked in.
    hasresult: { type: Boolean },
    // The learner already spent their hint for this question.
    usedhint: { type: Boolean }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.hasresult = false;
    this.usedhint = false;
  }

  render() {
    return html`
      <div class="answer-actions">
        <button
          class="ghost-btn"
          data-action="hint"
          ?disabled=${this.hasresult || this.usedhint}
        >${LABELS.hint}</button>
        <button
          class="primary-btn"
          data-action="submit-writing"
          ?disabled=${this.hasresult}
        >${LABELS.check}</button>
      </div>
      ${this.hasresult
        ? nothing
        : html`<button class="reveal-btn" data-action="reveal-answer">${LABELS.reveal}</button>`}
    `;
  }
}

if (!customElements.get("df-answer-actions")) {
  customElements.define("df-answer-actions", DfAnswerActions);
}
