import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Client Project Service · member + admin
// Backend:
//   /api/v1/member/projects               (list / detail · scoped to req.user)
//   /api/v1/admin/client-projects         (full CRUD + milestones + files)
// ─────────────────────────────────────────────────────────────

const stripData = (r) => (r?.data !== undefined ? r.data : r)
const asArray = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [])

/* ── member ─────────────────────────────────────────────────────────── */
export async function fetchMyProjects() {
  const r = await authFetch("/api/v1/member/projects")
  return asArray(r)
}
export async function fetchMyProject(id) {
  if (!id) throw new Error("Project id is required")
  const r = await authFetch(`/api/v1/member/projects/${encodeURIComponent(id)}`)
  return stripData(r)
}

/* ── member · project support tickets (Tier 2) ──────────────────────── */
const memberProject = (id) => `/api/v1/member/projects/${encodeURIComponent(id)}`

/** Multipart when files are present, JSON otherwise — the API accepts both. */
function ticketBody(fields, files) {
  const list = Array.from(files || []).filter(Boolean)
  if (!list.length) return { body: JSON.stringify(fields) }
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, v) })
  list.forEach((f) => fd.append("files", f))
  return { body: fd }
}

export async function fetchMyProjectTickets(projectId) {
  if (!projectId) throw new Error("Project id is required")
  const r = await authFetch(`${memberProject(projectId)}/tickets`)
  return asArray(r)
}
export async function fetchMyProjectTicket(projectId, ticketId) {
  const r = await authFetch(`${memberProject(projectId)}/tickets/${encodeURIComponent(ticketId)}`)
  return stripData(r)
}
export async function createMyProjectTicket(projectId, { subject, message, priority, milestoneId, files } = {}) {
  if (!projectId) throw new Error("Project id is required")
  const r = await authFetch(`${memberProject(projectId)}/tickets`, {
    method: "POST",
    ...ticketBody({ subject, message, priority, milestoneId }, files),
  })
  return stripData(r)
}
export async function replyMyProjectTicket(projectId, ticketId, { message, files } = {}) {
  const r = await authFetch(`${memberProject(projectId)}/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    ...ticketBody({ message }, files),
  })
  return stripData(r)
}
/** Download URL for a ticket attachment (ownership-scoped by the project). */
export function projectFileDownloadUrl(projectId, fileId) {
  return `${memberProject(projectId)}/files/${encodeURIComponent(fileId)}/download`
}

/* ── admin · projects ───────────────────────────────────────────────── */
export async function fetchAdminProjects() {
  const r = await authFetch("/api/v1/admin/client-projects")
  return asArray(r)
}
export async function fetchAdminProject(id) {
  if (!id) throw new Error("Project id is required")
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(id)}`)
  return stripData(r)
}
export async function createAdminProject(payload) {
  const r = await authFetch("/api/v1/admin/client-projects", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  })
  return stripData(r)
}
export async function updateAdminProject(id, payload) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  })
  return stripData(r)
}
/** Tier 4 · mint / rotate the no-login portal link. Returns { url, expiresAt }. */
export async function createAdminPortalLink(id) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(id)}/portal-link`, { method: "POST", body: JSON.stringify({}) })
  return stripData(r)
}
/* ── T5-16 · the admin queue, across every project ──────────────────── */

/**
 * Everything waiting on the operator, and everything waiting on clients.
 *
 * Returns the empty shape rather than throwing: this feeds a badge rendered
 * on every admin page, and a queue that cannot be built must not take the
 * admin shell down with it.
 */
export async function fetchAdminQueue() {
  try {
    const r = await authFetch("/api/v1/admin/client-projects/queue")
    const data = r?.data !== undefined ? r.data : r
    return {
      waitingOnMe: data?.waitingOnMe || [],
      waitingOnClient: data?.waitingOnClient || [],
      counts: data?.counts || { me: 0, client: 0 },
    }
  } catch {
    return { waitingOnMe: [], waitingOnClient: [], counts: { me: 0, client: 0 } }
  }
}

/* ── T5-5 · admin document requests and the full timeline ───────────── */

const adminProject = (id) => `/api/v1/admin/client-projects/${encodeURIComponent(id)}`

export async function fetchAdminFileRequests(id) {
  const r = await authFetch(`${adminProject(id)}/file-requests`)
  return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []
}

export async function createAdminFileRequest(id, body) {
  const r = await authFetch(`${adminProject(id)}/file-requests`, { method: "POST", body: JSON.stringify(body) })
  return stripData(r)
}

/**
 * Accept, reject or cancel one request.
 *
 * Reject reopens rather than closes — the client has to be able to try
 * again, and the request row is the only place that remembers what was asked
 * for. The service enforces that; this is only the call.
 */
export async function reviewAdminFileRequest(id, reqId, body) {
  const r = await authFetch(`${adminProject(id)}/file-requests/${encodeURIComponent(reqId)}`, { method: "PATCH", body: JSON.stringify(body) })
  return stripData(r)
}

export async function fetchAdminProjectEvents(id) {
  const r = await authFetch(`${adminProject(id)}/events`)
  return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []
}

/** Tier 4 · create a draft Portfolio case study from the project. Returns { id, slug, editUrl }. */
export async function createAdminCaseStudyDraft(id) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(id)}/case-study-draft`, { method: "POST", body: JSON.stringify({}) })
  return stripData(r)
}
export async function deleteAdminProject(id) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(id)}`, { method: "DELETE" })
  return stripData(r)
}

/* ── admin · milestones ─────────────────────────────────────────────── */
export async function createMilestone(projectId, payload) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  })
  return stripData(r)
}
export async function updateMilestone(projectId, milestoneId, payload) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  })
  return stripData(r)
}
export async function deleteMilestone(projectId, milestoneId) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, { method: "DELETE" })
  return stripData(r)
}

/* ── admin · files ──────────────────────────────────────────────────── */
export async function uploadProjectFile(projectId, file, { milestoneId, isDeliverable } = {}) {
  if (!file) throw new Error("file is required")
  const fd = new FormData()
  fd.append("file", file)
  if (milestoneId) fd.append("milestoneId", milestoneId)
  if (isDeliverable) fd.append("isDeliverable", "true")
  // authFetch detects FormData via isFormData() and leaves the
  // Content-Type unset so the browser injects the multipart boundary.
  // Auth header is added automatically — no manual localStorage read.
  const r = await authFetch(
    `/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/files`,
    { method: "POST", body: fd },
  )
  return stripData(r)
}
export async function deleteProjectFile(projectId, fileId) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" })
  return stripData(r)
}

/* ── admin · comments ───────────────────────────────────────────────────── */
export async function postAdminProjectComment(projectId, { body, milestoneId, fileId } = {}) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, milestoneId: milestoneId || undefined, fileId: fileId || undefined }),
  })
  return stripData(r)
}
export async function toggleAdminCommentResolved(projectId, commentId) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}/resolve`, {
    method: "PATCH",
  })
  return stripData(r)
}

