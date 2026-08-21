/*
 * <df-rating-row> — the difficulty rating controls, last study control migrated.
 *
 * Light DOM, like the other controls, so the delegated document click listener can
 * resolve `e.target.closest("[data-action]")` and read `dataset.rating`.
 *
 * SCORING POLICY IS NOT TOUCHED. The component decides only which buttons to show and
 * which one to highlight as suggested. What a rating MEANS — how it moves ease,
 * interval, reps, and the due date — stays entirely in the SRS scheduler, and the rating
 * value is handed to the existing finalizeAnswer handler exactly as before:
 *   - a correct answer offers hard (2), good (3), easy (4)
 *   - an incorrect or revealed answer offers only again (1)
 * These are the same values, labels, and class names the previous markup produced.
 */

import { LitElement, html } from "../../../vendor/lit.js";

// value, CSS class name, label — presentation only; the meaning of each lives in the SRS engine.
const CORRECT_RATINGS = Object.freeze([
  [2, "hard", "صعب"],
  [3, "good", "جيد"],
  [4, "easy", "سهل"]
]);
const INCORRECT_RATING = Object.freeze([1, "again", "ثبت الخطأ وأعدها"]);

export class DfRatingRow extends LitElement {
  static properties = {
    correct: { type: Boolean },
    // Which rating the engine suggested, highlighted for the learner.
    suggested: { type: Number }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.correct = false;
    this.suggested = 0;
  }

  #button([value, name, label], suggested) {
    return html`
      <button
        class="rating-btn ${name}${value === suggested ? " suggested" : ""}"
        data-action="rate-answer"
        data-rating=${value}
      >${label}</button>
    `;
  }

  render() {
    // An incorrect or revealed answer is always recorded as "again", and the previous
    // markup highlighted it unconditionally.
    const buttons = this.correct
      ? CORRECT_RATINGS.map(rating => this.#button(rating, Number(this.suggested)))
      : [this.#button(INCORRECT_RATING, 1)];

    return html`<div class="rating-row">${buttons}</div>`;
  }
}

if (!customElements.get("df-rating-row")) {
  customElements.define("df-rating-row", DfRatingRow);
}
