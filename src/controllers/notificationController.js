const prisma = require("../lib/prisma")
const asyncHandler = require("../utils/asyncHandler")

// Failures propagate to the global error handler; the previous version
// answered 200 "Marked as read" even when the update had been rejected.

// GET /api/member/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return res.status(200).json({ success: true, data: notifications })
})

// PATCH /api/member/notifications/:id/read
const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  })
  if (!count) return res.status(404).json({ success: false, message: "Notification not found" })
  return res.status(200).json({ success: true, message: "Marked as read" })
})

// PATCH /api/member/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return res.status(200).json({ success: true, message: "All marked as read", data: { count } })
})

module.exports = { getNotifications, markNotificationRead, markAllRead }
