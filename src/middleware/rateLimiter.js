/**
 * B10 · Rate limiter (rewritten on top of express-rate-limit).
 *
 * Drop-in replacement for the B07 hand-rolled limiter. Existing route files
 * that imported { authRateLimiter, contactRateLimiter, newsletterRateLimiter }
 * keep working without changes — those names are still exported.
 *
 * Spec table (B10):
 *   global       100 / 15 min / IP        — applied app-wide on /api in app.js
 *   login          5 / 15 min / (IP+email)
 *   signup         3 / 1 hour  / IP
 *   forgot pw      3 / 1 hour  / email
 *   verify email   5 / 15 min  / email   (loaded but not yet wired — endpoint TBD)
 *   contact        3 / 15 min  / IP
 *   newsletter     5 / 1 hour  / IP
 *   payment       10 / 1 hour  / user
 *   media upload  20 / 1 hour  / user
 *   product srch  60 / 1 min   / IP
 *   download      10 / 1 hour  / user
 *
 * Standard error response shape (matches errorHandler.js):
 *   {
 *     success: false,
 *     code:    "RATE_LIMITED",
 *     message: "...",
 *     error:   { code: "RATE_LIMITED", message: "...", details: { retryAfter } }
 *   }
 */

const rateLimit = require("express-rate-limit")
const crypto    = require("crypto")
// Was previously referenced by `logger.warn(...)` in the 429 handler without
// being imported — first rate-limit hit in prod threw ReferenceError, masking
// the limit event in logs. Fixed inline here so we don't ship Phase 9 with a
// known latent crash on the very hot path we're trying to harden.
const logger    = require("../utils/logger")

const FIFTEEN_MIN = 15 * 60 * 1000
const FIVE_MIN    = 5  * 60 * 1000
const ONE_HOUR    = 60 * 60 * 1000
const ONE_MIN     = 60 * 1000

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Build a 429 response in the dual error shape (top-level legacy fields +
 * nested `error` object). Anything in `details` rides along inside `error`.
 */
function rateLimitedResponse(req, res, options, extraDetails = {}) {
  const message = options?.message?.message || options?.message || "Too many requests. Please try again shortly."
  const retryAfter = res.getHeader("Retry-After")

  return res.status(options.statusCode).json({
    success: false,
    code:    "RATE_LIMITED",
    message,
    error: {
      code:    "RATE_LIMITED",
      message,
      details: {
        retryAfter: retryAfter ? Number(retryAfter) : null,
        ...extraDetails,
      },
    },
  })
}

/**
 * Resolve the client IP, normalizing the IPv6-mapped form `::ffff:1.2.3.4`
 * down to plain IPv4. Without this, the same client behind certain proxies
 * gets two distinct buckets across IPv4 and IPv6 mapping.
 */
function clientIp(req) {
  const raw = req.ip || req.connection?.remoteAddress || "unknown"
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw
}

/**
 * Composite key generators. We compose IP + identifier so attackers can't
 * defeat email-keyed limits by rotating IPs (we still bind to email), and
 * legitimate users behind shared NAT don't all collide on a single IP-only
 * bucket.
 */
function ipPlusEmailKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase() || "no-email"
  return `${clientIp(req)}::${email}`
}

function emailKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase()
  return email ? `email::${email}` : `ip::${clientIp(req)}`
}

function userKey(req) {
  // req.user is populated by authMiddleware on protected routes; if missing
  // we fall back to IP so this still functions as a degraded limit.
  return req.user?.id ? `user::${req.user.id}` : `ip::${clientIp(req)}`
}

function ipKey(req) {
  return `ip::${clientIp(req)}`
}

/**
 * 2FA verify key — composite of IP + a hash of the two-factor token. Each
 * issued twoFactorToken (which lives for 5 minutes) gets its own per-IP
 * bucket, so a brute-force burst against ONE token can't drain another
 * user's budget on the same IP/NAT. We hash the token so it never lands in
 * the limiter's in-memory key store as a plaintext credential.
 */
function ipPlusTwoFactorTokenKey(req) {
  const raw = String(req.body?.twoFactorToken || "")
  if (!raw) return `${clientIp(req)}::no-token`
  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)
  return `${clientIp(req)}::tf::${hash}`
}

/**
 * Factory — wires standard headers + JSON 429 responder around express-rate-limit.
 */
