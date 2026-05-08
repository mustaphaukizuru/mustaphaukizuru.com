/**
 * adminCampaignController.js · /api/v1/admin/campaigns
 */

const campaigns = require("../services/adminCampaignService")

function badRequest(res, msg) { return res.status(400).json({ error: msg }) }

async function list(req, res, next) {
  try {
    const { status, q, limit } = req.query
    res.json({
      campaigns: await campaigns.listCampaigns({
        status, q,
        limit: Number.parseInt(limit || "200", 10),
      }),
    })
  } catch (err) { next(err) }
}

async function get(req, res, next) {
  try {
    const campaign = await campaigns.getCampaignById(req.params.id)
    if (!campaign) return res.status(404).json({ error: "Campaign not found" })
    res.json({ campaign })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const body = req.body || {}
    if (!body.name)    return badRequest(res, "name is required")
    if (!body.subject) return badRequest(res, "subject is required")
    if (body.body && !Array.isArray(body.body)) return badRequest(res, "body must be an array of content blocks")
    const campaign = await campaigns.createCampaign(body, req.user?.id || null)
    res.status(201).json({ campaign })
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  try {
    const campaign = await campaigns.updateCampaign(req.params.id, req.body || {})
    res.json({ campaign })
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    await campaigns.deleteCampaign(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

async function audienceCount(req, res, next) {
  try {
    const { audience, recipientEmails } = req.body || {}
    const count = await campaigns.getAudienceCount(audience, recipientEmails)
    res.json({ count })
  } catch (err) { next(err) }
}

async function preview(req, res, next) {
  try {
    const campaign = await campaigns.getCampaignById(req.params.id)
    if (!campaign) return res.status(404).json({ error: "Campaign not found" })
    const html = campaigns.renderCampaignHtml(campaign, {
      unsubscribeUrl: `${process.env.PUBLIC_SITE_URL || "https://mustaphaukizuru.com"}/unsubscribed?preview=1`,
    })
    res.json({ html })
  } catch (err) { next(err) }
}

async function testSend(req, res, next) {
  try {
    const { to } = req.body || {}
    if (!to) return badRequest(res, "to is required")
    await campaigns.sendTestCampaign(req.params.id, to)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

async function sendNow(req, res, next) {
  try {
    const updated = await campaigns.sendCampaignNow(req.params.id)
    res.json({ campaign: updated })
  } catch (err) { next(err) }
}

module.exports = {
  list, get, create, update, remove,
  audienceCount, preview, testSend, sendNow,
}
