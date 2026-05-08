// @ts-check
/* ════════════════════════════════════════════════════════════════════════
   adminReviewService.js · admin moderation queue + reply + bulk actions
   ────────────────────────────────────────────────────────────────────────
   Controllers stay thin; this file owns the Prisma + ActivityLog logic.

   Every status change writes an ActivityLog entry so admins have a clear
   audit trail. The product aggregate (rating + reviewCount) is recomputed
   whenever a review's status crosses the "approved" boundary in either
   direction — a hidden review must not contribute to public stars.
   ════════════════════════════════════════════════════════════════════════ */

const prisma = require("../lib/prisma")
const { refreshProductAggregate } = require("./reviewService")
const { sendTemplateEmail } = require("./emailService")

const VALID_STATUSES = ["pending", "approved", "hidden", "flagged", "rejected"]
const VALID_BULK     = ["approve", "hide", "reject", "flag"]

const userSelect = { select: { id: true, fullName: true, email: true, avatarUrl: true } }

/* ─── helpers ──────────────────────────────────────────────────────────── */

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.code = code
  err.statusCode = statusCode
  return err
}

async function logActivity({ userId, action, entityId, description }) {
  return prisma.activityLog.create({
    data: { userId, action, entityType: "Review", entityId, description },
  }).catch((e) => {
    console.warn("[adminReviewService] activityLog failed:", e?.message)
    return null
  })
}

/**
 * Re-sync a Product's aggregate stars whenever any of its reviews changes
 * status across the approved boundary. Service aggregates aren't stored on
 * the Service model yet — left as a follow-up so we don't introduce a
 * partially-trusted column right now.
 */
async function refreshAggregateForReview(reviewId) {
  const r = await prisma.review.findUnique({
    where:  { id: reviewId },
    select: { productId: true },
  })
  if (r?.productId) await refreshProductAggregate(r.productId)
}

/* ─── reads ────────────────────────────────────────────────────────────── */

async function listReviews({ page = 1, limit = 20, status, minRating, productId, serviceId, q } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))

  const where = {}
  if (status && VALID_STATUSES.includes(status)) where.status = status
  if (minRating)  where.rating    = { gte: Number(minRating) }
  if (productId)  where.productId = String(productId)
  if (serviceId)  where.serviceId = String(serviceId)
  if (q && String(q).trim().length > 0) {
    const needle = String(q).trim()
    where.OR = [
      { reviewText: { contains: needle } },
      { user: { fullName: { contains: needle } } },
      { user: { email:    { contains: needle } } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: {
        user:         userSelect,
        adminReplyBy: userSelect,
        // Product images live on ProductImage[] — pull the first one for the admin
        // review row preview. Selecting from the join keeps the payload tight.
        product: {
          select: {
            id:     true,
            slug:   true,
            title:  true,
            images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        service:      { select: { id: true, slug: true, title: true } },
        orderItem:    { select: { id: true, orderId: true, titleSnapshot: true } },
      },
    }),
    prisma.review.count({ where }),
  ])

  return {
    items,
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getReviewForAdmin(id) {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      user:         userSelect,
      adminReplyBy: userSelect,
      // Product images live on ProductImage[] — pull the first one for the admin
        // review row preview. Selecting from the join keeps the payload tight.
        product: {
          select: {
            id:     true,
            slug:   true,
            title:  true,
            images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      service:      { select: { id: true, slug: true, title: true } },
      orderItem:    { select: { id: true, orderId: true, titleSnapshot: true, lineTotal: true } },
      _count:       { select: { votes: true } },
    },
  })
  return review || null
}

async function getStats() {
  const [pending, approved, hidden, flagged, rejected, total, agg] = await Promise.all([
    prisma.review.count({ where: { status: "pending"  } }),
    prisma.review.count({ where: { status: "approved" } }),
    prisma.review.count({ where: { status: "hidden"   } }),
    prisma.review.count({ where: { status: "flagged"  } }),
    prisma.review.count({ where: { status: "rejected" } }),
    prisma.review.count({}),
    prisma.review.aggregate({ where: { status: "approved" }, _avg: { rating: true } }),
  ])
  return {
    pending, approved, hidden, flagged, rejected, total,
    avgRating: Math.round(((agg._avg?.rating || 0) + Number.EPSILON) * 10) / 10,
  }
}

/* ─── writes ───────────────────────────────────────────────────────────── */

async function updateReview(id, data, adminUserId) {
  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) return null

  const update = {}
  if (data.status !== undefined) {
    if (!VALID_STATUSES.includes(data.status)) {
      throw buildError("VALIDATION_ERROR", `status must be one of ${VALID_STATUSES.join(", ")}`)
    }
    update.status = data.status
  }
  if (data.adminReply !== undefined) {
    const reply = data.adminReply ? String(data.adminReply).trim().slice(0, 2000) : null
    update.adminReply     = reply
    update.adminReplyAt   = reply ? new Date() : null
    update.adminReplyById = reply ? adminUserId : null
  }
  if (data.featured !== undefined) update.featured = Boolean(data.featured)
  if (data.featuredOrder !== undefined && Number.isInteger(data.featuredOrder)) {
    update.featuredOrder = data.featuredOrder
  }
  if (data.flaggedReason !== undefined) update.flaggedReason = data.flaggedReason || null

  const next = await prisma.review.update({
    where:   { id },
    data:    update,
    include: { user: userSelect, adminReplyBy: userSelect },
  })

  // Recompute aggregate if the approved-boundary moved
  const wasApproved = existing.status === "approved"
  const isApproved  = next.status === "approved"
  if (wasApproved !== isApproved) await refreshAggregateForReview(id)

  // Audit
  const changes = []
  if (existing.status !== next.status) changes.push(`status: ${existing.status} → ${next.status}`)
  if (existing.adminReply !== next.adminReply) {
    changes.push(next.adminReply ? "reply added/edited" : "reply removed")
  }
  if (existing.featured !== next.featured) changes.push(`featured: ${existing.featured} → ${next.featured}`)
  if (changes.length > 0) {
    await logActivity({
      userId:      adminUserId,
      action:      "review.update",
      entityId:    id,
      description: changes.join("; "),
    })
  }

  // ── Fire-and-forget email notifications on meaningful transitions ──
  // Three triggers, in priority order so a single PATCH only sends one mail:
  //   1. status: pending|flagged|hidden → approved   → review-approved
  //   2. status: pending|flagged|approved → rejected → review-rejected
  //   3. adminReply changed (added or edited)        → review-replied
  // We resolve the reviewer's email + subject title outside the await chain
  // so a slow SMTP doesn't block the API response.
  const statusFlippedToApproved = existing.status !== "approved" && next.status === "approved"
  const statusFlippedToRejected = existing.status !== "rejected" && next.status === "rejected"
  const replyChanged            = existing.adminReply !== next.adminReply && Boolean(next.adminReply)

  if (statusFlippedToApproved || statusFlippedToRejected || replyChanged) {
    notifyReviewer({
      reviewId:    id,
      kind: statusFlippedToApproved ? "approved"
          : statusFlippedToRejected ? "rejected"
          : "replied",
      adminReply:  next.adminReply,
    }).catch((err) => {
      console.warn("[adminReviewService] notifyReviewer failed:", err?.message)
    })
  }

  return next
}

