const prisma = require("../lib/prisma");

async function createContactMessage(payload) {
  return prisma.contactMessage.create({
    data: {
      name: payload.name,
      email: payload.email,
      subject: payload.subject || null,
      message: payload.message,
    },
  });
}

async function subscribeNewsletter(email) {
  // Handle re-subscribes: if previously unsubscribed, re-activate
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })

  if (existing) {
    if (existing.status === "unsubscribed") {
      return prisma.newsletterSubscriber.update({
        where: { email },
        data: { status: "subscribed", subscribedAt: new Date(), unsubscribedAt: null },
      })
    }
    // Already subscribed
    return existing
  }

  return prisma.newsletterSubscriber.create({
    data: { email, status: "subscribed" },
  })
}

async function unsubscribeNewsletter(email) {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })
  if (!existing) return null

  return prisma.newsletterSubscriber.update({
    where: { email },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  })
}


/**
 * List contact-form submissions with filters + pagination (admin only).
 * @param {object} opts
 * @param {string} [opts.status]  Filter by status: "new" | "read" | "replied"
 * @param {string} [opts.q]       Free-text search across name/email/subject/message
 * @param {number} [opts.page]    1-indexed page
 * @param {number} [opts.limit]   Page size (default 50, max 200)
 */
async function listContactMessages({ status, q, page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage  = Math.max(Number(page) || 1, 1);
  const skip      = (safePage - 1) * safeLimit;

  const where = {};
  if (status && ["new", "read", "replied"].includes(status)) where.status = status;
  if (q && String(q).trim()) {
    const term = String(q).trim();
    where.OR = [
      { name:    { contains: term } },
      { email:   { contains: term } },
      { subject: { contains: term } },
      { message: { contains: term } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: safeLimit,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

/**
 * Fetch a single contact message by id (admin only).
 * Returns null if not found.
 */
async function getContactMessageById(id) {
  if (!id) return null;
  return prisma.contactMessage.findUnique({ where: { id } });
}

/**
 * Update the status of a contact message (admin only).
 * Allowed statuses: "new" | "read" | "replied"
 * When transitioning to "replied", repliedAt is set to now.
 */
async function updateContactMessageStatus(id, status) {
  if (!id) return null;
  if (!["new", "read", "replied"].includes(status)) {
    const err = new Error("Invalid status. Must be one of: new, read, replied.");
    err.code = "VALIDATION_ERROR";
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.contactMessage.update({
    where: { id },
    data: {
      status,
      repliedAt: status === "replied" ? new Date() : existing.repliedAt,
    },
  });
}

/**
 * Hard-delete a contact message (admin only · GDPR cleanup).
 * Returns null if not found, otherwise the deleted row.
 */
async function deleteContactMessage(id) {
  if (!id) return null;
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.contactMessage.delete({ where: { id } });
  return existing;
}

/**
 * Aggregate counts per status — used by admin dashboard tile.
 */
async function getContactMessageStats() {
  const [total, byStatus] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.contactMessage.groupBy({
      by:    ["status"],
      _count: { _all: true },
    }),
  ]);
  const counts = { new: 0, read: 0, replied: 0 };
  for (const row of byStatus) counts[row.status] = row._count._all;
  return { total, ...counts };
}

module.exports = {
  createContactMessage,
  listContactMessages,
  getContactMessageById,
  updateContactMessageStatus,
  deleteContactMessage,
  getContactMessageStats,
  subscribeNewsletter,
  unsubscribeNewsletter,
};