const IS_DEV = process.env.NODE_ENV !== "production"
const IS_TEST = process.env.NODE_ENV === "test"

/**
 * In development we 5x every limit and skip the limiter entirely for
 * localhost / 127.0.0.1 / ::1 so the operator's own browser doesn't trip
 * "Too many requests" while testing flows. Production keeps the strict
 * values per the prompt acceptance criteria.
 */
function devScale(max) {
  if (IS_TEST) return Number.MAX_SAFE_INTEGER
  if (IS_DEV)  return max * 5
  return max
}

function isLocalhost(req) {
  const ip = (req.ip || "").replace("::ffff:", "")
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.")
}

function makeLimiter({ windowMs, max, keyGenerator, message, name }) {
  return rateLimit({
    windowMs,
    max: devScale(max),
    keyGenerator: keyGenerator || ipKey,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => IS_DEV && isLocalhost(req),
    handler: (req, res) => {
      const msg = typeof message === "string" ? message : message?.message || "Too many requests."
      logger.warn(`[rate-limit:${name || "anon"}] ${req.ip} hit limit on ${req.method} ${req.originalUrl}`)
      res.status(429).json({
        success: false,
        error:   { code: "RATE_LIMITED", message: msg },
      })
    },
  })
}

/* ── Limiters ─────────────────────────────────────────────────────────── */

/**
 * Global public-API limiter. Mounted in app.js BEFORE routes:
 *   app.use("/api", globalApiLimiter, routes)
 *
 * Webhooks (PayPal, MercadoPago) bypass this — they have their own routes
 * outside the limiter chain or are exempt via skip rules at the route level.
 */
// 100/15min was hit by a single admin session in normal use (each console
// page fans out several requests and polls), locking the operator out of
// the whole API with RATE_LIMITED. Abuse-sensitive endpoints keep their own
// tight limiters below; the global one is only a backstop.
const globalApiLimiter = makeLimiter({
  name:         "global",
  windowMs:     FIFTEEN_MIN,
  max:          Number(process.env.RATE_LIMIT_GLOBAL_MAX || 1500),
  keyGenerator: ipKey,
  message:      "Too many requests from this IP. Please slow down.",
})

/**
 * Login — 5 per 15 min, keyed by IP + email so credential stuffing on a
 * single account is throttled even when attackers rotate IPs against
 * different victims, and legitimate users behind shared NAT can still log in
 * to their own accounts when neighbors are noisy.
 */
const loginRateLimiter = makeLimiter({
  name:         "login",
  windowMs:     FIFTEEN_MIN,
  max:          5,
  keyGenerator: ipPlusEmailKey,
  message:      "Too many sign-in attempts. Try again in a few minutes.",
})

/**
 * Signup — 3 per hour per IP. Stops bulk account creation.
 */
const signupRateLimiter = makeLimiter({
  name:         "signup",
  windowMs:     ONE_HOUR,
  max:          3,
  keyGenerator: ipKey,
  message:      "Too many sign-up attempts from this IP. Please try again later.",
})

/**
 * Forgot password — 3 per hour per email. Prevents using forgot-password as
 * a notification spam vector to harass users.
 */
const forgotPasswordRateLimiter = makeLimiter({
  name:         "forgot-password",
  windowMs:     ONE_HOUR,
  max:          3,
  // ip+email: per-email alone let one IP fan out reset mails to thousands of
  // distinct addresses (each a DB write + SMTP send).
  keyGenerator: ipPlusEmailKey,
  message:      "Too many password reset requests. Please try again later.",
})

/**
 * Email verification dispatch — 5 per 15 min per email. Reserved for the
 * eventual /api/auth/verify-email/send endpoint. Exported now so it's ready
 * when that endpoint lands.
 */
const verifyEmailRateLimiter = makeLimiter({
  name:         "verify-email",
  windowMs:     FIFTEEN_MIN,
  max:          5,
  keyGenerator: emailKey,
  message:      "Too many verification requests. Please wait before requesting another.",
})

/**
 * Contact form — 3 per 15 min per IP (B07 spec carried forward).
 */
const contactRateLimiter = makeLimiter({
  name:         "contact",
  windowMs:     FIFTEEN_MIN,
  max:          3,
  keyGenerator: ipKey,
  message:      "Too many messages sent. Please wait a few minutes before trying again.",
})

/**
 * Newsletter subscribe — 5 per hour per IP (B10 spec; B07 was 5/min, this
 * tightens it for spam waves).
 */
