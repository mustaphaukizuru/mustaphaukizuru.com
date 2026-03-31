const dotenv = require("dotenv")
dotenv.config()

// ─────────────────────────────────────────────────────────────
// Validate required variables
// ─────────────────────────────────────────────────────────────
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"]

REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    process.exit(1)
  }
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const config = {
  // Core
  port: toNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "production",

  // URLs
  clientUrl: process.env.CLIENT_URL || "https://mustaphaukizuru.com",
  frontendUrl: process.env.FRONTEND_URL || "https://mustaphaukizuru.com",

  // Auth
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Email (optional)
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: toNumber(process.env.SMTP_PORT, 465),
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,

  // Mercado Pago (optional)
  mpAccessToken: process.env.MP_ACCESS_TOKEN || null,
  mpPublicKey: process.env.MP_PUBLIC_KEY || null,

  // PayPal (optional)
  paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
  paypalSecret: process.env.PAYPAL_CLIENT_SECRET || null,
  paypalBaseUrl:
    process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com",
}

// ─────────────────────────────────────────────────────────────
// Optional warnings (non-blocking)
// ─────────────────────────────────────────────────────────────
if (config.nodeEnv === "production") {
  const warnings = []

  if (!config.smtpHost) warnings.push("SMTP not configured")
  if (!config.paypalClientId) warnings.push("PayPal not configured")
  if (!config.mpAccessToken) warnings.push("MercadoPago not configured")

  if (warnings.length > 0) {
    console.warn("⚠️ Optional services missing:", warnings.join(", "))
  }
}

// ─────────────────────────────────────────────────────────────

module.exports = config