// ─────────────────────────────────────────────────────────────────────────────
// adminInvoiceService — manual invoices: validation, the pending Order +
// service line + issued Invoice written atomically, audit row, issued email
// and notification, void rules. ensureInvoice marks storefront invoices paid.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:         { create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderItem:     { create: jest.fn() },
    invoice:       { create: jest.fn(), update: jest.fn() },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  return {
    serviceOrder: { findUnique: jest.fn() },
    order:        { findUnique: jest.fn() },
    // T5-4 · a manual invoice now looks up the project behind its
    // ServiceOrder, so the email and the timeline can name the work rather
    // than a bare order number.
    clientProject: { findFirst: jest.fn().mockResolvedValue(null) },
    projectEvent:  { create: jest.fn().mockResolvedValue({ id: "ev1" }) },
    invoice:      { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({ notify: jest.fn().mockResolvedValue(null) }))
// invoiceService writes PDFs — stub the filesystem + pdfkit so ensureInvoice
// only exercises the row logic.
jest.mock("fs", () => ({ existsSync: jest.fn(() => true), mkdirSync: jest.fn(), createWriteStream: jest.fn() }))
jest.mock("pdfkit", () => function PDFDocument() {})

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const { notify } = require("../src/services/notificationService")
const svc = require("../src/services/adminInvoiceService")
const { ensureInvoice } = require("../src/services/invoiceService")

const SO = {
  id: "so1", serviceId: "svc1",
  user:    { id: "u1", fullName: "Ana Pérez", email: "ana@example.com", profile: { locale: "es" } },
  service: { id: "svc1", title: "Website build" },
  order:   { id: "o0", currency: "USD" },
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.INVOICE_LATE_FEE_RATE
  prisma.serviceOrder.findUnique.mockResolvedValue(SO)
  prisma.order.findUnique.mockResolvedValue(null)           // order number free
  prisma.invoice.findFirst.mockResolvedValue({ invoiceNumber: "INV-2026-00041" })
  prisma.__tx.order.create.mockImplementation(async ({ data }) => ({ id: "o1", ...data }))
  prisma.__tx.orderItem.create.mockImplementation(async ({ data }) => ({ id: "oi1", ...data }))
  prisma.__tx.invoice.create.mockImplementation(async ({ data }) => ({ id: "i1", issuedAt: new Date(), ...data }))
})

