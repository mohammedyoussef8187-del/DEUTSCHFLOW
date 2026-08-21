/*
 * <df-pronunciation-card> — read-only presentation of one pronunciation practice item.
 *
 * Minimum UI to prove the Feature H architecture end to end: pronunciation service
 * assembles → component renders the model, the authored realization, minimal pairs and
 * the learner's own rating controls. It is not the finished pronunciation UI.
 *
 * The self-assessment rule is visible, not implied: for a production item the card says
 * outright that the app does not judge how you said it, and the only controls are the
 * learner's own rating. If a recognizer supplied a score it is shown as advice, labelled
 * with its source, never as a verdict and never in place of the learner's rating.
 *
 * Offline behaviour follows Feature G exactly: an <audio> element appears only for a
 * file that is on the device, and no URL is ever constructed as a fallback.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  model: "النموذج",
  unavailable: "النموذج الصوتي غير متاح على الجهاز",
  offline: "متاح دون اتصال",
  varieties: "نطق مقبول",
  pairs: "أزواج صغرى",
  selfRate: "قيّم نطقك بنفسك",
  notJudged: "التطبيق لا يحكم على نطقك آلياً — أنت من يقيّم",
  advisory: "تقدير استرشادي",
  advice: "إرشاد",
  empty: "لا يوجد تمرين نطق",
  discriminate: "اختر ما سمعته"
});

const MISSING_REASON = Object.freeze({
  "no-audio": "لا يوجد ملف صوتي مرتبط",
  "not-on-device": "الملف موجود في المصدر وليس على الجهاز",
  "remote-only": "الملف متاح عبر الإنترنت فقط",
  "no-local-path": "لا يوجد مسار محلي للملف"
});

const RATINGS = Object.freeze([
  { value: 1, label: "أعِد" },
  { value: 2, label: "صعب" },
  { value: 3, label: "جيد" },
  { value: 4, label: "سهل" }
]);

export class DfPronunciationCard extends LitElement {
  static properties = {
    // Assembled item from the pronunciation service.
    item: { attribute: false },
    // summarizeAttempts() output for this learner and item, optional.
    history: { attribute: false }
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
    .word { font-size: clamp(20px, 2.8vw, 26px); font-weight: 800; direction: ltr; unicode-bidi: isolate; }
    .ipa {
      margin-block-start: 4px; font-size: 16px; color: var(--muted, #64748b);
      direction: ltr; unicode-bidi: isolate;
    }
    .syllables { margin-block-start: 6px; direction: ltr; unicode-bidi: isolate; }
    .syl { padding: 2px 4px; }
    .syl[data-stressed="true"] { font-weight: 800; text-decoration: underline; }
    .meta { display: flex; gap: 7px; flex-wrap: wrap; margin-block-start: 10px; }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    audio { display: block; width: 100%; margin-block-start: 14px; }
    .unavailable {
      margin-block-start: 14px; padding: 12px 14px; border-radius: 12px;
      border: 1px dashed var(--border, #e2e8f0); color: var(--muted, #64748b); font-size: 13px;
    }
    .block { margin-block-start: 16px; }
    .sub { font-size: 14px; font-weight: 700; }
    .note { margin-block-start: 4px; font-size: 12px; color: var(--muted, #64748b); }
    .variants { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .variant { display: flex; gap: 10px; align-items: baseline; }
    .en { direction: ltr; unicode-bidi: isolate; }
    .pairs { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .pair { display: flex; gap: 12px; align-items: baseline; direction: ltr; unicode-bidi: isolate; }
    .ratings { display: flex; gap: 8px; flex-wrap: wrap; margin-block-start: 8px; }
    .rating {
      flex: 1 1 auto; min-width: 72px; min-height: 44px; padding: 10px 12px;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit; font: inherit; font-weight: 700;
      cursor: pointer;
    }
    .rating[aria-pressed="true"] { border-color: var(--accent, #2563eb); border-width: 2px; }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .card { padding: 22px; } }
  `;

  constructor() {
    super();
    this.item = null;
    this.history = null;
  }

  #rate(value) {
    this.dispatchEvent(new CustomEvent("self-rate", {
      detail: { itemUuid: this.item?.uuid ?? null, selfRating: value },
      bubbles: true,
      composed: true
    }));
  }

  #audio() {
    const audio = this.item?.modelAudio;
    if (audio?.playableOffline) {
      return html`<audio controls preload="metadata" src=${audio.localPath}
                    data-availability=${audio.availability}></audio>`;
    }
    return html`
      <p class="unavailable" data-reason=${audio?.missingReason ?? "no-audio"}>
        ${LABELS.unavailable} — ${MISSING_REASON[audio?.missingReason] ?? MISSING_REASON["no-audio"]}
      </p>
    `;
  }

  #variant(variant) {
    return html`
      <li class="variant" data-variety=${variant.variety ?? ""}>
        <span class="pill">${variant.variety ?? ""}</span>
        <span class="en">${variant.ipa ?? ""}</span>
        ${variant.isPrimary ? html`<span class="pill" data-primary="true">★</span>` : nothing}
      </li>
    `;
  }

  #ratings() {
    const chosen = this.history?.lastSelfRating ?? null;
    return html`
      <div class="block" data-self-assessed="true">
        <div class="sub">${LABELS.selfRate}</div>
        <div class="note">${LABELS.notJudged}</div>
        <div class="ratings">
          ${RATINGS.map(rating => html`
            <button
              class="rating"
              type="button"
              data-rating=${rating.value}
              aria-pressed=${String(chosen === rating.value)}
              @click=${() => this.#rate(rating.value)}
            >${rating.label}</button>
          `)}
        </div>
        ${this.history?.advisoryScores?.length
          ? html`<div class="note" data-advisory="true">
              ${LABELS.advisory}: ${this.history.advisoryScores
                .map(entry => `${Math.round(entry.score * 100)}% (${entry.source ?? "?"})`)
                .join(" · ")}
            </div>`
          : nothing}
      </div>
    `;
  }

  render() {
    const item = this.item;
    if (!item) return html`<p class="empty">${LABELS.empty}</p>`;

    const primary = item.primaryVariant;
    const heading = item.pairs?.length && item.selfAssessed === false
      ? LABELS.discriminate
      : item.slug;

    return html`
      <article class="card">
        <div class="word" lang="de">${item.pairs?.[0]?.a.text ?? heading}</div>
        ${primary?.ipa ? html`<div class="ipa">[${primary.ipa}]</div>` : nothing}
        ${primary?.syllables?.length
          ? html`<div class="syllables">
              ${primary.syllables.map(syllable => html`
                <span class="syl" data-stressed=${String(syllable.stressed)}>${syllable.text}</span>
              `)}
            </div>`
          : nothing}

        <div class="meta">
          ${item.level ? html`<span class="pill">${item.level}</span>` : nothing}
          <span class="pill" data-mode=${item.practiceMode}>${item.practiceMode}</span>
          ${item.feature?.ipa ? html`<span class="pill en">${item.feature.ipa}</span>` : nothing}
          ${item.hasModelAudio ? html`<span class="pill" data-offline="true">${LABELS.offline}</span>` : nothing}
        </div>

        ${this.#audio()}

        ${item.feature?.advice?.ar || item.feature?.advice?.en
          ? html`<div class="block">
              <div class="sub">${LABELS.advice}</div>
              <div class="note">${item.feature.advice.ar ?? item.feature.advice.en}</div>
            </div>`
          : nothing}

        ${item.variants?.length
          ? html`<div class="block">
              <div class="sub">${LABELS.varieties}</div>
              <ul class="variants">${item.variants.map(variant => this.#variant(variant))}</ul>
            </div>`
          : nothing}

        ${item.pairs?.length
          ? html`<div class="block">
              <div class="sub">${LABELS.pairs}</div>
              <ul class="pairs">
                ${item.pairs.map(pair => html`
                  <li class="pair" data-pair=${pair.uuid} lang="de">
                    <span>${pair.a.text}</span><span>·</span><span>${pair.b.text}</span>
                  </li>
                `)}
              </ul>
            </div>`
          : nothing}

        ${item.selfAssessed ? this.#ratings() : nothing}
      </article>
    `;
  }
}

if (!customElements.get("df-pronunciation-card")) {
  customElements.define("df-pronunciation-card", DfPronunciationCard);
}
