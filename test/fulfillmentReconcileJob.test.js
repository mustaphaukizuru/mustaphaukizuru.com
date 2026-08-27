/**
 * fulfillmentReconcileJob — paid orders with no `order.fulfilled` marker are
 * handed back to fulfillOrder; everything else is left alone; the pass is
 * bounded and never throws.
 */
jest.mock("../src/lib/prisma", () => ({
  order:       { findMany: jest.fn() },
  activityLog: { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/orderFulfillmentService", () => ({ fulfillOrder: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { fulfillOrder } = require("../src/services/orderFulfillmentService")
const { runFulfillmentReconcilePass, QUIET_MINUTES, LOOKBACK_DAYS } = require("../src/jobs/fulfillmentReconcileJob")

const NOW = new Date("2026-08-27T12:00:00Z")

beforeEach(() => {
  jest.clearAllMocks()
  fulfillOrder.mockResolvedValue({ ok: true, entitlements: 1 })
})

test("scans only paid orders in the quiet window and re-fulfils the unmarked ones", async () => {
  prisma.order.findMany.mockResolvedValue([{ id: "o1", orderNumber: "A1" }, { id: "o2", orderNumber: "A2" }, { id: "o3", orderNumber: "A3" }])
  prisma.activityLog.findMany.mockResolvedValue([{ entityId: "o2" }])

  const summary = await runFulfillmentReconcilePass({ now: NOW })

  const where = prisma.order.findMany.mock.calls[0][0].where
  expect(where.status).toBe("paid")
  expect(where.paidAt.lte.getTime()).toBe(NOW.getTime() - QUIET_MINUTES * 60 * 1000)
  expect(where.paidAt.gte.getTime()).toBe(NOW.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  expect(prisma.order.findMany.mock.calls[0][0].take).toBeGreaterThan(0)

  expect(prisma.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { action: "order.fulfilled", entityType: "Order", entityId: { in: ["o1", "o2", "o3"] } },
  }))
  expect(fulfillOrder).toHaveBeenCalledTimes(2)
  expect(fulfillOrder).toHaveBeenCalledWith("o1")
  expect(fulfillOrder).toHaveBeenCalledWith("o3")
  expect(summary).toEqual({ scanned: 3, missing: 2, fulfilled: 2, failed: 0 })
})

test("nothing to do when every paid order carries its marker", async () => {
  prisma.order.findMany.mockResolvedValue([{ id: "o1" }])
  prisma.activityLog.findMany.mockResolvedValue([{ entityId: "o1" }])
  const summary = await runFulfillmentReconcilePass({ now: NOW })
  expect(fulfillOrder).not.toHaveBeenCalled()
  expect(summary).toEqual({ scanned: 1, missing: 0, fulfilled: 0, failed: 0 })
})

test("a failed re-fulfilment is counted, not thrown", async () => {
  prisma.order.findMany.mockResolvedValue([{ id: "o1" }])
  prisma.activityLog.findMany.mockResolvedValue([])
  fulfillOrder.mockResolvedValue({ ok: false, error: "boom" })
  const summary = await runFulfillmentReconcilePass({ now: NOW })
  expect(summary).toEqual({ scanned: 1, missing: 1, fulfilled: 0, failed: 1 })
})

test("a DB error during the scan returns an empty summary instead of throwing", async () => {
  prisma.order.findMany.mockRejectedValue(new Error("db down"))
  await expect(runFulfillmentReconcilePass({ now: NOW })).resolves.toEqual({ scanned: 0, missing: 0, fulfilled: 0, failed: 0 })
  expect(fulfillOrder).not.toHaveBeenCalled()
})
