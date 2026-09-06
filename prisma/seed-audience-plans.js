/* ════════════════════════════════════════════════════════════════════════
   prisma/seed-audience-plans.js · Idempotently seed audience pricing plans
   ────────────────────────────────────────────────────────────────────────
   Mirrors web/src/data/servicesCatalogue.js (AUDIENCE_PRICING_PLANS) into
   the database so admins can edit them via /admin/services. After running
   this once, the public Services page reads from the API and the static
   catalogue is used only as a fallback.

   Usage:
     node prisma/seed-audience-plans.js
     # or via npm script (see package.json):
     npm run seed:audience-plans

   Behaviour:
     · Find-or-create one Service per audience (slug = `<audience>-plan`)
     · Sync the ordered feature list (insert / update / remove as needed)
     · Find-or-create three Packages per service (Basic / Medium / Advanced)
     · Sync PackageFeatureSlot rows so the ✓ / ✗ matrix matches the catalogue
     · Safe to run repeatedly — no duplicate rows, no orphaned data.

   Requires:
     · Schema fields added in this PR: Service.audienceCode + ServicePackage
       (tierKey, period, popular, saveLabel) + model PackageFeatureSlot
     · `npx prisma db push && npx prisma generate` BEFORE running this seed
   ════════════════════════════════════════════════════════════════════════ */

const { PrismaClient } = require("@prisma/client")

