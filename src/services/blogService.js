/**
 * blogService.js · public read-only blog API.
 *
 * Mirrors the shape that BlogPage and BlogPostPage already consume from
 * web/src/data/blogPostsData.js, so the frontend swap from static data to
 * API is just a `fetch` substitution — no component changes required.
 *
 * Responses are serialised so the BigInt/Date/Decimal Prisma types never
 * leak; everything is JSON-safe at the boundary.
 */

const prisma = require("../lib/prisma")

/** Default selection for public reads — drafts/archived are excluded. */
const PUBLIC_WHERE = { status: "published", deletedAt: null }

function serializePost(post) {
  if (!post) return null
  return {
    slug:        post.slug,
    title:       post.title,
    excerpt:     post.excerpt,
    body:        post.body || [],
    cover:       post.cover || null,
    readMinutes: post.readMinutes,
    featured:    post.isFeatured,
    publishedAt: (post.publishedAt || post.createdAt)?.toISOString?.() || null,
    category:    post.category?.slug || null,
    tags:        Array.isArray(post.tags)
                   ? post.tags.map((t) => t.tag?.slug).filter(Boolean)
                   : [],
    author: {
      name:   post.authorName,
      role:   post.authorRole,
      avatar: post.authorAvatar || "/images/profile/Ukizuru_Mustapha_Photo.jpg",
    },
  }
}

function serializeCategory(c) {
  return {
    slug:  c.slug,
    label: c.label,
    accent: c.accent,
    count: c._count?.posts ?? 0,
  }
}

/* ── Public reads ─────────────────────────────────────────────────────── */

async function listPublicPosts({ category, tag, q, limit = 50, offset = 0 } = {}) {
  const where = { ...PUBLIC_WHERE }
  if (category) where.category = { slug: category }
  if (tag)      where.tags = { some: { tag: { slug: tag } } }
  if (q) {
    const term = String(q).slice(0, 100)
    where.OR = [
      { title:   { contains: term } },
      { excerpt: { contains: term } },
    ]
  }
  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      // Card projection only — `body` (the heavy Json column) is excluded;
      // getPublicPostBySlug returns the full post.
      select: {
        id: true, slug: true, title: true, excerpt: true, cover: true,
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
  return { posts: rows.map(serializePost), total }
}

async function getPublicPostBySlug(slug) {
  const row = await prisma.blogPost.findFirst({
    where: { slug, ...PUBLIC_WHERE },
    include: { category: true, tags: { include: { tag: true } } },
  })
  return serializePost(row)
}

async function listCategoriesWithCounts() {
  const cats = await prisma.blogCategory.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    include: { _count: { select: { posts: { where: PUBLIC_WHERE } } } },
  })
  return cats.map(serializeCategory)
}

async function listTopTags(limit = 14) {
  // Tag frequency among published posts only.
  const rows = await prisma.blogTag.findMany({
    include: {
      _count: {
        select: { posts: { where: { post: PUBLIC_WHERE } } },
      },
    },
  })
  return rows
    .map((r) => ({ tag: r.label, slug: r.slug, count: r._count.posts }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Month-by-month post counts for the blog archive nav.
 *
 * Grouped in SQL rather than in JS. The previous implementation pulled EVERY
 * published post (two columns, but every row) and bucketed them in a loop, so
 * the work and the memory grew with the archive on a request that only ever
 * returns one row per month. MySQL groups this against the existing
 * @@index([status, publishedAt]) and hands back a few dozen rows.
 *
 * COUNT(*) arrives as BigInt over the wire, hence the Number() coercion —
 * JSON.stringify throws on BigInt, which would 500 the route.
 */
async function listArchive() {
  const rows = await prisma.$queryRaw`
    SELECT DATE_FORMAT(COALESCE(publishedAt, createdAt), '%Y-%m') AS ym,
           COUNT(*) AS count
    FROM BlogPost
    WHERE status = 'published' AND deletedAt IS NULL
      AND COALESCE(publishedAt, createdAt) IS NOT NULL
    GROUP BY ym
    ORDER BY ym DESC
  `
  return rows.map((r) => {
    const [year, month] = String(r.ym).split("-")
    const label = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString("en-US", { month: "long", year: "numeric" })
    return { key: r.ym, label, count: Number(r.count) }
  })
}

module.exports = {
  serializePost,
  listPublicPosts,
  getPublicPostBySlug,
  listCategoriesWithCounts,
  listTopTags,
  listArchive,
}
