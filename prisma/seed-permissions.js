// @ts-check
/**
 * seed-permissions.js · upsert AdminPermission rows from the registry.
 *
 * Idempotent — running this script multiple times only adds new keys; it
 * never deletes a permission (keys may still be referenced by RolePermission
 * rows). To deprecate a permission, manually delete from the registry +
 * the AdminPermission table after migrating consumers.
 *
 * Usage:
 *   node prisma/seed-permissions.js
 */

const prisma = require("../src/lib/prisma")
const { ALL_PERMISSIONS } = require("../src/config/permissions")

async function main() {
  console.log(`[seed-permissions] upserting ${ALL_PERMISSIONS.length} keys...`)
  let created = 0, updated = 0
  for (const p of ALL_PERMISSIONS) {
    const existing = await prisma.adminPermission.findUnique({ where: { key: p.key } })
    if (existing) {
      if (existing.label !== p.label) {
        await prisma.adminPermission.update({ where: { key: p.key }, data: { label: p.label } })
        updated += 1
      }
    } else {
      await prisma.adminPermission.create({ data: { key: p.key, label: p.label } })
      created += 1
    }
  }
  console.log(`[seed-permissions] done · created=${created} · updated=${updated}`)
  process.exit(0)
}

main().catch((err) => {
  console.error("[seed-permissions] failed:", err)
  process.exit(1)
})
