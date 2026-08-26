const fs = require("fs")
const path = require("path")
const PDFDocument = require("pdfkit")
const prisma = require("../lib/prisma")
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

const COMPANY = Object.freeze({
  name:     "mustaphaukizuru.com",
  tagline:  "Technology Consulting · Digital Products · STEM & School Solutions",
  email:    "hello@mustaphaukizuru.com",
  website:  "https://mustaphaukizuru.com",
  address:  "Tlalnepantla de Baz, Estado de México, MX",
  taxId:    "RFC: —",
})

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

  // 1 · Find or create Invoice row
  let invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } })

  if (!invoice) {
    const invoiceNumber = await generateInvoiceNumber()
    invoice = await prisma.invoice.create({
      data: {
        orderId:       order.id,
        invoiceNumber,
        invoicePdfUrl: publicInvoiceUrl(order.id),
      },
    })
  }

  // 2 · Generate PDF on disk if missing
  const diskPath = invoicePathFor(invoice.invoiceNumber)
  if (!fs.existsSync(diskPath)) {
    await generatePdf(order, invoice, diskPath)
  }

  return invoice
}

/* ────────────────────────────────────────────────────────────────────────────
 * generatePdf — writes the PDF document to `outPath`.
 *
 * Returns a Promise that resolves when the stream has finished flushing.
 * ──────────────────────────────────────────────────────────────────────────── */

function generatePdf(order, invoice, outPath) {
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
    .text(humanStatus(order.status))

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
  const tax      = 0
  const total    = Number(order.totalAmount ?? subtotal - discount + tax)

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
  row("Tax", tax)
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
  const map = { paid: "Paid", pending: "Pending", failed: "Failed", cancelled: "Cancelled", refunded: "Refunded" }
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
