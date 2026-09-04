const express = require("express")

const healthRoutes = require("./healthRoutes")
const contactRoutes = require("./contactRoutes")
const clientLogoRoutes = require("./clientLogoRoutes")
const adminClientLogoRoutes = require("./adminClientLogoRoutes")
const productRoutes = require("./productRoutes")
const orderRoutes = require("./orderRoutes")
const invoiceRoutes = require("./invoiceRoutes")
const authRoutes = require("./authRoutes")
const paypalRoutes = require("./paypalRoutes")
const mercadoPagoRoutes = require("./mercadoPagoRoutes")
const downloadRoutes = require("./downloadRoutes")
const cartRoutes = require("./cartRoutes")
const couponRoutes = require("./couponRoutes")
const serviceRoutes = require("./serviceRoutes")
const reviewRoutes = require("./reviewRoutes")
const portfolioRoutes = require("./portfolioRoutes")
const newsletterRoutes = require("./newsletterRoutes")              // B07
const bioRoutes = require("./bioRoutes")                            // M12
const adminBioRoutes = require("./adminBioRoutes")                  // M12
const analyticsRoutes = require("./analyticsRoutes")                // M14
const adminAnalyticsRoutes = require("./adminAnalyticsRoutes")      // M14

const adminDashboardRoutes = require("./adminDashboardRoutes")
const adminProductRoutes = require("./adminProductRoutes")
const adminOrderRoutes = require("./adminOrderRoutes")
const adminDownloadRoutes = require("./adminDownloadRoutes")
const adminPaymentRoutes = require("./adminPaymentRoutes")
const adminCategoryRoutes = require("./adminCategoryRoutes")
const adminCouponRoutes = require("./adminCouponRoutes")
const adminContactRoutes = require("./adminContactRoutes")
const adminUserRoutes = require("./adminUserRoutes")
const adminSupportRoutes = require("./adminSupportRoutes")
const adminEmailTemplatesRoutes = require("./adminEmailTemplatesRoutes")
const adminEmailLogRoutes = require("./adminEmailLogRoutes")         // B07
const adminNewsletterRoutes = require("./adminNewsletterRoutes")      // B07
const adminMediaRoutes = require("./adminMediaRoutes")
const adminServiceOrdersRoutes = require("./adminServiceOrdersRoutes")
const adminServiceRoutes = require("./adminServiceRoutes")
const adminPortfolioRoutes = require("./adminPortfolioRoutes")
const adminAuditRoutes = require("./adminAuditRoutes")
const adminReviewRoutes = require("./adminReviewRoutes")

// Booking calendar (availability rules, exceptions, consultations)
const availabilityRoutes      = require("./availabilityRoutes")
const consultationRoutes      = require("./consultationRoutes")
const adminAvailabilityRoutes = require("./adminAvailabilityRoutes")

const notificationRoutes = require("./notificationRoutes")
const supportRoutes = require("./supportRoutes")
const profileRoutes = require("./profileRoutes")
const memberServiceOrderRoutes = require("./memberServiceOrderRoutes")
const addressRoutes = require("./addressRoutes")                      // B08

// Priority #8 · Client project management (milestones + files)
const adminClientProjectRoutes  = require("./adminClientProjectRoutes")
const adminInvoiceRoutes = require("./adminInvoiceRoutes")
const memberClientProjectRoutes = require("./memberClientProjectRoutes")
const portalRoutes              = require("./portalRoutes")           // Tier 4 — magic-link + PIN portal

// M15 · Refunds — admin orchestrator + member-side visibility
const adminRefundRoutes  = require("./adminRefundRoutes")
const memberRefundRoutes = require("./memberRefundRoutes")

// M16 · Blog — public read + admin CRUD
const blogRoutes        = require("./blogRoutes")
const adminBlogRoutes   = require("./adminBlogRoutes")
const diagnosticRoutes  = require("./diagnosticRoutes")   // Self-audit email gate

// M17 · Sessions admin
const adminSessionRoutes = require("./adminSessionRoutes")


// M19 · Marketing campaigns
const adminCampaignRoutes = require("./adminCampaignRoutes")
const adminLeadRoutes = require("./adminLeadRoutes")                // T3 — unified leads inbox

