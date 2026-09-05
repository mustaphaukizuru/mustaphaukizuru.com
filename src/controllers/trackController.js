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

module.exports = { getByCode }
