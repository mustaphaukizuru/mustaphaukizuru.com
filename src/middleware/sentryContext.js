// @ts-check
/**
 * sentryContext.js · attach surface tag + user context to the active scope
 *
 * Mounted on `/api/admin/*` and `/api/v1/admin/*` so every error captured
 * by Sentry is auto-tagged with `surface=admin`. Use `attachUserContext`
 * after `protect` middleware (req.user must exist).
 */

const Sentry = require("../lib/sentry")

function tagAdminSurface(req, _res, next) {
  if (Sentry?.getCurrentScope) {
    // v8+
    Sentry.getCurrentScope().setTag("surface", "admin")
  } else if (Sentry?.configureScope) {
    // v7
    Sentry.configureScope((scope) => scope.setTag("surface", "admin"))
  }
  next()
}

function attachUserContext(req, _res, next) {
  if (!Sentry || !req.user) return next()
  const u = { id: req.user.id, email: req.user.email, role: req.user.role }
  if (Sentry.getCurrentScope) {
    Sentry.getCurrentScope().setUser(u)
  } else if (Sentry.configureScope) {
    Sentry.configureScope((scope) => scope.setUser(u))
  }
  next()
}

module.exports = { tagAdminSurface, attachUserContext }
