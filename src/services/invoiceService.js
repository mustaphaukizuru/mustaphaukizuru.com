const fs = require("fs")
const path = require("path")
const PDFDocument = require("pdfkit")
const prisma = require("../lib/prisma")
const QRCode = require("qrcode")
const logger = require("../utils/logger")
const generateInvoiceNumber = require("../utils/generateInvoiceNumber")
const { STORAGE_PATHS } = require("../config/storagePaths")

/* ────────────────────────────────────────────────────────────────────────────
 * Paths & constants
 * ──────────────────────────────────────────────────────────────────────────── */

const INVOICE_DIR = STORAGE_PATHS.invoices

// Brand palette — matches the royal-violet anchor from Brand v3.0 but uses
// the legacy compatibility hex so the PDF lands correctly until F02 migrates
// tokens site-wide.
const BRAND = Object.freeze({
  primary:       "#5D3FD3",
  primaryDark:   "#2d003f",
  text:          "#1f2937",
  muted:         "#6b7280",
  line:          "#e5e7eb",
  accentBg:      "#f5f0fe",
})

const { orderTaxBreakdown } = require("../lib/tax")
const { REGIMEN_FISCAL, USO_CFDI } = require("../lib/fiscal")

/**
 * Issuer block. Fiscal identity comes from env (see .env.example) so the
 * PDF never ships a placeholder dash as if it were an RFC. Read lazily —
 * tests and the operator can change env without a restart of the module.
 */
function company() {
  const rfc = (process.env.INVOICE_RFC || "").trim().toUpperCase()
  const regimen = (process.env.INVOICE_REGIMEN_FISCAL || "").trim()
  return {
    name:      process.env.INVOICE_LEGAL_NAME?.trim() || "mustaphaukizuru.com",
    tagline:   "Technology Consulting · Digital Products · STEM & School Solutions",
    email:     "hello@mustaphaukizuru.com",
    website:   "https://mustaphaukizuru.com",
    address:   "Tlalnepantla de Baz, Estado de México, MX",
    postalCode: (process.env.INVOICE_POSTAL_CODE || "").trim(),
    taxId:     rfc ? `RFC: ${rfc}` : "RFC: pending registration",
    regimen:   regimen && REGIMEN_FISCAL[regimen] ? `Régimen ${regimen} · ${REGIMEN_FISCAL[regimen]}` : null,
    serie:     (process.env.INVOICE_SERIE || "A").trim().toUpperCase().slice(0, 8),
  }
}
// Back-compat for the few render helpers that read a static object.
const COMPANY = new Proxy({}, { get: (_t, k) => company()[k] })

/* ────────────────────────────────────────────────────────────────────────────
 * ensureInvoiceDir
 * Lazy mkdir the storage/invoices directory on first use.
 * ──────────────────────────────────────────────────────────────────────────── */

function ensureInvoiceDir() {
  if (!fs.existsSync(INVOICE_DIR)) {
    fs.mkdirSync(INVOICE_DIR, { recursive: true })
  }
}

function invoicePathFor(invoiceNumber) {
  return path.join(INVOICE_DIR, `${invoiceNumber}.pdf`)
}

/**
 * Public URL clients will hit through the authenticated invoice endpoint.
 * We do NOT return a direct filesystem path — every download goes through
 * the auth/ownership check in invoiceController.
 */
function publicInvoiceUrl(orderId) {
  return `/api/orders/${orderId}/invoice.pdf`
}

/* ────────────────────────────────────────────────────────────────────────────
 * ensureInvoice
 *
 * Idempotently ensures an Invoice row + PDF file exist for a given order.
 *  - Creates the Invoice row if missing (generating the next invoice number)
 *  - Generates the PDF file on disk if missing
 *  - Returns the Invoice row
 *
 * Safe to call multiple times (webhook retries, admin re-triggers, etc.).
 * Non-throwing for missing-order — caller decides.
 * ──────────────────────────────────────────────────────────────────────────── */

