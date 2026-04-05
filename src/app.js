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

const app = express()

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
app.use("/images/avatars", express.static(path.join(__dirname, "../public/images/avatars"), {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Disposition", "inline")
  },
}))
app.use("/images/media", express.static(path.join(__dirname, "../public/images/media"), {
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

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:   false,
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "https://accounts.google.com", "https://www.paypal.com",
                    "https://www.paypalobjects.com", "https://sdk.mercadopago.com",
                    "https://http2.mlstatic.com"],
      frameSrc:    ["https://accounts.google.com", "https://www.paypal.com",
                    "https://www.mercadopago.com", "https://www.mercadopago.com.br"],
      connectSrc:  ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com",
                    "https://api.mercadopago.com", "https://www.paypal.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
    },
  },
}))

// Logging
app.use(process.env.NODE_ENV !== "production"
  ? morgan("dev")
  : morgan(":method :url :status :response-time ms"))

// Body parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// API routes
app.use("/api", routes)

// Serve built React
// src/app.js → __dirname = .../src → ../public = .../public ✓
const frontendPath = path.join(__dirname, "../public")

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
app.use(errorHandler)

module.exports = app
