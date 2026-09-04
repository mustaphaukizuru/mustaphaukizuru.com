/**
 * adminInvoiceService · Tier 4 billing.
 *
 * Manual invoices: an admin raises an invoice against an existing
 * ServiceOrder (deposit, balance, extra hours). The invoice is a normal
 * pending Order with one `service` line so the client pays it through the
 * usual gateways from /dashboard/orders/:id; the Invoice row carries the
 * due date and the late-fee bookkeeping that src/jobs/invoiceDunningJob.js
 * maintains.
 *
 * Tax: there is no src/lib/tax.js in this codebase, so manual invoices are
 * issued with a 0 tax rate (amount is the total). Revisit when a tax module
 * lands — computeOrderTax should replace the identity below.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const generateInvoiceNumber = require("../utils/generateInvoiceNumber")
const { sendTemplateEmail } = require("./emailService")
const { notify } = require("./notificationService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

const MAX_AMOUNT = 1000000000

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

function lateFeeRate() {
  const n = Number(process.env.INVOICE_LATE_FEE_RATE)
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : 0.02
}

function round2(n) { return Math.round(Number(n) * 100) / 100 }

function toNumber(v) {
  if (v == null) return 0
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** No tax module yet — identity. Kept as a seam for computeOrderTax. */
function computeInvoiceTax(amount) {
  return { taxRate: 0, taxAmount: 0, totalAmount: round2(amount) }
}

function frontendBase() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://mustaphaukizuru.com").replace(/\/$/, "")
}

function fmtMoney(v, currency) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "MXN", maximumFractionDigits: 2 }).format(Number(v || 0)) }
  catch { return `${Number(v || 0).toFixed(2)} ${currency || "MXN"}` }
}
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) }
  catch { return String(d) }
}

function invoiceOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `INV-${y}${m}${d}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function uniqueOrderNumber() {
  for (let i = 0; i < 10; i += 1) {
    const orderNumber = invoiceOrderNumber()
    const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } })
    if (!existing) return orderNumber
  }
  throw err("Could not allocate an order number", "ORDER_NUMBER", 500)
}

function serializeInvoice(inv) {
  if (!inv) return null
  return {
    id:                inv.id,
    orderId:           inv.orderId,
    invoiceNumber:     inv.invoiceNumber,
    invoicePdfUrl:     inv.invoicePdfUrl,
    status:            inv.status,
    serviceOrderId:    inv.serviceOrderId || null,
    issuedAt:          inv.issuedAt,
    dueDate:           inv.dueDate || null,
    paidAt:            inv.paidAt || null,
    lateFeeRate:       toNumber(inv.lateFeeRate),
    lateFeeAmount:     round2(toNumber(inv.lateFeeAmount)),
    overdueNotifiedAt: inv.overdueNotifiedAt || null,
    ...(inv.order ? {
      order: {
        id:            inv.order.id,
        orderNumber:   inv.order.orderNumber,
        status:        inv.order.status,
        totalAmount:   round2(toNumber(inv.order.totalAmount)),
        currency:      inv.order.currency,
        customerName:  inv.order.customerName,
        customerEmail: inv.order.customerEmail,
        userId:        inv.order.userId,
      },
    } : {}),
  }
}

/**
 * POST /admin/invoices
 * @param {{ serviceOrderId:string, amount:number|string, dueDate:string, description?:string, adminUserId:string, ipAddress?:string, req?:object }} input
 */
async function createManualInvoice({ serviceOrderId, amount, dueDate, description, adminUserId, ipAddress = null, req = null }) {
  if (!serviceOrderId) throw err("serviceOrderId is required", "VALIDATION_ERROR")
  if (!adminUserId)    throw err("adminUserId is required", "VALIDATION_ERROR")

  const amt = round2(Number(amount))
  if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_AMOUNT) throw err("amount must be a positive number", "VALIDATION_ERROR")

  const due = dueDate ? new Date(dueDate) : null
  if (!due || Number.isNaN(due.getTime())) throw err("dueDate must be a valid date", "VALIDATION_ERROR")

  const desc = String(description || "").trim().slice(0, 500)

  const so = await prisma.serviceOrder.findUnique({
    where:   { id: String(serviceOrderId) },
    include: {
      user:    { select: { id: true, fullName: true, email: true, profile: { select: { country: true } } } },
      service: { select: { id: true, title: true } },
      order:   { select: { id: true, currency: true } },
    },
  })
  if (!so) throw err("Service order not found", "NOT_FOUND", 404)
  if (!so.user?.email) throw err("Service order has no customer email", "VALIDATION_ERROR", 409)

  const currency = so.order?.currency || "MXN"
  const tax = computeInvoiceTax(amt)
  const title = desc || `Invoice — ${so.service?.title || "Service"}`
  const orderNumber   = await uniqueOrderNumber()
  const invoiceNumber = await generateInvoiceNumber()
  const rate = lateFeeRate()

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId:         so.user.id,
        customerName:   so.user.fullName || "Customer",
        customerEmail:  so.user.email,
        status:         "pending",
        subtotalAmount: amt,
        totalAmount:    tax.totalAmount,
        currency,
        notes:          desc || null,
      },
    })
    const item = await tx.orderItem.create({
      data: {
        orderId:             order.id,
        itemType:            "service",
        serviceId:           so.service?.id || so.serviceId,
        title,
        titleSnapshot:       title,
        descriptionSnapshot: desc || null,
        price:               amt,
        unitPrice:           amt,
        quantity:            1,
        lineTotal:           amt,
      },
    })
    const invoice = await tx.invoice.create({
      data: {
        orderId:        order.id,
        invoiceNumber,
        invoicePdfUrl:  `/api/orders/${order.id}/invoice.pdf`,
        status:         "issued",
        serviceOrderId: so.id,
        dueDate:        due,
        lateFeeRate:    rate,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action:     "invoice.issued",
        targetType: "Invoice",
        targetId:   invoice.id,
        afterJson:  { orderId: order.id, orderNumber, invoiceNumber, serviceOrderId: so.id, amount: amt, currency, dueDate: due.toISOString(), taxRate: tax.taxRate, lateFeeRate: rate },
        ipAddress,
      },
    })
    return { order, item, invoice }
  })

  const orderUrl = `${frontendBase()}/dashboard/orders/${result.order.id}`
  const variables = {
    customerName:  String(so.user.fullName || "there").split(" ")[0],
    invoiceNumber,
    orderNumber,
    orderTotal:    fmtMoney(tax.totalAmount, currency),
    dueDate:       fmtDate(due),
    description:   title,
    orderUrl,
  }
  sendTemplateEmail({
    to:          so.user.email,
    templateKey: "invoice.issued",
    userId:      so.user.id,
    locale:      resolveUserLocale({ req, user: so.user }),
    variables,
  }).catch((e) => logger.warn(`[invoice] issued email failed for ${invoiceNumber}: ${e.message}`))
  notify(so.user.id, {
    type:    "system",
    title:   `Invoice ${invoiceNumber} issued`,
    message: `${title} · ${variables.orderTotal} · due ${variables.dueDate}.`,
    linkUrl: `/dashboard/orders/${result.order.id}`,
  }).catch(() => null)

  return {
    invoice: serializeInvoice({ ...result.invoice, order: result.order }),
    orderId: result.order.id,
    orderNumber,
    taxRate: tax.taxRate,
  }
}

async function listInvoices({ status, page = 1, limit = 30 } = {}) {
  const where = {}
  if (status) where.status = String(status)
  const take = Math.min(100, Math.max(1, Number(limit) || 30))
  const skip = Math.max(0, (Number(page) - 1) * take)
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where, orderBy: { issuedAt: "desc" }, skip, take,
      include: { order: { select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true, customerName: true, customerEmail: true, userId: true } } },
    }),
    prisma.invoice.count({ where }),
  ])
  return { invoices: rows.map(serializeInvoice), meta: { total, page: Number(page) || 1, limit: take, pages: Math.ceil(total / take) } }
}

/** Void an unpaid manual invoice; its pending order is cancelled with it. */
async function voidInvoice({ invoiceId, adminUserId, ipAddress = null }) {
  const inv = await prisma.invoice.findUnique({ where: { id: String(invoiceId) }, include: { order: { select: { id: true, status: true } } } })
  if (!inv) throw err("Invoice not found", "NOT_FOUND", 404)
  if (inv.status === "paid" || inv.order?.status === "paid") throw err("A paid invoice cannot be voided — refund the order instead", "INVALID_STATE", 409)
  if (inv.status === "void") return serializeInvoice(inv)
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoice.update({ where: { id: inv.id }, data: { status: "void" } })
    if (inv.order?.status === "pending") {
      await tx.order.updateMany({ where: { id: inv.order.id, status: "pending" }, data: { status: "cancelled" } })
    }
    await tx.adminAuditLog.create({
      data: { adminUserId, action: "invoice.void", targetType: "Invoice", targetId: inv.id, beforeJson: { status: inv.status }, afterJson: { status: "void" }, ipAddress },
    })
    return row
  })
  return serializeInvoice(updated)
}

module.exports = { createManualInvoice, listInvoices, voidInvoice, serializeInvoice, lateFeeRate, computeInvoiceTax, round2, toNumber }
