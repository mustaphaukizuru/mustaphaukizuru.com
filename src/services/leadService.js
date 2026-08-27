/**
 * leadService.js — Unified leads inbox (Tier 3).
 *
 * A "lead" is any email address that has touched the site through one of
 * the capture surfaces. There is no Lead table: leads are derived on demand
 * by merging four source tables on the lower-cased email address, then
 * decorated with account/purchase state when a User row exists.
 *
 *   contact    → ContactMessage       (name, subject, status)
 *   diagnostic → DiagnosticSubmission (tier, score, audience)
 *   newsletter → NewsletterSubscriber (status: pending|subscribed|unsubscribed)
 *   booking    → Consultation         (scheduledAt, status — email via User)
 *
 * HONEST LIMIT: each source is read with `take: MAX_PER_SOURCE` newest rows
 * (500) and merged in JS, so the inbox is a "recent leads" view, not a
 * full-history report. An address whose only activity is older than the
 * newest 500 rows of every table will not appear, and `meta.total` counts
 * only the merged window. This keeps the admin request bounded regardless
 * of table size; a materialised Lead table is the next step if volume ever
 * justifies it.
 */

const prisma = require("../lib/prisma")

const MAX_PER_SOURCE = 500
const SOURCES = ["contact", "diagnostic", "newsletter", "booking"]

const normEmail = (e) => String(e || "").trim().toLowerCase()

const maxDate = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b)
const minDate = (a, b) => (!a ? b : !b ? a : new Date(a) < new Date(b) ? a : b)

/* ── Source loaders — each returns [{ source, id, email, name, at, data }] ── */

async function loadContacts(where) {
  const rows = await prisma.contactMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_PER_SOURCE,
    select: { id: true, name: true, email: true, subject: true, status: true, createdAt: true, message: true },
  })
  return rows.map((r) => ({
    source: "contact", id: r.id, email: normEmail(r.email), name: r.name, at: r.createdAt,
    data: { subject: r.subject, status: r.status, preview: String(r.message || "").slice(0, 160) },
  }))
}

async function loadDiagnostics(where) {
  const rows = await prisma.diagnosticSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_PER_SOURCE,
    select: { id: true, name: true, email: true, organization: true, audience: true, overallScore: true, tier: true, createdAt: true },
  })
  return rows.map((r) => ({
    source: "diagnostic", id: r.id, email: normEmail(r.email), name: r.name, at: r.createdAt,
    data: { tier: r.tier, score: r.overallScore, audience: r.audience, organization: r.organization },
  }))
}

async function loadNewsletter(where) {
  const rows = await prisma.newsletterSubscriber.findMany({
    where,
    orderBy: { subscribedAt: "desc" },
    take: MAX_PER_SOURCE,
    select: { id: true, name: true, email: true, status: true, source: true, subscribedAt: true, unsubscribedAt: true },
  })
  return rows.map((r) => ({
    source: "newsletter", id: r.id, email: normEmail(r.email), name: r.name,
    at: maxDate(r.subscribedAt, r.unsubscribedAt),
    data: { status: r.status, via: r.source, subscribedAt: r.subscribedAt, unsubscribedAt: r.unsubscribedAt },
  }))
}

async function loadBookings(where) {
  // Consultation has no email column — it hangs off User.
  const rows = await prisma.consultation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_PER_SOURCE,
    select: {
      id: true, scheduledAt: true, status: true, createdAt: true, durationMin: true,
      user: { select: { email: true, fullName: true } },
    },
  })
  return rows
    .filter((r) => r.user?.email)
    .map((r) => ({
      source: "booking", id: r.id, email: normEmail(r.user.email), name: r.user.fullName, at: r.createdAt,
      data: { scheduledAt: r.scheduledAt, status: r.status, durationMin: r.durationMin },
    }))
}

/**
 * Per-source `where` clauses. `q` narrows by email/name inside the DB so
 * the 500-row cap applies to matching rows, not to the whole table.
 * `email` (exact, lower-cased) is used by the timeline endpoint.
 */
function buildWheres({ q, email }) {
  if (email) {
    return {
      contact:    { email },
      diagnostic: { email },
      newsletter: { email },
      booking:    { user: { email } },
    }
  }
  if (!q) return { contact: {}, diagnostic: {}, newsletter: {}, booking: {} }
  const or = [{ email: { contains: q } }, { name: { contains: q } }]
  return {
    contact:    { OR: or },
    diagnostic: { OR: or },
    newsletter: { OR: or },
    booking:    { user: { OR: [{ email: { contains: q } }, { fullName: { contains: q } }] } },
  }
}

