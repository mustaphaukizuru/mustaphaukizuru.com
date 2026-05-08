/* ════════════════════════════════════════════════════════════════════════
   solutionService.js · Frontend client for /api/solutions (productized packages)
   ────────────────────────────────────────────────────────────────────────
   Distinct from /api/services. Productized packages have their own resource:
     · Pricing model differs (fixed bundle vs engagement-based)
     · Schema.org markup differs (Product vs Service)

   Resilient by design — falls back to SOLUTION_PACKAGES catalogue.
   ════════════════════════════════════════════════════════════════════════ */

import { apiGet, authGet, authPost, authPatch, authDelete } from "../lib/api"
import { SOLUTION_PACKAGES } from "../data/solutionsCatalogue"

function safeArray(payload, key = "solutions") {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload[key])) return payload[key]
  if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function shapeCataloguePackage(p) {
  if (!p) return null
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    title: p.name,
    audience: p.audience,
    audienceLabel: p.audienceLabel,
    primary: p.primary,
    tagline: p.tagline,
    outcome: p.outcome,
    duration: p.duration,
    pricingModel: p.pricingModel,
    composedOf: p.composedOf,
    headlineDeliverables: p.headlineDeliverables,
    bestFor: p.bestFor,
  }
}

export async function listSolutions(opts = {}) {
  const { limit = 24 } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))

  try {
    const res = await apiGet(`/api/solutions?${qs.toString()}`)
    const solutions = safeArray(res, "solutions")
    if (solutions.length > 0) {
      return { solutions, total: Number(res?.total ?? res?.data?.total ?? solutions.length) }
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[solutionService] /api/solutions unavailable, using static catalogue.", err?.code)
    }
  }

  const all = SOLUTION_PACKAGES.slice(0, limit).map(shapeCataloguePackage).filter(Boolean)
  return { solutions: all, total: SOLUTION_PACKAGES.length }
}

export async function fetchFeaturedSolutions(optsOrLimit = {}) {
  const limit = typeof optsOrLimit === "number" ? optsOrLimit : (optsOrLimit?.limit || 4)

  try {
    const qs = new URLSearchParams()
    qs.set("featured", "true")
    qs.set("limit", String(limit))
    const res = await apiGet(`/api/solutions?${qs.toString()}`)
    const live = safeArray(res, "solutions")
    if (live.length > 0) return live.slice(0, limit)
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[solutionService] featured solutions unavailable, using catalogue.", err?.code)
    }
  }

  const featured = SOLUTION_PACKAGES.filter((p) => p.primary)
  const list = featured.length >= limit ? featured : SOLUTION_PACKAGES
  return list.slice(0, limit).map(shapeCataloguePackage).filter(Boolean)
}

export async function getSolutionBySlug(slug) {
  if (!slug) return null
  try {
    const res = await apiGet(`/api/solutions/${encodeURIComponent(slug)}`)
    if (res) return res?.solution || res?.data || res
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info(`[solutionService] /api/solutions/${slug} unavailable.`, err?.code)
    }
  }
  const hit = SOLUTION_PACKAGES.find((p) => p.slug === slug)
  return hit ? shapeCataloguePackage(hit) : null
}

/* ── Admin (auth-required) ──────────────────────────────────────────────── */

export async function listAdminSolutions(opts = {}) {
  const { limit = 50, cursor } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", cursor)
  return authGet(`/api/admin/solutions?${qs.toString()}`)
}

export async function createAdminSolution(payload) {
  return authPost("/api/admin/solutions", payload)
}

export async function updateAdminSolution(id, payload) {
  if (!id) throw new Error("updateAdminSolution: id is required")
  return authPatch(`/api/admin/solutions/${encodeURIComponent(id)}`, payload)
}

export async function deleteAdminSolution(id) {
  if (!id) throw new Error("deleteAdminSolution: id is required")
  return authDelete(`/api/admin/solutions/${encodeURIComponent(id)}`)
}
