import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { detectLanguageFromPath } from "../utils/detectLanguageFromPath"

/**
 * useLanguage() · I18N02
 *
 * Returns the active language plus a setter that writes both the i18n
 * runtime AND localStorage. Components should NOT call i18n.changeLanguage
 * directly — go through this hook so the persistence layer stays in sync.
 *
 *   const { lang, setLang, isEs } = useLanguage()
 *   if (isEs) <ContactSpanishVariant /> else <ContactEnglishVariant />
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  const location = useLocation()

  // The URL is the source of truth — i18n.language can lag behind during
  // a route change. detectLanguageFromPath always wins.
  const urlLang = detectLanguageFromPath(location.pathname)
  const lang = urlLang || i18n.language || "en"

  // PERF/I18N01 · locale bundles are split per language and loaded on
  // demand, so `changeLanguage` is asynchronous the first time a language is
  // used. setLang returns that promise; callers that navigate afterwards
  // (LanguageSwitcher) must await it so no frame renders raw keys.
  function setLang(next) {
    if (next !== "en" && next !== "es") return Promise.resolve()
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("preferred-language", next) }
      catch { /* storage disabled / private mode */ }
    }
    if (i18n.language !== next) {
      return Promise.resolve(i18n.changeLanguage(next))
    }
    return Promise.resolve()
  }

  return { lang, setLang, isEs: lang === "es", isEn: lang === "en" }
}

export default useLanguage
