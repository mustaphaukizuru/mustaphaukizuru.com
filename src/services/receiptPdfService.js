// ─────────────────────────────────────────────────────────────────────────────
// receiptPdfService.js — generate a brand-aligned receipt PDF for any order.
//
// This is separate from the existing invoiceService.js (which writes a more
// formal Invoice row + PDF tied to your numbering scheme). Receipts here are:
//   • Idempotent (same input → same bytes; safe to attach to retry emails)
//   • Stored on disk under storage/receipts/{orderId}.pdf so they can be
//     re-fetched without regenerating
//   • Brand-aligned — Royal Violet header, Sora-style sans, monospaced totals
//
// Use from:
//   • Order confirmation email (attach the buffer directly)
//   • Member dashboard "Download receipt" action
//   • Admin export
//
// Returns a Buffer when called with `{ inMemory: true }`, or a file path
// when called with `{ outDir: "..." }`. By default it writes to
// `storage/receipts/<orderId>.pdf` and returns the absolute path.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const path = require("path")
const PDFDocument = require("pdfkit")

const prisma = require("../lib/prisma")
const { STORAGE_PATHS } = require("../config/storagePaths")

const DEFAULT_OUT_DIR = STORAGE_PATHS.receipts

const COLORS = {
  violet:   "#5D3FD3",
  violetD:  "#3D2A8A",
  charcoal: "#1A1B23",
  muted:    "#3F4047",
  faint:    "#8C8D92",
  mist:     "#F8FAFC",
  pale:     "#EDE9FB",
  border:   "#E5E7EF",
  terra:    "#E9C46A",
}

/**
 * generateReceiptPdf
 *
 * @param {string} orderId
 * @param {object} [opts]
 * @param {boolean} [opts.inMemory=false]  Return a Buffer instead of writing
 * @param {string}  [opts.outDir]          Directory to write into (default storage/receipts)
 * @returns {Promise<Buffer|string>} Buffer when inMemory, otherwise absolute file path.
 */
