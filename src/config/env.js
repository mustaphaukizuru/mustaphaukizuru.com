const dotenv = require("dotenv")
dotenv.config()

// ─────────────────────────────────────────────────────────────
// B11 · Validate required variables + crypto soundness
// ─────────────────────────────────────────────────────────────

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET", "CLIENT_URL"]

REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    process.exit(1)
  }
})

const MIN_JWT_SECRET_LENGTH = 64
if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
  console.error(
    `❌ JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars). ` +
    `Minimum is ${MIN_JWT_SECRET_LENGTH} characters. ` +
    `Generate a strong one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
  )
  process.exit(1)
}

const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const config = {
  port: toNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "production",

  clientUrl: process.env.CLIENT_URL,
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  databaseUrl: process.env.DATABASE_URL,

  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: toNumber(process.env.SMTP_PORT, 465),
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,

  // Mercado Pago (optional · checkout disabled when missing)
  mpAccessToken:    process.env.MP_ACCESS_TOKEN     || null,
  mpPublicKey:      process.env.MP_PUBLIC_KEY       || null,
  mpWebhookSecret:  process.env.MP_WEBHOOK_SECRET   || null,

  // PayPal (optional · checkout disabled when missing)
  paypalClientId:   process.env.PAYPAL_CLIENT_ID    || null,
  paypalSecret:     process.env.PAYPAL_CLIENT_SECRET|| null,
  paypalWebhookId:  process.env.PAYPAL_WEBHOOK_ID   || null,
  paypalBaseUrl:    process.env.PAYPAL_BASE_URL     || "https://api-m.paypal.com",

  sentryDsn: process.env.SENTRY_DSN || null,
  logLevel:  process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
}

// ─────────────────────────────────────────────────────────────
// Pre-flight checks for payment + email integrations.
// Runs in every non-development environment (production AND staging),
// because staging that's exposed to the public can still accept money
// and send mail.
// ─────────────────────────────────────────────────────────────
const isLive = config.nodeEnv === "production" || config.nodeEnv === "staging"

if (isLive) {
  const warnings = []
  const errors   = []

  if (!config.smtpHost) warnings.push("SMTP not configured (transactional emails will fail silently)")

  // MercadoPago — partial config = booby trap
  if (!config.mpAccessToken) {
    warnings.push("MP_ACCESS_TOKEN missing — MercadoPago checkout disabled")
  } else if (!config.mpWebhookSecret) {
    errors.push("MP_ACCESS_TOKEN is set but MP_WEBHOOK_SECRET is missing — webhook signature verification will be SKIPPED, allowing payment forgery")
  }

  // PayPal — same pattern
  if (!config.paypalClientId || !config.paypalSecret) {
    warnings.push("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing — PayPal checkout disabled")
  } else if (!config.paypalWebhookId) {
    errors.push("PayPal credentials are set but PAYPAL_WEBHOOK_ID is missing — webhook signature verification will be SKIPPED, allowing payment forgery")
  }

  if (!config.sentryDsn) warnings.push("SENTRY_DSN not set (error tracking disabled)")

  if (warnings.length > 0) {
    console.warn("⚠️  Optional services missing:")
    warnings.forEach((w) => console.warn("    · " + w))
  }
  if (errors.length > 0) {
    console.error("❌ Critical configuration error(s):")
    errors.forEach((e) => console.error("    · " + e))
    if (config.nodeEnv === "production") {
      console.error(
        "\n   Refusing to start in production with payment-forgery exposure.\n" +
        "   Set the missing webhook secrets, or unset the gateway credentials\n" +
        "   to fully disable that gateway, then restart.\n"
      )
      process.exit(1)
    } else {
      console.error("    (allowed to continue in non-production · DO NOT EXPOSE PUBLICLY)\n")
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Google Calendar / Meet — shape-aware pre-flight.
//
// Runs in EVERY environment (dev included): bookings depend on Google in
// every environment, and the failure mode is silent (meetingLink=null on
// the row, no join link in the customer email). A malformed refresh token
// is the most common booby trap — the bootstrap script asks the operator
// to paste a redirect URL containing `?code=4/…` (a one-time auth code)
// and prints the actual refresh token (`1//…`) at the end. Copy-pasting
// the wrong one of the two has happened in the wild.
//
// We delegate the shape check to googleCalendar.diagnoseConfig() so this
// pre-flight and the runtime gate (lib/googleCalendar.isConfigured) stay
// in lockstep — there's exactly one source of truth for "is the config
// usable".
// ─────────────────────────────────────────────────────────────
{
  // Require lazily to keep env.js load-time minimal and to avoid coupling
  // the env validator to googleapis (which lib/googleCalendar pulls in).
  // If the require itself fails (missing dep, syntax issue), skip the
  // pre-flight rather than crash on boot.
  let googleCalendar = null
  try { googleCalendar = require("../lib/googleCalendar") } catch { /* skip */ }

  if (googleCalendar && typeof googleCalendar.diagnoseConfig === "function") {
    const diag = googleCalendar.diagnoseConfig()
    if (diag === "ok") {
      // Healthy — stay quiet.
    } else if (diag.startsWith("missing env:")) {
      // Intentional skip (operator hasn't bootstrapped Google yet) —
      // warn so they know consultations will save without a Meet link.
      console.warn(
        "⚠️  Google Calendar not configured — consultations will save with " +
        "meetingLink=null and require manual admin link entry."
      )
      console.warn("    · " + diag)
      console.warn("    · Bootstrap with:  npm run google:bootstrap")
    } else {
      // Misshapen value (e.g. someone pasted the `4/…` auth code into
      // GOOGLE_OAUTH_REFRESH_TOKEN instead of the `1//…` refresh token).
      // This is NOT an intentional skip — it's a broken configuration
      // that would silently degrade every booking. Fail loudly.
      const banner =
        "❌ Google Calendar misconfigured — every consultation booking will save without a Meet link."
      if (config.nodeEnv === "production") {
        console.error(banner)
        console.error("    · " + diag)
        console.error("    · Fix with:  npm run google:bootstrap")
        console.error("\n   Refusing to start in production with a broken booking flow.\n")
        process.exit(1)
      } else {
        console.error(banner)
        console.error("    · " + diag)
        console.error("    · Fix with:  npm run google:bootstrap")
        console.error("    (allowed to continue in non-production)\n")
      }
    }
  }
}

module.exports = config
