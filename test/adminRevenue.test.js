/**
 * src/services/adminRevenueService — Tier 4 revenue reporting.
 *
 * Pinned:
 *   - orders bucket by paidAt month in UTC, including across a year boundary
 *   - the series is zero-filled for every month in range, oldest first
 *   - refunded amounts come from succeeded Refund rows and net = gross - refunded
 *   - refundRate is a % of orders, refundAmountRate a % of gross
 *   - service items roll up per service and per package (via ServiceOrder)
 *   - products are top-10 by revenue
 *   - MRR is always null with an explanatory note (no recurrence engine)
 *   - the empty state is all zeros, never NaN
 */

jest.mock("../src/lib/prisma", () => ({ order: { findMany: jest.fn() } }))

const prisma = require("../src/lib/prisma")
const { getRevenueReport, monthKey, MAX_ORDERS } = require("../src/services/adminRevenueService")

const NOW = new Date("2026-02-15T12:00:00Z")

function order({ id, paidAt, total, status = "paid", items = [], refunds = [], serviceOrders = [] }) {
  return { id, paidAt: new Date(paidAt), totalAmount: total, currency: "MXN", status, items, refunds, serviceOrders }
}
const product = (id, title, lineTotal, quantity = 1) => ({ id: `oi-${id}`, itemType: "product", productId: id, serviceId: null, title, lineTotal, quantity })
const service = (oiId, serviceId, title, lineTotal) => ({ id: oiId, itemType: "service", productId: null, serviceId, title, lineTotal, quantity: 1 })

beforeEach(() => jest.clearAllMocks())

test("buckets paid orders by paidAt month across a year boundary and zero-fills the range", async () => {
  prisma.order.findMany.mockResolvedValueOnce([
    order({ id: "a", paidAt: "2026-01-01T00:00:00Z", total: 100 }),  // first instant of Jan
    order({ id: "b", paidAt: "2025-12-31T23:59:59Z", total: 50 }),   // last second of Dec
    order({ id: "c", paidAt: "2026-02-10T08:00:00Z", total: 25 }),
  ])

  const r = await getRevenueReport({ months: 3, now: NOW })

  expect(r.series.map((s) => s.month)).toEqual(["2025-12", "2026-01", "2026-02"])
  expect(r.series.map((s) => s.gross)).toEqual([50, 100, 25])
  expect(r.series.map((s) => s.count)).toEqual([1, 1, 1])
  expect(r.kpis).toMatchObject({ orders: 3, gross: 175, net: 175, aov: 58.33 })
  expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
    take: MAX_ORDERS,
    where: expect.objectContaining({ status: { in: ["paid", "refunded"] }, paidAt: { gte: new Date("2025-12-01T00:00:00Z") } }),
  }))
})

test("refunds reduce net and drive both refund rates; mrr stays null", async () => {
  prisma.order.findMany.mockResolvedValueOnce([
    order({ id: "a", paidAt: "2026-02-01T00:00:00Z", total: 200, status: "refunded", refunds: [{ amount: 200 }] }),
    order({ id: "b", paidAt: "2026-02-02T00:00:00Z", total: 100 }),
    order({ id: "c", paidAt: "2026-02-03T00:00:00Z", total: 100 }),
    order({ id: "d", paidAt: "2026-02-04T00:00:00Z", total: 100 }),
  ])

  const r = await getRevenueReport({ months: 1, now: NOW })

  expect(r.series).toEqual([{ month: "2026-02", gross: 500, refunded: 200, net: 300, count: 4 }])
  expect(r.kpis.refundRate).toBe(25)          // 1 of 4 orders
  expect(r.kpis.refundAmountRate).toBe(40)    // 200 of 500
  expect(r.kpis.refundedOrders).toBe(1)
  expect(r.kpis.mrr).toBeNull()
  expect(r.kpis.mrrNote).toMatch(/no recurrence engine/i)
})

test("rolls service items up per service and per package, and ranks products", async () => {
  prisma.order.findMany.mockResolvedValueOnce([
    order({
      id: "a", paidAt: "2026-02-01T00:00:00Z", total: 1500,
      items: [service("oi-1", "svc-web", "Web build", 1500)],
      serviceOrders: [{ orderItemId: "oi-1", servicePackageId: "pkg-pro", servicePackage: { name: "Pro" } }],
    }),
    order({
      id: "b", paidAt: "2026-02-02T00:00:00Z", total: 700,
      items: [service("oi-2", "svc-web", "Web build", 500), product("p1", "Ebook", 200, 2)],
      serviceOrders: [{ orderItemId: "oi-2", servicePackageId: "pkg-basic", servicePackage: { name: "Basic" } }],
    }),
    order({ id: "c", paidAt: "2026-02-03T00:00:00Z", total: 300, items: [product("p2", "Template", 300)] }),
  ])

  const r = await getRevenueReport({ months: 1, now: NOW })

  expect(r.services).toEqual([{ serviceId: "svc-web", name: "Web build", revenue: 2000, count: 2 }])
  expect(r.packages.map((p) => [p.name, p.revenue])).toEqual([["Pro", 1500], ["Basic", 500]])
  expect(r.topProducts.map((p) => [p.title, p.revenue, p.count])).toEqual([["Template", 300, 1], ["Ebook", 200, 2]])
})

test("empty state is zeros, not NaN", async () => {
  prisma.order.findMany.mockResolvedValueOnce([])
  const r = await getRevenueReport({ months: 2, now: NOW })
  expect(r.kpis).toMatchObject({ orders: 0, gross: 0, net: 0, aov: 0, refundRate: 0, refundAmountRate: 0, mrr: null })
  expect(r.series).toEqual([
    { month: "2026-01", gross: 0, refunded: 0, net: 0, count: 0 },
    { month: "2026-02", gross: 0, refunded: 0, net: 0, count: 0 },
  ])
  expect(r.services).toEqual([]); expect(r.packages).toEqual([]); expect(r.topProducts).toEqual([])
  expect(r.truncated).toBe(false)
})

test("months is clamped to 1..36", async () => {
  prisma.order.findMany.mockResolvedValue([])
  expect((await getRevenueReport({ months: 0, now: NOW })).months).toBe(1)
  expect((await getRevenueReport({ months: 999, now: NOW })).months).toBe(36)
  expect((await getRevenueReport({ months: "nope", now: NOW })).months).toBe(12)
  expect(monthKey(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12")
})
