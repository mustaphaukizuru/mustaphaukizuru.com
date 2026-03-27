// Simple in-memory rate limiter — for production use Redis-backed rate limiting
const attempts = new Map()

const AUTH_WINDOW_MS   = 15 * 60 * 1000   // 15 minutes
const AUTH_MAX_ATTEMPTS = 10               // 10 attempts per 15 min per IP

function authRateLimiter(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress || "unknown"
  const key = `auth:${ip}`
  const now = Date.now()

  const record = attempts.get(key)

  if (record) {
    // Clean expired entries
    if (now - record.firstAttempt > AUTH_WINDOW_MS) {
      attempts.delete(key)
    } else if (record.count >= AUTH_MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((record.firstAttempt + AUTH_WINDOW_MS - now) / 1000)
      return res.status(429).json({
        success:    false,
        code:       "RATE_LIMIT",
        message:    `Too many attempts. Try again in ${retryAfter}s.`,
        retryAfter,
      })
    }
  }

  // Record this attempt
  if (!attempts.has(key)) {
    attempts.set(key, { count: 1, firstAttempt: now })
  } else {
    attempts.get(key).count += 1
  }

  next()
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of attempts.entries()) {
    if (now - record.firstAttempt > AUTH_WINDOW_MS) {
      attempts.delete(key)
    }
  }
}, 5 * 60 * 1000)

module.exports = { authRateLimiter }
