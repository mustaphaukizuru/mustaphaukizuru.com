/**
 * The four public consulting categories, i.e. every URL the SPA can render
 * under /services/:slug. The source of truth is the frontend catalogue
 * (web/src/data/servicesCatalogue.js → CATEGORIES); the backend cannot
 * import that ESM module, so the slugs are mirrored here and a test
 * (test/sitemapService.test.js) fails the build if the two drift.
 *
 * Do NOT list Service table rows here: their slugs are not routable on the
 * SPA and only lead crawlers to a noindex "not found" page (B5).
 */
const SERVICE_CATEGORY_SLUGS = Object.freeze([
  "it-strategy-consulting",
  "ai-automation",
  "cloud-architecture-migration",
  "digital-product-engineering",
])

module.exports = { SERVICE_CATEGORY_SLUGS }
