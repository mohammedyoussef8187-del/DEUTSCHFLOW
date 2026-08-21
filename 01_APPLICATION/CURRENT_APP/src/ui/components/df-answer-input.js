/*
 * <df-answer-input> — the study answer field, first INTERACTIVE control migrated.
 *
 * Renders into the LIGHT DOM on purpose. The surrounding application still relies on the
 * textarea being a document-level element:
 *   - afterRender() focuses it via document.getElementById("answer-input")
 *   - the submit handler reads its value the same way
 *   - the global Enter-key handler checks document.activeElement?.id === "answer-input"
 * A shadow root would hide the field from all three and silently break typing, focus,
 * and Enter-to-submit. Light DOM keeps every one of those integration points working
 * byte-identically, and lets the existing .answer-input styles continue to apply.
 *
 * The component owns markup only. It does not read, evaluate, score, or store answers;
 * submission stays with the existing data-action handler.
 */

import { LitElement, html } from "../../../vendor/lit.js";

export class DfAnswerInput extends LitElement {
  static properties = {
    lang: { type: String },
    placeholder: { type: String },
    arabic: { type: Boolean },
    disabled: { type: Boolean }
  };

  // Light DOM: no shadow root, so global styles and document queries keep working.
  createRenderRoot() { return this; }

  constructor() {
    super();
    this.lang = "de";
    this.placeholder = "";
    this.arabic = false;
    this.disabled = false;
  }

  render() {
    return html`
      <textarea
        id="answer-input"
        class="answer-input ${this.arabic ? "arabic-answer" : ""}"
        lang=${this.lang}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
      ></textarea>
    `;
  }
}

if (!customElements.get("df-answer-input")) {
  customElements.define("df-answer-input", DfAnswerInput);
}
