/**
 * src/jobs/invoiceDunningJob.js · Tier 4 billing safeguards
 *
 * Nightly pass (scheduler.js · 08:00 UTC):
 *   1. Reconcile — an `issued` / `overdue` invoice whose order was paid
 *      (the payment webhook path already flips it through ensureInvoice;
 *      this catches orders paid before that hook existed) → `paid`.
 *   2. Dunning — `issued` invoices past their dueDate → `overdue`, a late
 *      fee of totalAmount × INVOICE_LATE_FEE_RATE is recorded ONCE on the
 *      invoice, and the client gets the `invoice.overdue` email once
 *      (overdueNotifiedAt). The Order total is deliberately NOT changed:
 *      a gateway preference may already exist for the original amount and
 *      the webhook amount-match would then refuse the payment.
 *   3. Kill switch — a project whose linked orders carry an invoice overdue
 *      for more than PROJECT_SUSPEND_GRACE_DAYS is `suspended` (preview
 *      withheld, deliverables 402); a suspended project whose invoices are
 *      all paid goes back to `active`. `handover` is admin-only and never
 *      touched here.
 *
 * Idempotent: every write re-checks status in its WHERE; the overlap guard
 * in scheduler.js keeps two passes from racing.
 */
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { sendTemplateEmail } = require("../services/emailService")
const { notify } = require("../services/notificationService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { lateFeeRate, round2, toNumber } = require("../services/adminInvoiceService")
const { suspendGraceDays, unpaidInvoiceWhere, UNPAID_INVOICE_STATUSES } = require("../services/projectPortalService")

const BATCH = 200

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

async function reconcilePaid(now) {
  const rows = await prisma.invoice.findMany({
    where:  { status: { in: ["issued", "overdue"] }, order: { status: { in: ["paid", "completed"] } } },
    select: { id: true, order: { select: { paidAt: true } } },
    take:   BATCH,
  })
  let n = 0
  for (const inv of rows) {
    const r = await prisma.invoice.updateMany({
      where: { id: inv.id, status: { in: ["issued", "overdue"] } },
      data:  { status: "paid", paidAt: inv.order?.paidAt || now },
    })
    n += r.count
  }
  return n
}

async function markOverdue(now, { dryRun } = {}) {
  const rate = lateFeeRate()
  const due = await prisma.invoice.findMany({
    where:   { status: "issued", dueDate: { lt: now } },
    include: {
      order: {
        select: {
          id: true, orderNumber: true, status: true, totalAmount: true, currency: true,
          customerName: true, customerEmail: true, userId: true,
          user: { select: { id: true, fullName: true, email: true, profile: { select: { locale: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take:    BATCH,
  })
  if (dryRun) return { overdue: 0, emailed: 0, candidates: due.map((i) => i.invoiceNumber) }

  let overdue = 0
  let emailed = 0
  for (const inv of due) {
    const order = inv.order
    if (!order || order.status !== "pending") continue // paid/cancelled meanwhile → reconcile / void handles it
    const total = round2(toNumber(order.totalAmount))
    const existingFee = round2(toNumber(inv.lateFeeAmount))
    const fee = existingFee > 0 ? existingFee : round2(total * rate)
    const shouldEmail = !inv.overdueNotifiedAt

    try {
      const r = await prisma.invoice.updateMany({
        where: { id: inv.id, status: "issued" },
        data:  { status: "overdue", lateFeeRate: rate, lateFeeAmount: fee, ...(shouldEmail ? { overdueNotifiedAt: now } : {}) },
      })
      if (r.count !== 1) continue
      overdue += 1
    } catch (e) {
      logger.error(`[dunning] failed to mark ${inv.invoiceNumber} overdue: ${e.message}`)
      continue
    }

    if (!shouldEmail) continue
    const to = order.customerEmail || order.user?.email
    const orderUrl = `${frontendBase()}/dashboard/orders/${order.id}`
    const variables = {
      customerName:  String(order.customerName || order.user?.fullName || "there").split(" ")[0],
      invoiceNumber: inv.invoiceNumber,
      orderNumber:   order.orderNumber,
      orderTotal:    fmtMoney(total, order.currency),
      dueDate:       fmtDate(inv.dueDate),
      lateFee:       fmtMoney(fee, order.currency),
      amountDue:     fmtMoney(round2(total + fee), order.currency),
      orderUrl,
    }
    const sent = await sendTemplateEmail({
      to, templateKey: "invoice.overdue", userId: order.userId || undefined,
      locale: resolveUserLocale({ user: order.user }), variables,
    }).catch((e) => ({ ok: false, error: e.message }))
    if (sent?.ok) emailed += 1
    else logger.warn(`[dunning] overdue email failed for ${inv.invoiceNumber}: ${sent?.error || "unknown"}`)

    await notify(order.userId, {
      type:    "system",
      title:   `Invoice ${inv.invoiceNumber} is overdue`,
      message: `${variables.orderTotal} was due ${variables.dueDate}. A late fee of ${variables.lateFee} has been applied.`,
      linkUrl: `/dashboard/orders/${order.id}`,
    }).catch(() => null)
  }
  return { overdue, emailed }
}

/* ── Tier 4 · project kill switch ────────────────────────────────────── */

async function suspendProjects(now) {
  const cutoff = new Date(now.getTime() - suspendGraceDays() * 24 * 60 * 60 * 1000)
  const stale = await prisma.invoice.findMany({
    where:  { status: "overdue", dueDate: { lt: cutoff } },
    select: { serviceOrderId: true, orderId: true },
    take:   BATCH,
  })
  if (!stale.length) return 0
  const serviceOrderIds = [...new Set(stale.map((i) => i.serviceOrderId).filter(Boolean))]
  const orderIds        = [...new Set(stale.map((i) => i.orderId).filter(Boolean))]
  const or = []
  if (serviceOrderIds.length) or.push({ serviceOrderId: { in: serviceOrderIds } })
  if (orderIds.length) {
    or.push({ serviceOrder: { orderId: { in: orderIds } } })
    or.push({ changeRequests: { some: { orderId: { in: orderIds } } } })
  }
  const projects = await prisma.clientProject.findMany({
    where:  { accessState: "active", OR: or },
    select: { id: true, userId: true, projectName: true },
    take:   BATCH,
  })
  let n = 0
  for (const p of projects) {
    const r = await prisma.clientProject.updateMany({ where: { id: p.id, accessState: "active" }, data: { accessState: "suspended" } })
    if (r.count !== 1) continue
    n += 1
    await notify(p.userId, {
      type:    "system",
      title:   `Project paused · ${p.projectName}`,
      message: "An invoice on this project is overdue. The live preview and deliverables are on hold until it is paid.",
      linkUrl: `/dashboard/projects/${p.id}`,
    }).catch(() => null)
    logger.warn(`[dunning] suspended project ${p.id} (${p.projectName})`)
  }
  return n
}

async function reinstateProjects() {
  const suspended = await prisma.clientProject.findMany({
    where:  { accessState: "suspended" },
    select: {
      id: true, userId: true, projectName: true, serviceOrderId: true,
      serviceOrder:   { select: { orderId: true } },
      changeRequests: { where: { orderId: { not: null } }, select: { orderId: true } },
    },
    take: BATCH,
  })
  let n = 0
  for (const p of suspended) {
    const orderIds = [p.serviceOrder?.orderId, ...(p.changeRequests || []).map((c) => c.orderId)].filter(Boolean)
    const where = unpaidInvoiceWhere({ serviceOrderId: p.serviceOrderId, orderIds })
    const unpaid = where ? await prisma.invoice.count({ where }) : 0
    if (unpaid > 0) continue
    const r = await prisma.clientProject.updateMany({ where: { id: p.id, accessState: "suspended" }, data: { accessState: "active" } })
    if (r.count !== 1) continue
    n += 1
    await notify(p.userId, {
      type:    "system",
      title:   `Project resumed · ${p.projectName}`,
      message: "Thank you — the balance is settled and your project access is back.",
      linkUrl: `/dashboard/projects/${p.id}`,
    }).catch(() => null)
  }
  return n
}

async function runProjectAccessPass({ now = new Date() } = {}) {
  const suspended  = await suspendProjects(now)
  const reinstated = await reinstateProjects()
  return { suspended, reinstated }
}

async function runInvoiceDunningPass({ now = new Date(), dryRun = false } = {}) {
  const reconciled = dryRun ? 0 : await reconcilePaid(now)
  const { overdue, emailed, candidates } = await markOverdue(now, { dryRun })
  const access = dryRun ? { suspended: 0, reinstated: 0 } : await runProjectAccessPass({ now })
  logger.info(`[dunning] reconciled=${reconciled} overdue=${overdue} emailed=${emailed} suspended=${access.suspended} reinstated=${access.reinstated}${dryRun ? " (dry run)" : ""}`)
  return { reconciled, overdue, emailed, ...access, ...(candidates ? { candidates } : {}) }
}

module.exports = { runInvoiceDunningPass, reconcilePaid, markOverdue, runProjectAccessPass, suspendProjects, reinstateProjects, UNPAID_INVOICE_STATUSES }
