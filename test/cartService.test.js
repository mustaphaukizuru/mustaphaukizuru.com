// ─────────────────────────────────────────────────────────────────────────────
// cartService — unit tests
//
// Covers: cart acquisition, add/update/remove/clear, quantity clamping,
// snapshotting, guest-cart merge, coupon apply/remove, totals math and the
// exact AppError code/status pairs the controllers rely on.
//
// Prisma is mocked. couponService.validateCoupon is mocked, but the REAL
// calculateDiscount is kept so the totals math is exercised end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  cart:     { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  cartItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  product:  { findUnique: jest.fn() },
  service:  { findUnique: jest.fn() },
  $transaction: jest.fn(async (ops) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
}))

jest.mock("../src/services/couponService", () => {
  const actual = jest.requireActual("../src/services/couponService")
  return { ...actual, validateCoupon: jest.fn() }
})

const prisma = require("../src/lib/prisma")
const { validateCoupon } = require("../src/services/couponService")
const AppError = require("../src/utils/AppError")

const {
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
} = require("../src/services/cartService")

const NOW = new Date("2026-03-05T10:00:00.000Z")
const USER = "user_1"

/** A Prisma Decimal-alike — cartService must call .toNumber() on these. */
const dec = (n) => ({ toNumber: () => n })

function item(over = {}) {
  return {
    id: "ci_1",
    itemType: "product",
    productId: "p_1",
    serviceId: null,
    titleSnapshot: "Starter Kit",
    priceSnapshot: dec(50),
    quantity: 1,
    product: null,
    service: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

function cartRow(over = {}) {
  return {
    id: "cart_1",
    userId: USER,
    status: "active",
    appliedCouponId: null,
    appliedCoupon: null,
    items: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

/** Point every read at the same cart row. */
function primeCart(over = {}) {
  const row = cartRow(over)
  prisma.cart.findFirst.mockResolvedValue(row)
  return row
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(NOW)
  prisma.cart.update.mockResolvedValue({})
  prisma.cartItem.create.mockResolvedValue({})
  prisma.cartItem.update.mockResolvedValue({})
  prisma.cartItem.delete.mockResolvedValue({})
  prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 })
  prisma.cartItem.findFirst.mockResolvedValue(null)
})

afterEach(() => { jest.useRealTimers() })

/* ──────────────────────────── totals math ───────────────────────────────── */

describe("computeTotals", () => {
  it("sums priceSnapshot × quantity across items", () => {
    expect(computeTotals([item({ priceSnapshot: dec(50), quantity: 2 }), item({ priceSnapshot: dec(19.99), quantity: 1 })], null))
      .toMatchObject({ subtotal: 119.99, discount: 0, total: 119.99, taxIncluded: true })
  })

  it("treats a missing quantity as 1", () => {
    expect(computeTotals([item({ quantity: undefined })], null).subtotal).toBe(50)
  })

  it("accepts plain numbers and numeric strings for priceSnapshot", () => {
    expect(computeTotals([item({ priceSnapshot: 10 }), item({ priceSnapshot: "5.50" })], null).subtotal).toBe(15.5)
  })

  it("coerces null / non-numeric prices to 0", () => {
    expect(computeTotals([item({ priceSnapshot: null }), item({ priceSnapshot: "abc" })], null).subtotal).toBe(0)
  })

  it("applies a percentage coupon", () => {
    const totals = computeTotals(
      [item({ priceSnapshot: dec(100), quantity: 2 })],
      { isActive: true, discountType: "percentage", discountValue: 25 },
    )
    expect(totals).toMatchObject({ subtotal: 200, discount: 50, total: 150 })
  })

  it("applies a fixed coupon and never lets the total go negative", () => {
    const totals = computeTotals(
      [item({ priceSnapshot: dec(20) })],
      { isActive: true, discountType: "fixed", discountValue: 500 },
    )
    expect(totals).toMatchObject({ subtotal: 20, discount: 20, tax: 0, total: 0 })
  })

  it("ignores an inactive coupon", () => {
    const totals = computeTotals(
      [item({ priceSnapshot: dec(100) })],
      { isActive: false, discountType: "percentage", discountValue: 50 },
    )
    expect(totals.discount).toBe(0)
    expect(totals.total).toBe(100)
  })

  it("reports the IVA CONTAINED in the total without changing the total", () => {
    // 50.00 at 16% inclusive → 43.10 net + 6.90 IVA
    const totals = computeTotals([item()], null)
    expect(totals.total).toBe(50)
    expect(totals.tax).toBe(6.9)
    expect(totals.taxRate).toBe(0.16)
    expect(totals.taxIncluded).toBe(true)
  })

  it("exempt products contribute no tax", () => {
    const totals = computeTotals([item({ product: { taxExempt: true } })], null)
    expect(totals.tax).toBe(0)
    expect(totals.total).toBe(50)
  })

  it("rounds to 2 decimals", () => {
    const totals = computeTotals([item({ priceSnapshot: 33.333, quantity: 3 })], null)
    expect(totals.subtotal).toBe(100)
  })

  // ── BUG (recorded, not fixed) ────────────────────────────────────────────
  // src/services/cartService.js:57-72 (computeTotals)
  // The re-computation on every cart read only checks `coupon.isActive`. It
  // never re-checks `minOrderAmount`, so a coupon legitimately applied to a
  // $100 cart keeps discounting after the customer removes items and drops
  // below the minimum — the discount survives all the way to checkout.
  test("re-checks minOrderAmount when the subtotal drops after the coupon was applied", () => {
    const coupon = { isActive: true, discountType: "fixed", discountValue: 10, minOrderAmount: 50 }
    const totals = computeTotals([item({ priceSnapshot: dec(20) })], coupon)
    expect(totals.discount).toBe(0)
  })

  // ── BUG (recorded, not fixed) ────────────────────────────────────────────
  // Same function: `expiresAt` is loaded by CART_INCLUDE but never consulted.
  // An active-but-expired coupon keeps discounting the cart indefinitely.
  test("re-checks expiresAt on every cart read", () => {
    const coupon = {
      isActive: true, discountType: "percentage", discountValue: 50,
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),   // long past `NOW`
    }
    expect(computeTotals([item({ priceSnapshot: dec(100) })], coupon).discount).toBe(0)
  })
})

