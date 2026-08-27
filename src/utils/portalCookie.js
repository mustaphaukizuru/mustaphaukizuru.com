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
 * No CSRF pair: every portal endpoint behind the cookie is a GET.
 */

const PORTAL_COOKIE = "mu_portal"
const PORTAL_MAX_AGE = 2 * 60 * 60 * 1000 // 2 hours — same as the JWT expiresIn

function isProduction() {
  return process.env.NODE_ENV === "production"
}

function setPortalCookie(res, token) {
  res.cookie(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_MAX_AGE,
  })
}

function clearPortalCookie(res) {
  res.clearCookie(PORTAL_COOKIE, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/" })
}

module.exports = { PORTAL_COOKIE, PORTAL_MAX_AGE, setPortalCookie, clearPortalCookie }
