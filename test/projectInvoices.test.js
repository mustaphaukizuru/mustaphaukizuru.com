// ─────────────────────────────────────────────────────────────────────────────
// T5-4 · invoices, beside the work.
//
// Nothing new is billed here. The invoices already existed on the project's
// service order; the client just found them on a bare order page with no way
// to tell which project they belonged to.
//
// The part worth guarding is the PORTAL download. The order-scoped PDF route
// gates on an owner-or-admin check against a session, and a portal holder has
// none — so this adds a second gate, and a second gate on the same asset is
// exactly where an authorisation bug lives.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  invoice: { findMany: jest.fn(), findUnique: jest.fn() },
}))

jest.mock("../src/services/projectPortalService", () => ({
  loadBillingLinks: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const { loadBillingLinks } = require("../src/services/projectPortalService")
const projectInvoices = require("../src/services/projectInvoiceService")

const links = (over = {}) => ({
  id: "p1", serviceOrderId: "so1", orderIds: ["o1", "o2"], accessState: "active", ...over,
})

const invoice = (over = {}) => ({
  id: "inv1",
  orderId: "o1",
  serviceOrderId: "so1",
  invoiceNumber: "A-000123",
  status: "issued",
  currency: "MXN",
  subtotalAmount: "1000.00",
  taxAmount: "160.00",
  totalAmount: "1160.00",
  lateFeeAmount: "0.00",
  issuedAt: new Date("2026-08-01T00:00:00Z"),
  dueDate: new Date("2026-09-12T00:00:00Z"),
  paidAt: null,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  loadBillingLinks.mockResolvedValue(links())
})

describe("listing", () => {
  test("reads every order the project is billed through", async () => {
    prisma.invoice.findMany.mockResolvedValue([invoice()])
    await projectInvoices.listForProject("p1")
    const { where } = prisma.invoice.findMany.mock.calls[0][0]
    // The service order AND the change-request orders — a project can be
    // billed through both.
    expect(where.OR).toEqual([
      { serviceOrderId: "so1" },
      { orderId: { in: ["o1", "o2"] } },
    ])
  })

  test("amounts come off the invoice's own snapshot, as numbers", async () => {
    // The snapshot columns exist so an invoice does not change when the order
    // later does — a refund, an edit. Reading the order instead would show a
    // client a different total from the PDF they were sent.
    prisma.invoice.findMany.mockResolvedValue([invoice()])
    const { invoices } = await projectInvoices.listForProject("p1")
    expect(invoices[0]).toMatchObject({
      invoiceNumber: "A-000123", currency: "MXN",
      subtotalAmount: 1000, taxAmount: 160, totalAmount: 1160,
    })
  })

  test("voided invoices are not shown", async () => {
    // Kept for the audit trail; showing a client a cancelled bill invites a
    // payment nobody wants.
    prisma.invoice.findMany.mockResolvedValue([invoice(), invoice({ id: "inv2", status: "void" })])
    const { invoices } = await projectInvoices.listForProject("p1")
    expect(invoices.map((i) => i.id)).toEqual(["inv1"])
  })

  test("a project with no billing links reads as zero, not as an error", async () => {
    loadBillingLinks.mockResolvedValue(links({ serviceOrderId: null, orderIds: [] }))
    const out = await projectInvoices.listForProject("p1")
    expect(out.invoices).toEqual([])
    expect(out.billing.unpaidCount).toBe(0)
    expect(prisma.invoice.findMany).not.toHaveBeenCalled()
  })

  test("an unknown project reads as zero rather than throwing", async () => {
    loadBillingLinks.mockResolvedValue(null)
    await expect(projectInvoices.listForProject("nope")).resolves.toMatchObject({ invoices: [] })
  })
})

describe("the billing summary", () => {
  test("counts only unpaid, and names the soonest due date", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      invoice({ id: "a", status: "paid", paidAt: new Date(), dueDate: new Date("2026-07-01T00:00:00Z") }),
      invoice({ id: "b", status: "issued", dueDate: new Date("2026-10-01T00:00:00Z"), totalAmount: "500.00" }),
      invoice({ id: "c", status: "overdue", dueDate: new Date("2026-09-12T00:00:00Z"), totalAmount: "250.00" }),
    ])
    const { billing } = await projectInvoices.listForProject("p1")
    expect(billing.unpaidCount).toBe(2)
    // So the UI can say "2 invoices, next due 12 Sep" instead of making the
    // client scan a table.
    expect(billing.nextDueAt).toBe(new Date("2026-09-12T00:00:00Z").toISOString())
    expect(billing.unpaidTotal).toBe(750)
  })

  test("overdue counts as unpaid, in the same sense the handover gate uses", async () => {
    prisma.invoice.findMany.mockResolvedValue([invoice({ status: "overdue" })])
    const { billing } = await projectInvoices.listForProject("p1")
    expect(billing.unpaidCount).toBe(1)
    expect(projectInvoices.UNPAID_STATUSES).toEqual(["issued", "overdue"])
  })

  test("nothing unpaid means no due date rather than a stale one", async () => {
    prisma.invoice.findMany.mockResolvedValue([invoice({ status: "paid", paidAt: new Date() })])
    const { billing } = await projectInvoices.listForProject("p1")
    expect(billing).toEqual({ unpaidCount: 0, nextDueAt: null, unpaidTotal: 0 })
  })
})

