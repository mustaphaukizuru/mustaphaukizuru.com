// =============================================================
// adminAnalyticsRoutes.js · admin analytics (M14)
// Mount at: router.use("/admin/analytics", authMiddleware, adminOnly, adminAnalyticsRoutes)
// =============================================================

const { Router } = require("express")
const ctrl = require("../controllers/analyticsController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = Router()

// Security · mounted bare in routes/index.js — guard here.
router.use(protect, adminOnly)
router.get("/dashboard", ctrl.adminDashboard)
router.get("/events",    ctrl.adminEvents)
module.exports = router
