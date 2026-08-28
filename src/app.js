BigInt.prototype.toJSON = function() { return this.toString() }

const express      = require("express")
const cookieParser = require("cookie-parser")
const compression  = require("compression")
const cors        = require("cors")
const helmet      = require("helmet")
const morgan      = require("morgan")
const path        = require("path")

const routes        = require("./routes")
const notFound      = require("./middleware/notFound")
const errorHandler  = require("./middleware/errorHandler")
const { clientUrl } = require("./config/env")
const { globalApiLimiter } = require("./middleware/rateLimiter")   // B10
const { STORAGE_PATHS } = require("./config/storagePaths")

// B11 · Sentry — initialisation lives in src/lib/sentry.js. That module
// returns `null` if @sentry/node isn't installed or SENTRY_DSN is unset,
// so the handlers below degrade silently. Init runs once at require time.
const Sentry = require("./lib/sentry")
// The SPA's @sentry/react client posts to the DSN host; CSP connect-src must
// allow it or every browser report is silently dropped (src/lib/sentryCsp.js).
const { sentryConnectSrc } = require("./lib/sentryCsp")

const app = express()

// ─────────────────────────────────────────────────────────────────────────────
// Trust proxy
// ─────────────────────────────────────────────────────────────────────────────
// Hostinger sits a reverse proxy in front of Node. Without trust proxy,
// req.ip would be 127.0.0.1 for every request — defeating per-IP rate
// limiting entirely. Setting to 1 trusts the immediate hop (the Hostinger
// proxy) and reads the originating IP from X-Forwarded-For. Do NOT set to
// `true` (trust all hops) — that would let a client spoof X-Forwarded-For.
app.set("trust proxy", 1)

// ─────────────────────────────────────────────────────────────────────────────
// B11 · Sentry request handler — must be FIRST in the middleware chain.
// Captures req/res context onto every event raised during the request cycle.
// Skipped silently if Sentry isn't initialized.
// ─────────────────────────────────────────────────────────────────────────────
if (Sentry?.Handlers?.requestHandler) {
  app.use(Sentry.Handlers.requestHandler())
} else if (Sentry?.expressIntegration) {
  // Sentry v8+ uses auto-instrumentation; no request handler needed.
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 40 · Cookie parsing — must sit ahead of every route that reads a
// cookie: the `mu_session` / `mu_csrf` session pair (utils/sessionCookie),
// the CSRF guard below, and the short-lived OAuth state/nonce cookies in
// authController. It only reads the `Cookie` header, so mounting it this
// early never interferes with the raw-body PayPal webhook further down.
// Unsigned — every cookie we set is either a JWT (self-authenticating) or a
// random CSRF nonce compared against a header, so a signing secret adds
// nothing.
// ─────────────────────────────────────────────────────────────────────────────
app.use(cookieParser())

// Compression
app.use(compression({ level: 6, threshold: 1024 }))

// Static uploads
// __dirname = mustaphaukizuru.com/src  →  ../public = mustaphaukizuru.com/public ✓
//
// Product + portfolio images have TWO sources behind one URL prefix: runtime
// admin uploads (storage/, persists across deploys) and seed images tracked
// in git (public/). Storage is mounted first; a miss falls through to public.
const immutableImageHeaders = (res) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "public, max-age=604800, immutable")
}
app.use("/images/products",  express.static(STORAGE_PATHS.productImages,   { maxAge: "7d", setHeaders: immutableImageHeaders }))
app.use("/images/portfolio", express.static(STORAGE_PATHS.portfolioImages, { maxAge: "7d", setHeaders: immutableImageHeaders }))
app.use("/images/products", express.static(path.join(__dirname, "../public/images/products"), {
  maxAge: "7d",
  setHeaders: immutableImageHeaders,
}))
// Avatars & media are user uploads — served from storage/ (persists across
// builds), NOT ../public (wiped by Vite emptyOutDir on every build). The URL
// prefix stays /images/* so existing database URLs keep resolving.
app.use("/images/avatars", express.static(STORAGE_PATHS.avatars, {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Disposition", "inline")
  },
}))
app.use("/images/media", express.static(STORAGE_PATHS.media, {
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}))

