// @ts-check
/**
 * sentryCsp.js · derive the Sentry ingest origin(s) for the CSP connect-src.
 *
 * The browser SDK (web/src/lib/sentry.js) POSTs envelopes to the DSN host,
 * e.g. https://o123.ingest.us.sentry.io/api/456/envelope/. Helmet's CSP
 * would block that unless the origin is listed in connect-src, so app.js
 * appends whatever this returns. Both the server DSN (SENTRY_DSN) and the
 * SPA DSN (VITE_SENTRY_DSN, which the deploy passes to `vite build`) are
 * considered; malformed or empty values are ignored so a typo can never
 * break the CSP for every other host.
 */

/**
 * @param {string | undefined | null} dsn
 * @returns {string | null} origin such as "https://o123.ingest.sentry.io"
 */
function sentryOriginFromDsn(dsn) {
  if (typeof dsn !== "string") return null
  const trimmed = dsn.trim()
  if (!trimmed) return null
  let url
  try { url = new URL(trimmed) } catch { return null }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!url.hostname) return null
  return url.origin
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]} unique origins, in a stable order (may be empty)
 */
function sentryConnectSrc(env = process.env) {
  const out = []
  for (const key of ["SENTRY_DSN", "VITE_SENTRY_DSN"]) {
    const origin = sentryOriginFromDsn(env[key])
    if (origin && !out.includes(origin)) out.push(origin)
  }
  return out
}

module.exports = { sentryOriginFromDsn, sentryConnectSrc }
