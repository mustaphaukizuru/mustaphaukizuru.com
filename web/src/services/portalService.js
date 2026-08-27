import { apiRequest, API_BASE_URL } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Portal Service · Tier 4 magic-link + PIN client portal (no login)
// Backend: /api/v1/portal/*  — see src/routes/portalRoutes.js
// Uses apiRequest (not authFetch): there is no member session here; the
// verified state rides on the httpOnly `mu_portal` cookie the API sets.
// ─────────────────────────────────────────────────────────────

const stripData = (r) => (r?.data !== undefined ? r.data : r)
const base = (token) => `/api/v1/portal/${encodeURIComponent(token)}`

/** Is the link alive? Returns { projectName, expiresAt }. */
export async function probePortal(token) {
  return stripData(await apiRequest(base(token)))
}
/** Email a 6-digit PIN to the project owner. Returns { emailHint, expiresAt }. */
export async function requestPortalPin(token) {
  return stripData(await apiRequest(`${base(token)}/pin`, { method: "POST", body: JSON.stringify({}) }))
}
/** Exchange the PIN for the portal cookie. */
export async function verifyPortalPin(token, pin) {
  return stripData(await apiRequest(`${base(token)}/verify`, { method: "POST", body: JSON.stringify({ pin }) }))
}
/** Read-only project view for the cookie's project. */
export async function fetchPortalProject() {
  return stripData(await apiRequest("/api/v1/portal/me/project"))
}
export async function portalLogout() {
  return stripData(await apiRequest("/api/v1/portal/logout", { method: "POST", body: JSON.stringify({}) }))
}
/** Cookie-authenticated download URL (same-origin in production). */
export function portalFileDownloadUrl(fileId) {
  const root = (API_BASE_URL || "").replace(/\/$/, "")
  return `${root}/api/v1/portal/me/files/${encodeURIComponent(fileId)}/download`
}
