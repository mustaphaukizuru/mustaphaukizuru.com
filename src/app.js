// Fix BigInt JSON serialization
BigInt.prototype.toJSON = function () { return this.toString() }

const express     = require("express")
const compression = require("compression")
const cors        = require("cors")
const helmet      = require("helmet")
const morgan      = require("morgan")
const path        = require("path")

const routes       = require("./routes")
const notFound     = require("./middleware/notFound")
const errorHandler = require("./middleware/errorHandler")
const { clientUrl } = require("./config/env")

const app = express()

// ── Gzip compression ─────────────────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }))

// ── Static image folders ──────────────────────────────────────────────────────
app.use("/images/products", express.static(path.join(__dirname, "../public/images/products"), {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Cache-Control", "public, max-age=604800, immutable")
  },
}))

app.use("/images/avatars", express.static(path.join(__dirname, "../public/images/avatars"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Disposition", "inline")
  },
}))

app.use("/images/media", express.static(path.join(__dirname, "../public/images/media"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
  },
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  clientUrl,
  "https://mustaphaukizuru.com",
  "https://www.mustaphaukizuru.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      if (process.env.NODE_ENV !== "production") return callback(null, true)
      return callback(null, false)
    }
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
}))

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:   false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://www.paypal.com",
        "https://www.paypalobjects.com",
        "https://www.sandbox.paypal.com",
        "https://sdk.mercadopago.com",
        "https://http2.mlstatic.com",
      ],
      frameSrc: [
        "https://accounts.google.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://www.mercadopago.com",
        "https://www.mercadopago.com.br",
      ],
      connectSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://api.mercadopago.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
      ],
      imgSrc:    ["'self'", "data:", "https:"],
      styleSrc:  ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:   ["'self'", "https://fonts.gstatic.com"],
    },
  },
}))

// ── Logging + body parsing ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"))
} else {
  app.use(morgan(":method :url :status :response-time ms - :res[content-length]"))
}

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", routes)

// ── Serve built React frontend ────────────────────────────────────────────────
// In production on Hostinger, Express serves both the API and the React app.
// The React build output (from `npm run build`) goes into apps/api/public/.
// Express serves it as static files and falls back to index.html for all
// non-API routes so React Router handles client-side navigation.

const frontendPath = path.join(__dirname, "../public")

app.use(express.static(frontendPath, {
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    // Never cache index.html — always serve fresh so React loads correct version
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    }
  },
}))

// React Router SPA fallback — any GET that is not /api/* returns index.html
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"))
})

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

module.exports = app