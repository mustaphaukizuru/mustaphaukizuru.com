// @ts-check
const prisma = require("../lib/prisma")
const { serializePortfolio } = require("./portfolioService")

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

async function uniqueSlug(baseSlug, ignoreId = null) {
  let slug = baseSlug
  let n = 1
  while (true) {
    const existing = await prisma.portfolio.findUnique({ where: { slug }, select: { id: true } })
    if (!existing || existing.id === ignoreId) return slug
    n += 1
    slug = `${baseSlug}-${n}`
    if (n > 50) throw new Error("Could not allocate unique slug")
  }
}

function buildError(code, message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}

function normalizeJsonArray(value) {
  if (!value) return null
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === "string") {
    try { const p = JSON.parse(value); if (Array.isArray(p)) return p.map((v) => String(v).trim()).filter(Boolean) } catch { /* pass */ }
    // Treat as comma-separated string
    return value.split(",").map((s) => s.trim()).filter(Boolean)
  }
  return null
}

function nullableString(v) {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  return String(v)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin CRUD
 * ──────────────────────────────────────────────────────────────────────────── */

async function listAll({ status, isFeatured, page = 1, limit = 50 } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50))

  const where = {}
  if (status)     where.status = status
  if (isFeatured === true || isFeatured === "true") where.isFeatured = true
  else if (isFeatured === false || isFeatured === "false") where.isFeatured = false

  const [items, total] = await Promise.all([
    prisma.portfolio.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
    }),
    prisma.portfolio.count({ where }),
  ])

  return {
    items: items.map(serializePortfolio),
    pagination: {
      page: safePage, limit: safeLimit, total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getOne(id) {
  const row = await prisma.portfolio.findUnique({ where: { id } })
  return serializePortfolio(row)
}

async function create(data, createdById) {
  if (!data.title)             throw buildError("VALIDATION_ERROR", "title is required", 400)
  if (!data.shortDescription)  throw buildError("VALIDATION_ERROR", "shortDescription is required", 400)
  if (!data.role)              throw buildError("VALIDATION_ERROR", "role is required", 400)
  if (!data.category)          throw buildError("VALIDATION_ERROR", "category is required", 400)

  const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title))

  const row = await prisma.portfolio.create({
    data: {
      title:            data.title,
      slug,
      role:             data.role,
      client:           nullableString(data.client),
      category:         data.category,
      coverImage:       nullableString(data.coverImage),
      gallery:          normalizeJsonArray(data.gallery),
      shortDescription: data.shortDescription,
      description:      nullableString(data.description),
      challenge:        nullableString(data.challenge),
      solution:         nullableString(data.solution),
      results:          normalizeJsonArray(data.results),
      tools:            normalizeJsonArray(data.tools),
      tags:             normalizeJsonArray(data.tags),
      liveUrl:          nullableString(data.liveUrl),
      repoUrl:          nullableString(data.repoUrl),
      year:             data.year != null && data.year !== "" ? Number(data.year) : null,
      duration:         nullableString(data.duration),
      status:           data.status || "draft",
      isFeatured:       Boolean(data.isFeatured),
      displayOrder:     data.displayOrder != null ? Number(data.displayOrder) : 0,
      metaTitle:        nullableString(data.metaTitle),
      metaDescription:  nullableString(data.metaDescription),
      createdById:      createdById || null,

      // I18N06 · Spanish bilingual fields. nullableString collapses "" → null
      // so pickLocale's English fallback fires when admins haven't translated.
      titleEs:            nullableString(data.titleEs),
      shortDescriptionEs: nullableString(data.shortDescriptionEs),
      descriptionEs:      nullableString(data.descriptionEs),
      metaTitleEs:        nullableString(data.metaTitleEs),
      metaDescriptionEs:  nullableString(data.metaDescriptionEs),
    },
  })
  return serializePortfolio(row)
}

