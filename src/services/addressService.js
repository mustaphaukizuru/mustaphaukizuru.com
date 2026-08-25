const prisma = require("../lib/prisma")

/**
 * Address service (B08)
 *
 * Saved billing/shipping addresses per user. One `isDefault = true` allowed
 * per user, enforced via a transaction on create (when flagged) and on
 * setAsDefault. The first address a user saves is always default.
 *
 * `country` is ISO 3166-1 alpha-2 (e.g. "MX"). Validation is intentionally
 * permissive — we require the essentials (line1, city, postalCode, country,
 * fullName) but let the frontend handle per-country nuance (e.g. Mexican RFC
 * only shows when country = MX).
 */

const REQUIRED_FIELDS = ["fullName", "line1", "city", "postalCode", "country"]

/* ── Validation ──────────────────────────────────────────────────────── */

function validate(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw validationError("Invalid payload")
  }

  const missing = []
  for (const f of REQUIRED_FIELDS) {
    if (partial && !(f in payload)) continue
    if (!payload[f] || String(payload[f]).trim().length === 0) missing.push(f)
  }
  if (missing.length > 0) {
    throw validationError(`Missing required field(s): ${missing.join(", ")}`)
  }

  if (payload.country) {
    const c = String(payload.country).trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(c)) {
      throw validationError("`country` must be an ISO 3166-1 alpha-2 code (e.g. MX, US)")
    }
  }
}

function normalize(payload) {
  const out = {}
  const fields = [
    "label", "fullName", "company",
    "line1", "line2",
    "city", "state", "postalCode",
    "country", "taxId", "phone",
  ]
  for (const f of fields) {
    if (payload[f] === undefined) continue
    const val = payload[f]
    out[f] = val === null ? null : String(val).trim()
  }
  if (out.country) out.country = out.country.toUpperCase()
  if (out.isDefault !== undefined) out.isDefault = Boolean(payload.isDefault)
  return out
}

/* ── Read ────────────────────────────────────────────────────────────── */

async function list(userId) {
  return prisma.address.findMany({
    where:   { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take:    100,
  })
}

async function getById(userId, id) {
  return prisma.address.findFirst({ where: { id, userId } })
}

/* ── Create ──────────────────────────────────────────────────────────── */

async function create(userId, payload) {
  validate(payload)
  const data = normalize(payload)
  const wantsDefault = data.isDefault === true

  // Count existing — first address always becomes default
  const existingCount = await prisma.address.count({ where: { userId } })
  const makeDefault = existingCount === 0 || wantsDefault

  if (makeDefault) {
    // Clear any other default in a transaction
    return prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data:  { isDefault: false },
      })
      return tx.address.create({
        data: { ...data, userId, isDefault: true },
      })
    })
  }

  return prisma.address.create({ data: { ...data, userId, isDefault: false } })
}

/* ── Update ──────────────────────────────────────────────────────────── */

async function update(userId, id, payload) {
  validate(payload, { partial: true })
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) return null

  const data = normalize(payload)
  const wantsDefault = data.isDefault === true
  const unDefaulting = data.isDefault === false && existing.isDefault

  if (wantsDefault && !existing.isDefault) {
    return prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data:  { isDefault: false },
      })
      return tx.address.update({ where: { id }, data: { ...data, isDefault: true } })
    })
  }

  if (unDefaulting) {
    // User is manually turning off default — allow it. They'll need to set
    // another one manually; we don't auto-promote.
    return prisma.address.update({ where: { id }, data })
  }

  return prisma.address.update({ where: { id }, data })
}

/* ── Delete ──────────────────────────────────────────────────────────── */

async function remove(userId, id) {
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) return null
  await prisma.address.delete({ where: { id } })
  // Per spec: deleting the default leaves no default until user re-marks one.
  // We intentionally do NOT auto-promote another address.
  return { id, removed: true }
}

/* ── Set default ─────────────────────────────────────────────────────── */

async function setAsDefault(userId, id) {
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) return null

  return prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId, isDefault: true, NOT: { id } },
      data:  { isDefault: false },
    })
    return tx.address.update({ where: { id }, data: { isDefault: true } })
  })
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function validationError(message, statusCode = 400) {
  const err = new Error(message)
  err.code = "VALIDATION_ERROR"
  err.statusCode = statusCode
  return err
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setAsDefault,
}
