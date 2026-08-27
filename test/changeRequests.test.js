// ─────────────────────────────────────────────────────────────────────────────
// changeRequestService — client asks for extra work, admin quotes (email +
// notification), client accepts (payable Order + service line + ServiceOrder
// + milestone, atomically) or declines. Writes go through the portal
// lifecycle guard; fulfillOrder never opens a second project for the order.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:            { create: jest.fn() },
    orderItem:        { create: jest.fn() },
    serviceOrder:     { create: jest.fn() },
    projectMilestone: { findFirst: jest.fn(), create: jest.fn() },
    changeRequest:    { update: jest.fn() },
  }
  return {
    clientProject:    { findFirst: jest.fn(), findUnique: jest.fn() },
    changeRequest:    { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    order:            { findUnique: jest.fn().mockResolvedValue(null) },
    activityLog:      { create: jest.fn().mockResolvedValue({}) },
    $transaction:     jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({
  notify:                      jest.fn().mockResolvedValue(null),
  notifyAdminsProjectActivity: jest.fn().mockResolvedValue([]),
}))

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const notif = require("../src/services/notificationService")
const svc = require("../src/services/changeRequestService")

const owned = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: "a1", ...over,
})
const cr = (over = {}) => ({
  id: "cr1", projectId: "p1", requestedById: "u1", title: "Spanish landing", description: "Translate the landing page",
  status: "requested", quoteAmount: null, quoteCurrency: "MXN", quoteNote: null, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findFirst.mockResolvedValue(owned())
  prisma.changeRequest.create.mockImplementation(async ({ data }) => ({ id: "cr1", ...data }))
  prisma.changeRequest.update.mockImplementation(async ({ data }) => ({ id: "cr1", ...cr(), ...data }))
  prisma.__tx.order.create.mockImplementation(async ({ data }) => ({ id: "o9", ...data }))
  prisma.__tx.orderItem.create.mockImplementation(async ({ data }) => ({ id: "oi9", ...data }))
  prisma.__tx.serviceOrder.create.mockImplementation(async ({ data }) => ({ id: "so9", ...data }))
  prisma.__tx.projectMilestone.findFirst.mockResolvedValue({ sortOrder: 2 })
  prisma.__tx.projectMilestone.create.mockImplementation(async ({ data }) => ({ id: "m9", ...data }))
  prisma.__tx.changeRequest.update.mockImplementation(async ({ data }) => ({ ...cr(), ...data }))
})

