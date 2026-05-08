// =============================================================
// adminAnalyticsRoutes.js · admin analytics (M14)
// Mount at: router.use("/admin/analytics", authMiddleware, adminOnly, adminAnalyticsRoutes)
// =============================================================

const { Router } = require("express")
const ctrl = require("../controllers/analyticsController")

const router = Router()
router.get("/dashboard", ctrl.adminDashboard)
router.get("/events",    ctrl.adminEvents)
module.exports = router