describe("serializeCart", () => {
  it("returns null for a null cart", () => {
    expect(serializeCart(null)).toBeNull()
  })

  it("flattens product relations and the primary image", () => {
    const out = serializeCart(cartRow({
      items: [item({
        product: {
          id: "p_1", slug: "kit", title: "Kit", price: dec(50), currency: "MXN", isActive: true,
          images: [{ url: "/img.png", altText: "Kit" }],
        },
      })],
    }))
    expect(out.items[0].product).toEqual({
      id: "p_1", slug: "kit", title: "Kit", price: 50, currency: "MXN",
      isActive: true, imageUrl: "/img.png", imageAlt: "Kit",
    })
    expect(out.items[0].priceSnapshot).toBe(50)
  })

  it("nulls imageUrl when the product has no images", () => {
    const out = serializeCart(cartRow({
      items: [item({ product: { id: "p_1", slug: "k", title: "K", price: 1, currency: "MXN", isActive: true, images: [] } })],
    }))
    expect(out.items[0].product.imageUrl).toBeNull()
  })

  it("flattens service relations", () => {
    const out = serializeCart(cartRow({
      items: [item({
        itemType: "service", productId: null, serviceId: "s_1",
        service: { id: "s_1", slug: "audit", title: "Audit", basePrice: dec(900), currency: "MXN" },
      })],
    }))
    expect(out.items[0].service).toEqual({ id: "s_1", slug: "audit", title: "Audit", basePrice: 900, currency: "MXN" })
    expect(out.items[0].product).toBeNull()
  })

  it("exposes the applied coupon without leaking its internal limits", () => {
    const out = serializeCart(cartRow({
      appliedCouponId: "c_1",
      appliedCoupon: {
        id: "c_1", code: "SAVE10", description: null, discountType: "fixed",
        discountValue: dec(10), isActive: true, minOrderAmount: dec(5), usageLimit: 3,
      },
      items: [item({ priceSnapshot: dec(100) })],
    }))
    expect(out.appliedCoupon).toEqual({
      id: "c_1", code: "SAVE10", description: null, discountType: "fixed", discountValue: 10,
    })
    expect(out.appliedCoupon).not.toHaveProperty("usageLimit")
    expect(out.totals.total).toBe(90)
  })

  it("counts total units, not distinct line items", () => {
    const out = serializeCart(cartRow({ items: [item({ id: "a", quantity: 3 }), item({ id: "b", quantity: 2 })] }))
    expect(out.itemCount).toBe(5)
    expect(out.items).toHaveLength(2)
  })

  it("handles a cart row with no items array at all", () => {
    const out = serializeCart({ id: "c", userId: USER, status: "active" })
    expect(out.items).toEqual([])
    expect(out.totals.subtotal).toBe(0)
    expect(out.appliedCouponId).toBeNull()
  })
})

