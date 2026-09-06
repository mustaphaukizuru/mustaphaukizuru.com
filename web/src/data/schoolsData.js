/* ════════════════════════════════════════════════════════════════════════
   schoolsData.js · /schools audience page · September 2026
   ────────────────────────────────────────────────────────────────────────
   /schools is an AUDIENCE page, not a service category. It composes from
   the closed set of four in servicesCatalogue.js (Blueprint v4.0 § 06)
   and never introduces an offering of its own. Everything here is a
   pointer into data that already exists elsewhere in the repo:

     SCHOOL_OUTCOME_OFFERINGS  offering slugs (one per category, canonical
                               order) rendered as the "four outcomes" grid
     SCHOOL_PROJECTS           portfolio slugs + the cover files committed
                               under public/images/projects/
     SCHOOL_PRODUCTS           store slugs + the cover files committed under
                               public/images/products/<slug>/cover.png
     SCHOOL_HERO_PHOTO         media slot M-16 (blueprint). null until a
                               real school-context photograph exists; the
                               hero renders the SVG system diagram instead.
                               Never point this at stock imagery (§ 5.2i).
   ════════════════════════════════════════════════════════════════════════ */

/** One offering per category, canonical order S1 → S4. Slugs must exist in
 *  servicesCatalogue.js; SchoolsPage resolves them with getOfferingBySlug
 *  and silently skips any that fail to resolve. */
export const SCHOOL_OUTCOME_OFFERINGS = [
  "software-stack-audit",        // S1 · Strategic IT consulting
  "whatsapp-lead-qualifiers",    // S2 · AI & workflow automation
  "disaster-recovery-planning",  // S3 · Cloud & infrastructure
  "mvp-web-app-development",     // S4 · Digital product engineering
]

/** Portfolio rows seeded by prisma/seed/portfolio-seed.js. Titles are kept
 *  here (EN + ES) so the section never depends on a network call; the
 *  detail page at /projects/:slug remains the source of truth for copy. */
export const SCHOOL_PROJECTS = [
  {
    slug: "colegio-raindrop-website",
    client: "Colegio Raindrop",
    title: "School website & admissions",
    titleEs: "Sitio escolar y admisiones",
    summary: "A responsive site families can scan in seconds, run by school staff.",
    summaryEs: "Un sitio responsive que las familias escanean en segundos, operado por el personal.",
    cover: "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (6).png",
    coverWidth: 1200,
    coverHeight: 750,
    categorySlug: "digital-product-engineering",
  },
  {
    slug: "educational-digital-resources",
    client: "Intellectual Schools",
    title: "Institutional brand system",
    titleEs: "Sistema de marca institucional",
    summary: "A reusable kit for print, social and campus signage across a school network.",
    summaryEs: "Un kit reutilizable para impresos, redes y señalización en una red de colegios.",
    cover: "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (1).png",
    coverWidth: 1200,
    coverHeight: 750,
    categorySlug: "it-strategy-consulting",
  },
]

/** Store rows seeded by prisma/seed/products-seed.js. Prices are never
 *  duplicated here — /store/:slug renders them from the database. */
export const SCHOOL_PRODUCTS = [
  { slug: "school-it-audit-checklist", cover: "/images/products/school-it-audit-checklist/cover.png" },
  { slug: "stem-program-planning-pack", cover: "/images/products/stem-program-planning-pack/cover.png" },
]

/** Media slot M-16 · real school-context photograph (3:2). See the note in
 *  the header comment. Shape when set: { src, width, height }. */
export const SCHOOL_HERO_PHOTO = null
