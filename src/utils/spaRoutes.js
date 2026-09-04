/**
 * spaRoutes · static registry of the React SPA's public route patterns.
 *
 * Derived from web/src/App.jsx (<Routes> block). Keep the two in sync: when a
 * route is added to App.jsx, add its pattern here so the Express fallback
 * keeps answering 200 for it. Unknown paths still get index.html (so the SPA
 * renders its ErrorPage) but with a real 404 status for crawlers.
 *
 * Pattern syntax (tiny matcher, no path-to-regexp dependency):
 *   ":param"  → exactly one non-empty segment
 *   "*"       → zero or more trailing segments (must be last)
 */

const PUBLIC_ROUTES = [
  "/",
  "/home",
  "/about",
  "/services",
  "/services/:slug",
  "/self-audit",
  "/contact",
  "/portfolio",
  "/projects/:slug",
  "/store",
  "/store/:slug",
  "/cart",
  "/unsubscribed",
  "/checkout",
  "/checkout/success/:orderId",
  "/checkout/service",
  "/terms",
  "/privacy",
  "/refund",
  "/cookies",
  "/blog",
  "/blog/:slug",
  "/book",
  "/book/:serviceSlug",
  "/_system",
  // Tier 4 · no-login client portal (magic link + PIN)
  "/portal/:token",
  // Auth
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password/:token",
  "/auth/google/return",
  "/auth/microsoft/return",
  "/auth/facebook/return",
]

// Operator surfaces — nested routers; anything under them is the SPA's problem.
const PRIVATE_ROUTES = ["/dashboard", "/dashboard/*", "/admin", "/admin/*"]

// I18N02 · Spanish mirror of the public tree only (admin/dashboard not mirrored).
const ES_ROUTES = PUBLIC_ROUTES
  .filter((p) => !["/home", "/_system"].includes(p))
  .map((p) => (p === "/" ? "/es" : `/es${p}`))

const SPA_ROUTES = [...PUBLIC_ROUTES, ...PRIVATE_ROUTES, ...ES_ROUTES]

function splitPath(p) {
  return String(p || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
}

function matchPattern(pattern, pathname) {
  const pat = splitPath(pattern)
  const segs = splitPath(pathname)
  for (let i = 0; i < pat.length; i++) {
    const p = pat[i]
    if (p === "*") return true
    if (i >= segs.length) return false
    if (p.startsWith(":")) continue
    if (p !== segs[i]) return false
  }
  return pat.length === segs.length
}

/**
 * @param {string} pathname  request path (query/hash tolerated)
 * @returns {boolean} true when the SPA has a real page for this path
 */
function matchesSpaRoute(pathname) {
  let decoded = pathname
  try { decoded = decodeURIComponent(pathname) } catch { /* keep raw */ }
  return SPA_ROUTES.some((pattern) => matchPattern(pattern, decoded))
}

module.exports = { SPA_ROUTES, matchesSpaRoute, matchPattern }
