/**
 * HowTo — schema.org/HowTo, built from the engagement process (T2-9).
 *
 *   howToSchema({ lang: "es" })
 *
 * Built from HOW_IT_WORKS_DETAILED rather than written out, for the same
 * reason the page is: the six steps exist once, so the structured data and
 * the rendered page cannot describe different processes. A hand-written
 * schema block is the kind of thing that keeps saying "three business days"
 * a year after the commitment changed.
 *
 * `totalTime` is deliberately absent. The elapsed time from first message to
 * handover depends entirely on the engagement — a two-day audit and a
 * multi-month build share these steps — and an invented ISO duration in
 * structured data is a claim, not a formality.
 */
import { HOW_IT_WORKS_DETAILED } from "../../data/engagementProcess"
import { SITE_URL, siteConfig } from "../siteSeo.js"

const pick = (obj, key, lang) => (lang === "es" ? obj[`${key}Es`] || obj[key] : obj[key])

export function howToSchema({ lang = "en" } = {}) {
  const path = lang === "es" ? "/es/how-we-work" : "/how-we-work"

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: lang === "es" ? "Cómo trabajamos" : "How we work",
    description:
      lang === "es"
        ? "Seis pasos desde el primer mensaje hasta la entrega final, ya sea una auditoría de dos días o un proyecto de varios meses."
        : "Six steps from first message to handover, whether the engagement is a two-day audit or a multi-month build.",
    inLanguage: lang === "es" ? "es-MX" : "en-US",
    url: `${SITE_URL}${path}`,
    publisher: {
      "@type": "Person",
      name: siteConfig.person.name,
      url: siteConfig.person.url,
    },
    step: HOW_IT_WORKS_DETAILED.map((s, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: pick(s, "title", lang),
      text: pick(s, "summary", lang),
      // Each step has an id on the page, so a rich result can deep-link to
      // the one a reader asked about.
      url: `${SITE_URL}${path}#${s.id}`,
    })),
  }
}

export default howToSchema
