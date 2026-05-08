/* ════════════════════════════════════════════════════════════════════════
   portfolioService.js · Frontend client for /api/portfolio
   ────────────────────────────────────────────────────────────────────────
   Resilient by design — falls back to the static aboutProjects catalogue
   in `web/src/data/aboutProjectsData.js` when the backend is unavailable.

   Backend route /api/portfolio is not yet implemented (see B06 in
   EXECUTION-PLAN.md). When it ships, these calls return live data without
   any frontend change.
   ════════════════════════════════════════════════════════════════════════ */

import { apiGet, authGet, authPost, authPatch, authDelete, authFetch } from "../lib/api"
import { aboutProjects } from "../data/aboutProjectsData"

function safeArray(payload, key = "projects") {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload[key])) return payload[key]
  if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

/**
 * Map a static project entry to the shape page consumers expect.
 */
function shapeProject(p) {
  if (!p) return null
  return {
    id: p.id,
    slug: p.slug || p.id,
    title: p.title,
    description: p.description,
    image: p.image,
    images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
    tags: p.tags || [],
    year: p.year || null,
    link: p.link || `/projects/${p.slug || p.id}`,
    website: p.website || null,
    overview: p.overview || null,
    challenge: p.challenge || null,
    solution: p.solution || null,
    role: p.role || null,
    tools: p.tools || [],
    results: p.results || [],
  }
}

/* ── Public reads ────────────────────────────────────────────────────────── */

/**
 * List public portfolio projects. Returns a {projects,total} envelope.
 */
export async function listPortfolio(opts = {}) {
  const { limit = 24, cursor } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", cursor)

  try {
    const res = await apiGet(`/api/portfolio?${qs.toString()}`)
    const projects = safeArray(res, "projects")
    if (projects.length > 0) {
      return {
        projects,
        total: Number(res?.total ?? res?.data?.total ?? projects.length),
        hasMore: Boolean(res?.hasMore ?? res?.data?.hasMore ?? false),
      }
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[portfolioService] /api/portfolio unavailable, using static aboutProjects.", err?.code)
    }
  }

  const all = (aboutProjects || []).slice(0, limit).map(shapeProject).filter(Boolean)
  return { projects: all, total: aboutProjects?.length || 0, hasMore: false }
}

/**
 * Fetch featured portfolio projects for the home page.
 * Returns an array (not an envelope) — convenient for `await fetchFeaturedPortfolio(3)`.
 *
 * @param {number|object} optsOrLimit  Either a limit number or { limit }.
 */
export async function fetchFeaturedPortfolio(optsOrLimit = {}) {
  const limit = typeof optsOrLimit === "number"
    ? optsOrLimit
    : (optsOrLimit?.limit || 3)

  // Try API first
  try {
    const qs = new URLSearchParams()
    qs.set("featured", "true")
    qs.set("limit", String(limit))
    const res = await apiGet(`/api/portfolio?${qs.toString()}`)
    const live = safeArray(res, "projects")
    if (live.length > 0) return live.slice(0, limit)
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[portfolioService] featured portfolio unavailable, using static aboutProjects.", err?.code)
    }
  }

  // Static fallback: top N projects from aboutProjects
  return (aboutProjects || []).slice(0, limit).map(shapeProject).filter(Boolean)
}

/**
 * Get a single project by slug or ID.
 */
export async function getProjectBySlug(slug) {
  if (!slug) return null
  try {
    const res = await apiGet(`/api/portfolio/${encodeURIComponent(slug)}`)
    if (res) return res?.project || res?.data || res
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info(`[portfolioService] /api/portfolio/${slug} unavailable.`, err?.code)
    }
  }
  const hit = (aboutProjects || []).find((p) => p.slug === slug || p.id === slug)
  return hit ? shapeProject(hit) : null
}

/* Alias — ProjectDetailPage imports `fetchPortfolioBySlug`, the canonical
   name is `getProjectBySlug`. Both names point to the same function so
   either import resolves correctly. */
export const fetchPortfolioBySlug = getProjectBySlug

/* ── Admin (auth-required) ──────────────────────────────────────────────── */

/* Backend always responds with `{ success, data, pagination? }`.
   Pages expect `{ items, pagination }`, so we normalize the shape here.
   This was the root cause of the "Cannot read properties of undefined
   (reading 'filter')" crash — pages were reading `result.items` from a
   response that only had `result.data`. */
export async function listAdminPortfolio(opts = {}) {
  const { limit = 50, cursor, status, page } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", cursor)
  if (status) qs.set("status", status)
  if (page) qs.set("page", String(page))
  const r = await authGet(`/api/admin/portfolio?${qs.toString()}`)
  // Accept either { data: [...] } or { items: [...] } or a raw array
  const items = Array.isArray(r) ? r : (r?.items || r?.data || [])
  return {
    items,
    pagination: r?.pagination || { total: items.length, page: 1, pageSize: limit },
  }
}

export async function createAdminProject(payload) {
  const r = await authPost("/api/admin/portfolio", payload)
  return r?.data || r
}

export async function updateAdminProject(id, payload) {
  if (!id) throw new Error("updateAdminProject: id is required")
  const r = await authPatch(`/api/admin/portfolio/${encodeURIComponent(id)}`, payload)
  return r?.data || r
}

export async function deleteAdminProject(id) {
  if (!id) throw new Error("deleteAdminProject: id is required")
  return authDelete(`/api/admin/portfolio/${encodeURIComponent(id)}`)
}

/* ── Admin name aliases ─────────────────────────────────────────────────
   AdminPortfolioPage and AdminPortfolioFormPage import these names
   (admin{Verb}Portfolio convention). They map to the canonical functions
   above. Both sets remain exported so any caller resolves correctly. */
export const adminListPortfolio = listAdminPortfolio
export const adminCreatePortfolio = createAdminProject
export const adminUpdatePortfolio = updateAdminProject
export const adminDeletePortfolio = deleteAdminProject

/* GET single portfolio item via the admin endpoint (auth-required, returns
   draft + soft-deleted items unlike the public getProjectBySlug which only
   returns published items). */
export async function adminGetPortfolio(id) {
  if (!id) throw new Error("adminGetPortfolio: id is required")
  const r = await authGet(`/api/admin/portfolio/${encodeURIComponent(id)}`)
  return r?.data || r
}

/* Image uploads — backend uses multer.single("cover") for cover and
   multer.single("image") for gallery additions. Both endpoints expect
   multipart/form-data; api.js skips JSON.stringify and Content-Type
   when the body is FormData (lets the browser set the multipart boundary). */
export async function adminUploadCover(id, file) {
  if (!id) throw new Error("adminUploadCover: id is required")
  if (!file) throw new Error("adminUploadCover: file is required")
  const fd = new FormData()
  fd.append("cover", file) // field name MUST match multer.single("cover")
  const r = await authFetch(`/api/admin/portfolio/${encodeURIComponent(id)}/cover`, {
    method: "POST",
    body: fd,
  })
  return r?.data || r
}

export async function adminUploadGalleryImage(id, file) {
  if (!id) throw new Error("adminUploadGalleryImage: id is required")
  if (!file) throw new Error("adminUploadGalleryImage: file is required")
  const fd = new FormData()
  fd.append("image", file) // field name MUST match multer.single("image")
  const r = await authFetch(`/api/admin/portfolio/${encodeURIComponent(id)}/gallery`, {
    method: "POST",
    body: fd,
  })
  return r?.data || r
}