/* ─────────────────────── cart acquisition ───────────────────────────────── */

describe("getOrCreateActiveCart", () => {
  it("rejects a missing userId with VALIDATION_ERROR/400", async () => {
    await expect(getOrCreateActiveCart(null)).rejects.toMatchObject({
      name: "AppError", statusCode: 400, code: "VALIDATION_ERROR",
    })
  })

  it("returns the existing active cart without creating one", async () => {
    const row = primeCart()
    await expect(getOrCreateActiveCart(USER)).resolves.toBe(row)
    expect(prisma.cart.create).not.toHaveBeenCalled()
  })

  it("creates an active cart when none exists", async () => {
    prisma.cart.findFirst.mockResolvedValue(null)
    prisma.cart.create.mockResolvedValue(cartRow())
    await getOrCreateActiveCart(USER)
    expect(prisma.cart.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { userId: USER, status: "active" },
    }))
  })

  it("getCart returns the serialized shape", async () => {
    primeCart({ items: [item({ priceSnapshot: dec(50), quantity: 2 })] })
    await expect(getCart(USER)).resolves.toMatchObject({
      id: "cart_1", itemCount: 2, totals: { subtotal: 100, total: 100 },
    })
  })
})

/* ───────────────────────────── addItem ──────────────────────────────────── */

describe("addItem", () => {
  const PRODUCT = { id: "p_1", title: "Starter Kit", price: dec(50), isActive: true }

  it("requires productId or serviceId", async () => {
    primeCart()
    await expect(addItem(USER, {})).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
  })

  it("rejects passing both ids", async () => {
    primeCart()
    await expect(addItem(USER, { productId: "p_1", serviceId: "s_1" }))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
  })

  it("snapshots the product title and price", async () => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await addItem(USER, { productId: "p_1", quantity: 2 })
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: "cart_1", itemType: "product", productId: "p_1", serviceId: null,
        titleSnapshot: "Starter Kit", priceSnapshot: PRODUCT.price, quantity: 2,
      },
    })
  })

  it("snapshots the service title and basePrice", async () => {
    primeCart()
    prisma.service.findUnique.mockResolvedValue({ id: "s_1", title: "Audit", basePrice: dec(900), status: "published" })
    await addItem(USER, { serviceId: "s_1" })
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemType: "service", serviceId: "s_1", productId: null, titleSnapshot: "Audit" }),
    })
  })

  it("404s on a missing product", async () => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue(null)
    await expect(addItem(USER, { productId: "gone" })).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
  })

  it("404s on an inactive product", async () => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, isActive: false })
    await expect(addItem(USER, { productId: "p_1" })).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
  })

  it("404s on a missing or archived service", async () => {
    primeCart()
    prisma.service.findUnique.mockResolvedValue(null)
    await expect(addItem(USER, { serviceId: "s_1" })).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
    prisma.service.findUnique.mockResolvedValue({ id: "s_1", title: "X", basePrice: 1, status: "archived" })
    await expect(addItem(USER, { serviceId: "s_1" })).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
  })

  it("bumps the quantity of an identical existing line instead of duplicating", async () => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1", quantity: 3 })
    await addItem(USER, { productId: "p_1", quantity: 2 })
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: "ci_1" }, data: { quantity: 5 } })
    expect(prisma.cartItem.create).not.toHaveBeenCalled()
  })

  it.each([[0, 1], [-5, 1], [1.9, 1], [2.9, 2], ["3", 3], [null, 1], [undefined, 1], ["abc", 1]])(
    "clamps quantity %p to %p",
    async (input, expected) => {
      primeCart()
      prisma.product.findUnique.mockResolvedValue(PRODUCT)
      await addItem(USER, { productId: "p_1", quantity: input })
      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ quantity: expected }),
      })
    },
  )

  it("touches the cart's updatedAt", async () => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await addItem(USER, { productId: "p_1" })
    expect(prisma.cart.update).toHaveBeenCalledWith({ where: { id: "cart_1" }, data: { updatedAt: NOW } })
  })
})

