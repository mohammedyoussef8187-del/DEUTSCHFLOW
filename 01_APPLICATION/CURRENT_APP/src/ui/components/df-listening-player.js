/*
 * <df-listening-player> — read-only presentation of one listening activity.
 *
 * Minimum UI to prove the Feature G architecture end to end: listening service
 * assembles → component renders audio state, transcript, support and segments. It is
 * not the finished listening UI.
 *
 * Offline-first is visible here, not assumed: the <audio> element is rendered ONLY for
 * a file that is actually on the device. When it is not, the component says so and why,
 * and still renders the transcript and translations — losing the file must not lose the
 * teaching. It never constructs a network URL to fall back on.
 *
 * It grades nothing and schedules nothing. Choosing a segment seeks the local audio and
 * dispatches `segment-select`; the host decides what else that means.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  untitled: "بدون عنوان",
  transcript: "النص",
  english: "English",
  arabic: "العربية",
  untranslated: "لم تُترجم بعد",
  segments: "المقاطع",
  offline: "متاح دون اتصال",
  unavailable: "الملف الصوتي غير متاح على الجهاز",
  empty: "لا يوجد نشاط استماع"
});

const MISSING_REASON = Object.freeze({
  "no-audio": "لا يوجد ملف صوتي مرتبط",
  "not-on-device": "الملف موجود في المصدر وليس على الجهاز",
  "remote-only": "الملف متاح عبر الإنترنت فقط",
  "no-local-path": "لا يوجد مسار محلي للملف"
});

function timecode(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export class DfListeningPlayer extends LitElement {
  static properties = {
    // Assembled activity from the listening service.
    activity: { attribute: false },
    // Segment the host considers current, if any.
    currentsegment: { type: String }
  };

  static styles = css`
    :host { display: block; }
    .activity {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .title { font-size: clamp(18px, 2.4vw, 22px); font-weight: 800; }
    .de { direction: ltr; unicode-bidi: isolate; }
    .en { direction: ltr; unicode-bidi: isolate; }
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
    .transcript { margin-block-start: 6px; line-height: 1.6; }
    .support { margin-block-start: 12px; display: grid; gap: 8px; }
    .line { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: baseline; }
    .lang { font-size: 12px; font-weight: 700; color: var(--muted, #64748b); }
    .missing { color: var(--muted, #64748b); font-style: italic; }
    .segments { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .segment {
      display: flex; gap: 10px; align-items: baseline; width: 100%;
      padding: 10px 12px; min-height: 44px; text-align: start; box-sizing: border-box;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit; font: inherit; cursor: pointer;
    }
    .segment[aria-current="true"] { border-color: var(--accent, #2563eb); border-width: 2px; }
    .time { font-size: 12px; color: var(--muted, #64748b); font-variant-numeric: tabular-nums; }
    .seg-body { flex: 1; }
    .seg-support { margin-block-start: 2px; font-size: 12px; color: var(--muted, #64748b); }
    .empty { color: var(--muted, #64748b); font-style: italic; }
    @media (min-width: 900px) { .activity { padding: 22px; } }
  `;

  constructor() {
    super();
    this.activity = null;
    this.currentsegment = "";
  }

  #select(segment) {
    // Seek the local file if one is actually playing; never create a URL to fetch.
    const audio = this.renderRoot?.querySelector("audio");
    if (audio) audio.currentTime = segment.startMs / 1000;

    this.dispatchEvent(new CustomEvent("segment-select", {
      detail: { activityUuid: this.activity?.uuid ?? null, segmentUuid: segment.uuid, startMs: segment.startMs },
      bubbles: true,
      composed: true
    }));
  }

  #supportLine(label, value, isEnglish) {
    return html`
      <div class="line">
        <span class="lang">${label}</span>
        ${value
          ? html`<span class=${isEnglish ? "en" : ""}>${value}</span>`
          : html`<span class="missing">${LABELS.untranslated}</span>`}
      </div>
    `;
  }

  #audio() {
    const audio = this.activity?.audio;
    if (audio?.playableOffline) {
      return html`
        <audio
          controls
          preload="metadata"
          src=${audio.localPath}
          data-availability=${audio.availability}
        ></audio>
      `;
    }
    return html`
      <p class="unavailable" data-reason=${audio?.missingReason ?? "no-audio"}>
        ${LABELS.unavailable} — ${MISSING_REASON[audio?.missingReason] ?? MISSING_REASON["no-audio"]}
      </p>
    `;
  }

  #segment(segment) {
    const isCurrent = this.currentsegment === segment.uuid;
    return html`
      <li>
        <button
          class="segment"
          type="button"
          data-segment=${segment.uuid}
          data-start=${segment.startMs}
          aria-current=${String(isCurrent)}
          @click=${() => this.#select(segment)}
        >
          <span class="time">${timecode(segment.startMs)}</span>
          <span class="seg-body">
            ${segment.speaker?.label ? html`<span class="pill">${segment.speaker.label}</span> ` : nothing}
            <span class="de" lang="de">${segment.german ?? ""}</span>
            ${segment.support?.en || segment.support?.ar
              ? html`<div class="seg-support">
                  ${segment.support.en ? html`<span class="en">${segment.support.en}</span>` : nothing}
                  ${segment.support.en && segment.support.ar ? " · " : nothing}
                  ${segment.support.ar ?? nothing}
                </div>`
              : nothing}
          </span>
        </button>
      </li>
    `;
  }

  render() {
    const activity = this.activity;
    if (!activity) return html`<p class="empty">${LABELS.empty}</p>`;

    const title = activity.title?.de || activity.title?.en || activity.slug || LABELS.untitled;

    return html`
      <article class="activity">
        <h2 class="title de" lang="de">${title}</h2>
        <div class="meta">
          ${activity.level ? html`<span class="pill">${activity.level}</span>` : nothing}
          <span class="pill">${activity.activityType}</span>
          ${activity.audio?.durationMs
            ? html`<span class="pill">${timecode(activity.audio.durationMs)}</span>`
            : nothing}
          ${activity.studyable ? html`<span class="pill" data-offline="true">${LABELS.offline}</span>` : nothing}
        </div>

        ${this.#audio()}

        ${activity.transcript
          ? html`<div class="block">
              <div class="sub">${LABELS.transcript}</div>
              <p class="transcript de" lang="de">${activity.transcript}</p>
            </div>`
          : nothing}

        <div class="support">
          ${this.#supportLine(LABELS.english, activity.support?.en, true)}
          ${this.#supportLine(LABELS.arabic, activity.support?.ar, false)}
        </div>

        ${activity.segments?.length
          ? html`<div class="block">
              <div class="sub">${LABELS.segments}</div>
              <ul class="segments">${activity.segments.map(segment => this.#segment(segment))}</ul>
            </div>`
          : nothing}
      </article>
    `;
  }
}

if (!customElements.get("df-listening-player")) {
  customElements.define("df-listening-player", DfListeningPlayer);
}
