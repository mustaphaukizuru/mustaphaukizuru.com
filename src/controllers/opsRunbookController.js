// =============================================================
// opsRunbookController.js · Tier 4 ops runbook — GET /admin/diagnostic/ops
// =============================================================

const asyncHandler = require("../utils/asyncHandler")
const opsRunbookService = require("../services/opsRunbookService")

exports.getOps = asyncHandler(async (_req, res) => {
  const data = await opsRunbookService.getOpsReport()
  res.set("Cache-Control", "no-store")
  res.json({ success: true, data })
})
