/*
 * <df-reminder-settings> — the minimum UI needed to configure reminders.
 *
 * It renders settings and a plan; it decides nothing. Every control dispatches
 * `reminder-change` with the field that changed, and the host applies it through the
 * reminder service, so what is displayed and what the OS will actually do cannot drift
 * apart in this component.
 *
 * Two things are shown that a settings screen usually hides:
 *   - the real permission state, because a reminder the OS will never display is worth
 *     saying out loud rather than showing a switch that quietly does nothing;
 *   - WHY a reminder will not fire, taken from the plan's own reason, so "silence" is
 *     explained instead of looking like a bug.
 */

import { LitElement, html, css, nothing } from "../../../vendor/lit.js";

const LABELS = Object.freeze({
  heading: "التذكيرات",
  enable: "تفعيل التذكيرات",
  daily: "تذكير الدراسة اليومي",
  dueReview: "تذكير المراجعات المستحقة",
  time: "الوقت",
  minimum: "الحد الأدنى للبطاقات",
  skipIfStudied: "تخطَّ التذكير إذا درست اليوم",
  permission: "إذن الإشعارات",
  requestPermission: "اطلب الإذن",
  next: "التذكير القادم",
  none: "لن يُرسل تذكير",
  offline: "تعمل التذكيرات دون إنترنت ودون حساب"
});

const PERMISSION_LABEL = Object.freeze({
  granted: "ممنوح",
  provisional: "مبدئي",
  denied: "مرفوض — غيّره من إعدادات النظام",
  unknown: "لم يُطلب بعد",
  unsupported: "غير متاح على هذه المنصة"
});

const REASON_LABEL = Object.freeze({
  "reminders-disabled": "التذكيرات موقوفة",
  "kind-disabled": "هذا التذكير موقوف",
  "already-studied-today": "درست اليوم بالفعل",
  "below-due-minimum": "عدد البطاقات أقل من الحد الأدنى",
  "too-soon-after-last": "التذكير السابق قريب جداً",
  "invalid-time": "الوقت غير صالح",
  "permission-denied": "الإذن مرفوض",
  "permission-unknown": "لم يُطلب الإذن بعد",
  "permission-unsupported": "غير متاح على هذه المنصة",
  "permission-provisional": "إذن مبدئي"
});

const KIND_LABEL = Object.freeze({
  daily_study: LABELS.daily,
  due_review: LABELS.dueReview
});

