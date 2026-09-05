/**
 * trackController.js · GET /api/v1/track/:code  (T5-2)
 *
 * Public and unauthenticated. What it may return is ADR 0006; this file only
 * translates a lookup into a response.
 *
 * Unknown, malformed and expired codes are all 404 with the same body, for
 * the reason in that record: a distinguishable answer confirms a code was
 * once real.
 */
const asyncHandler = require("../utils/asyncHandler")
const trackingService = require("../services/projectTrackingService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

const getByCode = asyncHandler(async (req, res) => {
  const locale = resolveUserLocale({ req })
  const project = await trackingService.findByTrackingCode(req.params.code, { locale })

  if (!project) {
    trackingService.noteMiss(req.ip)
    return res.status(404).json({
      success: false,
      code: "PROJECT_NOT_FOUND",
      message: "No project matches that code.",
    })
  }

  trackingService.noteHit(req.ip)
  // Never cached at the edge: a shared cache keyed on the URL would serve one
  // client's progress to the next person who tried the same code.
  res.setHeader("Cache-Control", "no-store")
  return res.json({ success: true, data: project })
})

/**
 * GET /api/v1/track/:code/digest-opt-out  (T5-15)
 *
 * The link at the foot of every weekly digest.
 *
 * No token, and that is a considered choice rather than an omission. The
 * link can only ever turn a digest OFF for a project the holder already has
 * the tracking code for — the worst a stranger who intercepted it can do is
 * stop an email they were not receiving. Minting and expiring a credential
 * for that would be more moving parts than the risk.
 *
 * A GET because mail clients follow links, not forms. Idempotent, so a
 * prefetching client that hits it twice changes nothing.
 */
const optOutOfDigest = asyncHandler(async (req, res) => {
  const project = await trackingService.setDigestOptOut(req.params.code, true)
  const base = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
  // Redirected to the tracking page either way: a code that means nothing
  // gets the same "no project matches that code" it always would, and an
  // unsubscribe that says "invalid token" to somebody who just wanted the
  // emails to stop is a bad way to end a relationship.
  return res.redirect(302, project ? `${base}/track/${project.trackingCode}?digest=off` : `${base}/track`)
})

module.exports = { getByCode, optOutOfDigest }
