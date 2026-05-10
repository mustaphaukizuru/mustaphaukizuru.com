/**
 * adminCampaignController.js · /api/v1/admin/campaigns
 *
 * Phase 9.2d · refactored to asyncHandler. Verbose try/catch+next removed;
 * errors flow to the central errorHandler middleware unchanged.
 */

const campaigns    = require("../services/adminCampaignService")
const asyncHandler = require("../utils/asyncHandler")

function badRequest(res, msg) { return res.status(400).json({ error: msg }) }

const list = asyncHandler(async (req, res) => {
  const { status, q, limit } = req.query
  res.json({
    campaigns: await campaigns.listCampaigns({
      status, q,
      limit: Number.parseInt(limit || "200", 10),
    }),
  })
})

const get = asyncHandler(async (req, res) => {
  const campaign = await campaigns.getCampaignById(req.params.id)
  if (!campaign) return res.status(404).json({ error: "Campaign not found" })
  res.json({ campaign })
})

const create = asyncHandler(async (req, res) => {
  const body = req.body || {}
  if (!body.name)    return badRequest(res, "name is required")
  if (!body.subject) return badRequest(res, "subject is required")
  if (body.body && !Array.isArray(body.body)) return badRequest(res, "body must be an array of content blocks")
  const campaign = await campaigns.createCampaign(body, req.user?.id || null)
  res.status(201).json({ campaign })
})

const update = asyncHandler(async (req, res) => {
  const campaign = await campaigns.updateCampaign(req.params.id, req.body || {})
  res.json({ campaign })
})

const remove = asyncHandler(async (req, res) => {
  await campaigns.deleteCampaign(req.params.id)
  res.status(204).end()
})

const audienceCount = asyncHandler(async (req, res) => {
  const { audience, recipientEmails } = req.body || {}
  const count = await campaigns.getAudienceCount(audience, recipientEmails)
  res.json({ count })
})

const preview = asyncHandler(async (req, res) => {
  const campaign = await campaigns.getCampaignById(req.params.id)
  if (!campaign) return res.status(404).json({ error: "Campaign not found" })
  const html = campaigns.renderCampaignHtml(campaign, {
    unsubscribeUrl: `${process.env.PUBLIC_SITE_URL || "https://mustaphaukizuru.com"}/unsubscribed?preview=1`,
  })
  res.json({ html })
})

const testSend = asyncHandler(async (req, res) => {
  const { to } = req.body || {}
  if (!to) return badRequest(res, "to is required")
  await campaigns.sendTestCampaign(req.params.id, to)
  res.json({ ok: true })
})

const sendNow = asyncHandler(async (req, res) => {
  const updated = await campaigns.sendCampaignNow(req.params.id)
  res.json({ campaign: updated })
})

module.exports = {
  list, get, create, update, remove,
  audienceCount, preview, testSend, sendNow,
}
