const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")

const router = express.Router()
router.use(protect, adminOnly)

// GET /api/admin/audit — returns AdminAuditLog records
router.get("/", asyncHandler(async (req, res) => {
  // Errors propagate to the global error handler (503/400 + Sentry) instead
  // of being masked as an empty 200 — an unreadable audit log must be visible.
  const { page = 1, limit = 50 } = req.query
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
    include: {
      adminUser: { select: { id: true, fullName: true, email: true } },
    },
  })
  return res.status(200).json({ success: true, data: logs })
}))

module.exports = router