async function ensureInvoice(orderId) {
  ensureInvoiceDir()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, title: true, slug: true },
          },
          service: {
            select: { id: true, title: true, slug: true },
          },
        },
      },
      user: { select: { id: true, fullName: true, email: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!order) return null

  // 1 · Find or create Invoice row.
  //     Storefront invoices only ever exist for paid orders, so a fresh row
  //     is born `paid`. A pre-existing manual invoice (issued / overdue) whose
  //     order has since been paid is flipped to `paid` here — fulfillOrder
  //     calls ensureInvoice on every paid transition, so this is the single
  //     place the invoice learns about the payment. Late fees already
  //     accrued are kept on the row for the record.
  const isPaid = order.status === "paid" || order.status === "completed"
  const paidAt = order.paidAt || order.payments?.[0]?.paidAt || new Date()
  let invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } })

  if (!invoice) {
    // Snapshot the money at issue time; the order row may change later
    // (refund) but an issued document must not.
    const tb = orderTaxBreakdown(order)
    const snapshot = {
      orderId:        order.id,
      invoicePdfUrl:  publicInvoiceUrl(order.id),
      serie:          company().serie,
      currency:       (order.currency || "MXN").toUpperCase(),
      subtotalAmount: tb.net,
      taxRate:        tb.rate,
      taxAmount:      tb.tax,
      totalAmount:    tb.total,
      ...(isPaid ? { status: "paid", paidAt } : {}),
    }
    // Numbering is read-then-insert; two webhooks landing together can pick
    // the same number. The @unique on invoiceNumber turns the loser into a
    // P2002 — retry with a fresh number instead of failing the fulfilment.
    // A P2002 on orderId means the other writer already created THIS order's
    // invoice — reuse it.
    for (let attempt = 0; attempt < 5 && !invoice; attempt += 1) {
      const invoiceNumber = await generateInvoiceNumber()
      try {
        invoice = await prisma.invoice.create({ data: { ...snapshot, invoiceNumber } })
      } catch (err) {
        if (err?.code !== "P2002") throw err
        invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } })
      }
    }
    if (!invoice) throw new Error(`Could not allocate an invoice number for order ${order.id}`)
  } else if (isPaid && invoice.status !== "paid") {
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data:  { status: "paid", paidAt: invoice.paidAt || paidAt },
    })
  }

  // 2 · Generate PDF on disk if missing
  const diskPath = invoicePathFor(invoice.invoiceNumber)
  if (!fs.existsSync(diskPath)) {
    // T5-11 · the tracking QR, resolved BEFORE the document is built.
    // qrcode.toBuffer is async and PDFKit's render path is not, so this
    // cannot happen inside generatePdf without turning it inside out.
    const tracking = await resolveTracking(order)
    await generatePdf(order, invoice, diskPath, tracking)
  }

  return invoice
}

/* ────────────────────────────────────────────────────────────────────────────
 * T5-11 · the tracking QR
 *
 * An invoice is the piece of paper a client keeps. Putting the project's
 * tracking code on it — as a code they can read and a QR they can scan —
 * means the one document they file is also the way back to the work.
 *
 * Both, not either: a QR is unusable to somebody reading a printed invoice
 * at a desk with no phone, and a twelve-character code is tedious to type on
 * one. They are the same destination in two forms.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The project this order is billed through, if any, with its QR pre-rendered.
 *
 * Returns null for everything that is not a project invoice — a store
 * purchase has nothing to track, and a footer that says so would be noise on
 * most of the invoices this system produces.
 */
async function resolveTracking(order) {
  try {
    const project = await prisma.clientProject.findFirst({
      where: {
        OR: [
          { serviceOrderId: order.serviceOrderId || "\u0000" },
          { serviceOrder: { orderId: order.id } },
        ],
      },
      select: { trackingCode: true },
    })
    const code = project?.trackingCode
    if (!code) return null

    const base = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
    if (!base) return null
    const url = `${base}/track/${code}`

    // Error correction M, not H: the code is short, the print is small, and
    // H spends a third of the modules on redundancy the scan does not need
    // at this size. margin 0 because the PDF supplies the quiet zone.
    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 220,
      color: { dark: "#1A1B23", light: "#FFFFFF" },
    })
    return { code, url, png }
  } catch (err) {
    // A missing QR is a slightly less useful invoice. A failed invoice is a
    // client who cannot pay. Never the second because of the first.
    logger.warn?.(`[invoice] tracking QR skipped: ${err.message}`)
    return null
  }
}

/**
 * Draw it above the footer text, at 22mm — small enough to be unobtrusive on
 * a document about money, large enough for a phone camera to find.
 */
