/* ──────────────────────────────────────────────────────────────────────────
 *  components/portfolio/caseStudy.js · shared helpers (roadmap step 27)
 *
 *  The API serialises each project with:
 *    caseStudy: { serviceSlug, context, problem, approach[], outcomes[], stack[] } | null
 *    outcomeLine: "-40% deploy time · 3x throughput" | null
 *    hasPlaceholderMetrics: boolean
 *  ──────────────────────────────────────────────────────────────────── */

export const SERVICE_SLUGS = [
  "it-strategy-consulting",
  "ai-automation",
  "cloud-architecture-migration",
  "digital-product-engineering",
]

/** CTA target for "Book a call about a project like this" */
export function bookHref(serviceSlug) {
  return serviceSlug ? `/book?service=${encodeURIComponent(serviceSlug)}` : "/book"
}

/**
 * Same rule as PortfolioCard.responsiveSrcSet: bundled /images/** assets have
 * `<name>-{400,800,1200}.webp` siblings emitted by scripts/convert-images.mjs.
 * Runtime uploads have none, so return undefined and let the browser use src.
 */
export function responsiveSrcSet(src) {
  if (typeof src !== "string" || !src.startsWith("/images/")) return undefined
  const m = src.match(/^(.*).(jpe?g|png)$/i)
  if (!m) return undefined
  return [400, 800, 1200].map((w) => `${m[1]}-${w}.webp ${w}w`).join(", ")
}

/** Defensive accessor — tolerates legacy rows and static fallbacks */
export function getCaseStudy(project) {
  const cs = project?.caseStudy
  if (!cs || typeof cs !== "object") return null
  return {
    serviceSlug: SERVICE_SLUGS.includes(cs.serviceSlug) ? cs.serviceSlug : null,
    context:  cs.context || null,
    problem:  cs.problem || null,
    approach: Array.isArray(cs.approach) ? cs.approach : [],
    outcomes: Array.isArray(cs.outcomes) ? cs.outcomes : [],
    stack:    Array.isArray(cs.stack) && cs.stack.length > 0
      ? cs.stack
      : (Array.isArray(project?.tools) ? project.tools : []),
  }
}

export function hasPlaceholder(outcomes) {
  return Array.isArray(outcomes) && outcomes.some((o) => o && o.placeholder)
}
