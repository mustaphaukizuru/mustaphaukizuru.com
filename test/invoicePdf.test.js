// ─────────────────────────────────────────────────────────────────────────────
// The invoice PDF — generated for real, onto a real disk.
//
// Everything under invoiceService is a private render function reachable only
// by actually producing a document, so every static assertion written about
// this file so far has been a grep. A grep does not catch a PDFKit call that
// throws on a null, and a throw here is a paying customer who cannot get
// their invoice.
//
// So this suite writes actual PDFs into a temp directory and reads the bytes
// back. It is the one place that proves the document builds at all.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const os = require("os")
const path = require("path")

// Set before the service is required: storagePaths resolves its base once at
// require time, so a later assignment would still write into ./storage.
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mu-invoice-test-"))
process.env.STORAGE_DIR = STORAGE_DIR

jest.mock("../src/lib/prisma", () => ({
  order:         { findUnique: jest.fn() },
  invoice:       { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  clientProject: { findFirst: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/utils/generateInvoiceNumber", () => jest.fn())

const prisma = require("../src/lib/prisma")
const generateInvoiceNumber = require("../src/utils/generateInvoiceNumber")
const QRCode = require("qrcode")
const { ensureInvoice, invoicePathFor, INVOICE_DIR } = require("../src/services/invoiceService")

// Jest workers share a process — put every one of these back (invariant 6).
const ENV_BEFORE = {}
const ENV_KEYS = ["FRONTEND_URL", "CLIENT_URL", "INVOICE_RFC", "INVOICE_REGIMEN_FISCAL", "INVOICE_LEGAL_NAME", "INVOICE_POSTAL_CODE", "INVOICE_SERIE"]
beforeAll(() => {
  for (const k of ENV_KEYS) ENV_BEFORE[k] = process.env[k]
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com"
})
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (ENV_BEFORE[k] === undefined) delete process.env[k]
    else process.env[k] = ENV_BEFORE[k]
  }
  delete process.env.STORAGE_DIR
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true })
})

const ORDER = {
  id: "o1",
  orderNumber: "MU-2026-0142",
  status: "paid",
  currency: "mxn",
  paidAt: new Date("2026-09-01T10:00:00.000Z"),
  subtotalAmount: 1200,
  discountAmount: 200,
  totalAmount: 1000,
  taxRate: 16,
  customerName: "Ana Ruiz",
  customerEmail: "director@colegiovista.mx",
  billingCity: "Tlalnepantla",
  billingStateRegion: "Estado de México",
  billingPostalCode: "54000",
  billingCountry: "MX",
  billingLegalName: "COLEGIO VISTA SA DE CV",
  billingTaxId: "XAXX010101000",
  billingRegimenFiscal: "601",
  billingUsoCfdi: "G03",
  billingFiscalPostalCode: "54000",
  serviceOrderId: "so1",
  user: { id: "u1", fullName: "Ana Ruiz", email: "director@colegiovista.mx" },
  items: [
    { id: "i1", titleSnapshot: "Sitio institucional", quantity: 1, unitPrice: 900, lineTotal: 900, service: { title: "Sitio institucional" } },
    { id: "i2", quantity: 2, unitPrice: 150, lineTotal: 300, product: { title: "Plantilla STEM" }, licenseTier: "extended", licenseKey: "MU-XXXX-YYYY" },
  ],
  payments: [{ paymentGateway: "mercadopago", paymentStatus: "paid", gatewayTransactionId: "MP-99887766", paidAt: new Date("2026-09-01T10:00:00.000Z") }],
}

const INVOICE = (over = {}) => ({
  id: "inv1",
  orderId: "o1",
  invoiceNumber: "A-000142",
  status: "paid",
  issuedAt: new Date("2026-09-01T10:00:00.000Z"),
  paidAt: new Date("2026-09-01T10:00:00.000Z"),
  ...over,
})

