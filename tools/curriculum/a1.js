/*
 * DeutschFlow A1 — the complete beginner pathway.
 *
 * Eight units taking a learner from "hello" to the edge of A2: say who you are, handle
 * numbers and time, talk about people, describe a day, shop and eat, live somewhere, find
 * your way, and deal with appointments and the recent past. The lessons are written to be
 * met in order, and grammar arrives where the learner needs it to say the next thing —
 * the accusative when they start buying, the dative when they start describing where
 * things are, the Perfekt last, once there is enough past to talk about.
 */

import { UNITS_1_2 } from "./a1-units-1-2.js";
import { UNITS_3_5 } from "./a1-units-3-5.js";
import { UNITS_6_8 } from "./a1-units-6-8.js";

export const A1 = {
  cefr: "A1",
  ordering: 1,
  title: { de: "DeutschFlow A1", en: "DeutschFlow A1", ar: "دويتش فلو A1" },
  objective: {
    ar: "من الصفر إلى القدرة على التعامل مع مواقف الحياة اليومية البسيطة بالألمانية.",
    en: "From nothing to handling simple everyday situations in German."
  },
  units: [...UNITS_1_2, ...UNITS_3_5, ...UNITS_6_8]
};
