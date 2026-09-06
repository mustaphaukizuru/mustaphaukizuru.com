/**
 * Portal cookie helpers (Tier 4 · magic-link + PIN portal).
 *
 * Mirrors utils/sessionCookie.js but for a DIFFERENT cookie: `mu_portal`
 * carries a read-only, project-scoped JWT ({ scope: "portal", projectId,
 * userId }) that middleware/portalAuth.js accepts and authMiddleware never
 * does (it has a `scope`, so isSessionToken() rejects it). Keeping the two
 * cookies separate means a portal visitor never becomes a "logged-in" member
 * and a member session never unlocks a portal token it did not verify.
 *
 * CSRF: this cookie now carries a `mu_csrf` pair, exactly as `mu_session`
 * does. It did not need one while every portal endpoint was a GET — the
 * original note here said so — and that stopped being true the moment T5-3
 * added `POST /portal/me/file-requests/:id/files`. An ambient httpOnly
 * credential plus a state-changing route is the definition of a CSRF target,
 * so the pair and the first write ship together, never apart.
 */

const { CSRF_COOKIE, generateCsrfToken } = require("./sessionCookie")

const PORTAL_COOKIE = "mu_portal"
const PORTAL_MAX_AGE = 2 * 60 * 60 * 1000 // 2 hours — same as the JWT expiresIn

function isProduction() {
  return process.env.NODE_ENV === "production"
}

/**
 * Set the portal cookie AND its readable CSRF pair.
 *
 * Same shape as setSessionCookie: httpOnly for the credential, readable for
 * the token the SPA mirrors into X-CSRF-Token. web/src/lib/api.js already
 * does that mirroring for every write, so the portal client needs no change.
 *
 * @returns {string} the CSRF token, for callers that want to echo it
 */
function setPortalCookie(res, token) {
  const secure = isProduction()
  res.cookie(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_MAX_AGE,
  })

  const csrfToken = generateCsrfToken()
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_MAX_AGE,
  })
  return csrfToken
}

function clearPortalCookie(res) {
  const opts = { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/" }
  res.clearCookie(PORTAL_COOKIE, opts)
  // The CSRF pair goes with it. Leaving a readable token behind after the
  // credential is gone is harmless but confusing, and it makes "am I in a
  // portal session?" ambiguous for the client.
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false })
}

module.exports = { PORTAL_COOKIE, PORTAL_MAX_AGE, setPortalCookie, clearPortalCookie }
