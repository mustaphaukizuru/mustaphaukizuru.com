// ─────────────────────────────────────────────────────────────────────────────
// T3-4 · every path containing /admin needs BOTH guards, wherever it lives.
//
// test/adminRoutesGuard.test.js walks the files named adminXRoutes.js and
// asserts `protect`. That leaves two gaps, and both are the shape a real
// mistake takes:
//
//   1. an admin path declared in a route file that is not named admin* —
//      diagnosticRoutes.js serves /admin/diagnostic, and the payment routers
//      each expose an admin refund;
//   2. `protect` without `adminOnly`, which authenticates the caller and then
//      lets any signed-in member through.
//
// So this walks all 60-odd route files, finds every registered path with an
// /admin segment, and requires both middlewares on the chain. It also lists
// the deliberately public routes explicitly, so adding a new unauthenticated
// surface is a decision someone writes down rather than an omission.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({ user: { findUnique: jest.fn() } }))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn() }))

const fs = require("fs")
const path = require("path")
const { protect, adminOnly } = require("../src/middleware/authMiddleware")
const { portalAuth } = require("../src/middleware/portalAuth")

const ROUTES_DIR = path.join(__dirname, "..", "src", "routes")
const routeFiles = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith("Routes.js"))

const named = (fn) => (layer) => layer.handle === fn || layer.name === fn.name

/**
 * Every registered route in a router, with the middleware chain that guards
 * it — router-level `use` middlewares plus the route's own handlers.
 */
function collectRoutes(router) {
  const out = []
  const routerLevel = []
  for (const layer of router.stack || []) {
    if (!layer.route) {
      routerLevel.push(layer)
      continue
    }
    out.push({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((m) => m.toUpperCase()),
      chain: [...routerLevel, ...layer.route.stack],
    })
  }
  return out
}

const allRoutes = routeFiles.flatMap((file) => {
  let router
  try {
    router = require(path.join(ROUTES_DIR, file))
  } catch {
    return [] // index.js and friends that are not plain routers
  }
  if (!router || !Array.isArray(router.stack)) return []
  return collectRoutes(router).map((r) => ({ ...r, file }))
})

const adminRoutes = allRoutes.filter((r) => /(^|\/)admin(\/|$)/.test(r.path) || /(^|\/)admin(\/|$)/.test(`/${r.file}`))

describe("routes were actually loaded", () => {
  test("the walk found route files and registered paths", () => {
    expect(routeFiles.length).toBeGreaterThan(40)
    expect(allRoutes.length).toBeGreaterThan(100)
  })

  test("it found the admin paths that live outside the admin* files", () => {
    const outside = adminRoutes
      .filter((r) => !/^admin.*Routes\.js$/.test(r.file))
      .map((r) => `${r.file} ${r.path}`)
    // diagnosticRoutes.js serves /admin/diagnostic and /admin/diagnostic/ops.
    // If this list ever empties, the detection broke — not the codebase.
    expect(outside.length).toBeGreaterThan(0)
  })
})

describe("every /admin path carries protect and adminOnly", () => {
  test("no admin path is missing a guard", () => {
    const bad = adminRoutes
      .filter((r) => !r.chain.some(named(protect)) || !r.chain.some(named(adminOnly)))
      .map((r) => `${r.file}: ${r.methods.join(",")} ${r.path}`)
    expect(bad).toEqual([])
  })
})

describe("admin actions in the payment routers", () => {
  // These are the legacy shims that delegate to the refund orchestrator.
  // They are not under an /admin prefix, so the walk above cannot see them,
  // and an unguarded refund endpoint is the worst single hole in the app.
  test("the Mercado Pago and PayPal refund endpoints are admin-only", () => {
    for (const file of ["mercadoPagoRoutes.js", "paypalRoutes.js"]) {
      const refunds = collectRoutes(require(path.join(ROUTES_DIR, file)))
        .filter((r) => r.path.includes("refund"))
      expect(refunds.length).toBeGreaterThan(0)
      for (const r of refunds) {
        expect(r.chain.some(named(protect))).toBe(true)
        expect(r.chain.some(named(adminOnly))).toBe(true)
      }
    }
  })

  test("the webhooks stay unauthenticated — a gateway cannot send a session", () => {
    const hooks = collectRoutes(require(path.join(ROUTES_DIR, "mercadoPagoRoutes.js")))
      .filter((r) => r.path.includes("webhook"))
    expect(hooks.length).toBeGreaterThan(0)
    for (const r of hooks) expect(r.chain.some(named(protect))).toBe(false)

    // PayPal's webhook is NOT in its router: it needs the raw body for
    // signature verification, and a per-route express.raw is a no-op once
    // the global JSON parser has consumed the stream. It is mounted at the
    // app level ahead of that parser instead (src/app.js), which is why it
    // cannot be walked here.
    const appSrc = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8")
    expect(appSrc).toMatch(/paypal\/webhook/)
    expect(appSrc).toMatch(/express\.raw/)
  })
})

describe("the public surface is a written list, not an accident", () => {
  // A path is allowed to be unauthenticated only if it appears here. The
  // point is not the list's contents but that extending it takes a commit.
  const PUBLIC_PREFIXES = [
    "/", "/health", "/deep", "/jobs", "/status",
    "/products", "/services", "/portfolio", "/blog", "/reviews", "/categories",
    "/auth", "/login", "/signup", "/logout", "/google", "/facebook", "/microsoft",
    "/forgot-password", "/reset-password", "/verify-email", "/refresh", "/2fa", "/login-verify",
    "/contact", "/newsletter", "/subscribe", "/confirm", "/unsubscribe",
    "/webhook", "/webhooks", "/create-preference", "/create-order", "/capture", "/status/:orderId",
    "/analytics", "/track", "/event", "/pageview", "/vitals",
    "/portal", "/pin", "/verify", "/probe",
    "/diagnostic-submission", "/availability", "/slots", "/days",
    "/orders", "/cart", "/coupons", "/downloads", "/invoices", "/uploads", "/sitemap",
    "/plans", "/order-by-tier", "/service-orders", "/consultations", "/book",
    "/search", "/bio", "/client-logos", "/legal", "/og", "/robots",
    // Public read surfaces the marketing pages call directly.
    "/featured", "/meta", "/audience-plans", "/validate",
    "/experience", "/education", "/certificates", "/skills", "/cv.pdf", "/proof",
    // A consultation confirmation link carries its own single-use token.
    "/by-token",
  ]
  const isAllowedPublic = (p) =>
    PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(`${prefix}:`))

  test("every unauthenticated route is on the allowlist", () => {
    const unlisted = allRoutes
      .filter((r) => !r.chain.some(named(protect)) && !r.chain.some(named(portalAuth)))
      .filter((r) => !isAllowedPublic(r.path))
      .map((r) => `${r.file}: ${r.methods.join(",")} ${r.path}`)
    expect(unlisted).toEqual([])
  })
})
