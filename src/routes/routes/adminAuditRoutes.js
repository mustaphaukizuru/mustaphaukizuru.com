const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const prisma = require("../lib/prisma")

const router = express.Router()
router.use(protect, adminOnly)

// GET /api/admin/audit — returns AdminAuditLog records
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        adminUser: { select: { id: true, fullName: true, email: true } },
      },
    }).catch(() => [])

    return res.status(200).json({ success: true, data: logs })
  } catch (err) {
    return res.status(200).json({ success: true, data: [] })
  }
})

module.exports = router
