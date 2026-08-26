/**
 * B11 · Structured logger
 *
 * Drop-in replacement for `console.*` across services and controllers.
 * Same API surface (`info`, `warn`, `error`, `debug`) so existing call sites
 * can be migrated mechanically with a find-and-replace.
 *
 * Transports:
 *   - Console always (pretty in dev, JSON in prod)
 *   - Daily-rotated file at storage/logs/app-YYYY-MM-DD.log (always on)
 *   - Daily-rotated error-only file at storage/logs/error-YYYY-MM-DD.log
 *
 * Retention: 30 days. Files compressed with gzip after rotation.
 *
 * Sentry integration: when an `error` is logged with an Error object as the
 * second argument, it's also captured by Sentry (if SENTRY_DSN is set).
 */

const fs   = require("fs")
const path = require("path")
const winston = require("winston")
const { STORAGE_PATHS } = require("../config/storagePaths")
require("winston-daily-rotate-file")

// ─── Optional Sentry capture ─────────────────────────────────────────────
let Sentry = null
try {
  if (process.env.SENTRY_DSN) {
    Sentry = require("@sentry/node")
  }
} catch {
  /* Sentry not installed — that's OK */
}

// ─── Filesystem prep ─────────────────────────────────────────────────────
const LOG_DIR = STORAGE_PATHS.logs
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
} catch (err) {
  // If we can't create the log dir we log to console only — don't crash boot.
  // eslint-disable-next-line no-console
  console.error("[logger] Could not create log directory:", err.message)
}

// ─── Formatters ──────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === "production"
const logLevel = process.env.LOG_LEVEL || (isProd ? "info" : "debug")

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
)

const jsonFormat = winston.format.combine(
  baseFormat,
  winston.format.json(),
)

const prettyFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaKeys = Object.keys(meta).filter((k) => k !== "service" && k !== "splat")
    const metaStr  = metaKeys.length ? ` ${JSON.stringify(meta)}` : ""
    const stackStr = stack ? `\n${stack}` : ""
    return `${timestamp} ${level} ${message}${metaStr}${stackStr}`
  }),
)

// ─── Transports ──────────────────────────────────────────────────────────
const transports = []

// Console — always on. JSON in prod, pretty in dev.
transports.push(
  new winston.transports.Console({
    level:        logLevel,
    format:       isProd ? jsonFormat : prettyFormat,
    handleExceptions: false,        // server.js handles these
  })
)

// Daily-rotated file — best-effort. If filesystem access fails (read-only
// container, permission issues), winston will warn but not throw.
try {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename:        path.join(LOG_DIR, "app-%DATE%.log"),
      datePattern:     "YYYY-MM-DD",
      zippedArchive:   true,
      maxSize:         "20m",
      maxFiles:        "30d",
      level:           logLevel,
      format:          jsonFormat,
      handleExceptions: false,
    })
  )
  transports.push(
    new winston.transports.DailyRotateFile({
      filename:        path.join(LOG_DIR, "error-%DATE%.log"),
      datePattern:     "YYYY-MM-DD",
      zippedArchive:   true,
      maxSize:         "20m",
      maxFiles:        "30d",
      level:           "error",
      format:          jsonFormat,
      handleExceptions: false,
    })
  )
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("[logger] File transport setup failed:", err.message)
}

// ─── Build logger ────────────────────────────────────────────────────────
const baseLogger = winston.createLogger({
  level:      logLevel,
  format:     jsonFormat,
  defaultMeta: { service: "mustaphaukizuru-api" },
  transports,
  exitOnError: false,
})

/**
 * Public logger surface. Each method matches the console signature so a
 * mechanical find-and-replace from `console.*` to `logger.*` works without
 * argument-shuffling.
 *
 * Sentry side-effect: errors logged with an Error instance as the second
 * argument are also reported to Sentry (if configured).
 */
const logger = {
  debug: (...args) => baseLogger.debug(...args),
  info:  (...args) => baseLogger.info(...args),
  log:   (...args) => baseLogger.info(...args),     // alias for console.log
  warn:  (...args) => baseLogger.warn(...args),
  error: (...args) => {
    baseLogger.error(...args)

    if (!Sentry) return

    // Heuristic: capture if any arg is an Error instance.
    const errArg = args.find((a) => a instanceof Error)
    if (errArg) {
      try { Sentry.captureException(errArg) } catch { /* ignore */ }
    } else if (typeof args[0] === "string") {
      try { Sentry.captureMessage(args[0], "error") } catch { /* ignore */ }
    }
  },

  // Child-logger helper for adding scoped meta to every call (e.g. per-request).
  child: (meta) => baseLogger.child(meta),
}

module.exports = logger