const router = express.Router()

// ═════════════════════════════════════════════════════════════════════════════
// B12 · API VERSIONING — /api/v1/* is now canonical
//
// Strategy: dual-mount EVERY route under both /api/<resource> (legacy) and
// /api/v1/<resource> (canonical). Legacy paths receive RFC 8594 deprecation
// headers so consumers know they're sunset on 2026-07-01.
//
// After the deprecation window ends (>= 30 days in production), drop the
// legacy mounts in a follow-up commit. The dual-mount window protects:
//   - Mobile/desktop clients that cache absolute API paths
//   - External integrations (Postman collections, partner APIs)
//   - SEO crawlers that have indexed /api/products/* URLs
//
// EXEMPT FROM DEPRECATION HEADERS (still dual-mounted):
//   - /paypal/webhook              — PayPal has the unversioned URL configured
//   - /mercadopago/webhook         — Mercado Pago has the unversioned URL configured
//   - /health                      — uptime monitors are configured against /api/health
//
// Logging deprecation warnings on these would create noise from systems we
// can't immediately update. Webhook providers will be migrated to /api/v1
// out-of-band before we drop the unversioned aliases.
// ═════════════════════════════════════════════════════════════════════════════

const SUNSET_DATE = "2026-07-01"

/**
 * Deprecation middleware (RFC 8594 + RFC 5988).
 *
 * Adds three headers so well-behaved API clients can detect they're using a
 * deprecated path and where to find the replacement:
 *
 *   Deprecation: true                   — RFC 8594 boolean signal
 *   Sunset: <RFC 1123 date>             — when the route disappears
 *   Link: </api/v1/...>; rel="successor-version"
 *
 * Plus emits a one-line console warning per request so the operator can spot
 * legacy callers in PM2 logs. (Production traffic will use the structured
 * winston logger via /api/v1/* once migrated; we don't want to fan out
 * winston entries on every legacy hit during the deprecation window.)
 */
