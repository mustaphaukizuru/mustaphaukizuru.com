import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import resources from "./resources"

/**
 * i18next bootstrap · I18N01
 *
 * Two-language site (English + Spanish). Translations are bundled at build
 * time via `resources.js` — no HTTP backend (lazy-loading two languages
 * adds complexity without payoff at this scale).
 *
 * Detection order: `path` (URL prefix /es/*) → `localStorage` → browser
 * `navigator`. The `path` detector reads `lookupFromPathIndex: 0`, which
 * extracts the first path segment and matches it against `supportedLngs`.
 *
 * Suspense is disabled because admin/dashboard routes lazy-load and the
 * <Suspense> fallback would compete with the route-level fallback.
 *
 * To opt the entire site in/out at runtime, set `VITE_I18N_ENABLED=false`
 * in env. When disabled the app stays English-only (i18n still initialises
 * so `t()` calls work, but the language detector defaults to "en").
 */

const I18N_ENABLED = import.meta.env.VITE_I18N_ENABLED !== "false"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    defaultNS: "common",
    ns: [
      "common", "home", "about", "services",
      "store", "product", "cart", "checkout", "auth",
      "dashboard", "admin", "contact", "portfolio", "legal", "errors",
      "blog",
    ],
    interpolation: { escapeValue: false }, // React already escapes
    detection: I18N_ENABLED
      ? {
          order: ["path", "localStorage", "navigator"],
          lookupFromPathIndex: 0,
          caches: ["localStorage"],
          lookupLocalStorage: "preferred-language",
        }
      : { order: [], caches: [] },
    react: { useSuspense: false },
    returnNull: false, // missing keys → key string (visible in dev) not null
  })

// Surface the locale in the dev console so language-switching is debuggable.
if (import.meta.env.DEV) {
   
  console.info(`[i18n] initialised • language=${i18n.language} • enabled=${I18N_ENABLED}`)
}

export default i18n
