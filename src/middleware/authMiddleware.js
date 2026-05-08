const jwt = require("jsonwebtoken")
const prisma = require("../lib/prisma")

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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id:true, fullName:true, email:true, role:true, status:true, avatarUrl:true },
    })

    if (!user) {
      return res.status(401).json({ success: false, code: "AUTH_USER_NOT_FOUND", message: "Account not found" })
    }

    // Block suspended/pending accounts
    if (user.status === "suspended") {
      return res.status(403).json({ success: false, code: "AUTH_SUSPENDED", message: "Your account has been suspended. Contact support." })
    }
    if (user.status === "pending") {
      return res.status(403).json({ success: false, code: "AUTH_PENDING", message: "Account is pending verification." })
    }

    req.user = user
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id:true, fullName:true, email:true, role:true, status:true, avatarUrl:true },
    })

    // Only attach if active. Suspended/pending users are treated as guests on
    // soft-auth routes — the explicit `protect` middleware still blocks them
    // from reaching their dashboard.
    if (user && user.status === "active") {
      req.user = user
    }
    next()
  } catch {
    // DB hiccup — fall through as a guest. Hard-auth routes still 503.
    next()
  }
}

module.exports = { protect, adminOnly, selfOrAdmin, attachUserIfPresent }
