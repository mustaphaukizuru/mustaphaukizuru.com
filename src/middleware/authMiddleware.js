const jwt = require("jsonwebtoken")
const prisma = require("../lib/prisma")

/**
 * A session token is one issued by utils/generateToken: it carries a userId
 * and NO `purpose` claim. Anything with a purpose (e.g. "2fa-pending") is a
 * scoped token and must be verified by its own service, never here.
 */
function isSessionToken(decoded) {
  return Boolean(decoded && decoded.userId && decoded.purpose === undefined)
}

// ─────────────────────────────────────────────────────────────────────────────
// protect — validates JWT, loads user, checks status
// ─────────────────────────────────────────────────────────────────────────────
async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, code: "AUTH_MISSING", message: "Authentication token required" })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      return res.status(401).json({ success: false, code: "AUTH_MISSING", message: "Token is empty" })
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (jwtErr) {
      const code = jwtErr.name === "TokenExpiredError" ? "AUTH_EXPIRED" : "AUTH_INVALID"
      return res.status(401).json({ success: false, code, message: jwtErr.name === "TokenExpiredError" ? "Session expired, please sign in again" : "Invalid authentication token" })
    }

    // Security · only plain session tokens authenticate. Purpose-scoped
    // tokens (2FA-pending, etc.) are signed with the same secret but must
    // never be accepted as a session — otherwise password-only login would
    // bypass the second factor.
    if (!isSessionToken(decoded)) {
      return res.status(401).json({ success: false, code: "AUTH_INVALID", message: "Invalid authentication token" })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id:true, fullName:true, email:true, role:true, status:true, avatarUrl:true, tokensValidFrom:true },
    })

    if (!user) {
      return res.status(401).json({ success: false, code: "AUTH_USER_NOT_FOUND", message: "Account not found" })
    }

    // Token-revocation watermark. If the user changed their password, enabled
    // 2FA, or manually signed out everywhere AFTER this JWT was issued, we
    // refuse it as expired — even though the JWT signature is still valid.
    // `iat` is seconds-since-epoch; `tokensValidFrom` is a Date. The 1-second
    // grace (`+ 1000`) prevents a same-second issue/revoke race from
    // immediately invalidating the freshly issued replacement token.
    if (user.tokensValidFrom && decoded.iat) {
      const iatMs = Number(decoded.iat) * 1000
      const revokedAtMs = new Date(user.tokensValidFrom).getTime()
      if (iatMs + 1000 < revokedAtMs) {
        return res.status(401).json({
          success: false,
          code: "AUTH_EXPIRED",
          message: "Session expired, please sign in again",
        })
      }
    }

    // Block suspended/pending accounts
    if (user.status === "suspended") {
      return res.status(403).json({ success: false, code: "AUTH_SUSPENDED", message: "Your account has been suspended. Contact support." })
    }
    if (user.status === "pending") {
      return res.status(403).json({ success: false, code: "AUTH_PENDING", message: "Account is pending verification." })
    }

    // Strip the watermark before exposing user on req — downstream handlers
    // don't need it and it's not a public field.
    const { tokensValidFrom: _watermark, ...publicUser } = user
    req.user = publicUser
    next()
  } catch (err) {
    // DB down or unexpected error
    const msg = err?.message || ""
    if (msg.includes("Can't reach database") || msg.includes("ECONNREFUSED")) {
      return res.status(503).json({ success: false, code: "DB_UNAVAILABLE", message: "Service temporarily unavailable" })
    }
    return res.status(401).json({ success: false, code: "AUTH_ERROR", message: "Authentication failed" })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// adminOnly — must come after protect
// ─────────────────────────────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, code: "AUTH_MISSING", message: "Not authenticated" })
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admin access required" })
  }
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// selfOrAdmin — allow user to access own resources or admin to access any
// ─────────────────────────────────────────────────────────────────────────────
function selfOrAdmin(req, res, next) {
  const paramId = req.params.userId || req.params.id
  if (req.user?.role === "admin") return next()
  if (req.user?.id === paramId) return next()
  return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Access denied" })
}

// ─────────────────────────────────────────────────────────────────────────────
// attachUserIfPresent — soft auth. Populates req.user if a valid JWT is sent
// but does NOT 401 when missing/invalid. Use on routes that work for both
// guests AND signed-in users (e.g. POST /api/v1/orders for guest checkout).
//
// Mirrors `protect` semantics for the success path (loads from DB, blocks
// suspended/pending) so downstream code can trust req.user identically.
// ─────────────────────────────────────────────────────────────────────────────
async function attachUserIfPresent(req, _res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) return next()

    const token = authHeader.split(" ")[1]
    if (!token) return next()

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      // Invalid/expired token on a public route is silently ignored.
      return next()
    }
    if (!isSessionToken(decoded)) return next()

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id:true, fullName:true, email:true, role:true, status:true, avatarUrl:true, tokensValidFrom:true },
    })

    // Only attach if active AND the token is post-revocation-watermark.
    // Suspended/pending users + revoked-token users are treated as guests on
    // soft-auth routes — the explicit `protect` middleware still blocks them
    // from reaching their dashboard.
    if (user && user.status === "active") {
      const isRevoked = user.tokensValidFrom && decoded.iat &&
        (Number(decoded.iat) * 1000 + 1000 < new Date(user.tokensValidFrom).getTime())
      if (!isRevoked) {
        const { tokensValidFrom: _w, ...publicUser } = user
        req.user = publicUser
      }
    }
    next()
  } catch {
    // DB hiccup — fall through as a guest. Hard-auth routes still 503.
    next()
  }
}

module.exports = { protect, adminOnly, selfOrAdmin, attachUserIfPresent }