describe("download links", () => {
  test("a member is sent to the existing owner-checked order route", async () => {
    // Not a second copy of "may this person have this PDF".
    prisma.invoice.findMany.mockResolvedValue([invoice()])
    const { invoices } = await projectInvoices.listForProject("p1")
    expect(invoices[0].downloadUrl).toBe("/api/v1/orders/o1/invoice.pdf")
  })

  test("a portal viewer gets the portal route, which has its own gate", async () => {
    prisma.invoice.findMany.mockResolvedValue([invoice()])
    const { invoices } = await projectInvoices.listForProject("p1", { portal: true })
    expect(invoices[0].downloadUrl).toBe("/api/v1/portal/me/invoices/inv1/pdf")
  })
})

describe("the portal's own authorisation check", () => {
  test("an invoice on this project's service order is allowed", async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice())
    await expect(projectInvoices.findForProject("inv1", "p1")).resolves.toBeTruthy()
  })

  test("an invoice on one of the project's change-request orders is allowed", async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice({ serviceOrderId: null, orderId: "o2" }))
    await expect(projectInvoices.findForProject("inv1", "p1")).resolves.toBeTruthy()
  })

  test("SOMEONE ELSE'S invoice is refused", async () => {
    // The whole reason this function exists. A portal token is scoped to one
    // project; an invoice id is guessable in the way any id is.
    prisma.invoice.findUnique.mockResolvedValue(invoice({ serviceOrderId: "OTHER", orderId: "OTHER" }))
    await expect(projectInvoices.findForProject("inv1", "p1")).resolves.toBeNull()
  })

  test("a missing invoice and a foreign one answer identically", async () => {
    prisma.invoice.findUnique.mockResolvedValue(null)
    expect(await projectInvoices.findForProject("nope", "p1")).toBeNull()
    prisma.invoice.findUnique.mockResolvedValue(invoice({ serviceOrderId: "OTHER", orderId: "OTHER" }))
    expect(await projectInvoices.findForProject("inv1", "p1")).toBeNull()
  })

  test("a voided invoice is not downloadable either", async () => {
    prisma.invoice.findUnique.mockResolvedValue(invoice({ status: "void" }))
    await expect(projectInvoices.findForProject("inv1", "p1")).resolves.toBeNull()
  })

  test("missing arguments refuse rather than querying", async () => {
    expect(await projectInvoices.findForProject(null, "p1")).toBeNull()
    expect(await projectInvoices.findForProject("inv1", null)).toBeNull()
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled()
  })
})

describe("the routes are guarded", () => {
  const fs = require("fs")
  const path = require("path")
  const ROOT = path.join(__dirname, "..")

  test("the member route sits behind protect", () => {
    const routes = fs.readFileSync(path.join(ROOT, "src", "routes", "memberClientProjectRoutes.js"), "utf8")
    expect(routes).toContain("router.use(protect)")
    expect(routes).toMatch(/router\.get\("\/:id\/invoices"/)
  })

  test("the member handler checks ownership before reading billing", () => {
    // Without it any signed-in member could list any project's invoices by id.
    const controller = fs.readFileSync(path.join(ROOT, "src", "controllers", "clientProjectController.js"), "utf8")
    const block = controller.slice(controller.indexOf("const listInvoices"))
    const own = block.indexOf("loadOwnedProject")
    const read = block.indexOf("projectInvoices.listForProject")
    expect(own).toBeGreaterThan(-1)
    expect(own).toBeLessThan(read)
  })

  test("both portal routes sit behind portalAuth", () => {
    const routes = fs.readFileSync(path.join(ROOT, "src", "routes", "portalRoutes.js"), "utf8")
    expect(routes).toMatch(/router\.get\s*\("\/me\/invoices",\s*portalAuth/)
    expect(routes).toMatch(/router\.get\s*\("\/me\/invoices\/:invoiceId\/pdf",\s*portalAuth/)
  })

  test("the portal PDF is an attachment and is never cached", () => {
    const controller = fs.readFileSync(path.join(ROOT, "src", "controllers", "portalController.js"), "utf8")
    const block = controller.slice(controller.indexOf("const downloadInvoice"))
    expect(block).toContain('attachment; filename=')
    expect(block).toContain('"Cache-Control", "private, no-store"')
  })
})
