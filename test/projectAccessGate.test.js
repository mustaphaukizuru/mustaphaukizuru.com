// ─────────────────────────────────────────────────────────────────────────────
// Tier 4 · kill switch & handover gate
//   - dunning job suspends projects whose invoices are overdue past the grace
//     period and reinstates suspended projects once everything is paid
//   - member projection omits previewUrl while suspended; deliverables 402
//   - admin PATCH to handover is refused (409) with unpaid invoices
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  invoice:       { findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  clientProject: { findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({
  notify: jest.fn().mockResolvedValue(null),
  notifyAdminsProjectActivity: jest.fn(), notifyProjectComment: jest.fn(), notifyMilestoneAwaitingClient: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const { notify } = require("../src/services/notificationService")
const portal = require("../src/services/projectPortalService")
const { runProjectAccessPass, runInvoiceDunningPass } = require("../src/jobs/invoiceDunningJob")
const { updateAdminProject } = require("../src/services/clientProjectService")

const NOW = new Date("2026-08-26T08:00:00Z")
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.PROJECT_SUSPEND_GRACE_DAYS
  prisma.invoice.findMany.mockResolvedValue([])
  prisma.invoice.updateMany.mockResolvedValue({ count: 1 })
  prisma.invoice.count.mockReset().mockResolvedValue(0)
  prisma.clientProject.findMany.mockReset().mockResolvedValue([])
  prisma.clientProject.updateMany.mockResolvedValue({ count: 1 })
})

describe("suspend", () => {
  test("project linked to an invoice overdue longer than the grace period (default 14 d) is suspended and the client notified", async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([{ serviceOrderId: "so1", orderId: "oInv" }, { serviceOrderId: null, orderId: "oCr" }])
    prisma.clientProject.findMany
      .mockResolvedValueOnce([{ id: "p1", userId: "u1", projectName: "Site rebuild" }])  // to suspend
      .mockResolvedValueOnce([])                                                        // none suspended to reinstate

    const r = await runProjectAccessPass({ now: NOW })

    expect(r).toEqual({ suspended: 1, reinstated: 0 })
    const invWhere = prisma.invoice.findMany.mock.calls[0][0].where
    expect(invWhere.status).toBe("overdue")
    expect(invWhere.dueDate.lt.getTime()).toBe(NOW.getTime() - 14 * DAY)

    const projWhere = prisma.clientProject.findMany.mock.calls[0][0].where
    expect(projWhere.accessState).toBe("active")
    expect(projWhere.OR).toEqual([
      { serviceOrderId: { in: ["so1"] } },
      { serviceOrder: { orderId: { in: ["oInv", "oCr"] } } },
      { changeRequests: { some: { orderId: { in: ["oInv", "oCr"] } } } },
    ])
    expect(prisma.clientProject.updateMany).toHaveBeenCalledWith({ where: { id: "p1", accessState: "active" }, data: { accessState: "suspended" } })
    expect(notify).toHaveBeenCalledWith("u1", expect.objectContaining({ linkUrl: "/dashboard/projects/p1" }))
  })

  test("PROJECT_SUSPEND_GRACE_DAYS drives the cutoff; nothing overdue → no project query", async () => {
    process.env.PROJECT_SUSPEND_GRACE_DAYS = "3"
    await runProjectAccessPass({ now: NOW })
    expect(prisma.invoice.findMany.mock.calls[0][0].where.dueDate.lt.getTime()).toBe(NOW.getTime() - 3 * DAY)
    // findMany for projects is only the reinstate query
    expect(prisma.clientProject.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.clientProject.findMany.mock.calls[0][0].where).toEqual({ accessState: "suspended" })
  })

  test("handover projects are never suspended (query filters accessState=active) and a lost race is not counted", async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([{ serviceOrderId: "so1", orderId: "o1" }])
    prisma.clientProject.findMany.mockResolvedValueOnce([{ id: "p1", userId: "u1", projectName: "X" }]).mockResolvedValueOnce([])
    prisma.clientProject.updateMany.mockResolvedValueOnce({ count: 0 })
    const r = await runProjectAccessPass({ now: NOW })
    expect(r.suspended).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })
})

describe("reinstate", () => {
  const suspended = { id: "p2", userId: "u2", projectName: "Shop", serviceOrderId: "so2", serviceOrder: { orderId: "o2" }, changeRequests: [{ orderId: "o3" }] }

  test("suspended project with every invoice paid goes back to active", async () => {
    prisma.clientProject.findMany.mockResolvedValueOnce([suspended])
    prisma.invoice.count.mockResolvedValueOnce(0)
    const r = await runProjectAccessPass({ now: NOW })
    expect(r).toEqual({ suspended: 0, reinstated: 1 })
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { status: { in: ["issued", "overdue"] }, OR: [{ serviceOrderId: "so2" }, { orderId: { in: ["o2", "o3"] } }] },
    })
    expect(prisma.clientProject.updateMany).toHaveBeenCalledWith({ where: { id: "p2", accessState: "suspended" }, data: { accessState: "active" } })
    expect(notify).toHaveBeenCalledWith("u2", expect.objectContaining({ linkUrl: "/dashboard/projects/p2" }))
  })

  test("stays suspended while any invoice is unpaid", async () => {
    prisma.clientProject.findMany.mockResolvedValueOnce([suspended])
    prisma.invoice.count.mockResolvedValueOnce(1)
    const r = await runProjectAccessPass({ now: NOW })
    expect(r.reinstated).toBe(0)
    expect(prisma.clientProject.updateMany).not.toHaveBeenCalled()
  })

  test("full dunning pass reports the access counters", async () => {
    prisma.invoice.findMany.mockResolvedValue([])
    const r = await runInvoiceDunningPass({ now: NOW })
    expect(r).toMatchObject({ reconciled: 0, overdue: 0, emailed: 0, suspended: 0, reinstated: 0 })
  })
})

