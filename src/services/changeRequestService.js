/**
 * changeRequestService · Tier 4 — client-initiated extra work.
 *
 *   requested ──(admin quote)──▶ quoted ──(client accept)──▶ accepted ──▶ done
 *        │                          │
 *        └────────(client decline)──┴──▶ declined
 *
 * Accepting a quote creates the payable Order + service line + ServiceOrder
 * through the same shape services/serviceOrderService.createServiceOrder
 * uses (so payment, invoice and audit flows are unchanged) and a milestone
 * titled from the request. fulfillOrder skips auto-creating a second
 * ClientProject for that ServiceOrder (it belongs to the existing project).
 *
 * Member writes go through projectPortalService.assertWritable — a closed
 * project accepts no new requests, quotes or decisions.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { loadOwnedProject, assertWritable, assertCanApprove } = require("./projectPortalService")
const { notifyAdminsProjectActivity, notify } = require("./notificationService")
const { sendTemplateEmail } = require("./emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { createUniqueOrderNumber } = require("./serviceOrderService")

const STATUSES = ["requested", "quoted", "accepted", "declined", "done"]
const MAX_AMOUNT = 1000000000

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}
function round2(n) { return Math.round(Number(n) * 100) / 100 }
function toNumber(v) {
  if (v == null) return null
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function frontendBase() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://mustaphaukizuru.com").replace(/\/$/, "")
}
function fmtMoney(v, currency) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "MXN", maximumFractionDigits: 2 }).format(Number(v || 0)) }
  catch { return `${Number(v || 0).toFixed(2)} ${currency || "MXN"}` }
}

function serialize(cr) {
  if (!cr) return null
  return { ...cr, quoteAmount: toNumber(cr.quoteAmount) }
}

/* ── reads ─────────────────────────────────────────────────────────────── */

async function listForProject({ projectId }) {
  const rows = await prisma.changeRequest.findMany({
    where:   { projectId: String(projectId) },
    orderBy: { createdAt: "desc" },
    take:    200,
  })
  return rows.map(serialize)
}

async function listMine({ userId, projectId }) {
  const project = await loadOwnedProject({ userId, projectId })
  return listForProject({ projectId: project.id })
}

async function loadOnProject(projectId, crId) {
  const cr = await prisma.changeRequest.findFirst({ where: { id: String(crId), projectId: String(projectId) } })
  if (!cr) throw err("Change request not found", "NOT_FOUND", 404)
  return cr
}

/* ── client · request ──────────────────────────────────────────────────── */

async function createRequest({ userId, projectId, title, description }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)

  const t = String(title || "").trim()
  const d = String(description || "").trim()
  if (!t) throw err("Give the request a short title", "VALIDATION_ERROR")
  if (t.length > 160) throw err("Title is too long (max 160 characters)", "VALIDATION_ERROR")
  if (!d) throw err("Describe the extra work you need", "VALIDATION_ERROR")
  if (d.length > 5000) throw err("Description is too long (max 5000 characters)", "VALIDATION_ERROR")

  const cr = await prisma.changeRequest.create({
    data: { projectId: project.id, requestedById: String(userId), title: t, description: d, status: "requested" },
  })

  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.change_request.created", entityType: "ChangeRequest", entityId: cr.id,
      description: `Client requested extra work on ${project.projectName}: ${t}`,
    },
  }).catch(() => null)
  notifyAdminsProjectActivity({ project, kind: "changeRequest", summary: `${t} — ${d.slice(0, 120)}` })
    .catch((e) => logger.warn("[change-request] admin notify failed", e.message))

  return serialize(cr)
}

/* ── admin · quote ─────────────────────────────────────────────────────── */

