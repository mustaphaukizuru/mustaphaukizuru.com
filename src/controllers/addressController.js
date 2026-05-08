const asyncHandler = require("../utils/asyncHandler")
const addressService = require("../services/addressService")

/**
 * Address controller (B08)
 * All routes require auth — mounted under `/api/member/addresses`.
 */

const list = asyncHandler(async (req, res) => {
  const items = await addressService.list(req.user.id)
  res.json({ success: true, data: items })
})

const getOne = asyncHandler(async (req, res) => {
  const row = await addressService.getById(req.user.id, req.params.id)
  if (!row) return notFound(res)
  res.json({ success: true, data: row })
})

const create = asyncHandler(async (req, res) => {
  try {
    const row = await addressService.create(req.user.id, req.body || {})
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(err.statusCode || 400).json({
        success: false, code: err.code, message: err.message,
      })
    }
    throw err
  }
})

const update = asyncHandler(async (req, res) => {
  try {
    const row = await addressService.update(req.user.id, req.params.id, req.body || {})
    if (!row) return notFound(res)
    res.json({ success: true, data: row })
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(err.statusCode || 400).json({
        success: false, code: err.code, message: err.message,
      })
    }
    throw err
  }
})

const remove = asyncHandler(async (req, res) => {
  const result = await addressService.remove(req.user.id, req.params.id)
  if (!result) return notFound(res)
  res.json({ success: true, data: result })
})

const setDefault = asyncHandler(async (req, res) => {
  const row = await addressService.setAsDefault(req.user.id, req.params.id)
  if (!row) return notFound(res)
  res.json({ success: true, data: row })
})

function notFound(res) {
  return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Address not found" })
}

module.exports = { list, getOne, create, update, remove, setDefault }
