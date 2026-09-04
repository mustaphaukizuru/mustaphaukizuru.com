const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const asyncHandler = require("../utils/asyncHandler")
const { listAuditLogs } = require("../services/adminAuditService")

const router = express.Router()
router.use(protect, adminOnly)

// GET /api/admin/audit — AdminAuditLog records, newest first. Page and
// limit are clamped in the service (T1-4); errors propagate to the global
// handler so an unreadable audit log is visible, never an empty 200.
router.get("/", asyncHandler(async (req, res) => {
  const { logs, meta } = await listAuditLogs(req.query)
  return res.status(200).json({ success: true, data: logs, meta })
}))

module.exports = router
