// ════════════════════════════════════════════════════════════════════════════
// companiesData · organisations Mustapha has delivered work for
// ────────────────────────────────────────────────────────────────────────────
// Consumed by components/ui/LogoCloud. Kept out of the component file so the
// component module only exports components (React Fast Refresh requirement,
// and the same split every other data set in src/data uses).
//
// Assets live in web/public/images/brand/companies/<slug>.webp (+ @2x). They
// were trimmed to the ink and had their flat white backgrounds made
// transparent, so a mark sits correctly on either tone of the wall.
// ════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} Company
 * @property {string} slug     file base name under /images/brand/companies
 * @property {string} name     trading name — becomes the image alt text
 * @property {string} sector   short context line, surfaced in the tooltip
 * @property {boolean} [boxed] mark ships with its own background, so it is
 *                             rounded to read as a deliberate tile
 */

/** @type {Company[]} — ordered schools → commerce → technology. */
export const COMPANIES = [
  { slug: "raindrop",            name: "Colegio de Excelencia Raindrop", sector: "K-12 school · Mexico" },
  { slug: "intellectual-school", name: "Intellectual School",            sector: "K-12 school · Turkey" },
  { slug: "interlaken",          name: "Colegio Interlaken",             sector: "K-12 school · Mexico" },
  { slug: "peimy",               name: "e·PEIMY",                        sector: "Payroll & HR · Mexico" },
  { slug: "blueflame",           name: "BlueFlame Appliances",           sector: "Retail · Rwanda" },
  { slug: "umut",                name: "Umut Cafe & Restaurant",         sector: "Hospitality · Turkey" },
  { slug: "asr",                 name: "ASR",                            sector: "Technology", boxed: true },
]

export default COMPANIES
