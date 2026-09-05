/**
 * projectInvoiceService.js · invoices, where the work is (T5-4).
 *
 * Manual invoices already hang off a project's service order, but the client
 * found them on a bare order page with no idea which project they belonged
 * to. Nothing new is billed here: this reads the invoices that already exist
 * and presents them beside the project, for both the dashboard and the PIN
 * portal.
 *
 * The money itself is untouched. Amounts are read from the invoice's own
 * snapshot columns, which exist precisely so an invoice does not change when
 * the order later does (a refund, an edit). Download continues to go through
 * the existing owner-checked PDF route rather than a second copy of that
 * logic — the one thing you do not want two implementations of is "may this
 * person have this PDF".
 */

const prisma = require("../lib/prisma")
const { loadBillingLinks } = require("./projectPortalService")

/** Unpaid, in the same sense as the handover gate uses. */
const UNPAID_STATUSES = ["issued", "overdue"]

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * One invoice as a client sees it.
 *
 * `downloadUrl` points at the existing order-scoped route, whose owner-or-
 * admin check and settled-status gate are already written and tested. A
 * portal viewer gets the portal's own route instead, because it has no
 * session for that check to read.
 */
function serializeInvoice(invoice, { portal = false } = {}) {
  if (!invoice) return null
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    subtotalAmount: toNumber(invoice.subtotalAmount),
    taxAmount: toNumber(invoice.taxAmount),
    totalAmount: toNumber(invoice.totalAmount),
    lateFeeAmount: toNumber(invoice.lateFeeAmount),
    issuedAt: invoice.issuedAt?.toISOString?.() || null,
    dueDate: invoice.dueDate?.toISOString?.() || null,
    paidAt: invoice.paidAt?.toISOString?.() || null,
    isUnpaid: UNPAID_STATUSES.includes(invoice.status),
    orderId: invoice.orderId,
    downloadUrl: portal
      ? `/api/v1/portal/me/invoices/${invoice.id}/pdf`
      : `/api/v1/orders/${invoice.orderId}/invoice.pdf`,
  }
}

/** Every invoice on the orders this project is billed through. */
async function listForProject(projectId, { portal = false } = {}) {
  const links = await loadBillingLinks(projectId)
  if (!links) return { invoices: [], billing: { unpaidCount: 0, nextDueAt: null, unpaidTotal: 0 } }

  const or = []
  if (links.serviceOrderId) or.push({ serviceOrderId: links.serviceOrderId })
  if (links.orderIds.length) or.push({ orderId: { in: links.orderIds } })
  if (!or.length) return { invoices: [], billing: { unpaidCount: 0, nextDueAt: null, unpaidTotal: 0 } }

  const rows = await prisma.invoice.findMany({
    where: { OR: or },
    orderBy: { issuedAt: "desc" },
  })

  // Voided invoices are not shown. They are kept for the audit trail, and
  // showing a client a cancelled bill invites a payment nobody wants.
  const visible = rows.filter((r) => r.status !== "void")
  const invoices = visible.map((r) => serializeInvoice(r, { portal }))
  const unpaid = invoices.filter((i) => i.isUnpaid)

  return {
    invoices,
    billing: {
      unpaidCount: unpaid.length,
      // The soonest thing owed, so the UI can say "1 invoice due 12 Sep"
      // rather than making the client scan a table.
      nextDueAt: unpaid
        .map((i) => i.dueDate)
        .filter(Boolean)
        .sort()[0] || null,
      unpaidTotal: Number(unpaid.reduce((sum, i) => sum + i.totalAmount, 0).toFixed(2)),
    },
  }
}

/**
 * Confirm an invoice belongs to a project, for the portal PDF route.
 *
 * The portal has no session, so the owner check that the order-scoped route
 * performs cannot run. This is its replacement: the invoice must be on one of
 * the orders this portal's project is billed through. Returns null rather
 * than throwing so the caller can answer 404 without distinguishing "no such
 * invoice" from "not yours".
 */
async function findForProject(invoiceId, projectId) {
  if (!invoiceId || !projectId) return null
  const links = await loadBillingLinks(projectId)
  if (!links) return null

  const invoice = await prisma.invoice.findUnique({ where: { id: String(invoiceId) } })
  if (!invoice) return null

  const belongs = (links.serviceOrderId && invoice.serviceOrderId === links.serviceOrderId)
    || links.orderIds.includes(invoice.orderId)
  if (!belongs) return null
  // A voided invoice is not downloadable, for the same reason it is not
  // listed.
  if (invoice.status === "void") return null

  return invoice
}

module.exports = {
  UNPAID_STATUSES,
  serializeInvoice,
  listForProject,
  findForProject,
}
