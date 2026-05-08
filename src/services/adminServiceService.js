// @ts-check
const prisma = require("../lib/prisma")
const { serializeService } = require("./serviceService")

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function uniqueSlug(baseSlug) {
  let slug = baseSlug
  let n = 1
  while (await prisma.service.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1
    slug = `${baseSlug}-${n}`
    if (n > 50) throw new Error("Could not allocate unique slug")
  }
  return slug
}

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}

/* ────────────────────────────────────────────────────────────────────────────
 * Service CRUD
 * ──────────────────────────────────────────────────────────────────────────── */

async function listAllServices({ page = 1, limit = 50, includeArchived = false } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50))

  const where = includeArchived ? {} : { status: { not: "archived" } }

  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: {
        _count:   { select: { packages: true, features: true, serviceOrders: true } },
      },
    }),
    prisma.service.count({ where }),
  ])

  return {
    items: items.map((s) => ({
      ...serializeService(s),
      packageCount:  s._count.packages,
      featureCount:  s._count.features,
      orderCount:    s._count.serviceOrders,
    })),
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getServiceForAdmin(id) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: {
        orderBy: { sortOrder: "asc" },
        include: { featureSlots: { select: { id: true, featureId: true } } },
      },
      _count:   { select: { serviceOrders: true } },
    },
  })
  if (!service) return null
  return {
    ...serializeService(service),
    orderCount: service._count.serviceOrders,
  }
}

async function createService(data, createdById) {
  if (!data.title) throw buildError("VALIDATION_ERROR", "title is required", 400)
  if (!data.shortDescription) throw buildError("VALIDATION_ERROR", "shortDescription is required", 400)
  if (!data.deliveryType) throw buildError("VALIDATION_ERROR", "deliveryType is required", 400)

  const slug = await uniqueSlug(data.slug || slugify(data.title))

  const service = await prisma.service.create({
    data: {
      title:            data.title,
      slug,
      shortDescription: data.shortDescription,
      fullDescription:  data.fullDescription || null,
      basePrice:        data.basePrice != null ? Number(data.basePrice) : 0,
      currency:         (data.currency || "MXN").toUpperCase(),
      deliveryType:     data.deliveryType,
      status:           data.status || "draft",
      isFeatured:       Boolean(data.isFeatured),
      metaTitle:        data.metaTitle || null,
      metaDescription:  data.metaDescription || null,
      createdById:      createdById || null,
      audienceCode:     data.audienceCode || null,

      // I18N06 · Spanish bilingual fields. The schema mirrors English columns
      // with `*Es` suffixes, except the long-form which is `descriptionEs`
      // (not `fullDescriptionEs`) — kept asymmetric on purpose to mirror the
      // common Spanish CMS pattern. Empty strings normalised to NULL so
      // pickLocale's English fallback fires correctly when admins haven't
      // translated a row yet.
      titleEs:            data.titleEs            || null,
      shortDescriptionEs: data.shortDescriptionEs || null,
      descriptionEs:      data.descriptionEs      || null,
      metaTitleEs:        data.metaTitleEs        || null,
      metaDescriptionEs:  data.metaDescriptionEs  || null,
    },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: { orderBy: { sortOrder: "asc" } },
    },
  })
  return serializeService(service)
}

