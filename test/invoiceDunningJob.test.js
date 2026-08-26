// ─────────────────────────────────────────────────────────────────────────────
// jobs/invoiceDunningJob — issued invoices past due turn overdue with a
// one-time late fee and a single email; paid orders reconcile their invoice;
// an invoice already emailed is not emailed again.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  invoice: { findMany: jest.fn(), updateMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({ notify: jest.fn().mockResolvedValue(null) }))

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const { notify } = require("../src/services/notificationService")
const { runInvoiceDunningPass } = require("../src/jobs/invoiceDunningJob")

const NOW = new Date("2026-08-26T08:00:00Z")
const DAY = 24 * 60 * 60 * 1000

const order = (over = {}) => ({
  id: "o1", orderNumber: "INV-20260801-ABC123", status: "pending", totalAmount: 1000, currency: "MXN",
  customerName: "Ana Pérez", customerEmail: "ana@example.com", userId: "u1",
  user: { id: "u1", fullName: "Ana Pérez", email: "ana@example.com", profile: { locale: "es" } },
  ...over,
})
const invoice = (over = {}) => ({
  id: "i1", invoiceNumber: "INV-2026-00007", status: "issued", dueDate: new Date(NOW.getTime() - 3 * DAY),
  lateFeeAmount: 0, overdueNotifiedAt: null, order: order(), ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.INVOICE_LATE_FEE_RATE
  prisma.invoice.updateMany.mockResolvedValue({ count: 1 })
})

function queue({ paid = [], due = [] } = {}) {
  prisma.invoice.findMany.mockResolvedValueOnce(paid).mockResolvedValueOnce(due)
}

test("issued invoice past due → overdue with 2 % late fee (default), one email, one notification", async () => {
  queue({ due: [invoice()] })
  const r = await runInvoiceDunningPass({ now: NOW })

  expect(r).toMatchObject({ reconciled: 0, overdue: 1, emailed: 1 })
  const call = prisma.invoice.updateMany.mock.calls[0][0]
  expect(call.where).toEqual({ id: "i1", status: "issued" })
  expect(call.data).toMatchObject({ status: "overdue", lateFeeRate: 0.02, lateFeeAmount: 20, overdueNotifiedAt: NOW })

  expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
  const mail = sendTemplateEmail.mock.calls[0][0]
  expect(mail).toMatchObject({ to: "ana@example.com", templateKey: "invoice.overdue", userId: "u1", locale: "es" })
  expect(mail.variables).toMatchObject({ invoiceNumber: "INV-2026-00007", customerName: "Ana" })
  expect(mail.variables.orderUrl).toMatch(/\/dashboard\/orders\/o1$/)
  expect(notify).toHaveBeenCalledWith("u1", expect.objectContaining({ linkUrl: "/dashboard/orders/o1" }))
})

test("INVOICE_LATE_FEE_RATE overrides the fee; an existing fee is never recomputed", async () => {
  process.env.INVOICE_LATE_FEE_RATE = "0.05"
  queue({ due: [invoice(), invoice({ id: "i2", lateFeeAmount: 7.5, overdueNotifiedAt: new Date(NOW.getTime() - DAY) })] })
  const r = await runInvoiceDunningPass({ now: NOW })

  expect(r).toMatchObject({ overdue: 2, emailed: 1 })
  expect(prisma.invoice.updateMany.mock.calls[0][0].data.lateFeeAmount).toBe(50)
  const second = prisma.invoice.updateMany.mock.calls[1][0].data
  expect(second.lateFeeAmount).toBe(7.5)
  expect(second.overdueNotifiedAt).toBeUndefined()
  // already-notified invoice → no second email
  expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
})

test("invoice whose order is no longer pending is skipped; a lost race (count 0) is not counted or emailed", async () => {
  queue({ due: [invoice({ order: order({ status: "cancelled" }) }), invoice({ id: "i3" })] })
  prisma.invoice.updateMany.mockResolvedValueOnce({ count: 0 })
  const r = await runInvoiceDunningPass({ now: NOW })
  expect(r).toMatchObject({ overdue: 0, emailed: 0 })
  expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(1)
  expect(sendTemplateEmail).not.toHaveBeenCalled()
})

test("reconcile: issued/overdue invoices on paid orders become paid with the order's paidAt", async () => {
  const paidAt = new Date("2026-08-20T10:00:00Z")
  queue({ paid: [{ id: "i9", order: { paidAt } }] })
  const r = await runInvoiceDunningPass({ now: NOW })
  expect(r.reconciled).toBe(1)
  expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
    where: { id: "i9", status: { in: ["issued", "overdue"] } },
    data:  { status: "paid", paidAt },
  })
  const where = prisma.invoice.findMany.mock.calls[0][0].where
  expect(where).toEqual({ status: { in: ["issued", "overdue"] }, order: { status: { in: ["paid", "completed"] } } })
})

test("dry run lists candidates and writes nothing", async () => {
  prisma.invoice.findMany.mockResolvedValueOnce([invoice()])
  const r = await runInvoiceDunningPass({ now: NOW, dryRun: true })
  expect(r).toMatchObject({ reconciled: 0, overdue: 0, emailed: 0, candidates: ["INV-2026-00007"] })
  expect(prisma.invoice.updateMany).not.toHaveBeenCalled()
  expect(sendTemplateEmail).not.toHaveBeenCalled()
})

test("selects only issued invoices strictly past due", async () => {
  queue()
  await runInvoiceDunningPass({ now: NOW })
  const where = prisma.invoice.findMany.mock.calls[1][0].where
  expect(where).toEqual({ status: "issued", dueDate: { lt: NOW } })
})
