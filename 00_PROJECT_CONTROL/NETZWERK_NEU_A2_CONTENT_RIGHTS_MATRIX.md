# Netzwerk neu A2 — Content Rights Matrix

Research date: 2026-08-22
Scope: official Klett/Allango evidence only; all 12 chapters; no legal conclusion beyond the cited notices.

## Result

No publisher-authored educational text, translation, answer, transcript, test, or audio record is classified `SAFE_TO_INGEST`. The implementation dataset therefore contains **0 educational rows**. Existing course/chapter/edition/source relationships are non-expressive structural facts and remain `METADATA_ONLY`; they are not silently promoted to educational content.

Classification counts below use one row per reviewed content/resource category, not one row per URL or local file:

| Classification | Category rows | Meaning here |
|---|---:|---|
| `SAFE_TO_INGEST` | 0 | Official evidence supports app ingestion and intended redistribution. |
| `METADATA_ONLY` | 6 | Non-expressive identity, structure, reference, or provenance facts only. |
| `REFERENCE_ONLY` | 4 | Retain/link the official source; do not copy its educational payload. |
| `BLOCKED_BY_RIGHTS` | 14 | Publisher-authored text/media requires explicit permission or licence for app inclusion. |
| `UNVERIFIED` | 4 | Evidence is insufficient or mapping/extraction is unresolved. |

## Official rights evidence

