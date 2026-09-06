#!/usr/bin/env node
/**
 * backfill-tracking-codes.js · T5-1
 *
 * Two things every project needs before the tracker is usable, neither of
 * which a schema push can supply:
 *
 *   1. a tracking code. The column is nullable so the push was safe on a
 *      populated table, but a project without a code cannot be looked up,
 *      printed on an invoice, or read down the phone.
 *
 *   2. one `project.created` event, dated from the project's own createdAt.
 *      Without it a project that predates the event log opens on an empty
 *      timeline, which reads as "nothing has happened" rather than "we
 *      started recording recently". A synthetic first entry is honest — it
 *      says the project was created, which it was, on the date it was.
 *
 * Idempotent: projects that already have a code or an event are skipped, so
 * running it twice changes nothing and running it after a partial failure
 * finishes the job.
 *
 * Usage — local:
 *   node scripts/backfill-tracking-codes.js --dry-run
 *   node scripts/backfill-tracking-codes.js
 *
 * Usage — production, the owner's deliberate step, AFTER a backup:
 *   node scripts/backup-db-json.js
 *   ALLOW_PROD_DB=1 node scripts/backfill-tracking-codes.js --dry-run
 *   ALLOW_PROD_DB=1 node scripts/backfill-tracking-codes.js
 */

// The Prisma client loads .env from beside the schema it was generated
// against; a bare dotenv.config() resolves from cwd and finds nothing in a
// git worktree. Requiring it first is what puts DATABASE_URL in the
// environment, and the guard below refuses to run without it.
const prisma = require("../src/lib/prisma")

const { assertLocalDatabase } = require("./guard-prod-db")

assertLocalDatabase("backfill-tracking-codes.js")

const { generateTrackingCode } = require("../src/utils/trackingCode")

const args = new Set(process.argv.slice(2))
const DRY = args.has("--dry-run")

async function main() {
  const projects = await prisma.clientProject.findMany({
    select: { id: true, projectName: true, trackingCode: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  if (!projects.length) {
    console.log("No projects — nothing to backfill.")
    return
  }

  const needCode = projects.filter((p) => !p.trackingCode)

  // One query rather than one per project: a project with any event already
  // has a timeline, and we are only filling in empty ones.
  const withEvents = await prisma.projectEvent.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true },
    distinct: ["projectId"],
  })
  const hasEvent = new Set(withEvents.map((e) => e.projectId))
  const needEvent = projects.filter((p) => !hasEvent.has(p.id))

  console.log(`${projects.length} project(s): ${needCode.length} need a code, ${needEvent.length} need a first event.`)

  if (DRY) {
    for (const p of needCode.slice(0, 10)) console.log(`  would code: ${p.projectName.slice(0, 48)}`)
    if (needCode.length > 10) console.log(`  …and ${needCode.length - 10} more`)
    console.log("\n--dry-run: nothing written.")
    return
  }

  let coded = 0
  for (const project of needCode) {
    // Retry in place rather than through withUniqueTrackingCode: this loop
    // owns the row and can afford to be explicit about giving up on one
    // project without abandoning the rest of the batch.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await prisma.clientProject.update({
          where: { id: project.id },
          data: { trackingCode: generateTrackingCode() },
        })
        coded += 1
        break
      } catch (err) {
        const collision = err?.code === "P2002" && String(err?.meta?.target || "").includes("trackingCode")
        if (!collision) {
          console.error(`  ! ${project.id}: ${err.message}`)
          break
        }
      }
    }
  }

  let seeded = 0
  if (needEvent.length) {
    // createMany, so one round trip covers the batch. `createdAt` is set
    // explicitly to the project's own date — the timeline must read as the
    // project's history, not as the history of this script's run.
    const result = await prisma.projectEvent.createMany({
      data: needEvent.map((p) => ({
        projectId: p.id,
        type: "project.created",
        title: "Project created",
        titleEs: "Proyecto creado",
        actorRole: "system",
        visibility: "public",
        createdAt: p.createdAt,
      })),
      skipDuplicates: true,
    })
    seeded = result.count
  }

  console.log(`\nAssigned ${coded} tracking code(s); wrote ${seeded} first event(s).`)

  const remaining = await prisma.clientProject.count({ where: { trackingCode: null } })
  if (remaining) console.warn(`⚠ ${remaining} project(s) still without a code — re-run to finish.`)
}

main()
  .catch((err) => {
    console.error(`backfill-tracking-codes failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
