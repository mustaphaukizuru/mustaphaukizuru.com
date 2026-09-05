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
const projectEvents = require("./projectEventService")

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
    // T5-9 · how this bill gets paid, decided HERE for the same reason
    // downloadUrl is: the two surfaces do not agree, and a component that
    // guessed would be a second opinion on a question about money.
    //
    // A member is sent to the order page, which already carries the pay
    // card, the due date and the late fee — no new payment code. A portal
    // visitor has no session for that page to read, so they get an endpoint
    // that mints the preference server-side.
    pay: (UNPAID_STATUSES.includes(invoice.status) && invoice.orderId)
      ? (portal
        ? { mode: "api",  url: `/api/v1/portal/me/invoices/${invoice.id}/pay` }
        : { mode: "link", url: `/dashboard/orders/${invoice.orderId}` })
      : null,
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

/**
 * Which project an order is billed through, if any. (T5-9)
 *
 * The inverse of loadBillingLinks, and it has to look in two places because
 * a project can be billed through two kinds of order: the service order it
 * was sold under, and any order raised by an accepted change request. Both
 * are the same project's money.
 *
 * Returns null and never throws — every caller is recording an event about
 * something that has already happened, and an event that cannot be written
 * must not undo it.
 */
async function projectIdForOrder(orderId) {
  if (!orderId) return null
  try {
    const viaServiceOrder = await prisma.clientProject.findFirst({
      where:  { serviceOrder: { orderId: String(orderId) } },
      select: { id: true },
    })
    if (viaServiceOrder) return viaServiceOrder.id

    const viaChangeRequest = await prisma.changeRequest.findFirst({
      where:  { orderId: String(orderId) },
      select: { projectId: true },
    })
    return viaChangeRequest?.projectId || null
  } catch {
    return null
  }
}

/** Same, from an invoice — which may name the service order directly. */
async function projectIdForInvoice(invoice) {
  if (!invoice) return null
  try {
    if (invoice.serviceOrderId) {
      const p = await prisma.clientProject.findFirst({
        where:  { serviceOrderId: String(invoice.serviceOrderId) },
        select: { id: true },
      })
      if (p) return p.id
    }
    return projectIdForOrder(invoice.orderId)
  } catch {
    return null
  }
}

/**
 * "Payment started" on the project timeline. (T5-9)
 *
 * Called from every place a client can begin paying — the member pay card
 * through Mercado Pago or PayPal, and the portal's own route — because the
 * reason it exists is the same at all three: OXXO and SPEI are not instant,
 * and a client who paid at a shop on Friday and sees nothing on the tracker
 * until Monday assumes it failed and pays twice.
 *
 * Deduplicated within the window because a client who bounces off the
 * gateway and comes back is one payment attempt, not four timeline rows.
 * Best-effort throughout: the payment matters, the note about it does not.
 */
const PAYMENT_EVENT_DEDUPE_MS = 30 * 60 * 1000

async function recordPaymentInitiated(orderId, { gateway = null } = {}) {
  try {
    const projectId = await projectIdForOrder(orderId)
    if (!projectId) return null

    const since = new Date(Date.now() - PAYMENT_EVENT_DEDUPE_MS)
    const recent = await prisma.projectEvent.findFirst({
      where:  { projectId, type: "payment.initiated", createdAt: { gte: since } },
      select: { id: true },
    })
    if (recent) return null

    const label = gateway === "paypal" ? "PayPal" : gateway === "mercadopago" ? "Mercado Pago" : null
    return await projectEvents.record({
      projectId,
      type: "payment.initiated",
      actorRole: "client",
      ...(label ? { detail: label, detailEs: label } : {}),
      // No orderId ref: ProjectEvent's ref columns are milestone, file, file
      // request and invoice, and anything else is dropped on the floor.
    })
  } catch {
    return null
  }
}

/**
 * A row on the project timeline for an invoice that just changed state.
 *
 * "invoice.paid" and "invoice.overdue" have both been in the event
 * catalogue since T5-2 and neither was ever written, so the timeline said
 * "Invoice issued" and then went quiet on the two lines a client most wants
 * to see — including the one that says they owe money.
 *
 * Callers pass the invoice they just updated. Only ever on a real
 * transition: every call site guards on an updateMany count, because an
 * event is a record of something that happened.
 */
async function recordInvoiceEvent(invoice, type) {
  try {
    const projectId = await projectIdForInvoice(invoice)
    if (!projectId) return null
    return await projectEvents.record({
      projectId,
      type,
      actorRole: "system",
      detail:   invoice.invoiceNumber || undefined,
      detailEs: invoice.invoiceNumber || undefined,
      refs: { invoiceId: invoice.id },
    })
  } catch {
    return null
  }
}

const recordInvoicePaid    = (invoice) => recordInvoiceEvent(invoice, "invoice.paid")
const recordInvoiceOverdue = (invoice) => recordInvoiceEvent(invoice, "invoice.overdue")

module.exports = {
  UNPAID_STATUSES,
  recordPaymentInitiated,
  recordInvoicePaid,
  recordInvoiceOverdue,
  projectIdForOrder,
  projectIdForInvoice,
  serializeInvoice,
  listForProject,
  findForProject,
}
