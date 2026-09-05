// @ts-check
/**
 * adminBlogService.js · admin CRUD for blog posts, categories, and tags.
 *
 * Slug uniqueness is enforced both at the database level (@unique) and
 * here so we return a friendly error before the DB throws.
 */

const prisma = require("../lib/prisma")
const { serializePost } = require("./blogService")

function slugify(input) {
  return String(input || "")
    .toLowerCase().trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function uniqueSlug(base, ignoreId = null) {
  let slug = base || "post"
  let n = 1
  // Walk until we find one nobody else uses.
   
  while (true) {
    const hit = await prisma.blogPost.findFirst({
      where: { slug, NOT: ignoreId ? { id: ignoreId } : undefined },
      select: { id: true },
    })
    if (!hit) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

/* ── Posts (full visibility — drafts + archived included) ─────────────── */

async function listAllPosts({ status, q, limit = 100, offset = 0 } = {}) {
  const where = {}
  if (status) where.status = status
  if (q) {
    const term = String(q).slice(0, 100)
    where.OR = [
      { title:   { contains: term } },
      { slug:    { contains: term } },
      { excerpt: { contains: term } },
    ]
  }
  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      // T1-4 · the same card projection the public list uses: `body` (the
      // heavy Json column) never leaves the database for a list. The
      // editor fetches the single post.
      select: {
        id: true, slug: true, title: true, excerpt: true, cover: true,
        titleEs: true, excerptEs: true,
        status: true, deletedAt: true, updatedAt: true,
        readMinutes: true, isFeatured: true, publishedAt: true, createdAt: true,
        authorName: true, authorRole: true, authorAvatar: true,
        category: { select: { id: true, label: true, slug: true } },
        tags:     { select: { tag: { select: { id: true, label: true, slug: true } } } },
      },
      take: Math.min(Math.max(1, limit), 100),
      skip: offset,
    }),
    prisma.blogPost.count({ where }),
  ])
  return {
    total,
    posts: rows.map((r) => ({
      ...serializePost(r),
      id:        r.id,
      status:    r.status,
      deletedAt: r.deletedAt?.toISOString?.() || null,
      isDeleted: r.deletedAt != null,
      updatedAt: r.updatedAt?.toISOString?.() || null,
    })),
  }
}

async function getPostById(id) {
  const row = await prisma.blogPost.findUnique({
    where: { id },
    include: { category: true, tags: { include: { tag: true } } },
  })
  if (!row) return null
  return {
    ...serializePost(row),
    id:              row.id,
    status:          row.status,
    deletedAt:       row.deletedAt?.toISOString?.() || null,
    isDeleted:       row.deletedAt != null,
    metaTitle:       row.metaTitle,
    metaDescription: row.metaDescription,
    // Spanish overlay, raw (the admin form edits both languages)
    titleEs:           row.titleEs || "",
    excerptEs:         row.excerptEs || "",
    bodyEs:            Array.isArray(row.bodyEs) ? row.bodyEs : [],
    metaTitleEs:       row.metaTitleEs || "",
    metaDescriptionEs: row.metaDescriptionEs || "",
    categoryId:      row.categoryId,
  }
}

/** Empty strings / empty arrays mean "no Spanish version" → null. */
function esOrNull(v) {
  if (v == null) return null
  if (Array.isArray(v)) return v.length ? v : null
  return String(v).trim() ? String(v).trim() : null
}

/** Resolves tag labels to BlogTag rows, creating any missing. */
async function ensureTags(tagLabels = []) {
  const ids = []
  for (const raw of tagLabels) {
    const label = String(raw).trim()
    if (!label) continue
    const slug = slugify(label)
    if (!slug) continue
    const tag = await prisma.blogTag.upsert({
      where:  { slug },
      update: { label },
      create: { slug, label },
    })
    ids.push(tag.id)
  }
  return ids
}

