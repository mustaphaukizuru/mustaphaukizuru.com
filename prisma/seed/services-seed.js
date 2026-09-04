/**
 * Services seed — the four catalogue categories that back /services/:slug,
 * their feature lists, and the two engagements that used to be sold as store
 * products (T2-4).
 *
 * The closed set of four lives in web/src/data/servicesCatalogue.js; the slugs
 * here match it, and the booking flow resolves /book?service=<slug> against
 * these rows. The pre-catalogue taxonomy it originally imported from
 * sitePagesData.js is gone — see the note where that array used to be.
 *
 * Idempotent: re-running updates existing rows by slug, doesn't duplicate.
 * Safe to run against production after B05 ships.
 *
 * Usage:
 *   node prisma/seed/services-seed.js
 */

const prisma = require("../../src/lib/prisma")

const { assertLocalDatabase } = require("../../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed/services-seed.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("services-seed.js")

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

/* ────────────────────────────────────────────────────────────────────────────
 * The legacy SERVICES array lived here (T2-4).
 *
 * Four rows from the taxonomy that preceded the closed set of four catalogue
 * categories: branding-digital-presence, digital-transformation-consulting,
 * it-infrastructure and cloud-migration-automation, each with three USD price
 * tiers. They were published, so the public listing served eight services
 * against a catalogue of four, at prices nothing else in the site agreed with
 * — and they were the only rows in the table denominated in USD.
 *
 * Removed so re-seeding cannot resurrect them. The rows already in a database
 * are retired separately, by scripts/retire-legacy-services.js, which soft
 * deletes rather than deleting: ServiceOrder rows reference all four, and
 * removing the service would take the order history with it.
 * ──────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
 * Funnel categories · roadmap step 25 (docs/SERVICE_CATALOGUE_2026-08.md)
 *
 * One `Service` row per catalogue category. Slugs are stable and match
 * web/src/data/servicesCatalogue.js CATEGORIES[].slug — they back
 * /services/:slug and the booking flow (/book?service=<slug> → serviceId).
 * Upserted by slug; older rows above are left untouched. No packages: the
 * bespoke work is call → proposal → invoice.
 * ──────────────────────────────────────────────────────────────────────────── */

/* ── The two engagements that used to be sold as store products (T2-4) ─────
 * `website-system-setup` (300) and `infrastructure-audit` (120) sat in
 * products-seed.js as digital products, so they went through the store
 * checkout like a downloadable PDF: no call, no proposal, no scope. They are
 * services, and at those figures they undercut the catalogue offerings that
 * describe the same work by more than an order of magnitude.
 *
 * They become ServicePackage rows under the category that owns the work,
 * priced at the floor of the cheapest FIXED offering in that category so they
 * no longer undercut it — MXN 15,000 (Software Stack Audit, 2-3 weeks) and
 * MXN 18,000 (Interactive UI/UX Wireframing, 1-2 weeks) in
 * web/src/data/servicesCatalogue.js. Both figures follow the file's own
 * pricing basis: USD 30/hour at a flat 20 MXN/USD.
 *
 * OWNER: these are price changes, from 120 to 15,000 and 300 to 18,000 MXN.
 * They only reach a database when a seed is run, and the guard blocks any
 * non-local host. Confirm the figures before seeding production.
 *
 * The third store product, `consulting-session-package` (150), has no
 * replacement on purpose: the discovery call is free and lives at /book.
 * ───────────────────────────────────────────────────────────────────────── */
const MIGRATED_PACKAGES = {
  "it-strategy-consulting": [
    {
      name: "IT Infrastructure Audit",
      description: "A structured review of infrastructure condition, system organisation, access, operational gaps and modernisation opportunities. Delivered as a written report with a prioritised remediation list.",
      price: 15000,
      sortOrder: 0,
    },
  ],
  "digital-product-engineering": [
    {
      name: "Website & Digital System Setup",
      description: "Define or rebuild website structure, connected digital systems and the integrated user journey. Includes information architecture, the build, and handover with credentials transferred.",
      price: 18000,
      sortOrder: 0,
    },
  ],
}

const FUNNEL_CATEGORIES = [
  {
    slug: "it-strategy-consulting",
    title: "IT Strategy Consulting",
    titleEs: "Consultoría Estratégica de TI",
    shortDescription: "Cut wasted software spend and get a clear, sequenced technology roadmap your team can execute.",
    shortDescriptionEs: "Reduce el gasto desperdiciado en software y obtén una hoja de ruta tecnológica clara y secuenciada que tu equipo pueda ejecutar.",
    fullDescription: "Software stack audit, fractional CTO engagement, vendor evaluation and RFP, digital transformation roadmap, compliance and risk assessment (LFPDPPP).",
    features: ["Software Stack Audit", "Fractional CTO Engagement", "Vendor Evaluation & RFP", "Digital Transformation Roadmap", "Compliance & Risk Assessment"],
  },
  {
    slug: "ai-automation",
    title: "AI Integration & Workflow Automation",
    titleEs: "Integración con IA y Automatización de Flujos de Trabajo",
    shortDescription: "Answer customers faster, sync leads automatically, and turn documents into clean data without adding headcount.",
    shortDescriptionEs: "Responde a clientes más rápido, sincroniza prospectos automáticamente y convierte documentos en datos limpios sin contratar más personal.",
    fullDescription: "Custom persona bots, WhatsApp lead qualifiers, cross-platform API pipelines (Make / Zapier), internal RAG knowledge base, data extraction workflows.",
    features: ["Custom Persona Bots", "WhatsApp Lead Qualifiers", "Cross-Platform API Pipelines", "Internal RAG Knowledge Base", "Data Extraction Workflows"],
  },
  {
    slug: "cloud-architecture-migration",
    title: "Cloud Architecture & Infrastructure Migration",
    titleEs: "Arquitectura en la Nube y Migración de Infraestructura",
    shortDescription: "Retire the office server, cut your cloud bill, and know your backups actually restore.",
    shortDescriptionEs: "Retira el servidor de la oficina, reduce la factura en la nube y confirma que tus respaldos realmente restauran.",
    fullDescription: "On-premise to cloud migration (AWS, Azure, GCP), cloud bill optimisation, disaster recovery planning, Docker and containerisation, zero-trust security hardening.",
    features: ["On-Premise to Cloud Migration", "Cloud Bill Optimisation", "Disaster Recovery Planning", "Docker & Containerisation", "Zero-Trust Security Hardening"],
  },
  {
    slug: "digital-product-engineering",
    title: "End-to-End Digital Product Engineering",
    titleEs: "Ingeniería de Producto Digital de Extremo a Extremo",
    shortDescription: "Validate before you build, ship an MVP in weeks, and keep it patched and improving every month.",
    shortDescriptionEs: "Valida antes de construir, publica un MVP en semanas y mantenlo parchado y mejorando cada mes.",
    fullDescription: "Interactive UI/UX wireframing, MVP web app development, cross-platform mobile apps, secure API design, CI/CD pipeline automation, managed maintenance.",
    features: ["Interactive UI/UX Wireframing", "MVP Web App Development", "Cross-Platform Mobile Apps", "Secure API Design", "CI/CD Pipeline Automation", "Managed Maintenance"],
  },
]

async function seedFunnelCategories() {
  for (const c of FUNNEL_CATEGORIES) {
    console.log(`  → ${c.slug} (funnel category)`)
    const data = {
      title:              c.title,
      titleEs:            c.titleEs,
      slug:               c.slug,
      shortDescription:   c.shortDescription,
      shortDescriptionEs: c.shortDescriptionEs,
      fullDescription:    c.fullDescription,
      basePrice:          0,
      currency:           "MXN",
      deliveryType:       "Scheduled consulting",
      status:             "published",
      isFeatured:         true,
      isBookable:         true,
      bookingDurationMin: 30,
      metaTitle:          `${c.title} · Mustapha Ukizuru`,
      metaDescription:    c.shortDescription,
    }
    const service = await prisma.service.upsert({
      where:  { slug: c.slug },
      update: data,
      create: data,
    })
    await prisma.serviceFeature.deleteMany({ where: { serviceId: service.id } })
    await prisma.serviceFeature.createMany({
      data: c.features.map((text, idx) => ({ serviceId: service.id, featureText: text, sortOrder: idx })),
    })

    // Upsert by (serviceId, name) rather than wiping: a ServicePackage id may
    // already be referenced by a ServiceOrder, and those ids have to stay
    // stable. Same rule the retired legacy loop followed.
    for (const pkg of MIGRATED_PACKAGES[c.slug] || []) {
      const data = {
        description: pkg.description,
        price:       pkg.price,
        currency:    "MXN",
        isActive:    true,
        sortOrder:   pkg.sortOrder,
      }
      const existing = await prisma.servicePackage.findFirst({
        where: { serviceId: service.id, name: pkg.name },
      })
      if (existing) {
        await prisma.servicePackage.update({ where: { id: existing.id }, data })
      } else {
        await prisma.servicePackage.create({ data: { ...data, serviceId: service.id, name: pkg.name } })
      }
      console.log(`      + package ${pkg.name} (MXN ${pkg.price})`)
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Seeder
 * ──────────────────────────────────────────────────────────────────────────── */

async function seed() {
  console.log("[services-seed] Starting…")

  await seedFunnelCategories()

  // Report the three kinds separately. "published" alone counted the retired
  // rows and the audience-plan carriers too, so it said 11 while the site
  // showed 4 — the exact confusion T2-4 exists to remove.
  const [publicCount, carriers, retired] = await Promise.all([
    prisma.service.count({ where: { status: "published", deletedAt: null, audienceCode: null } }),
    prisma.service.count({ where: { deletedAt: null, audienceCode: { not: null } } }),
    prisma.service.count({ where: { deletedAt: { not: null } } }),
  ])
  console.log(`[services-seed] Done. ${publicCount} public service(s), ${carriers} audience-plan carrier(s), ${retired} retired.`)
}

seed()
  .catch((err) => {
    console.error("[services-seed] failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
