/**
 * resolveUserLocale.js · I18N05 utility
 *
 * Single source of truth for "which locale should I use?" when a backend
 * controller needs to send a templated email or fetch localized content.
 *
 * Resolution order (first non-empty wins):
 *   1. Explicit `locale` argument          — caller knows best
 *   2. `req.body.locale`                   — frontend passed it
 *   3. `req.query.locale`                  — URL override
 *   4. `req.user?.profile?.locale`         — stored preference (if profile loaded)
 *   5. Referer URL — if it starts with `/es` or contains `/es/`, use "es"
 *   6. `Accept-Language` header — Spanish-prefix → "es"
 *   6b. `user.profile.locale` — webhook fallback when no req scope
 *   7. Fallback: "en"
 *
 * Always returns a valid locale string from the supported set.
 */

const SUPPORTED = ["en", "es"]
const DEFAULT_LOCALE = "en"

function isSupported(value) {
  return typeof value === "string" && SUPPORTED.includes(value.toLowerCase())
}

function pick(value) {
  if (!isSupported(value)) return null
  return String(value).toLowerCase()
}

/**
 * @param {object} [opts]
 * @param {string}      [opts.locale]   Explicit override
 * @param {object}      [opts.req]      Express request — body / query / user / headers consulted
 * @param {object}      [opts.user]     User-shape `{ profile?: { locale } }` for webhook callers
 *                                      that have no req scope but do hold a User row.
 * @returns {"en"|"es"}
 */
function resolveUserLocale({ locale, req, user } = {}) {
  // 1. Explicit
  const explicit = pick(locale)
  if (explicit) return explicit

  if (req && typeof req === "object") {
    // 2. Body
    const body = pick(req.body?.locale)
    if (body) return body

    // 3. Query
    const query = pick(req.query?.locale)
    if (query) return query

    // 4. User profile preference (loaded by some auth middleware variants)
    const profile = pick(req.user?.profile?.locale)
    if (profile) return profile

    // 5. Referer URL — checks the path that initiated the request
    const referer = req.get?.("Referer") || req.headers?.referer || ""
    if (typeof referer === "string") {
      try {
        const url = new URL(referer)
        if (/^\/es(\/|$)/.test(url.pathname)) return "es"
      } catch {
        // Bare path without protocol
        if (/^\/?es(\/|$)/.test(String(referer))) return "es"
      }
    }

    // 6. Accept-Language — first language token starts with "es"
    const accept = req.get?.("Accept-Language") || req.headers?.["accept-language"] || ""
    if (typeof accept === "string" && accept.length > 0) {
      const first = (accept.split(",")[0] || "").trim().toLowerCase()
      if (first.startsWith("es")) return "es"
    }
  }

  // 6b. User-row fallback for webhook callers (no req scope). The caller
  // must have already loaded the User with its profile relation; we never
  // hit the DB here. Useful for payment-webhook side effects so a Spanish
  // customer still receives a Spanish order confirmation even when the
  // webhook fired without an interactive request context.
  if (user && typeof user === "object") {
    const userProfile = pick(user.profile?.locale)
    if (userProfile) return userProfile
  }

  // 7. Default
  return DEFAULT_LOCALE
}

module.exports = { resolveUserLocale, SUPPORTED, DEFAULT_LOCALE }
