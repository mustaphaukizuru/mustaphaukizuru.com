/* ─────────────────────────────────────────────────────────────────────────
 * prisma/seed-blog.js · Idempotently seed the blog from the legacy static
 * posts into the database (M16).
 *
 * Source data: prisma/blog-seed-data.json — a snapshot of the 10 posts and
 * 6 categories that previously lived in web/src/data/blogPosts/*.js. The
 * snapshot is regenerated with:
 *
 *   cd web && npx esbuild src/data/blogPostsData.js --bundle --format=cjs \
 *     --platform=node --outfile=_blogdata_tmp.cjs
 *   node -e "const d=require('./_blogdata_tmp.cjs');require('fs').writeFileSync(
 *     '../prisma/blog-seed-data.json',JSON.stringify({categories:d.BLOG_CATEGORIES,
 *     posts:d.BLOG_POSTS},null,2))" && rm _blogdata_tmp.cjs
 *
 * Safe to run multiple times: every write is an upsert keyed on a unique
 * slug (categories, tags, posts) or composite key (tag maps). Re-running
 * refreshes content without creating duplicates.
 *
 * Usage:
 *   npm run seed:blog
 * ───────────────────────────────────────────────────────────────────────── */

const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

const { assertLocalDatabase } = require("../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed-blog.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("seed-blog.js")

const prisma = new PrismaClient()

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

async function main() {
  const dataPath = path.join(__dirname, "blog-seed-data.json")
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing ${dataPath}. Regenerate the snapshot (see header).`)
  }
  const { categories, posts } = JSON.parse(fs.readFileSync(dataPath, "utf8"))

  // 1 · Categories ───────────────────────────────────────────────────────
  const catIdBySlug = {}
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    const row = await prisma.blogCategory.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, label: c.label, accent: c.accent || "#5D3FD3", displayOrder: i, isVisible: true },
      update: { label: c.label, accent: c.accent || "#5D3FD3", displayOrder: i },
    })
    catIdBySlug[c.slug] = row.id
  }
  console.log(`✓ ${categories.length} categories upserted`)

  // 2 · Tags (unique across all posts) ─────────────────────────────────────
  const tagIdBySlug = {}
  const tagLabels = new Set()
  for (const p of posts) (p.tags || []).forEach((t) => tagLabels.add(t))
  for (const label of tagLabels) {
    const slug = slugify(label)
    const row = await prisma.blogTag.upsert({
      where: { slug },
      create: { slug, label },
      update: { label },
    })
    tagIdBySlug[slug] = row.id
  }
  console.log(`✓ ${tagLabels.size} tags upserted`)

  // 3 · Posts + tag maps ──────────────────────────────────────────────────
  let created = 0
  let updated = 0
  for (const p of posts) {
    const categoryId = catIdBySlug[p.category]
    if (!categoryId) {
      console.warn(`  ⚠ skipping "${p.slug}" — unknown category "${p.category}"`)
      continue
    }
    const author = p.author || {}
    const fields = {
      title: p.title,
      excerpt: p.excerpt,
      body: p.body, // Json column
      cover: p.cover || null,
      readMinutes: p.readMinutes || 5,
      status: "published",
      isFeatured: Boolean(p.featured),
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : new Date(),
      metaTitle: p.metaTitleEs ? p.metaTitle || p.title : p.title,
      metaDescription: p.metaDescriptionEs ? p.metaDescription || p.excerpt : p.excerpt,
      // I18N · the Spanish columns. blogService overlays them via pickLocale
      // when locale === "es", falling back to English per field, so a post
      // with no translation is unaffected. Null rather than undefined so a
      // removed translation is actually cleared on re-seed.
      titleEs: p.titleEs || null,
      excerptEs: p.excerptEs || null,
      bodyEs: p.bodyEs || null,
      metaTitleEs: p.metaTitleEs || null,
      metaDescriptionEs: p.metaDescriptionEs || null,
      authorName: author.name || "Mustapha Ukizuru",
      authorRole: author.role || "IT Manager · Full-Stack Developer · CS Educator",
      authorAvatar: author.avatar || null,
      categoryId,
    }

    const existing = await prisma.blogPost.findUnique({ where: { slug: p.slug }, select: { id: true } })
    const post = await prisma.blogPost.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...fields },
      update: fields,
    })
    existing ? updated++ : created++

    // Tag links — upsert each (idempotent on composite key)
    for (const label of p.tags || []) {
      const tagId = tagIdBySlug[slugify(label)]
      if (!tagId) continue
      await prisma.blogTagMap.upsert({
        where: { postId_tagId: { postId: post.id, tagId } },
        create: { postId: post.id, tagId },
        update: {},
      })
    }
  }

  console.log(`✓ posts: ${created} created, ${updated} updated`)
  console.log("Blog seed complete.")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Blog seed failed:", err)
    await prisma.$disconnect()
    process.exit(1)
  })
