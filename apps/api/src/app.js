// Fix BigInt JSON serialization
BigInt.prototype.toJSON = function () { return this.toString() }

const express     = require("express")
const compression = require("compression")
const cors    = require("cors")
const helmet  = require("helmet")
const morgan  = require("morgan")
const path    = require("path")

const routes        = require("./routes")
const notFound      = require("./middleware/notFound")
const errorHandler  = require("./middleware/errorHandler")
const { clientUrl } = require("./config/env")

const app = express()

// Stripe webhook removed — using Mercado Pago

// ── Gzip compression — reduces payload by ~70% for JSON responses
app.use(compression({ level: 6, threshold: 1024 }))

// ── Static images ─────────────────────────────────────────────────────────────
// Public product images (intentionally public for storefront)
app.use("/images/products", express.static(path.join(__dirname, "../public/images/products"), {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Cache-Control", "public, max-age=604800, immutable")
  },
}))
// Avatars served publicly but with nosniff protection
app.use("/images/avatars", express.static(path.join(__dirname, "../public/images/avatars"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Disposition", "inline")
  },
}))
// Media library images
app.use("/images/media", express.static(path.join(__dirname, "../public/images/media"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
  },
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  clientUrl,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean)

app.use(
  cors({
    origin: function (origin, callback) {
      // Block null origin (prevents sandboxed iframe / file:// attacks)
      if (!origin) {
        // Only allow no-origin in non-production (Postman/curl dev testing)
        if (process.env.NODE_ENV !== "production") return callback(null, true)
        return callback(null, false)
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(null, false)
    },
    credentials: true,
  })
)

// ── Security headers ──────────────────────────────────────────────────────────
// Disable COEP/COOP that block Google OAuth postMessage
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,   // <── fixes "window.postMessage COOP block"
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' removed — use nonces in production if inline scripts needed
        scriptSrc:  [
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
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:  ["'self'", "https://fonts.gstatic.com"],
      },
    },
  })
)

// ── Logging + body parsing ────────────────────────────────────────────────────
// Skip morgan in production or use access-only format (never logs headers/tokens)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"))
} else {
  app.use(morgan(":method :url :status :response-time ms - :res[content-length]"))
}
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Mustapha Ukizuru API is running" })
})

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", routes)

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

module.exports = app
