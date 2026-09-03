// ─────────────────────────────────────────────────────────────────────────────
// PayPal — Orders v2 + Webhooks · V2
//
// V2 changes:
//   • Webhook signature verification via /v1/notifications/verify-webhook-signature
//     (PayPal's own endpoint — no shared secret needed; uses the cert chain).
//   • Idempotent capture — capturePaypalOrder now refuses to capture an order
//     that's already in COMPLETED state and instead returns the existing
//     capture data, so a double-click on the front-end never charges twice.
//   • Refund support — refundPaypalCapture(captureId, { amount, currency, note, refundId }).
//   • Token cache — getAccessToken() caches the bearer token for ~9 minutes
//     instead of re-fetching on every call.
//   • Cleaner error messages — failures bubble up as Error("PayPal: <reason>")
//     so the global errorHandler emits a tidy message.
// ─────────────────────────────────────────────────────────────────────────────

const logger = require("../utils/logger")

const PAYPAL_BASE_URL      = () => process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"
const PAYPAL_CLIENT_ID     = () => process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = () => process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_WEBHOOK_ID    = () => process.env.PAYPAL_WEBHOOK_ID

/* ─────────────────── access token (with 9-minute cache) ────────────────── */

let _tokenCache = { token: null, expiresAt: 0 }

async function getAccessToken({ force = false } = {}) {
  if (!force && _tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const id = PAYPAL_CLIENT_ID()
  const secret = PAYPAL_CLIENT_SECRET()
  if (!id || !secret) throw new Error("PayPal: missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET")

  const auth = Buffer.from(`${id}:${secret}`).toString("base64")
  const res = await fetch(`${PAYPAL_BASE_URL()}/v1/oauth2/token`, {
    method:  "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    "grant_type=client_credentials",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal: access token failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  _tokenCache = {
    token:     data.access_token,
    // Subtract 60 s safety margin from the expires_in window.
    expiresAt: Date.now() + Math.max(0, (data.expires_in - 60) * 1000),
  }
  return _tokenCache.token
}

async function authedFetch(path, options = {}, { retried = false } = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE_URL()}${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })
  // If our cached token expired between cache-hit and use, refresh once.
  if (res.status === 401 && !retried) {
    _tokenCache = { token: null, expiresAt: 0 }
    return authedFetch(path, options, { retried: true })
  }
  return res
}

/* ───────────────────────── create order ────────────────────────────────── */

async function createPaypalOrder({ orderId, orderNumber, totalAmount, currency = "MXN", returnUrl, cancelUrl }) {
  const body = {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: orderId,
      invoice_id:   orderNumber,
      custom_id:    orderId,
      amount: {
        currency_code: currency,
        value:         Number(totalAmount).toFixed(2),
      },
    }],
    application_context: {
      shipping_preference: "NO_SHIPPING",
      user_action:         "PAY_NOW",
      brand_name:          "Mustapha Ukizuru",
      ...(returnUrl ? { return_url: returnUrl } : {}),
      ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
    },
  }

  const res = await authedFetch("/v2/checkout/orders", {
    method:  "POST",
    headers: { "PayPal-Request-Id": `order-${orderId}` },     // idempotency
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal: create order failed (${res.status}): ${text}`)
  }
  return res.json()
}

/* ───────────────────────── capture (idempotent) ────────────────────────── */

async function capturePaypalOrder(paypalOrderId) {
  if (!paypalOrderId) throw new Error("PayPal: paypalOrderId required")

  // Pre-flight: if it's already captured, return the existing record instead
  // of POSTing /capture again (which 422s with ORDER_ALREADY_CAPTURED).
  const lookup = await authedFetch(`/v2/checkout/orders/${paypalOrderId}`, { method: "GET" })
  if (lookup.ok) {
    const data = await lookup.json()
    if (data?.status === "COMPLETED") {
      return { ...data, _idempotent: true }
    }
  }

  const res = await authedFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method:  "POST",
    headers: { "PayPal-Request-Id": `cap-${paypalOrderId}` },
    body:    JSON.stringify({}),
  })
  if (!res.ok) {
    const text = await res.text()
    // ORDER_ALREADY_CAPTURED on the capture endpoint isn't fatal — re-fetch.
    if (text.includes("ORDER_ALREADY_CAPTURED")) {
      const fallback = await authedFetch(`/v2/checkout/orders/${paypalOrderId}`, { method: "GET" })
      if (fallback.ok) return { ...(await fallback.json()), _idempotent: true }
    }
    throw new Error(`PayPal: capture failed (${res.status}): ${text}`)
  }
  return res.json()
}

/* ─────────────────────── refund a capture ──────────────────────────────── */

async function refundPaypalCapture(captureId, { amount, currency = "MXN", note, refundId } = {}) {
  if (!captureId) throw new Error("PayPal: captureId required")

  const body = {}
  if (amount != null) body.amount = { value: Number(amount).toFixed(2), currency_code: currency }
  if (note)           body.note_to_payer = note.slice(0, 255)

  // Idempotency · PayPal dedupes on PayPal-Request-Id. The key used to end
  // in Date.now(), so a retry after a timeout, or a second click, was a
  // second refund request with a fresh key. It is now the local Refund row
  // id, which refundService creates BEFORE calling here — stable across
  // retries, unique per refund attempt. The amount-tagged fallback keeps
  // any legacy caller deterministic too.
  const requestId = refundId
    ? `refund-${refundId}`
    : `refund-${captureId}-${amount != null ? Number(amount).toFixed(2) : "full"}`

  const res = await authedFetch(`/v2/payments/captures/${captureId}/refund`, {
    method:  "POST",
    headers: { "PayPal-Request-Id": requestId },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal: refund failed (${res.status}): ${text}`)
  }
  return res.json()
}

