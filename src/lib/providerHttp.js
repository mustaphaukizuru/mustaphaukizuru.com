/**
 * providerHttp · how we talk to the payment gateways, in one place.
 *
 *   - every call carries an AbortSignal timeout (PROVIDER_TIMEOUT_MS,
 *     default 10 s). A gateway that never answered used to hold the request
 *     — and under Passenger, the worker — open indefinitely.
 *   - a timeout is its own machine-readable error (502 GATEWAY_TIMEOUT), so
 *     callers can decide: the Mercado Pago webhook answers 500 so MP
 *     redelivers; an admin refund answers 502 and stops.
 *   - a non-2xx answer becomes a 502 AppError whose message names the
 *     provider and the action — never the response body. The body is logged
 *     server-side only: it carries account and request ids, and the token
 *     call can echo our own credentials back.
 */
const logger   = require("../utils/logger")
const AppError = require("../utils/AppError")

const DEFAULT_TIMEOUT_MS = 10_000

function providerTimeoutMs() {
  const n = Number(process.env.PROVIDER_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

function isTimeoutError(err) {
  return err?.name === "TimeoutError" || err?.name === "AbortError" || err?.code === "GATEWAY_TIMEOUT"
}

function providerTimeout(provider, action) {
  return new AppError(
    `${provider} did not answer the ${action} request within ${providerTimeoutMs()} ms`,
    { statusCode: 502, code: "GATEWAY_TIMEOUT", details: { provider, action } },
  )
}

function providerError(provider, action, status, body) {
  logger.error(`[${provider}] ${action} failed (${status}): ${String(body || "").slice(0, 2000)}`)
  return new AppError(
    `${provider} rejected the ${action} request (HTTP ${status})`,
    { statusCode: 502, code: "GATEWAY_ERROR", details: { provider, action, status } },
  )
}

/** fetch() with the provider timeout; a timeout surfaces as providerTimeout. */
async function providerFetch(provider, action, url, init = {}) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(providerTimeoutMs()) })
  } catch (err) {
    if (isTimeoutError(err)) {
      logger.error(`[${provider}] ${action} timed out after ${providerTimeoutMs()} ms`)
      throw providerTimeout(provider, action)
    }
    throw err
  }
}

module.exports = { providerFetch, providerError, providerTimeout, isTimeoutError, providerTimeoutMs, DEFAULT_TIMEOUT_MS }