| Use case | Status | Official evidence | Operational constraint |
|---|---|---|---|
| Keep public source references/URLs | CLEARLY PERMITTED | [Klett linking policy](https://hilfe.klett-sprachen.de/hc/de/articles/360018159898-Darf-ich-auf-Inhalte-der-Website-von-Ernst-Klett-Sprachen-per-Link-von-meiner-Website-Plattform-verweisen) | Link only to freely accessible, non-password-protected content. Do not imply the link grants copying rights. |
| Download materials for private development | UNCLEAR / CONDITIONAL | [Klett audio-download notice](https://hilfe.klett-sprachen.de/hc/de/articles/25778088982045-Kann-ich-die-Audios-von-meinem-Buch-herunterladen) permits downloading where Allango exposes that function; [Klett linking policy](https://hilfe.klett-sprachen.de/hc/de/articles/360018159898-Darf-ich-auf-Inhalte-der-Website-von-Ernst-Klett-Sprachen-per-Link-von-meiner-Website-Plattform-verweisen) forbids download-and-re-upload without permission. | A download control supports possession on the user's device, not extraction, redistribution, or bundling in DeutschFlow. Resource-specific access conditions still apply. |
| Extract small structured educational facts | UNCLEAR / NEEDS RIGHTS-HOLDER CONFIRMATION | [Klett reproduction notice](https://hilfe.klett-sprachen.de/hc/de/articles/34419146927517-Ist-die-Vervielf%C3%A4ltigung-von-urheberrechtlich-gesch%C3%BCtzten-Materialien-erlaubt) says reproduction of teaching materials requires consent. | Preserve only non-expressive bibliographic/structural metadata under the existing project policy; do not extract educational wording into the safe dataset. |
| Store extracted publisher text locally for personal use | UNCLEAR / NEEDS RIGHTS-HOLDER CONFIRMATION | [Klett digital-copy notice](https://hilfe.klett-sprachen.de/hc/de/articles/360018013237-Darf-ich-eine-digitale-Kopie-der-Produkte-von-Ernst-Klett-Sprachen-anfertigen-und-per-Mail-versenden-oder-auf-eine-Lern-Plattform-Cloud-oder-Serverumgebung-hochladen) and [reproduction notice](https://hilfe.klett-sprachen.de/hc/de/articles/34419146927517-Ist-die-Vervi%C3%A4ltigung-von-urheberrechtlich-gesch%C3%BCtzten-Materialien-erlaubt) | No official notice reviewed grants a general app-local extraction right. |
| Redistribute publisher text inside an app | CLEARLY RESTRICTED / LICENSE REQUIRED | [Klett digital-copy notice](https://hilfe.klett-sprachen.de/hc/de/articles/360018013237-Darf-ich-eine-digitale-Kopie-der-Produkte-von-Ernst-Klett-Sprachen-anfertigen-und-per-Mail-versenden-oder-auf-eine-Lern-Plattform-Cloud-oder-Serverumgebung-hochladen) | Do not bundle vocabulary, translations, examples, exercises, answers, transcripts, tests, or teacher material without written permission. |
| Redistribute publisher audio/video inside an app | CLEARLY RESTRICTED / LICENSE REQUIRED | [Klett digital-material upload notice](https://hilfe.klett-sprachen.de/hc/de/articles/360018159778-Darf-ich-digitale-Materialien-Downloads-MP3-Audios-etc-die-auf-der-Website-von-Ernst-Klett-Sprachen-stehen-auf-eine-Plattform-hochladen-und-einem-Kurs-zur-Verf%C3%BCgung-stellen) | Do not bundle or re-host MP3/video payloads. Technical asset metadata is not playback permission. |
| Distribute an app privately for personal use with publisher content | UNCLEAR / NEEDS RIGHTS-HOLDER CONFIRMATION | The notices above address copying/distribution but do not grant a private-app exception. | A private build does not resolve publisher-content rights. Keep publisher content external/reference-only. |
| Public/App Store distribution with publisher content | LICENSE REQUIRED | [Klett reproduction notice](https://hilfe.klett-sprachen.de/hc/de/articles/34419146927517-Ist-die-Vervielf%C3%A4ltigung-von-urheberrechtlich-gesch%C3%BCtzten-Materialien-erlaubt) and [digital-material upload notice](https://hilfe.klett-sprachen.de/hc/de/articles/360018159778-Darf-ich-digitale-Materialien-Downloads-MP3-Audios-etc-die-auf-der-Website-von-Ernst-Klett-Sprachen-stehen-auf-eine-Plattform-hochladen-und-einem-Kurs-zur-Verf%C3%BCgung-stellen) | Obtain explicit written rights covering the app, platforms, territories, duration, text/media categories, and distribution model before ingestion/release. |

Short clauses controlling the decision:

- Linking policy: “Auf frei zugängliche, nicht passwortgeschützte Inhalte können Sie sehr gern verweisen.”
- Digital-copy policy: “Jegliche digitale Kopie ... und deren Distribution” is generally not permitted.
- Reproduction policy: copying/reproduction is allowed only with publisher or rights-holder consent.
- Digital-material policy: platform upload of downloads and MP3 audio is generally not permitted.

## Reviewed content and resource categories

| ID | Category | Chapters | Classification | Official source/evidence | App-safe handling |
|---|---|---|---|---|---|
| M1 | Course, component, edition and ISBN identity | 1–12 | `METADATA_ONLY` | [Full KB product](https://www.klett-sprachen.de/netzwerk-neu-a2/t-1/9783126071642), [full ÜB product](https://www.klett-sprachen.de/netzwerk-neu-a2/t-1/9783126071659), [A2.1 Allango product](https://www.allango.net/api/product/MAXP-607162), [A2.2 Allango product](https://www.allango.net/api/product/MAXP-607163) | Preserve as source identity/provenance; no book body. |
| M2 | Chapter number, exact printed title and order | 1–12 | `METADATA_ONLY` | [A2.1 pacing plan](https://www.klett-sprachen.de/downloads/31656/netzwerk-neu-a2-1-stoffverteilungsplan/pdf), [A2.2 pacing plan](https://www.klett-sprachen.de/downloads/31657/netzwerk-neu-a2-2-stoffverteilungsplan/pdf) | Preserve exact title metadata. Keep the Kapitel 1 transcript anomaly separate. |
| M3 | Edition-scoped KB/ÜB page ranges | 1–12 | `METADATA_ONLY` | A2.1/A2.2 pacing plans above | Store only with edition/component/ISBN; do not transpose to full-edition scans. |
| M4 | Explicit task, clip and copy-template references | 1–12 | `METADATA_ONLY` | [Online overview K1–6](https://www.klett-sprachen.de/downloads/26412/netzwerk-neu-a2-uebersicht-online-uebungen-kapitel-1-6/pdf), [K7–12](https://www.klett-sprachen.de/downloads/26413/netzwerk-neu-a2-uebersicht-online-uebungen-kapitel-7-12/pdf), [clip overview](https://www.klett-sprachen.de/downloads/26408/netzwerk-neu-a2-uebersicht-clips-kapitel-1-12/pdf), [copy-template package](https://www.klett-sprachen.de/downloads/28003/netzwerk-neu-a2-kopiervorlagen-fuer-den-online-unterricht/zip), official teacher-board URLs indexed in the audit | References only; do not copy prompts, examples, or answers. |
| M5 | Audio filename/disc/track/component/chapter relationship | 1–12 | `METADATA_ONLY` | Official KB/ÜB transcript indexes: [KB K1–6](https://www.klett-sprachen.de/downloads/23661/netzwerk-neu-a2-transkript-audios-kursbuch-kapitel-1-6/pdf), [KB K7–12](https://www.klett-sprachen.de/downloads/24678/netzwerk-neu-a2-transkript-audios-kursbuch-kapitel-7-12/pdf), [ÜB K1–6](https://www.klett-sprachen.de/downloads/23662/netzwerk-neu-a2-transkript-audios-uebungsbuch-kapitel-1-6/pdf), [ÜB K7–12](https://www.klett-sprachen.de/downloads/24679/netzwerk-neu-a2-transkript-audios-uebungsbuch-kapitel-7-12/pdf) | All 189 local files remain source assets only. Exact page/exercise is null for every track. |
| M6 | Official URL, domain, access state and provenance identifiers | 1–12 | `METADATA_ONLY` | Official resource register in `NETZWERK_NEU_A2_STRUCTURE_INDEX.json` | Preserve references; no linked payload ingestion. |
| R1 | Public online exercise applications | 1–12 | `REFERENCE_ONLY` | [K1–6 app](https://einstufungstests.klett-sprachen.de/eks/netzwerkneu_a2_k1-6/), [K7–12 app](https://einstufungstests.klett-sprachen.de/eks/netzwerkneu_a2_k7-12/) | Link externally; do not reproduce prompts, options, feedback, or answers. |
| R2 | Public Klett PDF/ZIP resources as source links | 1–12 | `REFERENCE_ONLY` | Exact official URLs in `NETZWERK_NEU_A2_OFFICIAL_SOURCE_AUDIT.md` | Retain URL and source metadata only. Public download is not app redistribution permission. |
| R3 | Licensed Allango page/media associations and digital editions | 1–12 | `REFERENCE_ONLY` | [Allango playback notice](https://hilfe.klett-sprachen.de/hc/de/articles/19843383762077-Wie-kann-ich-die-Audios-zu-meinem-Lehrwerk-in-allango-abspielen), [page/media notice](https://hilfe.klett-sprachen.de/hc/de/articles/10088191577245-Welche-Medien-sind-in-meiner-Digitalen-Ausgabe-allango-verf%C3%BCgbar) | Access only through legitimate Allango interfaces/licences; do not bypass controls or copy payloads. |
| R4 | Klett rights/help notices | 1–12 | `REFERENCE_ONLY` | Official rights links in this matrix | Preserve URL, retrieval date, and concise finding. |
| B1 | German vocabulary/headwords and chapter vocabulary | 1–12 | `BLOCKED_BY_RIGHTS` | [Official Kapitelwortschatz](https://www.klett-sprachen.de/downloads/24281/netzwerk-neu-a2-kapitelwortschatz-kapitel-1-12/pdf) | No list/text ingestion without written permission. |
| B2 | English meanings/translations | 1–12 | `BLOCKED_BY_RIGHTS` | [Official German–English glossary](https://www.klett-sprachen.de/downloads/26091/netzwerk-neu-a2-glossar-deutsch-englisch/pdf) | No translation ingestion without written permission. |
| B3 | Arabic meanings/translations | 1–12 | `BLOCKED_BY_RIGHTS` | [Official German–Arabic glossary](https://www.klett-sprachen.de/downloads/26090/netzwerk-neu-a2-glossar-deutsch-arabisch/pdf) | No translation ingestion without written permission. |
| B4 | Grammar rules, explanations and authored examples | 1–12 | `BLOCKED_BY_RIGHTS` | Pacing plans, online exercises, tests and teacher resources identify availability; bodies remain publisher material | Metadata about existence/topic may be retained only when non-expressive; no wording ingestion. |
| B5 | Example sentences, dialogues and contextual text | 1–12 | `BLOCKED_BY_RIGHTS` | Glossaries, chapter vocabulary, exercises and transcripts | No wording ingestion or reconstruction. |
| B6 | Exercise instructions, prompts, options and feedback | 1–12 | `BLOCKED_BY_RIGHTS` | Online exercise apps, copy templates, tests and book solutions | External reference only. Do not infer or rewrite the source exercise into the dataset. |
| B7 | Accepted answers and solution text | 1–12 | `BLOCKED_BY_RIGHTS` | [KB solutions K1–6](https://www.klett-sprachen.de/downloads/25220/netzwerk-neu-a2-loesungen-kursbuch-kapitel-1-6/pdf), [KB K7–12](https://www.klett-sprachen.de/downloads/25221/netzwerk-neu-a2-loesungen-kursbuch-kapitel-7-12/pdf), [ÜB K1–6](https://www.klett-sprachen.de/downloads/28633/netzwerk-neu-a2-loesungen-uebungsbuch-kapitel-1-6/pdf), [ÜB K7–12](https://www.klett-sprachen.de/downloads/28634/netzwerk-neu-a2-loesungen-uebungsbuch-kapitel-7-12/pdf) | No answer/solution ingestion and no inferred accepted-answer sets. |
| B8 | Audio, video and Redemittel transcript wording | 1–12 | `BLOCKED_BY_RIGHTS` | KB/ÜB transcript indexes above; [video K1–6](https://www.klett-sprachen.de/downloads/23660/netzwerk-neu-a2-transkript-videos-kursbuch-kapitel-1-6/pdf), [video K7–12](https://www.klett-sprachen.de/downloads/24677/netzwerk-neu-a2-transkript-videos-kursbuch-kapitel-7-12/pdf), [Redemittel](https://www.klett-sprachen.de/downloads/23663/netzwerk-neu-a2-transkript-redemittel-clips-kursbuch/pdf) | Track/chapter index metadata only; no transcript text ingestion. |
| B9 | Publisher MP3/audio payloads | 1–12 | `BLOCKED_BY_RIGHTS` | Klett digital-material upload notice; Allango download/playback notices | Do not bundle, copy, re-host, or make playable from the local technical index. |
| B10 | Publisher video/clip payloads | 1–12 | `BLOCKED_BY_RIGHTS` | Clip overview and access-controlled official packages in the audit | Reference metadata only. |
| B11 | Tests and answer keys | 1–12 | `BLOCKED_BY_RIGHTS` | [Official tests package](https://www.klett-sprachen.de/downloads/24391/tests-zu-kapitel-1-12-inkl-loesungen/zip) | No prompt, answer, or scoring-content ingestion. |
| B12 | Teacher-board and teacher-resource body material | 1–12 | `BLOCKED_BY_RIGHTS` | Twelve official teacher-board PDFs indexed in `NETZWERK_NEU_A2_STRUCTURE_INDEX.json` | Task/source relation metadata only. |
| B13 | Copy-template body material | 1–12 | `BLOCKED_BY_RIGHTS` | Official copy-template package above | Filename/task relation metadata only. |
| B14 | Austrian/Swiss Landeskunde worksheet content | 1–5, 7, 9–10, 12 where officially supplied | `BLOCKED_BY_RIGHTS` | Twelve exact official worksheet URLs in `NETZWERK_NEU_A2_OFFICIAL_SOURCE_AUDIT.md` | Chapter/topic/source metadata only; no worksheet body. |
| U1 | Local scans/OCR as authoritative educational content | 1–12 | `UNVERIFIED` | Local files are comparison-only and are not official-source evidence | Do not ingest. |
| U2 | Degraded Kapitel 5 test OCR | 5 | `UNVERIFIED` | Existing extraction-quality audit | Do not ingest or repair by inference. |
| U3 | Image-only test answer-key OCR | 1–12 as applicable | `UNVERIFIED` | Existing extraction-quality audit | Do not ingest or infer answers. |
| U4 | Exact audio track → page → exercise mapping | 1–12 | `UNVERIFIED` | Official transcript indexes prove component/chapter/track ranges only | Keep `page` and `exercise` null for all 189 local audio assets. |

## Twelve-chapter coverage

Every chapter has official source coverage for structure, vocabulary/glossaries, exercises, solutions, transcripts/listening metadata, tests, and a teacher-board task relationship. These sources prove availability and provenance; they do not grant app-ingestion rights to their educational payloads.

| Kapitel | Exact printed title | Edition / ISBN | Official KB pages | Official ÜB pages | Local audio assets | Rights-safe educational rows | Special status |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | Und was machst du? | A2.1 / 978-3-12-607162-8 | 6–15 | 78–89 | 16 | 0 | Official audio-transcript heading says “Das bin ich.” Preserve as a separate anomaly; do not normalize. |
| 2 | Nach der Schulzeit | A2.1 / 978-3-12-607162-8 | 16–25 | 90–101 | 16 | 0 | No title anomaly recorded. |
| 3 | Immer online? | A2.1 / 978-3-12-607162-8 | 26–35 | 102–113 | 25 | 0 | No title anomaly recorded. |
| 4 | Große und kleine Gefühle | A2.1 / 978-3-12-607162-8 | 42–51 | 118–129 | 21 | 0 | No title anomaly recorded. |
| 5 | Leben in der Stadt | A2.1 / 978-3-12-607162-8 | 52–61 | 130–141 | 17 | 0 | Degraded/image-based test extraction remains unverified. |
| 6 | Arbeitswelten | A2.1 / 978-3-12-607162-8 | 62–71 | 142–153 | 35 | 0 | No title anomaly recorded. |
| 7 | Ganz schön mobil | A2.2 / 978-3-12-607163-5 | 6–15 | 78–89 | 9 | 0 | Local set has KB audio only; official ÜB ranges remain source metadata. |
| 8 | Gelernt ist gelernt! | A2.2 / 978-3-12-607163-5 | 16–25 | 90–101 | 9 | 0 | Local set has KB audio only. |
| 9 | Sportlich, sportlich | A2.2 / 978-3-12-607163-5 | 26–35 | 102–113 | 11 | 0 | Local set has KB audio only. |
| 10 | Zusammen leben | A2.2 / 978-3-12-607163-5 | 42–51 | 118–129 | 12 | 0 | Local set has KB audio only. |
| 11 | Wie die Zeit vergeht! | A2.2 / 978-3-12-607163-5 | 52–61 | 130–141 | 5 | 0 | Local set has KB audio only. |
| 12 | Gute Unterhaltung! | A2.2 / 978-3-12-607163-5 | 62–71 | 142–153 | 13 | 0 | Local set has KB audio only. |

Audio totals remain: **0 proven exact page/exercise mappings**, **189 partially proven component/chapter/track mappings**, and **189 unresolved page/exercise fields**.

## Rights conclusion and unblock requirement

The current maximum safe implementation boundary is source/bibliographic/structural metadata plus external official links. It does not include publisher-authored educational content. The only path to a non-empty `SAFE_TO_INGEST` publisher-content dataset is written permission or a licence from Ernst Klett Sprachen that expressly covers extraction, local app storage, modification if needed, and private/public application redistribution (including App Store distribution and audio where applicable).
