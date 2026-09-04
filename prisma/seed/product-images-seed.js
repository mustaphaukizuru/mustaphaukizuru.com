// ════════════════════════════════════════════════════════════════════════════
// product-images-seed · attach the generated cover art to Product rows
// ────────────────────────────────────────────────────────────────────────────
//   npm run seed:product-images
//
// The storefront read every product's `images` array as empty and fell back to
// a placeholder icon, because `ProductImage` had no rows and no product art
// existed in the repo at all. `web/scripts/generate-product-covers.mjs` renders
// the art; this points the database at it.
//
// Idempotent, and deliberately non-destructive:
//   - matches on (productId, url), so re-running never duplicates a row;
//   - if a product already has a primary image that is NOT one of ours, it is
//     left completely alone. The owner replacing generated art with a real
//     photograph through Admin → Products must not be undone by a re-seed.
//
// Files are expected at public/images/products/<slug>/cover.png and are served
// from the site root, so the stored URL is /images/products/<slug>/cover.png.
// Missing files are reported rather than written as dead links — a row
// pointing at a 404 is worse than the placeholder it replaced.
// ════════════════════════════════════════════════════════════════════════════

const fs = require("fs")
const path = require("path")
const prisma = require("../../src/lib/prisma")

const { assertLocalDatabase } = require("../../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed/product-images-seed.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("product-images-seed.js")

const PUBLIC_ROOT = path.resolve(__dirname, "..", "..", "public")
const URL_PREFIX = "/images/products"

/** Alt text describes the product, not the decoration — screen-reader users
 *  gain nothing from "violet card with a gold icon". */
function altFor(title) {
  return `${title} — product cover`
}

function coverUrlFor(slug) {
  return `${URL_PREFIX}/${slug}/cover.png`
}

async function seedProductImages() {
  const products = await prisma.product.findMany({
    where:  { deletedAt: null },
    select: { id: true, slug: true, title: true },
    orderBy: { createdAt: "asc" },
  })

  const stats = { created: 0, existing: 0, missingFile: [], skippedCustom: [] }

  for (const product of products) {
    const url = coverUrlFor(product.slug)
    const diskPath = path.join(PUBLIC_ROOT, url.replace(/^\//, "").split("/").join(path.sep))

    if (!fs.existsSync(diskPath)) {
      stats.missingFile.push(product.slug)
      continue
    }

    const mine = await prisma.productImage.findFirst({
      where:  { productId: product.id, url },
      select: { id: true },
    })
    if (mine) {
      stats.existing += 1
      continue
    }

    // Someone else's primary image wins — never overwrite real art.
    const foreignPrimary = await prisma.productImage.findFirst({
      where:  { productId: product.id, isPrimary: true, NOT: { url } },
      select: { id: true, url: true },
    })
    if (foreignPrimary) {
      stats.skippedCustom.push(`${product.slug} (has ${foreignPrimary.url})`)
      continue
    }

    await prisma.productImage.create({
      data: {
        productId: product.id,
        url,
        altText:   altFor(product.title),
        imageRole: "cover",
        isPrimary: true,
        sortOrder: 0,
      },
    })
    stats.created += 1
  }

  return stats
}

if (require.main === module) {
  seedProductImages()
    .then(async (s) => {
      console.log(`[product-images] created=${s.created} already-present=${s.existing}`)
      if (s.skippedCustom.length) {
        console.log(`[product-images] left alone (custom primary image): ${s.skippedCustom.join(", ")}`)
      }
      if (s.missingFile.length) {
        console.log(`[product-images] no cover file for: ${s.missingFile.join(", ")}`)
        console.log(`[product-images] run:  cd web && npm run covers:build`)
      }
      await prisma.$disconnect()
      process.exit(0)
    })
    .catch(async (err) => {
      console.error("[product-images] failed:", err)
      await prisma.$disconnect()
      process.exit(1)
    })
}

module.exports = { seedProductImages, coverUrlFor }