/**
 * Resolve the reviewer + subject + send the matching email template.
 * Non-blocking — caller fires-and-forgets. We pull fresh data here so the
 * email always reflects the current row state even if updateReview's
 * include is partial.
 */
async function notifyReviewer({ reviewId, kind, adminReply }) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user:    { select: { id: true, fullName: true, email: true } },
      product: { select: { slug: true, title: true } },
      service: { select: { slug: true, title: true } },
    },
  })
  if (!review?.user?.email) return

  const subject = review.product || review.service
  const subjectTitle = subject?.title || (review.subjectType === "service" ? "your service" : "your purchase")
  const subjectUrl = (() => {
    const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || ""
    if (review.subjectType === "service" && subject?.slug) return `${base}/services/${subject.slug}`
    if (review.subjectType === "product" && subject?.slug) return `${base}/store/${subject.slug}`
    return base
  })()

  const templateKey =
    kind === "approved" ? "review.approved" :
    kind === "rejected" ? "review.rejected" :
                          "review.replied"

  const variables = {
    customerName: review.user.fullName || "there",
    subjectTitle,
    subjectUrl,
    rating:       String(review.rating),
    reviewText:   review.reviewText || "",
    adminReply:   adminReply || review.adminReply || "",
  }

  return sendTemplateEmail({
    to: review.user.email,
    templateKey,
    variables,
    userId: review.user.id,
  })
}

async function bulkAction(ids, action, adminUserId) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw buildError("VALIDATION_ERROR", "ids[] is required")
  }
  if (!VALID_BULK.includes(action)) {
    throw buildError("VALIDATION_ERROR", `action must be one of ${VALID_BULK.join(", ")}`)
  }

  const targetStatus =
    action === "approve" ? "approved" :
    action === "hide"    ? "hidden"   :
    action === "reject"  ? "rejected" :
                            "flagged"

  // Fetch first so we know which products need aggregate refresh.
  const before = await prisma.review.findMany({
    where:  { id: { in: ids } },
    select: { id: true, productId: true, status: true },
  })

  await prisma.review.updateMany({
    where: { id: { in: ids } },
    data:  { status: targetStatus },
  })

  // Aggregate refresh — collect distinct productIds whose rows crossed the
  // approved boundary, then refresh once per product.
  const flippedProductIds = new Set()
  for (const r of before) {
    if (!r.productId) continue
    const wasApproved = r.status === "approved"
    const isApproved  = targetStatus === "approved"
    if (wasApproved !== isApproved) flippedProductIds.add(r.productId)
  }
  for (const pid of flippedProductIds) {
    await refreshProductAggregate(pid)
  }

  await logActivity({
    userId:      adminUserId,
    action:      `review.bulk.${action}`,
    entityId:    ids[0],
    description: `Bulk ${action} on ${ids.length} review(s)`,
  })

  return { affected: before.length, action, status: targetStatus }
}

async function deleteReview(id, adminUserId) {
  const existing = await prisma.review.findUnique({
    where: { id }, select: { id: true, productId: true },
  })
  if (!existing) return null

  await prisma.review.delete({ where: { id } })
  if (existing.productId) await refreshProductAggregate(existing.productId)

  await logActivity({
    userId:      adminUserId,
    action:      "review.delete",
    entityId:    id,
    description: "Hard-deleted by admin",
  })

  return { id, deleted: true }
}

module.exports = {
  listReviews,
  getReviewForAdmin,
  getStats,
  updateReview,
  bulkAction,
  deleteReview,
}
