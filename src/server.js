/**
 * B11 · server.js
 *
 * Boot order matters:
 *   1. Initialize Sentry FIRST (before any other require) so its global
 *      handlers wrap subsequent module loads.
 *   2. Load env config — this validates JWT_SECRET, CLIENT_URL, etc.
 *   3. Load app — which uses logger and the Sentry request handler.
 *   4. Start listening.
 *   5. Wire process-level error handlers + graceful shutdown.
 *
 * Boot output uses console.* on purpose — it's the operator-facing CLI
 * narration, not application telemetry. Application logs use logger.*
 * everywhere else.
 */

// 1. Sentry first (no-op if SENTRY_DSN is unset).
let Sentry = null
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node")
    Sentry.init({
      dsn:              process.env.SENTRY_DSN,
      environment:      process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      release:          require("../package.json").version,
    })
    // eslint-disable-next-line no-console
    console.log(`🛰️  Sentry initialized · env=${process.env.NODE_ENV || "development"}`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Sentry] init failed:", err.message)
  }
}

// 2-3. Env + app
const app      = require("./app")
const { port } = require("./config/env")
const logger   = require("./utils/logger")

// 4. Listen
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server running on port ${port}`)
  // eslint-disable-next-line no-console
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV || "development"}`)
  // eslint-disable-next-line no-console
  console.log(`📂 Logs: storage/logs/app-YYYY-MM-DD.log`)
  // M14 · start the scheduler after the HTTP server is up so a bad cron
  // registration cannot prevent the API from accepting traffic.
  try {
    require("./jobs/scheduler").startScheduler()
  } catch (err) {
    logger.error("[boot] scheduler failed to start", err)
  }
  if (process.env.SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.log(`🛰️  Error tracking: Sentry`)
  } else {
    // eslint-disable-next-line no-console
    console.log(`🛰️  Error tracking: disabled (set SENTRY_DSN to enable)`)
  }
})

// 5a. Process-level error handlers — log via winston, capture in Sentry,
//     keep the process alive so a single bad async path doesn't crash the
//     whole API.
process.on("unhandledRejection", (reason) => {
  logger.error("[UnhandledRejection]", reason instanceof Error ? reason : new Error(String(reason)))
})

process.on("uncaughtException", (err) => {
  logger.error("[UncaughtException]", err)
  // For uncaught exceptions Node's behavior is undefined past this point —
  // best practice is to drain inflight requests then exit. PM2 (or the
  // shell loop in deploy.sh) will restart us.
  shutdown("uncaughtException", 1)
})

// 5b. Graceful shutdown on SIGTERM/SIGINT — drain inflight HTTP requests
//     for up to 10s before forcing exit. Without this, in-flight downloads
//     would be cut mid-stream during deploys.
function shutdown(signal, code = 0) {
  // eslint-disable-next-line no-console
  console.log(`\n[shutdown] ${signal} received — draining connections...`)
  let exited = false
  const force = setTimeout(() => {
    if (!exited) {
      // eslint-disable-next-line no-console
      console.error("[shutdown] Forced exit after 10s")
      process.exit(code || 1)
    }
  }, 10_000)
  force.unref()

  server.close((err) => {
    exited = true
    if (err) {
      logger.error("[shutdown] server.close failed", err)
      process.exit(code || 1)
    }
    // eslint-disable-next-line no-console
    console.log("[shutdown] Clean exit")
    process.exit(code)
  })
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))