async function quoteRequest({ projectId, crId, amount, note, currency, adminId, req = null }) {
  const project = await prisma.clientProject.findUnique({
    where:   { id: String(projectId) },
    select:  {
      id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true, assignedAdminId: true,
      user: { select: { id: true, fullName: true, email: true, profile: { select: { country: true } } } },
      serviceOrder: { select: { order: { select: { currency: true } } } },
    },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  const cr = await loadOnProject(project.id, crId)
  if (!["requested", "quoted"].includes(cr.status)) {
    throw err(`Request is "${cr.status}" — only open requests can be quoted`, "INVALID_STATE", 409)
  }

  const amt = round2(Number(amount))
  if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_AMOUNT) throw err("amount must be a positive number", "VALIDATION_ERROR")
  const cur = String(currency || project.serviceOrder?.order?.currency || cr.quoteCurrency || "MXN").toUpperCase().slice(0, 3)
  const quoteNote = String(note || "").trim().slice(0, 5000) || null

  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data:  { status: "quoted", quoteAmount: amt, quoteCurrency: cur, quoteNote, quotedAt: new Date(), declinedAt: null },
  })

  const dashboardUrl = `${frontendBase()}/dashboard/projects/${project.id}`
  if (project.user?.email) {
    sendTemplateEmail({
      to:          project.user.email,
      templateKey: "project.change-request-quoted",
      userId:      project.userId,
      locale:      resolveUserLocale({ req, user: project.user }),
      variables: {
        customerName: String(project.user.fullName || "there").split(" ")[0],
        projectName:  project.projectName,
        requestTitle: cr.title,
        quoteAmount:  fmtMoney(amt, cur),
        quoteNote:    quoteNote || "—",
        dashboardUrl,
      },
    }).catch((e) => logger.warn(`[change-request] quote email failed: ${e.message}`))
  }
  notify(project.userId, {
    type:    "system",
    title:   `Quote ready · ${cr.title}`,
    message: `${fmtMoney(amt, cur)} for "${cr.title}" on ${project.projectName}. Accept it from the project page to get started.`,
    linkUrl: `/dashboard/projects/${project.id}`,
  }).catch(() => null)
  await prisma.activityLog.create({
    data: {
      userId: adminId ? String(adminId) : null, action: "project.change_request.quoted", entityType: "ChangeRequest", entityId: cr.id,
      description: `Quoted ${fmtMoney(amt, cur)} for "${cr.title}" on ${project.projectName}`,
    },
  }).catch(() => null)

  return serialize(updated)
}

/* ── client · accept / decline ─────────────────────────────────────────── */

