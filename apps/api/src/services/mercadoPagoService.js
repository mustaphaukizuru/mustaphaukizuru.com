// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago — Checkout Pro via REST API
// Docs: https://www.mercadopago.com.br/developers/en/docs/checkout-pro
// ─────────────────────────────────────────────────────────────────────────────
const prisma = require("../lib/prisma")

const MP_BASE_URL  = "https://api.mercadopago.com"
const ACCESS_TOKEN = () => process.env.MP_ACCESS_TOKEN || ""
const FRONTEND_URL = () => (
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL   ||
  "http://localhost:5173"
).replace(/\/$/, "") // strip trailing slash

const API_URL = () => (
  process.env.API_URL ||
  process.env.CLIENT_URL?.replace("5173", "5000") ||
  "http://localhost:5000"
).replace(/\/$/, "")

// ── Helpers ───────────────────────────────────────────────────────────────────
function isLocalhost(url) {
  return url.includes("localhost") || url.includes("127.0.0.1")
}

// ── Create a Checkout Pro preference ─────────────────────────────────────────
async function createMercadoPagoPreference({ orderId }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order)          throw new Error("Order not found")
  if (!order.items?.length) throw new Error("Order has no items")

  const token = ACCESS_TOKEN()
  if (!token) throw new Error(
    "Mercado Pago access token not configured. Add MP_ACCESS_TOKEN to .env"
  )

  const frontendBase = FRONTEND_URL()
  const apiBase      = API_URL()
  const isLocal      = isLocalhost(frontendBase)

  // Build items — MP requires unit_price > 0
  const items = order.items.map((item) => {
    const unitPrice = Number(item.unitPrice || item.price || 0)
    return {
      id:          item.productId || item.id || "digital",
      title:       (item.title || item.titleSnapshot || "Digital Product").slice(0, 255),
      description: (item.descriptionSnapshot || "Digital product").slice(0, 255),
      quantity:    Math.max(1, Number(item.quantity)),
      unit_price:  unitPrice > 0 ? unitPrice : 0.01,   // MP requires > 0
      currency_id: (order.currency || "USD").toUpperCase(),
    }
  })

  // back_urls — required even on localhost (MP validates format but won't redirect)
  const back_urls = {
    success: `${frontendBase}/checkout/success/${order.id}?gateway=mercadopago`,
    failure: `${frontendBase}/checkout?error=mp_failed&orderId=${order.id}`,
    pending: `${frontendBase}/checkout/success/${order.id}?gateway=mercadopago&pending=true`,
  }

  const preference = {
    items,
    payer: {
      name:  (order.customerName  || order.billingName  || "").split(" ")[0] || "Customer",
      surname: (order.customerName || "").split(" ").slice(1).join(" ") || "",
      email: order.customerEmail || order.billingEmail || "customer@example.com",
    },
    back_urls,
    // auto_return only works with real public HTTPS URLs — skip on localhost
    ...(isLocal ? {} : { auto_return: "approved" }),
    external_reference: order.id,
    statement_descriptor: "MustaphaUkizuru",
    // notification_url only useful on public server — skip on localhost
    ...(isLocal ? {} : {
      notification_url: `${apiBase}/api/mercadopago/webhook`,
    }),
    metadata: { orderId: order.id },
  }

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method:  "POST",
    headers: {
      Authorization:       `Bearer ${token}`,
      "Content-Type":      "application/json",
      "X-Idempotency-Key": `pref-${order.id}-${Date.now()}`,
    },
    body: JSON.stringify(preference),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercado Pago preference creation failed: ${text}`)
  }

  const data = await res.json()

  // Persist preference ID on order (best-effort)
  await prisma.order.update({
    where: { id: order.id },
    data:  { mercadoPagoPreferenceId: data.id },
  }).catch(() => null)

  return {
    preferenceId: data.id,
    initPoint:    data.init_point,            // production checkout URL
    sandboxPoint: data.sandbox_init_point,    // sandbox URL (for testing)
    isLocal,
  }
}

// ── Get payment details by MP payment ID ─────────────────────────────────────
async function getMercadoPagoPayment(paymentId) {
  const token = ACCESS_TOKEN()
  if (!token || !paymentId) return null
  try {
    const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Mark order based on MP payment status ────────────────────────────────────
async function markOrderPaidByMP({ orderId, paymentId, status }) {
  // MP statuses: approved | pending | in_process | rejected | cancelled | refunded
  const finalStatus =
    status === "approved"                   ? "paid"     :
    status === "pending" || status === "in_process" ? "pending"  :
                                               "failed"

  const updated = await prisma.order.update({
    where: { id: orderId },
    data:  {
      status:  finalStatus,
      paidAt:  finalStatus === "paid" ? new Date() : null,
    },
    include: { items: true },
  })

  // Upsert payment record
  const existing = await prisma.payment.findFirst({
    where: { orderId, paymentGateway: "mercadopago" },
  }).catch(() => null)

  const paymentData = {
    paymentGateway:       "mercadopago",
    gatewayTransactionId: String(paymentId),
    gatewaySessionId:     String(paymentId),
    amount:               updated.totalAmount,
    currency:             (updated.currency || "USD").toUpperCase(),
    paymentStatus:
      finalStatus === "paid"    ? "paid"    :
      finalStatus === "pending" ? "pending" : "failed",
    paidAt:        finalStatus === "paid" ? new Date() : null,
    failureReason: finalStatus === "failed" ? `MP status: ${status}` : null,
  }

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data:  paymentData,
    }).catch(() => null)
  } else {
    await prisma.payment.create({
      data: { ...paymentData, orderId, userId: updated.userId },
    }).catch(() => null)
  }

  return updated
}

module.exports = {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  markOrderPaidByMP,
}