/* ──────────────── verify webhook signature ─────────────────────────────── */

/**
 * verifyPaypalWebhookSignature
 *
 * Posts the inbound headers + body to PayPal's verify endpoint. PayPal returns
 * `verification_status: "SUCCESS" | "FAILURE"`.
 *
 * Returns `true` when:
 *   - PAYPAL_WEBHOOK_ID is unset (dev — skip), OR
 *   - the verify endpoint returns SUCCESS.
 *
 * @param {object} input
 * @param {object} input.headers   The request headers (Express req.headers)
 * @param {object|string} input.body  The request body (Buffer | string | parsed object)
 *
 * IMPORTANT: To verify correctly, we need the EXACT raw JSON string that
 * PayPal POSTed to us — not a pretty-printed version. Mount the webhook
 * route with an express.raw({ type: "application/json" }) middleware so
 * `req.body` is a Buffer, then JSON.parse(body.toString()) for processing,
 * but pass the raw Buffer to this verifier.
 */
async function verifyPaypalWebhookSignature({ headers, body }) {
  const webhookId = PAYPAL_WEBHOOK_ID()
  if (!webhookId) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed: an unverified "approved" event would mark orders paid.
      logger.error("[PayPal webhook] PAYPAL_WEBHOOK_ID not set in production — rejecting webhook")
      return false
    }
    logger.warn("[PayPal webhook] PAYPAL_WEBHOOK_ID not set — skipping signature verification (dev mode)")
    return true
  }

  let webhookEvent = body
  if (Buffer.isBuffer(body))    webhookEvent = JSON.parse(body.toString("utf8"))
  if (typeof body === "string") webhookEvent = JSON.parse(body)

  const verifyBody = {
    auth_algo:         headers["paypal-auth-algo"],
    cert_url:          headers["paypal-cert-url"],
    transmission_id:   headers["paypal-transmission-id"],
    transmission_sig:  headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id:        webhookId,
    webhook_event:     webhookEvent,
  }

  const res = await authedFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body:   JSON.stringify(verifyBody),
  })
  if (!res.ok) {
    logger.warn(`[PayPal webhook] verify endpoint returned ${res.status}`)
    return false
  }
  const data = await res.json()
  return data?.verification_status === "SUCCESS"
}

module.exports = {
  createPaypalOrder,
  capturePaypalOrder,
  refundPaypalCapture,
  verifyPaypalWebhookSignature,
  // exported for testing
  getAccessToken,
}
