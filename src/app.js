BigInt.prototype.toJSON = function() { return this.toString() }

const express     = require("express")
const compression = require("compression")
const cors        = require("cors")
const helmet      = require("helmet")
const morgan      = require("morgan")
const path        = require("path")

const routes        = require("./routes")
const notFound      = require("./middleware/notFound")
const errorHandler  = require("./middleware/errorHandler")
const { clientUrl } = require("./config/env")
const { globalApiLimiter } = require("./middleware/rateLimiter")   // B10

// B11 · Sentry — initialisation lives in src/lib/sentry.js. That module
// returns `null` if @sentry/node isn't installed or SENTRY_DSN is unset,
// so the handlers below degrade silently. Init runs once at require time.
const Sentry = require("./lib/sentry")

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

// Compression
app.use(compression({ level: 6, threshold: 1024 }))

// Static uploads
// __dirname = mustaphaukizuru.com/src  →  ../public = mustaphaukizuru.com/public ✓
app.use("/images/products", express.static(path.join(__dirname, "../public/images/products"), {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Cache-Control", "public, max-age=604800, immutable")
  },
}))
// Avatars & media are user uploads — served from storage/ (persists across
// builds), NOT ../public (wiped by Vite emptyOutDir on every build). The URL
// prefix stays /images/* so existing database URLs keep resolving.
app.use("/images/avatars", express.static(path.join(__dirname, "../storage/uploads/avatars"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Disposition", "inline")
  },
}))
app.use("/images/media", express.static(path.join(__dirname, "../storage/uploads/media"), {
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
                    "https://http2.mlstatic.com"],
      frameSrc:    ["'self'",                       // CSP · same-origin iframes (e.g. inline PDF certificates)
                    "https://accounts.google.com",
                    "https://www.paypal.com",
                    "https://www.mercadopago.com",
                    "https://www.mercadopago.com.br"],
      connectSrc:  ["'self'",
                    "https://accounts.google.com",
                    "https://oauth2.googleapis.com",
                    "https://api.mercadopago.com",
                    "https://www.paypal.com"],
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

// Logging
app.use(process.env.NODE_ENV !== "production"
  ? morgan("dev")
  : morgan(":method :url :status :response-time ms"))

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
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    }
  },
}))

// React Router SPA fallback
app.get(/^\/(?!api).*/, (req, res) => {
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
