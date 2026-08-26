const asyncHandler = require("../utils/asyncHandler")
const logger = require("../utils/logger")
// getOrderStatus reads the order directly (a deliberately minimal, public
// payload). This import was missing, so that endpoint threw
// `ReferenceError: prisma is not defined` on every call — the checkout
// success page polls it after a Mercado Pago redirect, so buyers sat on
// "confirming payment" until it timed out.
const prisma = require("../lib/prisma")
const {
  createOrder: createOrderService,
  getEnrichedOrderById,
  getOrdersByUserId,
} = require("../services/orderService")
const { sendOrderPlacedEmail } = require("../utils/mailer")
const { notifyOrderPlaced } = require("../services/notificationService")
const { findOrCreateUserForCheckout } = require("../services/authService")
const { sendTemplateEmail } = require("../services/emailService")

const { resolveUserLocale } = require("../utils/resolveUserLocale")
/**
 * POST /api/orders — soft-auth route. Works for:
 *   1. Signed-in users  → uses req.user.id (existing behaviour)
 *   2. Returning email  → reuses the matching User row, order shows in their dashboard
 *   3. Brand-new email  → auto-creates a passwordless User, sends a "set
 *      your password" claim link in the confirmation email so they can
 *      access /dashboard/downloads without a separate sign-up step.
 *
 * Use `attachUserIfPresent` middleware (NOT `protect`) on the route so a
 * stale/missing token doesn't block guest checkout.
 */
// RFC 5322 — pragmatic email regex. Stops typos and obvious garbage
// without going overboard. The gateway will reject genuinely undeliverable
// addresses on send.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const createOrder = asyncHandler(async (req, res) => {
  const { customerName, customerEmail, items, couponCode } = req.body

  if (!customerEmail || !String(customerEmail).trim()) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "customerEmail is required",
    })
  }
  if (!EMAIL_RE.test(String(customerEmail).trim())) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "customerEmail is not a valid email address",
    })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "At least one order item is required",
    })
  }

  // Resolve the user that owns this order. Three paths — see JSDoc above.
  let userId      = req.user?.id || null
  let isNewUser   = false
  let claimToken  = null
  let resolvedName = customerName

  if (!userId) {
    try {
      const result = await findOrCreateUserForCheckout({
        fullName: customerName,
        email:    customerEmail,
      })
      if (result.requiresLogin) {
        return res.status(401).json({
          success: false, code: "ACCOUNT_EXISTS",
          message: "An account already exists for this email. Please sign in to complete your purchase.",
        })
      }
      userId       = result.user.id
      isNewUser    = result.isNew
      claimToken   = result.claimToken || null
      resolvedName = result.user.fullName || customerName
    } catch (err) {
      logger.error("[createOrder] auto-account failed:", err.message)
      return res.status(500).json({
        success: false, code: "AUTO_ACCOUNT_FAILED",
        message: "Could not create your account. Please try signing up first.",
      })
    }
  }

  // Idempotency-Key: a client-minted token per checkout ATTEMPT. A retried
  // or double-submitted request reuses it and gets the same order back.
  // Bounded and sanitised here so a hostile value cannot become an
  // arbitrarily long indexed column; anything outside the safe charset is
  // treated as "no key" rather than rejected, because a missing key must
  // never block a purchase.
  const rawKey = req.get("Idempotency-Key")
  const idempotencyKey =
    typeof rawKey === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(rawKey) ? rawKey : null

  let order
  try {
    order = await createOrderService({
      customerName: resolvedName || customerEmail.split("@")[0],
      customerEmail,
      userId,
      items,
      couponCode,
      idempotencyKey,
    })
  } catch (err) {
    // Surface coupon-validation failures as 400 with a clean shape so the
    // frontend can display the message inline without parsing stack traces.
    if (err?.code === "COUPON_INVALID") {
      return res.status(400).json({
        success: false,
        code:    "COUPON_INVALID",
        message: err.message,
      })
    }
    throw err
  }

  // Idempotent replay: this key already produced an order for this user, so
  // the service handed the existing one back. Return it and STOP — the
  // confirmation email and in-app notification already fired the first time,
  // and a double-tap must not produce a second "order placed" email. 200, not
  // 201: nothing was created by this request.
  if (order.idempotentReplay) {
    return res.status(200).json({
      success: true,
      message: "Order already created",
      idempotentReplay: true,
      data: { ...order, isNewUser: false },
    })
  }

  // Brand-new buyers get a claim-account email with a one-click link to set
  // their password. Existing customers get the usual order-placed email.
  if (isNewUser && claimToken) {
    const claimUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/reset-password/${claimToken}?source=checkout`
    sendTemplateEmail({
      locale: resolveUserLocale({ req }),
      to:          customerEmail,
      templateKey: "auth.account-claim",
      userId,
      variables: {
        customerName: resolvedName?.split(" ")[0] || "there",
        orderNumber:  order.orderNumber,
        claimUrl,
      },
    }).catch((err) => logger.error("[createOrder] claim email failed:", err.message))
  } else {
    // DB-driven template — admin can edit "order received, payment pending" copy.
    const orderUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/dashboard/orders/${order.id}`
    const orderTotal = (() => {
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency || "MXN", maximumFractionDigits: 2 }).format(Number(order.totalAmount))
      } catch { return `${order.totalAmount} ${order.currency || "MXN"}` }
    })()
    sendTemplateEmail({
      locale: resolveUserLocale({ req }),
      to:          customerEmail,
      templateKey: "order.placed",
      userId,
      variables: {
        customerName: resolvedName?.split(" ")[0] || "there",
        orderNumber:  order.orderNumber,
        orderTotal,
        orderUrl,
      },
    }).catch((err) => logger.error("[createOrder] email failed:", err.message))
  }

  notifyOrderPlaced(order).catch(() => {})

  return res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: { ...order, isNewUser },
  })
})

