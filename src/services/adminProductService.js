// @ts-check
const fs = require("fs")
const path = require("path")
const prisma = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { PRODUCT_FILE_DIR } = require("../middleware/uploadProductFile")
const { PRODUCT_IMAGE_DIR } = require("../middleware/uploadProductImage")

/* ────────────────────────────────────────────────────────────────────────────
 * F04 · I + K — JSON-field sanitizers.
 *
 * Both `specifications` and `productFaqs` are MySQL Json? columns. The admin
 * frontend already filters empty rows before submit, but defense-in-depth:
 * we re-validate server-side. Returns:
 *   - clean array when the payload contains at least 1 valid row
 *   - null when the array is empty/missing/malformed (so the column stays NULL)
 * ──────────────────────────────────────────────────────────────────────────── */
/**
 * SEO + Spanish overlay columns.
 *
 * These exist on the model (and the OG injector / pickLocale read them) but
 * the admin create/update paths destructured neither, so a product's meta
 * tags and its whole Spanish version could only ever be set by writing to
 * the database by hand. Empty string means "no value" -> NULL, which is what
 * pickLocale treats as "fall back to English".
 */
const OVERLAY_FIELDS = [
  "metaTitle", "metaDescription",
  "titleEs", "shortDescriptionEs", "descriptionEs", "fullDescriptionEs",
  "metaTitleEs", "metaDescriptionEs",
]

function overlayData(payload, { partial = false } = {}) {
  const out = {}
  for (const key of OVERLAY_FIELDS) {
    const v = payload[key]
    // On update, an omitted field must keep its stored value.
    if (partial && v === undefined) continue
    out[key] = typeof v === "string" && v.trim() ? v.trim() : null
  }
  return out
}

function sanitizeSpecifications(value) {
  if (!Array.isArray(value)) return null
  const cleaned = value
    .filter(
      (s) =>
        s &&
        typeof s.key === "string" &&
        typeof s.value === "string" &&
        s.key.trim() &&
        s.value.trim()
    )
    .map((s) => ({ key: s.key.trim(), value: s.value.trim() }))
  return cleaned.length > 0 ? cleaned : null
}

function sanitizeProductFaqs(value) {
  if (!Array.isArray(value)) return null
  const cleaned = value
    .filter(
      (f) =>
        f &&
        typeof f.question === "string" &&
        typeof f.answer === "string" &&
        f.question.trim() &&
        f.answer.trim()
    )
    .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
  return cleaned.length > 0 ? cleaned : null
}

/**
 * Step 42 · admin list shows soft-deleted rows too, flagged `isDeleted`.
 * T1-4 · the list carried every image, feature and file row per product;
 * AdminProductsPage renders the scalar columns, the files list and counts.
 * Images and features are fetched by the editor for one product.
 */
