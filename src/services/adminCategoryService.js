const prisma = require("../lib/prisma")

async function getAdminCategories() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      category: true,
      isActive: true,
    },
  })

  const bucket = new Map()

  for (const product of products) {
    const key = product.category || "Uncategorized"

    if (!bucket.has(key)) {
      bucket.set(key, {
        name: key,
        totalProducts: 0,
        activeProducts: 0,
      })
    }

    const item = bucket.get(key)
    item.totalProducts += 1
    if (product.isActive) item.activeProducts += 1
  }

  return Array.from(bucket.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

module.exports = {
  getAdminCategories,
}