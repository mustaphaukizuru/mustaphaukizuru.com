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
const { providerFetch, providerError, isTimeoutError } = require("../lib/providerHttp")

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
  if (!secret) return process.env.NODE_ENV !== "production"   // dev: skip · prod: fail closed
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

/* ───────────────── domestic payment methods (MSI · OXXO · SPEI) ────────── */
//
// Tier 1 §5.2. Mercado Pago Checkout Pro offers card installments, cash
// (OXXO — payment_type_id "ticket") and bank transfer (SPEI —
// payment_type_id "bank_transfer") out of the box; the merchant only has to
// allow them on the preference. MSI ("meses sin intereses") itself is a
// merchant-side dashboard setting — the app just sets the installment
// ceiling. Everything here is env-driven so ops can tune it without a deploy.

const OFFLINE_PAYMENT_TYPES = new Set(["ticket", "bank_transfer"])

function envInt(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
function envNumber(name, fallback) {
  const n = Number(process.env[name])
  return process.env[name] != null && process.env[name] !== "" && Number.isFinite(n) ? n : fallback
}
function envBool(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === "") return fallback
  return !["0", "false", "no", "off"].includes(String(raw).trim().toLowerCase())
}

/**
 * MP wants ISO-8601 with an explicit UTC offset and millisecond precision,
 * e.g. "2026-08-29T10:15:00.000-06:00". Date#toISOString() emits a trailing
 * "Z", which the preference endpoint rejects, so we format by hand using the
 * process's local offset.
 */
function formatMpDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n, w = 2) => String(n).padStart(w, "0")
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/**
 * Build the `payment_methods` block (+ `date_of_expiration`) for a preference.
 *
 *   MP_MAX_INSTALLMENTS     (12)   installment ceiling once the MSI floor is met
 *   MP_DEFAULT_INSTALLMENTS (1)    pre-selected installment count
 *   MP_MSI_MIN_AMOUNT       (1500) below this (order currency) installments = 1
 *   MP_ENABLE_CASH          (true) false → exclude payment type "ticket" (OXXO)
 *   MP_ENABLE_BANK_TRANSFER (true) false → exclude "bank_transfer" (SPEI)
 *   MP_CASH_EXPIRY_HOURS    (72)   voucher lifetime; also the preference expiry
 *
 * Pure — takes `now` so tests can pin the expiry.
 */
function buildPaymentMethodsConfig({ amount, now = new Date() } = {}) {
  const maxInstallments     = envInt("MP_MAX_INSTALLMENTS", 12)
  const defaultInstallments = envInt("MP_DEFAULT_INSTALLMENTS", 1)
  const msiMinAmount        = envNumber("MP_MSI_MIN_AMOUNT", 1500)
  const enableCash          = envBool("MP_ENABLE_CASH", true)
  const enableTransfer      = envBool("MP_ENABLE_BANK_TRANSFER", true)
  const cashExpiryHours     = envNumber("MP_CASH_EXPIRY_HOURS", 72)

  const total        = decimalToNumber(amount)
  const installments = total >= msiMinAmount ? maxInstallments : 1

  const excluded_payment_types = []
  if (!enableCash)     excluded_payment_types.push({ id: "ticket" })
  if (!enableTransfer) excluded_payment_types.push({ id: "bank_transfer" })

  const payment_methods = {
    installments,
    default_installments: Math.min(defaultInstallments, installments),
    excluded_payment_types,
  }

  // Cash / transfer vouchers live until date_of_expiration. Without it MP
  // keeps an OXXO ficha payable for days after cancelStaleOrders has already
  // released the order + coupon, and the late payment would land on a
  // cancelled order. With both offline methods disabled there is nothing to
  // expire, so the preference keeps MP's default lifetime.
  const offlineEnabled = enableCash || enableTransfer
  const expiresAt = new Date(now.getTime() + cashExpiryHours * 60 * 60 * 1000)

  return {
    payment_methods,
    cashExpiryHours,
    expiresAt: offlineEnabled ? expiresAt : null,
    ...(offlineEnabled ? { date_of_expiration: formatMpDate(expiresAt) } : {}),
  }
}

/**
 * Extract what the customer needs to finish an offline (OXXO / SPEI)
 * payment from an MP payment resource. Returns null for card / wallet
 * payments or for anything that is not pending, so callers can use it as
 * "is this a voucher waiting to be paid?".
 */
function describePendingPayment(mpPayment) {
  if (!mpPayment || typeof mpPayment !== "object") return null
  const status = mpPayment.status
  const type   = mpPayment.payment_type_id
  if (!(status === "pending" || status === "in_process")) return null
  if (!OFFLINE_PAYMENT_TYPES.has(type)) return null
  return {
    type,
    methodId:   mpPayment.payment_method_id || null,
    voucherUrl: mpPayment.transaction_details?.external_resource_url || null,
    expiresAt:  mpPayment.date_of_expiration || null,
  }
}

/**
 * Inverse of the Payment-row encoding: the pending-voucher descriptor is
 * persisted as JSON in Payment.failureReason (the only free-form text column
 * on the model; see paymentTransitionService). Returns null for anything
 * that is not that encoding.
 */
function parsePendingPaymentDetails(payment) {
  if (!payment || payment.paymentStatus !== "pending" || !payment.failureReason) return null
  try {
    const parsed = JSON.parse(payment.failureReason)
    if (parsed?.kind !== "offline_pending") return null
    return {
      type:       parsed.type || null,
      methodId:   parsed.methodId || null,
      voucherUrl: parsed.voucherUrl || null,
      expiresAt:  parsed.expiresAt || null,
    }
  } catch {
    return null
  }
}

