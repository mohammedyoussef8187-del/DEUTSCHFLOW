/*
 * <df-choice-list> — multiple-choice answer buttons.
 *
 * Light DOM, so the delegated document click listener resolves data-action and
 * data-choice.
 *
 * Presentation only: it does not decide correctness. The application passes the correct
 * id and the learner's last pick once a result exists, and this component only applies
 * the resulting styling — correct, wrong, or dimmed — exactly as the previous markup did.
 */

import { LitElement, html } from "../../../vendor/lit.js";

export class DfChoiceList extends LitElement {
  static properties = {
    // JSON array of { id, label }.
    choices: { type: String },
    // Set only once an answer has been evaluated.
    revealed: { type: Boolean },
    correctid: { type: String },
    chosenid: { type: String }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.choices = "";
    this.revealed = false;
    this.correctid = "";
    this.chosenid = "";
  }

  #choices() {
    if (!this.choices) return [];
    try {
      const parsed = JSON.parse(this.choices);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  #classFor(id) {
    if (!this.revealed) return "answer-btn";
    if (String(id) === String(this.correctid)) return "answer-btn correct";
    if (String(id) === String(this.chosenid)) return "answer-btn wrong";
    return "answer-btn dim";
  }

  render() {
    return html`
      <div class="choices">
        ${this.#choices().map(choice => html`
          <button
            class=${this.#classFor(choice.id)}
            data-action="choose-answer"
            data-choice=${choice.id}
            ?disabled=${this.revealed}
          ><span lang="de">${choice.label}</span></button>
        `)}
      </div>
    `;
  }
}

if (!customElements.get("df-choice-list")) {
  customElements.define("df-choice-list", DfChoiceList);
}