async function updateService(id, data) {
  const existing = await prisma.service.findUnique({ where: { id } })
  if (!existing) return null

  // Re-check slug uniqueness if it's changing
  let nextSlug = existing.slug
  if (data.slug && data.slug !== existing.slug) {
    nextSlug = await uniqueSlug(slugify(data.slug))
  } else if (data.title && !data.slug && existing.slug === slugify(existing.title)) {
    // Regenerate slug from title if it was auto-generated and title changed.
    // Skip if admin has customized the slug (existing.slug !== slugify(existing.title)).
    nextSlug = await uniqueSlug(slugify(data.title))
  }

  const updateData = {}
  if (data.title            !== undefined) updateData.title            = data.title
  if (nextSlug !== existing.slug)          updateData.slug             = nextSlug
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription
  if (data.fullDescription  !== undefined) updateData.fullDescription  = data.fullDescription || null
  if (data.basePrice        !== undefined) updateData.basePrice        = Number(data.basePrice)
  if (data.currency         !== undefined) updateData.currency         = String(data.currency).toUpperCase()
  if (data.deliveryType     !== undefined) updateData.deliveryType     = data.deliveryType
  if (data.status           !== undefined) updateData.status           = data.status
  if (data.isFeatured       !== undefined) updateData.isFeatured       = Boolean(data.isFeatured)
  if (data.metaTitle        !== undefined) updateData.metaTitle        = data.metaTitle || null
  if (data.metaDescription  !== undefined) updateData.metaDescription  = data.metaDescription || null
  if (data.audienceCode     !== undefined) updateData.audienceCode     = data.audienceCode || null

  // I18N06 · Spanish passthrough on update. Only set a column when the
  // caller explicitly sends the key — preserves EN-only services from
  // accidentally being wiped to NULL on partial updates.
  if (data.titleEs            !== undefined) updateData.titleEs            = data.titleEs            || null
  if (data.shortDescriptionEs !== undefined) updateData.shortDescriptionEs = data.shortDescriptionEs || null
  if (data.descriptionEs      !== undefined) updateData.descriptionEs      = data.descriptionEs      || null
  if (data.metaTitleEs        !== undefined) updateData.metaTitleEs        = data.metaTitleEs        || null
  if (data.metaDescriptionEs  !== undefined) updateData.metaDescriptionEs  = data.metaDescriptionEs  || null

  const service = await prisma.service.update({
    where: { id },
    data:  updateData,
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: { orderBy: { sortOrder: "asc" } },
    },
  })
  return serializeService(service)
}

async function softDeleteService(id) {
  const existing = await prisma.service.findUnique({ where: { id } })
  if (!existing) return null
  const service = await prisma.service.update({
    where: { id },
    data:  { status: "archived", isFeatured: false },
  })
  return serializeService(service)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Package subroutes
 * ──────────────────────────────────────────────────────────────────────────── */

async function addPackage(serviceId, data) {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, currency: true } })
  if (!service) throw buildError("NOT_FOUND", "Service not found", 404)

  if (!data.name)      throw buildError("VALIDATION_ERROR", "name is required", 400)
  if (data.price == null) throw buildError("VALIDATION_ERROR", "price is required", 400)
  const price = Number(data.price)
  if (!Number.isFinite(price) || price < 0) throw buildError("VALIDATION_ERROR", "price must be a non-negative number", 400)

  const pkg = await prisma.servicePackage.create({
    data: {
      serviceId,
      name:        data.name,
      description: data.description || null,
      price,
      currency:    (data.currency || service.currency || "MXN").toUpperCase(),
      isActive:    data.isActive !== false,
      sortOrder:   data.sortOrder != null ? Number(data.sortOrder) : 0,
      tierKey:     data.tierKey   || null,
      period:      data.period    || null,
      popular:     Boolean(data.popular),
      saveLabel:   data.saveLabel || null,

      // I18N06 · Spanish package metadata.
      nameEs:        data.nameEs        || null,
      descriptionEs: data.descriptionEs || null,
    },
  })

  // Optional: replace inclusion set if featureIds was provided
  if (Array.isArray(data.featureIds)) {
    await syncPackageFeatureSlots(pkg.id, serviceId, data.featureIds)
  }
  return pkg
}