/**
 * GET /api/orders/my — list the current user's orders (list view)
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({
      success: false, code: "AUTH_MISSING",
      message: "Authentication required",
    })
  }

  const orders = await getOrdersByUserId(userId)
  return res.status(200).json({ success: true, data: orders })
})

/**
 * GET /api/orders/:id — enriched single-order response (B04)
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params

  const order = await getEnrichedOrderById(id)

  if (!order) {
    return res.status(404).json({
      success: false, code: "NOT_FOUND",
      message: "Order not found",
    })
  }

  const isAdmin = req.user?.role === "admin"
  const isOwner = order.userId && req.user?.id === order.userId

  if (!isAdmin && !isOwner) {
    return res.status(403).json({
      success: false, code: "FORBIDDEN",
      message: "You do not have access to this order",
    })
  }

  return res.status(200).json({ success: true, data: order })
})

/**
 * GET /api/orders/:id/status — minimal payment-status probe used by the
 * checkout success page while a gateway (Mercado Pago) is still confirming.
 *
 * Deliberately public (attachUserIfPresent): a brand-new guest buyer is not
 * signed in yet on the success page, but still needs to see the order flip
 * to "paid". The order id is an unguessable cuid and the payload is limited
 * to status + reference — no items, amounts, downloads, or PII. Anything
 * richer stays behind GET /api/orders/:id (protect + owner check).
 */
const getOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const order = await prisma.order.findUnique({
    where:  { id },
    select: { id: true, orderNumber: true, status: true, paidAt: true, userId: true },
  })
  if (!order) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Order not found" })
  }
  const isAdmin = req.user?.role === "admin"
  const isOwner = Boolean(order.userId && req.user?.id === order.userId)
  return res.status(200).json({
    success: true,
    data: {
      id:           order.id,
      orderNumber:  order.orderNumber,
      status:       order.status,
      paidAt:       order.paidAt,
      // Tells the client whether the enriched order (and downloads) can be
      // fetched with the current session, or whether it must show the
      // "claim your account" state instead.
      canViewOrder: isAdmin || isOwner,
      hasAccount:   Boolean(order.userId),
    },
  })
})

module.exports = { createOrder, getMyOrders, getOrderById, getOrderStatus }
