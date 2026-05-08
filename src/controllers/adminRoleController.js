// @ts-check
/**
 * adminRoleController.js · /api/v1/admin/roles
 */

const roles = require("../services/adminRoleService")

async function list(req, res, next) {
  try {
    res.json({ roles: await roles.listRoles() })
  } catch (err) { next(err) }
}

async function permissions(req, res, next) {
  try {
    res.json({ permissions: await roles.listPermissions() })
  } catch (err) { next(err) }
}

async function create(req, res, next) {
  try {
    const { name, description, permissionIds } = req.body || {}
    if (!name) return res.status(400).json({ error: "name is required" })
    const role = await roles.createRole({ name, description, permissionIds })
    res.status(201).json({ role })
  } catch (err) { next(err) }
}

async function update(req, res, next) {
  try {
    const role = await roles.updateRole(req.params.id, req.body || {})
    res.json({ role })
  } catch (err) { next(err) }
}

async function remove(req, res, next) {
  try {
    await roles.deleteRole(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { list, permissions, create, update, remove }
