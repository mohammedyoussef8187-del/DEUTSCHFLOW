/*
 * <df-study-progress> — first slice of the study screen migrated to Lit.
 *
 * Deliberately the READ-ONLY part: the session progress bar, pending-retry badge, and
 * the correct/wrong/hint tally. It renders no controls, so the answer, reveal, hint, and
 * rating interactions — the parts that actually change SRS state — remain untouched
 * vanilla markup, protected by the study interaction tests.
 *
 * Driven entirely by string attributes so the existing string-rendered study view can
 * emit it with no hydration step.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  retries: "إعادات",
  correct: "صحيح",
  wrong: "خطأ",
  hints: "تلميحات",
  progress: "تقدم الجلسة"
});

export class DfStudyProgress extends LitElement {
  static properties = {
    percent: { type: Number },
    completed: { type: Number },
    planned: { type: Number },
    retries: { type: Number },
    correct: { type: Number },
    wrong: { type: Number },
    hints: { type: Number }
  };

  static styles = css`
    :host { display: block; }

    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block: 10px;
    }
    .progress {
      flex: 1;
      block-size: 8px;
      border-radius: 999px;
      background: var(--border, #e2e8f0);
      overflow: hidden;
    }
    .progress span {
      display: block;
      block-size: 100%;
      border-radius: 999px;
      background: var(--primary, #0f766e);
      transition: inline-size 220ms ease;
    }
    .retry-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgb(217 119 6 / 14%);
      color: #b45309;
      white-space: nowrap;
    }

    .score-strip {
      display: flex;
      gap: 14px;
      font-size: 13px;
      font-weight: 700;
      color: var(--muted, #64748b);
      flex-wrap: wrap;
    }
    .ok { color: #15803d; }
    .no { color: #b91c1c; }

    @media (max-width: 430px) {
      .score-strip { gap: 10px; font-size: 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .progress span { transition: none; }
    }
  `;

  constructor() {
    super();
    this.percent = 0;
    this.completed = 0;
    this.planned = 0;
    this.retries = 0;
    this.correct = 0;
    this.wrong = 0;
    this.hints = 0;
  }

  render() {
    const percent = Math.max(0, Math.min(100, Number(this.percent) || 0));
    return html`
      <div class="progress-wrap">
        <div
          class="progress"
          role="progressbar"
          aria-label=${LABELS.progress}
          aria-valuenow=${this.completed}
          aria-valuemin="0"
          aria-valuemax=${this.planned}
        >
          <span style="inline-size:${percent}%"></span>
        </div>
        ${Number(this.retries) > 0
          ? html`<span class="retry-badge">${LABELS.retries} ${this.retries}</span>`
          : nothing}
      </div>
      <div class="score-strip">
        <span class="ok">${LABELS.correct} ${this.correct}</span>
        <span class="no">${LABELS.wrong} ${this.wrong}</span>
        <span class="hint">${LABELS.hints} ${this.hints}</span>
      </div>
    `;
  }
}

if (!customElements.get("df-study-progress")) {
  customElements.define("df-study-progress", DfStudyProgress);
}
