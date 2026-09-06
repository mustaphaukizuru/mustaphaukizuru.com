#!/usr/bin/env node
/**
 * fix-store-products.js · T2-4
 *
 * Two things the products seed got wrong are already in the database, and the
 * seed cannot correct either — its `update` branch deliberately touches only
 * marketing copy so that admin edits survive a re-run.
 *
 * 1. THREE SERVICES SOLD AS PRODUCTS.
 *    consulting-session-package (150), website-system-setup (300) and
 *    infrastructure-audit (120) are engagements, not files. They went through
 *    the store checkout like a downloadable PDF: no call, no proposal, no
 *    scope — and they undercut the catalogue offerings describing the same
 *    work by more than an order of magnitude. They are gone from the seed;
 *    this soft-deletes the rows. The consulting session is now the free
 *    discovery call at /book; the other two are ServicePackage rows under
 *    their category.
 *
 * 2. USD FIGURES IN AN MXN COLUMN.
 *    The six downloads were authored at 10 to 18 and written into a column
 *    the whole platform reads as MXN, so a toolkit was on sale for about
 *    USD 0.50 — under the payment-processing fee on the transaction. They are
 *    multiplied by the catalogue's own basis, a flat 20 MXN/USD, which is
 *    what the seed now derives too.
 *
 * Soft delete, not delete: an OrderItem may reference a product, and removing
 * the row would take that line of order history with it.
 *
 * Usage — local:
 *   node scripts/fix-store-products.js --dry-run
 *   node scripts/fix-store-products.js
 *   node scripts/fix-store-products.js --undo
 *
 * Usage — production, the owner's deliberate step, AFTER a backup:
 *   node scripts/backup-db-json.js
 *   ALLOW_PROD_DB=1 node scripts/fix-store-products.js --dry-run
 *   ALLOW_PROD_DB=1 node scripts/fix-store-products.js
 *
 * OWNER: step 2 raises six live prices twentyfold. That is the correction,
 * not a change of policy — but read the dry-run before running it for real.
 */

// The Prisma client loads .env from beside the schema it was generated
// against; a bare dotenv.config() resolves from cwd and finds nothing in a
// git worktree. Requiring it first is what puts DATABASE_URL in the
// environment, and the guard below refuses to run without it.
const prisma = require("../src/lib/prisma")

const { assertLocalDatabase } = require("./guard-prod-db")

assertLocalDatabase("fix-store-products.js")

// Same constant as prisma/seed/products-seed.js and servicesCatalogue.js.
const MXN_PER_USD = 20

// Retire: services that were shaped as products.
const RETIRE = ["consulting-session-package", "website-system-setup", "infrastructure-audit"]

// Reprice: the real downloads, authored in USD.
const REPRICE = [
  "digital-transformation-starter-toolkit",
  "weekly-content-calendar",
  "stem-program-planning-pack",
  "school-it-audit-checklist",
  "website-launch-planning-kit",
  "digital-workflow-optimization-pack",
]

// Above this, a price is already in MXN and must not be multiplied again —
// what makes this script safe to run twice.
const MXN_FLOOR = 50

const args = new Set(process.argv.slice(2))
const DRY = args.has("--dry-run")
const UNDO = args.has("--undo")

async function main() {
  const rows = await prisma.product.findMany({
    where: { slug: { in: [...RETIRE, ...REPRICE] } },
    select: { id: true, slug: true, price: true, currency: true, status: true, isActive: true, deletedAt: true },
    orderBy: { slug: "asc" },
  })
  if (!rows.length) {
    console.log("Nothing to do — none of these slugs exist in this database.")
    return
  }

  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  const retireTargets = []
  const repriceTargets = []

  console.log("\nServices sold as products:")
  for (const slug of RETIRE) {
    const row = bySlug.get(slug)
    if (!row) { console.log(`  ${slug.padEnd(40)} not present`); continue }
    const retired = Boolean(row.deletedAt)
    console.log(`  ${slug.padEnd(40)} ${retired ? "already retired" : `${row.status}, active=${row.isActive}`}`)
    if (UNDO ? retired : !retired) retireTargets.push(row)
  }

  console.log("\nDownload prices:")
  for (const slug of REPRICE) {
    const row = bySlug.get(slug)
    if (!row) { console.log(`  ${slug.padEnd(40)} not present`); continue }
    const current = Number(row.price)
    const next = UNDO ? current / MXN_PER_USD : current * MXN_PER_USD
    const needs = UNDO ? current >= MXN_FLOOR : current < MXN_FLOOR
    console.log(`  ${slug.padEnd(40)} ${String(current).padStart(7)} ${row.currency}` +
      (needs ? ` → ${next}` : "  (already correct, skipped)"))
    if (needs) repriceTargets.push({ row, next })
  }

  if (!retireTargets.length && !repriceTargets.length) {
    console.log("\nNothing to change — this database is already correct.")
    return
  }

  if (DRY) {
    console.log(`\n--dry-run: would ${UNDO ? "restore" : "retire"} ${retireTargets.length} row(s) ` +
      `and reprice ${repriceTargets.length}. Nothing written.`)
    return
  }

  if (retireTargets.length) {
    const { count } = await prisma.product.updateMany({
      where: { id: { in: retireTargets.map((r) => r.id) } },
      // isActive and status as well as deletedAt: the public reads filter on
      // different ones of the three depending on the query, and a row that is
      // half-retired is worse than either state.
      data: UNDO
        ? { deletedAt: null, isActive: true, status: "published" }
        : { deletedAt: new Date(), isActive: false, status: "archived" },
    })
    console.log(`\n${UNDO ? "Restored" : "Retired"} ${count} product row(s).`)
  }

  for (const { row, next } of repriceTargets) {
    await prisma.product.update({ where: { id: row.id }, data: { price: next, currency: "MXN" } })
  }
  if (repriceTargets.length) console.log(`Repriced ${repriceTargets.length} download(s).`)
  console.log("Orders and order items are untouched.")
}

main()
  .catch((err) => {
    console.error(`fix-store-products failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
