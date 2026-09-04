/* ════════════════════════════════════════════════════════════════════════
   prisma/seed-service-plans.js · Service + ServicePackage rows for the
   public pricing matrix (Professional / Business / Schools × Basic /
   Medium / Advanced).
   ────────────────────────────────────────────────────────────────────────
   WHY
     The public pages (PackagesStrip, ServicesCheckoutPage) read PRICES and
     tier availability from GET /api/v1/services/plans, which is backed by
     these rows. Marketing copy (names, descriptions, the feature matrix)
     stays in web/src/data/servicesCatalogue.js — it is i18n-rich and
     SEO-tuned and is NOT moved to the DB. The deprecated PackageFeatureSlot
     model is left untouched; the ✓/✗ feature matrix lives in the static file.

     orderByTier no longer auto-provisions rows at the client-supplied
     price — it 404s (PLAN_NOT_FOUND) until this seed has run.

   USAGE
     npm run seed:plans                           # local DB only (guarded)
     node scripts/backup-db-json.js && ALLOW_PROD_DB=1 npm run seed:plans

   BEHAVIOUR (idempotent, safe to re-run)
     · upsert one Service per audience  (slug "<audience>-plan", audienceCode,
       status published, deliveryType subscription)
     · upsert one ServicePackage per tier, matched by (serviceId, tierKey)
     · never deletes; extra rows an admin added by hand are left alone

   KEEP IN LOCKSTEP with AUDIENCE_PRICING_PLANS in
   web/src/data/servicesCatalogue.js (that file is an ES module that imports
   lucide-react, so it cannot be require()d from here). Only the pricing
   fields are mirrored: tier name / priceMxn / period / popular / saveLabel.
   ════════════════════════════════════════════════════════════════════════ */

const prisma = require("../src/lib/prisma")

const { assertLocalDatabase } = require("../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed-service-plans.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("seed-service-plans.js")

const CURRENCY = "MXN"
const AUDIENCE_ORDER = ["professional", "business", "schools"]
const TIER_ORDER = ["basic", "medium", "advanced"]

/* Mirror of servicesCatalogue.js → AUDIENCE_PRICING_PLANS[code].tiers */
const PLANS = {
  professional: {
    title:       "Professional Plan",
    description: "For consultants, freelancers, and solo professionals building a credible digital presence.",
    tiers: {
      basic:    { name: "Basic",    price:  5800, period: "month", popular: false, saveLabel: "Best to start" },
      medium:   { name: "Medium",   price: 11800, period: "month", popular: true,  saveLabel: "Save 20%" },
      advanced: { name: "Advanced", price: 19800, period: "month", popular: false, saveLabel: "All-inclusive" },
    },
  },
  business: {
    title:       "Business Plan",
    description: "For growing companies that need a complete digital operating system: brand, web, infrastructure, and operations.",
    tiers: {
      basic:    { name: "Basic",    price: 17800, period: "month", popular: false, saveLabel: "Launch-ready" },
      medium:   { name: "Medium",   price: 37800, period: "month", popular: true,  saveLabel: "Save 20%" },
      advanced: { name: "Advanced", price: 70000, period: "month", popular: false, saveLabel: "Enterprise-grade" },
    },
  },
  schools: {
    title:       "Schools Plan",
    description: "For schools, colleges, and training institutions modernizing teaching, learning, and operations end to end.",
    tiers: {
      basic:    { name: "Basic",    price: 24000, period: "month", popular: false, saveLabel: "Foundations" },
      medium:   { name: "Medium",   price: 48000, period: "month", popular: true,  saveLabel: "Save 20%" },
      advanced: { name: "Advanced", price: 90000, period: "month", popular: false, saveLabel: "Whole-institution" },
    },
  },
}

async function upsertService(audienceCode, plan) {
  const slug = `${audienceCode}-plan`
  const data = {
    title:            plan.title,
    shortDescription: plan.description,
    basePrice:        plan.tiers.basic.price,
    currency:         CURRENCY,
    deliveryType:     "subscription",
    status:           "published",
    audienceCode,
    deletedAt:        null,
  }
  return prisma.service.upsert({
    where:  { slug },
    update: data,
    create: { slug, ...data },
  })
}

async function upsertPackage(serviceId, tierKey, tier, sortOrder) {
  const data = {
    name:      tier.name,
    price:     tier.price,
    currency:  CURRENCY,
    period:    tier.period,
    popular:   Boolean(tier.popular),
    saveLabel: tier.saveLabel,
    isActive:  true,
    sortOrder,
    tierKey,
  }
  // (serviceId, tierKey) is not a unique key in the schema, so find-then-write.
  const existing = await prisma.servicePackage.findFirst({
    where:   { serviceId, tierKey },
    orderBy: { createdAt: "asc" },
    select:  { id: true },
  })
  if (existing) return prisma.servicePackage.update({ where: { id: existing.id }, data })
  return prisma.servicePackage.create({ data: { serviceId, ...data } })
}

async function main() {
  console.log("[seed-service-plans] starting…")
  for (const audience of AUDIENCE_ORDER) {
    const plan = PLANS[audience]
    const service = await upsertService(audience, plan)
    console.log(`[seed-service-plans] · ${service.slug}`)
    for (let i = 0; i < TIER_ORDER.length; i += 1) {
      const tierKey = TIER_ORDER[i]
      const tier = plan.tiers[tierKey]
      await upsertPackage(service.id, tierKey, tier, i)
      console.log(`    ✓ ${tierKey.padEnd(9)} ${tier.price.toLocaleString("es-MX")} ${CURRENCY}/${tier.period}`)
    }
  }
  console.log("[seed-service-plans] done.")
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("[seed-service-plans] FAILED:", err)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}

module.exports = { PLANS, AUDIENCE_ORDER, TIER_ORDER, main }
