const crypto = require("crypto")
const { SESSION_COOKIE, CSRF_COOKIE } = require("../utils/sessionCookie")
const { PORTAL_COOKIE } = require("../utils/portalCookie")

/**
 * CSRF protection · double-submit cookie (roadmap step 40).
 *
 * ── The threat ────────────────────────────────────────────────────────────
 * The session JWT now lives in an httpOnly cookie, which the browser attaches
 * to requests it makes on our origin *whether or not our code initiated them*.
 * That ambient authority is what CSRF exploits. Bearer tokens never had the
 * problem because the attacker's page cannot make our JS set the header.
 *
 * ── The defence ───────────────────────────────────────────────────────────
 * At login we set a second cookie, `mu_csrf`, that is deliberately NOT
 * httpOnly. Same-origin JS (ours) can read it; cross-origin JS (the
 * attacker's) cannot, because the same-origin policy stops it reading our
 * cookies even though the browser would happily *send* them. So requiring
 * `X-CSRF-Token` to equal the `mu_csrf` cookie proves the request was made by
 * code running on our origin.
 *
 * ── When it is enforced ───────────────────────────────────────────────────
 *   • Only on state-changing methods (POST / PUT / PATCH / DELETE).
 *   • Only when a `mu_session` cookie is present — i.e. only when there IS
 *     ambient authority to abuse. A pure Bearer-token client (mobile app,
 *     curl, the pre-migration SPA build) sends no session cookie and is
 *     exempt, which is correct: no ambient credential, no CSRF risk.
 *
 *     Note the check is "is a session cookie present", NOT "did the request
 *     also send an Authorization header". authMiddleware prefers the cookie
 *     over the header, so exempting anything that merely carries a Bearer
 *     header would let an attacker append a junk `Authorization` value to a
 *     forged request and skip the check while still authenticating via the
 *     victim's cookie. Cookie present ⇒ enforce, unconditionally.
 *
 * ── Exemptions ────────────────────────────────────────────────────────────
 *   • Payment webhooks (`/api/[v1/]paypal/webhook`, `/api/[v1/]mercadopago/webhook`).
 *     These are server-to-server calls from PayPal / Mercado Pago that carry
 *     no cookies and verify their own signatures. PayPal's is additionally
 *     mounted at the app level ahead of this middleware (it needs the raw
 *     body), so it never reaches here — the pattern is kept anyway so the
 *     exemption survives any future re-ordering.
 *   • Pre-session auth endpoints (login, signup, password reset, 2FA
 *     login-verify, One-Tap, logout). These do not act on an existing
 *     session — they create, replace, or destroy one. Enforcing the token
 *     there would lock a user out of signing back in if their readable
 *     `mu_csrf` cookie were ever lost while a stale `mu_session` lingered
 *     (partial cookie clear, extension, storage partitioning). The worst an
 *     attacker gains is login/logout CSRF, which cannot read or alter any of
 *     the victim's data; a stolen-cookie-driven write is what we actually
 *     care about, and every one of those routes stays protected.
 *   • Anything mounted before this middleware in src/app.js (static assets,
 *     the raw-body PayPal webhook).
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// /api/paypal/webhook, /api/v1/paypal/webhook, /api/mercadopago/webhook, …
// Anchored to the webhook path itself — never a sub-path — so a router
// mounted under ".../webhook" cannot accidentally exempt admin routes.
const WEBHOOK_PATH_RE = /^\/api\/(?:v\d+\/)?(?:paypal|mercadopago)\/webhook\/?$/i

// Pre-session auth endpoints — see the "Exemptions" note above.
const PRE_SESSION_AUTH_RE =
  /^\/api\/(?:v\d+\/)?auth\/(?:login|signup|logout|google|forgot-password|reset-password(?:\/|$)|2fa\/login-verify)/i

function pathOf(req) {
  return String(req.originalUrl || req.url || "").split("?")[0]
}

function isExemptPath(req) {
  const path = pathOf(req)
  return WEBHOOK_PATH_RE.test(path) || PRE_SESSION_AUTH_RE.test(path)
}

/** Constant-time compare that never throws on odd input. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8")
  const bufB = Buffer.from(String(b || ""), "utf8")
  if (bufA.length === 0 || bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  // No ambient credential → nothing for a forged request to ride on.
  //
  // BOTH cookies count. `mu_portal` is every bit as ambient as `mu_session`:
  // httpOnly, sameSite=lax, sent by the browser on a cross-site form POST.
  // While every portal route was a GET this guard never needed to know about
  // it; T5-3 adds the portal's first write, and a state-changing route behind
  // an ambient credential with no CSRF check is the whole attack.
  const hasSession = Boolean(req.cookies?.[SESSION_COOKIE])
  const hasPortal = Boolean(req.cookies?.[PORTAL_COOKIE])
  if (!hasSession && !hasPortal) return next()

  if (isExemptPath(req)) return next()

  const cookieToken = req.cookies?.[CSRF_COOKIE]
  const headerToken = req.get("X-CSRF-Token")

  if (!cookieToken || !headerToken || !safeEqual(headerToken, cookieToken)) {
    return res.status(403).json({
      success: false,
      code: "CSRF_INVALID",
      message: "Invalid or missing CSRF token. Refresh the page and try again.",
    })
  }

  return next()
}

module.exports = { csrfProtection, WEBHOOK_PATH_RE, PRE_SESSION_AUTH_RE }
