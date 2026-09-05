/**
 * Products seed — idempotent. The store sells downloadable products only.
 *
 * Source of truth: this file. It used to cite web/src/data/storeData.js,
 * which was imported by nothing, carried its own contradicting price list and
 * has been deleted (T2-4). Every slug the storefront, home or featured CTAs
 * link to must exist as a `Product` row, otherwise a direct visit to
 * `/store/<slug>` returns "Product not found" while the marketing surfaces
 * keep linking there.
 *
 * PRICES ARE MXN, DERIVED (T2-4). Each product carries `priceUsd` and the row
 * price is priceUsd * MXN_PER_USD. The figures were authored as USD but the
 * seed wrote them into a column the whole platform reads as MXN, so a toolkit
 * authored at 10 was on sale for 10 pesos — about USD 0.50, less than the
 * payment-processing fee on the transaction. MXN is kept rather than switching
 * the column to USD: it is the schema default, IVA and CFDI are computed in
 * it, and a mixed-currency cart would reach the order and refund paths.
 * assertPlausiblePrices() below refuses to seed an implausible figure.
 *
 * Re-running upserts by slug — admin price/title edits are preserved across
 * re-runs because we only set columns we own here.
 *
 * Usage:
 *   node prisma/seed/products-seed.js
 */

const prisma = require("../../src/lib/prisma")

