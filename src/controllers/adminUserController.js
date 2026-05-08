const asyncHandler = require("../utils/asyncHandler")
const {
  getAdminUsers,
  updateUserStatus,
  updateUserRole,
  VALID_STATUSES,
  VALID_ROLES,
} = require("../services/adminUserService")

function badRequest(res, message, details) {
  return res.status(400).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message, ...(details ? { details } : {}) },
  })
}

function notFound(res) {
  return res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "User not found" },
  })
}

/* ────────────────────────────────────────────────────────────────────────
   GET /api/v1/admin/users
   ──────────────────────────────────────────────────────────────────── */
const listAdminUsers = asyncHandler(async (req, res) => {
  // All filters optional — page-level controls eventually pass them through
  const data = await getAdminUsers({
    page:   req.query.page,
    limit:  req.query.limit,
    role:   req.query.role,
    status: req.query.status,
    search: req.query.search,
  })
  res.status(200).json({ success: true, data })
})

/* ────────────────────────────────────────────────────────────────────────
   PATCH /api/v1/admin/users/:id/status
   Body: { status: "active" | "suspended" | "pending" }
   ──────────────────────────────────────────────────────────────────── */
const patchUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const status = String(req.body?.status || "").trim().toLowerCase()

  if (!id) return badRequest(res, "User id is required")
  if (!VALID_STATUSES.includes(status)) {
    return badRequest(res, `Invalid status. Expected one of: ${VALID_STATUSES.join(", ")}`)
  }

  // Self-suspend guard — prevent admin from locking themselves out
  if (req.user?.id === id && status !== "active") {
    return badRequest(res, "You cannot change your own account status from this panel.")
  }

  try {
    const updated = await updateUserStatus(id, status)
    res.status(200).json({ success: true, data: updated })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    throw e
  }
})

/* ────────────────────────────────────────────────────────────────────────
   PATCH /api/v1/admin/users/:id/role
   Body: { role: "admin" | "member" }
   ──────────────────────────────────────────────────────────────────── */
const patchUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params
  const role = String(req.body?.role || "").trim().toLowerCase()

  if (!id) return badRequest(res, "User id is required")
  if (!VALID_ROLES.includes(role)) {
    return badRequest(res, `Invalid role. Expected one of: ${VALID_ROLES.join(", ")}`)
  }

  // Self-demote guard — prevent admin from removing their own admin
  if (req.user?.id === id && role !== "admin") {
    return badRequest(res, "You cannot remove your own admin role from this panel.")
  }

  try {
    const updated = await updateUserRole(id, role)
    res.status(200).json({ success: true, data: updated })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    throw e
  }
})

module.exports = {
  listAdminUsers,
  patchUserStatus,
  patchUserRole,
}
