// ─────────────────────────────────────────────────────────────────────────────
// couponService.validateCoupon — unit tests
//
// Every business rule the checkout depends on: code normalization, active
// flag, start/expiry windows, global usage limit, per-user limit (including
// the guest branch that now refuses instead of silently allowing), minimum
// order amount, stackability, and the discount math.
//
// Prisma is mocked; the clock is frozen so the date windows are deterministic.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  coupon:      { findUnique: jest.fn() },
  couponUsage: { count: jest.fn() },
  cart:        { findUnique: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const { validateCoupon, calculateDiscount, serializeCoupon } = require("../src/services/couponService")

const NOW = new Date("2026-03-05T10:00:00.000Z")
const dec = (n) => ({ toNumber: () => n })

function coupon(over = {}) {
  return {
    id: "c_1",
    code: "SAVE10",
    description: null,
    discountType: "percentage",
    discountValue: dec(10),
    minOrderAmount: null,
    usageLimit: null,
    usedCount: 0,
    maxUsesPerUser: null,
    stackable: true,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: NOW,
    ...over,
  }
}

const prime = (over) => prisma.coupon.findUnique.mockResolvedValue(over === null ? null : coupon(over))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(NOW)
  prisma.couponUsage.count.mockResolvedValue(0)
  prisma.cart.findUnique.mockResolvedValue(null)
})

afterEach(() => { jest.useRealTimers() })

/* ─────────────────────────── discount math ──────────────────────────────── */

describe("calculateDiscount", () => {
  it("computes a percentage of the subtotal", () => {
    expect(calculateDiscount({ discountType: "percentage", discountValue: 25 }, 200)).toBe(50)
  })

  it("caps a >100% percentage at the subtotal", () => {
    expect(calculateDiscount({ discountType: "percentage", discountValue: 150 }, 80)).toBe(80)
  })

  it("caps a fixed discount at the subtotal", () => {
    expect(calculateDiscount({ discountType: "fixed", discountValue: 500 }, 30)).toBe(30)
  })

  it("returns 0 for a zero or negative subtotal", () => {
    expect(calculateDiscount({ discountType: "fixed", discountValue: 10 }, 0)).toBe(0)
    expect(calculateDiscount({ discountType: "percentage", discountValue: 10 }, -5)).toBe(0)
  })

  it("returns 0 for an unknown discountType", () => {
    expect(calculateDiscount({ discountType: "bogo", discountValue: 10 }, 100)).toBe(0)
  })

  it("unwraps Prisma Decimal values", () => {
    expect(calculateDiscount({ discountType: "fixed", discountValue: dec(15) }, 100)).toBe(15)
  })
})

describe("serializeCoupon", () => {
  it("returns null for a null row", () => {
    expect(serializeCoupon(null)).toBeNull()
  })

  it("unwraps decimals and normalizes undefined limits to null", () => {
    expect(serializeCoupon(coupon({ minOrderAmount: dec(50), usageLimit: undefined, maxUsesPerUser: undefined })))
      .toMatchObject({ discountValue: 10, minOrderAmount: 50, usageLimit: null, maxUsesPerUser: null })
  })

  it("keeps minOrderAmount null when unset", () => {
    expect(serializeCoupon(coupon()).minOrderAmount).toBeNull()
  })
})

/* ────────────────────────── code + existence ────────────────────────────── */

describe("validateCoupon — code handling", () => {
  it.each([[""], ["   "], [null], [undefined]])("rejects blank code %p without hitting the DB", async (code) => {
    const res = await validateCoupon(code, { cartTotal: 100 })
    expect(res).toEqual({ valid: false, discount: 0, message: "Coupon code is required", coupon: null })
    expect(prisma.coupon.findUnique).not.toHaveBeenCalled()
  })

  it("upper-cases and trims the code before lookup", async () => {
    prime()
    await validateCoupon("  save10  ", { cartTotal: 100 })
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } })
  })

  it("reports an unknown code", async () => {
    prime(null)
    await expect(validateCoupon("NOPE", { cartTotal: 100 }))
      .resolves.toMatchObject({ valid: false, message: "Coupon not found", coupon: null })
  })

  it("reports a deactivated (soft-deleted) coupon", async () => {
    prime({ isActive: false })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 }))
      .resolves.toMatchObject({ valid: false, message: "This coupon is no longer active" })
  })
})

/* ─────────────────────── start date / expiry window ─────────────────────── */

