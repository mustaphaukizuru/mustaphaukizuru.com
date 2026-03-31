const fs = require("fs")
const path = require("path")
const prisma = require("../lib/prisma")
const { PRODUCT_FILE_DIR } = require("../middleware/uploadProductFile")
const { PRODUCT_IMAGE_DIR } = require("../middleware/uploadProductImage")

async function getAdminProducts() {
  return prisma.product.findMany({
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

async function createAdminProduct(payload) {
  const {
    title,
    slug,
    description,
    price,
    category,
    isActive,
    isFeatured,
    isNew,
    images = [],
  } = payload

  return prisma.product.create({
    data: {
      title,
      slug,
      description,
      price: Number(price),
      category,
      isActive: Boolean(isActive),
      isFeatured: Boolean(isFeatured),
      isNew: Boolean(isNew),
      images: {
        create: images.map((image, index) => ({
          url: image.url,
          altText: image.altText || title,
          sortOrder: image.sortOrder ?? index,
        })),
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
    },
  })
}

async function updateAdminProduct(productId, payload) {
  const {
    title,
    slug,
    description,
    price,
    category,
    isActive,
    isFeatured,
    isNew,
    images = [],
  } = payload

  await prisma.productImage.deleteMany({
    where: { productId },
  })

  return prisma.product.update({
    where: { id: productId },
    data: {
      title,
      slug,
      description,
      price: Number(price),
      category,
      isActive: Boolean(isActive),
      isFeatured: Boolean(isFeatured),
      isNew: Boolean(isNew),
      images: {
        create: images.map((image, index) => ({
          url: image.url,
          altText: image.altText || title,
          sortOrder: image.sortOrder ?? index,
        })),
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
    },
  })
}

async function deleteAdminProduct(productId) {
  const files = await prisma.productFile.findMany({
    where: { productId },
  })

  for (const file of files) {
    const fullPath = path.resolve(PRODUCT_FILE_DIR, file.filePath)
    if (fullPath.startsWith(PRODUCT_FILE_DIR) && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  }

  const images = await prisma.productImage.findMany({
    where: { productId },
  })

  for (const image of images) {
    const fileName = path.basename(image.url)
    const fullPath = path.resolve(PRODUCT_IMAGE_DIR, fileName)
    if (fullPath.startsWith(PRODUCT_IMAGE_DIR) && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  }

  await prisma.productImage.deleteMany({
    where: { productId },
  })

  await prisma.productFile.deleteMany({
    where: { productId },
  })

  return prisma.product.delete({
    where: { id: productId },
  })
}

async function getAdminProductById(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
    },
  })
}

async function addProductFile(productId, file, options = {}) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })

  if (!existing) {
    throw new Error("Product not found")
  }

  const fileRecord = await prisma.productFile.create({
    data: {
      productId,
      fileName: options.fileName || file.originalname,
      filePath: file.filename,
      fileType: file.mimetype || null,
      fileSize: BigInt(file.size || 0),
      version: options.version || null,
      isPrimary: Boolean(options.isPrimary),
    },
  })

  if (options.isPrimary) {
    await prisma.productFile.updateMany({
      where: {
        productId,
        NOT: { id: fileRecord.id },
      },
      data: {
        isPrimary: false,
      },
    })
  }

  return fileRecord
}

async function removeProductFile(productId, fileId) {
  const file = await prisma.productFile.findFirst({
    where: {
      id: fileId,
      productId,
    },
  })

  if (!file) {
    throw new Error("Product file not found")
  }

  const fullPath = path.resolve(PRODUCT_FILE_DIR, file.filePath)

  await prisma.productFile.delete({
    where: { id: fileId },
  })

  if (fullPath.startsWith(PRODUCT_FILE_DIR) && fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }

  return true
}

async function setPrimaryProductFile(productId, fileId) {
  const file = await prisma.productFile.findFirst({
    where: {
      id: fileId,
      productId,
    },
  })

  if (!file) {
    throw new Error("Product file not found")
  }

  await prisma.productFile.updateMany({
    where: { productId },
    data: { isPrimary: false },
  })

  return prisma.productFile.update({
    where: { id: fileId },
    data: { isPrimary: true },
  })
}

async function addProductImage(productId, file, options = {}) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!product) {
    throw new Error("Product not found")
  }

  const nextSortOrder = product.images.length
  const publicUrl = `/images/products/${file.filename}`

  return prisma.productImage.create({
    data: {
      productId,
      url: publicUrl,
      altText: options.altText || product.title,
      sortOrder: nextSortOrder,
    },
  })
}

async function removeProductImage(productId, imageId) {
  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      productId,
    },
  })

  if (!image) {
    throw new Error("Product image not found")
  }

  const fileName = path.basename(image.url)
  const fullPath = path.resolve(PRODUCT_IMAGE_DIR, fileName)

  await prisma.productImage.delete({
    where: { id: imageId },
  })

  if (fullPath.startsWith(PRODUCT_IMAGE_DIR) && fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }

  const remaining = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  })

  for (let i = 0; i < remaining.length; i += 1) {
    await prisma.productImage.update({
      where: { id: remaining[i].id },
      data: { sortOrder: i },
    })
  }

  return true
}

module.exports = {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminProductById,
  addProductFile,
  removeProductFile,
  setPrimaryProductFile,
  addProductImage,
  removeProductImage,
}