// @ts-check
/**
 * adminCampaignService.js · marketing email campaigns.
 *
 * Resolves audience to a recipient snapshot, renders the body through
 * BlogContentRenderer's email twin, wraps with the brand layout, then
 * snapshots one EmailCampaignRecipient row per recipient (status "queued").
 * Actual delivery happens in src/jobs/campaignSenderJob.js, which drains
 * the queue in batches so a large audience never blocks an admin request.
 */

const prisma = require("../lib/prisma")
const suppression = require("./suppressionService")
const layout = require("./emailLayoutService")
const { renderBlocks } = require("./emailContentRenderer")
const emailService = require("./emailService")
const newsletterService = require("./newsletterService")

function serializeCampaign(c) {
  return {
    id:              c.id,
    name:            c.name,
    subject:         c.subject,
    preheader:       c.preheader || "",
    fromName:        c.fromName,
    fromEmail:       c.fromEmail,
    replyTo:         c.replyTo || null,
    body:            c.body || [],
    status:          c.status,
    audience:        c.audience,
    recipientEmails: c.recipientEmails || [],
    scheduledAt:     c.scheduledAt?.toISOString?.() || null,
    startedAt:       c.startedAt?.toISOString?.()   || null,
    completedAt:     c.completedAt?.toISOString?.() || null,
    totalRecipients: c.totalRecipients || 0,
    sentCount:       c.sentCount || 0,
    failedCount:     c.failedCount || 0,
    openCount:       c.openCount  || 0,
    clickCount:      c.clickCount || 0,
    createdAt:       c.createdAt?.toISOString?.() || null,
    updatedAt:       c.updatedAt?.toISOString?.() || null,
  }
}

/* ── CRUD ─────────────────────────────────────────────────────────────── */

async function listCampaigns({ status, q, limit = 200 } = {}) {
  const where = {}
  if (status) where.status = status
  if (q) where.OR = [
    { name:    { contains: String(q).slice(0, 100) } },
    { subject: { contains: String(q).slice(0, 100) } },
  ]
  const rows = await prisma.emailCampaign.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(limit, 500),
  })
  return rows.map(serializeCampaign)
}

async function getCampaignById(id) {
  const row = await prisma.emailCampaign.findUnique({ where: { id } })
  return row ? serializeCampaign(row) : null
}

async function createCampaign(input, createdById = null) {
  const row = await prisma.emailCampaign.create({
    data: {
      name:            input.name,
      subject:         input.subject,
      preheader:       input.preheader || null,
      fromName:        input.fromName  || "Mustapha Ukizuru",
      fromEmail:       input.fromEmail || "hello@mustaphaukizuru.com",
      replyTo:         input.replyTo   || null,
      body:            input.body || [],
      status:          input.status     || "draft",
      audience:        input.audience   || "newsletter",
      recipientEmails: Array.isArray(input.recipientEmails) ? input.recipientEmails : [],
      scheduledAt:     input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdById,
    },
  })
  return serializeCampaign(row)
}

async function updateCampaign(id, input) {
  const data = {}
  for (const k of [
    "name", "subject", "preheader", "fromName", "fromEmail", "replyTo",
    "body", "status", "audience", "recipientEmails",
  ]) {
    if (input[k] !== undefined) data[k] = input[k]
  }
  if (input.scheduledAt !== undefined) {
    data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
  }
  const row = await prisma.emailCampaign.update({ where: { id }, data })
  return serializeCampaign(row)
}

async function deleteCampaign(id) {
  await prisma.emailCampaign.delete({ where: { id } })
  return { id }
}

/* ── Audience resolution ──────────────────────────────────────────────── */

/**
 * Audience access · A1 · paged, never materialised whole.
 *
 * resolveAudience() used to load EVERY subscriber (or every user) into an
 * array, then the caller built one createMany from it. Memory proportional to
 * the list, one giant INSERT, on a shared host. At a few thousand subscribers
 * that is fine; at fifty thousand the admin request that starts a campaign
 * would fall over — at exactly the moment the list is worth something.
 *
 * Two primitives replace it:
 *   countAudience(...)          — cheap COUNT queries, for the preview and
 *                                 the empty-audience check
 *   forEachAudiencePage(..., fn) — cursor-pages the audience in AUDIENCE_PAGE
 *                                 chunks and hands each page to fn; nothing
 *                                 larger than one page is ever in memory
 *
 * The cursor is the unique `id` with a stable id order, so a subscriber added
 * mid-run cannot shift the pages. The "custom" audience is an explicit list
 * from the form and is bounded by its input; it goes through as one page.
 */