const newsletterRateLimiter = makeLimiter({
  name:         "newsletter",
  windowMs:     ONE_HOUR,
  max:          5,
  keyGenerator: ipKey,
  message:      "Too many subscribe requests. Please wait before trying again.",
})

/**
 * Password reset submission — 10 per hour per IP (T3-5).
 *
 * forgot-password was limited and reset-password/:token was not, which is the
 * wrong way round for guessing: the token in that URL is the credential, and
 * an unlimited endpoint lets an attacker grind it. Per IP rather than per
 * token, because the thing being brute-forced IS the token — keying on it
 * would give the attacker a fresh budget for every guess.
 *
 * Ten, not three: a real user who mistypes their new password twice and then
 * hits a validation rule should not be locked out of a link that expires.
 */
const passwordResetRateLimiter = makeLimiter({
  name:         "password-reset",
  windowMs:     ONE_HOUR,
  max:          10,
  keyGenerator: ipKey,
  message:      "Too many reset attempts. Please request a new link in an hour.",
})

/**
 * Public project tracking — 30 per 15 minutes per IP (T5-2).
 *
 * The tracking code carries about 2^39 of entropy, which is a lookup key and
 * not a secret. THIS LIMIT is what makes enumeration impractical, not the
 * length: 30 guesses per window against 2^39 possibilities is not a search,
 * it is a hobby. Generous enough that a client refreshing their own page,
 * or a team all opening the same link, never sees a 429.
 *
 * See docs/decisions/0006-tracking-code-public-surface.md.
 */
const trackRateLimiter = makeLimiter({
  name:         "track",
  windowMs:     FIFTEEN_MIN,
  max:          30,
  keyGenerator: ipKey,
  message:      "Too many lookups. Please wait a few minutes before trying again.",
})

/**
 * Self-audit (diagnostic) submission — 5 per hour per IP. Each submission
 * renders a multi-page PDF and sends two emails, so an unthrottled endpoint
 * is a CPU + mail amplifier. Same shape as the newsletter limiter.
 */
const diagnosticRateLimiter = makeLimiter({
  name:         "diagnostic",
  windowMs:     ONE_HOUR,
  max:          5,
  keyGenerator: ipKey,
  message:      "Too many audit submissions. Please wait before trying again.",
})

/**
 * Payment endpoints — 10 per hour per user. Prevents card testing /
 * preference enumeration. Falls back to per-IP if the route doesn't have
 * `protect` middleware (webhook routes should NOT use this limiter — they
 * need higher throughput for retries).
 */
const paymentRateLimiter = makeLimiter({
  name:         "payment",
  windowMs:     ONE_HOUR,
  max:          10,
  keyGenerator: userKey,
  message:      "Too many payment requests. Please wait before trying again.",
})

/**
 * Media uploads — 20 per hour per user (admin uploads). Protects against
 * disk-fill attacks even if an admin account is compromised.
 */
const uploadRateLimiter = makeLimiter({
  name:         "upload",
  windowMs:     ONE_HOUR,
  max:          20,
  keyGenerator: userKey,
  message:      "Upload limit reached. Please wait before uploading more files.",
})

/**
 * Deep health — 10 per hour per IP. The probe opens SMTP, Mercado Pago and
 * PayPal connections on every call; the hourly uptime workflow needs one.
 */
const healthDeepRateLimiter = makeLimiter({
  name:     "healthDeep",
  windowMs: ONE_HOUR,
  max:      10,
  message:  "Deep health probe limit reached.",
})

/**
 * Product search — 60 per minute per IP. Search is read-only and cheap, so
 * a high ceiling is fine; this just stops scraper bursts.
 */
const searchRateLimiter = makeLimiter({
  name:         "search",
  windowMs:     ONE_MIN,
  max:          60,
  keyGenerator: ipKey,
  message:      "Too many search requests. Please slow down.",
})

/**
 * Download endpoints — 10 per hour per user. Prevents abuse of paid-content
 * URLs while still allowing repeat downloads of large files (resume etc.).
 */
const downloadRateLimiter = makeLimiter({
  name:         "download",
  windowMs:     ONE_HOUR,
  max:          10,
  keyGenerator: userKey,
  message:      "Download limit reached. Please try again later.",
})

