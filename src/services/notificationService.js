const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/**
 * Create an in-app notification for a user.
 * Non-throwing — logs errors but never crashes the caller.
 */
async function notify(userId, { type, title, message, linkUrl }) {
  if (!userId) return null
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, linkUrl: linkUrl || null },
    })
  } catch (err) {
    logger.error("[notify]", err.message)
    return null
  }
}

// ── Auth ──

async function notifyWelcome(user) {
  return notify(user.id, {
    type: "system",
    title: "Welcome to the platform",
    message: `Hello ${user.fullName || "there"}! Your account is ready. Explore digital products, services, and your member dashboard.`,
    linkUrl: "/dashboard",
  })
}

async function notifyPasswordChanged(user) {
  return notify(user.id, {
    type: "system",
    title: "Password changed",
    message: "Your account password was updated successfully. If this wasn't you, contact support immediately.",
    linkUrl: "/dashboard/settings",
  })
}

// ── Orders ──

async function notifyOrderPlaced(order) {
  if (!order.userId) return null
  return notify(order.userId, {
    type: "order_placed",
    title: "Order received",
    message: `Your order ${order.orderNumber || ""} has been received and is pending payment confirmation.`,
    linkUrl: "/dashboard/orders",
  })
}

async function notifyOrderPaid(order) {
  if (!order.userId) return null
  return notify(order.userId, {
    type: "payment_success",
    title: "Payment confirmed",
    message: `Payment for order ${order.orderNumber || ""} is confirmed. Your products are ready to download.`,
    linkUrl: "/dashboard/downloads",
  })
}

async function notifyOrderFailed(order) {
  if (!order.userId) return null
  return notify(order.userId, {
    type: "payment_failed",
    title: "Payment failed",
    message: `Payment for order ${order.orderNumber || ""} could not be completed. Please try again or contact support.`,
    linkUrl: "/dashboard/orders",
  })
}

async function notifyOrderCancelled(order) {
  if (!order.userId) return null
  return notify(order.userId, {
    type: "order_placed",
    title: "Order cancelled",
    message: `Order ${order.orderNumber || ""} has been cancelled. Contact support if you believe this is incorrect.`,
    linkUrl: "/dashboard/orders",
  })
}

async function notifyOrderRefunded(order) {
  if (!order.userId) return null
  return notify(order.userId, {
    type: "refund_issued",
    title: "Order refunded",
    message: `A refund for order ${order.orderNumber || ""} has been initiated to your original payment method.`,
    linkUrl: "/dashboard/orders",
  })
}

// ── Downloads ──

async function notifyDownloadReady(userId, productTitle, orderNumber) {
  return notify(userId, {
    type: "download_ready",
    title: "Download ready",
    message: `"${productTitle}" is ready to download from your member dashboard.`,
    linkUrl: "/dashboard/downloads",
  })
}

// ── Support ──

async function notifySupportTicketCreated(userId, ticketNumber) {
  return notify(userId, {
    type: "support_reply",
    title: "Support ticket created",
    message: `Your support ticket #${ticketNumber} has been submitted. Our team will respond shortly.`,
    linkUrl: "/dashboard/support",
  })
}

async function notifySupportReply(userId, ticketNumber) {
  return notify(userId, {
    type: "support_reply",
    title: "Support reply received",
    message: `Our team replied to your ticket #${ticketNumber}. Check the full thread in your dashboard.`,
    linkUrl: "/dashboard/support",
  })
}

// ── Reviews ──

async function notifyReviewPosted(userId, productTitle) {
  return notify(userId, {
    type: "system",
    title: "Review submitted",
    message: `Your review for "${productTitle}" has been posted. Thank you for your feedback!`,
    linkUrl: "/dashboard/products",
  })
}

// ── Contact ──

async function notifyContactReceived(email) {
  // This is for admin notification — find admin users
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true },
      take: 5,
    })
    for (const admin of admins) {
      await notify(admin.id, {
        type: "system",
        title: "New contact message",
        message: `A new contact message was submitted from ${email}. Check the admin panel.`,
        linkUrl: "/admin/support",
      })
    }
  } catch (_) { /* ignore */ }
}

module.exports = {
  notify,
  notifyWelcome,
  notifyPasswordChanged,
  notifyOrderPlaced,
  notifyOrderPaid,
  notifyOrderFailed,
  notifyOrderCancelled,
  notifyOrderRefunded,
  notifyDownloadReady,
  notifySupportTicketCreated,
  notifySupportReply,
  notifyReviewPosted,
  notifyContactReceived,
}
