// ════════════════════════════════════════════════════════════════════════════
// clientLogoController · public read + admin CRUD for the /about logo wall
// ════════════════════════════════════════════════════════════════════════════
const asyncHandler = require("../utils/asyncHandler")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const svc = require("../services/clientLogoService")

const PUBLIC_CACHE = "public, max-age=300, stale-while-revalidate=900"

/** GET /api/v1/client-logos — active logos, in display order. */
const listPublic = asyncHandler(async (req, res) => {
  const data = await svc.listPublicClientLogos(resolveUserLocale({ req }))
  res.set("Cache-Control", PUBLIC_CACHE)
  res.status(200).json({ success: true, data })
})

/** GET /api/v1/admin/client-logos */
const listAdmin = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, data: await svc.listAdminClientLogos() })
})

/** POST /api/v1/admin/client-logos */
const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await svc.createClientLogo(req.body || {}) })
})

/** PATCH /api/v1/admin/client-logos/:id */
const update = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await svc.updateClientLogo(req.params.id, req.body || {}) })
})

/** DELETE /api/v1/admin/client-logos/:id */
const remove = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await svc.deleteClientLogo(req.params.id) })
})

/** POST /api/v1/admin/client-logos/reorder  { ids: [...] } */
const reorder = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await svc.reorderClientLogos(req.body?.ids) })
})

module.exports = { listPublic, listAdmin, create, update, remove, reorder }
