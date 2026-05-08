/**
 * B10 · Input validation helpers
 *
 * Lightweight, dependency-free validators for new endpoints. Each helper
 * either returns the cleaned value or throws an error with statusCode=400
 * and code="VALIDATION_ERROR" — picked up by the global errorHandler and
 * shaped into a 400 response with the canonical error code.
 *
 * Usage:
 *
 *   const { requireEmail, requireString, requireUuid } = require("../utils/validators")
 *
 *   const email = requireEmail(req.body.email, "email")
 *   const name  = requireString(req.body.name, "name", { min: 2, max: 100 })
 *   const id    = requireUuid(req.params.id, "id")
 *
 * Existing controllers continue to use their inline validation — this is for
 * NEW code being added going forward.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// cuid (default Prisma id) format · 25-char base36 string starting with "c"
const CUID_RE = /^c[a-z0-9]{24}$/i

// uuid v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validationError(message, details = null) {
  const err = new Error(message)
  err.statusCode = 400
  err.code = "VALIDATION_ERROR"
  if (details) err.details = details
  return err
}

/**
 * Require a non-empty trimmed string. Optional min/max length.
 */
function requireString(value, fieldName, { min = 1, max = 10000 } = {}) {
  if (typeof value !== "string") {
    throw validationError(`${fieldName} is required`, { field: fieldName, expected: "string" })
  }
  const trimmed = value.trim()
  if (trimmed.length < min) {
    throw validationError(
      `${fieldName} must be at least ${min} character${min === 1 ? "" : "s"}`,
      { field: fieldName, min },
    )
  }
  if (trimmed.length > max) {
    throw validationError(
      `${fieldName} must be at most ${max} characters`,
      { field: fieldName, max },
    )
  }
  return trimmed
}

/**
 * Optional string — returns trimmed value or null. Length checked when present.
 */
function optionalString(value, fieldName, { max = 10000 } = {}) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") {
    throw validationError(`${fieldName} must be a string`, { field: fieldName })
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > max) {
    throw validationError(`${fieldName} must be at most ${max} characters`, { field: fieldName, max })
  }
  return trimmed
}

/**
 * Require a valid email. Returns lowercased trimmed value.
 */
function requireEmail(value, fieldName = "email") {
  const s = requireString(value, fieldName, { max: 320 })
  const lowered = s.toLowerCase()
  if (!EMAIL_RE.test(lowered)) {
    throw validationError(`${fieldName} is not a valid email address`, { field: fieldName })
  }
  return lowered
}

/**
 * Require a cuid or uuid id. Defaults to accepting either format since this
 * codebase uses cuids.
 */
function requireId(value, fieldName = "id") {
  const s = requireString(value, fieldName, { max: 64 })
  if (!CUID_RE.test(s) && !UUID_RE.test(s)) {
    throw validationError(`${fieldName} is not a valid identifier`, { field: fieldName })
  }
  return s
}

/**
 * Require a uuid v4 specifically.
 */
function requireUuid(value, fieldName = "id") {
  const s = requireString(value, fieldName, { max: 64 })
  if (!UUID_RE.test(s)) {
    throw validationError(`${fieldName} is not a valid UUID`, { field: fieldName })
  }
  return s
}

/**
 * Require a number. `{ min, max, integer }` optional.
 */
function requireNumber(value, fieldName, { min, max, integer = false } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw validationError(`${fieldName} must be a number`, { field: fieldName })
  }
  if (integer && !Number.isInteger(n)) {
    throw validationError(`${fieldName} must be an integer`, { field: fieldName })
  }
  if (min !== undefined && n < min) {
    throw validationError(`${fieldName} must be at least ${min}`, { field: fieldName, min })
  }
  if (max !== undefined && n > max) {
    throw validationError(`${fieldName} must be at most ${max}`, { field: fieldName, max })
  }
  return n
}

/**
 * Require one of a fixed set of values.
 */
function requireEnum(value, fieldName, allowed) {
  if (!allowed.includes(value)) {
    throw validationError(
      `${fieldName} must be one of: ${allowed.join(", ")}`,
      { field: fieldName, allowed },
    )
  }
  return value
}

/**
 * Require an array. Optional min/max length, optional item validator.
 */
function requireArray(value, fieldName, { min = 0, max = Infinity, itemValidator = null } = {}) {
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} must be an array`, { field: fieldName })
  }
  if (value.length < min) {
    throw validationError(`${fieldName} must contain at least ${min} item${min === 1 ? "" : "s"}`, { field: fieldName, min })
  }
  if (value.length > max) {
    throw validationError(`${fieldName} must contain at most ${max} items`, { field: fieldName, max })
  }
  if (itemValidator) {
    return value.map((item, i) => itemValidator(item, `${fieldName}[${i}]`))
  }
  return value
}

module.exports = {
  validationError,
  requireString,
  optionalString,
  requireEmail,
  requireId,
  requireUuid,
  requireNumber,
  requireEnum,
  requireArray,
}
