/**
 * Per-user download rate limiter.
 * Simple in-memory window — matches the style of authRateLimiter.js.
 *
 * Upgrade path: swap the Map for a Redis-backed store in production.
 *
 * Window: 1 hour rolling.
 * Cap:    10 download attempts per user per hour.
 * Key:    req.user.id (falls back to IP for anonymous, which should never
 *         hit this limiter because the route is `protect`-gated upstream).
 */

const attempts = new Map()

const DOWNLOAD_WINDOW_MS   = 60 * 60 * 1000  // 1 hour
const DOWNLOAD_MAX_PER_HR  = 10

function keyFor(req) {
  if (req.user?.id) return `u:${req.user.id}`
  const ip = req.ip || req.connection?.remoteAddress || "unknown"
  return `ip:${ip}`
}

function downloadRateLimiter(req, res, next) {
  const key = keyFor(req)
  const now = Date.now()
  const record = attempts.get(key)

  if (record) {
    if (now - record.firstAttempt > DOWNLOAD_WINDOW_MS) {
      attempts.delete(key)
    } else if (record.count >= DOWNLOAD_MAX_PER_HR) {
      const retryAfterSec = Math.ceil((record.firstAttempt + DOWNLOAD_WINDOW_MS - now) / 1000)
      const retryAfterMin = Math.ceil(retryAfterSec / 60)
      res.set("Retry-After", String(retryAfterSec))
      return res.status(429).json({
        success:    false,
        code:       "RATE_LIMITED",
        message:    `Too many downloads. Try again in ${retryAfterMin} min.`,
        retryAfter: retryAfterSec,
      })
    }
  }

  if (!attempts.has(key)) {
    attempts.set(key, { count: 1, firstAttempt: now })
  } else {
    attempts.get(key).count += 1
  }

  next()
}

// Housekeeping — expire stale entries every 10 min.
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of attempts.entries()) {
    if (now - record.firstAttempt > DOWNLOAD_WINDOW_MS) attempts.delete(key)
  }
}, 10 * 60 * 1000)

module.exports = { downloadRateLimiter }
