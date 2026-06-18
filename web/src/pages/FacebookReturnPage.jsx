import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, AlertOctagon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"

/**
 * FacebookReturnPage · OAuth redirect-flow landing
 * Identical lifecycle to GoogleReturnPage — the backend redirects here with
 * token + user in the URL fragment after /api/auth/facebook/callback.
 */
export default function FacebookReturnPage() {
  const navigate = useNavigate()
  const { loginWithGoogle: loginWithOAuth } = useAuth() // provider-agnostic
  const { t } = useTranslation("auth")
  const [error, setError] = useState(null)

  useEffect(() => {
    function consume() {
      try {
        const hash = (typeof window !== "undefined" && window.location.hash) || ""
        if (!hash || hash.length < 2) throw new Error("missing hash")

        const params   = new URLSearchParams(hash.slice(1))
        const token    = params.get("token")
        const userRaw  = params.get("user")
        const returnTo = params.get("return_to") || "/dashboard"

        if (!token || !userRaw) throw new Error("missing token or user in fragment")

        const user = JSON.parse(decodeURIComponent(userRaw))
        if (!user || typeof user !== "object" || !user.id || !user.email) {
          throw new Error("malformed user payload")
        }

        loginWithOAuth({ token, user })

        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname)
        }

        const safeReturn = (typeof returnTo === "string"
          && returnTo.startsWith("/")
          && !returnTo.includes("//")
          && !returnTo.includes(":"))
          ? returnTo
          : "/dashboard"

        const dest = safeReturn === "/dashboard" && user.role === "admin"
          ? "/admin"
          : safeReturn

        navigate(dest, { replace: true })
      } catch {
        setError(true)
        setTimeout(() => navigate("/login?facebook=exchange_failed", { replace: true }), 600)
      }
    }
    consume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose/10 text-rose">
            <AlertOctagon className="h-5 w-5" />
          </span>
          <p className="text-[14px] text-charcoal-80/75">{t("oauthReturn.failed")}</p>
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
