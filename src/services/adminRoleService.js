// @ts-check
/**
 * adminRoleService.js · admin operations on Role + RolePermission tables.
 *
 * The platform uses a many-to-many model: User <-> UserRole <-> Role,
 * Role <-> RolePermission <-> AdminPermission. Roles are the authoring
 * unit for the admin team; permissions are the atomic capability flags.
 *
 * Schema reference (prisma/schema.prisma):
 *   Role.userRoles        — UserRole[]
 *   Role.rolePermissions  — RolePermission[]   (no `permissions`, no `users`)
 *   Role has no `isSystem` and no `updatedAt`.
 */

const prisma = require("../lib/prisma")

// Names treated as "system" roles — protected from delete via runtime guard
// since the schema has no `isSystem` flag column.
const SYSTEM_ROLE_NAMES = new Set(["admin", "super_admin", "owner", "member"])

function isSystemRole(role) {
  return role && SYSTEM_ROLE_NAMES.has(String(role.name || "").toLowerCase())
}

function serializeRole(r) {
  return {
    id:          r.id,
    name:        r.name,
    description: r.description || null,
    isSystem:    isSystemRole(r),
    permissions: (r.rolePermissions || []).map((rp) => ({
      id:    rp.permission.id,
      key:   rp.permission.key,
      label: rp.permission.label,
    })),
    userCount: r._count?.userRoles ?? 0,
    createdAt: r.createdAt?.toISOString?.() || null,
  }
}

async function listRoles() {
  const rows = await prisma.role.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      _count:          { select: { userRoles: true } },
      rolePermissions: { include: { permission: true } },
    },
    take: 200,
  })
  return rows.map(serializeRole)
}

async function listPermissions() {
  return prisma.adminPermission.findMany({
    orderBy: [{ key: "asc" }],
    take: 500,
  })
}

async function createRole({ name, description = null, permissionIds = [] }) {
  const role = await prisma.role.create({
    data: {
      name,
      description,
      rolePermissions: {
        create: (permissionIds || []).map((permissionId) => ({ permissionId })),
      },
    },
    include: {
      _count:          { select: { userRoles: true } },
      rolePermissions: { include: { permission: true } },
    },
  })
  return serializeRole(role)
}

async function updateRole(id, { name, description, permissionIds }) {
  // Reset the permission set when explicitly provided.
  return prisma.$transaction(async (tx) => {
    if (Array.isArray(permissionIds)) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        })
      }
    }
    const data = {}
    if (typeof name === "string" && name.trim()) data.name = name.trim()
    if (typeof description === "string" || description === null) data.description = description
    const updated = await tx.role.update({
      where: { id },
      data,
      include: {
        _count:          { select: { userRoles: true } },
        rolePermissions: { include: { permission: true } },
      },
    })
    return serializeRole(updated)
  })
}

async function deleteRole(id) {
  // Block deletion of system roles by name (no schema flag).
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, name: true },
  })
  if (!role) return { id }
  if (isSystemRole(role)) {
    const err = new Error("System roles cannot be deleted.")
    err.statusCode = 400
    throw err
  }
  await prisma.role.delete({ where: { id } })
  return { id }
}

module.exports = { listRoles, listPermissions, createRole, updateRole, deleteRole }
