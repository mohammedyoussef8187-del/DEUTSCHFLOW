/*
 * <df-answer-feedback> — the post-answer feedback panel.
 *
 * Light DOM: it contains the "report bad data" control and hosts <df-rating-row>, both
 * of which are dispatched through the app's delegated document click listener.
 *
 * Presentation only. It reports what the evaluator already decided; it does not
 * evaluate, score, or schedule anything.
 */

import { LitElement, html, nothing } from "../../../vendor/lit.js";
import "./df-rating-row.js";

const LABELS = Object.freeze({
  expected: "الإجابة الصحيحة",
  yours: "إجابتك",
  flag: "الإبلاغ عن ترجمة أو بيانات غير صحيحة",
  rate: "قيّم صعوبة التذكر لتحديد الموعد التالي:",
  willRetry: "ستسجل الإجابة كخطأ وستعاد البطاقة داخل الجلسة."
});

export class DfAnswerFeedback extends LitElement {
  static properties = {
    correct: { type: Boolean },
    note: { type: String },
    correctanswer: { type: String },
    useranswer: { type: String },
    lang: { type: String },
    suggested: { type: Number }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.correct = false;
    this.note = "";
    this.correctanswer = "";
    this.useranswer = "";
    this.lang = "de";
    this.suggested = 0;
  }

  render() {
    return html`
      <section class="feedback ${this.correct ? "success" : "error"}">
        <h3>${this.correct ? "✓" : "✗"} ${this.note}</h3>
        ${this.correct
          ? nothing
          : html`<div class="feedback-row">
              <span>${LABELS.expected}</span>
              <strong lang=${this.lang}>${this.correctanswer}</strong>
            </div>`}
        ${this.useranswer
          ? html`<div class="feedback-row">
              <span>${LABELS.yours}</span>
              <span lang=${this.lang}>${this.useranswer}</span>
            </div>`
          : nothing}
        <button class="ghost-btn block feedback-flag" data-action="flag-current-word">${LABELS.flag}</button>
        <div class="feedback-hint">${this.correct ? LABELS.rate : LABELS.willRetry}</div>
        <df-rating-row ?correct=${this.correct} suggested=${this.suggested}></df-rating-row>
      </section>
    `;
  }
}

if (!customElements.get("df-answer-feedback")) {
  customElements.define("df-answer-feedback", DfAnswerFeedback);
}