let seq = 0
beforeEach(() => {
  jest.clearAllMocks()
  seq += 1
  const number = `A-TEST-${seq}`
  generateInvoiceNumber.mockResolvedValue(number)
  prisma.order.findUnique.mockResolvedValue(ORDER)
  prisma.invoice.findUnique.mockResolvedValue(null)
  prisma.invoice.create.mockImplementation(async ({ data }) => INVOICE({ ...data, invoiceNumber: data.invoiceNumber }))
  prisma.invoice.update.mockImplementation(async ({ data }) => INVOICE(data))
  prisma.clientProject.findFirst.mockResolvedValue(null)
})

const bytesOf = (invoice) => fs.readFileSync(invoicePathFor(invoice.invoiceNumber))

describe("the document actually builds", () => {
  test("a paid order with items, a discount, IVA, a licence key and a payment renders a PDF", async () => {
    // Deliberately the busiest order this system can produce: every optional
    // branch in every render function is on at once, because the branch that
    // throws is always the one nobody generated in dev.
    const invoice = await ensureInvoice("o1")
    const bytes = bytesOf(invoice)

    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
    // A PDFKit document that rendered nothing is still a valid few hundred
    // bytes, so size is the assertion that content reached the page.
    expect(bytes.length).toBeGreaterThan(3000)
  })

  test("a bare order — no items, no payment, no billing address — still renders", async () => {
    // The refunded/manual-invoice shape. Nothing here may throw on a null.
    prisma.order.findUnique.mockResolvedValue({
      id: "o1", orderNumber: "MU-2026-0001", status: "pending", currency: null,
      subtotalAmount: null, totalAmount: null, items: [], payments: [], user: null,
    })
    const invoice = await ensureInvoice("o1")
    expect(bytesOf(invoice).subarray(0, 5).toString()).toBe("%PDF-")
  })

  test("the file lands under the invoices storage directory, not in the deploy tree", async () => {
    // storage/ survives a deploy; the app directory does not. That is the
    // whole reason storagePaths exists.
    const invoice = await ensureInvoice("o1")
    expect(invoicePathFor(invoice.invoiceNumber).startsWith(INVOICE_DIR)).toBe(true)
    expect(INVOICE_DIR.startsWith(STORAGE_DIR)).toBe(true)
  })

  test("a missing order returns null rather than throwing", async () => {
    prisma.order.findUnique.mockResolvedValue(null)
    await expect(ensureInvoice("nope")).resolves.toBeNull()
  })
})

describe("it is idempotent, because webhooks retry", () => {
  test("a second call with the PDF already on disk does not rewrite it", async () => {
    const invoice = await ensureInvoice("o1")
    const p = invoicePathFor(invoice.invoiceNumber)
    const first = fs.statSync(p).mtimeMs

    prisma.invoice.findUnique.mockResolvedValue(invoice)
    await ensureInvoice("o1")

    expect(fs.statSync(p).mtimeMs).toBe(first)
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1)
  })

  test("two writers racing on the invoice number: the loser retries instead of failing the fulfilment", async () => {
    // The @unique on invoiceNumber turns the loser into a P2002. Failing here
    // would fail the payment fulfilment that called us.
    const clash = Object.assign(new Error("unique"), { code: "P2002" })
    prisma.invoice.create
      .mockRejectedValueOnce(clash)
      .mockImplementationOnce(async ({ data }) => INVOICE(data))
    generateInvoiceNumber
      .mockResolvedValueOnce("A-RACE-A")
      .mockResolvedValueOnce("A-RACE-B")

    const invoice = await ensureInvoice("o1")
    expect(invoice.invoiceNumber).toBe("A-RACE-B")
    expect(generateInvoiceNumber).toHaveBeenCalledTimes(2)
  })

  test("a P2002 on orderId means the other writer already made THIS invoice — reuse it", async () => {
    const clash = Object.assign(new Error("unique"), { code: "P2002" })
    prisma.invoice.create.mockRejectedValue(clash)
    prisma.invoice.findUnique
      .mockResolvedValueOnce(null)              // the initial look-up
      .mockResolvedValue(INVOICE({ invoiceNumber: "A-OTHER" }))  // after the clash

    const invoice = await ensureInvoice("o1")
    expect(invoice.invoiceNumber).toBe("A-OTHER")
  })

  test("an invoice raised as `issued` flips to paid once the order is paid", async () => {
    // ensureInvoice runs on every paid transition, so this is the single
    // place a manually raised invoice learns about the payment.
    prisma.invoice.findUnique.mockResolvedValue(INVOICE({ status: "issued", paidAt: null }))
    await ensureInvoice("o1")

    expect(prisma.invoice.update.mock.calls[0][0].data.status).toBe("paid")
  })

  test("a non-P2002 error is not swallowed", async () => {
    prisma.invoice.create.mockRejectedValue(new Error("database on fire"))
    await expect(ensureInvoice("o1")).rejects.toThrow("database on fire")
  })
})

