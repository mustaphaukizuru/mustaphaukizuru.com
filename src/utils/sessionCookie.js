const crypto = require("crypto")

/**
 * Session cookie helpers (roadmap step 40).
 *
 * The session JWT moved out of localStorage and into an httpOnly cookie so
 * an XSS payload can no longer read it. Because an httpOnly cookie is sent
 * *ambiently* on every same-site request, it needs CSRF protection — so we
 * pair it with a second, deliberately readable cookie (`mu_csrf`) that the
 * SPA echoes back in an `X-CSRF-Token` header. See middleware/csrf.js.
 *
 * Cookie attributes:
 *   httpOnly  mu_session yes / mu_csrf no (the SPA must read the CSRF value)
 *   secure    production only — localhost dev is plain http
 *   sameSite  "lax". Strict would drop the session cookie on the top-level
 *             GET redirect back from Google/Microsoft/Facebook OAuth, which
 *             lands on our own origin. Lax still blocks cross-site POST /
 *             PUT / DELETE, which is the shape every CSRF attack takes, and
 *             the double-submit token covers cross-site GET-initiated
 *             navigations that lax does allow.
 *   path      "/" — the API and the SPA share an origin in production.
 *   maxAge    30 days with rememberMe, otherwise 7 days. Kept in lockstep
 *             with utils/generateToken's JWT `expiresIn` so the cookie never
 *             outlives the token it carries.
 */

const SESSION_COOKIE = "mu_session"
const CSRF_COOKIE = "mu_csrf"

const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000      //  7 days

function isProduction() {
  return process.env.NODE_ENV === "production"
}

function sessionMaxAge(rememberMe) {
  return rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE
}

/** 32 random bytes, hex-encoded — 64 chars, 256 bits of entropy. */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Set the session cookie plus its paired CSRF cookie.
 *
 * Both cookies are always written together and share a maxAge, so a live
 * session can never be left without a usable CSRF token.
 *
 * @param {import("express").Response} res
 * @param {string} token   the session JWT from utils/generateToken
 * @param {{rememberMe?: boolean}} [opts]
 * @returns {string} the CSRF token that was set (useful for tests / callers
 *                   that want to echo it in the response body)
 */
function setSessionCookie(res, token, { rememberMe = false } = {}) {
  const maxAge = sessionMaxAge(rememberMe)
  const secure = isProduction()

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  })

  const csrfToken = generateCsrfToken()
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // the SPA reads this and mirrors it into X-CSRF-Token
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  })

  return csrfToken
}

/** Clear both cookies. Attributes must match the ones used to set them. */
function clearSessionCookie(res) {
  const secure = isProduction()
  const opts = { httpOnly: true, secure, sameSite: "lax", path: "/" }
  res.clearCookie(SESSION_COOKIE, opts)
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false })
}

module.exports = {
  SESSION_COOKIE,
  CSRF_COOKIE,
  REMEMBER_ME_MAX_AGE,
  DEFAULT_MAX_AGE,
  sessionMaxAge,
  generateCsrfToken,
  setSessionCookie,
  clearSessionCookie,
}
