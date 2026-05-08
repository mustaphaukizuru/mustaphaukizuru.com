/**
 * Services seed — one-time import of the hardcoded consulting catalog from
 * web/src/data/sitePagesData.js into the Service/ServicePackage/ServiceFeature
 * tables.
 *
 * Idempotent: re-running updates existing rows by slug, doesn't duplicate.
 * Safe to run against production after B05 ships.
 *
 * Usage:
 *   node prisma/seed/services-seed.js
 */

const prisma = require("../../src/lib/prisma")

/* ────────────────────────────────────────────────────────────────────────────
 * Data — taken verbatim from web/src/data/sitePagesData.js (servicesCards +
 * servicePricing), reshaped into the DB schema.
 *
 * Each service gets:
 *   - slug              (stable — used in URLs)
 *   - title
 *   - shortDescription  (from servicesCards.description)
 *   - fullDescription   (longer marketing copy)
 *   - deliveryType      (Scheduled consulting | Fixed-scope project)
 *   - features[]        (list of bullet points for the page)
 *   - packages[]        (3 price tiers: Starter / Professional / Advanced)
 * ──────────────────────────────────────────────────────────────────────────── */

const SERVICES = [
  {
    slug:  "branding-digital-presence",
    title: "Branding & Digital Presence",
    shortDescription:
      "Build a professional digital identity with modern websites, brand systems, and online platforms that strengthen your organization's visibility.",
    fullDescription:
      "We design and ship cohesive brand identities — logo systems, typography, color, and voice — alongside the websites and digital platforms that carry them. The outcome is a clear, confident presence across every surface where your customers find you.",
    deliveryType: "Scheduled consulting",
    isFeatured:   true,
    metaTitle:    "Branding & Digital Presence · Mustapha Ukizuru",
    metaDescription:
      "Modern brand systems, websites, and digital platforms for professionals, SMEs, and schools.",
    features: [
      "Brand identity audit and strategy",
      "Logo, typography, and color system design",
      "Website and landing-page planning",
      "Social and content-template design",
      "Brand guidelines and hand-off documentation",
    ],
    packages: [
      { name: "Starter",      price: 79,  description: "Perfect for individuals beginning their digital journey.",           sortOrder: 0 },
      { name: "Professional", price: 249, description: "Ideal for professionals building stronger digital systems.",         sortOrder: 1 },
      { name: "Advanced",     price: 499, description: "For professionals scaling their digital presence.",                  sortOrder: 2 },
    ],
  },
  {
    slug:  "digital-transformation-consulting",
    title: "Digital Transformation Consulting",
    shortDescription:
      "Expert guidance to modernize workflows, adopt new technologies, and create a clear roadmap for digital innovation.",
    fullDescription:
      "A structured engagement that audits your current operations, identifies digital-transformation opportunities, and delivers a sequenced roadmap — from quick wins to platform-level change. Engagements typically run 4–12 weeks depending on scope.",
    deliveryType: "Fixed-scope project",
    isFeatured:   true,
    metaTitle:    "Digital Transformation Consulting · Mustapha Ukizuru",
    metaDescription:
      "Strategy, roadmaps, and implementation for organizations modernizing their operations.",
    features: [
      "Discovery workshop and stakeholder interviews",
      "Process and systems audit",
      "Opportunity prioritization matrix",
      "12-month transformation roadmap",
      "Change-management guidance",
      "Follow-up check-ins for 90 days",
    ],
    packages: [
      { name: "Business Starter",      price: 390,  description: "For small teams improving their digital systems.",                  sortOrder: 0 },
      { name: "Business Professional", price: 890,  description: "For growing businesses adopting digital infrastructure.",           sortOrder: 1 },
      { name: "Enterprise",            price: 1890, description: "For organizations undertaking full digital transformation.",       sortOrder: 2 },
    ],
  },
  {
    slug:  "it-infrastructure",
    title: "IT Infrastructure Setup & Management",
    shortDescription:
      "Design and manage secure networks, devices, and systems that keep your organization running efficiently.",
    fullDescription:
      "We design, deploy, and support the infrastructure that sits under your business — local networks, endpoint management, backups, and security baselines. Available as a one-time setup or an ongoing managed engagement.",
    deliveryType: "Managed service",
    isFeatured:   false,
    metaTitle:    "IT Infrastructure Setup & Management · Mustapha Ukizuru",
    metaDescription:
      "Secure networks, endpoint management, and backup strategy for SMEs and schools.",
    features: [
      "Network architecture and wireless design",
      "Endpoint management and security baselines",
      "Backup and disaster-recovery planning",
      "Vendor and procurement guidance",
      "Documentation and run-books",
    ],
    packages: [
      { name: "Essentials",  price: 490,  description: "Setup and baseline for small teams up to 10 users.",          sortOrder: 0 },
      { name: "Standard",    price: 1290, description: "For growing teams and single-site operations up to 50 users.", sortOrder: 1 },
      { name: "Managed",     price: 2490, description: "Ongoing managed service with monthly reviews.",               sortOrder: 2 },
    ],
  },
  {
    slug:  "cloud-migration-automation",
    title: "Cloud Migration & Automation",
    shortDescription:
      "Move systems to the cloud and automate processes to improve scalability, collaboration, and operational efficiency.",
    fullDescription:
      "We plan and execute cloud migrations — workspace and productivity platforms, data pipelines, and automation — with attention to cost, security, and the way your team actually works. Outcome: fewer manual handoffs, faster delivery, lower overhead.",
    deliveryType: "Fixed-scope project",
    isFeatured:   true,
    metaTitle:    "Cloud Migration & Automation · Mustapha Ukizuru",
    metaDescription:
      "Cloud adoption strategy, migration, and workflow automation for SMEs and schools.",
    features: [
      "Cloud-readiness and cost assessment",
      "Workspace and identity migration",
      "Data and storage migration plan",
      "Workflow automation design and build",
      "Post-migration support and training",
    ],
    packages: [
      { name: "Assessment",    price: 290,  description: "Cloud-readiness and opportunity review.",                    sortOrder: 0 },
      { name: "Migration",     price: 1490, description: "Executed migration for up to 30 users.",                     sortOrder: 1 },
      { name: "Automation",    price: 890,  description: "Workflow automation add-on (Zapier, Make, Power Automate).", sortOrder: 2 },
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────────
 * Seeder
 * ──────────────────────────────────────────────────────────────────────────── */

async function seed() {
  console.log("[services-seed] Starting…")

  for (const s of SERVICES) {
    console.log(`  → ${s.slug}`)

    const existing = await prisma.service.findUnique({ where: { slug: s.slug } })

    const baseData = {
      title:            s.title,
      slug:             s.slug,
      shortDescription: s.shortDescription,
      fullDescription:  s.fullDescription,
      basePrice:        s.packages[0]?.price ?? 0,
      currency:         "USD",
      deliveryType:     s.deliveryType,
      status:           "published",
      isFeatured:       Boolean(s.isFeatured),
      metaTitle:        s.metaTitle || null,
      metaDescription:  s.metaDescription || null,
    }

    const service = existing
      ? await prisma.service.update({ where: { id: existing.id }, data: baseData })
      : await prisma.service.create({ data: baseData })

    // Features — wipe & recreate so edits to the seed propagate cleanly.
    await prisma.serviceFeature.deleteMany({ where: { serviceId: service.id } })
    if (s.features?.length) {
      await prisma.serviceFeature.createMany({
        data: s.features.map((text, idx) => ({
          serviceId:   service.id,
          featureText: text,
          sortOrder:   idx,
        })),
      })
    }

    // Packages — upsert by (serviceId + name). Don't touch packages that have
    // linked ServiceOrders (their IDs must stay stable).
    for (const pkg of s.packages) {
      const existingPkg = await prisma.servicePackage.findFirst({
        where: { serviceId: service.id, name: pkg.name },
      })
      if (existingPkg) {
        await prisma.servicePackage.update({
          where: { id: existingPkg.id },
          data: {
            description: pkg.description,
            price:       pkg.price,
            currency:    "USD",
            isActive:    true,
            sortOrder:   pkg.sortOrder,
          },
        })
      } else {
        await prisma.servicePackage.create({
          data: {
            serviceId:   service.id,
            name:        pkg.name,
            description: pkg.description,
            price:       pkg.price,
            currency:    "USD",
            isActive:    true,
            sortOrder:   pkg.sortOrder,
          },
        })
      }
    }
  }

  const count = await prisma.service.count({ where: { status: "published" } })
  console.log(`[services-seed] Done. ${count} published service(s) in DB.`)
}

seed()
  .catch((err) => {
    console.error("[services-seed] failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
