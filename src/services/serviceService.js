const prisma = require("../lib/prisma")
const { pickLocale, pickLocaleMany } = require("../utils/pickLocale")

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function safeNum(value, fallback = 0) {
  if (value == null) return fallback
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatPrice(price, currency) {
  const ccy = (currency || "MXN").toUpperCase()
  const n = safeNum(price)
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: ccy,
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

/**
 * Serialize a Service row — coerces Decimal → Number, adds `priceFormatted`,
 * normalizes empty relations to empty arrays.
 */
/**
 * I18N06 · pickLocale is shallow: it swaps the service's own *Es columns but
 * not the nested packages (nameEs / descriptionEs). Localise both levels.
 */
function localizeService(row, locale = "en") {
  const base = pickLocale(row, locale, [["fullDescription", "descriptionEs"]])
  if (locale !== "es" || !Array.isArray(base.packages)) return base
  return { ...base, packages: pickLocaleMany(base.packages, "es") }
}

function serializeService(service) {
  if (!service) return null

  const packages = Array.isArray(service.packages)
    ? [...service.packages]
        .sort((a, b) => safeNum(a.sortOrder) - safeNum(b.sortOrder))
        .map((p) => ({
          id:             p.id,
          name:           p.name,
          description:    p.description || null,
          price:          safeNum(p.price),
          priceFormatted: formatPrice(p.price, p.currency),
          currency:       p.currency || service.currency || "MXN",
          isActive:       Boolean(p.isActive),
          sortOrder:      safeNum(p.sortOrder),
          tierKey:        p.tierKey   || null,
          period:         p.period    || null,
          popular:        Boolean(p.popular),
          saveLabel:      p.saveLabel || null,
          // I18N06 · Surface Spanish package metadata so the admin form can
          // hydrate both locales. Public clients also receive these — they're
          // harmless extras after pickLocale has already swapped `name`/
          // `description` to the Spanish values when locale === "es".
          nameEs:         p.nameEs        || null,
          descriptionEs:  p.descriptionEs || null,
          // featureSlots is included only when the caller requested the
          // relation (admin detail view). We pass it through verbatim so
          // the admin UI can render the inclusion checkboxes.
          featureSlots:   Array.isArray(p.featureSlots)
            ? p.featureSlots.map((s) => ({ id: s.id, featureId: s.featureId }))
            : undefined,
        }))
    : []

  const features = Array.isArray(service.features)
    ? [...service.features]
        .sort((a, b) => safeNum(a.sortOrder) - safeNum(b.sortOrder))
        .map((f) => ({
          id:          f.id,
          featureText: f.featureText,
          sortOrder:   safeNum(f.sortOrder),
        }))
    : []

  return {
    id:               service.id,
    title:            service.title,
    slug:             service.slug,
    shortDescription: service.shortDescription,
    fullDescription:  service.fullDescription || null,
    basePrice:        safeNum(service.basePrice),
    priceFormatted:   formatPrice(service.basePrice, service.currency),
    currency:         service.currency || "MXN",
    deliveryType:     service.deliveryType,
    status:           service.status,
    isFeatured:       Boolean(service.isFeatured),
    metaTitle:        service.metaTitle || null,
    metaDescription:  service.metaDescription || null,
    audienceCode:     service.audienceCode || null,
    createdAt:        service.createdAt,
    updatedAt:        service.updatedAt,
    // I18N06 · Spanish bilingual columns. Note the schema asymmetry: the
    // Spanish equivalent of `fullDescription` is stored as `descriptionEs`
    // (singular). We surface the raw column names so the admin form can
    // hydrate cleanly; pickLocale resolves the public swap separately.
    titleEs:            service.titleEs            || null,
    shortDescriptionEs: service.shortDescriptionEs || null,
    descriptionEs:      service.descriptionEs      || null,
    metaTitleEs:        service.metaTitleEs        || null,
    metaDescriptionEs:  service.metaDescriptionEs  || null,
    features,
    packages,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public reads
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * T2-4 · what counts as a public service.
 *
 * The Service table holds three different kinds of row:
 *
 *   1. the four catalogue categories — the closed set, the real /services/:slug
 *      pages (it-strategy-consulting, ai-automation, cloud-architecture-migration,
 *      digital-product-engineering);
 *   2. three audience-plan carriers, slug "<audience>-plan" with audienceCode
 *      set. These exist ONLY to hang the plan-matrix packages off; there is no
 *      page behind them;
 *   3. four retired rows from the pre-catalogue taxonomy, soft-deleted by
 *      scripts/retire-legacy-services.js.
 *
 * Only (1) is public, but every read below filtered on status and deletedAt
 * alone — so the listing served eleven rows against a closed set of four, and
 * /services/business-plan rendered as a service page with a plan carrier's
 * data behind it. audienceCode is the discriminator for (2); it is not a
 * "hide" flag, so listAudiencePlans below deliberately selects the opposite
 * and keeps working untouched.
 */
const PUBLIC_SERVICE_WHERE = { status: "published", deletedAt: null, audienceCode: null }

async function listServicesUncached({ isFeatured, page = 1, limit = 24, locale = "en" } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))

  const where = { ...PUBLIC_SERVICE_WHERE }
  if (isFeatured === true || isFeatured === "true") where.isFeatured = true

  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: {
        features: { orderBy: { sortOrder: "asc" }, take: 5 },
        packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.service.count({ where }),
  ])

  // I18N06 · Service has an asymmetric schema: the long-form Spanish copy is
  // stored as `descriptionEs` (no `description` sibling). The extraPair tells
  // pickLocale to swap `fullDescription` ← `descriptionEs` when locale is
  // "es", so the public service detail page renders Spanish copy without
  // leaking English.
  const localized = items.map((row) => localizeService(row, locale))

  return {
    items:      localized.map(serializeService),
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

async function getServiceBySlug(slug, locale = "en") {
  const service = await prisma.service.findFirst({
    where: { slug, ...PUBLIC_SERVICE_WHERE },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!service) return null
  // Same asymmetric extraPair as listServices — fullDescription ← descriptionEs.
  return serializeService(localizeService(service, locale))
}

async function getFeaturedServicesUncached() {
  const items = await prisma.service.findMany({
    where:   { ...PUBLIC_SERVICE_WHERE, isFeatured: true },
    orderBy: [{ updatedAt: "desc" }],
    take:    6,
    include: {
      features: { orderBy: { sortOrder: "asc" }, take: 3 },
      packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 3 },
    },
  })
  return items.map(serializeService)
}

/**
 * Related services — pulls up to 3 other published services, excluding the
 * current one. When we add categories in a future prompt we'll narrow this
 * by category; for now "related" means "other services".
 */
async function getRelatedServices(currentServiceId, limit = 3) {
  const items = await prisma.service.findMany({
    where:   { ...PUBLIC_SERVICE_WHERE, id: { not: currentServiceId } },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    take:    limit,
    include: {
      features: { orderBy: { sortOrder: "asc" }, take: 3 },
      packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })
  return items.map(serializeService)
}

/* ── Public pricing matrix — DB is the source of truth for prices ─────────
 * One Service per audience (slug "<audience>-plan", audienceCode set) with one
 * active ServicePackage per tier (tierKey). Seeded by prisma/seed-service-plans.js
 * (`npm run seed:plans`); edited in /admin/services. Marketing copy for the
 * same tiers lives in web/src/data/servicesCatalogue.js — the SPA overlays
 * these prices onto that static matrix by (audience, tierKey).
 * ─────────────────────────────────────────────────────────────────────────── */
const AUDIENCE_PLAN_ORDER = ["professional", "business", "schools"]

function serializePlanTier(p, fallbackCurrency) {
  return {
    packageId: p.id,
    tierKey:   p.tierKey,
    name:      p.name,
    price:     safeNum(p.price),
    currency:  p.currency || fallbackCurrency || "MXN",
    period:    p.period || null,
    popular:   Boolean(p.popular),
    saveLabel: p.saveLabel || null,
  }
}

async function listAudiencePlansUncached() {
  const services = await prisma.service.findMany({
    where: { audienceCode: { not: null }, status: "published", deletedAt: null },
    take:  50,
    select: {
      slug: true, audienceCode: true, currency: true,
      packages: {
        where:   { isActive: true, tierKey: { not: null } },
        orderBy: { sortOrder: "asc" },
        select:  {
          id: true, tierKey: true, name: true, price: true, currency: true,
          period: true, popular: true, saveLabel: true,
        },
      },
    },
  })

  const rank = (code) => {
    const i = AUDIENCE_PLAN_ORDER.indexOf(code)
    return i === -1 ? AUDIENCE_PLAN_ORDER.length : i
  }
  const audiences = services
    .sort((a, b) => rank(a.audienceCode) - rank(b.audienceCode) || a.slug.localeCompare(b.slug))
    .map((svc) => ({
      code:        svc.audienceCode,
      serviceSlug: svc.slug,
      tiers:       svc.packages.map((p) => serializePlanTier(p, svc.currency)),
    }))

  return { audiences }
}

/* ── A5 · in-process read cache ────────────────────────────────────────────
 * The public list reads are served from lib/ttlCache for PUBLIC_READ_TTL_MS per
 * distinct argument set, so a hot list costs one MySQL round-trip (~450 ms on
 * Hostinger) per TTL per process instead of one per request. Every function
 * above serialises before returning, so a cached value is a plain object and
 * sharing it across requests is safe. Any write to this namespace's models
 * clears it immediately (lib/cacheInvalidation.js), so admin edits are
 * visible on the next request regardless of TTL. The *Uncached originals
 * stay exported for callers that must bypass the cache.
 * ─────────────────────────────────────────────────────────────────────────── */
const { cache } = require("../lib/ttlCache")
// 0 under test: the unit suites assert one findMany per call and mock prisma
// per test, and a process-wide cache would silently hand test B the result
// of test A. A TTL of 0 makes cache.wrap call straight through.
const PUBLIC_READ_TTL_MS = process.env.NODE_ENV === "test" ? 0 : (Number(process.env.PUBLIC_READ_TTL_MS) || 60_000)
const listServices = (...args) => cache.wrap("services", args, PUBLIC_READ_TTL_MS, () => listServicesUncached(...args))
const getFeaturedServices = (...args) => cache.wrap("services", args, PUBLIC_READ_TTL_MS, () => getFeaturedServicesUncached(...args))
const listAudiencePlans = () => cache.wrap("services", ["audience-plans"], PUBLIC_READ_TTL_MS, () => listAudiencePlansUncached())

module.exports = {
  PUBLIC_SERVICE_WHERE,
  listServices,
  getServiceBySlug,
  getFeaturedServices,
  getRelatedServices,
  serializeService,
  listServicesUncached,
  getFeaturedServicesUncached,
  listAudiencePlans,
  listAudiencePlansUncached,
}
