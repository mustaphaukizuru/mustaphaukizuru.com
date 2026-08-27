// `.js` extension is explicit so plain Node (scripts/check-i18n.mjs) can
// import this module without going through Vite's resolver.
import { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE, normalizeLanguage } from "./resources.js"

/**
 * detectInitialLanguage(order, env) · I18N01
 *
 * A pure, dependency-free mirror of `i18next-browser-languagedetector`'s
 * resolution for the exact configuration this app uses:
 *
 *   order: ["path", "localStorage", "navigator"]
 *   lookupFromPathIndex: 0
 *   lookupLocalStorage: "preferred-language"
 *   supportedLngs: ["en", "es"] · fallbackLng: "es"
 *
 * WHY IT EXISTS · locale bundles are now split per language and loaded with
 * `import()`, so we must know the language BEFORE `i18n.init()` runs in
 * order to preload the right chunk. The detector plugin only reports the
 * language *during* init, which is too late — a direct hit on `/es/...`
 * would paint English and swap. This runs first, so `/es/...` loads the
 * Spanish bundle for the very first frame.
 *
 * The detector plugin itself stays in the i18next chain (its localStorage
 * caching behaviour is unchanged); `index.js` re-checks `i18n.language`
 * after init and loads the bundle for real if the two ever disagree.
 *
 * Kept free of `import.meta.env` and of direct `window` access so it can be
 * unit-tested from plain Node (scripts/check-i18n.mjs).
 *
 * @param {string[]} order      detection sources, in priority order
 * @param {object}   env
 * @param {string}   env.pathname            e.g. "/es/about"
 * @param {(k:string)=>string|null} env.getStored  localStorage reader
 * @param {string[]} env.navigatorLanguages  e.g. ["es-MX", "en-US"]
 * @returns {"en"|"es"}
 */
export function detectInitialLanguage(order = [], env = {}) {
  const {
    pathname = "/",
    getStored = () => null,
    navigatorLanguages = [],
  } = env

  for (const source of order) {
    if (source === "path") {
      // lookupFromPathIndex: 0 → the first non-empty path segment.
      const segment = String(pathname).split("/").filter(Boolean)[0]
      if (segment && SUPPORTED_LANGUAGES.includes(segment.toLowerCase())) {
        return segment.toLowerCase()
      }
    } else if (source === "localStorage") {
      let stored = null
      try { stored = getStored("preferred-language") }
      catch { /* storage disabled / private mode */ }
      if (typeof stored === "string" && stored) {
        const base = stored.toLowerCase().split("-")[0]
        if (SUPPORTED_LANGUAGES.includes(base)) return base
      }
    } else if (source === "navigator") {
      // Spanish-first: the browser's FIRST language decides. `en*` → en,
      // anything else (es, pt-BR, fr…) → es. We deliberately do not scan
      // further down the list — a pt-BR user with en as a distant second
      // choice is a LATAM visitor, not an English one.
      const first = navigatorLanguages.find((c) => typeof c === "string" && c)
      if (first) {
        return first.toLowerCase().split("-")[0] === "en" ? "en" : "es"
      }
    }
  }

  return normalizeLanguage(FALLBACK_LANGUAGE)
}

/** Browser-backed `env` for detectInitialLanguage. Safe when there is no DOM. */
export function browserDetectionEnv() {
  if (typeof window === "undefined") {
    return { pathname: "/", getStored: () => null, navigatorLanguages: [] }
  }
  const nav = window.navigator
  const navigatorLanguages = nav?.languages?.length
    ? Array.from(nav.languages)
    : [nav?.language].filter(Boolean)
  return {
    pathname: window.location?.pathname || "/",
    getStored: (key) => window.localStorage?.getItem(key) ?? null,
    navigatorLanguages,
  }
}

export default detectInitialLanguage