/* ─────────────────────── updateItemQuantity / remove ────────────────────── */

describe("updateItemQuantity", () => {
  it("rejects a non-numeric quantity", async () => {
    await expect(updateItemQuantity(USER, "ci_1", "abc"))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
    expect(prisma.cart.findFirst).not.toHaveBeenCalled()
  })

  it("404s when the item does not belong to the caller's cart", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue(null)
    await expect(updateItemQuantity(USER, "ci_x", 2)).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
  })

  it("scopes the item lookup to the caller's cart (no cross-user access)", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1" })
    await updateItemQuantity(USER, "ci_1", 4)
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({ where: { id: "ci_1", cartId: "cart_1" } })
  })

  it("updates the quantity for a positive value", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1" })
    await updateItemQuantity(USER, "ci_1", 7)
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: "ci_1" }, data: { quantity: 7 } })
  })

  it("truncates fractional quantities", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1" })
    await updateItemQuantity(USER, "ci_1", 3.9)
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: "ci_1" }, data: { quantity: 3 } })
  })

  it.each([[0], [-2], [0.4]])("deletes the line when quantity resolves to %p or below", async (q) => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1" })
    await updateItemQuantity(USER, "ci_1", q)
    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: "ci_1" } })
    expect(prisma.cartItem.update).not.toHaveBeenCalled()
  })
})

describe("removeItem", () => {
  it("404s for an unknown item", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue(null)
    await expect(removeItem(USER, "ci_x")).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" })
    expect(prisma.cartItem.delete).not.toHaveBeenCalled()
  })

  it("deletes the item and touches the cart", async () => {
    primeCart()
    prisma.cartItem.findFirst.mockResolvedValue({ id: "ci_1" })
    await removeItem(USER, "ci_1")
    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: "ci_1" } })
    expect(prisma.cart.update).toHaveBeenCalledWith({ where: { id: "cart_1" }, data: { updatedAt: NOW } })
  })
})

describe("clearCart", () => {
  it("deletes every item AND drops the applied coupon in one transaction", async () => {
    primeCart({ appliedCouponId: "c_1" })
    await clearCart(USER)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart_1" } })
    expect(prisma.cart.update).toHaveBeenCalledWith({ where: { id: "cart_1" }, data: { appliedCouponId: null } })
  })
})

/* ───────────────────────── guest-cart merge ─────────────────────────────── */

