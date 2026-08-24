// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago — Checkout Pro · V2
//
// V2 changes (additive — public function names + return shapes preserved):
//   • Idempotency by gatewayTransactionId — markOrderPaidByMP is now safe
//     against MP's "we'll redeliver this webhook for 24 hours" behaviour.
//   • Webhook signature verification (verifyMercadoPagoSignature) using the
//     `x-signature` + `x-request-id` headers and the secret from MP's
//     dashboard. Skips silently in dev when MP_WEBHOOK_SECRET is unset
//     so local Postman testing keeps working.
//   • Retry-safe HTTP — single getAccessToken() helper isn't needed (MP uses
//     a static access token), but the create-preference call now sets a
//     deterministic Idempotency-Key (`pref-${orderId}`) so two clicks on
//     the checkout button never spawn two preferences.
//   • Cleaner amount handling — Decimal.js values from Prisma are coerced
//     via Number() with a Decimal-aware fallback.
//   • Removed dependency on the legacy `mercadopago` npm package — we never
//     used it. Drop it from package.json.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require("crypto")
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { transitionOrderPayment } = require("./paymentTransitionService")

const MP_BASE_URL  = "https://api.mercadopago.com"
const ACCESS_TOKEN = () => process.env.MP_ACCESS_TOKEN || ""
const WEBHOOK_SECRET = () => process.env.MP_WEBHOOK_SECRET || ""

const FRONTEND_URL = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")

const API_URL = () =>
  (process.env.API_URL || process.env.CLIENT_URL?.replace("5173", "5000") || "http://localhost:5000").replace(/\/$/, "")

/* ────────────────────────────── helpers ────────────────────────────────── */

function isLocalhost(url = "") {
  return url.includes("localhost") || url.includes("127.0.0.1")
}

function decimalToNumber(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  // Prisma Decimal has toNumber() / toString()
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(String(value))
}

/**
 * verifyMercadoPagoSignature
 *
 * MP sends an HMAC-SHA256 signature in the `x-signature` header alongside an
 * `x-request-id`. The signed manifest is:
 *
 *   id:<dataId>;request-id:<xRequestId>;ts:<timestamp>;
 *
 * The `ts` and `v1` (HMAC) values come from the signature header itself.
 *
 * Returns true when:
 *   - WEBHOOK_SECRET is unset (dev — skip), OR
 *   - the recomputed HMAC matches v1 in the header.
 *
 * Returns false on any malformed input or hash mismatch.
 */