const { assertLocalDatabase } = require("../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed-audience-plans.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("seed-audience-plans.js")
const prisma = new PrismaClient()

/* ── Source of truth — keep in lockstep with servicesCatalogue.js ──────────
   Prices are in MXN (Mexican Peso) — the platform's native currency. The
   `price` field below is what gets stored in ServicePackage.price.
   ─────────────────────────────────────────────────────────────────────── */
const CURRENCY = "MXN"

const PLANS = {
  professional: {
    name:        "Professional Plan",
    description: "For consultants, freelancers, and solo professionals building a credible digital presence.",
    features: [
      "Custom personal-brand identity and visual system",
      "Premium domain and production website (up to 8 pages)",
      "SEO architecture, schema markup, and search optimization",
      "Privacy-compliant analytics and conversion dashboards",
      "Email newsletter and automated lead-capture funnel",
      "Portfolio and case-study showcase pages",
      "Online booking and calendar integration",
      "Automated client-onboarding workflow",
      "Invoicing and payment-processor setup (PayPal + MercadoPago)",
      "AI-assisted content production system and prompt library",
      "Multi-platform social presence kit and templates",
      "Conversion-optimized landing pages and A/B testing",
      "Quarterly brand-strategy and positioning review",
      "Monthly performance, growth, and traffic report",
      "Priority email support, next-business-day response",
      "Dedicated 1:1 monthly strategy session",
    ],
    tiers: {
      basic:    { name: "Basic",    price:  5800, period: "month", saveLabel: "Best to start", popular: false, includes: [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
      medium:   { name: "Medium",   price: 11800, period: "month", saveLabel: "Save 20%",      popular: true,  includes: [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0] },
      advanced: { name: "Advanced", price: 19800, period: "month", saveLabel: "All-inclusive", popular: false, includes: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
    },
  },
  business: {
    name:        "Business Plan",
    description: "For growing companies that need a complete digital operating system — brand, web, infrastructure, and operations.",
    features: [
      "Custom corporate website with multi-language headless CMS",
      "Full brand identity and corporate visual system",
      "Branded email, professional domain, and DNS configuration",
      "CRM integration and contact-pipeline automation",
      "SEO program and inbound content strategy",
      "Marketing automation, nurture flows, and segmented campaigns",
      "Payment-processor integration (MercadoPago + PayPal + invoicing)",
      "E-commerce storefront, product catalog, and checkout funnel",
      "Customer-support helpdesk and ticket workflows",
      "Team collaboration, file-sharing, and intranet platform",
      "Identity and access management (SSO + MFA + RBAC)",
      "Cloud hosting with monitored uptime and CDN",
      "Automated backups, restores, and disaster-recovery runbooks",
      "Real-time analytics and business-intelligence dashboards",
      "Quarterly business review and strategic roadmap session",
      "Dedicated account manager and customer-success contact",
      "4-hour target on production-down incidents, business hours",
      "On-demand strategic advisory and architecture hours",
    ],
    tiers: {
      basic:    { name: "Basic",    price: 17800, period: "month", saveLabel: "Launch-ready",     popular: false, includes: [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
      medium:   { name: "Medium",   price: 37800, period: "month", saveLabel: "Save 20%",         popular: true,  includes: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0] },
      advanced: { name: "Advanced", price: 70000, period: "month", saveLabel: "Enterprise-grade", popular: false, includes: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
    },
  },
  schools: {
    name:        "Schools Plan",
    description: "For schools, colleges, and training institutions modernizing teaching, learning, and operations end to end.",
    features: [
      "LMS deployment, configuration, and content migration program",
      "Google Workspace for Education tenant setup and policies",
      "Smart classroom configuration and AV integration",
      "STEM lab, robotics, and maker-space curriculum implementation",
      "Faculty professional-development cohort (8 sessions)",
      "Student onboarding and digital-literacy curriculum",
      "Bilingual content library (English and Spanish)",
      "AI acceptable-use policy and ethics framework",
      "Parent and community engagement portal",
      "Attendance, gradebook, and SIS automation and integration",
      "Network security, content filtering, and CIPA compliance",
      "Device management for Chromebooks, iPads, and BYOD",
      "Data privacy audit and FERPA / GDPR compliance program",
      "Bilingual leadership development and admin training",
      "Quarterly board-level strategic review",
      "Six-month post-deployment administrative support",
      "Remote-first incident response; on-site by arrangement",
      "Innovation lab and maker-space program design",
    ],
    tiers: {
      basic:    { name: "Basic",    price: 24000, period: "month", saveLabel: "Foundations",         popular: false, includes: [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
      medium:   { name: "Medium",   price: 48000, period: "month", saveLabel: "Save 20%",            popular: true,  includes: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0] },
      advanced: { name: "Advanced", price: 90000, period: "month", saveLabel: "Whole-institution",   popular: false, includes: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
    },
  },
}

const AUDIENCE_ORDER = ["professional", "business", "schools"]

/* ── Helpers ──────────────────────────────────────────────────────────── */

async function upsertService(audienceCode, plan) {
  const slug = `${audienceCode}-plan`
  const existing = await prisma.service.findUnique({ where: { slug } })
  if (existing) {
    return prisma.service.update({
      where: { id: existing.id },
      data: {
        title:            plan.name,
        shortDescription: plan.description,
        deliveryType:     "subscription",
        status:           "published",
        currency:         CURRENCY,
        basePrice:        plan.tiers.basic.price,
        audienceCode,
      },
    })
  }
  return prisma.service.create({
    data: {
      slug,
      title:            plan.name,
      shortDescription: plan.description,
      basePrice:        plan.tiers.basic.price,
      currency:         CURRENCY,
      deliveryType:     "subscription",
      status:           "published",
      audienceCode,
    },
  })
}

/**
 * Synchronise the ordered feature list. Returns features keyed by sortOrder
 * so we can map tier.includes[] (boolean array, same length) → feature ids.
 */
async function syncFeatures(serviceId, featureTexts) {
  const existing = await prisma.serviceFeature.findMany({
    where: { serviceId }, orderBy: { sortOrder: "asc" },
  })

  const featuresBySortOrder = new Map()

  for (let i = 0; i < featureTexts.length; i += 1) {
    const text = featureTexts[i]
    const match = existing.find((f) => f.sortOrder === i)
    if (match) {
      const updated = await prisma.serviceFeature.update({
        where: { id: match.id }, data: { featureText: text },
      })
      featuresBySortOrder.set(i, updated)
    } else {
      const created = await prisma.serviceFeature.create({
        data: { serviceId, featureText: text, sortOrder: i },
      })
      featuresBySortOrder.set(i, created)
    }
  }

  // Remove any extras beyond the catalogue
  for (const f of existing) {
    if (f.sortOrder >= featureTexts.length) {
      await prisma.serviceFeature.delete({ where: { id: f.id } })
    }
  }

  return featuresBySortOrder
}

async function upsertPackage(serviceId, tierKey, tier, sortOrder) {
  const existing = await prisma.servicePackage.findFirst({
    where: { serviceId, tierKey },
  })
  const data = {
    serviceId,
    name:      tier.name,
    price:     tier.price,
    currency:  CURRENCY,
    isActive:  true,
    sortOrder,
    tierKey,
    period:    tier.period,
    popular:   Boolean(tier.popular),
    saveLabel: tier.saveLabel,
  }
  if (existing) return prisma.servicePackage.update({ where: { id: existing.id }, data })
  return prisma.servicePackage.create({ data })
}

async function syncFeatureSlots(packageId, includesArray, featuresBySortOrder) {
  const existing = await prisma.packageFeatureSlot.findMany({ where: { packageId } })
  const desiredFeatureIds = new Set(
    includesArray
      .map((flag, idx) => (flag ? featuresBySortOrder.get(idx)?.id : null))
      .filter(Boolean)
  )

  // Insert missing
  for (const featureId of desiredFeatureIds) {
    if (!existing.some((s) => s.featureId === featureId)) {
      await prisma.packageFeatureSlot.create({ data: { packageId, featureId } })
    }
  }
  // Remove obsolete
  for (const slot of existing) {
    if (!desiredFeatureIds.has(slot.featureId)) {
      await prisma.packageFeatureSlot.delete({ where: { id: slot.id } })
    }
  }
}

/* ── Main ─────────────────────────────────────────────────────────────── */

async function main() {
  console.log("[seed-audience-plans] starting…")

  for (let i = 0; i < AUDIENCE_ORDER.length; i += 1) {
    const audience = AUDIENCE_ORDER[i]
    const plan = PLANS[audience]
    console.log(`[seed-audience-plans] · ${audience}`)

    const service = await upsertService(audience, plan)
    const features = await syncFeatures(service.id, plan.features)

    const tierKeys = ["basic", "medium", "advanced"]
    for (let t = 0; t < tierKeys.length; t += 1) {
      const tk = tierKeys[t]
      const tier = plan.tiers[tk]
      const pkg = await upsertPackage(service.id, tk, tier, t)
      await syncFeatureSlots(pkg.id, tier.includes, features)
      console.log(`    ✓ ${tier.name.padEnd(8)} $${tier.price.toLocaleString("es-MX")} MXN`)
    }
  }

  console.log("[seed-audience-plans] done.")
}

main()
  .catch((err) => {
    console.error("[seed-audience-plans] FAILED:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
