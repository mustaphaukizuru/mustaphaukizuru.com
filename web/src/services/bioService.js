import { apiRequest, authFetch } from "../lib/api"

/* ────────────────────────────────────────────────────────────────────────────
 * M12 · Bio · public reads
 * ──────────────────────────────────────────────────────────────────────────── */

export async function fetchExperience() {
  const response = await apiRequest(`/api/v1/bio/experience`)
  return Array.isArray(response?.data) ? response.data : []
}

export async function fetchEducation() {
  const response = await apiRequest(`/api/v1/bio/education`)
  return Array.isArray(response?.data) ? response.data : []
}

export async function fetchCertificates() {
  const response = await apiRequest(`/api/v1/bio/certificates`)
  return {
    items: Array.isArray(response?.data) ? response.data : [],
    grouped: response?.grouped || {},
  }
}

export async function fetchSkills() {
  const response = await apiRequest(`/api/v1/bio/skills`)
  return {
    items: Array.isArray(response?.data) ? response.data : [],
    grouped: response?.grouped || {},
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * M12 · Admin · Experience
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminListExperience() {
  const r = await authFetch(`/api/v1/admin/bio/experience`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}
export async function adminCreateExperience(payload) {
  const r = await authFetch(`/api/v1/admin/bio/experience`, {
    method: "POST", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminUpdateExperience(id, payload) {
  const r = await authFetch(`/api/v1/admin/bio/experience/${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminDeleteExperience(id) {
  const r = await authFetch(`/api/v1/admin/bio/experience/${encodeURIComponent(id)}`, { method: "DELETE" })
  return r?.data || null
}

/* ────────────────────────────────────────────────────────────────────────────
 * M12 · Admin · Certificates
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminListCertificates() {
  const r = await authFetch(`/api/v1/admin/bio/certificates`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}
export async function adminCreateCertificate(payload) {
  const r = await authFetch(`/api/v1/admin/bio/certificates`, {
    method: "POST", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminUpdateCertificate(id, payload) {
  const r = await authFetch(`/api/v1/admin/bio/certificates/${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminDeleteCertificate(id) {
  const r = await authFetch(`/api/v1/admin/bio/certificates/${encodeURIComponent(id)}`, { method: "DELETE" })
  return r?.data || null
}

/* ────────────────────────────────────────────────────────────────────────────
 * M12 · Admin · Skills
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminListSkills() {
  const r = await authFetch(`/api/v1/admin/bio/skills`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}
export async function adminCreateSkill(payload) {
  const r = await authFetch(`/api/v1/admin/bio/skills`, {
    method: "POST", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminUpdateSkill(id, payload) {
  const r = await authFetch(`/api/v1/admin/bio/skills/${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminDeleteSkill(id) {
  const r = await authFetch(`/api/v1/admin/bio/skills/${encodeURIComponent(id)}`, { method: "DELETE" })
  return r?.data || null
}

/* ────────────────────────────────────────────────────────────────────────────
 * M12.5 · Admin · Education
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminListEducation() {
  const r = await authFetch(`/api/v1/admin/bio/education`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}
export async function adminCreateEducation(payload) {
  const r = await authFetch(`/api/v1/admin/bio/education`, {
    method: "POST", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminUpdateEducation(id, payload) {
  const r = await authFetch(`/api/v1/admin/bio/education/${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify(payload),
  })
  return r?.data || null
}
export async function adminDeleteEducation(id) {
  const r = await authFetch(`/api/v1/admin/bio/education/${encodeURIComponent(id)}`, { method: "DELETE" })
  return r?.data || null
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tier 3 · proof numbers (Home stats strip + About hero)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/bio/proof → { projects, clients, reviews, avgRating, years }.
 * Every field is a number (0 when the table is empty).
 */
export async function fetchProof(options = {}) {
  const response = await apiRequest(`/api/v1/bio/proof`, options)
  const d = response?.data || {}
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    projects:  n(d.projects),
    clients:   n(d.clients),
    reviews:   n(d.reviews),
    avgRating: n(d.avgRating),
    years:     n(d.years),
  }
}
