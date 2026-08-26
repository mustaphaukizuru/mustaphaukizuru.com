/**
 * services/couponService — admin CRUD (createCoupon / updateCoupon).
 *
 * Q1 (part 2). couponService sat at 41% branch coverage. On reading, the
 * uncovered range was the ADMIN side -- validateCoupon and calculateDiscount
 * (the money path) were already covered by couponValidate.test.js. This file
 * covers the branches an admin can hit while editing coupons, because a
 * coupon saved wrong is still a money bug: a percentage over 100, a
 * non-positive value, or a duplicate code all reach customers.
 */

jest.mock("../src/lib/prisma", () => ({
  coupon: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const { createCoupon, updateCoupon } = require("../src/services/couponService")

const row = (over = {}) => ({
  id: "c1", code: "SAVE10", description: null, discountType: "percentage", discountValue: 10,
  maxUses: null, maxUsesPerUser: null, usedCount: 0, minOrderAmount: null,
  startsAt: null, expiresAt: null, isActive: true, deletedAt: null,
  createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-01"),
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.coupon.findUnique.mockResolvedValue(null)
  prisma.coupon.create.mockImplementation(async ({ data }) => row({ ...data, id: "c-new" }))
  prisma.coupon.update.mockImplementation(async ({ where, data }) => row({ ...where, ...data }))
})

describe("createCoupon — validation branches", () => {
  test.each([
    ["missing code", { discountType: "percentage", discountValue: 10 }, /code is required/i],
    ["blank code", { code: "   ", discountType: "percentage", discountValue: 10 }, /code is required/i],
    ["bad discountType", { code: "X", discountType: "bogo", discountValue: 10 }, /percentage.*fixed/],
    ["zero value", { code: "X", discountType: "fixed", discountValue: 0 }, /positive number/],
    ["negative value", { code: "X", discountType: "fixed", discountValue: -5 }, /positive number/],
    ["non-numeric value", { code: "X", discountType: "fixed", discountValue: "abc" }, /positive number/],
    ["percentage over 100", { code: "X", discountType: "percentage", discountValue: 150 }, /cannot exceed 100/],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_label, input, msg) => {
    await expect(createCoupon(input)).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
    await expect(createCoupon(input)).rejects.toThrow(msg)
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  test("a duplicate code is a 409 CONFLICT, checked against the NORMALISED code", async () => {
    prisma.coupon.findUnique.mockResolvedValue(row({ code: "SAVE10" }))

    await expect(createCoupon({ code: "  save10 ", discountType: "fixed", discountValue: 5 }))
      .rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 })
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  test("a valid coupon is created with normalised code and sane defaults", async () => {
    const out = await createCoupon({ code: " welcome20 ", discountType: "percentage", discountValue: "20" })

    const data = prisma.coupon.create.mock.calls[0][0].data
    expect(data.code).toBe("WELCOME20")
    expect(data.discountType).toBe("percentage")
    expect(data.discountValue).toBe(20)
    expect(data.isActive).toBe(true)          // omitted -> active
    expect(data.maxUsesPerUser).toBeNull()    // omitted -> unlimited per user
    expect(data.startsAt).toBeNull()
    expect(data.expiresAt).toBeNull()
    expect(out).toMatchObject({ code: "WELCOME20", discountType: "percentage" })
  })

  test("explicit fields are coerced: dates to Date, per-user cap to Number, isActive:false honoured", async () => {
    await createCoupon({
      code: "SPRING", discountType: "fixed", discountValue: 50,
      maxUsesPerUser: "2", startsAt: "2026-09-01", expiresAt: "2026-09-30", isActive: false,
    })
    const data = prisma.coupon.create.mock.calls[0][0].data
    expect(data.maxUsesPerUser).toBe(2)
    expect(data.startsAt).toBeInstanceOf(Date)
    expect(data.expiresAt).toBeInstanceOf(Date)
    expect(data.isActive).toBe(false)
  })
})

describe("updateCoupon — branches", () => {
  test("unknown id returns null and writes nothing", async () => {
    prisma.coupon.findUnique.mockResolvedValue(null)
    await expect(updateCoupon("nope", { description: "x" })).resolves.toBeNull()
    expect(prisma.coupon.update).not.toHaveBeenCalled()
  })

  test("changing the code to one that already exists is a 409", async () => {
    prisma.coupon.findUnique
      .mockResolvedValueOnce(row({ id: "c1", code: "OLD" }))   // the coupon being edited
      .mockResolvedValueOnce(row({ id: "c2", code: "TAKEN" })) // the collision
    await expect(updateCoupon("c1", { code: "taken" })).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 })
    expect(prisma.coupon.update).not.toHaveBeenCalled()
  })

  test("re-saving the SAME code does not trip the collision check", async () => {
    prisma.coupon.findUnique.mockResolvedValueOnce(row({ id: "c1", code: "SAME" }))
    await updateCoupon("c1", { code: " same " })
    // Only the initial lookup — no second findUnique for a collision.
    expect(prisma.coupon.findUnique).toHaveBeenCalledTimes(1)
    expect(prisma.coupon.update).toHaveBeenCalled()
  })

  test("a bad discountType on update is a 400", async () => {
    prisma.coupon.findUnique.mockResolvedValueOnce(row())
    await expect(updateCoupon("c1", { discountType: "bogo" })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
  })

  test("only provided fields are written; an empty description clears to null", async () => {
    prisma.coupon.findUnique.mockResolvedValueOnce(row())
    await updateCoupon("c1", { description: "" })
    const data = prisma.coupon.update.mock.calls[0][0].data
    expect(data).toHaveProperty("description", null)
    expect(data).not.toHaveProperty("discountValue")
    expect(data).not.toHaveProperty("code")
  })
})