async function createPost(input) {
  const baseSlug = slugify(input.slug || input.title || "post")
  const slug     = await uniqueSlug(baseSlug)
  const tagIds   = await ensureTags(input.tags || [])

  const created = await prisma.blogPost.create({
    data: {
      slug,
      title:           input.title,
      excerpt:         input.excerpt || "",
      body:            input.body || [],
      cover:           input.cover || null,
      readMinutes:     Number.isFinite(input.readMinutes) ? input.readMinutes : 5,
      status:          input.status || "draft",
      isFeatured:      !!input.isFeatured,
      publishedAt:     input.status === "published" ? new Date() : null,
      metaTitle:       input.metaTitle || null,
      metaDescription: input.metaDescription || null,
      titleEs:           esOrNull(input.titleEs),
      excerptEs:         esOrNull(input.excerptEs),
      bodyEs:            esOrNull(input.bodyEs),
      metaTitleEs:       esOrNull(input.metaTitleEs),
      metaDescriptionEs: esOrNull(input.metaDescriptionEs),
      categoryId:      input.categoryId,
      authorUserId:    input.authorUserId || null,
      authorName:      input.authorName  || "Mustapha Ukizuru",
      authorRole:      input.authorRole  || "IT Manager · Full-Stack Developer · CS Educator",
      authorAvatar:    input.authorAvatar || null,
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: { category: true, tags: { include: { tag: true } } },
  })
  return getPostById(created.id)
}

async function updatePost(id, input) {
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true, slug: true, status: true } })
  if (!existing) return null

  let nextSlug = existing.slug
  if (input.slug && slugify(input.slug) !== existing.slug) {
    nextSlug = await uniqueSlug(slugify(input.slug), id)
  }

  // Replace tag set when caller supplies one (otherwise leave alone).
  let tagOps
  if (Array.isArray(input.tags)) {
    const tagIds = await ensureTags(input.tags)
    tagOps = {
      deleteMany: {},
      create: tagIds.map((tagId) => ({ tagId })),
    }
  }

  const wasPublished = existing.status === "published"
  const willPublish  = input.status === "published"
  const publishedAt  = willPublish && !wasPublished
    ? new Date()
    : input.status === "draft" || input.status === "archived"
      ? null
      : undefined

  await prisma.blogPost.update({
    where: { id },
    data: {
      slug:            nextSlug,
      title:           input.title,
      excerpt:         input.excerpt,
      body:            input.body,
      cover:           input.cover,
      readMinutes:     input.readMinutes,
      status:          input.status,
      isFeatured:      input.isFeatured,
      metaTitle:       input.metaTitle,
      metaDescription: input.metaDescription,
      ...(input.titleEs           !== undefined ? { titleEs:           esOrNull(input.titleEs) } : {}),
      ...(input.excerptEs         !== undefined ? { excerptEs:         esOrNull(input.excerptEs) } : {}),
      ...(input.bodyEs            !== undefined ? { bodyEs:            esOrNull(input.bodyEs) } : {}),
      ...(input.metaTitleEs       !== undefined ? { metaTitleEs:       esOrNull(input.metaTitleEs) } : {}),
      ...(input.metaDescriptionEs !== undefined ? { metaDescriptionEs: esOrNull(input.metaDescriptionEs) } : {}),
      categoryId:      input.categoryId,
      authorUserId:    input.authorUserId,
      authorName:      input.authorName,
      authorRole:      input.authorRole,
      authorAvatar:    input.authorAvatar,
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      ...(tagOps ? { tags: tagOps } : {}),
    },
  })
  return getPostById(id)
}

/* Step 42 · soft delete by default; { hard: true } keeps the destructive path. */
async function deletePost(id, { hard = false } = {}) {
  if (hard) {
    await prisma.blogPost.delete({ where: { id } })
    return { id }
  }
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return null
  await prisma.blogPost.update({
    where: { id },
    data:  { deletedAt: new Date(), isFeatured: false },
  })
  return { id }
}

async function restorePost(id) {
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return null
  await prisma.blogPost.update({ where: { id }, data: { deletedAt: null } })
  return getPostById(id)
}

/* ── Categories (admin CRUD) ──────────────────────────────────────────── */

async function listCategoriesAdmin() {
  return prisma.blogCategory.findMany({
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    include: { _count: { select: { posts: true } } },
  })
}

async function createCategory({ slug, label, accent = "#5D3FD3", description = null, displayOrder = 0 }) {
  return prisma.blogCategory.create({
    data: { slug: slugify(slug || label), label, accent, description, displayOrder },
  })
}

async function updateCategory(id, data) {
  return prisma.blogCategory.update({ where: { id }, data })
}

async function deleteCategory(id) {
  await prisma.blogCategory.delete({ where: { id } })
  return { id }
}

/* ── Tags (admin maintenance) ─────────────────────────────────────────── */

async function listTagsAdmin() {
  return prisma.blogTag.findMany({
    orderBy: [{ label: "asc" }],
    include: { _count: { select: { posts: true } } },
  })
}

module.exports = {
  // Posts
  listAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  restorePost,
  // Categories
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  // Tags
  listTagsAdmin,
}