const deprecationMiddleware = (req, res, next) => {
  res.setHeader("Deprecation", "true")
  res.setHeader("Sunset", SUNSET_DATE)
  // Build the successor URL. req.originalUrl gives us the exact path the
  // client sent (e.g. "/api/products?foo=bar"). We strip query strings,
  // then swap "/api/" for "/api/v1/" — the canonical replacement.
  //
  // Why not req.baseUrl + req.path? In nested Express routers the baseUrl
  // accumulates from the app level down (so it includes "/api"), which
  // would produce "/api/v1/api/products". originalUrl is unambiguous.
  const pathOnly = (req.originalUrl || "").split("?")[0]
  const successorPath = pathOnly.replace(/^\/api\//, "/api/v1/")
  res.setHeader("Link", `<${successorPath}>; rel="successor-version"`)
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1 — canonical mount point. New code should use these paths.
// ─────────────────────────────────────────────────────────────────────────────

const v1 = express.Router()

// Public
v1.use("/health",      healthRoutes)
v1.use("/products",    productRoutes)
v1.use("/services",        serviceRoutes)
v1.use("/reviews",         reviewRoutes)
v1.use("/portfolio",   portfolioRoutes)
v1.use("/newsletter",  newsletterRoutes)
v1.use("/client-logos", clientLogoRoutes)
v1.use("/bio",         bioRoutes)                                    // M12
v1.use("/analytics",   analyticsRoutes)                              // M14
v1.use("/coupons",     couponRoutes)
v1.use("/orders",      orderRoutes)
v1.use("/orders",      invoiceRoutes)
v1.use("/paypal",      paypalRoutes)
v1.use("/mercadopago", mercadoPagoRoutes)
v1.use("/auth",        authRoutes)
v1.use("/downloads",   downloadRoutes)
v1.use("/availability",  availabilityRoutes)        // Public read — slot listings
v1.use("/consultations", consultationRoutes)        // Member booking lifecycle
v1.use("/blog",          blogRoutes)                // M16 — Public blog list + detail
v1.use("/",              diagnosticRoutes)          // Self-audit: POST /diagnostic-submission + GET /admin/diagnostic
v1.use("/portal",        portalRoutes)              // Tier 4 — no-login client portal (magic link + emailed PIN)

// Admin
v1.use("/admin/dashboard",        adminDashboardRoutes)
v1.use("/admin/products",         adminProductRoutes)
v1.use("/admin/orders",           adminOrderRoutes)
v1.use("/admin/downloads",        adminDownloadRoutes)
v1.use("/admin/payments",         adminPaymentRoutes)
v1.use("/admin/categories",       adminCategoryRoutes)
v1.use("/admin/coupons",          adminCouponRoutes)
v1.use("/admin/users",            adminUserRoutes)
v1.use("/admin/support",          adminSupportRoutes)
v1.use("/admin/email-templates",  adminEmailTemplatesRoutes)
v1.use("/admin/email-logs",       adminEmailLogRoutes)
v1.use("/admin/newsletter",       adminNewsletterRoutes)
v1.use("/admin/media",            adminMediaRoutes)
v1.use("/admin/client-logos",     adminClientLogoRoutes)
v1.use("/admin/service-orders",   adminServiceOrdersRoutes)
v1.use("/admin/client-projects",  adminClientProjectRoutes)
v1.use("/admin/invoices",         adminInvoiceRoutes)             // Tier 4 — manual invoices + dunning
v1.use("/admin/services",         adminServiceRoutes)
v1.use("/admin/portfolio",        adminPortfolioRoutes)
v1.use("/admin/reviews",          adminReviewRoutes)
v1.use("/admin/audit",            adminAuditRoutes)
v1.use("/admin/contact-messages", adminContactRoutes)
v1.use("/admin/bio",              adminBioRoutes)                  // M12
v1.use("/admin/analytics",        adminAnalyticsRoutes)            // M14
v1.use("/admin",                  adminAvailabilityRoutes)        // Booking — admin manages rules/exceptions/consultations
v1.use("/admin",                  adminRefundRoutes)              // M15 — /admin/refunds + /admin/orders/:id/refund(-eligibility)
v1.use("/admin/blog",             adminBlogRoutes)                // M16 — Blog CRUD (posts + categories + tags)
v1.use("/admin/sessions",         adminSessionRoutes)             // M17 — Active sessions, revoke individual / revoke-all
v1.use("/admin/campaigns",        adminCampaignRoutes)            // M19 — Marketing email campaigns
v1.use("/admin/leads",            adminLeadRoutes)                // T3 — unified leads inbox

// Member
v1.use("/member/profile",         profileRoutes)
v1.use("/member/cart",            cartRoutes)
v1.use("/member/notifications",   notificationRoutes)
v1.use("/member/support",         supportRoutes)
v1.use("/member/service-orders",  memberServiceOrderRoutes)
v1.use("/member/projects",        memberClientProjectRoutes)
v1.use("/member/addresses",       addressRoutes)
v1.use("/member/orders",          memberRefundRoutes)             // M15 — /member/orders/:id/refunds

// Catch-all (contact + legacy newsletter POST handlers)
v1.use("/",                       contactRoutes)

router.use("/v1", v1)

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY (unversioned) — will be removed after 2026-07-01.
//
// Webhooks and health are mounted WITHOUT the deprecation middleware (see
// rationale above). Everything else gets the deprecation header injected.
// ─────────────────────────────────────────────────────────────────────────────

// Webhooks + health — exempt from deprecation headers (no sunset noise).
//
// PayPal's webhook is NOT mounted here — it lives at the app level (see
// src/app.js) where it can intercept the request BEFORE the global JSON
// parser. The previous narrow-exempt mount under "/paypal/webhook" stripped
// the path prefix, leaving paypalRoutes' inner "/webhook" route unreachable
// (the request became "" inside the sub-router). Keeping the comment so we
// don't reintroduce the same mount.
router.use("/health",                 healthRoutes)
// Mercado Pago's narrow mount was removed for the same reason AND because
// mounting the whole router under "/mercadopago/webhook" exposed
// /api/mercadopago/webhook/refund + /create-preference on a path the CSRF
// guard treats as a webhook. The webhook itself is served by the
// deprecated parent mount below (inner "/webhook") and by /api/v1.

// Public (deprecated) — order matters: webhook subroutes already mounted above
//
// We re-mount the parent paypalRoutes / mercadoPagoRoutes WITH the deprecation
// header. The narrow webhook mounts above match POST /paypal/webhook first
// (Express short-circuits on first matching middleware for a given path),
// while non-webhook paths under those prefixes fall through to the
// deprecated mount and pick up the headers.
router.use("/products",    deprecationMiddleware, productRoutes)
router.use("/services",        deprecationMiddleware, serviceRoutes)
router.use("/reviews",         deprecationMiddleware, reviewRoutes)
router.use("/portfolio",   deprecationMiddleware, portfolioRoutes)
router.use("/newsletter",  deprecationMiddleware, newsletterRoutes)
router.use("/bio",         deprecationMiddleware, bioRoutes)        // M12
router.use("/analytics",   deprecationMiddleware, analyticsRoutes)  // M14
router.use("/coupons",     deprecationMiddleware, couponRoutes)
router.use("/orders",      deprecationMiddleware, orderRoutes)
router.use("/orders",      deprecationMiddleware, invoiceRoutes)
router.use("/paypal",      deprecationMiddleware, paypalRoutes)
router.use("/mercadopago", deprecationMiddleware, mercadoPagoRoutes)
router.use("/auth",        deprecationMiddleware, authRoutes)
router.use("/downloads",   deprecationMiddleware, downloadRoutes)
router.use("/availability",  deprecationMiddleware, availabilityRoutes)
router.use("/consultations", deprecationMiddleware, consultationRoutes)

// Admin (deprecated)
router.use("/admin/dashboard",        deprecationMiddleware, adminDashboardRoutes)
router.use("/admin/products",         deprecationMiddleware, adminProductRoutes)
router.use("/admin/orders",           deprecationMiddleware, adminOrderRoutes)
router.use("/admin/downloads",        deprecationMiddleware, adminDownloadRoutes)
router.use("/admin/payments",         deprecationMiddleware, adminPaymentRoutes)
router.use("/admin/categories",       deprecationMiddleware, adminCategoryRoutes)
router.use("/admin/coupons",          deprecationMiddleware, adminCouponRoutes)
router.use("/admin/users",            deprecationMiddleware, adminUserRoutes)
router.use("/admin/support",          deprecationMiddleware, adminSupportRoutes)
router.use("/admin/email-templates",  deprecationMiddleware, adminEmailTemplatesRoutes)
router.use("/admin/email-logs",       deprecationMiddleware, adminEmailLogRoutes)
router.use("/admin/newsletter",       deprecationMiddleware, adminNewsletterRoutes)
router.use("/admin/media",            deprecationMiddleware, adminMediaRoutes)
router.use("/admin/service-orders",   deprecationMiddleware, adminServiceOrdersRoutes)
router.use("/admin/services",         deprecationMiddleware, adminServiceRoutes)
router.use("/admin/portfolio",        deprecationMiddleware, adminPortfolioRoutes)
router.use("/admin/reviews",          deprecationMiddleware, adminReviewRoutes)
router.use("/admin/audit",            deprecationMiddleware, adminAuditRoutes)
router.use("/admin/contact-messages", deprecationMiddleware, adminContactRoutes)
router.use("/admin/bio",              deprecationMiddleware, adminBioRoutes)        // M12
router.use("/admin/analytics",        deprecationMiddleware, adminAnalyticsRoutes)  // M14
router.use("/admin",                  deprecationMiddleware, adminAvailabilityRoutes)
router.use("/admin",                  deprecationMiddleware, adminRefundRoutes)              // M15 (legacy)

// Member (deprecated)
router.use("/member/profile",         deprecationMiddleware, profileRoutes)
router.use("/member/cart",            deprecationMiddleware, cartRoutes)
router.use("/member/notifications",   deprecationMiddleware, notificationRoutes)
router.use("/member/support",         deprecationMiddleware, supportRoutes)
router.use("/member/service-orders",  deprecationMiddleware, memberServiceOrderRoutes)
router.use("/member/addresses",       deprecationMiddleware, addressRoutes)
router.use("/member/orders",          deprecationMiddleware, memberRefundRoutes)             // M15 (legacy)

// Catch-all (deprecated) — mounted LAST so specific routes win
router.use("/", deprecationMiddleware, contactRoutes)

module.exports = router