const AUDIENCE_PAGE = 1000

function normaliseCustom(recipientEmails) {
  const list = (Array.isArray(recipientEmails) ? recipientEmails : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(list)].map((email) => ({ email, userId: null, unsubscribeToken: null }))
}

/**
 * T3-5 · the audience, minus anyone who has asked never to be mailed.
 *
 * Applied to the COUNT as well as the send, so the number the operator
 * approves is the number who will receive it. A count that includes
 * suppressed addresses is not a preview, it is a guess.
 *
 * The count is exact for `custom` (the list is in hand) and a subtraction
 * for the paged audiences: counting the intersection of 12,000 subscribers
 * against the suppression table would be a second full scan for a figure
 * that only has to be honest, not precise to the row. It can only ever
 * OVER-subtract — a suppressed address that was never on the list — so the
 * previewed number is never larger than the real one.
 */
async function countAudience(audience, recipientEmails) {
  if (audience === "custom") {
    const list = normaliseCustom(recipientEmails)
    const blocked = await suppression.suppressedSet(list.map((r) => r.email))
    return list.filter((r) => !blocked.has(r.email)).length
  }

  let total = 0
  if (audience === "newsletter") total = await prisma.newsletterSubscriber.count({ where: { status: "subscribed" } })
  else if (audience === "members") total = await prisma.user.count({ where: { email: { not: null } } })
  else return 0

  const suppressed = await suppression.suppressedCount()
  return Math.max(0, total - suppressed)
}

/** Drop suppressed addresses from one page before it reaches the caller. */
async function withoutSuppressed(page) {
  if (!page.length) return page
  const blocked = await suppression.suppressedSet(page.map((r) => r.email))
  return page.filter((r) => !blocked.has(suppression.normalise(r.email)))
}

async function forEachAudiencePage(audience, recipientEmails, fn) {
  if (audience === "custom") {
    const list = await withoutSuppressed(normaliseCustom(recipientEmails))
    if (list.length) await fn(list)
    return
  }
  if (audience !== "newsletter" && audience !== "members") return

  let cursor = null
  for (;;) {
    let page
    if (audience === "newsletter") {
      const subs = await prisma.newsletterSubscriber.findMany({
        where:   { status: "subscribed" },
        orderBy: { id: "asc" },
        take:    AUDIENCE_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select:  { id: true, email: true, unsubscribeToken: true },
      })
      page = subs.map((s) => ({ email: s.email, userId: null, unsubscribeToken: s.unsubscribeToken, _cursor: s.id }))
    } else {
      const users = await prisma.user.findMany({
        where:   { email: { not: null } },
        orderBy: { id: "asc" },
        take:    AUDIENCE_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select:  { id: true, email: true },
      })
      // Attach the subscriber token where one exists so the unsubscribe link
      // in the footer is real for members who are also on the newsletter.
      // Looked up per PAGE, so this query is bounded by the page too.
      const subs = users.length
        ? await prisma.newsletterSubscriber.findMany({
            where:  { email: { in: users.map((u) => u.email) } },
            select: { email: true, unsubscribeToken: true },
          })
        : []
      const tokenByEmail = new Map(subs.map((s) => [s.email.toLowerCase(), s.unsubscribeToken]))
      page = users.map((u) => ({
        email: u.email,
        userId: u.id,
        unsubscribeToken: tokenByEmail.get(u.email.toLowerCase()) || null,
        _cursor: u.id,
      }))
    }
    if (!page.length) return
    await fn(page.map(({ _cursor, ...r }) => r))
    if (page.length < AUDIENCE_PAGE) return
    cursor = page[page.length - 1]._cursor
  }
}

