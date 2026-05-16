#!/usr/bin/env node
/**
 * scripts/heal-consultation-links.js · backfill missing Meet links
 *
 * Run AFTER `npm run google:bootstrap` + `npm run google:verify` have
 * confirmed Google Calendar is configured and reachable.
 *
 * Background:
 *   When Google Calendar is misconfigured (missing env vars OR malformed
 *   refresh token), consultationService.bookConsultation still succeeds
 *   but stores the row with `meetingLink=null` and
 *   `meetingProvider="manual"` — by design, so a Calendar API outage
 *   never blocks the booking itself.
 *
 *   Once the config is fixed, the admin can either heal each row
 *   one-at-a-time via the dashboard (which calls
 *   POST /api/v1/admin/consultations/:id/regenerate-link) OR run this
 *   script, which scans the DB and calls the same `adminRegenerateMeetingLink`
 *   service function for every affected upcoming consultation.
 *
 * What "affected" means here:
 *   · status IN ('pending', 'confirmed')     — terminal rows are skipped
 *                                              (cancelled / completed /
 *                                              no_show / rescheduled)
 *   · scheduledAt >= now()                   — past meetings can't have
 *                                              a usable join link anyway
 *   · meetingLink IS NULL                    — already-linked rows skipped
 *
 * Usage:
 *   npm run consultations:heal-links             # process all affected rows
 *   npm run consultations:heal-links -- --dry    # report only, no writes
 *   npm run consultations:heal-links -- --id=X   # single consultation by id
 *
 * Exit codes:
 *   0 — completed (may include per-row failures, summary at the end)
 *   1 — fatal: Google Calendar not configured, DB unreachable, etc.
 */

require("dotenv").config()

const prisma          = require("../src/lib/prisma")
const googleCalendar  = require("../src/lib/googleCalendar")
const { adminRegenerateMeetingLink } = require("../src/services/consultationService")

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
}

function parseArgs(argv) {
  const args = { dry: false, id: null }
  for (const a of argv.slice(2)) {
    if (a === "--dry" || a === "--dry-run") args.dry = true
    else if (a.startsWith("--id=")) args.id = a.slice("--id=".length)
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)

  console.log(c.bold("\nConsultation Meet-link healer"))
  console.log(c.dim("─".repeat(60)))

  // Pre-flight: refuse to run unless Google Calendar is actually working.
  // Without this, the healer would just rewrite the same null state onto
  // every row — silently waste of a DB round-trip.
  if (!googleCalendar.isConfigured()) {
    console.error(c.red("✗ Google Calendar is not configured."))
    console.error(c.dim(`  ${googleCalendar.diagnoseConfig?.() || "diagnoseConfig unavailable"}`))
    console.error(c.dim("  Run  npm run google:bootstrap  first, then re-run this script."))
    process.exit(1)
  }
  console.log(c.green("✓ Google Calendar is configured"))

  // Build the where-clause. Skipping past meetings + terminal statuses
  // matches the same guards inside adminRegenerateMeetingLink so the
  // script doesn't fall into per-row failures it could have avoided.
  const where = args.id
    ? { id: args.id }
    : {
        status:      { in: ["pending", "confirmed"] },
        meetingLink: null,
        scheduledAt: { gte: new Date() },
      }

  const rows = await prisma.consultation.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      meetingProvider: true,
      meetingLink: true,
      user:    { select: { email: true, fullName: true } },
      service: { select: { title: true } },
    },
  })

  if (rows.length === 0) {
    console.log(c.green("\n✓ Nothing to heal — no affected consultations found."))
    await prisma.$disconnect()
    return
  }

  console.log(`\nFound ${c.bold(rows.length)} consultation(s) without a meeting link:\n`)
  rows.forEach((r, i) => {
    const when = new Date(r.scheduledAt).toISOString().replace("T", " ").slice(0, 16)
    const who  = r.user?.email || "(no user)"
    const what = r.service?.title || "(no service)"
    console.log(`  ${String(i + 1).padStart(2)}. ${c.dim(r.id)}  ${when}  ${who}  ${c.dim("· " + what)}`)
  })

  if (args.dry) {
    console.log(c.yellow("\n--dry: no changes made. Re-run without --dry to heal."))
    await prisma.$disconnect()
    return
  }

  console.log("\nHealing…\n")
  let ok = 0
  let failed = 0
  for (const row of rows) {
    try {
      const updated = await adminRegenerateMeetingLink({ id: row.id })
      if (updated.meetingLink) {
        console.log(`  ${c.green("✓")} ${row.id}  →  ${updated.meetingLink}`)
        ok++
      } else {
        // adminRegenerateMeetingLink succeeded but the provisioner still
        // returned null (Google API failure). Surface so the operator
        // knows there's a deeper problem than a missing refresh token.
        console.log(`  ${c.yellow("⚠")} ${row.id}  →  still no link (Google API call failed — see server logs)`)
        failed++
      }
    } catch (err) {
      console.log(`  ${c.red("✗")} ${row.id}  →  ${err?.message || err}`)
      failed++
    }
  }

  console.log("")
  console.log(c.dim("─".repeat(60)))
  console.log(`Summary: ${c.green(ok + " healed")}, ${failed > 0 ? c.red(failed + " failed") : "0 failed"}`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(c.red("\n[heal] uncaught:"), err?.message || err)
  if (err?.stack) console.error(c.dim(err.stack))
  try { await prisma.$disconnect() } catch { /* ignore */ }
  process.exit(1)
})