/* ───────────────────── create Checkout Pro preference ──────────────────── */

const PREFERENCE_TTL_HOURS = Number(process.env.STALE_ORDER_HOURS || 24)

async function createMercadoPagoPreference({ orderId, userId = null, isAdmin = false }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order)               throw new Error("Order not found")
  // Ownership: a member may only start payment for their own order
  // (PayPal's controller enforces the same; this closed an IDOR).
  if (!isAdmin && userId && order.userId && order.userId !== userId) throw new Error("Order not found")
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

  const orderTotal = order.totalAmount != null
    ? decimalToNumber(order.totalAmount)
    : items.reduce((n, i) => n + i.unit_price * i.quantity, 0)
  const { payment_methods, date_of_expiration } = buildPaymentMethodsConfig({ amount: orderTotal })

  const preference = {
    items,
    payment_methods,
    ...(date_of_expiration ? { date_of_expiration } : {}),
    payer: {
      name:    (order.customerName || order.billingName || "").split(" ")[0] || "Customer",
      surname: (order.customerName || "").split(" ").slice(1).join(" ") || "",
      email:   order.customerEmail || order.billingEmail || "customer@example.com",
    },
    back_urls,
    // Expire the preference when the stale-order janitor (jobs/cancelStaleOrders,
    // 24 h) would cancel the order. Without this an OXXO/SPEI voucher stayed
    // payable for ~3 days after the order was already cancelled, and the late
    // "approved" webhook then hit the terminal-state guard: payment recorded,
    // order never fulfilled. MP wants an offset timestamp, not "Z".
    expires: true,
    expiration_date_to: new Date(Date.now() + PREFERENCE_TTL_HOURS * 60 * 60 * 1000).toISOString().replace("Z", "+00:00"),
    ...(isLocal ? {} : { auto_return: "approved" }),
    external_reference:    order.id,
    statement_descriptor:  "MustaphaUkizuru",
    ...(isLocal ? {} : { notification_url: `${apiBase}/api/v1/mercadopago/webhook` }),
    metadata: { orderId: order.id },
  }

  const res = await providerFetch("Mercado Pago", "create preference", `${MP_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${token}`,
      "Content-Type":      "application/json",
      // Deterministic key so duplicate submissions return the existing pref.
      "X-Idempotency-Key": `pref-${order.id}`,
    },
    body: JSON.stringify(preference),
  })

  if (!res.ok) throw providerError("Mercado Pago", "create preference", res.status, await res.text())

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
    const res = await providerFetch("Mercado Pago", "payment lookup", `${MP_BASE_URL}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      logger.warn(`[MP] payment lookup failed ${res.status} for id ${paymentId}`)
      return null
    }
    return res.json()
  } catch (err) {
    // A timeout is not "no such payment": let it propagate so the webhook
    // can answer 500 and Mercado Pago redelivers instead of losing the event.
    if (isTimeoutError(err)) throw err
    logger.error(`[MP] payment lookup error: ${err.message}`)
    return null
  }
}

/* ───────────────────── lookup chargeback by ID ─────────────────────────── */

/**
 * A `chargebacks` notification carries the chargeback id in `data.id`, not
 * the payment id. The chargeback resource names the payment(s) it disputes
 * (`payments: [id]`); the webhook then continues with the normal payment
 * lookup so the authoritative status (`charged_back`) drives the transition.
 */
async function getMercadoPagoChargeback(chargebackId) {
  const token = ACCESS_TOKEN()
  if (!token || !chargebackId) return null
  try {
    const res = await providerFetch("Mercado Pago", "chargeback lookup", `${MP_BASE_URL}/v1/chargebacks/${chargebackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      logger.warn(`[MP] chargeback lookup failed ${res.status} for id ${chargebackId}`)
      return null
    }
    return res.json()
  } catch (err) {
    if (isTimeoutError(err)) throw err
    logger.error(`[MP] chargeback lookup error: ${err.message}`)
    return null
  }
}

/** The payment id a chargeback resource disputes, or null. */
function chargebackPaymentId(chargeback) {
  if (!chargeback) return null
  const id = chargeback.payment_id
    ?? (Array.isArray(chargeback.payments) ? chargeback.payments[0] : null)
  return id == null ? null : String(typeof id === "object" ? id.id : id)
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

  // OXXO / SPEI: the buyer still has to walk to a store or push a transfer.
  // The voucher descriptor rides along so the Payment row can hand it back
  // to the success page and the pending-payment email.
  const pendingDetails = targetStatus === "pending" ? describePendingPayment(payload) : null

  const result = await transitionOrderPayment({
    orderId,
    gatewayTransactionId: paymentId,
    paymentGateway:       "mercadopago",
    targetStatus,
    payload:              payload || null,
    gatewayAmount,
    gatewayCurrency,
    failureReason:        `MP status: ${status}`,
    pendingDetails,
  })
  return { ...result, pendingDetails }
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

  const res = await providerFetch("Mercado Pago", "refund", `${MP_BASE_URL}/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${token}`,
      "Content-Type":      "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw providerError("Mercado Pago", "refund", res.status, await res.text())
  return res.json()
}

module.exports = {
  buildPaymentMethodsConfig,
  describePendingPayment,
  parsePendingPaymentDetails,
  formatMpDate,
  OFFLINE_PAYMENT_TYPES,
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  getMercadoPagoChargeback,
  chargebackPaymentId,
  markOrderPaidByMP,
  refundMercadoPagoPayment,
  verifyMercadoPagoSignature,
}
