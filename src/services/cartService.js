const prisma = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { validateCoupon, calculateDiscount } = require("./couponService")
const { computeOrderTax } = require("../lib/tax")

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function toNumber(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Include shape used for every cart read — keeps serialized carts consistent.
 */
const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: {
          id: true, slug: true, title: true, price: true, currency: true,
          isActive: true,
          images: {
            where:   { isPrimary: true },
            take:    1,
            select:  { url: true, altText: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      service: {
        select: { id: true, slug: true, title: true, basePrice: true, currency: true },
      },
    },
  },
  appliedCoupon: {
    select: {
      id: true, code: true, description: true, discountType: true, discountValue: true,
      minOrderAmount: true, stackable: true, startsAt: true, expiresAt: true, isActive: true,
    },
  },
}

/**
 * Compute totals for a cart. `tax` is the IVA contained in `total`.
 *
 * @param {Array} items       cart items (with prismaed product/service relations)
 * @param {object|null} coupon applied coupon row or null
 * @returns {{ subtotal: number, discount: number, tax: number, total: number }}
 */
/**
 * Is this coupon still valid for this cart, right now?
 *
 * Mirrors the time/threshold rules couponService.validateCoupon enforces at
 * apply time. Usage limits are deliberately NOT re-checked here: they are
 * consumed atomically when the order is created (orderService), and counting
 * them on a cart read would reject the buyer's own in-flight redemption.
 */
function couponStillApplies(coupon, subtotal) {
  if (!coupon.isActive) return false
  const now = new Date()
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return false
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return false
  if (coupon.minOrderAmount != null && subtotal < toNumber(coupon.minOrderAmount)) return false
  return true
}

function computeTotals(items, coupon) {
  const subtotal = items.reduce((sum, item) => {
    return sum + toNumber(item.priceSnapshot) * (item.quantity || 1)
  }, 0)

  // Re-validate the coupon on EVERY read, not just re-compute the amount.
  // The cart changes after a coupon is applied: items get removed (dropping
  // the subtotal under minOrderAmount) and time passes (expiresAt). Checking
  // only `isActive` let a stale discount ride through serializeCart into
  // checkout — a customer could apply a coupon to a large cart, delete items,
  // and keep the discount.
  let discount = 0
  if (coupon && couponStillApplies(coupon, subtotal)) {
    discount = calculateDiscount(coupon, subtotal)
  }

  // IVA is CONTAINED in listed prices (src/lib/tax.js) — it never changes
  // the total, only how it is broken down for the customer and the invoice.
  const total = Math.max(0, subtotal - discount)
  const { taxRate, taxAmount } = computeOrderTax({
    items:    items.map((item) => ({
      lineTotal: toNumber(item.priceSnapshot) * (item.quantity || 1),
      taxExempt: Boolean(item.product?.taxExempt || item.service?.taxExempt),
    })),
    discount,
  })

  return {
    subtotal:    Number(subtotal.toFixed(2)),
    discount:    Number(discount.toFixed(2)),
    tax:         taxAmount,
    taxRate,
    taxIncluded: true,
    total:       Number(total.toFixed(2)),
  }
}

/**
 * Serialize a cart row into the shape the frontend expects.
 */
function serializeCart(cart) {
  if (!cart) return null

  const items = (cart.items || []).map((item) => ({
    id:            item.id,
    itemType:      item.itemType,
    productId:     item.productId,
    serviceId:     item.serviceId,
    titleSnapshot: item.titleSnapshot,
    priceSnapshot: toNumber(item.priceSnapshot),
    licenseTier:   item.licenseTier || null,
    quantity:      item.quantity,
    product:       item.product
      ? {
          id:         item.product.id,
          slug:       item.product.slug,
          title:      item.product.title,
          price:      toNumber(item.product.price),
          currency:   item.product.currency,
          isActive:   item.product.isActive,
          imageUrl:   item.product.images?.[0]?.url || null,
          imageAlt:   item.product.images?.[0]?.altText || null,
        }
      : null,
    service:       item.service
      ? {
          id:        item.service.id,
          slug:      item.service.slug,
          title:     item.service.title,
          basePrice: toNumber(item.service.basePrice),
          currency:  item.service.currency,
        }
      : null,
    createdAt:    item.createdAt,
    updatedAt:    item.updatedAt,
  }))

  const appliedCoupon = cart.appliedCoupon
    ? {
        id:             cart.appliedCoupon.id,
        code:           cart.appliedCoupon.code,
        description:    cart.appliedCoupon.description || null,
        discountType:   cart.appliedCoupon.discountType,
        discountValue:  toNumber(cart.appliedCoupon.discountValue),
      }
    : null

  const totals = computeTotals(cart.items || [], cart.appliedCoupon)

  return {
    id:              cart.id,
    userId:          cart.userId,
    status:          cart.status,
    appliedCouponId: cart.appliedCouponId || null,
    appliedCoupon,
    items,
    totals,
    itemCount:       items.reduce((sum, it) => sum + it.quantity, 0),
    createdAt:       cart.createdAt,
    updatedAt:       cart.updatedAt,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cart acquisition — find-or-create the active cart for a user
 * ──────────────────────────────────────────────────────────────────────────── */

async function getOrCreateActiveCart(userId) {
  if (!userId) throw new AppError("userId is required", { statusCode: 400, code: "VALIDATION_ERROR" })

  let cart = await prisma.cart.findFirst({
    where:   { userId, status: "active" },
    include: CART_INCLUDE,
  })
  if (cart) return cart

  cart = await prisma.cart.create({
    data:    { userId, status: "active" },
    include: CART_INCLUDE,
  })
  return cart
}

async function getCart(userId) {
  const cart = await getOrCreateActiveCart(userId)
  return serializeCart(cart)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mutation — add item
 *
 * Accepts { productId, quantity } OR { serviceId, quantity }.
 * Looks up the latest title + price and persists them as *Snapshot* fields so
 * the cart is stable even if the product price changes later.
 * ──────────────────────────────────────────────────────────────────────────── */

async function addItem(userId, { productId, serviceId, quantity = 1, licenseTier = null }) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  const tier = licenseTier ? String(licenseTier).trim().toLowerCase() : null

  if (!productId && !serviceId) {
    throw new AppError("productId or serviceId is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  }
  if (productId && serviceId) {
    throw new AppError("Pass productId OR serviceId, not both", { statusCode: 400, code: "VALIDATION_ERROR" })
  }

  const cart = await getOrCreateActiveCart(userId)

  // Snapshot lookup
  let itemType, titleSnapshot, priceSnapshot
  if (productId) {
    const product = await prisma.product.findUnique({
      where:  { id: productId },
      select: { id: true, title: true, price: true, isActive: true },
    })
    if (!product || !product.isActive) throw new AppError("Product not found", { statusCode: 404, code: "NOT_FOUND" })
    itemType      = "product"
    titleSnapshot = product.title
    priceSnapshot = product.price
    // T3 · tiered licensing: the tier must be an active licence of this
    // product and its price replaces the base price in the snapshot.
    if (tier) {
      const license = await prisma.productLicense.findFirst({
        where: { productId, tier, isActive: true },
        select: { tier: true, price: true },
      })
      if (!license) throw new AppError("License tier not available for this product", { statusCode: 400, code: "LICENSE_TIER_INVALID" })
      priceSnapshot = license.price
    }
  } else {
    if (tier) throw new AppError("licenseTier only applies to products", { statusCode: 400, code: "VALIDATION_ERROR" })
    const service = await prisma.service.findUnique({
      where:  { id: serviceId },
      select: { id: true, title: true, basePrice: true, status: true },
    })
    if (!service || service.status === "archived") throw new AppError("Service not found", { statusCode: 404, code: "NOT_FOUND" })
    itemType      = "service"
    titleSnapshot = service.title
    priceSnapshot = service.basePrice
  }

  // If an identical item already exists, bump the quantity instead of duplicating.
  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId:    cart.id,
      itemType,
      productId: productId || null,
      serviceId: serviceId || null,
      licenseTier: tier,
    },
  })

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data:  { quantity: existing.quantity + qty },
    })
  } else {
    await prisma.cartItem.create({
      data: {
        cartId:    cart.id,
        itemType,
        productId: productId || null,
        serviceId: serviceId || null,
        titleSnapshot,
        priceSnapshot,
        licenseTier: tier,
        quantity:  qty,
      },
    })
  }

  await touchCart(cart.id)
  return getCart(userId)
}

