// =============================================================
// analyticsController.js · M14 HTTP I/O
// =============================================================

const asyncHandler = require("../utils/asyncHandler")
const analyticsService = require("../services/analyticsService")

// ---- Public tracking ------------------------------------------

exports.trackPageView = asyncHandler(async (req, res) => {
  const { path, referrer, country } = req.body || {}
  await analyticsService.trackPageView(req, { path, referrer, country })
  // Always return 204 — never block the page render on analytics.
  res.status(204).end()
})

exports.trackEvent = asyncHandler(async (req, res) => {
  await analyticsService.trackEvent(req, req.body || {})
  res.status(204).end()
})

// ---- Admin reads ---------------------------------------------

exports.adminDashboard = asyncHandler(async (req, res) => {
  const daysBack = Math.min(365, Math.max(1, Number(req.query.days) || 30))

  const [kpis, topPaths, daily, devices, funnel] = await Promise.all([
    analyticsService.getDashboardKpis({ daysBack }),
    analyticsService.getTopPaths({ daysBack, limit: 10 }),
    analyticsService.getDailyTimeSeries({ daysBack }),
    analyticsService.getDeviceBreakdown({ daysBack }),
    analyticsService.getFunnel({ daysBack }),
  ])

  res.json({
    success: true,
    data: { kpis, topPaths, daily, devices, funnel, daysBack },
  })
})

exports.adminEvents = asyncHandler(async (req, res) => {
  const daysBack = Math.min(90, Math.max(1, Number(req.query.days) || 7))
  const limit    = Math.min(500, Math.max(1, Number(req.query.limit) || 100))
  const events   = await analyticsService.getRecentEvents({ daysBack, limit })
  res.json({ success: true, data: events })
})

/** T3-6 · GET /admin/analytics/vitals?days=30 */
exports.adminVitals = asyncHandler(async (req, res) => {
  const daysBack = Math.min(90, Math.max(1, Number(req.query.days) || 30))
  const rows = await analyticsService.getFieldVitals({ daysBack })
  res.json({ success: true, data: rows })
})

// Tier 4 · revenue reporting — see services/adminRevenueService.js
const adminRevenueService = require("../services/adminRevenueService")

exports.adminRevenue = asyncHandler(async (req, res) => {
  const months = Math.min(36, Math.max(1, Number(req.query.months) || 12))
  const data = await adminRevenueService.getRevenueReport({ months })
  res.json({ success: true, data })
})
