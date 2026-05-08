// @ts-check
/**
 * requirePermission.js · permission-based authorisation middleware
 *
 * Usage:
 *   const { protect } = require("./authMiddleware")
 *   const { requirePermission } = require("./requirePermission")
 *
 *   router.post("/products",
 *     protect,
 *     requirePermission("product:create"),
 *     productController.create,
 *   )
 *
 * Behaviour:
 *   1. If req.user.role === "admin" — pass-through (legacy super-admin).
 *      This keeps the platform working before AdminPermission is seeded.
 *   2. Otherwise resolve the user's permission set:
 *      User → UserRole[] → Role → RolePermission[] → AdminPermission.key
 *   3. If the requested key is in the set, next(); else 403.
 *   4. The resolved set is memoised on req._userPermissions so multiple
 *      checks in the same request only query Prisma once.
 *
 * Combine with `protect` upstream — req.user must already be populated.
 */

const prisma = require("../lib/prisma")

async function loadUserPermissions(userId) {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          name: true,
          rolePermissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  })
  const set = new Set()
  for (const ur of rows) {
    for (const rp of ur.role?.rolePermissions || []) {
      if (rp.permission?.key) set.add(rp.permission.key)
    }
  }
  return set
}

/**
 * Build a permission gate. Pass either a single key or an array (any-of).
 *   requirePermission("review:moderate")
 *   requirePermission(["review:moderate", "review:delete"])
 */
function requirePermission(required) {
  const required_keys = Array.isArray(required) ? required : [required]
  if (required_keys.length === 0) {
    throw new Error("requirePermission needs at least one key")
  }

  return async function permissionGate(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false, code: "AUTH_MISSING",
          message: "Not authenticated",
        })
      }

      // Legacy super-admin shortcut. Must remain until AdminPermission is
      // seeded and roles are assigned to all admins.
      if (req.user.role === "admin") {
        if (!req._userPermissions) req._userPermissions = "*"
        return next()
      }

      // Cache permissions on the request — multiple gates in a chain only
      // hit Prisma once.
      if (!req._userPermissions || req._userPermissions === "*") {
        req._userPermissions = await loadUserPermissions(req.user.id)
      }
      const owned = req._userPermissions
      const granted = required_keys.some((k) => owned.has(k))
      if (!granted) {
        return res.status(403).json({
          success: false, code: "FORBIDDEN_PERMISSION",
          message: "You do not have permission to perform this action",
          required: required_keys,
        })
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

/** Convenience: any of N permissions — alias for requirePermission([...]) */
function requireAnyPermission(...keys) {
  return requirePermission(keys.flat())
}

module.exports = { requirePermission, requireAnyPermission, loadUserPermissions }