describe("createRequest (client)", () => {
  test("creates a requested row, logs and notifies admins", async () => {
    const r = await svc.createRequest({ userId: "u1", projectId: "p1", title: "  Spanish landing ", description: "Translate it" })
    expect(prisma.changeRequest.create.mock.calls[0][0].data).toEqual({ projectId: "p1", requestedById: "u1", title: "Spanish landing", description: "Translate it", status: "requested" })
    expect(r.status).toBe("requested")
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "changeRequest" }))
  })
  test("validates title and description", async () => {
    await expect(svc.createRequest({ userId: "u1", projectId: "p1", title: "", description: "x" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    await expect(svc.createRequest({ userId: "u1", projectId: "p1", title: "x", description: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(prisma.changeRequest.create).not.toHaveBeenCalled()
  })
  test("closed project → 409 PROJECT_CLOSED; foreign project → 404", async () => {
    prisma.clientProject.findFirst.mockResolvedValueOnce(owned({ closedAt: new Date() }))
    await expect(svc.createRequest({ userId: "u1", projectId: "p1", title: "x", description: "y" })).rejects.toMatchObject({ code: "PROJECT_CLOSED", statusCode: 409 })
    prisma.clientProject.findFirst.mockResolvedValueOnce(null)
    await expect(svc.createRequest({ userId: "u2", projectId: "p1", title: "x", description: "y" })).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
  })
})

describe("quoteRequest (admin)", () => {
  const project = {
    id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress", closedAt: null, updatedAt: new Date(), assignedAdminId: "a1",
    user: { id: "u1", fullName: "Ana Pérez", email: "ana@example.com", profile: { locale: "es" } },
    serviceOrder: { order: { currency: "USD" } },
  }
  beforeEach(() => {
    prisma.clientProject.findUnique.mockResolvedValue(project)
    prisma.changeRequest.findFirst.mockResolvedValue(cr())
  })

  test("stores the quote (project currency by default), emails the client in their locale and notifies", async () => {
    const r = await svc.quoteRequest({ projectId: "p1", crId: "cr1", amount: "250.505", note: " 2 days of work ", adminId: "a1" })
    expect(prisma.changeRequest.update.mock.calls[0][0]).toMatchObject({
      where: { id: "cr1" },
      data:  expect.objectContaining({ status: "quoted", quoteAmount: 250.51, quoteCurrency: "USD", quoteNote: "2 days of work", declinedAt: null }),
    })
    expect(r.status).toBe("quoted")
    const mail = sendTemplateEmail.mock.calls[0][0]
    expect(mail).toMatchObject({ to: "ana@example.com", templateKey: "project.change-request-quoted", userId: "u1", locale: "es" })
    expect(mail.variables).toMatchObject({ customerName: "Ana", projectName: "Site rebuild", requestTitle: "Spanish landing", quoteAmount: "$250.51", quoteNote: "2 days of work" })
    expect(mail.variables.dashboardUrl).toMatch(/\/dashboard\/projects\/p1$/)
    expect(notif.notify).toHaveBeenCalledWith("u1", expect.objectContaining({ linkUrl: "/dashboard/projects/p1" }))
  })
  test("rejects a non-positive amount and non-open requests; unknown request → 404", async () => {
    await expect(svc.quoteRequest({ projectId: "p1", crId: "cr1", amount: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "accepted" }))
    await expect(svc.quoteRequest({ projectId: "p1", crId: "cr1", amount: 10 })).rejects.toMatchObject({ code: "INVALID_STATE", statusCode: 409 })
    prisma.changeRequest.findFirst.mockResolvedValueOnce(null)
    await expect(svc.quoteRequest({ projectId: "p1", crId: "nope", amount: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(prisma.changeRequest.update).not.toHaveBeenCalled()
  })
})

describe("acceptRequest (client)", () => {
  const quoted = cr({ status: "quoted", quoteAmount: 300, quoteCurrency: "USD", quoteNote: "ok" })
  const full = {
    id: "p1", projectName: "Site rebuild",
    user: { id: "u1", fullName: "Ana Pérez", email: "ana@example.com" },
    serviceOrder: { id: "so1", serviceId: "svc1", servicePackageId: "pkg1", order: { currency: "USD" } },
  }
  beforeEach(() => {
    prisma.changeRequest.findFirst.mockResolvedValue(quoted)
    prisma.clientProject.findUnique.mockResolvedValue(full)
  })

  test("creates Order + service line + ServiceOrder + milestone and links them on the request, in one transaction", async () => {
    const r = await svc.acceptRequest({ userId: "u1", projectId: "p1", crId: "cr1" })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const order = prisma.__tx.order.create.mock.calls[0][0].data
    expect(order).toMatchObject({ userId: "u1", customerEmail: "ana@example.com", status: "pending", subtotalAmount: 300, totalAmount: 300, currency: "USD", notes: "ok" })
    expect(order.orderNumber).toMatch(/^SRV-\d{8}-[A-Z0-9]{6}$/)
    expect(prisma.__tx.orderItem.create.mock.calls[0][0].data).toMatchObject({ orderId: "o9", itemType: "service", serviceId: "svc1", title: "Site rebuild — Spanish landing", unitPrice: 300, lineTotal: 300, quantity: 1 })
    expect(prisma.__tx.serviceOrder.create.mock.calls[0][0].data).toMatchObject({ orderId: "o9", orderItemId: "oi9", userId: "u1", serviceId: "svc1", servicePackageId: "pkg1", status: "new" })
    expect(prisma.__tx.projectMilestone.create.mock.calls[0][0].data).toMatchObject({ projectId: "p1", title: "Spanish landing", status: "pending", sortOrder: 3 })
    expect(prisma.__tx.changeRequest.update.mock.calls[0][0]).toMatchObject({ where: { id: "cr1" }, data: expect.objectContaining({ status: "accepted", orderId: "o9", milestoneId: "m9" }) })

    expect(r).toMatchObject({ orderId: "o9", serviceOrderId: "so9", milestoneId: "m9", amount: 300, currency: "USD", redirectUrl: "/dashboard/orders/o9" })
    expect(r.changeRequest.status).toBe("accepted")
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "changeRequestAccepted" }))
  })
  test("only quoted requests can be accepted; closed projects refuse", async () => {
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "requested" }))
    await expect(svc.acceptRequest({ userId: "u1", projectId: "p1", crId: "cr1" })).rejects.toMatchObject({ code: "INVALID_STATE", statusCode: 409 })
    prisma.clientProject.findFirst.mockResolvedValueOnce(owned({ closedAt: new Date() }))
    await expect(svc.acceptRequest({ userId: "u1", projectId: "p1", crId: "cr1" })).rejects.toMatchObject({ code: "PROJECT_CLOSED" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
  test("a project without a linked service cannot turn a quote into an order", async () => {
    prisma.clientProject.findUnique.mockResolvedValueOnce({ ...full, serviceOrder: null })
    await expect(svc.acceptRequest({ userId: "u1", projectId: "p1", crId: "cr1" })).rejects.toMatchObject({ code: "NO_SERVICE", statusCode: 409 })
  })
})

describe("declineRequest (client) / markDone (admin)", () => {
  test("declines requested or quoted; refuses accepted", async () => {
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "quoted" }))
    const r = await svc.declineRequest({ userId: "u1", projectId: "p1", crId: "cr1", note: "too pricey" })
    expect(r.status).toBe("declined")
    expect(prisma.changeRequest.update.mock.calls[0][0].data).toMatchObject({ status: "declined" })
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "changeRequestDeclined" }))
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "accepted" }))
    await expect(svc.declineRequest({ userId: "u1", projectId: "p1", crId: "cr1" })).rejects.toMatchObject({ code: "INVALID_STATE" })
  })
  test("markDone only from accepted", async () => {
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "accepted" }))
    expect((await svc.markDone({ projectId: "p1", crId: "cr1" })).status).toBe("done")
    prisma.changeRequest.findFirst.mockResolvedValueOnce(cr({ status: "quoted" }))
    await expect(svc.markDone({ projectId: "p1", crId: "cr1" })).rejects.toMatchObject({ code: "INVALID_STATE" })
  })
})

describe("listMine", () => {
  test("scopes to the owner's project and returns numeric quotes", async () => {
    prisma.changeRequest.findMany.mockResolvedValue([cr({ quoteAmount: { toNumber: () => 12.5 } })])
    const rows = await svc.listMine({ userId: "u1", projectId: "p1" })
    expect(prisma.clientProject.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "u1" })
    expect(rows[0].quoteAmount).toBe(12.5)
  })
})