async function updatePackage(serviceId, packageId, data) {
  const existing = await prisma.servicePackage.findFirst({
    where: { id: packageId, serviceId },
  })
  if (!existing) return null

  const updateData = {}
  if (data.name        !== undefined) updateData.name        = data.name
  if (data.description !== undefined) updateData.description = data.description || null
  if (data.price       !== undefined) updateData.price       = Number(data.price)
  if (data.currency    !== undefined) updateData.currency    = String(data.currency).toUpperCase()
  if (data.isActive    !== undefined) updateData.isActive    = Boolean(data.isActive)
  if (data.sortOrder   !== undefined) updateData.sortOrder   = Number(data.sortOrder)
  if (data.tierKey     !== undefined) updateData.tierKey     = data.tierKey   || null
  if (data.period      !== undefined) updateData.period      = data.period    || null
  if (data.popular     !== undefined) updateData.popular     = Boolean(data.popular)
  if (data.saveLabel   !== undefined) updateData.saveLabel   = data.saveLabel || null

  // I18N06 · Spanish package passthrough.
  if (data.nameEs        !== undefined) updateData.nameEs        = data.nameEs        || null
  if (data.descriptionEs !== undefined) updateData.descriptionEs = data.descriptionEs || null

  const pkg = await prisma.servicePackage.update({ where: { id: packageId }, data: updateData })

  // If the admin sent an explicit featureIds array, replace the inclusion set
  // atomically. Skip when undefined so callers that only update pricing
  // don't lose the existing inclusion mapping.
  if (Array.isArray(data.featureIds)) {
    await syncPackageFeatureSlots(packageId, serviceId, data.featureIds)
  }
  return pkg
}

/**
 * Replace the PackageFeatureSlot rows for a package so it reflects exactly
 * the supplied featureIds. Validates that every featureId belongs to the
 * parent service so admins can't link a feature from a different service.
 */
async function syncPackageFeatureSlots(packageId, serviceId, featureIds) {
  // Validate featureIds belong to this service
  const validFeatures = await prisma.serviceFeature.findMany({
    where:  { id: { in: featureIds }, serviceId },
    select: { id: true },
  })
  const validSet = new Set(validFeatures.map((f) => f.id))

  await prisma.$transaction(async (tx) => {
    await tx.packageFeatureSlot.deleteMany({ where: { packageId } })
    if (validSet.size > 0) {
      await tx.packageFeatureSlot.createMany({
        data: [...validSet].map((featureId) => ({ packageId, featureId })),
        skipDuplicates: true,
      })
    }
  })
}

async function removePackage(serviceId, packageId) {
  const existing = await prisma.servicePackage.findFirst({
    where: { id: packageId, serviceId },
  })
  if (!existing) return null

  // Hard-delete if no dependent service orders; soft-deactivate otherwise.
  const linked = await prisma.serviceOrder.count({ where: { servicePackageId: packageId } })
  if (linked > 0) {
    return prisma.servicePackage.update({
      where: { id: packageId },
      data:  { isActive: false },
    })
  }
  await prisma.servicePackage.delete({ where: { id: packageId } })
  return { id: packageId, deleted: true }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Feature subroutes
 * ──────────────────────────────────────────────────────────────────────────── */

async function addFeature(serviceId, data) {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } })
  if (!service) throw buildError("NOT_FOUND", "Service not found", 404)

  const text = String(data.featureText || "").trim()
  if (!text) throw buildError("VALIDATION_ERROR", "featureText is required", 400)

  // Put new features at the end unless a sortOrder is supplied.
  let sortOrder = data.sortOrder
  if (sortOrder == null) {
    const last = await prisma.serviceFeature.findFirst({
      where:   { serviceId },
      orderBy: { sortOrder: "desc" },
      select:  { sortOrder: true },
    })
    sortOrder = (last?.sortOrder ?? -1) + 1
  }

  return prisma.serviceFeature.create({
    data: {
      serviceId,
      featureText: text,
      sortOrder:   Number(sortOrder),
    },
  })
}

async function removeFeature(serviceId, featureId) {
  const existing = await prisma.serviceFeature.findFirst({
    where: { id: featureId, serviceId },
  })
  if (!existing) return null
  await prisma.serviceFeature.delete({ where: { id: featureId } })
  return { id: featureId, deleted: true }
}

module.exports = {
  listAllServices,
  getServiceForAdmin,
  createService,
  updateService,
  softDeleteService,
  addPackage,
  updatePackage,
  removePackage,
  addFeature,
  removeFeature,
}
