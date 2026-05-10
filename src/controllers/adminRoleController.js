// @ts-check
/**
 * adminRoleController.js · /api/v1/admin/roles
 *
 * Phase 9.2d · refactored to asyncHandler. Verbose try/catch+next removed;
 * errors flow to the central errorHandler middleware unchanged.
 */

const roles        = require("../services/adminRoleService")
const asyncHandler = require("../utils/asyncHandler")

const list = asyncHandler(async (_req, res) => {
  res.json({ roles: await roles.listRoles() })
})

const permissions = asyncHandler(async (_req, res) => {
  res.json({ permissions: await roles.listPermissions() })
})

const create = asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body || {}
  if (!name) return res.status(400).json({ error: "name is required" })
  const role = await roles.createRole({ name, description, permissionIds })
  res.status(201).json({ role })
})

const update = asyncHandler(async (req, res) => {
  const role = await roles.updateRole(req.params.id, req.body || {})
  res.json({ role })
})

const remove = asyncHandler(async (req, res) => {
  await roles.deleteRole(req.params.id)
  res.status(204).end()
})

module.exports = { list, permissions, create, update, remove }
