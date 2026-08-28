const crypto = require("crypto")
const prisma = require("../lib/prisma")
const NEWSLETTER_STATUSES = ["pending", "subscribed", "unsubscribed"] // enum NewsletterStatus

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
  return `${backendBaseUrl()}/api/v1/newsletter/unsubscribe/${encodeURIComponent(token)}`
}

/**
 * Confirmation link for double opt-in. NewsletterSubscriber has no dedicated
 * confirm-token column, so `unsubscribeToken` doubles as the confirm token
 * while the row is "pending" (it is rotated on confirmation so the link in
 * the confirmation email can never be replayed as an unsubscribe link).
 */
function buildConfirmUrl(token) {
  return `${backendBaseUrl()}/api/v1/newsletter/confirm/${encodeURIComponent(token)}`
}

const RESEND_COOLDOWN_MS = 10 * 60 * 1000

/**
 * Subscribe (double opt-in). Creates or updates the row with status
 * "pending" and tells the controller whether to send the confirmation email:
 *
 *   - new address / previously unsubscribed → pending + sendConfirmation
 *   - pending, last touched > 10 min ago    → resend confirmation
 *   - pending, touched within 10 min        → no-op (rate limited)
 *   - already "subscribed"                  → no-op success
 *
 * The model has no updatedAt column, so `subscribedAt` is refreshed on every
 * pending write and used as the resend timestamp.
 */
async function subscribe({ email, name, source }) {
  const normEmail = String(email || "").trim().toLowerCase()
  if (!normEmail) throw buildError("VALIDATION_ERROR", "Email is required", 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
    throw buildError("VALIDATION_ERROR", "Please enter a valid email address", 400)
  }

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: normEmail } })

  if (existing) {
    if (existing.status === "subscribed") {
      return { subscriber: existing, sendConfirmation: false, alreadySubscribed: true }
    }

    const updates = { status: "pending" }
    if (!existing.unsubscribeToken) updates.unsubscribeToken = randomToken()
    if (source && !existing.source) updates.source = source
    if (name && !existing.name)     updates.name = name

    if (existing.status === "pending") {
      const last = existing.subscribedAt ? new Date(existing.subscribedAt).getTime() : 0
      if (Date.now() - last < RESEND_COOLDOWN_MS) {
        return { subscriber: existing, sendConfirmation: false, rateLimited: true }
      }
    } else {
      // Re-subscribing an unsubscribed address → fresh token, clear tombstone.
      updates.unsubscribeToken = randomToken()
      updates.unsubscribedAt = null
    }
    updates.subscribedAt = new Date()

    const row = await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: updates })
    return { subscriber: row, sendConfirmation: true, confirmUrl: buildConfirmUrl(row.unsubscribeToken) }
  }

  const row = await prisma.newsletterSubscriber.create({
    data: {
      email:            normEmail,
      name:             name || null,
      source:           source || null,
      status:           "pending",
      unsubscribeToken: randomToken(),
    },
  })
  return { subscriber: row, sendConfirmation: true, confirmUrl: buildConfirmUrl(row.unsubscribeToken) }
}

/**
 * Confirm by token (double opt-in). Returns the subscriber or null when the
 * token is unknown. Already-confirmed rows are returned untouched.
 */
async function confirmByToken(token) {
  if (!token) return null
  const row = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } })
  if (!row) return null
  if (row.status === "subscribed") return row

  return prisma.newsletterSubscriber.update({
    where: { id: row.id },
    data:  {
      status:           "subscribed",
      subscribedAt:     new Date(),
      unsubscribedAt:   null,
      unsubscribeToken: randomToken(),   // rotate: confirm link ≠ unsubscribe link
    },
  })
}

function subscribeConfirmedUrl() {
  return `${frontendBaseUrl()}/unsubscribed?state=confirmed`
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
  if (status && NEWSLETTER_STATUSES.includes(status)) where.status = status
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

/**
 * CSV export of subscribers.
 *
 * A1 · paged, not one findMany. An admin export legitimately needs every row,
 * but "every row" used to mean one unbounded query materialising the whole
 * table as Prisma objects before a single line of CSV existed — memory
 * proportional to the list, on a shared host. Rows are now pulled 1,000 at a
 * time by cursor and appended as they arrive; only the CSV text accumulates.
 *
 * Cursor on the unique `id` with a stable (subscribedAt desc, id desc) order,
 * so a subscriber added mid-export cannot shift the pages and duplicate or
 * skip a row.
 */
const EXPORT_PAGE = 1000

async function exportSubscribersCsv({ status } = {}) {
  const where = {}
  if (status && NEWSLETTER_STATUSES.includes(status)) where.status = status

  const header = "email,name,status,source,subscribed_at,unsubscribed_at\n"
  const lines = []
  let cursor = null
  let count = 0

  for (;;) {
    const page = await prisma.newsletterSubscriber.findMany({
      where,
      orderBy: [{ subscribedAt: "desc" }, { id: "desc" }],
      take: EXPORT_PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, email: true, name: true, status: true, source: true, subscribedAt: true, unsubscribedAt: true },
    })
    for (const r of page) {
      lines.push([
        r.email,
        r.name || "",
        r.status,
        r.source || "",
        r.subscribedAt ? new Date(r.subscribedAt).toISOString() : "",
        r.unsubscribedAt ? new Date(r.unsubscribedAt).toISOString() : "",
      ].map(csvEscape).join(","))
    }
    count += page.length
    if (page.length < EXPORT_PAGE) break
    cursor = page[page.length - 1].id
  }

  return { csv: header + lines.join("\n"), count }
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
  confirmByToken,
  unsubscribeByToken,
  buildUnsubscribeUrl,
  buildConfirmUrl,
  subscribeConfirmedUrl,
  unsubscribeConfirmedUrl,
  listSubscribers,
  deleteSubscriber,
  exportSubscribersCsv,
}
