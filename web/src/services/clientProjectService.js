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
export async function uploadProjectFile(projectId, file) {
  if (!file) throw new Error("file is required")
  const fd = new FormData()
  fd.append("file", file)
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
