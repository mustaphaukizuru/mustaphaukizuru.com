import { authFetch, API_BASE_URL } from "../lib/api"

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
  // authFetch wraps fetch with auth header — for FormData we bypass JSON content-type
  const token = localStorage.getItem("auth-token")
  const res = await fetch(`${API_BASE_URL || ""}/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/files`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || err?.message || "Upload failed")
  }
  const json = await res.json()
  return stripData(json)
}
export async function deleteProjectFile(projectId, fileId) {
  const r = await authFetch(`/api/v1/admin/client-projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" })
  return stripData(r)
}
