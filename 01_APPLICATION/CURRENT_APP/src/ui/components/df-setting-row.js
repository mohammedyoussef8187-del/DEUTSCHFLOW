/*
 * <df-setting-row> — one row on the settings page, in either the toggle or number
 * variant. Replaces two near-identical markup helpers.
 *
 * Light DOM: the toggle is dispatched as data-action="toggle-setting" through the
 * delegated document listener, and the number input is matched by the global change
 * handler via `classList.contains("setting-number")` plus `dataset.setting`.
 *
 * Accessibility, added while migrating: the toggle was an empty <button> with no
 * accessible name, so assistive technology announced only its state. Both controls now
 * carry the setting title as their accessible name, and the description is linked via
 * aria-describedby so the explanation is announced too.
 *
 * The component stores nothing. It renders the value it is given; persistence stays in
 * the existing handlers.
 */

import { LitElement, html, nothing } from "../../../vendor/lit.js";

let rowSeq = 0;

export class DfSettingRow extends LitElement {
  static properties = {
    label: { type: String },
    desc: { type: String },
    key: { type: String },
    kind: { type: String },
    value: { type: Number },
    on: { type: Boolean },
    min: { type: Number },
    max: { type: Number }
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.label = "";
    this.desc = "";
    this.key = "";
    this.kind = "toggle";
    this.value = 0;
    this.on = false;
    this.min = 0;
    this.max = 500;
    this._descId = `setting-desc-${++rowSeq}`;
  }

  render() {
    const describedBy = this.desc ? this._descId : undefined;
    return html`
      <div class="setting-row">
        <div>
          <strong>${this.label}</strong>
          ${this.desc ? html`<p id=${this._descId}>${this.desc}</p>` : nothing}
        </div>
        ${this.kind === "number"
          ? html`<input
              class="field-input setting-number"
              data-setting=${this.key}
              type="number"
              inputmode="numeric"
              min=${this.min}
              max=${this.max}
              .value=${String(this.value)}
              aria-label=${this.label}
              aria-describedby=${describedBy ?? nothing}
            >`
          : html`<button
              class="toggle ${this.on ? "on" : ""}"
              data-action="toggle-setting"
              data-setting=${this.key}
              role="switch"
              aria-checked=${this.on ? "true" : "false"}
              aria-label=${this.label}
              aria-describedby=${describedBy ?? nothing}
            ></button>`}
      </div>
    `;
  }
}

if (!customElements.get("df-setting-row")) {
  customElements.define("df-setting-row", DfSettingRow);
}
