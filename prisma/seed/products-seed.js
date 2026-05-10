/**
 * Products seed — idempotent.
 *
 * Source of truth: web/src/data/storeData.js. Every slug referenced by the
 * storefront/home/featured CTAs must exist as a `Product` row, otherwise
 * direct visits to `/store/<slug>` return "Product not found" even though
 * the marketing surfaces still link there (the visible bug in PDF #6 / page 1
 * screenshot).
 *
 * Re-running upserts by slug — admin price/title edits are preserved across
 * re-runs because we only set columns we own here.
 *
 * Usage:
 *   node prisma/seed/products-seed.js
 */

const prisma = require("../../src/lib/prisma")

const PRODUCTS = [
  {
    slug: "digital-transformation-starter-toolkit",
    title: "Digital Transformation Starter Toolkit",
    category: "IT Toolkits",
    shortDescription: "Practical templates to guide digital planning and implementation.",
    description:
      "A structured toolkit designed to help organizations assess digital maturity, define priorities, and organize implementation steps with practical templates and planning resources.",
    price: 10,
    isFeatured: true,
  },
  {
    slug: "weekly-content-calendar",
    title: "Weekly Content Calendar for Creators",
    category: "Templates",
    shortDescription: "A structured planning resource for consistent digital publishing.",
    description:
      "A practical planning template for organizing weekly content production, publishing priorities, and campaign coordination across digital platforms.",
    price: 12,
    isFeatured: true,
  },
  {
    slug: "stem-program-planning-pack",
    title: "STEM Program Planning Pack",
    category: "Training",
    shortDescription: "Organized teaching resources for coding and robotics initiatives.",
    description:
      "A practical education-focused resource that helps schools and trainers design structured STEM, coding, and robotics activities with implementation guidance.",
    price: 18,
    isFeatured: true,
  },
  {
    slug: "school-it-audit-checklist",
    title: "School IT Audit Checklist",
    category: "Operations",
    shortDescription: "A ready-to-use checklist for reviewing infrastructure and systems.",
    description:
      "A structured checklist for schools and educational institutions to review infrastructure, devices, connectivity, access, security, and operational technology readiness.",
    price: 15,
    isFeatured: false,
  },
  {
    slug: "website-launch-planning-kit",
    title: "Website Launch Planning Kit",
    category: "Business Systems",
    shortDescription: "A clean framework for planning and structuring web projects.",
    description:
      "A planning kit for individuals and organizations launching modern websites, including structure mapping, content planning, delivery checkpoints, and quality review templates.",
    price: 14,
    isFeatured: true,
  },
  {
    slug: "digital-workflow-optimization-pack",
    title: "Digital Workflow Optimization Pack",
    category: "Consulting",
    shortDescription: "Templates and guidance for improving digital efficiency.",
    description:
      "A consulting-style digital resource for identifying friction points, mapping workflows, and improving efficiency through better structure and modern digital practices.",
    price: 16,
    isFeatured: false,
  },
  {
    slug: "consulting-session-package",
    title: "Digital Transformation Consulting Session",
    category: "Consulting",
    shortDescription: "A focused strategy session for digital growth and system improvement.",
    description:
      "A professional consulting session designed for businesses, professionals, and schools seeking guidance on digital systems, infrastructure, workflows, and modernization priorities.",
    price: 150,
    isFeatured: true,
  },
  {
    slug: "website-system-setup",
    title: "Website & Digital System Setup",
    category: "Business Systems",
    shortDescription: "Planning support for modern websites and connected digital workflows.",
    description:
      "A service-oriented package for organizations and professionals who want to define or improve website structure, digital systems, and integrated user experiences.",
    price: 300,
    isFeatured: true,
  },
  {
    slug: "infrastructure-audit",
    title: "IT Infrastructure Audit",
    category: "Operations",
    shortDescription: "A practical review of systems, devices, access, and operational readiness.",
    description:
      "A structured service package for reviewing infrastructure condition, system organization, operational gaps, and modernization opportunities.",
    price: 120,
    isFeatured: false,
  },
]

async function seedProducts() {
  let created = 0
  let updated = 0

  for (const p of PRODUCTS) {
    const data = {
      title: p.title,
      category: p.category,
      shortDescription: p.shortDescription,
      description: p.description,
      price: p.price,
      currency: "MXN",
      productType: "downloadable",
      status: "published",
      isActive: true,
      isFeatured: !!p.isFeatured,
      isNew: false,
      publishedAt: new Date(),
    }

    const before = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } })

    await prisma.product.upsert({
      where: { slug: p.slug },
      create: { ...data, slug: p.slug },
      // On update we deliberately only refresh the marketing copy fields and
      // flags — admin-edited price/title remain untouched if the row exists.
      update: {
        shortDescription: data.shortDescription,
        description: data.description,
        category: data.category,
        isActive: data.isActive,
      },
    })

    if (before) updated += 1
    else created += 1
  }

  return { created, updated, total: PRODUCTS.length }
}

if (require.main === module) {
  seedProducts()
    .then((stats) => {
      // eslint-disable-next-line no-console
      console.log(`[products-seed] created=${stats.created} updated=${stats.updated} total=${stats.total}`)
      return prisma.$disconnect()
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error("[products-seed] failed:", err)
      await prisma.$disconnect()
      process.exit(1)
    })
}

module.exports = { seedProducts }