async function loadEvents({ q, email, sources = SOURCES }) {
  const w = buildWheres({ q, email })
  const loaders = {
    contact:    () => loadContacts(w.contact),
    diagnostic: () => loadDiagnostics(w.diagnostic),
    newsletter: () => loadNewsletter(w.newsletter),
    booking:    () => loadBookings(w.booking),
  }
  const lists = await Promise.all(sources.map((s) => loaders[s]()))
  return lists.flat()
}

/** Map<email, { id, fullName, createdAt, ordersPaid }> for the given emails. */
async function loadUsers(emails) {
  if (emails.length === 0) return new Map()
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, fullName: true, createdAt: true },
  })
  if (users.length === 0) return new Map()
  const paid = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, status: "paid" },
    _count: { _all: true },
  })
  const paidByUser = new Map(paid.map((p) => [p.userId, p._count._all]))
  return new Map(users.map((u) => [normEmail(u.email), {
    id: u.id, fullName: u.fullName, createdAt: u.createdAt, ordersPaid: paidByUser.get(u.id) || 0,
  }]))
}

/** Merge events into leads keyed by email. Pure — exported for tests. */
function mergeEvents(events) {
  const byEmail = new Map()
  for (const ev of events) {
    if (!ev.email) continue
    let lead = byEmail.get(ev.email)
    if (!lead) {
      lead = { email: ev.email, name: null, sources: [], firstSeenAt: null, lastActivityAt: null, user: null, latest: null }
      byEmail.set(ev.email, lead)
    }
    if (ev.name && !lead.name) lead.name = ev.name
    if (!lead.sources.includes(ev.source)) lead.sources.push(ev.source)
    lead.firstSeenAt = minDate(lead.firstSeenAt, ev.at)
    if (!lead.latest || new Date(ev.at) > new Date(lead.lastActivityAt)) {
      lead.lastActivityAt = ev.at
      lead.latest = { source: ev.source, id: ev.id, at: ev.at, ...ev.data }
    }
  }
  return [...byEmail.values()]
}

/**
 * listLeads({ q, source, page, limit })
 * → { data: Lead[], meta: { total, page, limit, pages, capPerSource } }
 */
async function listLeads({ q = "", source = "", page = 1, limit = 25 } = {}) {
  const cleanQ = String(q || "").trim().toLowerCase().slice(0, 120)
  const src = SOURCES.includes(source) ? source : null
  const pageN = Math.max(1, parseInt(page, 10) || 1)
  const limitN = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))

  // When filtering by source only that source is read; the other sources of
  // the visible page are re-hydrated below (bounded by `limit`).
  const events = await loadEvents({ q: cleanQ, sources: src ? [src] : SOURCES })
  const leads = mergeEvents(events)
  leads.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))

  const total = leads.length
  let pageLeads = leads.slice((pageN - 1) * limitN, pageN * limitN)
  const emails = pageLeads.map((l) => l.email)

  if (src && emails.length) {
    const others = SOURCES.filter((s) => s !== src)
    const extra = await Promise.all(emails.map((email) => loadEvents({ email, sources: others })))
    const merged = mergeEvents([...events.filter((e) => emails.includes(e.email)), ...extra.flat()])
    const byEmail = new Map(merged.map((l) => [l.email, l]))
    pageLeads = pageLeads.map((l) => byEmail.get(l.email) || l)
  }

  const users = await loadUsers(emails)
  for (const lead of pageLeads) {
    const u = users.get(lead.email)
    lead.user = u ? { id: u.id, ordersPaid: u.ordersPaid } : null
    if (u && !lead.name) lead.name = u.fullName
  }

  return {
    data: pageLeads,
    meta: { total, page: pageN, limit: limitN, pages: Math.max(1, Math.ceil(total / limitN)), capPerSource: MAX_PER_SOURCE },
  }
}

/**
 * getLeadTimeline(email) → { lead, timeline: Event[] } | null
 * Every event across the four sources for that address, newest first,
 * bounded by MAX_PER_SOURCE per source.
 */
async function getLeadTimeline(rawEmail) {
  const email = normEmail(rawEmail)
  if (!email) return null
  const events = await loadEvents({ email })
  const users = await loadUsers([email])
  const u = users.get(email)
  if (events.length === 0 && !u) return null

  const [lead] = mergeEvents(events)
  const base = lead || { email, name: null, sources: [], firstSeenAt: null, lastActivityAt: null, latest: null }
  base.user = u ? { id: u.id, ordersPaid: u.ordersPaid, fullName: u.fullName, createdAt: u.createdAt } : null
  if (u && !base.name) base.name = u.fullName

  const timeline = events
    .map((e) => ({ source: e.source, id: e.id, at: e.at, ...e.data }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))

  return { lead: base, timeline }
}

module.exports = { listLeads, getLeadTimeline, mergeEvents, SOURCES, MAX_PER_SOURCE }
