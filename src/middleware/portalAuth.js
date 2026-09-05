const { verifyJwt } = require("../utils/jwt")
const { PORTAL_COOKIE } = require("../utils/portalCookie")

/**
 * portalAuth · accepts ONLY the read-only portal token issued by
 * portalAccessService.verifyPin: { scope: "portal", projectId, userId }.
 *
 * Deliberately narrow:
 *   - reads the `mu_portal` cookie only — no Authorization header, no
 *     `mu_session`. A member session does not unlock a portal and vice versa.
 *   - requires scope === "portal"; a plain session JWT (no scope) or any
 *     other purpose-scoped token (2fa-pending…) is refused even though it is
 *     signed with the same secret.
 *   - does not load the user: the portal is anonymous-by-design and every
 *     handler scopes its query by req.portal.projectId + userId.
 *   - carries `role` (T5-17): which inbox the PIN reached. A viewer may read
 *     and upload; only owner and approver may commit the client to
 *     something, which on this surface means starting a payment.
 */
function portalAuth(req, res, next) {
  const token = req.cookies?.[PORTAL_COOKIE]
  if (!token) {
    return res.status(401).json({ success: false, error: { code: "PORTAL_AUTH_MISSING", message: "Verify your PIN to open this portal" } })
  }
  let decoded
  try {
    decoded = verifyJwt(token)
  } catch (e) {
    const expired = e?.name === "TokenExpiredError"
    return res.status(401).json({
      success: false,
      error: { code: expired ? "PORTAL_AUTH_EXPIRED" : "PORTAL_AUTH_INVALID", message: expired ? "Your portal access expired — request a new PIN" : "Invalid portal token" },
    })
  }
  if (decoded?.scope !== "portal" || !decoded.projectId || !decoded.userId) {
    return res.status(401).json({ success: false, error: { code: "PORTAL_AUTH_INVALID", message: "Invalid portal token" } })
  }
  // T5-17 · the role the PIN's inbox carries. A token minted before this
  // existed has no `role`, and every one of those was issued to the OWNER —
  // the by-code door did not take an address yet — so "owner" is the correct
  // reading, not a permissive default. The 2 h TTL bounds it either way.
  req.portal = {
    projectId: String(decoded.projectId),
    userId: String(decoded.userId),
    role: decoded.role ? String(decoded.role) : "owner",
  }
  next()
}

module.exports = { portalAuth }
