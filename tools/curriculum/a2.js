/*
 * DeutschFlow A2 — the units that complete the level.
 *
 * A2 already has seven lessons that came through the open-content intake: services,
 * family, travel, health, housing and work, education, the city. Those cover the
 * situations. What they left out is the language that connects situations into
 * conversation — reasons, opinions, conditions, comparisons, formal writing, and
 * narration — and that is what units 8 to 12 add.
 *
 * These units attach to the existing A2 course rather than starting a second one. A
 * learner should meet one A2, not a DeutschFlow A2 sitting next to a DeutschFlow Open A2.
 */

import { A2_UNITS } from "./a2-units-8-12.js";

export const A2_EXTRA = {
  cefr: "A2",
  ordering: 2,
  attachToCourseSlug: "deutschflow-open-a2",
  title: { de: "DeutschFlow A2", en: "DeutschFlow A2", ar: "دويتش فلو A2" },
  objective: {
    ar: "توسيع التواصل اليومي: العمل، الخدمات، السفر، الصحة، والحديث عن الماضي والخطط والآراء.",
    en: "Widening everyday communication: work, services, travel, health, plans, opinions and the past."
  },
  units: [...A2_UNITS]
};
