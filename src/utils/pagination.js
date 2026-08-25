/**
 * pagination.js · shared, clamped pagination parser for list endpoints.
 *
 * parsePagination(req.query, { defaultLimit, maxLimit })
 *   → { page, limit, skip, take }
 *
 * `limit` is always clamped to [1, maxLimit] so no list query is unbounded.
 */
function toInt(value, fallback) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page  = Math.max(1, toInt(query?.page, 1))
  const limit = Math.min(maxLimit, Math.max(1, toInt(query?.limit, defaultLimit)))
  const skip  = (page - 1) * limit
  return { page, limit, skip, take: limit }
}

module.exports = { parsePagination }
