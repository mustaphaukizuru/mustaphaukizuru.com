// ─────────────────────────────────────────────────────────────────────────────
// T1 · service catalogue source of truth
//
//   1. GET /services/plans shape — serviceService.listAudiencePlans builds
//      { audiences: [{ code, serviceSlug, tiers: [...] }] } from Service +
//      ServicePackage rows, in professional → business → schools order.
//   2. orderByTier no longer auto-provisions: unknown plan → 404 PLAN_NOT_FOUND
//      with the seed hint, and nothing is created.
//   3. orderByTier ignores the client price (warns on drift) and delegates to
//      createServiceOrder with the DB package id.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  service:        { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  servicePackage: { findFirst: jest.fn(), create: jest.fn() },
  user:           { findUnique: jest.fn() },
  order:          { findUnique: jest.fn() },
  activityLog:    { create: jest.fn(() => ({ catch: () => null })) },
  $transaction:   jest.fn(),
}))

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}))

jest.mock("../src/services/authService", () => ({
  findOrCreateUserForCheckout: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const { findOrCreateUserForCheckout } = require("../src/services/authService")
const serviceService = require("../src/services/serviceService")
const serviceOrderService = require("../src/services/serviceOrderService")

const { Decimal } = require("@prisma/client/runtime/library")

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────── GET /services/plans ───────────────────────── */

describe("listAudiencePlans — endpoint shape", () => {
  test("maps Service + ServicePackage rows into { audiences: [...] } in canonical order", async () => {
    prisma.service.findMany.mockResolvedValueOnce([
      {
        slug: "schools-plan", audienceCode: "schools", currency: "MXN",
        packages: [
          { id: "pkg_s_basic", tierKey: "basic", name: "Basic", price: new Decimal("24000.00"), currency: "MXN", period: "month", popular: false, saveLabel: "Foundations" },
        ],
      },
      {
        slug: "professional-plan", audienceCode: "professional", currency: "MXN",
        packages: [
          { id: "pkg_p_basic",  tierKey: "basic",  name: "Basic",  price: new Decimal("5800.00"),  currency: "MXN", period: "month", popular: false, saveLabel: "Best to start" },
          { id: "pkg_p_medium", tierKey: "medium", name: "Medium", price: new Decimal("11800.00"), currency: null,  period: null,    popular: true,  saveLabel: null },
        ],
      },
    ])

    const result = await serviceService.listAudiencePlans()

    expect(result).toEqual({
      audiences: [
        {
          code: "professional", serviceSlug: "professional-plan",
          tiers: [
            { packageId: "pkg_p_basic",  tierKey: "basic",  name: "Basic",  price: 5800,  currency: "MXN", period: "month", popular: false, saveLabel: "Best to start" },
            { packageId: "pkg_p_medium", tierKey: "medium", name: "Medium", price: 11800, currency: "MXN", period: null,    popular: true,  saveLabel: null },
          ],
        },
        {
          code: "schools", serviceSlug: "schools-plan",
          tiers: [
            { packageId: "pkg_s_basic", tierKey: "basic", name: "Basic", price: 24000, currency: "MXN", period: "month", popular: false, saveLabel: "Foundations" },
          ],
        },
      ],
    })

    // Only published, non-deleted audience services with active, keyed packages.
    const call = prisma.service.findMany.mock.calls[0][0]
    expect(call.where).toEqual({ audienceCode: { not: null }, status: "published", deletedAt: null })
    expect(call.select.packages.where).toEqual({ isActive: true, tierKey: { not: null } })
  })

  test("returns an empty audiences array before the seed has run", async () => {
    prisma.service.findMany.mockResolvedValueOnce([])
    await expect(serviceService.listAudiencePlans()).resolves.toEqual({ audiences: [] })
  })
})

/* ─────────────────────────── orderByTier ───────────────────────────────── */

const DB_PKG = {
  id: "pkg_p_medium", tierKey: "medium", name: "Medium",
  price: new Decimal("11800.00"), currency: "MXN", isActive: true,
  service: { id: "svc_pro", slug: "professional-plan" },
}

function primeCreateServiceOrder() {
  // createServiceOrder's own reads + transaction, stubbed just enough.
  prisma.service.findFirst.mockResolvedValueOnce({
    id: "svc_pro", slug: "professional-plan", title: "Professional Plan", currency: "MXN", status: "published",
    packages: [{ id: DB_PKG.id, name: "Medium", price: DB_PKG.price, currency: "MXN", isActive: true, description: null }],
  })
  prisma.user.findUnique.mockResolvedValueOnce({ id: "user_1", fullName: "Ada", email: "ada@example.com" })
  prisma.order.findUnique.mockResolvedValueOnce(null)
  prisma.$transaction.mockImplementationOnce(async (cb) => cb({
    order:        { create: jest.fn(async ({ data }) => ({ id: "order_1", orderNumber: data.orderNumber, currency: data.currency, totalAmount: data.totalAmount })) },
    orderItem:    { create: jest.fn(async ({ data }) => ({ id: "item_1", ...data })) },
    serviceOrder: { create: jest.fn(async ({ data }) => ({ id: "so_1", ...data })) },
  }))
}

describe("orderByTier — no auto-provisioning", () => {
  test("unknown (audience, tier) → 404 PLAN_NOT_FOUND with the seed hint; nothing is created", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(null)

    await expect(serviceOrderService.orderByTier({
      audience: "professional", tier: "platinum", price: 1,
      customerEmail: "ada@example.com", userId: "user_1",
    })).rejects.toMatchObject({
      statusCode: 404, code: "PLAN_NOT_FOUND",
      message: expect.stringContaining("npm run seed:plans"),
    })

    expect(prisma.service.create).not.toHaveBeenCalled()
    expect(prisma.servicePackage.create).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    // The plan is resolved before any guest account could be created.
    expect(findOrCreateUserForCheckout).not.toHaveBeenCalled()
  })

  test("unknown packageId with no (audience, tier) → 404 PLAN_NOT_FOUND", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(null)
    await expect(serviceOrderService.orderByTier({
      packageId: "pkg_stale", customerEmail: "ada@example.com", userId: "user_1",
    })).rejects.toMatchObject({ statusCode: 404, code: "PLAN_NOT_FOUND" })
    expect(prisma.servicePackage.findFirst).toHaveBeenCalledTimes(1)
  })

  test("missing packageId and audience/tier → 400 VALIDATION_ERROR", async () => {
    await expect(serviceOrderService.orderByTier({
      customerEmail: "ada@example.com", userId: "user_1",
    })).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
    expect(prisma.servicePackage.findFirst).not.toHaveBeenCalled()
  })
})

describe("orderByTier — DB price wins", () => {
  test("client price is ignored (warn on drift) and createServiceOrder runs with the DB package", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(DB_PKG)
    primeCreateServiceOrder()

    const result = await serviceOrderService.orderByTier({
      audience: "professional", tier: "medium",
      planName: "Professional · Medium",
      price: 1, currency: "MXN",              // tampered / stale client price
      customerName: "Ada", customerEmail: "ada@example.com", userId: "user_1",
    })

    // Resolved by (audience, tier) against the published service.
    const where = prisma.servicePackage.findFirst.mock.calls[0][0].where
    expect(where.tierKey).toBe("medium")
    expect(where.service).toMatchObject({ slug: "professional-plan", status: "published", deletedAt: null })

    // Charged amount is the DB price, not 1.
    expect(result).toMatchObject({ orderId: "order_1", serviceOrderId: "so_1", amount: 11800, currency: "MXN" })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("drift"),
      expect.objectContaining({ clientPrice: 1, dbPrice: 11800, packageId: "pkg_p_medium" }),
    )
    // Delegation to createServiceOrder: service looked up by slug/published, package by DB id.
    expect(prisma.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "professional-plan", status: "published" },
    }))
    expect(prisma.service.create).not.toHaveBeenCalled()
    expect(prisma.servicePackage.create).not.toHaveBeenCalled()
  })

  test("packageId is preferred; a matching legacy priceUsd does not warn", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(DB_PKG)
    primeCreateServiceOrder()

    const result = await serviceOrderService.orderByTier({
      packageId: "pkg_p_medium", priceUsd: 11800,
      customerName: "Ada", customerEmail: "ada@example.com", userId: "user_1",
    })

    expect(prisma.servicePackage.findFirst.mock.calls[0][0].where).toMatchObject({ id: "pkg_p_medium", isActive: true })
    expect(result.amount).toBe(11800)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test("guest flow still auto-creates the account, after the plan is resolved", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(DB_PKG)
    findOrCreateUserForCheckout.mockResolvedValueOnce({ user: { id: "user_guest" } })
    primeCreateServiceOrder()

    const result = await serviceOrderService.orderByTier({
      packageId: "pkg_p_medium", customerName: "Guest", customerEmail: "guest@example.com",
    })

    expect(findOrCreateUserForCheckout).toHaveBeenCalledWith({ fullName: "Guest", email: "guest@example.com" })
    expect(result.orderId).toBe("order_1")
  })

  test("guest email belonging to a claimed account → 401 ACCOUNT_EXISTS", async () => {
    prisma.servicePackage.findFirst.mockResolvedValueOnce(DB_PKG)
    findOrCreateUserForCheckout.mockResolvedValueOnce({ requiresLogin: true })

    await expect(serviceOrderService.orderByTier({
      packageId: "pkg_p_medium", customerEmail: "claimed@example.com",
    })).rejects.toMatchObject({ statusCode: 401, code: "ACCOUNT_EXISTS" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