async function update(id, data) {
  const existing = await prisma.portfolio.findUnique({ where: { id } })
  if (!existing) return null

  // Slug handling: only re-unique if the slug changes
  let nextSlug = existing.slug
  if (data.slug && slugify(data.slug) !== existing.slug) {
    nextSlug = await uniqueSlug(slugify(data.slug), id)
  } else if (data.title && !data.slug && existing.slug === slugify(existing.title)) {
    nextSlug = await uniqueSlug(slugify(data.title), id)
  }

  const updateData = {}
  if (data.title            !== undefined) updateData.title            = data.title
  if (nextSlug !== existing.slug)          updateData.slug             = nextSlug
  if (data.role             !== undefined) updateData.role             = data.role
  if (data.client           !== undefined) updateData.client           = nullableString(data.client)
  if (data.category         !== undefined) updateData.category         = data.category
  if (data.coverImage       !== undefined) updateData.coverImage       = nullableString(data.coverImage)
  if (data.gallery          !== undefined) updateData.gallery          = normalizeJsonArray(data.gallery)
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription
  if (data.description      !== undefined) updateData.description      = nullableString(data.description)
  if (data.challenge        !== undefined) updateData.challenge        = nullableString(data.challenge)
  if (data.solution         !== undefined) updateData.solution         = nullableString(data.solution)
  if (data.results          !== undefined) updateData.results          = normalizeJsonArray(data.results)
  if (data.tools            !== undefined) updateData.tools            = normalizeJsonArray(data.tools)
  if (data.tags             !== undefined) updateData.tags             = normalizeJsonArray(data.tags)
  if (data.liveUrl          !== undefined) updateData.liveUrl          = nullableString(data.liveUrl)
  if (data.repoUrl          !== undefined) updateData.repoUrl          = nullableString(data.repoUrl)
  if (data.year             !== undefined) updateData.year             = data.year === null || data.year === "" ? null : Number(data.year)
  if (data.duration         !== undefined) updateData.duration         = nullableString(data.duration)
  if (data.status           !== undefined) updateData.status           = data.status
  if (data.isFeatured       !== undefined) updateData.isFeatured       = Boolean(data.isFeatured)
  if (data.displayOrder     !== undefined) updateData.displayOrder     = Number(data.displayOrder)
  if (data.metaTitle        !== undefined) updateData.metaTitle        = nullableString(data.metaTitle)
  if (data.metaDescription  !== undefined) updateData.metaDescription  = nullableString(data.metaDescription)

  // I18N06 · Spanish passthrough on update. Only set a column when the
  // caller explicitly sends the key — preserves EN-only items from being
  // accidentally wiped to NULL on partial updates.
  if (data.titleEs            !== undefined) updateData.titleEs            = nullableString(data.titleEs)
  if (data.shortDescriptionEs !== undefined) updateData.shortDescriptionEs = nullableString(data.shortDescriptionEs)
  if (data.descriptionEs      !== undefined) updateData.descriptionEs      = nullableString(data.descriptionEs)
  if (data.metaTitleEs        !== undefined) updateData.metaTitleEs        = nullableString(data.metaTitleEs)
  if (data.metaDescriptionEs  !== undefined) updateData.metaDescriptionEs  = nullableString(data.metaDescriptionEs)

  const row = await prisma.portfolio.update({
    where: { id },
    data:  updateData,
  })
  return serializePortfolio(row)
}

async function softDelete(id) {
  const existing = await prisma.portfolio.findUnique({ where: { id } })
  if (!existing) return null
  const row = await prisma.portfolio.update({
    where: { id },
    data:  { status: "archived", isFeatured: false },
  })
  return serializePortfolio(row)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Image attachments
 * ──────────────────────────────────────────────────────────────────────────── */

async function setCover(id, publicUrl) {
  const existing = await prisma.portfolio.findUnique({ where: { id } })
  if (!existing) return null
  const row = await prisma.portfolio.update({
    where: { id },
    data:  { coverImage: publicUrl },
  })
  return serializePortfolio(row)
}

async function appendGalleryImage(id, publicUrl) {
  const existing = await prisma.portfolio.findUnique({ where: { id } })
  if (!existing) return null
  const current = Array.isArray(existing.gallery)
    ? existing.gallery
    : (() => { try { return JSON.parse(existing.gallery || "[]") } catch { return [] } })()
  const nextGallery = [...current, publicUrl]
  const row = await prisma.portfolio.update({
    where: { id },
    data:  { gallery: nextGallery },
  })
  return serializePortfolio(row)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bulk reorder
 *   body: { orderedIds: [id1, id2, id3, ...] }
 *   Each id gets displayOrder equal to its index.
 * ──────────────────────────────────────────────────────────────────────────── */

async function bulkReorder(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw buildError("VALIDATION_ERROR", "orderedIds must be a non-empty array", 400)
  }

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.portfolio.update({
        where: { id },
        data:  { displayOrder: idx },
      })
    )
  )

  return { updated: orderedIds.length }
}

module.exports = {
  listAll,
  getOne,
  create,
  update,
  softDelete,
  setCover,
  appendGalleryImage,
  bulkReorder,
}
