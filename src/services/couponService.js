const prisma = require("../lib/prisma")

/* ────────────────────────────────────────────────────────────────────────────
 * Shared helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function toNumber(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase()
}

/**
 * Compute discount amount for a given cart subtotal.
 * Percentage coupons cap at the subtotal itself so the total never goes negative.
 */
function calculateDiscount(coupon, subtotal) {
  const value = toNumber(coupon.discountValue)
  const base  = toNumber(subtotal)
  if (base <= 0) return 0

  if (coupon.discountType === "percentage") {
    const amount = (base * value) / 100
    return Math.min(amount, base)
  }
  if (coupon.discountType === "fixed") {
    return Math.min(value, base)
  }
  return 0
}

/**
 * Serialize a Coupon row for the admin list view.
 */
function serializeCoupon(coupon) {
  if (!coupon) return null
  return {
    id:             coupon.id,
    code:           coupon.code,
    description:    coupon.description || null,
    discountType:   coupon.discountType,
    discountValue:  toNumber(coupon.discountValue),
    minOrderAmount: coupon.minOrderAmount != null ? toNumber(coupon.minOrderAmount) : null,
    usageLimit:     coupon.usageLimit ?? null,
    usedCount:      coupon.usedCount,
    maxUsesPerUser: coupon.maxUsesPerUser ?? null,
    stackable:      coupon.stackable,
    startsAt:       coupon.startsAt,
    expiresAt:      coupon.expiresAt,
    isActive:       coupon.isActive,
    createdAt:      coupon.createdAt,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * validateCoupon — the heart of this service
 *
 * Runs every rule the B03 spec lists (minus the intentionally-skipped
 * appliesTo* logic — every coupon applies to the whole cart).
 *
 * Returns a structured result. Never throws for business-rule failures;
 * throws only for true internal errors (DB disconnect, etc.).
 *
 * @param {string} code
 * @param {{ userId?: string, cartTotal?: number, cartId?: string }} context
 * @returns {{ valid: boolean, discount: number, message: string, coupon: object | null }}
 * ──────────────────────────────────────────────────────────────────────────── */

async function validateCoupon(code, context = {}) {
  const normalized = normalizeCode(code)
  const cartTotal  = toNumber(context.cartTotal)
  const { userId, cartId } = context

  if (!normalized) {
    return { valid: false, discount: 0, message: "Coupon code is required", coupon: null }
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } })
  if (!coupon) {
    return { valid: false, discount: 0, message: "Coupon not found", coupon: null }
  }
  if (!coupon.isActive) {
    return { valid: false, discount: 0, message: "This coupon is no longer active", coupon: null }
  }

  const now = new Date()
  if (coupon.startsAt && coupon.startsAt > now) {
    return { valid: false, discount: 0, message: "This coupon is not yet active", coupon: null }
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, discount: 0, message: "This coupon has expired", coupon: null }
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discount: 0, message: "This coupon has reached its usage limit", coupon: null }
  }

  if (coupon.minOrderAmount != null) {
    const minOrder = toNumber(coupon.minOrderAmount)
    if (cartTotal < minOrder) {
      return {
        valid:    false,
        discount: 0,
        message:  `Minimum order of $${minOrder.toFixed(2)} required — add more items to qualify`,
        coupon:   null,
      }
    }
  }

  // Per-user cap requires an identity — guests cannot use per-user-capped
  // coupons (closes the guest bypass; checkout requires claimed accounts).
  if (!userId && coupon.maxUsesPerUser != null) {
    return { valid: false, discount: 0, message: "Sign in to use this coupon", coupon: null }
  }

  if (userId && coupon.maxUsesPerUser != null) {
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    })
    if (userUsageCount >= coupon.maxUsesPerUser) {
      return {
        valid:    false,
        discount: 0,
        message:  coupon.maxUsesPerUser === 1 ? "You have already used this coupon" : "You have reached the usage limit for this coupon",
        coupon:   null,
      }
    }
  }

  // Stackability check — only meaningful when applying to a specific cart.
  if (cartId && coupon.stackable === false) {
    const cart = await prisma.cart.findUnique({
      where:  { id: cartId },
      include: { appliedCoupon: { select: { id: true, code: true, stackable: true } } },
    })
    if (cart?.appliedCoupon && cart.appliedCoupon.id !== coupon.id) {
      return {
        valid:    false,
        discount: 0,
        message:  `Cannot stack with ${cart.appliedCoupon.code} — remove the current coupon first`,
        coupon:   null,
      }
    }
  }

  const discount = calculateDiscount(coupon, cartTotal)

  return {
    valid:    true,
    discount: Number(discount.toFixed(2)),
    message:  "Coupon applied successfully",
    coupon:   serializeCoupon(coupon),
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin CRUD — list · get · create · update · soft-delete · usage history
 * ──────────────────────────────────────────────────────────────────────────── */

async function listCoupons({ page = 1, limit = 20, includeInactive = false } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))

  const where = includeInactive ? {} : { isActive: true }

  const [items, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
    }),
    prisma.coupon.count({ where }),
  ])

  return {
    items: items.map(serializeCoupon),
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getCouponById(id) {
  const coupon = await prisma.coupon.findUnique({
    where:   { id },
    include: {
      _count: { select: { usages: true, orders: true, appliedCarts: true } },
    },
  })
  if (!coupon) return null
  return {
    ...serializeCoupon(coupon),
    stats: {
      totalRedemptions: coupon._count.usages,
      totalOrders:      coupon._count.orders,
      activeCarts:      coupon._count.appliedCarts,
    },
  }
}

async function createCoupon(data) {
  const code = normalizeCode(data.code)
  if (!code) throw buildError("VALIDATION_ERROR", "Coupon code is required", 400)

  if (!["percentage", "fixed"].includes(data.discountType)) {
    throw buildError("VALIDATION_ERROR", "discountType must be 'percentage' or 'fixed'", 400)
  }
  const discountValue = Number(data.discountValue)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw buildError("VALIDATION_ERROR", "discountValue must be a positive number", 400)
  }
  if (data.discountType === "percentage" && discountValue > 100) {
    throw buildError("VALIDATION_ERROR", "Percentage discount cannot exceed 100", 400)
  }

  const existing = await prisma.coupon.findUnique({ where: { code } })
  if (existing) throw buildError("CONFLICT", `Coupon code '${code}' already exists`, 409)

  const coupon = await prisma.coupon.create({
    data: {
      code,
      description:    data.description || null,
      discountType:   data.discountType,
      discountValue,
      usageLimit:     data.usageLimit != null ? Number(data.usageLimit) : null,
      minOrderAmount: data.minOrderAmount != null ? Number(data.minOrderAmount) : null,
      maxUsesPerUser: data.maxUsesPerUser != null ? Number(data.maxUsesPerUser) : null,
      stackable:      data.stackable !== false,
      startsAt:       data.startsAt ? new Date(data.startsAt) : null,
      expiresAt:      data.expiresAt ? new Date(data.expiresAt) : null,
      isActive:       data.isActive !== false,
    },
  })
  return serializeCoupon(coupon)
}