async function updateItemQuantity(userId, itemId, quantity) {
  const qty = Math.floor(Number(quantity))
  if (!Number.isFinite(qty)) throw new AppError("quantity must be a number", { statusCode: 400, code: "VALIDATION_ERROR" })

  const cart = await getOrCreateActiveCart(userId)
  const item = await prisma.cartItem.findFirst({
    where:  { id: itemId, cartId: cart.id },
  })
  if (!item) throw new AppError("Cart item not found", { statusCode: 404, code: "NOT_FOUND" })

  if (qty <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } })
  } else {
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: qty } })
  }

  await touchCart(cart.id)
  return getCart(userId)
}

async function removeItem(userId, itemId) {
  const cart = await getOrCreateActiveCart(userId)
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } })
  if (!item) throw new AppError("Cart item not found", { statusCode: 404, code: "NOT_FOUND" })

  await prisma.cartItem.delete({ where: { id: itemId } })
  await touchCart(cart.id)
  return getCart(userId)
}

async function clearCart(userId) {
  const cart = await getOrCreateActiveCart(userId)
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { appliedCouponId: null } }),
  ])
  return getCart(userId)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Merge — called at login to absorb the user's guest localStorage cart
 *
 * Input: array of { productId?, serviceId?, quantity }.
 * Strategy: add each item via the same addItem path so snapshots are fresh.
 * Inactive / missing products are skipped silently so one stale item doesn't
 * break the whole merge.
 * ──────────────────────────────────────────────────────────────────────────── */

