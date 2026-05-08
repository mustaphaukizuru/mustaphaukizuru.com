// @ts-check
/* ════════════════════════════════════════════════════════════════════════
   recommendationService.js · public reads + admin CRUD
   ────────────────────────────────────────────────────────────────────────
   "Recommendations" are admin-curated picks that surface on the public
   /recommendations page and contextually next to related products /
   services. Distinct from Reviews (user-generated trust content).

   Contract:
     · listPublic()     — only status=published, ordered by priority desc
     · getBySlug()      — single published recommendation
     · listForAdmin()   — full list with filters
     · getForAdmin()    — single, any status
     · createOne()      — admin
     · updateOne()      — admin
     · removeOne()      — admin (hard delete; rare. Use status=archived in UI.)
   ════════════════════════════════════════════════════════════════════════ */

const prisma = require("../lib/prisma")

const VALID_STATUSES = ["draft", "published", "archived"]
const VALID_CATEGORIES = ["tool", "book", "course", "template", "service", "partner"]
const PUBLIC_STATUS = "published"

/* ── helpers ──────────────────────────────────────────────────────────── */

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.code = code
  err.statusCode = statusCode
  return err
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96)
}

async function uniqueSlug(baseSlug, ignoreId = null) {
  let slug = baseSlug
  let n = 1
  while (true) {
    const existing = await prisma.recommendation.findUnique({
      where:  { slug },
      select: { id: true },
    })
    if (!existing || existing.id === ignoreId) return slug
    n += 1
    slug = `${baseSlug}-${n}`
    if (n > 50) throw buildError("SLUG_ALLOC", "Could not allocate unique slug", 500)
  }
}

const subjectInclude = {
  product: {
    select: {
      id:     true,
      slug:   true,
      title:  true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  },
  service: { select: { id: true, slug: true, title: true } },
}

/* ── public reads ─────────────────────────────────────────────────────── */

async function listPublic({ category, limit = 24 } = {}) {
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))
  const where = { status: PUBLIC_STATUS }
  if (category && VALID_CATEGORIES.includes(category)) where.category = category

  return prisma.recommendation.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: safeLimit,
    include: subjectInclude,
  })
}

async function getBySlug(slug) {
  if (!slug) return null
  const row = await prisma.recommendation.findUnique({
    where:   { slug },
    include: subjectInclude,
  })
  if (!row || row.status !== PUBLIC_STATUS) return null
  return row
}

/* ── admin reads ──────────────────────────────────────────────────────── */

async function listForAdmin({ page = 1, limit = 50, status, category, q } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50))
  const where = {}
  if (status   && VALID_STATUSES.includes(status))     where.status   = status
  if (category && VALID_CATEGORIES.includes(category)) where.category = category
  if (q && String(q).trim().length > 0) {
    const needle = String(q).trim()
    where.OR = [
      { title:   { contains: needle } },
      { summary: { contains: needle } },
      { slug:    { contains: needle } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: subjectInclude,
    }),
    prisma.recommendation.count({ where }),
  ])

  return {
    items,
    pagination: {
      page: safePage, limit: safeLimit, total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getForAdmin(id) {
  if (!id) return null
  return prisma.recommendation.findUnique({
    where:   { id },
    include: subjectInclude,
  })
}

/* ── admin writes ─────────────────────────────────────────────────────── */

function validatePayload(data, isUpdate = false) {
  if (!isUpdate || data.title !== undefined) {
    if (!data.title || !String(data.title).trim()) {
      throw buildError("VALIDATION_ERROR", "title is required")
    }
  }
  if (!isUpdate || data.summary !== undefined) {
    if (!data.summary || !String(data.summary).trim()) {
      throw buildError("VALIDATION_ERROR", "summary is required")
    }
  }
  if (data.category && !VALID_CATEGORIES.includes(data.category)) {
    throw buildError("VALIDATION_ERROR", `category must be one of ${VALID_CATEGORIES.join(", ")}`)
  }
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    throw buildError("VALIDATION_ERROR", `status must be one of ${VALID_STATUSES.join(", ")}`)
  }
  // At most one internal link target
  const linkCount = [data.productId, data.serviceId, data.externalUrl]
    .filter((v) => v !== undefined && v !== null && v !== "").length
  if (linkCount > 1) {
    throw buildError("VALIDATION_ERROR", "Only one of productId, serviceId, or externalUrl may be set")
  }
}

async function createOne(data, createdById) {
  validatePayload(data)
  const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title))

  return prisma.recommendation.create({
    data: {
      title:           String(data.title).trim(),
      slug,
      summary:         String(data.summary).trim(),
      body:            data.body ? String(data.body) : null,
      imageUrl:        data.imageUrl || null,
      category:        data.category || "tool",
      priority:        Number.isInteger(data.priority) ? data.priority : 0,
      status:          data.status || "draft",
      productId:       data.productId   || null,
      serviceId:       data.serviceId   || null,
      externalUrl:     data.externalUrl || null,
      isAffiliate:     Boolean(data.isAffiliate),
      metaTitle:       data.metaTitle       || null,
      metaDescription: data.metaDescription || null,
      createdById:     createdById || null,
    },
    include: subjectInclude,
  })
}

async function updateOne(id, data) {
  const existing = await prisma.recommendation.findUnique({ where: { id } })
  if (!existing) return null

  validatePayload(data, true)

  let nextSlug = existing.slug
  if (data.slug && data.slug !== existing.slug) {
    nextSlug = await uniqueSlug(slugify(data.slug), id)
  } else if (data.title && !data.slug && existing.slug === slugify(existing.title)) {
    // Auto-regenerate the slug only if the admin hasn't customised it.
    nextSlug = await uniqueSlug(slugify(data.title), id)
  }

  const update = {}
  if (data.title       !== undefined) update.title   = String(data.title).trim()
  if (nextSlug !== existing.slug)     update.slug    = nextSlug
  if (data.summary     !== undefined) update.summary = String(data.summary).trim()
  if (data.body        !== undefined) update.body    = data.body ? String(data.body) : null
  if (data.imageUrl    !== undefined) update.imageUrl = data.imageUrl || null
  if (data.category    !== undefined) update.category = data.category
  if (data.priority    !== undefined && Number.isInteger(data.priority)) update.priority = data.priority
  if (data.status      !== undefined) update.status   = data.status
  if (data.productId   !== undefined) update.productId   = data.productId   || null
  if (data.serviceId   !== undefined) update.serviceId   = data.serviceId   || null
  if (data.externalUrl !== undefined) update.externalUrl = data.externalUrl || null
  if (data.isAffiliate !== undefined) update.isAffiliate = Boolean(data.isAffiliate)
  if (data.metaTitle       !== undefined) update.metaTitle       = data.metaTitle       || null
  if (data.metaDescription !== undefined) update.metaDescription = data.metaDescription || null

  return prisma.recommendation.update({
    where:   { id },
    data:    update,
    include: subjectInclude,
  })
}

async function removeOne(id) {
  const existing = await prisma.recommendation.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return null
  await prisma.recommendation.delete({ where: { id } })
  return { id, deleted: true }
}

module.exports = {
  listPublic,
  getBySlug,
  listForAdmin,
  getForAdmin,
  createOne,
  updateOne,
  removeOne,
  VALID_STATUSES,
  VALID_CATEGORIES,
}