const { assertLocalDatabase } = require("../../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed/products-seed.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("products-seed.js")

/* The store's unit is a downloadable file. Three rows here were services in
 * a product's clothing — "Digital Transformation Consulting Session" (150),
 * "Website & Digital System Setup" (300) and "IT Infrastructure Audit" (120)
 * — sold through the store checkout like a PDF: no call, no proposal, no
 * scope, and priced more than an order of magnitude under the catalogue
 * offerings describing the same work. Removed (T2-4). The consulting session
 * is now the free discovery call at /book; the other two are ServicePackage
 * rows under their category, in prisma/seed/services-seed.js.
 */

// The catalogue's own basis: USD 30/hour at a flat 20 MXN/USD, not live FX.
// Same constant as web/src/data/servicesCatalogue.js.
const MXN_PER_USD = 20

const PRODUCTS = [
  {
    slug: "digital-transformation-starter-toolkit",
    title: "Digital Transformation Starter Toolkit",
    category: "IT Toolkits",
    shortDescription: "Practical templates to guide digital planning and implementation.",
    description:
      "A structured toolkit designed to help organizations assess digital maturity, define priorities, and organize implementation steps with practical templates and planning resources.",
    titleEs: "Kit inicial de transformación digital",
    shortDescriptionEs:
      "Plantillas prácticas para planear y ejecutar tu transformación digital.",
    descriptionEs:
      "Un kit estructurado para evaluar la madurez digital de tu organización, definir prioridades y ordenar los pasos de implementación, con plantillas y recursos de planeación listos para usar.",
    priceUsd: 10,
    isFeatured: true,
  },
  {
    slug: "weekly-content-calendar",
    title: "Weekly Content Calendar for Creators",
    category: "Templates",
    shortDescription: "A structured planning resource for consistent digital publishing.",
    description:
      "A practical planning template for organizing weekly content production, publishing priorities, and campaign coordination across digital platforms.",
    titleEs: "Calendario de contenido semanal para creadores",
    shortDescriptionEs: "Un recurso de planeación para publicar con constancia.",
    descriptionEs:
      "Una plantilla práctica para organizar la producción de contenido semanal, las prioridades de publicación y la coordinación de campañas entre plataformas digitales.",
    priceUsd: 12,
    isFeatured: true,
  },
  {
    slug: "stem-program-planning-pack",
    title: "STEM Program Planning Pack",
    category: "Training",
    shortDescription: "Organized teaching resources for coding and robotics initiatives.",
    description:
      "A practical education-focused resource that helps schools and trainers design structured STEM, coding, and robotics activities with implementation guidance.",
    titleEs: "Paquete de planeación de programas STEM",
    shortDescriptionEs:
      "Recursos didácticos organizados para iniciativas de programación y robótica.",
    descriptionEs:
      "Materiales de planeación para diseñar y poner en marcha programas de programación y robótica: secuencias de contenidos, necesidades de equipamiento y criterios de evaluación para el aula.",
    priceUsd: 18,
    isFeatured: true,
  },
  {
    slug: "school-it-audit-checklist",
    title: "School IT Audit Checklist",
    category: "Operations",
    shortDescription: "A ready-to-use checklist for reviewing infrastructure and systems.",
    description:
      "A structured checklist for schools and educational institutions to review infrastructure, devices, connectivity, access, security, and operational technology readiness.",
    titleEs: "Lista de verificación para auditoría de TI escolar",
    shortDescriptionEs:
      "Una lista práctica para revisar la infraestructura y los sistemas del colegio.",
    descriptionEs:
      "Una lista de verificación aplicable para revisar el estado de la infraestructura, los accesos, los respaldos y los sistemas escolares, con espacio para registrar hallazgos y prioridades de remediación.",
    priceUsd: 15,
    isFeatured: false,
  },
  {
    slug: "website-launch-planning-kit",
    title: "Website Launch Planning Kit",
    category: "Business Systems",
    shortDescription: "A clean framework for planning and structuring web projects.",
    description:
      "A planning kit for individuals and organizations launching modern websites, including structure mapping, content planning, delivery checkpoints, and quality review templates.",
    titleEs: "Kit de planeación para lanzar un sitio web",
    shortDescriptionEs: "Un marco claro para planear y estructurar proyectos web.",
    descriptionEs:
      "Un marco de trabajo para planear un sitio web de principio a fin: arquitectura de la información, contenidos necesarios, requisitos técnicos y la lista de lo que debe estar listo antes de publicar.",
    priceUsd: 14,
    isFeatured: true,
  },
  {
    slug: "digital-workflow-optimization-pack",
    title: "Digital Workflow Optimization Pack",
    category: "Consulting",
    shortDescription: "Templates and guidance for improving digital efficiency.",
    description:
      "A consulting-style digital resource for identifying friction points, mapping workflows, and improving efficiency through better structure and modern digital practices.",
    titleEs: "Paquete de optimización de flujos de trabajo",
    shortDescriptionEs:
      "Plantillas y guía para mejorar la eficiencia de tus procesos digitales.",
    descriptionEs:
      "Plantillas y guía para mapear los procesos que ya tienes, encontrar los pasos que se repiten o se duplican, y rediseñarlos apoyándote en las herramientas digitales que ya pagas.",
    priceUsd: 16,
    isFeatured: false,
  },
]

/**
 * A downloadable product under MXN 50 is not a price, it is a unit mix-up —
 * the exact one this seed shipped with. Refuse to write it rather than
 * discovering it on a live storefront.
 */
function assertPlausiblePrices() {
  const MIN_MXN = 50
  const bad = PRODUCTS
    .map((p) => ({ slug: p.slug, mxn: p.priceUsd * MXN_PER_USD }))
    .filter((p) => !Number.isFinite(p.mxn) || p.mxn < MIN_MXN)
  if (!bad.length) return
  const detail = bad.map((p) => `${p.slug}: MXN ${p.mxn}`).join("; ")
  throw new Error(
    `products-seed: ${bad.length} product(s) priced below MXN ${MIN_MXN}. ` +
    `Prices are authored in USD and multiplied by ${MXN_PER_USD}; a figure this ` +
    `low means a USD amount was written straight into the MXN column. ${detail}`,
  )
}

async function seedProducts() {
  assertPlausiblePrices()

  let created = 0
  let updated = 0

  for (const p of PRODUCTS) {
    const data = {
      title: p.title,
      category: p.category,
      shortDescription: p.shortDescription,
      description: p.description,
      titleEs: p.titleEs || null,
      shortDescriptionEs: p.shortDescriptionEs || null,
      descriptionEs: p.descriptionEs || null,
      price: p.priceUsd * MXN_PER_USD,
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
        // Spanish is refreshed on re-seed. The price deliberately is not —
        // an admin may have edited it — but nobody hand-edits translations
        // in the admin, so leaving these out would mean a corrected
        // translation could never reach a database that already has the row.
        titleEs: data.titleEs,
        shortDescriptionEs: data.shortDescriptionEs,
        descriptionEs: data.descriptionEs,
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