async function mergeGuestCart(userId, items = []) {
  if (!Array.isArray(items)) throw new AppError("items must be an array", { statusCode: 400, code: "VALIDATION_ERROR" })

  const results = { merged: 0, skipped: 0 }

  for (const raw of items) {
    if (!raw || typeof raw !== "object") { results.skipped++; continue }
    const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1))
    try {
      if (raw.productId) {
        await addItem(userId, { productId: raw.productId, quantity: qty, licenseTier: raw.licenseTier || null })
        results.merged++
      } else if (raw.serviceId) {
        await addItem(userId, { serviceId: raw.serviceId, quantity: qty })
        results.merged++
      } else if (raw.id) {
        // Guest carts traditionally use product id as `id`. Try that path.
        await addItem(userId, { productId: raw.id, quantity: qty, licenseTier: raw.licenseTier || null })
        results.merged++
      } else {
        results.skipped++
      }
    } catch {
      // Product deleted, inactive, etc. — skip silently.
      results.skipped++
    }
  }

  return {
    ...results,
    cart: await getCart(userId),
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Coupon application / removal
 * ──────────────────────────────────────────────────────────────────────────── */

async function applyCoupon(userId, code) {
  const cart = await getOrCreateActiveCart(userId)
  if (!cart.items || cart.items.length === 0) {
    throw new AppError("Add items to your cart before applying a coupon", { statusCode: 400, code: "VALIDATION_ERROR" })
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + toNumber(item.priceSnapshot) * item.quantity, 0
  )

  const result = await validateCoupon(code, {
    userId,
    cartTotal: subtotal,
    cartId:    cart.id,
  })

  if (!result.valid) {
    // Surface the message — status 400 is semantically correct for validation fail.
    throw new AppError(result.message, { statusCode: 400, code: "COUPON_INVALID" })
  }

  await prisma.cart.update({
    where: { id: cart.id },
    data:  { appliedCouponId: result.coupon.id },
  })

  return getCart(userId)
}

async function removeCoupon(userId) {
  const cart = await getOrCreateActiveCart(userId)
  if (!cart.appliedCouponId) return getCart(userId)

  await prisma.cart.update({
    where: { id: cart.id },
    data:  { appliedCouponId: null },
  })
  return getCart(userId)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internal
 * ──────────────────────────────────────────────────────────────────────────── */

async function touchCart(cartId) {
  await prisma.cart.update({
    where: { id: cartId },
    data:  { updatedAt: new Date() },
  })
}

module.exports = {
  getCart,
  getOrCreateActiveCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeGuestCart,
  applyCoupon,
  removeCoupon,
  serializeCart,
  computeTotals,
}