async function updateCoupon(id, data) {
  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) return null

  // Prevent code collisions on rename.
  if (data.code) {
    const newCode = normalizeCode(data.code)
    if (newCode !== existing.code) {
      const collision = await prisma.coupon.findUnique({ where: { code: newCode } })
      if (collision) throw buildError("CONFLICT", `Coupon code '${newCode}' already exists`, 409)
    }
  }

  if (data.discountType && !["percentage", "fixed"].includes(data.discountType)) {
    throw buildError("VALIDATION_ERROR", "discountType must be 'percentage' or 'fixed'", 400)
  }

  const updateData = {}
  if (data.code            !== undefined) updateData.code            = normalizeCode(data.code)
  if (data.description     !== undefined) updateData.description     = data.description || null
  if (data.discountType    !== undefined) updateData.discountType    = data.discountType
  if (data.discountValue   !== undefined) updateData.discountValue   = Number(data.discountValue)
  if (data.usageLimit      !== undefined) updateData.usageLimit      = data.usageLimit != null ? Number(data.usageLimit) : null
  if (data.minOrderAmount  !== undefined) updateData.minOrderAmount  = data.minOrderAmount != null ? Number(data.minOrderAmount) : null
  if (data.maxUsesPerUser  !== undefined) updateData.maxUsesPerUser  = data.maxUsesPerUser != null ? Number(data.maxUsesPerUser) : null
  if (data.stackable       !== undefined) updateData.stackable       = Boolean(data.stackable)
  if (data.startsAt        !== undefined) updateData.startsAt        = data.startsAt ? new Date(data.startsAt) : null
  if (data.expiresAt       !== undefined) updateData.expiresAt       = data.expiresAt ? new Date(data.expiresAt) : null
  if (data.isActive        !== undefined) updateData.isActive        = Boolean(data.isActive)

  const coupon = await prisma.coupon.update({ where: { id }, data: updateData })
  return serializeCoupon(coupon)
}

async function softDeleteCoupon(id) {
  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) return null
  const coupon = await prisma.coupon.update({
    where: { id },
    data:  { isActive: false },
  })
  return serializeCoupon(coupon)
}

async function listCouponUsage(couponId, { page = 1, limit = 50 } = {}) {
  const exists = await prisma.coupon.findUnique({ where: { id: couponId }, select: { id: true, code: true } })
  if (!exists) return null

  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50))

  const [items, total] = await Promise.all([
    prisma.couponUsage.findMany({
      where:   { couponId },
      orderBy: { usedAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: {
        user:  { select: { id: true, fullName: true, email: true } },
        order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
      },
    }),
    prisma.couponUsage.count({ where: { couponId } }),
  ])

  return {
    coupon: { id: exists.id, code: exists.code },
    items,
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internal — error builder that plays nicely with errorHandler
 * ──────────────────────────────────────────────────────────────────────────── */

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}

module.exports = {
  validateCoupon,
  calculateDiscount,
  serializeCoupon,
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  softDeleteCoupon,
  listCouponUsage,
}