// CORS
const allowedOrigins = [
  clientUrl,
  "https://mustaphaukizuru.com",
  "https://www.mustaphaukizuru.com",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, process.env.NODE_ENV !== "production")
    return cb(null, allowedOrigins.includes(origin))
  },
  credentials: true,
}))

// ─────────────────────────────────────────────────────────────────────────────
// B10 · Security headers — extended CSP + HSTS preload + Referrer-Policy
// ─────────────────────────────────────────────────────────────────────────────
// T3 · Cloudflare Turnstile is opt-in: the widget (and its CSP allowance)
// only exist when the operator has configured the server-side secret.
const turnstileHosts = process.env.TURNSTILE_SECRET_KEY ? ["https://challenges.cloudflare.com"] : [];

app.use(helmet({
  crossOriginEmbedderPolicy: false,     // PayPal iframe requires this
  crossOriginOpenerPolicy:   false,
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'",
                    "https://accounts.google.com",
                    "https://www.paypal.com",
                    "https://www.paypalobjects.com",
                    "https://sdk.mercadopago.com",
                    "https://http2.mlstatic.com",
                    ...turnstileHosts],
      frameSrc:    ["'self'",                       // CSP · same-origin iframes (e.g. inline PDF certificates)
                    "https://accounts.google.com",
                    "https://www.paypal.com",
                    "https://www.mercadopago.com",
                    "https://www.mercadopago.com.br",
                    // Tier 2 · client-project live previews. Operator-declared
                    // origins only (PREVIEW_FRAME_HOSTS); everything else is a link.
                                        ...String(process.env.PREVIEW_FRAME_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean),
                    ...turnstileHosts],
      connectSrc:  ["'self'",
                    "https://accounts.google.com",
                    "https://oauth2.googleapis.com",
                    "https://api.mercadopago.com",
                    "https://www.paypal.com",
                    ...sentryConnectSrc(),
                    ...turnstileHosts],
      imgSrc:      ["'self'", "data:", "https:"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
      // PDF.js spawns its worker from a hashed same-origin URL emitted by
      // Vite at build time (e.g. /assets/pdf.worker-XXX.mjs). The explicit
      // worker-src directive prevents the fallback to script-src from being
      // ambiguous and adds `blob:` for libraries that bootstrap workers via
      // Blob URLs.
      workerSrc:   ["'self'", "blob:"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  strictTransportSecurity: {
    maxAge:            63072000,        // 2 years (preload requirement)
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}))

// Request id · FIRST, so every later middleware, controller, service and
// error handler runs inside this request's context and every log line they
// emit carries the same id (see lib/requestContext.js). Echoed back as
// X-Request-Id so a customer can quote it from the browser's network tab.
const { requestId } = require("./middleware/requestId")
app.use(requestId)

// Access logging · through Winston, not stdout.
//
// morgan used to print its own line to stdout while the application logged
// through Winston — two streams, no shared id, and on Hostinger only one of
// them ends up in a file. Routing morgan into logger.info puts the access
// line in the same JSON log as everything the request triggered, and the
// :id token plus the enricher in utils/logger.js mean the access line and
// the service lines it caused all share one requestId.
//
// Slow requests are flagged in the SAME line rather than a second one: the
// 2026-08-25 outage presented as every DB-backed route hanging, and a
// "slow=1" marker is what makes that pattern greppable after the fact.
const logger = require("./utils/logger")
morgan.token("id", (req) => req.id || "-")
morgan.token("slow", (req) => {
  // req.startedAt is stamped by the requestId middleware above.
  const ms = typeof req.startedAt === "number" ? Date.now() - req.startedAt : NaN
  return Number.isFinite(ms) && ms >= 1000 ? "1" : "0"
})
const accessFormat = process.env.NODE_ENV !== "production"
  ? "dev"
  : ":method :url :status :response-time ms :res[content-length]b id=:id slow=:slow"
app.use(morgan(accessFormat, {
  stream: { write: (line) => logger.info(line.trim()) },
  // Health probes every 15 minutes would otherwise dominate the access log.
  skip: (req) => req.path === "/api/v1/health" || req.path === "/api/health",
}))

// ─────────────────────────────────────────────────────────────────────────────
// PayPal webhook · RAW body for signature verification
//
// MUST be mounted BEFORE the global express.json() below. body-parser sets
// req._body = true once it consumes the stream, after which a per-route
// express.raw() is a silent no-op — a long-standing body-parser footgun.
// Mounting the webhook here gives PayPal's signature verifier a Buffer it
// can hash byte-for-byte against the transmission signature, while the rest
// of /api/* still gets the convenient parsed JSON below.
//
// Both /api/paypal/webhook (legacy) and /api/v1/paypal/webhook (canonical)
// are accepted — PayPal has the legacy URL configured in many dashboards,
// so we honor it without the deprecation noise the routes/index.js mount
// would otherwise tack on.
// ─────────────────────────────────────────────────────────────────────────────
const { webhook: paypalWebhookHandler } = require("./controllers/paypalController")
app.post(
  ["/api/paypal/webhook", "/api/v1/paypal/webhook"],
  express.raw({ type: "application/json", limit: "10mb" }),
  paypalWebhookHandler,
)

// Body parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ─────────────────────────────────────────────────────────────────────────────
// B11 · Sentry surface tag — every admin request gets `surface=admin` on
// the active scope so future errors are auto-tagged. No-op if Sentry isn't
// initialised. Must sit AFTER body parsing and BEFORE the routes mount so
// the tag is set when handlers throw.
// ─────────────────────────────────────────────────────────────────────────────
const { tagAdminSurface } = require("./middleware/sentryContext")
app.use(["/api/admin", "/api/v1/admin"], tagAdminSurface)

// ─────────────────────────────────────────────────────────────────────────────
// B10 · Global API rate limiter — 100 / 15 min / IP
// Mounted BEFORE routes so it covers everything under /api. Endpoint-specific
// limiters sit in front of individual routes and are ALSO checked.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Step 40 · CSRF guard — double-submit token.
//
// Mounted after cookie-parser and body parsing, and immediately before the
// API routes so every state-changing endpoint under /api is covered. It only
// engages when a `mu_session` cookie is present (ambient credentials);
// Bearer-token clients and the payment webhooks pass straight through. See
// middleware/csrf.js for the full exemption rationale.
//
// The raw-body PayPal webhook above is registered earlier in the chain and
// therefore never reaches this guard.
// ─────────────────────────────────────────────────────────────────────────────
const { csrfProtection } = require("./middleware/csrf")
app.use("/api", csrfProtection)

app.use("/api", globalApiLimiter, routes)

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic /sitemap.xml — mounted BEFORE express.static so it wins
// over the legacy file at public/sitemap.xml. Cached in-process for 1 hour.
// ─────────────────────────────────────────────────────────────────────────────
const { getSitemapXml } = require("./services/sitemapService")
app.get("/sitemap.xml", async (_req, res) => {
  try {
    const { xml } = await getSitemapXml()
    res.setHeader("Content-Type",  "application/xml; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=3600")
    res.status(200).send(xml)
  } catch (err) {
    console.error("[sitemap.xml] dynamic build failed, falling back:", err.message)
    res.status(200).sendFile(path.join(__dirname, "../public/sitemap.xml"))
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// RSS 2.0 feed — /feed.xml
// Cached in-process for 1 hour; rebuilt on first request after cache expires.
// Feed readers poll on their own schedule (typically 30–60 min), so the 1h
// TTL keeps DB load minimal while staying fresh enough for daily publishing.
// ─────────────────────────────────────────────────────────────────────────────
const { buildFeed } = require("./services/feedService")
let _feedCache = { xml: null, builtAt: 0 }
const FEED_TTL_MS = 60 * 60 * 1000 // 1 hour

app.get("/feed.xml", async (_req, res) => {
  try {
    const now = Date.now()
    if (!_feedCache.xml || now - _feedCache.builtAt > FEED_TTL_MS) {
      _feedCache = { xml: await buildFeed(), builtAt: now }
    }
    res.setHeader("Content-Type",  "application/rss+xml; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=3600")
    res.status(200).send(_feedCache.xml)
  } catch (err) {
    console.error("[feed.xml] build failed:", err.message)
    res.status(503).send("Feed temporarily unavailable")
  }
})

// SEO07 · Long-cache headers for hashed Vite assets + self-hosted fonts.
// Vite emits content-hashed filenames into /assets, and /fonts ships
// pinned variable-font filenames; both are safe to mark immutable for 1
// year. The precedence here matters — these specific static handlers must
// come BEFORE the catch-all `express.static(frontendPath, ...)` below so
// these routes win the directive.
app.use(
  "/assets",
  express.static(path.join(__dirname, "../public/assets"), {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
    },
  }),
)
app.use(
  "/fonts",
  express.static(path.join(__dirname, "../public/fonts"), {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      res.setHeader("X-Content-Type-Options", "nosniff")
    },
  }),
)

// Serve built React
const frontendPath = path.join(__dirname, "../public")

// SECURITY · block direct access to /files/projects/* — these are private
// project deliverables (signed contracts, consultancy reports, etc.) that
// must only be downloaded through the authenticated streaming endpoint at
// `GET /api/v1/member/projects/:id/files/:fileId/download` (member side)
// or the admin equivalent. Without this guard, the catch-all express.static
// below would happily serve the file to anyone with the URL.
app.use("/files/projects", (_req, res) => {
  res.status(403).json({
    success: false,
    error: {
      code:    "FORBIDDEN",
      message: "Direct file access is not permitted. Download through your project dashboard.",
    },
  })
})

app.use(express.static(frontendPath, {
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    // index.html AND the service-worker scripts must always be revalidated —
    // a cached sw.js pins the previous precache manifest (and its deleted
    // hashed chunks) for up to 24h after a deploy.
    if (filePath.endsWith("index.html") || /(?:^|[\\/])(?:sw|workbox-[\w-]+)\.js$/.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    }
  },
}))

// SEO · server-side OG/Twitter meta injection for shareable detail pages
// (/store/:slug, /blog/:slug, /services/:slug, /projects/:slug + /es/ mirror).
// Falls through to the SPA fallback below when the entity is not found.
const { createOgInjector } = require("./middleware/ogInjector")
const { matchesSpaRoute }  = require("./utils/spaRoutes")
app.get(/^\/(?!api).*/, createOgInjector({ indexPath: path.join(frontendPath, "index.html") }))

// React Router SPA fallback — known SPA routes get 200; anything else still
// renders the SPA (so its ErrorPage shows) but with a real 404 for crawlers.
app.get(/^\/(?!api).*/, (req, res) => {
  const known = matchesSpaRoute(req.path)
  res.status(known ? 200 : 404)
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
  res.sendFile(path.join(frontendPath, "index.html"))
})

// Error handling
app.use(notFound)

// B11 · Sentry error handler — must come BEFORE our errorHandler so it
// captures the raw exception, not the sanitized JSON we send to the client.
// In Sentry v8+ use setupExpressErrorHandler instead; both are tried.
if (Sentry?.Handlers?.errorHandler) {
  app.use(Sentry.Handlers.errorHandler())
} else if (Sentry?.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app)
}

app.use(errorHandler)

module.exports = app