function clockOf(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const pad = value => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export class DfReminderSettings extends LitElement {
  static properties = {
    // Normalized settings from the reminder service.
    settings: { attribute: false },
    // planReminders() output, for the preview and the reasons.
    plan: { attribute: false },
    // What the OS last reported.
    permission: { type: String }
  };

  static styles = css`
    :host { display: block; }
    .panel {
      padding: 18px;
      border-radius: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: var(--shadow, 0 1px 2px rgb(15 23 42 / 6%));
      box-sizing: border-box;
    }
    .heading { font-size: clamp(17px, 2.2vw, 20px); font-weight: 800; }
    .note { margin-block-start: 4px; font-size: 12px; color: var(--muted, #64748b); }
    .row {
      display: flex; gap: 12px; align-items: center; justify-content: space-between;
      padding: 12px 0; min-height: 44px;
      border-block-start: 1px solid var(--border, #e2e8f0);
    }
    .row:first-of-type { border-block-start: none; }
    .row-label { flex: 1; font-weight: 700; }
    .row-sub { font-weight: 400; font-size: 12px; color: var(--muted, #64748b); }
    input[type="time"], input[type="number"] {
      min-height: 44px; padding: 8px 10px; font: inherit;
      border-radius: 10px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit;
    }
    input[type="number"] { width: 88px; }
    input[type="checkbox"] { width: 24px; height: 24px; }
    button {
      min-height: 44px; padding: 10px 14px; font: inherit; font-weight: 700;
      border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      background: var(--surface, #fff); color: inherit; cursor: pointer;
    }
    .pill {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
      border: 1px solid var(--border, #e2e8f0); color: var(--muted, #64748b);
    }
    .plan { margin-block-start: 16px; display: grid; gap: 6px; }
    .plan-row { display: flex; gap: 10px; align-items: baseline; font-size: 13px; }
    .plan-kind { flex: 1; }
    .time { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
    @media (min-width: 900px) { .panel { padding: 22px; } }
  `;

  constructor() {
    super();
    this.settings = null;
    this.plan = null;
    this.permission = "unknown";
  }

  #change(field, value) {
    this.dispatchEvent(new CustomEvent("reminder-change", {
      detail: { field, value },
      bubbles: true,
      composed: true
    }));
  }

  #requestPermission() {
    this.dispatchEvent(new CustomEvent("permission-request", { bubbles: true, composed: true }));
  }

  #toggle(field, label, sub) {
    const settings = this.settings ?? {};
    return html`
      <label class="row">
        <span class="row-label">
          ${label}
          ${sub ? html`<div class="row-sub">${sub}</div>` : nothing}
        </span>
        <input
          type="checkbox"
          data-field=${field}
          .checked=${Boolean(settings[field])}
          @change=${e => this.#change(field, e.target.checked)}
        />
      </label>
    `;
  }

  #timeField(field, label) {
    const settings = this.settings ?? {};
    return html`
      <label class="row">
        <span class="row-label">${label}</span>
        <input
          type="time"
          data-field=${field}
          .value=${settings[field] ?? ""}
          @change=${e => this.#change(field, e.target.value)}
        />
      </label>
    `;
  }

  #planRow(entry) {
    return html`
      <div class="plan-row" data-kind=${entry.kind} data-scheduled=${String(entry.scheduled)}>
        <span class="plan-kind">${KIND_LABEL[entry.kind] ?? entry.kind}</span>
        ${entry.scheduled
          ? html`<span class="time">${clockOf(entry.at)}</span>`
          : html`<span class="pill" data-reason=${entry.reason}>
              ${REASON_LABEL[entry.reason] ?? LABELS.none}
            </span>`}
      </div>
    `;
  }

  render() {
    const settings = this.settings ?? {};
    const permission = this.permission ?? "unknown";
    const canPrompt = permission === "unknown";

    return html`
      <section class="panel">
        <h2 class="heading">${LABELS.heading}</h2>
        <div class="note">${LABELS.offline}</div>

        <div class="row">
          <span class="row-label">${LABELS.permission}</span>
          <span class="pill" data-permission=${permission}>
            ${PERMISSION_LABEL[permission] ?? permission}
          </span>
          ${canPrompt
            ? html`<button type="button" data-action="request-permission"
                     @click=${() => this.#requestPermission()}>${LABELS.requestPermission}</button>`
            : nothing}
        </div>

        ${this.#toggle("enabled", LABELS.enable)}

        ${settings.enabled
          ? html`
            ${this.#toggle("dailyEnabled", LABELS.daily)}
            ${settings.dailyEnabled ? this.#timeField("dailyTime", LABELS.time) : nothing}
            ${this.#toggle("skipIfStudiedToday", LABELS.skipIfStudied)}

            ${this.#toggle("dueReviewEnabled", LABELS.dueReview)}
            ${settings.dueReviewEnabled
              ? html`
                ${this.#timeField("dueReviewTime", LABELS.time)}
                <label class="row">
                  <span class="row-label">${LABELS.minimum}</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    data-field="dueReviewMinimum"
                    .value=${String(settings.dueReviewMinimum ?? 5)}
                    @change=${e => this.#change("dueReviewMinimum", Number(e.target.value))}
                  />
                </label>`
              : nothing}`
          : nothing}

        ${this.plan?.entries?.length
          ? html`<div class="plan">
              <div class="row-sub">${LABELS.next}</div>
              ${this.plan.entries.map(entry => this.#planRow(entry))}
            </div>`
          : nothing}
      </section>
    `;
  }
}

if (!customElements.get("df-reminder-settings")) {
  customElements.define("df-reminder-settings", DfReminderSettings);
}