async function getAdminProducts() {
  const rows = await prisma.product.findMany({
    include: {
      files: {
        orderBy: { isPrimary: "desc" },
        select: { id: true, fileName: true, fileSize: true, version: true, isPrimary: true, mimeType: true },
      },
      _count: { select: { images: true, features: true, files: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return rows.map((p) => ({ ...p, isDeleted: p.deletedAt != null, imageCount: p._count?.images ?? 0, featureCount: p._count?.features ?? 0 }))
}

/* ────────────────────────────────────────────────────────────────────────────
 * T3 · Tiered licences (personal | commercial | enterprise)
 * The admin form sends `licenses: [{ tier, name, price, currency?, seats?,
 * isActive?, sortOrder? }]`. Unknown tiers / bad prices are rejected up
 * front so a half-valid list never lands.
 * ──────────────────────────────────────────────────────────────────────────── */
const LICENSE_TIERS = ["personal", "commercial", "enterprise"]

function sanitizeLicenses(licenses) {
  if (!Array.isArray(licenses)) return undefined
  const seen = new Set()
  return licenses
    .filter((l) => l && typeof l === "object")
    .map((l, index) => {
      const tier = String(l.tier || "").trim().toLowerCase()
      if (!LICENSE_TIERS.includes(tier)) {
        throw new AppError(`Unknown license tier "${tier}". Use one of: ${LICENSE_TIERS.join(", ")}`, { statusCode: 400, code: "VALIDATION_ERROR" })
      }
      if (seen.has(tier)) {
        throw new AppError(`Duplicate license tier "${tier}"`, { statusCode: 400, code: "VALIDATION_ERROR" })
      }
      seen.add(tier)
      const price = Number(l.price)
      if (!Number.isFinite(price) || price < 0) {
        throw new AppError(`Invalid price for license tier "${tier}"`, { statusCode: 400, code: "VALIDATION_ERROR" })
      }
      const seats = l.seats === "" || l.seats == null ? null : Math.max(1, Math.floor(Number(l.seats) || 1))
      return {
        tier,
        name:      String(l.name || "").trim() || `${tier.charAt(0).toUpperCase()}${tier.slice(1)} license`,
        price,
        currency:  String(l.currency || "MXN").trim().toUpperCase().slice(0, 3) || "MXN",
        seats,
        isActive:  l.isActive === undefined ? true : Boolean(l.isActive),
        sortOrder: Number.isFinite(Number(l.sortOrder)) ? Number(l.sortOrder) : index,
      }
    })
}

async function createAdminProduct(payload) {
  const {
    title,
    slug,
    description,
    shortDescription,
    fullDescription,
    price,
    category,
    isActive,
    isFeatured,
    isNew,
    images = [],
    features = [],
    // F04 · I + K — admin form sends these JSON arrays
    specifications,
    productFaqs,
    licenses,
  } = payload

  const licenseRows = sanitizeLicenses(licenses)

  return prisma.product.create({
    data: {
      title,
      slug,
      description,
      shortDescription: shortDescription || null,
      fullDescription: fullDescription || null,
      price: Number(price),
      category,
      isActive: Boolean(isActive),
      isFeatured: Boolean(isFeatured),
      isNew: Boolean(isNew),
      ...overlayData(payload),
      // F04 · I + K — persist sanitized JSON, or NULL when empty
      specifications: sanitizeSpecifications(specifications),
      productFaqs: sanitizeProductFaqs(productFaqs),
      images: {
        create: images.map((image, index) => ({
          url: image.url,
          altText: image.altText || title,
          sortOrder: image.sortOrder ?? index,
        })),
      },
      features: {
        create: features
          .filter((f) => f && f.trim())
          .map((f, index) => ({
            featureText: f.trim(),
            sortOrder: index,
          })),
      },
      ...(licenseRows && licenseRows.length ? { licenses: { create: licenseRows } } : {}),
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
      features: {
        orderBy: { sortOrder: "asc" },
      },
      licenses: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })
}

async function updateAdminProduct(productId, payload) {
  const {
    title,
    slug,
    description,
    shortDescription,
    fullDescription,
    price,
    category,
    isActive,
    isFeatured,
    isNew,
    features,
    // F04 · I + K — admin form sends these JSON arrays
    specifications,
    productFaqs,
    licenses,
  } = payload

  const licenseRows = sanitizeLicenses(licenses)

  const data = {
    title,
    slug,
    description,
    shortDescription: shortDescription || null,
    fullDescription: fullDescription || null,
    price: Number(price),
    category,
    isActive: Boolean(isActive),
    isFeatured: Boolean(isFeatured),
    isNew: Boolean(isNew),
    ...overlayData(payload, { partial: true }),
  }

  // F04 · I + K — only touch JSON columns when payload actually included them.
  // `undefined` = field omitted from request → leave existing value alone.
  // Array (even empty) = explicit user intent → sanitize and persist (or NULL).
  if (specifications !== undefined) {
    data.specifications = sanitizeSpecifications(specifications)
  }
  if (productFaqs !== undefined) {
    data.productFaqs = sanitizeProductFaqs(productFaqs)
  }

  // Update features if provided
  if (Array.isArray(features)) {
    await prisma.productFeature.deleteMany({
      where: { productId },
    })

    if (features.filter((f) => f && f.trim()).length > 0) {
      await prisma.productFeature.createMany({
        data: features
          .filter((f) => f && f.trim())
          .map((f, index) => ({
            productId,
            featureText: f.trim(),
            sortOrder: index,
          })),
      })
    }
  }

  // T3 · licences: replace the full set when the payload includes one.
  // (`undefined` = field omitted → leave existing rows alone.)
  if (licenseRows) {
    await prisma.productLicense.deleteMany({ where: { productId } })
    if (licenseRows.length > 0) {
      await prisma.productLicense.createMany({
        data: licenseRows.map((l) => ({ ...l, productId })),
      })
    }
  }

  return prisma.product.update({
    where: { id: productId },
    data,
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: {
        orderBy: { isPrimary: "desc" },
      },
      features: {
        orderBy: { sortOrder: "asc" },
      },
      licenses: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Step 42 · soft delete.
 *   deleteAdminProduct(id)                 → sets deletedAt (row + files kept;
 *                                            orders / downloads still resolve)
 *   deleteAdminProduct(id, { hard: true }) → legacy destructive path
 *   restoreAdminProduct(id)                → clears deletedAt (isActive is left
 *                                            false so the admin re-publishes
 *                                            deliberately)
 * ──────────────────────────────────────────────────────────────────────────── */
async function deleteAdminProduct(productId, { hard = false } = {}) {
  if (!hard) {
    const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!existing) return null
    return prisma.product.update({
      where: { id: productId },
      data:  { deletedAt: new Date(), isActive: false, isFeatured: false },
    })
  }
  return hardDeleteAdminProduct(productId)
}

async function restoreAdminProduct(productId) {
  const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, deletedAt: true } })
  if (!existing) return null
  return prisma.product.update({
    where: { id: productId },
    data:  { deletedAt: null },
  })
}

async function hardDeleteAdminProduct(productId) {
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
      features: {
        orderBy: { sortOrder: "asc" },
      },
      licenses: {
        orderBy: { sortOrder: "asc" },
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
      fileSize: file.size ? Number(file.size) : null,
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
    select: { id: true },
  })

  // One transaction for the resequence instead of N awaited updates (T1-4).
  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((img, i) => prisma.productImage.update({ where: { id: img.id }, data: { sortOrder: i } })),
    )
  }

  return true
}

module.exports = {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  hardDeleteAdminProduct,
  restoreAdminProduct,
  getAdminProductById,
  addProductFile,
  removeProductFile,
  setPrimaryProductFile,
  addProductImage,
  removeProductImage,
}