function renderTrackingQr(doc, tracking) {
  if (!tracking?.png) return
  const MM = 2.8346457  // PostScript points per millimetre
  const size = 22 * MM
  const x = doc.page.width - doc.page.margins.right - size
  const y = doc.page.height - doc.page.margins.bottom - 40 - size - 14

  doc.image(tracking.png, x, y, { width: size, height: size })
  doc.font("Courier").fontSize(7).fillColor(BRAND.muted)
     .text(tracking.code, x - 20, y + size + 3, { width: size + 40, align: "center" })
  doc.font("Helvetica").fontSize(6.5).fillColor(BRAND.muted)
     .text("Track this project", x - 20, y + size + 12, { width: size + 40, align: "center" })
}

/* ────────────────────────────────────────────────────────────────────────────
 * generatePdf — writes the PDF document to `outPath`.
 *
 * Returns a Promise that resolves when the stream has finished flushing.
 * ──────────────────────────────────────────────────────────────────────────── */

function generatePdf(order, invoice, outPath, tracking = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 })
      const stream = fs.createWriteStream(outPath)
      doc.pipe(stream)

      renderHeader(doc, invoice, order)
      renderMeta(doc, invoice, order)
      renderBillTo(doc, order)
      renderLineItems(doc, order)
      renderTotals(doc, order)
      renderPayment(doc, order)
      renderTrackingQr(doc, tracking)
      renderFooter(doc)

      doc.end()

      stream.on("finish", resolve)
      stream.on("error", reject)
    } catch (err) {
      reject(err)
    }
  })
}

/* ────────────────────────────────────────────────────────────────────────────
 * PDF sections
 * ──────────────────────────────────────────────────────────────────────────── */

function renderHeader(doc, invoice, _order) {
  const x = doc.page.margins.left
  const y = doc.page.margins.top

  // Brand bar
  doc
    .rect(x, y, doc.page.width - x - doc.page.margins.right, 52)
    .fill(BRAND.primary)

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold").fontSize(18).text(COMPANY.name, x + 16, y + 14)
    .font("Helvetica").fontSize(9).fillColor("#e8defa").text(COMPANY.tagline, x + 16, y + 34)

  // Title (right)
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold").fontSize(22)
    .text("INVOICE", 0, y + 16, { align: "right" })

  doc.fillColor(BRAND.text).moveDown(2)
}

function renderMeta(doc, invoice, order) {
  doc.moveDown(1)
  const topY = doc.y

  // Left — company address
  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND.text)
    .text(COMPANY.name, doc.page.margins.left, topY)
    .font("Helvetica").fontSize(9).fillColor(BRAND.muted)
    .text(COMPANY.address)
    .text(COMPANY.email)
    .text(COMPANY.website)
    .text(COMPANY.taxId)
  if (COMPANY.regimen) doc.text(COMPANY.regimen)
  if (COMPANY.postalCode) doc.text(`C.P. ${COMPANY.postalCode}`)

  // Right — invoice meta
  const rightX = 350
  const rightY = topY

  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND.text)
    .text("Invoice number", rightX, rightY, { width: 200, align: "left" })
    .font("Helvetica").fillColor(BRAND.muted)
    .text(invoice.invoiceNumber)
    .moveDown(0.5)

    .font("Helvetica-Bold").fillColor(BRAND.text).text("Issue date")
    .font("Helvetica").fillColor(BRAND.muted)
    .text(formatDate(invoice.issuedAt))
    .moveDown(0.5)

    .font("Helvetica-Bold").fillColor(BRAND.text).text("Order")
    .font("Helvetica").fillColor(BRAND.muted)
    .text(order.orderNumber)
    .moveDown(0.5)

    .font("Helvetica-Bold").fillColor(BRAND.text).text("Status")
    .font("Helvetica").fillColor(BRAND.muted)
    .text(humanStatus(invoice.status === "paid" ? "paid" : invoice.status || order.status))

  if (invoice.dueDate) {
    doc
      .moveDown(0.5)
      .font("Helvetica-Bold").fillColor(BRAND.text).text("Due date")
      .font("Helvetica").fillColor(BRAND.muted)
      .text(formatDate(invoice.dueDate))
  }

  // Move cursor below whichever column is taller
  doc.y = Math.max(doc.y, topY + 100)
  doc.moveDown(1)
  hr(doc)
}

