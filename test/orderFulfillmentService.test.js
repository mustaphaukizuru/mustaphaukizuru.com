/**
 * services/orderFulfillmentService — the post-payment hook.
 *
 * Q1. fulfillOrder runs every time an order flips to PAID, from either
 * gateway webhook or an admin mark-paid. Its uncovered branches were the
 * money-path ones: guest orders, idempotent re-runs (P2002), partial
 * failures that must NOT bounce a webhook, and the service-order →
 * ClientProject side-effects. Before this file the module sat at 48%
 * branch coverage.
 *
 * The contract pinned here, in the module's own words: idempotent, never
 * throws, every failure logged and returned as a structured result.
 */

jest.mock("../src/lib/prisma", () => ({
  order:            { findUnique: jest.fn() },
  userDownload:     { createMany: jest.fn() },
  activityLog:      { create: jest.fn() },
  serviceOrder:     { findMany: jest.fn() },
  clientProject:    { create: jest.fn() },
  projectMilestone: { createMany: jest.fn() },
  // Tier 4 · orders born from an accepted change request keep their project
  changeRequest:    { findFirst: jest.fn().mockResolvedValue(null) },
}))
jest.mock("../src/services/invoiceService", () => ({ ensureInvoice: jest.fn() }))
jest.mock("../src/services/notificationService", () => ({ notifyProjectCreated: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { ensureInvoice } = require("../src/services/invoiceService")
const { notifyProjectCreated } = require("../src/services/notificationService")
const {
  fulfillOrder,
  recordOrderEvent,
  autoCreateClientProjectsForOrder,
} = require("../src/services/orderFulfillmentService")

const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

const paidOrder = (over = {}) => ({
  id: "o1", orderNumber: "ORD-1", userId: "u1",
  items: [
    { id: "i1", itemType: "product", productId: "p1", product: { id: "p1", isActive: true } },
    { id: "i2", itemType: "product", productId: "p2", product: { id: "p2", isActive: true } },
    { id: "i3", itemType: "service", productId: null },
  ],
  ...over,
})

let errSpy
beforeEach(() => {
  jest.clearAllMocks()
  errSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  prisma.userDownload.createMany.mockResolvedValue({ count: 2 })
  prisma.activityLog.create.mockResolvedValue({})
  prisma.serviceOrder.findMany.mockResolvedValue([])
  prisma.projectMilestone.createMany.mockResolvedValue({ count: 5 })
  ensureInvoice.mockResolvedValue({ id: "inv1" })
  notifyProjectCreated.mockResolvedValue(null)
})
afterEach(() => errSpy.mockRestore())

describe("fulfillOrder", () => {
  test("creates one entitlement per PRODUCT item, skips service items, and records the event", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder())

    const r = await fulfillOrder("o1")

    expect(r).toMatchObject({ ok: true, entitlements: 2, invoice: { id: "inv1" }, projectsCreated: 0 })
    // T1-4 · one write for the whole order, duplicates skipped by the database
    expect(prisma.userDownload.createMany).toHaveBeenCalledTimes(1)
    const call = prisma.userDownload.createMany.mock.calls[0][0]
    expect(call.skipDuplicates).toBe(true)
    expect(call.data.map((d) => d.productId).sort()).toEqual(["p1", "p2"])
    expect(call.data[0]).toEqual({ userId: "u1", productId: "p1", orderId: "o1", orderItemId: "i1" })
    expect(prisma.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "order.fulfilled", userId: "u1" }),
    }))
  })

  test("a guest order creates no entitlements but still gets an invoice", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder({ userId: null }))

    const r = await fulfillOrder("o1")

    expect(r.ok).toBe(true)
    expect(r.entitlements).toBe(0)
    expect(r.invoice).toEqual({ id: "inv1" })
    expect(r.error).toMatch(/Guest order/)
    expect(prisma.userDownload.createMany).not.toHaveBeenCalled()
  })

  test("re-running is idempotent: an already-fulfilled item is skipped by the database and not counted", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder())
    prisma.userDownload.createMany.mockResolvedValueOnce({ count: 1 }) // p1 skipped as a duplicate, p2 new

    const r = await fulfillOrder("o1")

    expect(r.ok).toBe(true)
    expect(r.entitlements).toBe(1)
    expect(errSpy).not.toHaveBeenCalledWith(expect.stringContaining("entitlements failed"), expect.anything())
  })

  test("an entitlement write failure is logged and fulfilment still completes with zero entitlements", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder())
    prisma.userDownload.createMany.mockRejectedValueOnce(new Error("disk full"))

    const r = await fulfillOrder("o1")

    expect(r.ok).toBe(true)
    expect(r.entitlements).toBe(0)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("entitlements failed for order o1"), "disk full")
  })

  test("invoice generation failing does not fail fulfilment (a webhook must never bounce on a PDF)", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder())
    ensureInvoice.mockRejectedValue(new Error("pdf engine down"))

    const r = await fulfillOrder("o1")

    expect(r.ok).toBe(true)
    expect(r.invoice).toBeNull()
    expect(r.entitlements).toBe(2)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("invoice generation failed"), "pdf engine down")
  })

  test("an unknown order returns ok:false without throwing", async () => {
    prisma.order.findUnique.mockResolvedValue(null)
    await expect(fulfillOrder("nope")).resolves.toEqual({ ok: false, entitlements: 0, invoice: null, error: "Order not found" })
  })

  test("an unexpected error is caught and returned, never thrown", async () => {
    prisma.order.findUnique.mockRejectedValue(new Error("connection reset"))

    const r = await fulfillOrder("o1")

    expect(r).toEqual({ ok: false, entitlements: 0, invoice: null, error: "connection reset" })
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("unexpected error for order o1"), "connection reset")
  })

  test("service orders on the order become client projects", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder())
    prisma.serviceOrder.findMany.mockResolvedValue([{ id: "so1", service: { id: "s1", title: "Audit" } }])
    prisma.clientProject.create.mockResolvedValue({ id: "cp1" })

    const r = await fulfillOrder("o1")

    expect(r.projectsCreated).toBe(1)
    expect(prisma.clientProject.create).toHaveBeenCalledWith({
      data: { serviceOrderId: "so1", userId: "u1", projectName: "Audit", projectStatus: "planning", description: null },
    })
  })
})