/**
 * ARCO self-service (data export + account deletion) — 3 per hour per user.
 * Both endpoints are expensive (export fans out to ~12 tables) and neither
 * needs to be called more than once in practice.
 */
const profileDataRateLimiter = makeLimiter({
  name:         "profile-data",
  windowMs:     ONE_HOUR,
  max:          3,
  keyGenerator: userKey,
  message:      "Too many data requests. Please try again in an hour.",
})

/**
 * 2FA login-verify — 5 attempts per 5 minutes per (IP + twoFactorToken).
 *
 * The 5-minute window mirrors the twoFactorToken's own lifetime, so the
 * budget resets only when the user gets a fresh token by re-entering their
 * password. The key includes a hash of the twoFactorToken, so:
 *   • Two users behind the same NAT each get their own bucket (their
 *     tokens differ), and
 *   • An attacker holding ONE stolen twoFactorToken can't grind through
 *     ~1,000,000 six-digit codes on it — they get 5 tries, then have to
 *     wait or steal a new token, which requires the password.
 *
 * Stacks ON TOP of the broader loginRateLimiter (5/15min/IP+email) already
 * applied to this route — that gives credential-stuffing protection; this
 * adds per-token brute-force protection that the IP+email key alone can't
 * (since the verify endpoint has no `email` field in the body).
 */
const twoFactorVerifyRateLimiter = makeLimiter({
  name:         "2fa-verify",
  windowMs:     FIVE_MIN,
  max:          5,
  keyGenerator: ipPlusTwoFactorTokenKey,
  message:      "Too many 2FA attempts. Sign in again to get a fresh code prompt.",
})

/**
 * Project support tickets — 10 per hour per user. A ticket fans out to every
 * admin (notification + email) and may carry up to 10 files, so it needs a
 * tighter budget than plain comments.
 */
const ticketRateLimiter = makeLimiter({
  name:         "ticket",
  windowMs:     ONE_HOUR,
  max:          10,
  keyGenerator: userKey,
  message:      "Too many tickets opened. Please wait before opening another one.",
})

/**
 * Tier 4 · magic-link portal PIN. Each request emails the project owner, so
 * the budget is tight per IP; the verify step gets a slightly larger one so
 * a mistyped PIN does not lock the visitor out before the email arrives.
 */
const portalPinRateLimiter = makeLimiter({
  name:         "portal-pin",
  windowMs:     FIFTEEN_MIN,
  max:          5,
  keyGenerator: ipKey,
  message:      "Too many PIN requests. Please wait 15 minutes and try again.",
})
const portalVerifyRateLimiter = makeLimiter({
  name:         "portal-verify",
  windowMs:     FIFTEEN_MIN,
  max:          10,
  keyGenerator: ipKey,
  message:      "Too many PIN attempts. Please wait 15 minutes and request a new PIN.",
})

/* ── Backward-compat alias ────────────────────────────────────────────── */

/**
 * Old name kept so existing route files (uploaded but not modified by B10)
 * keep working without diff-touching. Maps to login limits (5 / 15 min /
 * IP+email) which is the strictest sane default for any auth endpoint that
 * gets retrofitted.
 */
const authRateLimiter = loginRateLimiter

/**
 * Public write endpoints that create rows or reveal state without a session
 * (guest service checkout creates User rows; coupon validation can be used
 * to enumerate codes). 30 per 15 min per IP.
 */
const publicWriteRateLimiter = makeLimiter({
  name:         "public-write",
  windowMs:     FIFTEEN_MIN,
  max:          30,
  keyGenerator: ipKey,
  message:      "Too many requests. Please try again in a few minutes.",
})

module.exports = {
  // Global
  globalApiLimiter,
  publicWriteRateLimiter,
  // Auth
  loginRateLimiter,
  signupRateLimiter,
  forgotPasswordRateLimiter,
  verifyEmailRateLimiter,
  twoFactorVerifyRateLimiter,
  authRateLimiter,            // alias of loginRateLimiter
  // Contact / newsletter
  contactRateLimiter,
  newsletterRateLimiter,
  diagnosticRateLimiter,
  trackRateLimiter,
  passwordResetRateLimiter,
  // Resource-scoped
  paymentRateLimiter,
  uploadRateLimiter,
  healthDeepRateLimiter,
  searchRateLimiter,
  downloadRateLimiter,
  ticketRateLimiter,
  portalPinRateLimiter,
  portalVerifyRateLimiter,
  profileDataRateLimiter,
}
