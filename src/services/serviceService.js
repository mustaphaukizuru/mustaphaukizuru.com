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

async function listServicesUncached({ isFeatured, page = 1, limit = 24, locale = "en" } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))

  const where = { status: "published", deletedAt: null }
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
  const localized = items.map((row) => pickLocale(row, locale, [["fullDescription", "descriptionEs"]]))

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
    where: { slug, status: "published", deletedAt: null },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!service) return null
  // Same asymmetric extraPair as listServices — fullDescription ← descriptionEs.
  return serializeService(pickLocale(service, locale, [["fullDescription", "descriptionEs"]]))
}

async function getFeaturedServicesUncached() {
  const items = await prisma.service.findMany({
    where:   { status: "published", isFeatured: true, deletedAt: null },
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
    where:   { status: "published", deletedAt: null, id: { not: currentServiceId } },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    take:    limit,
    include: {
      features: { orderBy: { sortOrder: "asc" }, take: 3 },
      packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })
  return items.map(serializeService)
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

module.exports = {
  listServices,
  getServiceBySlug,
  getFeaturedServices,
  getRelatedServices,
  serializeService,
  listServicesUncached,
  getFeaturedServicesUncached,
}
