// @ts-check
/**
 * adminSessionController.js · /api/v1/admin/sessions
 *
 * Sessions are listed with their owning user. Revocation is destructive
 * (the session row is hard-deleted) — there is no `isRevoked` column.
 *
 * Phase 9.2d · refactored to asyncHandler. Verbose try/catch+next removed;
 * errors flow to the central errorHandler middleware unchanged.
 */

const sessions     = require("../services/adminSessionService")
const asyncHandler = require("../utils/asyncHandler")

const list = asyncHandler(async (req, res) => {
  // Schema has no isRevoked column — revocation = row deletion.
  // `includeExpired` controls whether expired sessions are also surfaced.
  const data = await sessions.listSessions({
    userId:         req.query.userId || undefined,
    includeExpired: req.query.includeExpired === "true",
    limit:          Number.parseInt(req.query.limit || "200", 10),
  })
  res.json({ sessions: data })
})

const revoke = asyncHandler(async (req, res) => {
  await sessions.revokeSession(req.params.id)
  res.status(204).end()
})

const revokeAll = asyncHandler(async (req, res) => {
  const { userId } = req.params
  const result = await sessions.revokeAllForUser(userId)
  res.json({ revoked: result.count })
})

module.exports = { list, revoke, revokeAll }
