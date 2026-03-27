const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const { getNotifications, markNotificationRead, markAllRead } = require("../controllers/notificationController")

const router = express.Router()

router.get("/",           protect, getNotifications)
router.patch("/read-all", protect, markAllRead)
router.patch("/:id/read", protect, markNotificationRead)

module.exports = router
