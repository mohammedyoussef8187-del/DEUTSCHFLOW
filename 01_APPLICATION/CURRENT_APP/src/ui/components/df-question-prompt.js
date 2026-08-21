/*
 * <df-question-prompt> — the question card shown above the answer area.
 *
 * Read-only, so it uses shadow DOM like the other presentation components. Hint content
 * is computed by the domain helpers in the application and passed in already resolved:
 * the component never inspects a word, normalizes text, or decides what a hint reveals.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

export class DfQuestionPrompt extends LitElement {
  static properties = {
    label: { type: String },
    prompt: { type: String },
    // "de" renders the Latin-script treatment, anything else the Arabic one.
    promptlang: { type: String },
    pronunciation: { type: String },
    // JSON array of already-resolved hint chips: [{ text }] or [{ text, value }].
    hints: { type: String }
  };

  static styles = css`
    :host { display: block; }

    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-block-size: 210px;
      padding: 28px;
      margin-block-end: 16px;
      border-radius: 20px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }

    .label {
      font-size: 13px;
      color: var(--muted, #64748b);
      margin-block-end: 13px;
    }

    .prompt-de {
      font-size: clamp(29px, 5vw, 42px);
      font-weight: 850;
      line-height: 1.25;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .prompt-ar {
      font-size: clamp(29px, 5vw, 42px);
      font-weight: 700;
      line-height: 1.45;
      direction: rtl;
    }

    .pronunciation {
      font-size: 17px;
      color: var(--muted, #64748b);
      margin-block-start: 10px;
    }

    .hints {
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
      background: rgb(217 119 6 / 14%);
      color: #b45309;
    }
    .pill b { direction: ltr; unicode-bidi: isolate; }

    /* Tablets get a taller card; phones stay compact. */
    @media (min-width: 900px) { .card { min-block-size: 260px; padding: 36px; } }
    @media (max-width: 640px) { .card { min-block-size: 190px; padding: 21px 16px; } }
  `;

  constructor() {
    super();
    this.label = "";
    this.prompt = "";
    this.promptlang = "de";
    this.pronunciation = "";
    this.hints = "";
  }

  #hints() {
    if (!this.hints) return [];
    try {
      const parsed = JSON.parse(this.hints);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  render() {
    const german = this.promptlang === "de";
    const hints = this.#hints();

    return html`
      <section class="card">
        <div class="label">${this.label}</div>
        <div
          class=${german ? "prompt-de" : "prompt-ar"}
          lang=${german ? "de" : "ar"}
        >${this.prompt}</div>
        ${this.pronunciation ? html`<div class="pronunciation">${this.pronunciation}</div>` : nothing}
        ${hints.length
          ? html`<div class="hints">
              ${hints.map(hint => html`<span class="pill">
                ${hint.text}${hint.value ? html` <b lang="de">${hint.value}</b>` : nothing}
              </span>`)}
            </div>`
          : nothing}
      </section>
    `;
  }
}

if (!customElements.get("df-question-prompt")) {
  customElements.define("df-question-prompt", DfQuestionPrompt);
}