function verifyMercadoPagoSignature({ signatureHeader, requestId, dataId }) {
  const secret = WEBHOOK_SECRET()
  if (!secret) return true                         // dev mode
  if (!signatureHeader || !requestId || !dataId) return false

  const parts = String(signatureHeader)
    .split(",")
    .map((p) => p.trim())
    .reduce((acc, p) => {
      const [k, v] = p.split("=")
      if (k && v) acc[k.trim()] = v.trim()
      return acc
    }, {})

  if (!parts.ts || !parts.v1) return false

  // Hardening · timestamp freshness window. MP's `ts` is a Unix-millisecond
  // timestamp baked into the signature. Reject anything older than 5 minutes
  // to prevent indefinite replay of a captured valid webhook. 5min mirrors
  // Stripe's default tolerance and absorbs any reasonable clock skew or
  // network delay between MP and our edge.
  const tsMs = Number(parts.ts)
  const REPLAY_WINDOW_MS = 5 * 60 * 1000
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > REPLAY_WINDOW_MS) {
    logger.warn(`[MP webhook] signature timestamp out of window: ts=${parts.ts}, now=${Date.now()}`)
    return false
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  // timingSafeEqual throws RangeError when the buffers differ in length; the
  // try/catch reduces that to a verification failure.
  try {
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(parts.v1, "utf8")
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/* ───────────────────── create Checkout Pro preference ──────────────────── */

async function createMercadoPagoPreference({ orderId }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order)               throw new Error("Order not found")
  if (!order.items?.length) throw new Error("Order has no items")

  const token = ACCESS_TOKEN()
  if (!token) throw new Error("Mercado Pago access token not configured. Add MP_ACCESS_TOKEN to .env")

  const frontendBase = FRONTEND_URL()
  const apiBase      = API_URL()
  const isLocal      = isLocalhost(frontendBase)

  const items = (order.items || []).map((item) => {
    const unitPrice = decimalToNumber(item.unitPrice ?? item.price ?? 0)
    return {
      id:          item.productId || item.id || "digital",
      title:       (item.title || item.titleSnapshot || "Digital Product").slice(0, 255),
      description: (item.descriptionSnapshot || "Digital product").slice(0, 255),
      quantity:    Math.max(1, Number(item.quantity || 1)),
      unit_price:  unitPrice > 0 ? unitPrice : 0.01,
      currency_id: (order.currency || "MXN").toUpperCase(),
    }
  })

  const back_urls = {
    success: `${frontendBase}/checkout/success/${order.id}?gateway=mercadopago`,
    failure: `${frontendBase}/checkout?error=mp_failed&orderId=${order.id}`,
    pending: `${frontendBase}/checkout/success/${order.id}?gateway=mercadopago&pending=true`,
  }

  const preference = {
    items,
    payer: {
      name:    (order.customerName || order.billingName || "").split(" ")[0] || "Customer",
      surname: (order.customerName || "").split(" ").slice(1).join(" ") || "",
      email:   order.customerEmail || order.billingEmail || "customer@example.com",
    },
    back_urls,
    ...(isLocal ? {} : { auto_return: "approved" }),
    external_reference:    order.id,
    statement_descriptor:  "MustaphaUkizuru",
    ...(isLocal ? {} : { notification_url: `${apiBase}/api/mercadopago/webhook` }),
    metadata: { orderId: order.id },
  }

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${token}`,
      "Content-Type":      "application/json",
      // Deterministic key so duplicate submissions return the existing pref.
      "X-Idempotency-Key": `pref-${order.id}`,
    },
    body: JSON.stringify(preference),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercado Pago preference creation failed: ${text}`)
  }

  const data = await res.json()

  await prisma.order
    .update({ where: { id: order.id }, data: { mercadoPagoPreferenceId: data.id } })
    .catch(() => null)

  return {
    preferenceId: data.id,
    initPoint:    data.init_point,
    sandboxPoint: data.sandbox_init_point,
    isLocal,
  }
}

/* ─────────────────────── lookup payment by ID ──────────────────────────── */

async function getMercadoPagoPayment(paymentId) {
  const token = ACCESS_TOKEN()
  if (!token || !paymentId) return null
  try {
    const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      logger.warn(`[MP] payment lookup failed ${res.status} for id ${paymentId}`)
      return null
    }
    return res.json()
  } catch (err) {
    logger.error(`[MP] payment lookup error: ${err.message}`)
    return null
  }
}

/* ──────────────────── idempotent mark-order-paid ───────────────────────── */

async function markOrderPaidByMP({ orderId, paymentId, status, payload, gatewayAmount, gatewayCurrency }) {
  // MP status enum → local order/payment status. The shared service applies
  // amount validation only for the "paid" target and never regresses a
  // terminal order (paid / completed / refunded / cancelled).
  const targetStatus =
    status === "approved"                               ? "paid"     :
    status === "pending" || status === "in_process"     ? "pending"  :
    status === "refunded" || status === "charged_back"  ? "refunded" :
                                                           "failed"

  return transitionOrderPayment({
    orderId,
    gatewayTransactionId: paymentId,
    paymentGateway:       "mercadopago",
    targetStatus,
    payload:              payload || null,
    gatewayAmount,
    gatewayCurrency,
    failureReason:        `MP status: ${status}`,
  })
}

/* ───────────────────────── refund a payment ────────────────────────────── */

async function refundMercadoPagoPayment({ paymentId, amount, refundId }) {
  const token = ACCESS_TOKEN()
  if (!token || !paymentId) throw new Error("Missing access token or paymentId")

  const body = amount != null ? { amount: Number(amount) } : {}

  // Hardening · deterministic idempotency key. Date.now() varies per call,
  // so two clicks 1 ms apart produced two distinct keys and two refund
  // attempts. We now require the caller to pass the local Refund row id
  // (refundId) — falling back to amount-tagged paymentId for legacy callers.
  // Both forms are stable across retries.
  const idempotencyKey = refundId
    ? `refund-${refundId}`
    : `refund-${paymentId}-${amount != null ? Number(amount).toFixed(2) : "full"}`

  const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${token}`,
      "Content-Type":      "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercado Pago refund failed: ${text}`)
  }
  return res.json()
}

module.exports = {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  markOrderPaidByMP,
  refundMercadoPagoPayment,
  verifyMercadoPagoSignature,
}
