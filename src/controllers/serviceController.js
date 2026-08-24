const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const serviceService = require("../services/serviceService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const serviceOrderService = require("../services/serviceOrderService")

/**
 * GET /api/services
 * Query: ?page=&limit=&isFeatured=
 */
const listServices = asyncHandler(async (req, res) => {
  const { isFeatured, page, limit } = req.query

  const result = await serviceService.listServices({
      locale: resolveUserLocale({ req }),
    isFeatured,
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 24,
  })

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
  })
})

/**
 * GET /api/services/featured — up to 6 featured services
 */
const getFeatured = asyncHandler(async (req, res) => {
  const items = await serviceService.getFeaturedServices()
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=240")
  res.json({ success: true, data: items })
})

/**
 * GET /api/services/:slug
 * Returns the detailed service plus related services[].
 */
const getService = asyncHandler(async (req, res) => {
  const service = await serviceService.getServiceBySlug(req.params.slug, resolveUserLocale({ req }))
  if (!service) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Service not found" })
  }

  const related = await serviceService.getRelatedServices(service.id, 3)

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({
    success: true,
    data:    { ...service, related },
  })
})

/**
 * POST /api/services/:slug/order   (auth required)
 * Body: { packageId, requirements?, preferredStartDate?, customerName?, customerEmail? }
 */
const orderService = asyncHandler(async (req, res) => {
  const { slug } = req.params
  const { packageId, requirements, preferredStartDate, customerName, customerEmail } = req.body || {}

  if (!packageId) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "packageId is required",
    })
  }

  const result = await serviceOrderService.createServiceOrder({
    userId: req.user.id,
    slug,
    packageId,
    requirements,
    preferredStartDate,
    customerName,
    customerEmail,
  })

  res.status(201).json({
    success: true,
    message: "Service order created — we'll review it and confirm shortly",
    data:    result,
  })
})

/**
 * POST /api/services/order-by-tier   (soft-auth — guest checkout supported)
 * Body: { audience, tier, planName, priceUsd, currency?, customerName,
 *         customerEmail, requirements? }
 *
 * Auto-provisions Service + ServicePackage on first hit.
 */
const orderByTier = asyncHandler(async (req, res) => {
  const result = await serviceOrderService.orderByTier({
    audience:      req.body?.audience,
    tier:          req.body?.tier,
    planName:      req.body?.planName,
    // Accept both `price` (canonical, currency-agnostic) and the legacy
    // `priceUsd` field for backward-compat with any older clients.
    price:         req.body?.price ?? req.body?.priceUsd,
    currency:      req.body?.currency || "MXN",
    customerName:  req.body?.customerName,
    customerEmail: req.body?.customerEmail,
    requirements:  req.body?.requirements,
    userId:        req.user?.id || null,
  })
  res.status(201).json({
    success: true,
    message: "Service order created — proceed to payment",
    data:    result,
  })
})

/**
 * GET /api/services/audience-plans
 * Returns the audience pricing matrix (Professional / Business / Schools) in the
 * exact shape consumed by ServicesPage § Pricing — replacing the static
 * AUDIENCE_PRICING_PLANS catalogue once the seed-audience-plans script has run.
 *
 * Cached aggressively (60s) since this is a public read.
 */
const getAudiencePlans = asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({
    where:  { audienceCode: { not: null }, status: "published" },
    orderBy: { createdAt: "asc" },
    take:    100,
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      packages: {
        where:    { isActive: true },
        orderBy:  { sortOrder: "asc" },
        include:  { featureSlots: { select: { featureId: true } } },
      },
    },
  })

  // Shape into { audienceCode: { ...UI struct } } so the frontend can drop
  // it in as a near-direct replacement for AUDIENCE_PRICING_PLANS.
  const plans = {}
  for (const svc of services) {
    const code = svc.audienceCode
    const featureTexts = svc.features.map((f) => f.featureText)
    const featureIds   = svc.features.map((f) => f.id)

    const tiers = {}
    for (const pkg of svc.packages) {
      // tierKey is required to map this row back into the UI matrix.
      // If a row is missing tierKey, fall back to a slug of its name.
      const tierKey = pkg.tierKey || pkg.name.toLowerCase().replace(/\s+/g, "-")
      const includedSet = new Set(pkg.featureSlots.map((s) => s.featureId))
      const includes = featureIds.map((fid) => includedSet.has(fid))

      tiers[tierKey] = {
        id:        pkg.id,
        name:      pkg.name,
        price:     Number(pkg.price),
        currency:  pkg.currency,
        period:    pkg.period || "month",
        saveLabel: pkg.saveLabel,
        popular:   pkg.popular,
        cta:       "Choose Plan",
        includes,
      }
    }

    plans[code] = {
      id:           svc.id,
      code,
      name:         svc.title,
      slug:         svc.slug,
      description:  svc.shortDescription,
      features:     featureTexts,
      tiers,
    }
  }

  // Return in a stable order (professional → business → schools), matching
  // the existing AUDIENCE_PRICING_ORDER export. Unknown audiences appended.
  const KNOWN_ORDER = ["professional", "business", "schools"]
  const ordered = []
  for (const code of KNOWN_ORDER) if (plans[code]) ordered.push(code)
  for (const code of Object.keys(plans)) if (!KNOWN_ORDER.includes(code)) ordered.push(code)

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  return res.json({
    success: true,
    data:    { plans, order: ordered },
  })
})

module.exports = {
  listServices,
  getFeatured,
  getService,
  orderService,
  orderByTier,
  getAudiencePlans,
}
