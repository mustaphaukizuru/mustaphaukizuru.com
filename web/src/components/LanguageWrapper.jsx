import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { detectLanguageFromPath } from "../i18n/utils/detectLanguageFromPath"

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

  useEffect(() => {
    const next = detectLanguageFromPath(location.pathname)
    if (i18n.language !== next) {
      i18n.changeLanguage(next)
    }
  }, [location.pathname, i18n])

  // First-visit auto-redirect: if the user lands on root with a Spanish
  // browser preference AND no localStorage override exists, send them to
  // /es. We only do this once per session.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (location.pathname !== "/") return
    try {
      const stored = window.localStorage.getItem("preferred-language")
      if (stored) return
      if (window.sessionStorage.getItem("ukz:lang-redirected") === "1") return
      const browser = (window.navigator?.language || "").toLowerCase()
      if (browser.startsWith("es")) {
        window.sessionStorage.setItem("ukz:lang-redirected", "1")
        window.location.replace("/es")
      }
    } catch { /* storage unavailable */ }
  }, [location.pathname])

  if (children) return children
  return <Outlet />
}