function renderBillTo(doc, order) {
  const x = doc.page.margins.left
  doc.moveDown(0.5)
  doc
    .font("Helvetica-Bold").fontSize(11).fillColor(BRAND.text)
    .text("Bill to", x)

  doc.font("Helvetica").fontSize(10).fillColor(BRAND.text)
  doc.text(order.customerName || order.user?.fullName || "—")
  doc.fillColor(BRAND.muted)
  if (order.customerEmail || order.user?.email) {
    doc.text(order.customerEmail || order.user?.email)
  }

  const addressLine = [
    order.billingCity,
    order.billingStateRegion,
    order.billingPostalCode,
    order.billingCountry,
  ].filter(Boolean).join(", ")
  if (addressLine) doc.text(addressLine)

  // CFDI 4.0 receiver block — only what the customer supplied.
  if (order.billingLegalName) doc.text(`Razón social: ${order.billingLegalName}`)
  if (order.billingCompany && !order.billingLegalName) doc.text(order.billingCompany)
  if (order.billingTaxId) doc.text(`RFC: ${order.billingTaxId}`)
  if (order.billingRegimenFiscal) {
    doc.text(`Régimen fiscal: ${order.billingRegimenFiscal}${REGIMEN_FISCAL[order.billingRegimenFiscal] ? ` · ${REGIMEN_FISCAL[order.billingRegimenFiscal]}` : ""}`)
  }
  if (order.billingUsoCfdi) {
    doc.text(`Uso CFDI: ${order.billingUsoCfdi}${USO_CFDI[order.billingUsoCfdi] ? ` · ${USO_CFDI[order.billingUsoCfdi]}` : ""}`)
  }
  if (order.billingFiscalPostalCode) doc.text(`Domicilio fiscal C.P.: ${order.billingFiscalPostalCode}`)

  doc.moveDown(0.5)
  hr(doc)
}

function renderLineItems(doc, order) {
  const x     = doc.page.margins.left
  const width = doc.page.width - x - doc.page.margins.right

  doc.moveDown(0.5)
  doc
    .font("Helvetica-Bold").fontSize(11).fillColor(BRAND.text)
    .text("Items", x)
  doc.moveDown(0.4)

  // Column positions
  const colItem    = x
  const colQty     = x + width - 220
  const colPrice   = x + width - 140
  const colTotal   = x + width - 70

  // Table header background
  const headerY = doc.y
  doc.rect(x, headerY - 2, width, 18).fill(BRAND.accentBg)
  doc
    .fillColor(BRAND.primaryDark).font("Helvetica-Bold").fontSize(9)
    .text("Item",     colItem + 8, headerY + 3)
    .text("Qty",      colQty,      headerY + 3, { width: 60, align: "right" })
    .text("Unit",     colPrice,    headerY + 3, { width: 60, align: "right" })
    .text("Total",    colTotal,    headerY + 3, { width: 60, align: "right" })

  doc.moveDown(1.2)

  const currency = (order.currency || "MXN").toUpperCase()

  // Rows
  ;(order.items || []).forEach((item) => {
    const rowY = doc.y
    const title = item.titleSnapshot || item.title || item.product?.title || item.service?.title || "Item"
    const unit  = Number(item.unitPrice ?? item.price ?? 0)
    const qty   = Number(item.quantity ?? 1)
    const total = Number(item.lineTotal ?? unit * qty)

    doc.fillColor(BRAND.text).font("Helvetica").fontSize(10)
      .text(title,                colItem + 8, rowY, { width: colQty - colItem - 16 })
      .text(String(qty),          colQty,      rowY, { width: 60, align: "right" })
      .text(formatMoney(unit, currency),  colPrice, rowY, { width: 60, align: "right" })
      .text(formatMoney(total, currency), colTotal, rowY, { width: 60, align: "right" })

    // T3 · licence tier + key under the line title (digital products only)
    if (item.licenseTier || item.licenseKey) {
      const tierLabel = item.licenseTier
        ? `${String(item.licenseTier).charAt(0).toUpperCase()}${String(item.licenseTier).slice(1)} licence`
        : "Licence"
      doc.fillColor(BRAND.muted).font("Helvetica").fontSize(8)
        .text(
          [tierLabel, item.licenseKey ? `Key: ${item.licenseKey}` : null].filter(Boolean).join("  ·  "),
          colItem + 8, doc.y, { width: colQty - colItem - 16 },
        )
    }
    doc.moveDown(0.6)
  })

  doc.moveDown(0.2)
  hr(doc)
}