describe("autoCreateClientProjectsForOrder", () => {
  test("an order created by an accepted change request never opens a second project", async () => {
    prisma.changeRequest.findFirst.mockResolvedValueOnce({ id: "cr1" })
    prisma.serviceOrder.findMany.mockResolvedValue([{ id: "so9", service: { id: "s1", title: "Audit" } }])
    const created = await autoCreateClientProjectsForOrder("o9", "u1")
    expect(created).toBe(0)
    expect(prisma.clientProject.create).not.toHaveBeenCalled()
    expect(prisma.changeRequest.findFirst).toHaveBeenCalledWith({ where: { orderId: "o9" }, select: { id: true } })
  })

  test("creates a project per service order, seeds the milestone scaffold, and notifies", async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([
      { id: "so1", service: { id: "s1", title: "Audit" } },
      { id: "so2", service: null },
    ])
    prisma.clientProject.create
      .mockResolvedValueOnce({ id: "cp1" })
      .mockResolvedValueOnce({ id: "cp2" })

    const created = await autoCreateClientProjectsForOrder("o1", "u1")

    expect(created).toBe(2)
    // A service with no title still gets a sane project name.
    expect(prisma.clientProject.create.mock.calls[1][0].data.projectName).toBe("New project")
    expect(prisma.projectMilestone.createMany).toHaveBeenCalledTimes(2)
    const scaffold = prisma.projectMilestone.createMany.mock.calls[0][0].data
    expect(scaffold.length).toBeGreaterThan(0)
    expect(scaffold.every((m, i) => m.projectId === "cp1" && m.status === "pending" && m.sortOrder === i)).toBe(true)
    expect(notifyProjectCreated).toHaveBeenCalledTimes(2)
    expect(notifyProjectCreated).toHaveBeenCalledWith("u1", { id: "cp1" })
  })

  test("a re-run (P2002) creates nothing and fires NO side-effects — no duplicate scaffold or repeat notification", async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([{ id: "so1", service: { id: "s1", title: "Audit" } }])
    prisma.clientProject.create.mockRejectedValue(p2002())

    const created = await autoCreateClientProjectsForOrder("o1", "u1")

    expect(created).toBe(0)
    expect(prisma.projectMilestone.createMany).not.toHaveBeenCalled()
    expect(notifyProjectCreated).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  test("a non-P2002 failure is logged and the loop continues to the next service order", async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([
      { id: "so1", service: { title: "A" } },
      { id: "so2", service: { title: "B" } },
    ])
    prisma.clientProject.create
      .mockRejectedValueOnce(new Error("fk violation"))
      .mockResolvedValueOnce({ id: "cp2" })

    const created = await autoCreateClientProjectsForOrder("o1", "u1")

    expect(created).toBe(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("auto-project failed for serviceOrder so1"), "fk violation")
    expect(notifyProjectCreated).toHaveBeenCalledWith("u1", { id: "cp2" })
  })

  test("scaffold and notification failures are best-effort and do not undo the created project", async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([{ id: "so1", service: { title: "A" } }])
    prisma.clientProject.create.mockResolvedValue({ id: "cp1" })
    prisma.projectMilestone.createMany.mockRejectedValue(new Error("scaffold boom"))
    notifyProjectCreated.mockRejectedValue(new Error("mail down"))

    const created = await autoCreateClientProjectsForOrder("o1", "u1")

    expect(created).toBe(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("milestone scaffold failed for project cp1"), "scaffold boom")
  })
})

describe("recordOrderEvent", () => {
  test("writes an activity-log row and swallows write failures", async () => {
    prisma.activityLog.create.mockResolvedValueOnce({ id: "a1" })
    await recordOrderEvent({ orderId: "o1", userId: "u1", action: "order.refunded", description: "x", ipAddress: "1.2.3.4" })
    // The order is recorded as a polymorphic entity (entityType/entityId),
    // not as an orderId column — that is what the timeline reads.
    expect(prisma.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entityType: "Order", entityId: "o1", userId: "u1", action: "order.refunded", ipAddress: "1.2.3.4" }),
    }))

    prisma.activityLog.create.mockRejectedValueOnce(new Error("log table locked"))
    await expect(recordOrderEvent({ orderId: "o1", action: "x" })).resolves.toBeNull()
  })
})
