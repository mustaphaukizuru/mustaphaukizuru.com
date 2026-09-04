import { useEffect } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { detectLanguageFromPath } from "../i18n/utils/detectLanguageFromPath"
import { hasLanguageChoice } from "../i18n/utils/languageChoice"

/**
 * LanguageWrapper · I18N01
 *
 * Mounted at the App root inside <BrowserRouter>. Watches the current URL
 * and pushes the matching language into i18next on every route change so
 * the entire React subtree always renders in the URL's language. Renders
 * <Outlet /> when used as a layout route, or <children /> when wrapped
 * around a tree directly.
 *
 *   <LanguageWrapper>
 *     <App />
 *   </LanguageWrapper>
 *
 *   // OR as a layout route in App.jsx:
 *   <Route element={<LanguageWrapper />}>
 *     <Route path="/" ... />
 *     <Route path="/es/*" ... />
 *   </Route>
 */
export default function LanguageWrapper({ children }) {
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const next = detectLanguageFromPath(location.pathname)
    if (i18n.language !== next) {
      i18n.changeLanguage(next)
    }
  }, [location.pathname, i18n])

  // First-visit auto-redirect (Spanish-first): if the user lands on root
  // with a browser whose first language is NOT English AND no localStorage
  // override exists, send them to /es. Unprefixed URLs always render
  // English (see detectLanguageFromPath), so this redirect is the only way
  // an ambiguous visitor reaches Spanish. Once per session.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (location.pathname !== "/") return
    try {
      // hasLanguageChoice(), not "preferred-language": i18next's detector
      // caches into that key during init, so it is always set by the time
      // this effect runs and this guard used to return every single time.
      if (hasLanguageChoice()) return
      if (window.sessionStorage.getItem("ukz:lang-redirected") === "1") return
      const browser = (window.navigator?.language || "").toLowerCase()
      if (!browser.startsWith("en")) {
        window.sessionStorage.setItem("ukz:lang-redirected", "1")
        // navigate, not window.location.replace: a full document load threw
        // away the query string and the hash, so a Spanish-browser visitor
        // arriving on /?utm_source=newsletter landed on a bare /es and the
        // campaign attribution was gone. It also reloaded the whole bundle
        // to reach a route the router already had.
        navigate(`/es${location.search}${location.hash}`, { replace: true })
      }
    } catch { /* storage unavailable */ }
    // search/hash are read inside the guard, which only fires on "/" — they
    // are not triggers, and listing them would re-run the redirect on every
    // query change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate])

  if (children) return children
  return <Outlet />
}