function renderTotals(doc, order) {
  const x     = doc.page.margins.left
  const width = doc.page.width - x - doc.page.margins.right
  const currency = (order.currency || "MXN").toUpperCase()

  const subtotal = Number(order.subtotalAmount ?? 0)
  const discount = Number(order.discountAmount ?? 0)
  const tb       = orderTaxBreakdown(order)
  const total    = tb.total || Number(order.totalAmount ?? subtotal - discount)

  doc.moveDown(0.5)
  const labelX = x + width - 220
  const valueX = x + width - 100

  const row = (label, value, bold = false) => {
    const y = doc.y
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(BRAND.text)
    doc.text(label, labelX, y, { width: 120, align: "left" })
    doc.text(formatMoney(value, currency), valueX, y, { width: 100, align: "right" })
    doc.moveDown(0.35)
  }

  row("Subtotal", subtotal)
  if (discount > 0) row("Discount", -discount)
  if (tb.tax > 0) {
    // Prices are IVA-inclusive: show the split, never add on top.
    row("Net (before IVA)", tb.net)
    row(`IVA ${tb.ratePct}% (included)`, tb.tax)
  } else {
    row("IVA", 0)
  }
  doc.moveDown(0.15)

  // Bold total
  const y = doc.y
  doc.rect(labelX - 4, y - 3, 228, 22).fill(BRAND.accentBg)
  doc.fillColor(BRAND.primaryDark).font("Helvetica-Bold").fontSize(12)
    .text("TOTAL", labelX, y + 2, { width: 120, align: "left" })
    .text(formatMoney(total, currency), valueX, y + 2, { width: 100, align: "right" })

  doc.moveDown(2)
  doc.fillColor(BRAND.text)
}

function renderPayment(doc, order) {
  const x = doc.page.margins.left
  const payment = order.payments?.[0]
  if (!payment) return

  doc.moveDown(0.5)
  doc
    .font("Helvetica-Bold").fontSize(11).fillColor(BRAND.text)
    .text("Payment", x)
  doc.moveDown(0.2)

  const rows = [
    ["Method",          humanGateway(payment.paymentGateway)],
    ["Status",          humanStatus(payment.paymentStatus)],
    ["Transaction ID",  payment.gatewayTransactionId || "—"],
    ["Processed",       payment.paidAt ? formatDate(payment.paidAt) : "—"],
  ]

  doc.font("Helvetica").fontSize(10)
  rows.forEach(([label, value]) => {
    const y = doc.y
    doc.fillColor(BRAND.muted).text(label, x, y, { width: 120, align: "left" })
    doc.fillColor(BRAND.text ).text(value, x + 120, y)
    doc.moveDown(0.3)
  })
}

function renderFooter(doc) {
  const y = doc.page.height - doc.page.margins.bottom - 40
  doc.fillColor(BRAND.muted).font("Helvetica").fontSize(8)
    .text(`Thank you for your purchase.  Questions? ${COMPANY.email}`,
          doc.page.margins.left, y, { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right })
    .text(`${COMPANY.website}  ·  Terms & Refund policy available online.`,
          doc.page.margins.left, y + 14, { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Formatting helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function hr(doc) {
  const x = doc.page.margins.left
  const w = doc.page.width - x - doc.page.margins.right
  const y = doc.y
  doc.strokeColor(BRAND.line).lineWidth(0.5)
     .moveTo(x, y).lineTo(x + w, y).stroke()
  doc.moveDown(0.4)
}

function formatDate(d) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

function formatMoney(n, currency = "MXN") {
  const value = Number(n)
  const safe  = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(safe)
  } catch {
    return `$${safe.toFixed(2)}`
  }
}

function humanStatus(status) {
  if (!status) return "—"
  const map = { paid: "Paid", pending: "Pending", failed: "Failed", cancelled: "Cancelled", refunded: "Refunded", issued: "Issued", overdue: "Overdue", void: "Void" }
  return map[status] || String(status).replace(/_/g, " ")
}

function humanGateway(g) {
  if (!g) return "—"
  const map = { mercadopago: "Mercado Pago", paypal: "PayPal" }
  return map[g] || g
}

module.exports = {
  ensureInvoice,
  invoicePathFor,
  INVOICE_DIR,
}
