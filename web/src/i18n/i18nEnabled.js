/**
 * The i18n kill switch, with ONE polarity.
 *
 * This existed twice, read in opposite directions:
 *
 *   web/src/i18n/index.js        VITE_I18N_ENABLED !== "false"   opt-OUT
 *   web/scripts/generate-sitemap.mjs   VITE_I18N_ENABLED === "true"    opt-IN
 *
 * They only agree when the variable is explicitly set. It is not set in CI
 * (ci.yml deliberately ships no env files) and it is not set on the host, so
 * the two disagreed on every real build: the SPA shipped the /es routes and
 * served them, while the sitemap emitted no /es alternates and dropped the
 * xhtml namespace entirely. Google was therefore never told the Spanish
 * mirror exists — the crawl-side half of the same problem T2-1 fixed on the
 * link side.
 *
 * Opt-out is the polarity that survives: the Spanish mirror is shipped and
 * routed, so "no configuration" has to mean "the site is bilingual", the
 * same thing the SPA already did. Disabling it stays possible and is now
 * genuinely global — set VITE_I18N_ENABLED=false and both the runtime and
 * the sitemap go English-only together.
 *
 * The value arrives from two different runtimes (import.meta.env in the
 * browser build, process.env in the build scripts), so this takes the raw
 * value rather than reading either one.
 *
 * @param {unknown} raw the VITE_I18N_ENABLED value, or undefined
 * @returns {boolean}
 */
export function isI18nEnabled(raw) {
  return String(raw ?? "").trim().toLowerCase() !== "false"
}

export default isI18nEnabled
