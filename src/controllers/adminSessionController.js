// @ts-check
/**
 * adminSessionController.js · /api/v1/admin/sessions
 *
 * Sessions are listed with their owning user. Revocation is destructive
 * (the session row is hard-deleted) — there is no `isRevoked` column.
 */

const sessions = require("../services/adminSessionService")

async function list(req, res, next) {
  try {
    // Schema has no isRevoked column — revocation = row deletion.
    // `includeExpired` controls whether expired sessions are also surfaced.
    const data = await sessions.listSessions({
      userId:         req.query.userId || undefined,
      includeExpired: req.query.includeExpired === "true",
      limit:          Number.parseInt(req.query.limit || "200", 10),
    })
    res.json({ sessions: data })
  } catch (err) { next(err) }
}

async function revoke(req, res, next) {
  try {
    await sessions.revokeSession(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

async function revokeAll(req, res, next) {
  try {
    const { userId } = req.params
    const result = await sessions.revokeAllForUser(userId)
    res.json({ revoked: result.count })
  } catch (err) { next(err) }
}

module.exports = { list, revoke, revokeAll }
