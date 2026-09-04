/* ──────────────────────────────────────────────────────────────────────────
 *  lib/sentry.js · browser telemetry (@sentry/react)
 *
 *  The API has had @sentry/node since B11; the SPA had nothing, so a render
 *  crash or a failed lazy chunk was invisible unless a visitor wrote in.
 *
 *  · No-op unless VITE_SENTRY_DSN is set at build time (dev / preview stay
 *    silent). The server CSP allows the DSN origin via src/lib/sentryCsp.js.
 *  · release  = version + the build's commit (__APP_COMMIT__, injected by
 *    vite.config.js) so a browser event names the same release a server
 *    event does — T1-9. VITE_APP_VERSION still wins if set.
 *  · Session replay is OFF (0 sample rate, and the integration is not even
 *    loaded — it is the heaviest part of the SDK).
 *  · beforeSend / beforeBreadcrumb scrub emails and tokens: this site
 *    handles customer accounts and we never ship PII to a third party.
 *  · Chunk-load failures (a deploy replaced hashed filenames under an open
 *    tab) are handled by the `vite:preloadError` reload in main.jsx; they
 *    reach Sentry once per session as a warning so we can see how often it
 *    happens, without an "error" alert every time somebody deploys.
 *  ──────────────────────────────────────────────────────────────────────── */
import * as Sentry from "@sentry/react"

const DSN = import.meta.env.VITE_SENTRY_DSN

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// JWTs (three base64url segments), long hex/base64 secrets, and query/body
// style token=… pairs. Kept deliberately broad — a false positive only costs
// a redacted string, a false negative leaks a credential.
const JWT_RE = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
const TOKEN_PAIR_RE = /((?:token|csrf|session|password|secret|api[_-]?key|authorization|bearer)[=:\s"']+)[^\s&"']+/gi
const CHUNK_RE = /(Failed to fetch dynamically imported module|Importing a module script failed|Loading (CSS )?chunk [\w-]+ failed|error loading dynamically imported module)/i

export function scrubText(value) {
  if (typeof value !== "string" || !value) return value
  return value
    .replace(JWT_RE, "[redacted-token]")
    .replace(TOKEN_PAIR_RE, "$1[redacted]")
    .replace(EMAIL_RE, "[redacted-email]")
}

function scrubObject(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return obj
  for (const key of Object.keys(obj)) {
    const v = obj[key]
    if (typeof v === "string") obj[key] = scrubText(v)
    else if (v && typeof v === "object") scrubObject(v, depth + 1)
  }
  return obj
}

export function isChunkLoadError(message) {
  return CHUNK_RE.test(String(message || ""))
}

let chunkReported = false

/** Exported for tests / the ErrorBoundary; safe to call before init. */
export function scrubEvent(event) {
  if (!event) return event
  if (event.message) event.message = scrubText(event.message)
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.message) crumb.message = scrubText(crumb.message)
      if (crumb.data) scrubObject(crumb.data)
    }
  }
  const values = event.exception?.values
  if (Array.isArray(values)) {
    for (const ex of values) if (ex.value) ex.value = scrubText(ex.value)
  }
  if (event.request?.url) event.request.url = scrubText(event.request.url)
  if (event.extra) scrubObject(event.extra)
  if (event.user) {
    // Keep the id (needed to correlate with the API) but never the address.
    delete event.user.email
    delete event.user.ip_address
  }
  return event
}

function beforeSend(event) {
  const firstValue = event.exception?.values?.[0]?.value || event.message || ""
  if (isChunkLoadError(firstValue)) {
    if (chunkReported) return null
    chunkReported = true
    event.level = "warning"
    event.fingerprint = ["chunk-load-failure"]
  }
  return scrubEvent(event)
}

export function initSentry() {
  if (!DSN || typeof window === "undefined") return false

  let release
  try {
    release = import.meta.env.VITE_APP_VERSION || __APP_VERSION__
    if (release && typeof __APP_COMMIT__ === "string" && __APP_COMMIT__) {
      release = `${release}+${__APP_COMMIT__}`
    }
  } catch {
    release = undefined
  }

  Sentry.init({
    dsn: DSN,
    release: release ? `mustaphaukizuru-web@${release}` : undefined,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    ignoreErrors: [
      // Benign browser noise — none of these are actionable.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /^AbortError/,
      "The operation was aborted",
      "Load failed",
      "NetworkError when attempting to fetch resource",
      "Failed to fetch",
      "Network request failed",
      /Non-Error promise rejection captured/,
      // Extensions injecting into the page.
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
    beforeSend,
    beforeBreadcrumb(crumb) {
      if (crumb?.message) crumb.message = scrubText(crumb.message)
      if (crumb?.data) scrubObject(crumb.data)
      return crumb
    },
  })
  return true
}

/** Used by ErrorBoundary — no-op when the SDK was never initialised. */
export function captureException(error, context) {
  if (!DSN) return
  try { Sentry.captureException(error, context) } catch { /* telemetry must never throw */ }
}
