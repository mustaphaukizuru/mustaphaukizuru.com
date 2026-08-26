import {
  Compass,
  Bot,
  CloudCog,
  Code2,
  Search,
  Hammer,
  Rocket,
} from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  homeData.js · roadmap step 24/28 — one thesis, two paths, trust layer
 *
 *  Locale-agnostic catalogue for the Home page. Every visible string is an
 *  i18next key under the `home` namespace; consumers call `t(key)`.
 *  Icons are Lucide components (never emoji).
 *  ──────────────────────────────────────────────────────────────────── */

/* The 4 service categories from docs/SERVICE_CATALOGUE_2026-08.md.
 * `to` points at a slug that exists in web/src/data/servicesCatalogue.js
 * today; AI & Automation has no dedicated catalogue slug yet, so it links
 * to the catalogue index until one is seeded. */
export const serviceCategories = [
  { key: "strategy", icon: Compass,  to: "/services/it-strategy-consulting" },
  { key: "ai",       icon: Bot,      to: "/services/ai-automation" },
  { key: "cloud",    icon: CloudCog, to: "/services/cloud-architecture-migration" },
  { key: "product",  icon: Code2,    to: "/services/digital-product-engineering" },
]

/* "How I work" — three steps. Copy lives under home:process.steps.* */
export const processSteps = [
  { key: "discover", icon: Search },
  { key: "build",    icon: Hammer },
  { key: "launch",   icon: Rocket },
]

/* Trust layer (step 28) — testimonials come from the DB.
 *
 * Home.jsx feeds TestimonialsMarquee from GET /api/v1/reviews/featured
 * (approved + admin-featured reviews). The section renders nothing until at
 * least one real review is featured, so the site never publishes social
 * proof no client gave. There are no placeholder entries to replace. */

/* Proof-strip numbers (HomeStatsStrip). Labels via home:stats.<key>Label
 *
 * Entries with a `proofKey` are live: HomeStatsStrip reads
 * GET /api/v1/bio/proof (see hooks/useProof.js) and swaps `to` for the DB
 * value, hiding the entry when that value is 0. `to` is only the loading
 * fallback for those. Entries without a `proofKey` are static facts the DB
 * does not hold. */
export const stats = [
  { key: "years",     to: 8,   suffix: "+", proofKey: "years" },
  { key: "projects",  to: 47,  suffix: "",  proofKey: "projects" },
  { key: "clients",   to: 20,  suffix: "+", proofKey: "clients" },
  { key: "reviews",   to: 10,  suffix: "",  proofKey: "reviews" },
  { key: "countries", to: 4,   suffix: ""  },
  { key: "students",  to: 100, suffix: "+" },
]

/**
 * Merge the live proof payload into the static list. `proof` undefined
 * (still loading / request failed) → the static numbers; otherwise live
 * entries take the DB value and entries whose DB value is 0 are dropped.
 */
export function resolveStats(proof, list = stats) {
  if (!proof) return list
  return list.flatMap((entry) => {
    if (!entry.proofKey) return [entry]
    const live = Number(proof[entry.proofKey])
    if (!Number.isFinite(live) || live <= 0) return []
    return [{ ...entry, to: live }]
  })
}
