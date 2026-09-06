// ─────────────────────────────────────────────────────────────────────────────
// T5-9 · paying a bill from where the work is.
//
// The new surface is a PIN portal that can now start a payment, which sounds
// like a widening and is the opposite: the only thing it can do is send money
// TO us, for an amount this server decided, on an order the portal's own
// project is already billed through. Every test in the first block is one way
// that could be untrue.
//
// The second half is the timeline. "invoice.paid" and "invoice.overdue" have
// been in the event catalogue since T5-2 and nothing ever wrote either, so a
// client read "Invoice issued" and then silence — including silence about
// owing money. "payment.initiated" is new and exists because OXXO and SPEI
// are not instant: a client who paid at a shop on Friday and sees nothing
// until Monday assumes it failed and pays twice.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  invoice: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  clientProject: { findUnique: jest.fn(), findFirst: jest.fn() },
  changeRequest: { findFirst: jest.fn() },
  projectEvent: { findFirst: jest.fn(), create: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/mercadoPagoService", () => ({
  createMercadoPagoPreference: jest.fn(),
}))
jest.mock("../src/services/projectEventService", () => ({
  record: jest.fn().mockResolvedValue({ id: "e1" }),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const { createMercadoPagoPreference } = require("../src/services/mercadoPagoService")
const projectEvents = require("../src/services/projectEventService")
const projectInvoices = require("../src/services/projectInvoiceService")
const { payInvoice } = require("../src/controllers/portalController")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const PROJECT_ID = "p1"
const OWNER_ID = "u1"

// asyncHandler returns undefined, so awaiting the handler proves nothing —
// the settle promise is what actually waits for the response.
const run = (invoiceId = "inv1") => new Promise((resolve, reject) => {
  const req = { params: { invoiceId }, portal: { projectId: PROJECT_ID, userId: OWNER_ID } }
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; resolve(res); return res }
  payInvoice(req, res, (e) => (e ? reject(e) : resolve(res)))
})

const INVOICE = (over = {}) => ({
  id: "inv1", invoiceNumber: "A-000142", status: "issued",
  orderId: "o1", serviceOrderId: "so1", ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  // loadBillingLinks reads the project; this one is billed through so1/o1.
  prisma.clientProject.findUnique.mockResolvedValue({
    id: PROJECT_ID, serviceOrderId: "so1", accessState: "active",
    serviceOrder: { orderId: "o1" }, changeRequests: [],
  })
  prisma.invoice.findUnique.mockResolvedValue(INVOICE())
  prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "pending" })
  prisma.clientProject.findFirst.mockResolvedValue({ id: PROJECT_ID, projectId: PROJECT_ID })
  prisma.changeRequest.findFirst.mockResolvedValue(null)
  prisma.projectEvent.findFirst.mockResolvedValue(null)
  createMercadoPagoPreference.mockResolvedValue({ preferenceId: "pref1", initPoint: "https://mp.test/checkout" })
})

describe("what a PIN session may start a payment for", () => {
  test("its own project's unpaid invoice, and it returns the gateway URL", async () => {
    const res = await run()
    expect(res.statusCode).toBe(200)
    expect(res.body.data.redirectUrl).toBe("https://mp.test/checkout")
  })

  test("the amount and the order are the SERVER's, never the caller's", async () => {
    // The request carries an invoice id and nothing else. This is the whole
    // security argument: there is no field here to tamper with.
    await run()
    expect(createMercadoPagoPreference).toHaveBeenCalledWith({ orderId: "o1", userId: OWNER_ID })
  })

  test("it reuses the member pay path rather than a second implementation", () => {
    // "No new payment code" is not a slogan: the preference, the ownership
    // check inside it, the idempotency key and the webhook are the ones
    // already written and tested.
    const controller = read("src", "controllers", "portalController.js")
    expect(controller).toContain("createMercadoPagoPreference({ orderId: order.id, userId: req.portal.userId })")
  })

  test("an invoice from ANOTHER project answers 404, not 403", async () => {
    // Same answer as "no such invoice". A distinguishable 403 confirms the
    // id exists, which is the enumeration oracle the portal closes elsewhere.
    prisma.invoice.findUnique.mockResolvedValue(INVOICE({ orderId: "other", serviceOrderId: "other-so" }))
    const res = await run()
    expect(res.statusCode).toBe(404)
    expect(createMercadoPagoPreference).not.toHaveBeenCalled()
  })

  test("an invoice that does not exist answers identically", async () => {
    prisma.invoice.findUnique.mockResolvedValue(null)
    const res = await run()
    expect(res.statusCode).toBe(404)
  })

  test("a PAID invoice cannot be paid again", async () => {
    // The single worst outcome available at this endpoint.
    prisma.invoice.findUnique.mockResolvedValue(INVOICE({ status: "paid" }))
    const res = await run()
    expect(res.statusCode).toBe(409)
    expect(res.body.error.code).toBe("INVOICE_NOT_PAYABLE")
    expect(createMercadoPagoPreference).not.toHaveBeenCalled()
  })

  test("an overdue invoice CAN — that is the one most likely to be paid here", async () => {
    prisma.invoice.findUnique.mockResolvedValue(INVOICE({ status: "overdue" }))
    expect((await run()).statusCode).toBe(200)
  })

  test("a cancelled order refuses even while the invoice still says issued", async () => {
    // The stale-order janitor cancels a pending order after 24h. A
    // preference for a cancelled order is a payment nobody will fulfil.
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "cancelled" })
    const res = await run()
    expect(res.statusCode).toBe(409)
    expect(createMercadoPagoPreference).not.toHaveBeenCalled()
  })

  test("a gateway that returns no URL is a 502, not a silent success", async () => {
    createMercadoPagoPreference.mockResolvedValue({ preferenceId: "pref1" })
    const res = await run()
    expect(res.statusCode).toBe(502)
  })

  test("the route carries portalAuth and the payment limiter", () => {
    // A preference is an outbound request to Mercado Pago, and this door
    // opens with six digits.
    const routes = read("src", "routes", "portalRoutes.js")
    expect(routes).toMatch(/router\.post\("\/me\/invoices\/:invoiceId\/pay",\s*portalAuth,\s*paymentRateLimiter/)
  })
})

