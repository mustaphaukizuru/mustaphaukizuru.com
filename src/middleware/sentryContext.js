// @ts-check
/**
 * sentryContext.js · attach surface tag + user context to the active scope
 *
 * Mounted on `/api/admin/*` and `/api/v1/admin/*` so every error captured
 * by Sentry is auto-tagged with `surface=admin`. Use `attachUserContext`
 * after `protect` middleware (req.user must exist).
 *
 * @sentry/node v10: the per-request isolation scope is created by Sentry's
 * http auto-instrumentation, so `getCurrentScope()` here is already scoped
 * to the in-flight request. No-op when Sentry is disabled (module is null).
 */

const Sentry = require("../lib/sentry")

function tagAdminSurface(_req, _res, next) {
  if (Sentry?.getCurrentScope) {
    Sentry.getCurrentScope().setTag("surface", "admin")
  }
  next()
}

function attachUserContext(req, _res, next) {
  if (Sentry?.getCurrentScope && req.user) {
    Sentry.getCurrentScope().setUser({ id: req.user.id, email: req.user.email, role: req.user.role })
  }
  next()
}

module.exports = { tagAdminSurface, attachUserContext }
