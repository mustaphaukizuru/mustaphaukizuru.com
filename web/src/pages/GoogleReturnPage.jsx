import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, AlertOctagon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"

/* ──────────────────────────────────────────────────────────────────────────
 * GoogleReturnPage · OAuth redirect-flow landing
 * ────────────────────────────────────────────────────────────────────────
 * The backend's /api/auth/google/callback redirects here with the new
 * session token + user JSON in the URL FRAGMENT (the `#...` part). We use
 * a fragment, not a query string, because fragments aren't sent in the
 * HTTP request line — the token never appears in web-server access logs,
 * proxy logs, or Referer headers when the next page loads.
 *
 * Lifecycle:
 *   1. On mount, parse window.location.hash for `token`, `user`, `return_to`
 *   2. If valid → loginWithGoogle(...) writes the AuthContext + localStorage
 *   3. history.replaceState() to scrub the fragment from browser history
 *   4. navigate(return_to || /dashboard) replace:true so back-button doesn't
 *      return to this landing page
 *
 * If anything's missing or malformed → soft fail to /login with the
 * standard `?google=exchange_failed` reason so the SPA's existing error
 * surface picks it up. No partial sessions.
 *
 * Visual treatment is intentionally minimal — most users see this page
 * for under 200ms. A short "Signing you in…" spinner is enough; a heavier
 * layout would just feel like a flash of unstyled content.
 * ──────────────────────────────────────────────────────────────────── */

export default function GoogleReturnPage() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuth()
  const { t } = useTranslation("auth")
  const [error, setError] = useState(null)

  useEffect(() => {
    function consume() {
      try {
        const hash = (typeof window !== "undefined" && window.location.hash) || ""
        if (!hash || hash.length < 2) throw new Error("missing hash")

        // window.location.hash includes the leading '#'. Strip it before
        // parsing so URLSearchParams sees `token=...&user=...` cleanly.
        const params = new URLSearchParams(hash.slice(1))
        const token = params.get("token")
        const userRaw = params.get("user")
        const returnTo = params.get("return_to") || "/dashboard"

        if (!token || !userRaw) throw new Error("missing token or user in fragment")

        const user = JSON.parse(decodeURIComponent(userRaw))
        if (!user || typeof user !== "object" || !user.id || !user.email) {
          throw new Error("malformed user payload")
        }

        // Persist via the standard Google login path — same shape, same
        // storage, same downstream consumers as the legacy One-Tap flow.
        loginWithGoogle({ token, user })

        // Scrub the fragment from history so the token isn't preserved if
        // the user hits "back" or shares the URL. replaceState is preferred
        // over pushState — we don't want a stale entry pointing at this
        // page in their session history.
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname)
        }

        // Safe-path filter — same defence the backend applies; layered.
        const safeReturn = (typeof returnTo === "string"
          && returnTo.startsWith("/")
          && !returnTo.includes("//")
          && !returnTo.includes(":"))
          ? returnTo
          : "/dashboard"

        // For admin users, prefer the admin landing unless an explicit
        // return_to was passed. Matches the redirect logic the legacy
        // GoogleLoginButton used.
        const dest = safeReturn === "/dashboard" && user.role === "admin"
          ? "/admin"
          : safeReturn

        navigate(dest, { replace: true })
      } catch (err) {
        setError(err?.message || "unknown")
        // Bounce to /login with the same error code the backend uses on
        // server-side failures. The LoginPage surfaces a calm message.
        setTimeout(() => navigate("/login?google=exchange_failed", { replace: true }), 600)
      }
    }
    consume()
    // Intentional empty deps — consume should fire exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose/10 text-rose">
            <AlertOctagon className="h-5 w-5" />
          </span>
          <p className="text-[14px] text-charcoal-80/75">
            {t("oauthReturn.failed")}
          </p>
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet" />
          <p className="text-[14px] text-charcoal-80/75">{t("oauthReturn.signingIn")}</p>
        </div>
      )}
    </div>
  )
}
