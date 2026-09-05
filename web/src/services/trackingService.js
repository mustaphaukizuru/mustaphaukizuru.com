import { apiRequest, authFetch } from "../lib/api"

/**
 * trackingService · the public lookup and the two panels it shares (T5-5).
 *
 * `/track/:code` is the one deliberately unauthenticated read on the site, so
 * it goes through apiRequest rather than authFetch: no ambient credential to
 * ride along on a link somebody forwarded. What it may return is
 * docs/decisions/0006-tracking-code-public-surface.md.
 *
 * The timeline and the outstanding-document list are the same two endpoints
 * twice over — once member-scoped, once portal-scoped — because a portal
 * holder has no session for the member gate to read.
 */

const stripData = (r) => (r?.data !== undefined ? r.data : r)
const asArray = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [])
const memberPath = (id, tail) => `/api/v1/member/projects/${encodeURIComponent(id)}${tail}`

/**
 * Format a code the way it is stored, as the user types it.
 *
 * "mu7k4c9xqf" → "MU-7K4C-9XQF". The server normalises too, so this is only
 * about the field reading like the thing printed on the invoice while it is
 * still being filled in.
 */
export function formatTrackingCode(input) {
  const raw = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    // EVERY leading MU, not one. The field is re-formatted on each keystroke
    // and already contains the prefix this function added, so typing the
    // second character of "mu7k4c9xqf" produced "MUMU..." — one strip left
    // the second MU behind as data and the field read MU-MU7K-4C9X. Safe to
    // repeat: U is not in the code alphabet (both halves of every confusable
    // pair are dropped), so "MU" cannot occur inside a real code.
    .replace(/^(MU)+/, "")
    .slice(0, 8)
  if (!raw) return ""
  if (raw.length <= 4) return `MU-${raw}`
  return `MU-${raw.slice(0, 4)}-${raw.slice(4)}`
}

/**
 * Complete enough to send?
 *
 * The alphabet is the one in src/utils/trackingCode.js, which drops both
 * halves of every confusable pair (no O/0, no I/1). The server is still the
 * judge — this only decides whether the button is worth enabling.
 */
export function isCompleteTrackingCode(value) {
  return /^MU-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}$/.test(String(value || ""))
}

/**
 * Look up a project by code.
 *
 * Returns null for 404 rather than throwing: "no project with that code" is
 * an ordinary answer on this page, not an error state. Unknown, malformed and
 * expired codes all answer alike, by design (ADR 0006), so the page cannot
 * tell the visitor which one it was either.
 */
export async function fetchProjectByCode(code) {
  if (!code) return null
  try {
    return stripData(await apiRequest(`/api/v1/track/${encodeURIComponent(code)}`))
  } catch (err) {
    if (err?.status === 404 || err?.statusCode === 404) return null
    throw err
  }
}

/* ── member-scoped (signed in) ───────────────────────────────────────── */

export async function fetchProjectEvents(projectId) {
  return asArray(await authFetch(memberPath(projectId, "/events")))
}

export async function fetchProjectFileRequests(projectId) {
  return asArray(await authFetch(memberPath(projectId, "/file-requests")))
}

export async function fetchProjectInvoices(projectId) {
  const data = stripData(await authFetch(memberPath(projectId, "/invoices")))
  return { invoices: data?.invoices || [], billing: data?.billing || null }
}

/**
 * Upload against one request. The member upload route takes the request id in
 * the body; the portal route takes it in the path (it has no project id of
 * its own to key on).
 */
export async function uploadAgainstRequest(projectId, requestId, files) {
  const form = new FormData()
  for (const file of Array.from(files || [])) form.append("files", file)
  if (requestId) form.append("fileRequestId", requestId)
  return stripData(await authFetch(memberPath(projectId, "/files"), { method: "POST", body: form }))
}

/* ── portal-scoped (PIN cookie, no session) ──────────────────────────── */

export async function fetchPortalEvents() {
  return asArray(await authFetch("/api/v1/portal/me/events"))
}

export async function fetchPortalFileRequests() {
  return asArray(await authFetch("/api/v1/portal/me/file-requests"))
}

export async function fetchPortalInvoices() {
  const data = stripData(await authFetch("/api/v1/portal/me/invoices"))
  return { invoices: data?.invoices || [], billing: data?.billing || null }
}

/**
 * T5-9 · start a Mercado Pago payment for one invoice from the PIN portal.
 *
 * The server picks the order and the amount; all this sends is which invoice.
 * Returns the gateway URL to send the browser to.
 */
export async function payPortalInvoice(invoiceId) {
  const data = stripData(await authFetch(
    `/api/v1/portal/me/invoices/${encodeURIComponent(invoiceId)}/pay`,
    { method: "POST", body: JSON.stringify({}) },
  ))
  return data?.redirectUrl || null
}

export async function uploadPortalRequestFiles(requestId, files) {
  const form = new FormData()
  for (const file of Array.from(files || [])) form.append("files", file)
  return stripData(await authFetch(
    `/api/v1/portal/me/file-requests/${encodeURIComponent(requestId)}/files`,
    { method: "POST", body: form },
  ))
}

/* ── T5-13 · the credential handoff, on both surfaces ────────────────── */

export async function fetchProjectSecrets(projectId) {
  return asArray(await authFetch(memberPath(projectId, "/secrets")))
}
export async function fetchPortalSecrets() {
  return asArray(await authFetch("/api/v1/portal/me/secrets"))
}

export async function createProjectSecret(projectId, body) {
  return stripData(await authFetch(memberPath(projectId, "/secrets"), { method: "POST", body: JSON.stringify(body) }))
}
export async function createPortalSecret(body) {
  return stripData(await authFetch("/api/v1/portal/me/secrets", { method: "POST", body: JSON.stringify(body) }))
}

/**
 * Reveal, once. POST on purpose — this destroys what it returns, and a GET
 * is spent by a link scanner, a prefetch or a restored tab.
 */
export async function revealProjectSecret(projectId, secretId) {
  return stripData(await authFetch(memberPath(projectId, `/secrets/${encodeURIComponent(secretId)}/reveal`), { method: "POST", body: "{}" }))
}
export async function revealPortalSecret(secretId) {
  return stripData(await authFetch(`/api/v1/portal/me/secrets/${encodeURIComponent(secretId)}/reveal`, { method: "POST", body: "{}" }))
}
