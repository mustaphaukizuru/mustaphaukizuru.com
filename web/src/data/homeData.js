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

/* Trust layer (step 28) — named testimonials with role + company.
 *
 * PLACEHOLDER ENTRIES. The previous anonymised quotes ("Aline M.") carried
 * no company attribution, so they could not satisfy the named-testimonial
 * requirement. Each entry below is marked `placeholder: true` and renders a
 * `data-placeholder` attribute; the owner replaces name/role/company/quote
 * in home.json (EN + ES, under testimonials.items.<key>) and flips the flag
 * to false. Never ship these as real social proof. */
export const testimonials = [
  { key: "a", initials: "AM", rating: 5, placeholder: true },
  { key: "b", initials: "JN", rating: 5, placeholder: true },
  { key: "c", initials: "CK", rating: 5, placeholder: true },
]

/* Proof-strip numbers (HomeStatsStrip). Labels via home:stats.<key>Label */
export const stats = [
  { key: "years",     to: 8,   suffix: "+" },
  { key: "projects",  to: 47,  suffix: ""  },
  { key: "countries", to: 4,   suffix: ""  },
  { key: "students",  to: 100, suffix: "+" },
]
