// @vitest-environment happy-dom
/*
 * Minimal proof that the Feature C architecture works end to end:
 * canonical rows -> sentence service -> component render.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import "../../01_APPLICATION/CURRENT_APP/src/ui/components/df-sentence-card.js";
import { buildSentences } from "../../01_APPLICATION/CURRENT_APP/src/services/sentence-service.js";

const SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), "01_APPLICATION/CURRENT_APP/src/ui/components/df-sentence-card.js"), "utf8"
);
const NOW = 1775000000000;
const meta = { contentStatus: "draft", contentVersion: 1, createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };
const linkMeta = { createdAt: NOW, updatedAt: NOW, revision: 1, deleted: 0 };

function assembled({ withArabic = true } = {}) {
  const texts = [
    { uuid: "t1", sentenceUuid: "s-1", language: "en", kind: "translation", text: "The house is big.", ...meta }
  ];
  if (withArabic) {
    texts.push({ uuid: "t2", sentenceUuid: "s-1", language: "ar", kind: "translation", text: "البيت كبير.", ...meta });
  }
  return buildSentences({
    sentences: [{ uuid: "s-1", german: "Das Haus ist groß.", level: "A1", register: "neutral", ordering: 1, ...meta }],
    sentenceTexts: texts,
    sentenceTags: [{ uuid: "tg1", sentenceUuid: "s-1", tag: "wohnen", ...linkMeta }],
    sentenceVocabulary: [{ uuid: "sv1", sentenceUuid: "s-1", vocabUuid: "v-haus", role: "target", ...linkMeta }],
    sentenceGrammar: [{ uuid: "sg1", sentenceUuid: "s-1", ruleUuid: "r-adj", ...linkMeta }],
    vocabularyItems: [{ uuid: "v-haus", german: "das Haus" }],
    grammarRules: [{ uuid: "r-adj", slug: "predicative-adjectives", topicUuid: "t-adj" }]
  })[0];
}

async function mount(sentence) {
  const el = document.createElement("df-sentence-card");
  el.sentence = sentence;
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const sr = (el, s) => el.shadowRoot.querySelector(s);

afterEach(() => { document.body.innerHTML = ""; });

describe("sentence card", () => {
  it("renders the German sentence with the correct language and direction", async () => {
    const el = await mount(assembled());
    expect(sr(el, ".german").textContent.trim()).toBe("Das Haus ist groß.");
    expect(sr(el, ".german").getAttribute("lang")).toBe("de");
    expect(SOURCE).toContain("unicode-bidi: isolate");
  });

  it("shows level, register and context tags", async () => {
    const el = await mount(assembled());
    const pills = [...el.shadowRoot.querySelectorAll(".pill")].map(p => p.textContent.trim());
    expect(pills).toContain("A1");
    expect(pills).toContain("neutral");
    expect(pills).toContain("wohnen");
  });

  it("renders English and Arabic as peers in the same shape", async () => {
    const el = await mount(assembled());
    const lines = [...el.shadowRoot.querySelectorAll(".support .line")];
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toContain("The house is big.");
    expect(lines[1].textContent).toContain("البيت كبير.");
  });

  it("says a translation is missing rather than hiding the language", async () => {
    const el = await mount(assembled({ withArabic: false }));
    const lines = [...el.shadowRoot.querySelectorAll(".support .line")];
    expect(lines).toHaveLength(2);                       // Arabic row still present
    expect(sr(el, ".missing").textContent.trim()).toBe("لم تُترجم بعد");
  });

  it("shows linked vocabulary and grammar", async () => {
    const el = await mount(assembled());
    const links = sr(el, ".links").textContent;
    expect(links).toContain("das Haus");
    expect(links).toContain("predicative-adjectives");
  });

  it("renders nothing without a sentence", async () => {
    const el = await mount(null);
    expect(el.shadowRoot.querySelector(".card")).toBeNull();
  });

  it("is read-only and never reaches storage or scoring", () => {
    const imports = [...SOURCE.matchAll(/^import\s+(?:.*?from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
    expect(imports).toEqual(["../../../vendor/lit.js"]);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    for (const forbidden of ["indexeddb", "sqlite", "repositor", "schedulecard", "validate", "scoreable"]) {
      expect(code, `must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
