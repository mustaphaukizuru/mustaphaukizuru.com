// @ts-check
const prisma = require("../lib/prisma")

async function getAdminPayments({ page = 1, limit = 30 } = {}) {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    skip: (Number(page)-1)*Number(limit),
    take: Number(limit),
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
        },
      },
    },
  })

  const [total, pending, paid, failed] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({ where: { paymentStatus: "pending" } }),
    prisma.payment.count({ where: { paymentStatus: "paid" } }),
    prisma.payment.count({ where: { paymentStatus: "failed" } }),
  ])

  return {
    payments,
    meta:    { total, page: Number(page), limit: Number(limit) },
    metrics: { total, pending, paid, failed },
  }
}

module.exports = {
  getAdminPayments,
}