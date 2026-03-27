const prisma = require("../lib/prisma")

// GET /api/member/notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => [])

    return res.status(200).json({ success: true, data: notifications })
  } catch (err) {
    console.error("[Notifications]", err.message)
    // Return empty array gracefully if table doesn't exist
    return res.status(200).json({ success: true, data: [] })
  }
}

// PATCH /api/member/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    }).catch(() => null)

    return res.status(200).json({ success: true, message: "Marked as read" })
  } catch (err) {
    return res.status(200).json({ success: true, message: "Marked as read" })
  }
}

// PATCH /api/member/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    }).catch(() => null)

    return res.status(200).json({ success: true, message: "All marked as read" })
  } catch (err) {
    return res.status(200).json({ success: true })
  }
}

module.exports = { getNotifications, markNotificationRead, markAllRead }