describe("createManualInvoice", () => {
  const input = { serviceOrderId: "so1", amount: "1500.5", dueDate: "2026-09-15", description: "Phase 2 balance", adminUserId: "admin1" }

  test("writes pending Order + service line + issued Invoice + audit row in one transaction", async () => {
    const r = await svc.createManualInvoice(input)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const order = prisma.__tx.order.create.mock.calls[0][0].data
    expect(order).toMatchObject({ userId: "u1", customerEmail: "ana@example.com", status: "pending", subtotalAmount: 1500.5, totalAmount: 1500.5, currency: "USD", notes: "Phase 2 balance" })
    expect(order.orderNumber).toMatch(/^INV-\d{8}-[A-Z0-9]{6}$/)

    const item = prisma.__tx.orderItem.create.mock.calls[0][0].data
    expect(item).toMatchObject({ orderId: "o1", itemType: "service", serviceId: "svc1", title: "Phase 2 balance", quantity: 1, unitPrice: 1500.5, lineTotal: 1500.5 })

    const inv = prisma.__tx.invoice.create.mock.calls[0][0].data
    expect(inv).toMatchObject({ orderId: "o1", invoiceNumber: "INV-2026-00042", status: "issued", serviceOrderId: "so1", lateFeeRate: 0.02, invoicePdfUrl: "/api/orders/o1/invoice.pdf" })
    expect(inv.dueDate).toEqual(new Date("2026-09-15"))

    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ adminUserId: "admin1", action: "invoice.issued", targetType: "Invoice", targetId: "i1" })

    // no tax module → taxRate 0, amount is the total
    expect(r).toMatchObject({ orderId: "o1", taxRate: 0 })
    expect(r.invoice).toMatchObject({ invoiceNumber: "INV-2026-00042", status: "issued", order: { id: "o1", totalAmount: 1500.5 } })
  })

  test("emails invoice.issued in the client's locale with the pay link and notifies in-app", async () => {
    await svc.createManualInvoice(input)
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
    const mail = sendTemplateEmail.mock.calls[0][0]
    expect(mail).toMatchObject({ to: "ana@example.com", templateKey: "invoice.issued", userId: "u1", locale: "es" })
    expect(mail.variables).toMatchObject({ customerName: "Ana", invoiceNumber: "INV-2026-00042", description: "Phase 2 balance" })
    expect(mail.variables.orderUrl).toMatch(/\/dashboard\/orders\/o1$/)
    expect(notify).toHaveBeenCalledWith("u1", expect.objectContaining({ linkUrl: "/dashboard/orders/o1" }))
  })

  test("falls back to a service-based title and honours INVOICE_LATE_FEE_RATE", async () => {
    process.env.INVOICE_LATE_FEE_RATE = "0.1"
    await svc.createManualInvoice({ ...input, description: "" })
    expect(prisma.__tx.orderItem.create.mock.calls[0][0].data.title).toBe("Invoice — Website build")
    expect(prisma.__tx.invoice.create.mock.calls[0][0].data.lateFeeRate).toBe(0.1)
  })

  test.each([
    ["missing serviceOrderId", { ...input, serviceOrderId: "" }],
    ["zero amount",            { ...input, amount: 0 }],
    ["negative amount",        { ...input, amount: -5 }],
    ["NaN amount",             { ...input, amount: "abc" }],
    ["bad dueDate",            { ...input, dueDate: "not-a-date" }],
    ["missing dueDate",        { ...input, dueDate: "" }],
  ])("rejects %s with VALIDATION_ERROR before touching the DB", async (_label, bad) => {
    await expect(svc.createManualInvoice(bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("unknown service order → 404", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(null)
    await expect(svc.createManualInvoice(input)).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
  })
})

describe("voidInvoice", () => {
  test("voids an issued invoice and cancels its pending order", async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: "i1", status: "overdue", order: { id: "o1", status: "pending" } })
    prisma.__tx.invoice.update.mockResolvedValue({ id: "i1", status: "void" })
    const r = await svc.voidInvoice({ invoiceId: "i1", adminUserId: "admin1" })
    expect(r.status).toBe("void")
    expect(prisma.__tx.order.updateMany).toHaveBeenCalledWith({ where: { id: "o1", status: "pending" }, data: { status: "cancelled" } })
  })
  test("refuses to void a paid invoice", async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: "i1", status: "paid", order: { id: "o1", status: "paid" } })
    await expect(svc.voidInvoice({ invoiceId: "i1", adminUserId: "admin1" })).rejects.toMatchObject({ code: "INVALID_STATE", statusCode: 409 })
  })
})

describe("ensureInvoice (storefront)", () => {
  const paidOrder = { id: "o7", status: "paid", paidAt: new Date("2026-08-01T00:00:00Z"), items: [], payments: [], user: null }

  test("creates a storefront invoice as paid with paidAt", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder)
    prisma.invoice.findUnique.mockResolvedValue(null)
    prisma.invoice.create.mockImplementation(async ({ data }) => ({ id: "i7", ...data }))
    const inv = await ensureInvoice("o7")
    expect(prisma.invoice.create.mock.calls[0][0].data).toMatchObject({ orderId: "o7", invoiceNumber: "INV-2026-00042", status: "paid", paidAt: paidOrder.paidAt })
    expect(inv.status).toBe("paid")
  })

  test("flips an existing manual invoice to paid once its order is paid (late fee kept)", async () => {
    prisma.order.findUnique.mockResolvedValue(paidOrder)
    prisma.invoice.findUnique.mockResolvedValue({ id: "i8", invoiceNumber: "INV-2026-00010", status: "overdue", lateFeeAmount: 20, paidAt: null })
    prisma.invoice.update.mockImplementation(async ({ data }) => ({ id: "i8", invoiceNumber: "INV-2026-00010", ...data }))
    const inv = await ensureInvoice("o7")
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: "i8" }, data: { status: "paid", paidAt: paidOrder.paidAt } })
    expect(prisma.invoice.create).not.toHaveBeenCalled()
    expect(inv.status).toBe("paid")
  })
})