/* ── Render an HTML preview of the campaign (used for test send + UI) ─ */

function renderCampaignHtml(campaign, { unsubscribeUrl = null } = {}) {
  const bodyHtml = renderBlocks(campaign.body || [])
  return layout.wrap({
    preheader: campaign.preheader || "",
    eyebrow:   "Newsletter",
    bodyHtml,
    unsubscribeUrl,
  })
}

/* ── Test send to a single address ────────────────────────────────────── */

async function sendTestCampaign(id, toEmail) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) throw Object.assign(new Error("Campaign not found"), { statusCode: 404 })
  const html = renderCampaignHtml(campaign, { unsubscribeUrl: `${layout.SITE_URL}/unsubscribed?test=1` })
  const subject = `[TEST] ${campaign.subject || campaign.name}`
  const result = await emailService.sendRawEmail({
    to:      toEmail,
    from:    `${campaign.fromName} <${campaign.fromEmail}>`,
    replyTo: campaign.replyTo || campaign.fromEmail,
    subject,
    html,
  }).catch((err) => ({ error: err }))
  if (result?.error) throw result.error
  return { ok: true }
}

/* ── Real send · resolves audience, snapshots recipients, enqueues ───── */

async function sendCampaignNow(id) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) throw Object.assign(new Error("Campaign not found"), { statusCode: 404 })
  if (campaign.status === "sending" || campaign.status === "sent") {
    throw Object.assign(new Error("Campaign already sent or in progress."), { statusCode: 400 })
  }

  const expected = await countAudience(campaign.audience, campaign.recipientEmails)
  if (expected === 0) {
    throw Object.assign(new Error("Audience is empty — nothing to send."), { statusCode: 400 })
  }

  // Snapshot recipients in pages (idempotent on re-run via
  // @@unique([campaignId, email]) + skipDuplicates). Memory is bounded by
  // one page regardless of audience size.
  let queued = 0
  await forEachAudiencePage(campaign.audience, campaign.recipientEmails, async (page) => {
    const r = await prisma.emailCampaignRecipient.createMany({
      data: page.map((a) => ({ campaignId: id, email: a.email, userId: a.userId || null })),
      skipDuplicates: true,
    })
    queued += r?.count ?? page.length
  })

  // Status flips to "sending" LAST, on purpose. The sender job
  // (jobs/campaignSenderJob.js) treats "sending with zero queued rows" as
  // "complete" and marks the campaign sent. Flipping before the recipient
  // rows exist would let a sender tick in that gap declare a 0-recipient
  // campaign finished. With the rows already in place, the first tick has
  // work to do.
  await prisma.emailCampaign.update({
    where: { id },
    data:  {
      status: "sending",
      startedAt: new Date(),
      totalRecipients: queued,
      sentCount: 0,
      failedCount: 0,
    },
  })

  // Delivery is asynchronous: src/jobs/campaignSenderJob.js drains the
  // "queued" recipient rows in batches every minute and flips the campaign
  // to "sent" / "failed" once none remain. Returning here keeps the admin
  // request fast regardless of audience size.
  const updated = await prisma.emailCampaign.findUnique({ where: { id } })
  return serializeCampaign(updated)
}

/**
 * Per-recipient unsubscribe URL. Compliance · the link must actually
 * unsubscribe. Subscribers carry a per-row token (newsletterService);
 * recipients without a subscriber row fall back to the contact page rather
 * than a dead link.
 */
function unsubscribeUrlFor(unsubscribeToken) {
  return unsubscribeToken
    ? newsletterService.buildUnsubscribeUrl(unsubscribeToken)
    : `${layout.SITE_URL}/contact?subject=unsubscribe`
}

/* ── Audience preview · used by the form to show estimated count ──── */

async function getAudienceCount(audience, recipientEmails) {
  // COUNT queries — the preview used to materialise the whole list to read
  // its .length.
  return countAudience(audience, recipientEmails)
}

module.exports = {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendTestCampaign,
  sendCampaignNow,
  renderCampaignHtml,
  unsubscribeUrlFor,
  getAudienceCount,
  countAudience,
  forEachAudiencePage,
}