/* ── member · portal writes (Tier 2) ───────────────────────────────────── */
const memberBase = (projectId) => `/api/v1/member/projects/${encodeURIComponent(projectId)}`

/** Multipart `files[]` upload (≤10 files, 50 MB each). Optional milestone anchor. */
export async function uploadMyProjectFiles(projectId, files, { milestoneId } = {}) {
  const list = Array.from(files || [])
  if (!list.length) throw new Error("At least one file is required")
  const fd = new FormData()
  for (const f of list) fd.append("files", f)
  if (milestoneId) fd.append("milestoneId", milestoneId)
  const r = await authFetch(`${memberBase(projectId)}/files`, { method: "POST", body: fd })
  return asArray(r)
}
export async function postMyProjectComment(projectId, { body, milestoneId, fileId } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, milestoneId: milestoneId || undefined, fileId: fileId || undefined }),
  })
  return stripData(r)
}
export async function approveMyMilestone(projectId, milestoneId, { note } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/milestones/${encodeURIComponent(milestoneId)}/approve`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  })
  return stripData(r)
}
/** Tier 4 · review a completed project (existing service review endpoint + projectId). */
export async function postProjectReview(serviceSlug, { projectId, rating, reviewText } = {}) {
  const r = await authFetch(`/api/v1/services/${encodeURIComponent(serviceSlug)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ projectId, rating, reviewText }),
  })
  return stripData(r)
}
/** Tier 4 · NDA click-wrap acceptance. */
export async function acceptMyProjectAgreement(projectId, { type = "nda", version } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/agreements`, {
    method: "POST",
    body: JSON.stringify({ type, version: version || undefined }),
  })
  return stripData(r)
}
export async function requestMyMilestoneChanges(projectId, milestoneId, { note } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/milestones/${encodeURIComponent(milestoneId)}/request-changes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  })
  return stripData(r)
}

/* ── Tier 4 · change requests (extra work) ─────────────────────────────── */
export async function fetchMyChangeRequests(projectId) {
  const r = await authFetch(`${memberBase(projectId)}/change-requests`)
  return asArray(r)
}
export async function createMyChangeRequest(projectId, { title, description } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/change-requests`, {
    method: "POST",
    body: JSON.stringify({ title, description }),
  })
  return stripData(r)
}
/** Resolves to { orderId, redirectUrl, ... } — the caller sends the client to pay. */
export async function acceptMyChangeRequest(projectId, crId) {
  const r = await authFetch(`${memberBase(projectId)}/change-requests/${encodeURIComponent(crId)}/accept`, { method: "POST", body: "{}" })
  return stripData(r)
}
export async function declineMyChangeRequest(projectId, crId, { note } = {}) {
  const r = await authFetch(`${memberBase(projectId)}/change-requests/${encodeURIComponent(crId)}/decline`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  })
  return stripData(r)
}
export async function quoteChangeRequest(projectId, crId, { amount, note, currency } = {}) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/change-requests/${encodeURIComponent(crId)}/quote`, {
    method: "POST",
    body: JSON.stringify({ amount, note, currency: currency || undefined }),
  })
  return stripData(r)
}
export async function completeChangeRequest(projectId, crId) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/change-requests/${encodeURIComponent(crId)}/done`, { method: "POST", body: "{}" })
  return stripData(r)
}
