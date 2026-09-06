const fs = require("fs")
const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const { ensureInvoice, invoicePathFor } = require("../services/invoiceService")

const INVOICEABLE_STATUSES = new Set(["paid", "refunded"])

/**
 * GET /api/orders/:id/invoice.pdf
 * Streams the invoice PDF for a given order.
 *
 * Auth rules:
 *   - Requires `protect` middleware
 *   - Caller must be the order owner OR an admin
 *
 * If the invoice / PDF doesn't exist yet (paid orders pre-B04), it's
 * generated on the fly via ensureInvoice — same idempotent path used by
 * the webhook fulfillment hook.
 */
const getInvoicePdf = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params

  // 1 · Ownership check
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, userId: true, status: true, orderNumber: true },
  })

  if (!order) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Order not found" })
  }

  const isAdmin = req.user?.role === "admin"
  const isOwner = order.userId && req.user?.id === order.userId
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "You do not have access to this invoice" })
  }

  // 2 · Only settled orders get invoices (prevent leakage of unfinished
  //     transactions). A refunded order keeps its invoice. Manual invoices
  //     (Tier 4) exist as a row before payment and are exactly what the
  //     client needs to pay, so they are served pre-payment.
  const manual = !INVOICEABLE_STATUSES.has(order.status)
    ? await prisma.invoice.findUnique({ where: { orderId: order.id }, select: { id: true } })
    : null
  if (!INVOICEABLE_STATUSES.has(order.status) && !manual) {
    return res.status(400).json({
      success: false, code: "INVOICE_NOT_READY",
      message: "Invoice is only available for paid orders",
    })
  }

  // 3 · Generate (or locate) the PDF
  const invoice = await ensureInvoice(order.id)
  if (!invoice) {
    return res.status(500).json({
      success: false, code: "INVOICE_GENERATION_FAILED",
      message: "Could not generate invoice at this time",
    })
  }

  const diskPath = invoicePathFor(invoice.invoiceNumber)
  if (!fs.existsSync(diskPath)) {
    return res.status(404).json({
      success: false, code: "INVOICE_FILE_MISSING",
      message: "Invoice file not found on disk",
    })
  }

  // 4 · Stream
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`)
  res.setHeader("Cache-Control", "private, no-store")

  const stream = fs.createReadStream(diskPath)
  stream.on("error", (err) => {
    console.error("[invoice] stream error:", err.message)
    if (!res.headersSent) {
      res.status(500).json({ success: false, code: "STREAM_ERROR", message: "Could not stream invoice" })
    } else {
      res.end()
    }
  })
  stream.pipe(res)
})

module.exports = { getInvoicePdf }
