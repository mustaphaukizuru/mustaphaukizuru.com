const prisma = require("../lib/prisma")

async function getAdminDownloads() {
  const downloads = await prisma.downloadLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  })

  const grouped = await prisma.downloadLog.groupBy({
    by: ["productId"],
    _count: { productId: true },
    orderBy: {
      _count: {
        productId: "desc",
      },
    },
    take: 10,
  })

  const productIds = grouped.map((g) => g.productId)

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          title: true,
        },
      })
    : []

  const topProducts = grouped.map((g) => ({
    productId: g.productId,
    title: products.find((p) => p.id === g.productId)?.title || "Unknown product",
    downloads: g._count.productId,
  }))

  return {
    downloads,
    topProducts,
    totalDownloads: await prisma.downloadLog.count(),
  }
}

module.exports = {
  getAdminDownloads,
}