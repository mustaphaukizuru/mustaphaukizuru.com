#!/usr/bin/env node
/**
 * scripts/migrate-jitsi-to-meet.js · one-shot upgrade
 *
 * Walks every `confirmed` consultation that's still in the future and whose
 * meetingProvider is `manual` (= Jitsi fallback, populated before the
 * Google Calendar integration shipped), creates a Google Calendar event
 * with a Meet link for it, and updates the row with the new link +
 * meetingProvider=google_meet + googleEventId.
 *
 * Default mode is DRY RUN — prints what it WOULD do without touching
 * Google or the DB. Add `--apply` to perform the migration for real.
 *
 * Usage (run from the repo root on whichever host has the env vars set):
 *
 *   # See what would change (safe to re-run any time):
 *   node scripts/migrate-jitsi-to-meet.js
 *
 *   # Actually apply the changes:
 *   node scripts/migrate-jitsi-to-meet.js --apply
 *
 * Idempotent — re-running after a successful migration finds nothing to do.
 * Past / cancelled / already-Google bookings are skipped automatically.
 *
 * What gets written to each upgraded row:
 *   - meetingLink       → https://meet.google.com/...
 *   - meetingProvider   → google_meet
 *   - googleEventId     → the new Calendar event id (for reschedule/cancel sync)
 *
 * What does NOT happen (intentional):
 *   - No email is sent to the attendee. The Calendar API's
 *     `sendUpdates: "all"` inside createCalendarEvent dispatches Google's
 *     native invite, which is enough — the client gets the Meet link
 *     immediately on their calendar. No need to fire a second branded
 *     email and confuse the attendee with "your meeting moved" when the
 *     time and host didn't actually change.
 *
 * Failure handling:
 *   - Each row's API call is wrapped in try/catch. A single failure does
 *     NOT halt the loop — failures are logged with the consultation id
 *     and skipped. Final summary reports counts: upgraded / skipped /
 *     failed.
 */

require("dotenv").config()
const prisma         = require("../src/lib/prisma")
const googleCalendar = require("../src/lib/googleCalendar")

const APPLY = process.argv.includes("--apply")

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
}

async function main() {
  console.log(c.bold("\nmigrate-jitsi-to-meet"))
  console.log(c.dim("─".repeat(70)))
  console.log("Mode: " + (APPLY ? c.red("APPLY (will mutate DB + create Calendar events)") : c.cyan("DRY RUN (no changes)")))
  console.log()

  if (!googleCalendar.isConfigured()) {
    console.error(c.red("✗ Google Calendar is not configured."))
    console.error("  Check .env.production has GOOGLE_OAUTH_* vars set and pm2 was restarted with --update-env.")
    process.exit(1)
  }
  console.log(c.green("✓ Google Calendar configured"))

  // Pull every future-dated, confirmed booking that's not already on Google
  // Meet. The `meetingLink` filter excludes rows that happen to be `manual`
  // for other reasons (eg admin pasted a Zoom link).
  const candidates = await prisma.consultation.findMany({
    where: {
      status:          "confirmed",
      scheduledAt:     { gt: new Date() },
      meetingProvider: "manual",
      meetingLink:     { contains: "meet.jit.si" },
    },
    include: {
      user:    { select: { id: true, fullName: true, email: true } },
      service: { select: { id: true, title: true } },
    },
    orderBy: { scheduledAt: "asc" },
  })

  console.log(`Found ${c.bold(candidates.length)} upcoming Jitsi booking(s) to upgrade.`)
  console.log()

  if (candidates.length === 0) {
    console.log(c.green("Nothing to do. ✓"))
    await prisma.$disconnect()
    return
  }

  let upgraded = 0
  let failed   = 0
  let skipped  = 0

  for (const row of candidates) {
    const label = `[${row.id}] ${row.user?.email || "<no email>"} · ${row.scheduledAt.toISOString()}`

    if (!row.user?.email) {
      console.log(`  ${c.yellow("⊘ SKIP")}  ${label}  (no attendee email)`)
      skipped += 1
      continue
    }

    if (!APPLY) {
      console.log(`  ${c.cyan("→ WOULD UPGRADE")}  ${label}`)
      console.log(`     ${c.dim("old:")} ${row.meetingLink}`)
      upgraded += 1
      continue
    }

    try {
      const event = await googleCalendar.createCalendarEvent({
        summary: `${row.service?.title || "Consulting session"} · ${row.user.fullName || "Client"}`,
        description:
          `Consultation booked via mustaphaukizuru.com\n\n` +
          (row.clientNotes ? `Client notes:\n${row.clientNotes}\n\n` : "") +
          `Booking ID: ${row.id}\n` +
          `(Migrated from Jitsi to Google Meet by scripts/migrate-jitsi-to-meet.js)`,
        start:          row.scheduledAt,
        end:            row.endsAt || new Date(row.scheduledAt.getTime() + (row.durationMin || 30) * 60_000),
        timezone:       row.timezone || "UTC",
        attendeeEmail:  row.user.email,
        attendeeName:   row.user.fullName,
        consultationId: row.id,
      })

      await prisma.consultation.update({
        where: { id: row.id },
        data: {
          meetingLink:     event.meetLink,
          meetingProvider: "google_meet",
          googleEventId:   event.eventId,
        },
      })

      console.log(`  ${c.green("✓ UPGRADED")}  ${label}`)
      console.log(`     ${c.dim("new:")} ${event.meetLink}`)
      upgraded += 1
    } catch (err) {
      console.log(`  ${c.red("✗ FAILED")}    ${label}`)
      console.log(`     ${c.dim(err?.message || err)}`)
      failed += 1
    }
  }

  console.log()
  console.log(c.dim("─".repeat(70)))
  if (APPLY) {
    console.log(c.green(`  ${upgraded} upgraded`) + "  ·  " +
                c.yellow(`${skipped} skipped`) + "  ·  " +
                (failed > 0 ? c.red(`${failed} failed`) : c.dim(`${failed} failed`)))
  } else {
    console.log(c.cyan(`  Would upgrade ${upgraded} (skip ${skipped}).`))
    console.log(c.dim("  Re-run with --apply to perform the migration."))
  }
  console.log()

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(c.red("\n[migrate] uncaught:"), err?.message || err)
  if (err?.stack) console.error(c.dim(err.stack))
  await prisma.$disconnect().catch(() => null)
  process.exit(1)
})
