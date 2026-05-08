const crypto = require("crypto")
const prisma = require("../lib/prisma")

/**
 * Newsletter service (B07)
 *
 * Extends the existing contactService.subscribeNewsletter behavior with:
 *   - `unsubscribeToken` generation per subscriber (32-byte hex)
 *   - `source` attribution (footer | contact-page | admin-invite | ...)
 *   - Token-based unsubscribe (the URL does not expose the email)
 *
 * Schema additions required on NewsletterSubscriber:
 *   unsubscribeToken  String?  @unique
 *   source            String?
 *   name              String?
 */

function randomToken() {
  return crypto.randomBytes(32).toString("hex")
}

function frontendBaseUrl() {
  return process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173"
}

function backendBaseUrl() {
  return process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:5000"
}

/**
 * Build a link that the recipient clicks to unsubscribe. We point to the
 * backend so we can update the row before redirecting; the backend then
 * redirects to a friendly frontend confirmation.
 */
function buildUnsubscribeUrl(token) {
  return `${backendBaseUrl()}/api/newsletter/unsubscribe/${encodeURIComponent(token)}`
}

/**
 * Subscribe or re-subscribe an email. Returns the row plus a flag indicating
 * whether this is a new signup (the controller uses the flag to decide
 * whether to send the welcome email).
 */
async function subscribe({ email, name, source }) {
  const normEmail = String(email || "").trim().toLowerCase()
  if (!normEmail) throw buildError("VALIDATION_ERROR", "Email is required", 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
    throw buildError("VALIDATION_ERROR", "Please enter a valid email address", 400)
  }

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: normEmail } })

  if (existing) {
    // Already subscribed — refresh token if missing, flag as existing.
    const updates = {}
    if (!existing.unsubscribeToken) updates.unsubscribeToken = randomToken()
    if (existing.status === "unsubscribed") {
      updates.status = "subscribed"
      updates.subscribedAt = new Date()
      updates.unsubscribedAt = null
    }
    if (source && !existing.source) updates.source = source
    if (name && !existing.name)     updates.name = name

    const row = Object.keys(updates).length > 0
      ? await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: updates })
      : existing

    const isNew = existing.status === "unsubscribed"   // re-subscribe → treat as new for welcome email
    return { subscriber: row, isNew, unsubscribeUrl: buildUnsubscribeUrl(row.unsubscribeToken) }
  }

  const row = await prisma.newsletterSubscriber.create({
    data: {
      email:            normEmail,
      name:             name || null,
      source:           source || null,
      status:           "subscribed",
      unsubscribeToken: randomToken(),
    },
  })
  return { subscriber: row, isNew: true, unsubscribeUrl: buildUnsubscribeUrl(row.unsubscribeToken) }
}

/**
 * Unsubscribe by token. Returns the subscriber if found, null otherwise.
 */
async function unsubscribeByToken(token) {
  if (!token) return null
  const row = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } })
  if (!row) return null
  if (row.status === "unsubscribed") return row

  return prisma.newsletterSubscriber.update({
    where: { id: row.id },
    data:  { status: "unsubscribed", unsubscribedAt: new Date() },
  })
}

/**
 * Unsubscribe page URL (on the frontend) that the backend redirects to
 * after processing the token.
 */
function unsubscribeConfirmedUrl() {
  return `${frontendBaseUrl()}/unsubscribed`
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin operations
 * ──────────────────────────────────────────────────────────────────────────── */

async function listSubscribers({ status, page = 1, limit = 50, q } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))

  const where = {}
  if (status) where.status = status
  if (q) where.email = { contains: String(q).trim() }

  const [items, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { subscribedAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
    }),
    prisma.newsletterSubscriber.count({ where }),
  ])

  return {
    items,
    pagination: {
      page: safePage, limit: safeLimit, total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function deleteSubscriber(id) {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.newsletterSubscriber.delete({ where: { id } })
  return { id, deleted: true }
}

async function exportSubscribersCsv({ status } = {}) {
  const where = {}
  if (status) where.status = status

  const rows = await prisma.newsletterSubscriber.findMany({
    where,
    orderBy: { subscribedAt: "desc" },
  })

  const header = "email,name,status,source,subscribed_at,unsubscribed_at\n"
  const csv = rows.map((r) => {
    const fields = [
      r.email,
      r.name || "",
      r.status,
      r.source || "",
      r.subscribedAt ? new Date(r.subscribedAt).toISOString() : "",
      r.unsubscribedAt ? new Date(r.unsubscribedAt).toISOString() : "",
    ].map(csvEscape)
    return fields.join(",")
  }).join("\n")

  return { csv: header + csv, count: rows.length }
}

function csvEscape(v) {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.code = code
  err.statusCode = statusCode
  return err
}

module.exports = {
  subscribe,
  unsubscribeByToken,
  buildUnsubscribeUrl,
  unsubscribeConfirmedUrl,
  listSubscribers,
  deleteSubscriber,
  exportSubscribersCsv,
}
