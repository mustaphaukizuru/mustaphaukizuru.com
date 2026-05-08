// @ts-check
/**
 * sentry.js · centralised Sentry initialisation
 *
 * Loaded once at boot. If `@sentry/node` isn't installed OR `SENTRY_DSN` is
 * unset, exports `null` so callers degrade silently. The Express handlers
 * are accessed via the returned client (Sentry.Handlers.* on v7,
 * Sentry.setupExpressErrorHandler on v8+).
 *
 * Environment:
 *   SENTRY_DSN                 — required to activate; absence = no-op
 *   SENTRY_ENVIRONMENT         — defaults to NODE_ENV
 *   SENTRY_TRACES_SAMPLE_RATE  — defaults to 0.1 in prod, 1.0 elsewhere
 *   SENTRY_RELEASE             — optional, falls back to package.json version
 */

let Sentry = null

if (process.env.SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node")
    const env = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development"
    const tracesSampleRate = Number(
      process.env.SENTRY_TRACES_SAMPLE_RATE ||
      (env === "production" ? 0.1 : 1.0),
    )
    let release = process.env.SENTRY_RELEASE
    if (!release) {
      try { release = `mustaphaukizuru@${require("../../package.json").version}` }
      catch { release = undefined }
    }

    Sentry.init({
      dsn:              process.env.SENTRY_DSN,
      environment:      env,
      release,
      tracesSampleRate,
      // Filter health-check noise — these get hit hundreds of times an hour.
      beforeSendTransaction(event) {
        const url = event?.request?.url || ""
        if (url.includes("/api/health") || url.includes("/sitemap.xml")) return null
        return event
      },
      // Strip auth header before sending to Sentry — never leak JWTs.
      beforeSend(event) {
        if (event?.request?.headers) {
          delete event.request.headers.authorization
          delete event.request.headers.cookie
        }
        return event
      },
    })
    console.log(`[sentry] initialised · env=${env} · tracesSampleRate=${tracesSampleRate}`)
  } catch (err) {
    // Package not installed or init failed — degrade silently.
    console.warn("[sentry] init skipped:", err && err.message)
    Sentry = null
  }
}

module.exports = Sentry
