import { Navigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"
import { localizeTo, normaliseLang } from "../i18n/utils/localizeTo"

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute — blocks unauthenticated access
// Shows branded spinner during auth hydration (no flicker thanks to eager init)
// Redirects to the reader's own /login with the return path in location.state
//
// D3-3 · both of those were English-only. The target was the literal string
// "/login", so a Spanish member whose session had expired on /es/dashboard
// was bounced to the ENGLISH sign-in page — and, because the language is
// read off the URL prefix, signed back in to an English site. The spinner
// label was a bare "Verifying session…" on the one screen that renders
// before any page does.
// ─────────────────────────────────────────────────────────────────────────────
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  const { t, i18n } = useTranslation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-4 border-violet-pale" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-violet" />
          </div>
          <span className="text-micro font-medium text-charcoal-80/65">{t("auth.verifyingSession")}</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={localizeTo("/login", normaliseLang(i18n?.language))}
        state={{ from: location.pathname + location.search }}
        replace
      />
    )
  }

  return children
}
