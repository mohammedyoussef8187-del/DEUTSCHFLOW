/*
 * <df-sentence-card> — minimal read-only view of a learning sentence.
 *
 * Deliberately small: it exists to prove the Feature C architecture end to end (service
 * assembles → component renders), not to be the finished sentence UI.
 *
 * It takes an already-assembled sentence object from the sentence service and never
 * queries storage. English and Arabic are rendered as peers, in the same shape, and a
 * missing translation is shown as "not translated yet" rather than hidden — the learner
 * should be able to tell the difference between absent and unavailable.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  english: "English",
  arabic: "العربية",
  untranslated: "لم تُترجم بعد",
  grammar: "القواعد",
  vocabulary: "المفردات"
});

export class DfSentenceCard extends LitElement {
  static properties = {
    // Plain data from the sentence service.
    sentence: { attribute: false }
  };

  static styles = css`
    :host { display: block; }
    .card {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .german {
      font-size: clamp(19px, 2.6vw, 24px);
      font-weight: 800;
      line-height: 1.4;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .meta { display: flex; gap: 7px; flex-wrap: wrap; margin-block-start: 10px; }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    .support { margin-block-start: 14px; display: grid; gap: 8px; }
    .line { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: baseline; }
    .lang { font-size: 12px; font-weight: 700; color: var(--muted, #64748b); }
    .en { direction: ltr; unicode-bidi: isolate; }
    .missing { color: var(--muted, #64748b); font-style: italic; }
    .links { margin-block-start: 12px; font-size: 12px; color: var(--muted, #64748b); }
    @media (min-width: 900px) { .card { padding: 22px; } }
  `;

  constructor() {
    super();
    this.sentence = null;
  }

  #support(label, value, isEnglish) {
    return html`
      <div class="line">
        <span class="lang">${label}</span>
        ${value
          ? html`<span class=${isEnglish ? "en" : ""}>${value}</span>`
          : html`<span class="missing">${LABELS.untranslated}</span>`}
      </div>
    `;
  }

  render() {
    const sentence = this.sentence;
    if (!sentence) return nothing;

    return html`
      <article class="card">
        <div class="german" lang="de">${sentence.german}</div>

        <div class="meta">
          ${sentence.level ? html`<span class="pill">${sentence.level}</span>` : nothing}
          ${sentence.register ? html`<span class="pill">${sentence.register}</span>` : nothing}
          ${sentence.tags.map(tag => html`<span class="pill">${tag}</span>`)}
        </div>

        <div class="support">
          ${this.#support(LABELS.english, sentence.translations?.en, true)}
          ${this.#support(LABELS.arabic, sentence.translations?.ar, false)}
        </div>

        ${sentence.vocabulary?.length || sentence.grammar?.length
          ? html`<div class="links">
              ${sentence.vocabulary?.length
                ? html`<div>${LABELS.vocabulary}: ${sentence.vocabulary.map(v => v.german).filter(Boolean).join(" · ")}</div>`
                : nothing}
              ${sentence.grammar?.length
                ? html`<div>${LABELS.grammar}: ${sentence.grammar.map(g => g.slug).filter(Boolean).join(" · ")}</div>`
                : nothing}
            </div>`
          : nothing}
      </article>
    `;
  }
}

if (!customElements.get("df-sentence-card")) {
  customElements.define("df-sentence-card", DfSentenceCard);
}
