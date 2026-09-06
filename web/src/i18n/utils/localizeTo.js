import { pathWithLanguage } from "./pathWithLanguage"

/**
 * localizeTo(to, lang) — the one rule that decides whether a router target
 * gets the Spanish prefix.
 *
 * WHY IT MATTERS
 * The site routes language by URL prefix: English at the root, Spanish
 * under /es. LanguageWrapper reads that prefix on every navigation and sets
 * i18n's language from it. So an unprefixed `to="/services"` clicked from
 * /es/about does not just navigate — it silently switches the whole
 * interface back to English. About 150 links in the public tree were
 * unprefixed, so a Spanish reader lost Spanish at the first click and the
 * translation the project already paid for reached almost nobody.
 *
 * Lives apart from the components that use it so both they and
 * useLocalizedNavigate can import it, and so React fast refresh is not
 * broken by a module that exports a function beside components.
 */

/** Anything with a scheme, or protocol-relative — not ours to rewrite. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** Already Spanish. pathWithLanguage is idempotent; this keeps it obvious. */
const ALREADY_ES = /^\/es(?=\/|$)/

/**
 * /admin is NOT mirrored under /es, so prefixing it produces a URL with no
 * route behind it: /es/admin/orders 404s on reload. That is correct and
 * stays — admin.json is 86 bytes and no admin page calls useTranslation, so
 * those screens are English by convention.
 *
 * /dashboard USED to be in here, and should not have been (D3-3). It is a
 * customer surface with 1,078 translated Spanish keys, and because the
 * language is read off the URL prefix, keeping it unprefixed meant a
 * Spanish member lost Spanish the moment they signed in and could never get
 * it back — no URL existed that would render the dashboard in Spanish. It
 * is mirrored now, so it localizes like everything else, and the public
 * pages that link into it (checkout → /dashboard/addresses, the success
 * page → /dashboard/downloads, signup → /dashboard) now keep the reader's
 * language across the boundary instead of dropping it.
 */
const NOT_MIRRORED = /^\/admin(?=\/|$)/

export function localizeTo(to, lang) {
  if (lang !== "es") return to

  if (typeof to === "string") {
    if (!to || EXTERNAL.test(to) || to.startsWith("#")) return to
    if (!to.startsWith("/")) return to        // relative — the router resolves it
    if (ALREADY_ES.test(to)) return to
    if (NOT_MIRRORED.test(to)) return to
    return pathWithLanguage(to, "es")
  }

  // Object form: { pathname, search, hash }. Only pathname carries language.
  if (to && typeof to === "object" && typeof to.pathname === "string") {
    const p = to.pathname
    if (!p.startsWith("/") || ALREADY_ES.test(p) || NOT_MIRRORED.test(p)) return to
    return { ...to, pathname: pathWithLanguage(p, "es") }
  }

  return to
}

/** "es-MX", "ES", "es" → "es"; anything else → "en". */
export function normaliseLang(language) {
  return String(language || "en").toLowerCase().startsWith("es") ? "es" : "en"
}
