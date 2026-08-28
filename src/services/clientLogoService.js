// @ts-check
// ════════════════════════════════════════════════════════════════════════════
// clientLogoService · the /about client logo wall
// ────────────────────────────────────────────────────────────────────────────
// Deliberately uncached: the wall is a single indexed query returning a
// handful of rows, and the HTTP layer already sets a 5-minute
// stale-while-revalidate. Adding a server cache here would only delay an
// admin edit showing up.
// ════════════════════════════════════════════════════════════════════════════
const prisma = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { pickLocale, pickLocaleMany } = require("../utils/pickLocale")

/** URL-friendly key, also used as the asset base name. */
function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Decimal → number, and never let a stray value blow the layout apart. */
function serialize(row) {
  if (!row) return null
  return {
    id:         row.id,
    name:       row.name,
    slug:       row.slug,
    logoUrl:    row.logoUrl,
    sector:     row.sector || null,
    sectorEs:   row.sectorEs || null,
    websiteUrl: row.websiteUrl || null,
    scale:      Math.min(2, Math.max(0.5, toNumber(row.scale, 1))),
    boxed:      Boolean(row.boxed),
    isActive:   Boolean(row.isActive),
    sortOrder:  toNumber(row.sortOrder, 0),
    createdAt:  row.createdAt,
    updatedAt:  row.updatedAt,
  }
}

/* ── public ───────────────────────────────────────────────────────────── */

/** Active logos in display order. `sector` is swapped for Spanish when asked. */
async function listPublicClientLogos(locale = "en") {
  const rows = await prisma.clientLogo.findMany({
    where:   { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take:    48,
  })
  return pickLocaleMany(rows.map(serialize), locale).map((row) => {
    // The wall never needs the raw Spanish column once it is resolved.
    const { sectorEs, ...rest } = pickLocale(row, locale)
    return rest
  })
}

/* ── admin ────────────────────────────────────────────────────────────── */

async function listAdminClientLogos() {
  const rows = await prisma.clientLogo.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  })
  return rows.map(serialize)
}

/** Fields a client may set. Anything else in the payload is ignored. */
function shape(input, { partial = false } = {}) {
  const out = {}
  const put = (key, value) => {
    if (partial && input[key] === undefined) return
    out[key] = value
  }
  if (input.name !== undefined) out.name = String(input.name).trim()
  if (input.slug !== undefined && String(input.slug).trim()) out.slug = slugify(input.slug)
  if (input.logoUrl !== undefined) out.logoUrl = String(input.logoUrl).trim()
  put("sector",     input.sector ? String(input.sector).trim().slice(0, 160) : null)
  put("sectorEs",   input.sectorEs ? String(input.sectorEs).trim().slice(0, 160) : null)
  put("websiteUrl", input.websiteUrl ? String(input.websiteUrl).trim().slice(0, 512) : null)
  if (input.scale !== undefined) out.scale = Math.min(2, Math.max(0.5, toNumber(input.scale, 1)))
  if (input.boxed !== undefined) out.boxed = Boolean(input.boxed)
  if (input.isActive !== undefined) out.isActive = Boolean(input.isActive)
  if (input.sortOrder !== undefined) out.sortOrder = Math.trunc(toNumber(input.sortOrder, 0))
  return out
}

function assertCreatable(data) {
  if (!data.name) throw new AppError("Company name is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  if (!data.logoUrl) throw new AppError("A logo image is required", { statusCode: 400, code: "VALIDATION_ERROR" })
}

async function createClientLogo(input) {
  const data = shape(input)
  assertCreatable(data)
  if (!data.slug) data.slug = slugify(data.name)
  if (data.sortOrder === undefined) {
    // New logos land at the end of the wall rather than silently at the front.
    const last = await prisma.clientLogo.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
    data.sortOrder = (last?.sortOrder ?? -1) + 1
  }
  try {
    return serialize(await prisma.clientLogo.create({ data }))
  } catch (e) {
    if (e?.code === "P2002") throw new AppError("A client with that slug already exists", { statusCode: 409, code: "CONFLICT" })
    throw e
  }
}

async function updateClientLogo(id, input) {
  const data = shape(input, { partial: true })
  if (data.name === "") throw new AppError("Company name cannot be empty", { statusCode: 400, code: "VALIDATION_ERROR" })
  try {
    return serialize(await prisma.clientLogo.update({ where: { id: String(id) }, data }))
  } catch (e) {
    if (e?.code === "P2025") throw new AppError("Client logo not found", { statusCode: 404, code: "NOT_FOUND" })
    if (e?.code === "P2002") throw new AppError("A client with that slug already exists", { statusCode: 409, code: "CONFLICT" })
    throw e
  }
}

async function deleteClientLogo(id) {
  try {
    await prisma.clientLogo.delete({ where: { id: String(id) } })
    return { id: String(id) }
  } catch (e) {
    if (e?.code === "P2025") throw new AppError("Client logo not found", { statusCode: 404, code: "NOT_FOUND" })
    throw e
  }
}

/** Persist a whole ordering in one transaction — used by the drag handles. */
async function reorderClientLogos(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("ids must be a non-empty array", { statusCode: 400, code: "VALIDATION_ERROR" })
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.clientLogo.update({ where: { id: String(id) }, data: { sortOrder: index } })
    )
  )
  return listAdminClientLogos()
}

module.exports = {
  slugify,
  listPublicClientLogos,
  listAdminClientLogos,
  createClientLogo,
  updateClientLogo,
  deleteClientLogo,
  reorderClientLogos,
}