describe("member API projection", () => {
  const lc = { readOnly: false, isClosed: false, expiresAt: null }
  const project = { id: "p1", projectName: "X", previewUrl: "https://preview.example.com", files: [] }

  test("suspended → previewUrl omitted, previewCanFrame false, access.state exposed", () => {
    const out = portal.presentForMember({ ...project, accessState: "suspended" }, lc)
    expect(out.previewUrl).toBeNull()
    expect(out.previewCanFrame).toBe(false)
    expect(out.access).toEqual({ readOnly: false, isClosed: false, expiresAt: null, state: "suspended", suspended: true, handover: false })
  })
  test("active keeps the preview; handover flag surfaces", () => {
    process.env.PREVIEW_FRAME_HOSTS = "https://preview.example.com"
    const active = portal.presentForMember({ ...project, accessState: "active" }, lc)
    expect(active.previewUrl).toBe("https://preview.example.com")
    expect(active.previewCanFrame).toBe(true)
    expect(active.access.state).toBe("active")
    const hand = portal.presentForMember({ ...project, accessState: "handover" }, lc)
    expect(hand.access).toMatchObject({ state: "handover", handover: true, suspended: false })
    delete process.env.PREVIEW_FRAME_HOSTS
  })
  test("legacy rows without accessState are treated as active", () => {
    expect(portal.presentForMember({ ...project }, lc).access.state).toBe("active")
  })
})

describe("deliverable download gate", () => {
  test("402 PAYMENT_REQUIRED for a deliverable on a suspended project; plain files and other states pass", () => {
    expect(() => portal.assertDeliverableAccess({ accessState: "suspended" }, { isDeliverable: true }))
      .toThrow(expect.objectContaining({ code: "PAYMENT_REQUIRED", statusCode: 402 }))
    expect(() => portal.assertDeliverableAccess({ accessState: "suspended" }, { isDeliverable: false })).not.toThrow()
    expect(() => portal.assertDeliverableAccess({ accessState: "active" }, { isDeliverable: true })).not.toThrow()
    expect(() => portal.assertDeliverableAccess({ accessState: "handover" }, { isDeliverable: true })).not.toThrow()
  })
})

describe("admin handover gate", () => {
  const links = { id: "p1", serviceOrderId: "so1", accessState: "active", serviceOrder: { orderId: "o1" }, changeRequests: [{ orderId: "o9" }] }
  beforeEach(() => {
    prisma.clientProject.findUnique.mockResolvedValue(links)
    prisma.clientProject.update.mockImplementation(async ({ data }) => ({ id: "p1", ...data }))
  })

  test("PATCH accessState=handover with unpaid invoices → 409 UNPAID_INVOICES, nothing written", async () => {
    prisma.invoice.count.mockResolvedValueOnce(2)
    await expect(updateAdminProject("p1", { accessState: "handover" })).rejects.toMatchObject({ code: "UNPAID_INVOICES", statusCode: 409, details: { unpaid: 2 } })
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { status: { in: ["issued", "overdue"] }, OR: [{ serviceOrderId: "so1" }, { orderId: { in: ["o1", "o9"] } }] },
    })
    expect(prisma.clientProject.update).not.toHaveBeenCalled()
  })
  test("handover with a zero balance is written; suspended/active need no balance check", async () => {
    prisma.invoice.count.mockResolvedValueOnce(0)
    const r = await updateAdminProject("p1", { accessState: "handover" })
    expect(prisma.clientProject.update.mock.calls[0][0].data).toEqual({ accessState: "handover" })
    expect(r.accessState).toBe("handover")
    await updateAdminProject("p1", { accessState: "suspended" })
    expect(prisma.invoice.count).toHaveBeenCalledTimes(1)
  })
  test("unknown state → 400 VALIDATION_ERROR", async () => {
    await expect(updateAdminProject("p1", { accessState: "paused" })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
  })
  test("countUnpaidInvoices on a project with no billing links is 0", async () => {
    prisma.clientProject.findUnique.mockResolvedValueOnce({ id: "p3", serviceOrderId: null, serviceOrder: null, changeRequests: [] })
    expect(await portal.countUnpaidInvoices("p3")).toBe(0)
    expect(prisma.invoice.count).not.toHaveBeenCalled()
  })
})
