// @ts-check
const prisma = require("../lib/prisma")

// ─────────────────────────────────────────────────────────────────────────────
// Safe number helper
// ─────────────────────────────────────────────────────────────────────────────
function safeNum(val, fallback = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

async function getAdminDashboardStats() {
  const [
    totalUsers,
    totalProducts,
    activeProducts,
    totalOrders,
    paidOrders,
    pendingOrders,
    failedOrders,
    refundedOrders,
    totalDownloads,
    recentOrders,
    topProductsRaw,
    payingCustomers,
    revenueAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "paid" } }),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: "failed" } }),
    prisma.order.count({ where: { status: "refunded" } }),
    // DownloadLog.count() may fail if table doesn't exist yet
    prisma.downloadLog.count().catch(() => 0),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    }),
    // Group order items by product to find top sellers
    prisma.orderItem.groupBy({
      by: ["productId"],
      // Service line items carry a null productId. Without this they group into a
      // null bucket that can occupy one of the five slots and is then dropped,
      // silently leaving only four products on the panel.
      where: { productId: { not: null } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }).catch(() => []),
    // Active customers = distinct people who have actually paid. Grouped on
    // customerEmail, not userId: userId is nullable (guest checkout), so
    // counting it drops every guest who paid. The page used to derive this
    // from the 8 rows in recentOrders — which never carried userId anyway, so
    // it always rendered 0.
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: { status: "paid" },
    }).catch(() => []),
    prisma.order.aggregate({
      where: { status: "paid" },
      _sum: { totalAmount: true },
    }),
  ])

  // ── Resolve product names for top products ─────────────────────────────────
  // Filter to valid non-null productIds to avoid Prisma `in` error
  const validProductIds = topProductsRaw
    .map((item) => item.productId)
    .filter((id) => id != null && typeof id === "string" && id.length > 0)

  const [productLookup, downloadCounts] = await Promise.all([
    validProductIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: validProductIds } },
          select: { id: true, title: true },
        })
      : [],
    validProductIds.length > 0
      ? prisma.downloadLog.groupBy({
          by: ["productId"],
          where: { productId: { in: validProductIds } },
          _count: { productId: true },
        }).catch(() => [])
      : [],
  ])

  const topProducts = topProductsRaw
    .filter((item) => item.productId != null)
    .map((item) => {
      const product  = productLookup.find((p) => p.id === item.productId)
      const dlEntry  = downloadCounts.find((d) => d.productId === item.productId)
      return {
        productId: item.productId,
        name:      product?.title || "Unknown product",
        sales:     safeNum(item._sum?.quantity),
        revenue:   safeNum(item._sum?.lineTotal),
        downloads: safeNum(dlEntry?._count?.productId),
      }
    })

  return {
    stats: {
      totalUsers:    safeNum(totalUsers),
      totalProducts: safeNum(totalProducts),
      activeProducts:safeNum(activeProducts),
      totalOrders:   safeNum(totalOrders),
      paidOrders:    safeNum(paidOrders),
      pendingOrders: safeNum(pendingOrders),
      failedOrders:  safeNum(failedOrders),
      refundedOrders:safeNum(refundedOrders),
      totalDownloads:safeNum(totalDownloads),
      activeCustomers:safeNum(payingCustomers?.length),
      revenue:       safeNum(revenueAgg?._sum?.totalAmount),
    },
    recentOrders: recentOrders.map((o) => ({
      id:            o.id,
      orderNumber:   o.orderNumber,
      customerName:  o.customerName  || "Member",
      customerEmail: o.customerEmail || "",
      totalAmount:   safeNum(o.totalAmount),
      status:        o.status,
      createdAt:     o.createdAt,
    })),
    topProducts,
  }
}

module.exports = { getAdminDashboardStats }