async function generateReceiptPdf(orderId, opts = {}) {
  const { inMemory = false, outDir = DEFAULT_OUT_DIR } = opts

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items:    true,
      payments: true,
      user:     { select: { fullName: true, email: true } },
    },
  })
  if (!order) throw new Error("Order not found")

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title:        `Receipt ${order.orderNumber}`,
      Author:       "Mustapha Ukizuru",
      Subject:      `Receipt for order ${order.orderNumber}`,
      Producer:     "mustaphaukizuru.com",
    },
  })

  const chunks = []
  doc.on("data", (c) => chunks.push(c))
  const done = new Promise((resolve, reject) => {
    doc.on("end", resolve)
    doc.on("error", reject)
  })

  /* ── header band ───────────────────────────────────────────────────── */

  doc.rect(0, 0, doc.page.width, 88).fill(COLORS.violet)

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18)
     .text("mustaphaukizuru.com", 56, 30)

  doc.font("Helvetica").fontSize(9).fillColor("#ffffff")
     .opacity(0.75)
     .text("Technology consulting · Digital products · STEM & school solutions", 56, 54)
     .opacity(1)

  // Receipt label on the right
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff")
     .text("RECEIPT", doc.page.width - 156, 30, { width: 100, align: "right" })
  doc.font("Helvetica").fontSize(11).fillColor("#ffffff")
     .text(order.orderNumber, doc.page.width - 156, 46, { width: 100, align: "right" })

  doc.fillColor(COLORS.charcoal).y = 120

  /* ── meta block ─────────────────────────────────────────────────────── */

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.charcoal)
     .text("Billed to", 56, doc.y)
  doc.moveDown(0.4)
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.muted)
     .text(order.customerName || order.billingName || "Customer")
  doc.fillColor(COLORS.faint).text(order.customerEmail || order.billingEmail || "")
  if (order.billingCountry || order.billingCity) {
    doc.text([order.billingCity, order.billingStateRegion, order.billingCountry].filter(Boolean).join(", "))
  }

  // Right-aligned meta
  const metaX = doc.page.width - 56 - 220
  let metaY = 120
  metaItem(doc, metaX, metaY,        "Issue date",     formatDate(order.paidAt || order.createdAt))
  metaY += 30
  metaItem(doc, metaX, metaY,        "Payment status", capitalise(order.status))
  metaY += 30
  if (order.payments?.[0]?.paymentGateway) {
    metaItem(doc, metaX, metaY,      "Method", labelGateway(order.payments[0].paymentGateway))
  }

  /* ── items table ───────────────────────────────────────────────────── */

  doc.y = Math.max(doc.y, metaY + 40)
  doc.moveDown(1.5)

  const tableTop = doc.y
  const colTitleX  = 56
  const colQtyX    = 320
  const colUnitX   = 380
  const colTotalX  = 460
  const tableW     = doc.page.width - 112

  doc.rect(56, tableTop - 8, tableW, 28).fill(COLORS.pale)
  doc.fillColor(COLORS.violet).font("Helvetica-Bold").fontSize(10)
     .text("ITEM",   colTitleX + 8,  tableTop)
     .text("QTY",    colQtyX,        tableTop, { width: 50,  align: "right" })
     .text("PRICE",  colUnitX,       tableTop, { width: 70,  align: "right" })
     .text("TOTAL",  colTotalX,      tableTop, { width: doc.page.width - 56 - colTotalX, align: "right" })

  doc.y = tableTop + 28
  doc.fillColor(COLORS.charcoal).font("Helvetica").fontSize(10)

  for (const item of order.items || []) {
    const rowY = doc.y + 6
    const title = item.title || item.titleSnapshot || "Digital product"
    const qty   = Number(item.quantity || 1)
    const unit  = decimalToNumber(item.unitPrice ?? item.price ?? 0)
    const total = unit * qty

    doc.fillColor(COLORS.charcoal).text(title, colTitleX + 8, rowY, { width: colQtyX - colTitleX - 12 })
    doc.fillColor(COLORS.muted).text(String(qty),    colQtyX,   rowY, { width: 50, align: "right" })
    doc.fillColor(COLORS.muted).text(formatMoney(unit, order.currency), colUnitX, rowY, { width: 70, align: "right" })
    doc.fillColor(COLORS.charcoal).text(formatMoney(total, order.currency), colTotalX, rowY, { width: doc.page.width - 56 - colTotalX, align: "right" })

    doc.moveDown(1.3)
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(56, doc.y).lineTo(56 + tableW, doc.y).stroke()
  }

  /* ── totals ────────────────────────────────────────────────────────── */

  doc.moveDown(0.8)
  totalsRow(doc, "Subtotal",      formatMoney(order.subtotalAmount, order.currency))
  if (decimalToNumber(order.discountAmount) !== 0) {
    totalsRow(doc, "Discount", `-${formatMoney(order.discountAmount, order.currency)}`)
  }
  if (decimalToNumber(order.serviceFeeAmount) !== 0) {
    totalsRow(doc, "Service fee", formatMoney(order.serviceFeeAmount, order.currency))
  }

  // Final total — emphasised
  doc.moveDown(0.4)
  doc.strokeColor(COLORS.charcoal).lineWidth(0.8).moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke()
  doc.moveDown(0.5)
  const totalY = doc.y
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.charcoal)
     .text("TOTAL", 56, totalY)
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.violet)
     .text(formatMoney(order.totalAmount, order.currency), 56, totalY, { width: tableW, align: "right" })

  /* ── footer ────────────────────────────────────────────────────────── */

  const footerY = doc.page.height - 100
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.faint)
     .text("Thank you for your business. This receipt also serves as proof of purchase for the items listed above.", 56, footerY, { width: tableW, align: "center" })
     .moveDown(0.4)
     .text(`Replies to this receipt go to hello@mustaphaukizuru.com — © ${new Date().getFullYear()} Mustapha Ukizuru.`, { width: tableW, align: "center" })

  doc.end()
  await done

  const buffer = Buffer.concat(chunks)
  if (inMemory) return buffer

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const filePath = path.join(outDir, `${order.id}.pdf`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

/* ────────────────────────── helpers ────────────────────────────────────── */

function metaItem(doc, x, y, label, value) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.faint)
     .text(label.toUpperCase(), x, y, { width: 220, align: "right", characterSpacing: 1.6 })
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.charcoal)
     .text(value || "—", x, y + 12, { width: 220, align: "right" })
}

function totalsRow(doc, label, value) {
  const y = doc.y
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
     .text(label, 56, y, { width: doc.page.width - 112, align: "right" })
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.charcoal)
     .text(value, 56, y, { width: doc.page.width - 112, align: "right" })
  doc.moveDown(1)
}

function decimalToNumber(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(String(value))
}

function formatMoney(amount, currency = "MXN") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(decimalToNumber(amount))
  } catch {
    return `$${decimalToNumber(amount).toFixed(2)} ${currency}`
  }
}

function formatDate(d) {
  if (!d) return ""
  const dt = new Date(d)
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
}

function capitalise(s = "") { return s ? s[0].toUpperCase() + s.slice(1) : "" }

function labelGateway(gw) {
  if (gw === "mercadopago") return "Mercado Pago"
  if (gw === "paypal")      return "PayPal"
  return capitalise(gw || "")
}

module.exports = { generateReceiptPdf }