describe("mergeGuestCart", () => {
  beforeEach(() => {
    primeCart()
    prisma.product.findUnique.mockResolvedValue({ id: "p_1", title: "Kit", price: dec(50), isActive: true })
  })

  it("rejects a non-array payload", async () => {
    await expect(mergeGuestCart(USER, "nope")).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
  })

  it("defaults to an empty merge", async () => {
    await expect(mergeGuestCart(USER)).resolves.toMatchObject({ merged: 0, skipped: 0 })
  })

  it("merges productId, serviceId and legacy `id` shapes", async () => {
    prisma.service.findUnique.mockResolvedValue({ id: "s_1", title: "Audit", basePrice: dec(900), status: "published" })
    const res = await mergeGuestCart(USER, [
      { productId: "p_1", quantity: 2 },
      { serviceId: "s_1", quantity: 1 },
      { id: "p_1", quantity: 1 },
    ])
    expect(res.merged).toBe(3)
    expect(res.skipped).toBe(0)
    expect(res.cart).toMatchObject({ id: "cart_1" })
  })

  it("skips malformed entries instead of throwing", async () => {
    const res = await mergeGuestCart(USER, [null, "x", {}, { quantity: 2 }])
    expect(res).toMatchObject({ merged: 0, skipped: 4 })
  })

  it("skips (does not abort on) a product that no longer exists", async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "p_2", title: "Kit 2", price: dec(9), isActive: true })
    const res = await mergeGuestCart(USER, [{ productId: "gone" }, { productId: "p_2" }])
    expect(res).toMatchObject({ merged: 1, skipped: 1 })
  })

  it("clamps merged quantities to at least 1", async () => {
    await mergeGuestCart(USER, [{ productId: "p_1", quantity: -4 }])
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantity: 1 }) })
  })
})

/* ──────────────────────── coupon apply / remove ─────────────────────────── */

describe("applyCoupon", () => {
  it("refuses an empty cart", async () => {
    primeCart({ items: [] })
    await expect(applyCoupon(USER, "SAVE10")).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
    expect(validateCoupon).not.toHaveBeenCalled()
  })

  it("passes the computed subtotal, userId and cartId to validateCoupon", async () => {
    primeCart({ items: [item({ priceSnapshot: dec(50), quantity: 2 }), item({ id: "b", priceSnapshot: dec(25) })] })
    validateCoupon.mockResolvedValue({ valid: true, coupon: { id: "c_1" } })
    await applyCoupon(USER, "save10")
    expect(validateCoupon).toHaveBeenCalledWith("save10", { userId: USER, cartTotal: 125, cartId: "cart_1" })
  })

  it("persists appliedCouponId when validation passes", async () => {
    primeCart({ items: [item()] })
    validateCoupon.mockResolvedValue({ valid: true, coupon: { id: "c_1" } })
    await applyCoupon(USER, "SAVE10")
    expect(prisma.cart.update).toHaveBeenCalledWith({ where: { id: "cart_1" }, data: { appliedCouponId: "c_1" } })
  })

  it("re-throws the validator's message as COUPON_INVALID/400", async () => {
    primeCart({ items: [item()] })
    validateCoupon.mockResolvedValue({ valid: false, message: "This coupon has expired", coupon: null })
    await expect(applyCoupon(USER, "OLD")).rejects.toMatchObject({
      statusCode: 400, code: "COUPON_INVALID", message: "This coupon has expired",
    })
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })

  it("throws an AppError instance (so errorHandler emits the dual shape)", async () => {
    primeCart({ items: [item()] })
    validateCoupon.mockResolvedValue({ valid: false, message: "Coupon not found", coupon: null })
    await expect(applyCoupon(USER, "NOPE")).rejects.toBeInstanceOf(AppError)
  })
})

describe("removeCoupon", () => {
  it("is a no-op when no coupon is applied", async () => {
    primeCart({ appliedCouponId: null })
    await removeCoupon(USER)
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })

  it("clears appliedCouponId when one is applied", async () => {
    primeCart({ appliedCouponId: "c_1" })
    await removeCoupon(USER)
    expect(prisma.cart.update).toHaveBeenCalledWith({ where: { id: "cart_1" }, data: { appliedCouponId: null } })
  })
})
