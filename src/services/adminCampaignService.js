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

async function resolveAudience(audience, recipientEmails) {
  if (audience === "newsletter") {
    const subs = await prisma.newsletterSubscriber.findMany({
      where: { status: "subscribed" },
      select: { email: true, id: true, unsubscribeToken: true },
    })
    return subs.map((s) => ({ email: s.email, userId: null, unsubscribeToken: s.unsubscribeToken }))
  }
  if (audience === "members") {
    const users = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true },
    })
    // Attach the subscriber token where one exists so the unsubscribe link
    // in the footer is real for members who are also on the newsletter.
    const subs = await prisma.newsletterSubscriber.findMany({
      where: { email: { in: users.map((u) => u.email) } },
      select: { email: true, unsubscribeToken: true },
    })
    const tokenByEmail = new Map(subs.map((s) => [s.email.toLowerCase(), s.unsubscribeToken]))
    return users.map((u) => ({
      email: u.email,
      userId: u.id,
      unsubscribeToken: tokenByEmail.get(u.email.toLowerCase()) || null,
    }))
  }
  if (audience === "custom") {
    const list = (Array.isArray(recipientEmails) ? recipientEmails : [])
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean)
    // Dedupe + keep insertion order
    return [...new Set(list)].map((email) => ({ email, userId: null }))
  }
  return []
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

  const audience = await resolveAudience(campaign.audience, campaign.recipientEmails)
  if (audience.length === 0) {
    throw Object.assign(new Error("Audience is empty — nothing to send."), { statusCode: 400 })
  }

  // Snapshot recipients (idempotent on re-run via @@unique([campaignId, email]))
  await prisma.$transaction([
    prisma.emailCampaign.update({
      where: { id },
      data:  {
        status: "sending",
        startedAt: new Date(),
        totalRecipients: audience.length,
        sentCount: 0,
        failedCount: 0,
      },
    }),
    prisma.emailCampaignRecipient.createMany({
      data: audience.map((a) => ({
        campaignId: id,
        email:      a.email,
        userId:     a.userId || null,
      })),
      skipDuplicates: true,
    }),
  ])

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
  const list = await resolveAudience(audience, recipientEmails)
  return list.length
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
}
