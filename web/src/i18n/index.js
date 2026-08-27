import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import {
  loadLanguageBundle,
  normalizeLanguage,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  FALLBACK_LANGUAGE,
} from "./resources"
import {
  detectInitialLanguage,
  browserDetectionEnv,
} from "./detectInitialLanguage"

/**
 * i18next bootstrap · I18N01
 *
 * Two-language site (English + Spanish). Translations are bundled at build
 * time — no HTTP backend — but they are split PER LANGUAGE and reached via
 * `import()` (see resources.js). Only the active language ships in the
 * initial payload; the other one is fetched the first time the user
 * switches. Nothing else about the runtime behaviour changed.
 *
 * Detection order: `path` (URL prefix /es/*) → `localStorage` → browser
 * `navigator`. Fallback is Spanish (FALLBACK_LANGUAGE) — see resources.js.
 *
 * NOTE · the language the ROUTER renders is decided by <LanguageWrapper>
 * (`detectLanguageFromPath`): `/es/*` is Spanish and an unprefixed path is
 * ALWAYS English. The detection below therefore only governs (a) which
 * bundle is preloaded for the first frame and (b) the first-visit redirect
 * in LanguageWrapper that sends a non-English browser from `/` to `/es`. The `path` detector reads `lookupFromPathIndex: 0`, which
 * extracts the first path segment and matches it against `supportedLngs`.
 * `detectInitialLanguage()` below mirrors that order EXACTLY so we know
 * which bundle to preload before `init()` runs; the LanguageDetector plugin
 * stays in the chain so its localStorage caching keeps working unchanged.
 *
 * Suspense is disabled because admin/dashboard routes lazy-load and the
 * <Suspense> fallback would compete with the route-level fallback. Instead
 * `main.jsx` awaits `i18nReady` before the first render, so no frame can
 * ever paint raw keys like `home.hero.title`.
 *
 * To opt the entire site in/out at runtime, set `VITE_I18N_ENABLED=false`
 * in env. When disabled the app stays English-only (i18n still initialises
 * so `t()` calls work, but the language detector defaults to the fallback).
 */

const I18N_ENABLED = import.meta.env.VITE_I18N_ENABLED !== "false"

const LOCAL_STORAGE_KEY = "preferred-language"

const detection = I18N_ENABLED
  ? {
      order: ["path", "localStorage", "navigator"],
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
      lookupLocalStorage: LOCAL_STORAGE_KEY,
    }
  : { order: [], caches: [] }

/** Has i18next already got every namespace for this language in memory? */
function hasBundle(lng) {
  // The resource store only exists after init(). Anything asking before then
  // is init() itself, which supplies its own `resources` — report "present"
  // so the changeLanguage wrapper below passes straight through.
  if (!i18n.store) return true
  const key = normalizeLanguage(lng)
  return NAMESPACES.every((ns) => i18n.hasResourceBundle(key, ns))
}

/** Fetch + register a language's namespaces. No-op when already present. */
async function ensureBundle(lng) {
  const key = normalizeLanguage(lng)
  if (hasBundle(key)) return
  const bundle = await loadLanguageBundle(key)
  for (const ns of NAMESPACES) {
    if (bundle[ns] && !i18n.hasResourceBundle(key, ns)) {
      // deep = false, overwrite = false — never mutate an existing bundle.
      i18n.addResourceBundle(key, ns, bundle[ns], false, false)
    }
  }
}

// Resolve the language BEFORE init so the correct locale chunk is already in
// memory when i18next initialises. A direct hit on `/es/...` therefore paints
// Spanish on the very first frame — never English-then-swap. Any disagreement
// with the real detector plugin is caught by the post-init check below.
// VITE_I18N_ENABLED=false keeps the site English-only regardless of the
// Spanish-first fallback.
const initialLanguage = I18N_ENABLED
  ? detectInitialLanguage(detection.order, browserDetectionEnv())
  : "en"

/**
 * `i18nReady` resolves once i18next is initialised AND the active language's
 * namespaces are registered. `main.jsx` awaits it before the first React
 * render.
 */
const i18nReady = loadLanguageBundle(initialLanguage)
  .then((bundle) =>
    i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        // Only the active language is present at init. The other one is
        // registered via `addResourceBundle` (see `ensureBundle`) before any
        // switch to it takes effect. No backend connector is involved, so
        // `partialBundledLanguages` is deliberately NOT set — it would make
        // i18next mark namespaces as pending against a loader that does not
        // exist.
        resources: { [initialLanguage]: bundle },
        fallbackLng: I18N_ENABLED ? FALLBACK_LANGUAGE : "en",
        supportedLngs: SUPPORTED_LANGUAGES,
        defaultNS: "common",
        ns: NAMESPACES,
        interpolation: { escapeValue: false }, // React already escapes
        detection,
        react: { useSuspense: false },
        returnNull: false, // missing keys → key string (visible in dev) not null
      }),
  )
  .then(async () => {
    // Safety net: if the real detector resolved to a language our mirror did
    // not predict, load it now — still before React's first render.
    if (!hasBundle(i18n.language)) {
      await ensureBundle(i18n.language)
      await i18n.changeLanguage(normalizeLanguage(i18n.language))
    }
    // `fallbackLng` lookups need the fallback bundle present. When the active
    // language is not the fallback, warm it in the background so a missing
    // key can still fall back to real copy instead of the raw key.
    if (normalizeLanguage(i18n.language) !== FALLBACK_LANGUAGE) {
      ensureBundle(FALLBACK_LANGUAGE).catch(() => { /* non-fatal */ })
    }

    if (import.meta.env.DEV) {
      console.info(
        `[i18n] initialised • language=${i18n.language} • enabled=${I18N_ENABLED}`,
      )
    }
    return i18n
  })

/**
 * Guarantee that ANY caller of `i18n.changeLanguage` — <LanguageWrapper> on a
 * route change, useLanguage().setLang, react-i18next internals — waits for the
 * target language's bundle before the change (and the re-render it triggers)
 * takes effect.
 *
 * DEVIATION from the suggested `languageChanged` listener: that event fires
 * AFTER i18next has already switched, so react-i18next re-renders the tree
 * against an empty resource store and paints raw keys for one or more frames.
 * Wrapping `changeLanguage` closes that window at the single choke point every
 * caller goes through, and needs no edits to components outside i18n/.
 */
const nativeChangeLanguage = i18n.changeLanguage.bind(i18n)
i18n.changeLanguage = function changeLanguageWithBundle(lng, callback) {
  if (lng && !hasBundle(lng)) {
    return ensureBundle(lng)
      .then(() => nativeChangeLanguage(lng, callback))
      .catch((err) => {
        // Network failure fetching the locale chunk: stay on the current
        // language rather than switching into a wall of raw keys.
        console.error("[i18n] failed to load language bundle", lng, err)
        return i18n.t.bind(i18n)
      })
  }
  return nativeChangeLanguage(lng, callback)
}

export { i18nReady, ensureBundle, loadLanguageBundle }
export default i18n