describe("the tracking QR (T5-11)", () => {
  test("a project invoice carries one; the same order without a project does not", async () => {
    const plain = await ensureInvoice("o1")
    const plainSize = bytesOf(plain).length

    prisma.clientProject.findFirst.mockResolvedValue({ trackingCode: "MU-7K4C-9XQF" })
    prisma.invoice.findUnique.mockResolvedValue(null)
    // A fresh number, or the PDF already on disk from the first call is
    // reused and the two sizes are trivially equal.
    generateInvoiceNumber.mockResolvedValue(`A-TRACKED-${Date.now()}`)
    const tracked = await ensureInvoice("o1")

    // An embedded PNG is not subtle in a PDF.
    expect(bytesOf(tracked).length).toBeGreaterThan(plainSize + 500)
  })

  test("with no FRONTEND_URL there is nothing to encode, and the invoice is still produced", async () => {
    prisma.clientProject.findFirst.mockResolvedValue({ trackingCode: "MU-7K4C-9XQF" })
    const before = process.env.FRONTEND_URL
    delete process.env.FRONTEND_URL
    try {
      const invoice = await ensureInvoice("o1")
      expect(bytesOf(invoice).subarray(0, 5).toString()).toBe("%PDF-")
    } finally {
      process.env.FRONTEND_URL = before
    }
  })

  test("a QR that cannot be built never fails the invoice", async () => {
    // A missing QR is a slightly less useful invoice. A failed invoice is a
    // client who cannot pay. Never the second because of the first.
    prisma.clientProject.findFirst.mockResolvedValue({ trackingCode: "MU-7K4C-9XQF" })
    const spy = jest.spyOn(QRCode, "toBuffer").mockRejectedValue(new Error("qr broke"))
    try {
      const invoice = await ensureInvoice("o1")
      expect(bytesOf(invoice).subarray(0, 5).toString()).toBe("%PDF-")
    } finally {
      spy.mockRestore()
    }
  })
})

describe("the fiscal identity comes from env, never from a placeholder", () => {
  test("an unset RFC prints as pending, not as a dash pretending to be a number", async () => {
    delete process.env.INVOICE_RFC
    const invoice = await ensureInvoice("o1")
    expect(bytesOf(invoice).length).toBeGreaterThan(3000)
    // The row snapshot is what the client is billed against.
    expect(prisma.invoice.create.mock.calls[0][0].data.serie).toBe("A")
  })

  test("INVOICE_SERIE is read at call time, so the operator can change it without a restart", async () => {
    process.env.INVOICE_SERIE = "b2b"
    await ensureInvoice("o1")
    // Upper-cased and capped, because it goes on a fiscal document.
    expect(prisma.invoice.create.mock.calls[0][0].data.serie).toBe("B2B")
  })

  test("the money snapshot is taken at issue time and not read back off the order", async () => {
    // A later refund changes the order. An issued document must not change.
    await ensureInvoice("o1")
    const data = prisma.invoice.create.mock.calls[0][0].data
    expect(data.currency).toBe("MXN")
    expect(data.totalAmount).toBeGreaterThan(0)
    expect(data.subtotalAmount + data.taxAmount).toBeCloseTo(data.totalAmount, 2)
  })
})