describe("who gets a Pay button, decided on the server", () => {
  const serialize = (invoice, opts) => projectInvoices.serializeInvoice(invoice, opts)

  test("a member is sent to the order page that already pays invoices", () => {
    expect(serialize(INVOICE())).toMatchObject({ pay: { mode: "link", url: "/dashboard/orders/o1" } })
  })

  test("a portal visitor gets an endpoint, because that page needs a session they do not have", () => {
    expect(serialize(INVOICE(), { portal: true }))
      .toMatchObject({ pay: { mode: "api", url: "/api/v1/portal/me/invoices/inv1/pay" } })
  })

  test("a paid invoice offers nothing at all", () => {
    expect(serialize(INVOICE({ status: "paid" })).pay).toBeNull()
    expect(serialize(INVOICE({ status: "draft" })).pay).toBeNull()
  })

  test("an invoice with no order behind it offers nothing either", () => {
    expect(serialize(INVOICE({ orderId: null })).pay).toBeNull()
  })
})

describe("the timeline finally says what happened to the money", () => {
  test("payment.initiated is recorded against the project the order belongs to", async () => {
    await projectInvoices.recordPaymentInitiated("o1", { gateway: "mercadopago" })
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      projectId: PROJECT_ID, type: "payment.initiated", actorRole: "client",
    }))
  })

  test("a client bouncing off the gateway and back is one attempt, not four rows", async () => {
    prisma.projectEvent.findFirst.mockResolvedValue({ id: "already" })
    await projectInvoices.recordPaymentInitiated("o1")
    expect(projectEvents.record).not.toHaveBeenCalled()
  })

  test("an order that is not billed through a project records nothing", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.changeRequest.findFirst.mockResolvedValue(null)
    await projectInvoices.recordPaymentInitiated("o-store")
    expect(projectEvents.record).not.toHaveBeenCalled()
  })

  test("an order raised by an accepted change request is found too", async () => {
    // A project is billed through two kinds of order and both are its money.
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.changeRequest.findFirst.mockResolvedValue({ projectId: "p9" })
    await projectInvoices.recordPaymentInitiated("o-extra")
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p9" }))
  })

  test("invoice.paid and invoice.overdue name the invoice", async () => {
    await projectInvoices.recordInvoicePaid(INVOICE())
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      type: "invoice.paid", actorRole: "system", detail: "A-000142",
    }))
    projectEvents.record.mockClear()
    await projectInvoices.recordInvoiceOverdue(INVOICE({ status: "overdue" }))
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({ type: "invoice.overdue" }))
  })

  test("a recorder that throws never propagates — the money already moved", async () => {
    projectEvents.record.mockRejectedValue(new Error("db down"))
    await expect(projectInvoices.recordInvoicePaid(INVOICE())).resolves.toBeNull()
    await expect(projectInvoices.recordPaymentInitiated("o1")).resolves.toBeNull()
  })

  test("money events are client-visible, never public", () => {
    // A shared tracking code must not tell a client's own staff what they
    // are charged or that they are behind on payment.
    const svc = read("src", "services", "projectEventService.js")
    const block = svc.slice(svc.indexOf('"payment.initiated"'))
    expect(block.slice(0, 200)).toContain('visibility: "client"')
  })

  test("both transitions are wired where the invoice actually changes", () => {
    // The webhook path goes through ensureInvoice; the reconcile pass in the
    // dunning job is the other way an invoice becomes paid.
    expect(read("src", "services", "invoiceService.js")).toContain("recordInvoicePaid(invoice)")
    const dunning = read("src", "jobs", "invoiceDunningJob.js")
    expect(dunning).toContain("recordInvoicePaid(inv)")
    expect(dunning).toContain("recordInvoiceOverdue(inv)")
    // Only on a real transition — updateMany's count is the guard.
    expect(dunning).toContain("if (r.count === 1) await recordInvoicePaid(inv)")
  })
})
