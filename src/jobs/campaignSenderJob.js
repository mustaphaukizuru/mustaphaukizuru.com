/**
 * src/jobs/campaignSenderJob.js
 *
 * Drains queued EmailCampaignRecipient rows for campaigns in status
 * "sending". Runs every minute (see scheduler.js); each pass sends up to
 * BATCH_SIZE recipients per campaign, marks them sent/failed, keeps the
 * campaign counters in sync and flips the campaign to "sent" (or "failed"
 * when nothing went out) once no queued rows remain.
 *
 * EmailCampaignRecipient has no attempts column, so a delivery error is
 * final for that recipient (single attempt).
 *
 * Claiming: the scheduler's overlap guard is per process, so a second app
 * instance (Passenger can briefly run two during a deploy) could send the
 * same batch twice. Each pass therefore CLAIMS its rows first with an
 * atomic updateMany that stamps `sentAt` while status is still "queued";
 * only rows the stamp actually landed on are sent. A claim older than
 * CLAIM_TTL_MS whose row is still "queued" belongs to a crashed pass and is
 * reclaimable.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const emailService = require("../services/emailService")
const campaignService = require("../services/adminCampaignService")

const BATCH_SIZE = 50
const CLAIM_TTL_MS = 15 * 60 * 1000

async function claimBatch(campaignId, now) {
  const stale = new Date(now.getTime() - CLAIM_TTL_MS)
  const candidates = await prisma.emailCampaignRecipient.findMany({
    where:   { campaignId, status: "queued", OR: [{ sentAt: null }, { sentAt: { lt: stale } }] },
    orderBy: { createdAt: "asc" },
    take:    BATCH_SIZE,
    select:  { id: true },
  })
  if (candidates.length === 0) return []
  const ids = candidates.map((c) => c.id)
  await prisma.emailCampaignRecipient.updateMany({
    where: { id: { in: ids }, status: "queued", OR: [{ sentAt: null }, { sentAt: { lt: stale } }] },
    data:  { sentAt: now },
  })
  // Only the rows our stamp landed on are ours.
  return prisma.emailCampaignRecipient.findMany({
    where:   { id: { in: ids }, status: "queued", sentAt: now },
    orderBy: { createdAt: "asc" },
  })
}

async function processCampaign(campaign, now = new Date()) {
  const queued = await claimBatch(campaign.id, now)

  if (queued.length === 0) {
    const inFlight = await prisma.emailCampaignRecipient.count({
      where: { campaignId: campaign.id, status: "queued" },
    })
    // Another pass still holds a fresh claim — let it finish before closing.
    if (inFlight > 0) return { sent: 0, failed: 0, completed: false }
    const [sentCount, failedCount] = await Promise.all([
      prisma.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "sent" } }),
      prisma.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "failed" } }),
    ])
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status:      sentCount === 0 && failedCount > 0 ? "failed" : "sent",
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    })
    logger.info(`[campaignSender] ${campaign.id} complete · sent=${sentCount} failed=${failedCount}`)
    return { sent: 0, failed: 0, completed: true }
  }

  // Tokens are looked up per batch so the unsubscribe link is real for
  // recipients who are on the newsletter list.
  const subs = await prisma.newsletterSubscriber.findMany({
    where:  { email: { in: queued.map((r) => r.email) } },
    select: { email: true, unsubscribeToken: true },
  })
  const tokenByEmail = new Map(subs.map((s) => [s.email.toLowerCase(), s.unsubscribeToken]))

  let sent = 0, failed = 0
  for (const recipient of queued) {
    const unsubscribeUrl = campaignService.unsubscribeUrlFor(
      tokenByEmail.get(recipient.email.toLowerCase()) || null,
    )
    const html = campaignService.renderCampaignHtml(campaign, { unsubscribeUrl })
    try {
      const result = await emailService.sendRawEmail({
        to:      recipient.email,
        from:    `${campaign.fromName} <${campaign.fromEmail}>`,
        replyTo: campaign.replyTo || campaign.fromEmail,
        subject: campaign.subject,
        html,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      })
      if (result?.ok === false) throw new Error(result.error || "Send failed")
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data:  { status: "sent", sentAt: new Date(), providerId: result?.messageId || null },
      })
      sent += 1
    } catch (err) {
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data:  { status: "failed", errorMessage: String(err?.message || err).slice(0, 600) },
      })
      failed += 1
    }
  }

  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data:  { sentCount: { increment: sent }, failedCount: { increment: failed } },
  })
  return { sent, failed, completed: false }
}

/**
 * One scheduler tick. Returns totals for logging/tests.
 */
async function runCampaignSenderPass() {
  const campaigns = await prisma.emailCampaign.findMany({
    where:   { status: "sending" },
    orderBy: { startedAt: "asc" },
  })
  if (campaigns.length === 0) return { campaigns: 0, sent: 0, failed: 0 }

  let sent = 0, failed = 0
  for (const campaign of campaigns) {
    try {
      const r = await processCampaign(campaign)
      sent += r.sent
      failed += r.failed
    } catch (err) {
      logger.error(`[campaignSender] campaign ${campaign.id} pass failed`, err)
    }
  }
  if (sent || failed) logger.info(`[campaignSender] pass · sent=${sent} failed=${failed}`)
  return { campaigns: campaigns.length, sent, failed }
}

module.exports = { runCampaignSenderPass, processCampaign, BATCH_SIZE }
