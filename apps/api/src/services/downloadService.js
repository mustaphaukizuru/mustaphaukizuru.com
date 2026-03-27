const prisma = require("../lib/prisma")

async function getDownloadForUser(userId, productId) {

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId: productId,
      order: {
        userId: userId,
        status: "paid"
      }
    },
    include: {
      product: true
    }
  })

  if (!orderItem) {
    throw new Error("You have not purchased this product")
  }

  if (!orderItem.product.downloadUrl) {
    throw new Error("Download not available")
  }

  return {
    url: orderItem.product.downloadUrl,
    fileName: orderItem.product.fileName || orderItem.product.title
  }
}

module.exports = {
  getDownloadForUser
}