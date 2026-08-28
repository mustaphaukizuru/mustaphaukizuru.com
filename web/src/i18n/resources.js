// Lazy locale-bundle loader · I18N01
//
// PERF · Previously this module statically imported all 32 locale JSON
// files (16 namespaces × en/es, ~300 KB raw) and default-exported one
// `{ en, es }` object. Both languages therefore landed in the entry chunk
// and were parsed on every first load even though a visitor only ever uses
// one of them — a measurable chunk of the 4.5 s bootup / 10.9 s main-thread
// time Lighthouse reported on the shared shell.
//
// Now each language lives in its own module (`resources.en.js` /
// `resources.es.js`) reached ONLY through `import()`, so Rollup emits one
// chunk per language and the initial payload carries just the active one.
// The other language is fetched on demand the first time the user switches.

/** Namespace list — must match the JSON files in locales/<lang>/. */
export const NAMESPACES = [
  "common", "home", "about", "services",
  "store", "product", "cart", "checkout", "auth",
  "dashboard", "admin", "contact", "portfolio", "legal", "errors",
  "blog", "audit",
]

export const SUPPORTED_LANGUAGES = ["en", "es"]
// Spanish-first (Mexico is the home market): a visitor with no usable
// signal — no /es prefix, nothing stored, a non-en/es browser — gets Spanish.
export const FALLBACK_LANGUAGE = "es"

// Static map (not a template literal `import()`) so Rollup can statically
// analyse both targets and emit exactly two locale chunks.
const loaders = {
  en: () => import("./resources.en.js"),
  es: () => import("./resources.es.js"),
}

/** Memoised in-flight/settled promises, so a language is fetched at most once. */
const cache = new Map()

/**
 * Normalise anything i18next hands us ("es-MX", "ES", undefined) down to a
 * language we actually ship. Mirrors i18next's own `supportedLngs` +
 * `fallbackLng` behaviour so the loader can never be asked for a bundle
 * that does not exist.
 */
export function normalizeLanguage(lng) {
  if (typeof lng !== "string") return FALLBACK_LANGUAGE
  const base = lng.toLowerCase().split("-")[0]
  return SUPPORTED_LANGUAGES.includes(base) ? base : FALLBACK_LANGUAGE
}

/**
 * loadLanguageBundle(lng) → Promise<{ [namespace]: translations }>
 *
 * Memoised: repeated calls for the same language share one network request
 * and one parse. A failed load is evicted from the cache so a later retry
 * (e.g. after the network comes back) can succeed.
 */
export function loadLanguageBundle(lng) {
  const key = normalizeLanguage(lng)
  if (!cache.has(key)) {
    cache.set(
      key,
      loaders[key]()
        .then((mod) => mod.default)
        .catch((err) => {
          cache.delete(key)
          throw err
        }),
    )
  }
  return cache.get(key)
}

export default loadLanguageBundle
