#!/usr/bin/env node
/**
 * retire-legacy-services.js · T2-4
 *
 * The Service table carries four rows from the taxonomy that preceded the
 * closed set of four catalogue categories:
 *
 *   branding-digital-presence
 *   digital-transformation-consulting
 *   it-infrastructure
 *   cloud-migration-automation
 *
 * They are published, they appear in the public listing beside the real
 * categories, and each has its own /services/<slug> page — so the site sells
 * eight services against a catalogue of four, at prices nothing else agrees
 * with. prisma/seed/services-seed.js no longer contains them, so this is the
 * one-off that retires what is already in the database.
 *
 * SOFT delete, deliberately. The plan said to delete the rows outright if
 * nothing referenced them; something does — ServiceOrder rows point at all
 * four (17 of them in the local dataset alone), and deleting a Service that
 * an order references either orphans the order or cascades it away. Either
 * one destroys sales history to tidy a listing. Setting `deletedAt` hides
 * them from every public read (the reads all filter on it), leaves the orders
 * intact and readable in the admin, and is reversible with one UPDATE.
 *
 * Usage — local:
 *   node scripts/retire-legacy-services.js
 *   node scripts/retire-legacy-services.js --dry-run
 *   node scripts/retire-legacy-services.js --undo
 *
 * Usage — production, the owner's deliberate step, AFTER a backup:
 *   node scripts/backup-db-json.js
 *   ALLOW_PROD_DB=1 node scripts/retire-legacy-services.js --dry-run
 *   ALLOW_PROD_DB=1 node scripts/retire-legacy-services.js
 */

// Order matters, and the seeds do the same thing for the same reason: the
// Prisma client loads .env itself (from beside the schema it was generated
// against), while a bare dotenv.config() resolves from cwd and finds nothing
// in a git worktree. Requiring the client first is therefore what puts
// DATABASE_URL in the environment — and the guard below refuses to run at all
// without it. The client is lazy, so nothing connects until the first query.
const prisma = require("../src/lib/prisma")

const { assertLocalDatabase } = require("./guard-prod-db")

// Same guard as db:push: refuses a non-local host unless ALLOW_PROD_DB=1 is
// set on purpose. Unlike the seed scripts this one is MEANT to run against
// production eventually — retiring the rows is the point — so it keeps the
// override rather than blocking outright.
assertLocalDatabase("retire-legacy-services.js")

const LEGACY_SLUGS = [
  "branding-digital-presence",
  "digital-transformation-consulting",
  "it-infrastructure",
  "cloud-migration-automation",
]

const args = new Set(process.argv.slice(2))
const DRY = args.has("--dry-run")
const UNDO = args.has("--undo")

async function main() {
  const rows = await prisma.service.findMany({
    where: { slug: { in: LEGACY_SLUGS } },
    select: { id: true, slug: true, title: true, deletedAt: true, status: true },
    orderBy: { slug: "asc" },
  })

  if (!rows.length) {
    console.log("Nothing to do — none of the legacy slugs exist in this database.")
    return
  }

  const missing = LEGACY_SLUGS.filter((slug) => !rows.some((r) => r.slug === slug))
  if (missing.length) console.log(`Not present (already gone): ${missing.join(", ")}`)

  for (const row of rows) {
    const orders = await prisma.serviceOrder.count({ where: { serviceId: row.id } })
    const state = row.deletedAt ? `retired ${row.deletedAt.toISOString().slice(0, 10)}` : row.status
    console.log(`  ${row.slug.padEnd(36)} ${state.padEnd(22)} ${orders} order(s) reference it`)
  }

  const targets = UNDO
    ? rows.filter((r) => r.deletedAt)
    : rows.filter((r) => !r.deletedAt)

  if (!targets.length) {
    console.log(UNDO ? "\nNothing to restore." : "\nAll four are already retired.")
    return
  }

  if (DRY) {
    console.log(`\n--dry-run: would ${UNDO ? "restore" : "retire"} ${targets.length} row(s). Nothing written.`)
    return
  }

  const result = await prisma.service.updateMany({
    where: { id: { in: targets.map((r) => r.id) } },
    data: { deletedAt: UNDO ? null : new Date() },
  })

  console.log(`\n${UNDO ? "Restored" : "Retired"} ${result.count} service row(s).`)
  console.log("Orders, packages and features are untouched; only public reads change.")
}

main()
  .catch((err) => {
    console.error(`retire-legacy-services failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
