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

// ── Projects (Phase 6 — auto-created from paid service orders) ──

/**
 * Fires when a ClientProject is auto-created from a paid ServiceOrder.
 * The link lands on the new project's detail page so the client can see
 * the milestone scaffold right away.
 */
async function notifyProjectCreated(userId, project) {
  if (!userId || !project?.id) return null
  return notify(userId, {
    type: "system",
    title: "Your project workspace is ready",
    message: `${project.projectName || "Your project"} is set up with a planning timeline. Track milestones and deliverables from your dashboard.`,
    linkUrl: `/dashboard/projects/${project.id}`,
  })
}

/**
 * In-app counterpart of the project.milestone-completed email — gives the
 * client a notification badge in addition to the email when admin marks a
 * milestone done.
 */
async function notifyProjectMilestoneCompleted(userId, { project, milestone }) {
  if (!userId || !project?.id || !milestone?.title) return null
  return notify(userId, {
    type: "system",
    title: `${milestone.title} · completed`,
    message: `Milestone "${milestone.title}" on ${project.projectName || "your project"} is marked complete.`,
    linkUrl: `/dashboard/projects/${project.id}`,
  })
}

/**
 * Admin moved a milestone to awaiting_client — the client has something
 * to approve. In-app; the email counterpart is project.approval-requested.
 */
async function notifyMilestoneAwaitingClient(userId, { project, milestone }) {
  if (!userId || !project?.id || !milestone?.title) return null
  return notify(userId, {
    type: "system",
    title: `Your review is needed · ${milestone.title}`,
    message: `"${milestone.title}" on ${project.projectName || "your project"} is ready for your approval. Approve it or request changes from the project page.`,
    linkUrl: `/dashboard/projects/${project.id}`,
  })
}

/** Admin replied in a project thread — tell the client. */
async function notifyProjectComment(userId, { project, comment }) {
  if (!userId || !project?.id) return null
  return notify(userId, {
    type: "system",
    title: `New reply on ${project.projectName || "your project"}`,
    message: String(comment?.body || "").slice(0, 160),
    linkUrl: `/dashboard/projects/${project.id}`,
  })
}

/**
 * Tier 2 · admin-directed project activity (client upload / comment /
 * approval / changes requested). Fans out to the assigned admin first, then
 * every admin (capped) so nothing a client does goes unseen. Every other
 * notifier in this file targets the client; this is the only one aimed at
 * the operator besides notifyContactReceived.
 */
const ADMIN_ACTIVITY_TITLES = {
  upload:   "Client uploaded files",
  comment:  "Client left a comment",
  approval: "Client approved a milestone",
  changes:  "Client requested changes",
  ticket:   "Client opened a project ticket",
}
async function notifyAdminsProjectActivity({ project, kind, summary }) {
  if (!project?.id) return []
  try {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true }, take: 10 })
    const ids = new Set(admins.map((a) => a.id))
    if (project.assignedAdminId) ids.add(project.assignedAdminId)
    const out = []
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await notify(id, {
        type: "system",
        title: `${ADMIN_ACTIVITY_TITLES[kind] || "Project activity"} · ${project.projectName || project.id}`,
        message: String(summary || "").slice(0, 300),
        linkUrl: `/admin/client-projects/${project.id}`,
      }))
    }
    return out
  } catch (err) {
    logger.error("[notifyAdminsProjectActivity]", err.message)
    return []
  }
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
  notifyMilestoneAwaitingClient,
  notifyProjectComment,
  notifyAdminsProjectActivity,
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
  notifyProjectCreated,
  notifyProjectMilestoneCompleted,
}