describe("validateCoupon — date windows", () => {
  it("rejects a coupon whose start date is in the future", async () => {
    prime({ startsAt: new Date("2026-03-06T00:00:00.000Z") })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 }))
      .resolves.toMatchObject({ valid: false, discount: 0, message: "This coupon is not yet active" })
  })

  it("accepts a coupon that started one second ago", async () => {
    prime({ startsAt: new Date(NOW.getTime() - 1000) })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("accepts a coupon starting exactly now (boundary is inclusive)", async () => {
    prime({ startsAt: new Date(NOW) })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("rejects an expired coupon", async () => {
    prime({ expiresAt: new Date("2026-03-05T09:59:59.000Z") })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 }))
      .resolves.toMatchObject({ valid: false, message: "This coupon has expired" })
  })

  it("accepts a coupon expiring exactly now (boundary is inclusive)", async () => {
    prime({ expiresAt: new Date(NOW) })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("accepts a coupon inside both bounds", async () => {
    prime({
      startsAt:  new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("checks the start date BEFORE the expiry date", async () => {
    // A misconfigured coupon that is both not-yet-started and already expired
    // surfaces the not-yet-active message.
    prime({
      startsAt:  new Date("2026-04-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 }))
      .resolves.toMatchObject({ message: "This coupon is not yet active" })
  })
})

/* ──────────────────────── global usage limit ────────────────────────────── */

describe("validateCoupon — usage limit", () => {
  it("rejects once usedCount reaches usageLimit", async () => {
    prime({ usageLimit: 100, usedCount: 100 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 }))
      .resolves.toMatchObject({ valid: false, message: "This coupon has reached its usage limit" })
  })

  it("rejects when usedCount has overshot the limit", async () => {
    prime({ usageLimit: 5, usedCount: 9 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: false })
  })

  it("accepts the very last redemption", async () => {
    prime({ usageLimit: 100, usedCount: 99 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("treats a null usageLimit as unlimited", async () => {
    prime({ usageLimit: null, usedCount: 9_999 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("honours a usageLimit of 0 (issued but not redeemable)", async () => {
    prime({ usageLimit: 0, usedCount: 0 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: false })
  })
})

/* ──────────────────────── minimum order amount ──────────────────────────── */

describe("validateCoupon — minimum order", () => {
  it("rejects a cart below the minimum with a formatted message", async () => {
    prime({ minOrderAmount: dec(50) })
    await expect(validateCoupon("SAVE10", { cartTotal: 49.99 })).resolves.toMatchObject({
      valid: false,
      discount: 0,
      message: "Minimum order of $50.00 required — add more items to qualify",
    })
  })

  it("accepts a cart exactly at the minimum", async () => {
    prime({ minOrderAmount: dec(50) })
    await expect(validateCoupon("SAVE10", { cartTotal: 50 })).resolves.toMatchObject({ valid: true })
  })

  it("rejects when cartTotal is missing entirely (treated as 0)", async () => {
    prime({ minOrderAmount: dec(50) })
    await expect(validateCoupon("SAVE10", {})).resolves.toMatchObject({ valid: false })
  })

  it("ignores a null minOrderAmount", async () => {
    prime({ minOrderAmount: null })
    await expect(validateCoupon("SAVE10", { cartTotal: 1 })).resolves.toMatchObject({ valid: true })
  })

  it("honours a minOrderAmount of 0", async () => {
    prime({ minOrderAmount: dec(0) })
    await expect(validateCoupon("SAVE10", { cartTotal: 0 })).resolves.toMatchObject({ valid: true, discount: 0 })
  })
})

/* ──────────────────── per-user limit + the guest branch ─────────────────── */

describe("validateCoupon — per-user limit", () => {
  it("refuses a GUEST outright when the coupon is per-user capped", async () => {
    prime({ maxUsesPerUser: 1 })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toEqual({
      valid: false, discount: 0, message: "Sign in to use this coupon", coupon: null,
    })
    expect(prisma.couponUsage.count).not.toHaveBeenCalled()
  })

  it("still serves a GUEST when the coupon has no per-user cap", async () => {
    prime({ maxUsesPerUser: null })
    await expect(validateCoupon("SAVE10", { cartTotal: 100 })).resolves.toMatchObject({ valid: true })
  })

  it("checks the minimum order BEFORE the guest sign-in branch", async () => {
    prime({ maxUsesPerUser: 1, minOrderAmount: dec(500) })
    await expect(validateCoupon("SAVE10", { cartTotal: 10 }))
      .resolves.toMatchObject({ message: expect.stringContaining("Minimum order") })
  })

  it("counts prior redemptions scoped to (coupon, user)", async () => {
    prime({ maxUsesPerUser: 3 })
    prisma.couponUsage.count.mockResolvedValue(1)
    await validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" })
    expect(prisma.couponUsage.count).toHaveBeenCalledWith({ where: { couponId: "c_1", userId: "u_1" } })
  })

  it("uses the singular message for a once-per-customer coupon", async () => {
    prime({ maxUsesPerUser: 1 })
    prisma.couponUsage.count.mockResolvedValue(1)
    await expect(validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" }))
      .resolves.toMatchObject({ valid: false, message: "You have already used this coupon" })
  })

  it("uses the plural message for a multi-use-per-customer coupon", async () => {
    prime({ maxUsesPerUser: 3 })
    prisma.couponUsage.count.mockResolvedValue(3)
    await expect(validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" }))
      .resolves.toMatchObject({ valid: false, message: "You have reached the usage limit for this coupon" })
  })

  it("accepts the user's final allowed redemption", async () => {
    prime({ maxUsesPerUser: 3 })
    prisma.couponUsage.count.mockResolvedValue(2)
    await expect(validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" })).resolves.toMatchObject({ valid: true })
  })

  it("skips the per-user query when the coupon has no cap", async () => {
    prime({ maxUsesPerUser: null })
    await validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" })
    expect(prisma.couponUsage.count).not.toHaveBeenCalled()
  })
})

/* ──────────────────────────── stackability ──────────────────────────────── */

describe("validateCoupon — stackability", () => {
  it("refuses a non-stackable coupon when another coupon is already on the cart", async () => {
    prime({ stackable: false })
    prisma.cart.findUnique.mockResolvedValue({ id: "cart_1", appliedCoupon: { id: "c_2", code: "WELCOME", stackable: true } })
    await expect(validateCoupon("SAVE10", { cartTotal: 100, cartId: "cart_1" })).resolves.toMatchObject({
      valid: false,
      message: "Cannot stack with WELCOME — remove the current coupon first",
    })
  })

  it("allows re-applying the SAME non-stackable coupon", async () => {
    prime({ stackable: false })
    prisma.cart.findUnique.mockResolvedValue({ id: "cart_1", appliedCoupon: { id: "c_1", code: "SAVE10", stackable: false } })
    await expect(validateCoupon("SAVE10", { cartTotal: 100, cartId: "cart_1" })).resolves.toMatchObject({ valid: true })
  })

  it("allows a non-stackable coupon on a cart with no coupon yet", async () => {
    prime({ stackable: false })
    prisma.cart.findUnique.mockResolvedValue({ id: "cart_1", appliedCoupon: null })
    await expect(validateCoupon("SAVE10", { cartTotal: 100, cartId: "cart_1" })).resolves.toMatchObject({ valid: true })
  })

  it("skips the cart query entirely for a stackable coupon", async () => {
    prime({ stackable: true })
    await validateCoupon("SAVE10", { cartTotal: 100, cartId: "cart_1" })
    expect(prisma.cart.findUnique).not.toHaveBeenCalled()
  })

  it("skips the stackability check when no cartId is supplied", async () => {
    prime({ stackable: false })
    await validateCoupon("SAVE10", { cartTotal: 100 })
    expect(prisma.cart.findUnique).not.toHaveBeenCalled()
  })
})

/* ────────────────────────── success payload ─────────────────────────────── */

describe("validateCoupon — success payload", () => {
  it("returns the rounded discount and the serialized coupon", async () => {
    prime({ discountType: "percentage", discountValue: dec(33.333) })
    const res = await validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" })
    expect(res.valid).toBe(true)
    expect(res.discount).toBe(33.33)
    expect(res.message).toBe("Coupon applied successfully")
    expect(res.coupon).toMatchObject({ id: "c_1", code: "SAVE10", discountType: "percentage" })
  })

  it("never returns a coupon object on a failure path", async () => {
    for (const over of [{ isActive: false }, { usageLimit: 1, usedCount: 1 }, { expiresAt: new Date("2020-01-01") }]) {
      prime(over)
      const res = await validateCoupon("SAVE10", { cartTotal: 100, userId: "u_1" })
      expect(res).toMatchObject({ valid: false, discount: 0, coupon: null })
    }
  })

  it("returns a zero discount for an empty cart without failing", async () => {
    prime({ discountType: "fixed", discountValue: dec(10) })
    await expect(validateCoupon("SAVE10", { cartTotal: 0, userId: "u_1" }))
      .resolves.toMatchObject({ valid: true, discount: 0 })
  })
})