async function acceptRequest({ userId, projectId, crId }) {
  const owned = await loadOwnedProject({ userId, projectId })
  assertWritable(owned)
  // T5-17 · accepting a quote raises an order the client has to pay. That is
  // the clearest case of committing them to something.
  assertCanApprove(owned, "accept a quote")
  const cr = await loadOnProject(owned.id, crId)
  if (cr.status !== "quoted") throw err(`Request is "${cr.status}" — only quoted requests can be accepted`, "INVALID_STATE", 409)

  const project = await prisma.clientProject.findUnique({
    where:  { id: owned.id },
    select: {
      id: true, projectName: true,
      user: { select: { id: true, fullName: true, email: true } },
      serviceOrder: { select: { id: true, serviceId: true, servicePackageId: true, order: { select: { currency: true } } } },
    },
  })
  if (!project?.serviceOrder?.serviceId) {
    throw err("This project has no service linked, so a quote cannot be turned into an order — contact support", "NO_SERVICE", 409)
  }
  if (!project.user?.email) throw err("Your account has no email on file", "VALIDATION_ERROR", 409)

  const amount = round2(toNumber(cr.quoteAmount) || 0)
  if (amount <= 0) throw err("Quote has no amount", "INVALID_STATE", 409)
  const currency = cr.quoteCurrency || project.serviceOrder.order?.currency || "MXN"
  const title = `${project.projectName} — ${cr.title}`
  const orderNumber = await createUniqueOrderNumber()

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId:         String(userId),
        customerName:   project.user.fullName || "Customer",
        customerEmail:  project.user.email,
        subtotalAmount: amount,
        totalAmount:    amount,
        currency,
        status:         "pending",
        notes:          cr.quoteNote || null,
      },
    })
    const orderItem = await tx.orderItem.create({
      data: {
        orderId:             order.id,
        itemType:            "service",
        serviceId:           project.serviceOrder.serviceId,
        title,
        titleSnapshot:       title,
        descriptionSnapshot: cr.description,
        price:               amount,
        unitPrice:           amount,
        quantity:            1,
        lineTotal:           amount,
      },
    })
    const serviceOrder = await tx.serviceOrder.create({
      data: {
        orderId:          order.id,
        orderItemId:      orderItem.id,
        userId:           String(userId),
        serviceId:        project.serviceOrder.serviceId,
        servicePackageId: project.serviceOrder.servicePackageId || null,
        status:           "new",
        notes:            `Change request: ${cr.title}`,
      },
    })
    const last = await tx.projectMilestone.findFirst({
      where: { projectId: project.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true },
    })
    const milestone = await tx.projectMilestone.create({
      data: {
        projectId:   project.id,
        title:       cr.title,
        description: cr.description.slice(0, 2000),
        status:      "pending",
        sortOrder:   (last?.sortOrder ?? -1) + 1,
      },
    })
    const updated = await tx.changeRequest.update({
      where: { id: cr.id },
      data:  { status: "accepted", acceptedAt: new Date(), orderId: order.id, milestoneId: milestone.id },
    })
    return { order, serviceOrder, milestone, updated }
  })

  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.change_request.accepted", entityType: "ChangeRequest", entityId: cr.id,
      description: `Client accepted "${cr.title}" (${fmtMoney(amount, currency)}) on ${project.projectName} → order ${orderNumber}`,
    },
  }).catch(() => null)
  notifyAdminsProjectActivity({ project: owned, kind: "changeRequestAccepted", summary: `"${cr.title}" accepted — order ${orderNumber} (${fmtMoney(amount, currency)}) awaiting payment` })
    .catch((e) => logger.warn("[change-request] admin notify failed", e.message))

  return {
    changeRequest:  serialize(result.updated),
    orderId:        result.order.id,
    orderNumber,
    serviceOrderId: result.serviceOrder.id,
    milestoneId:    result.milestone.id,
    amount,
    currency,
    redirectUrl:    `/dashboard/orders/${result.order.id}`,
  }
}

async function declineRequest({ userId, projectId, crId, note = null }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  // Declining is a decision about money too, and it closes the request for
  // everyone. Same authority as accepting.
  assertCanApprove(project, "decline a quote")
  const cr = await loadOnProject(project.id, crId)
  if (!["requested", "quoted"].includes(cr.status)) {
    throw err(`Request is "${cr.status}" — it can no longer be declined`, "INVALID_STATE", 409)
  }
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data:  { status: "declined", declinedAt: new Date() },
  })
  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.change_request.declined", entityType: "ChangeRequest", entityId: cr.id,
      description: `Client declined "${cr.title}" on ${project.projectName}${note ? ` — ${String(note).slice(0, 200)}` : ""}`,
    },
  }).catch(() => null)
  notifyAdminsProjectActivity({ project, kind: "changeRequestDeclined", summary: `"${cr.title}" declined${note ? ` — ${String(note).slice(0, 120)}` : ""}` })
    .catch((e) => logger.warn("[change-request] admin notify failed", e.message))
  return serialize(updated)
}

/** Admin closes the loop once the extra work shipped. */
async function markDone({ projectId, crId }) {
  const cr = await loadOnProject(projectId, crId)
  if (cr.status !== "accepted") throw err(`Request is "${cr.status}" — only accepted requests can be marked done`, "INVALID_STATE", 409)
  return serialize(await prisma.changeRequest.update({ where: { id: cr.id }, data: { status: "done" } }))
}

module.exports = {
  STATUSES, serialize,
  listForProject, listMine,
  createRequest, quoteRequest, acceptRequest, declineRequest, markDone,
}
