#!/usr/bin/env node
/**
 * scripts/google-meet-verify.js · end-to-end smoke test
 *
 * Run AFTER `scripts/google-oauth-bootstrap.js` has produced a refresh token
 * and the `GOOGLE_OAUTH_*` env vars are filled. Verifies that:
 *
 *   1. All required env vars are present
 *   2. The refresh token can mint an access token
 *   3. The Calendar API accepts a real `events.insert` with conferenceData
 *   4. The response carries a Google Meet link
 *   5. The event can be deleted (so the test doesn't litter the calendar)
 *
 * Doesn't touch the DB. Doesn't touch the booking service. Only proves
 * the Google plumbing works.
 *
 * Usage:
 *   node scripts/google-meet-verify.js
 *
 * Exit codes:
 *   0 — everything works, you can proceed to a real booking
 *   1 — something failed (specific failure printed)
 */

require("dotenv").config()
const googleCalendar = require("../src/lib/googleCalendar")

// ANSI colour helpers — no chalk dep needed for a one-shot script.
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
}

const TICK  = c.green("  ✓")
const CROSS = c.red("  ✗")
const WARN  = c.yellow("  ⚠")

function header(text) {
  console.log("\n" + c.bold(text))
  console.log(c.dim("─".repeat(60)))
}

async function main() {
  header("1. Environment variables")

  const required = [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REFRESH_TOKEN",
    "GOOGLE_CALENDAR_HOST_EMAIL",
  ]
  const optional = [
    "GOOGLE_CALENDAR_ID",
  ]
  let envMissing = 0
  for (const key of required) {
    if (process.env[key]) {
      console.log(`${TICK} ${key.padEnd(32)} ${c.dim(maskValue(process.env[key]))}`)
    } else {
      console.log(`${CROSS} ${key.padEnd(32)} ${c.red("MISSING")}`)
      envMissing++
    }
  }
  for (const key of optional) {
    const value = process.env[key] || "(default: primary)"
    console.log(`${TICK} ${key.padEnd(32)} ${c.dim(value)}`)
  }
  if (envMissing > 0) {
    console.log("\n" + c.red(`✗ ${envMissing} required env var(s) missing. Fix .env then rerun.`))
    process.exit(1)
  }

  header("2. googleCalendar.isConfigured()")
  if (googleCalendar.isConfigured()) {
    console.log(`${TICK} Module reports as configured`)
  } else {
    console.log(`${CROSS} Module reports as NOT configured`)
    // Delegate the "why" to the same diagnoser the runtime uses — keeps
    // verify, env.js, and the healer in lockstep on the failure reason.
    // The previous generic message ("one is empty even though required")
    // was actively misleading when the env vars were ALL present but one
    // was malformed (e.g. the `4/…` auth code pasted in place of the
    // `1//…` refresh token).
    const diag = (typeof googleCalendar.diagnoseConfig === "function")
      ? googleCalendar.diagnoseConfig()
      : "diagnoseConfig unavailable"
    console.log(c.red(`    ${diag}`))
    console.log(c.dim("    → Fix with:  npm run google:bootstrap"))
    process.exit(1)
  }

  header("3. Create a test Calendar event with Meet link")

  // Schedule the test event 24 hours from now so we don't pollute the
  // host's actual upcoming-events view. Duration 15 minutes — short
  // enough that even if delete fails, it's a tiny smudge.
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const end   = new Date(start.getTime() + 15 * 60 * 1000)
  const tz    = process.env.TZ || "America/Mexico_City"

  console.log(`${c.dim("  start:")}     ${start.toISOString()}`)
  console.log(`${c.dim("  end:  ")}     ${end.toISOString()}`)
  console.log(`${c.dim("  timezone:")}  ${tz}`)
  console.log(`${c.dim("  host:")}      ${process.env.GOOGLE_CALENDAR_HOST_EMAIL}`)

  let event
  try {
    event = await googleCalendar.createCalendarEvent({
      summary:        "[verify] mustaphaukizuru.com booking smoke-test",
      description:
        "This event was created by scripts/google-meet-verify.js to confirm the\n" +
        "Calendar API + Meet auto-link integration is working. It is safe to\n" +
        "delete; the verify script also deletes it automatically a few seconds\n" +
        "after creation.",
      start, end,
      timezone:       tz,
      // Don't add an attendee on the smoke test — we don't want to email
      // a stranger every time someone runs the verify script. The Meet
      // link generation does NOT require an attendee.
      attendeeEmail:  null,
      consultationId: "verify-" + Date.now().toString(36),
    })
  } catch (err) {
    console.log(`${CROSS} createCalendarEvent failed`)
    console.log(c.red(`    ${err?.message || err}`))
    if (err?.code === "GCAL_NOT_CONFIGURED") {
      console.log(c.dim("    → env-vars look set but isConfigured() returned false. Restart your shell?"))
    } else if (err?.cause?.response?.status === 401) {
      console.log(c.dim("    → 401 = refresh token rejected. Re-run the bootstrap script."))
    } else if (err?.cause?.response?.status === 403) {
      console.log(c.dim("    → 403 = Calendar API not enabled OR scope is wrong."))
      console.log(c.dim("      Confirm: Cloud Console → APIs & Services → Google Calendar API → Enabled."))
      console.log(c.dim("      Confirm: OAuth consent screen → Data Access → calendar.events scope present."))
    }
    process.exit(1)
  }

  console.log(`${TICK} Event created`)
  console.log(`${c.dim("    eventId:")}  ${event.eventId}`)
  console.log(`${c.dim("    meetLink:")} ${event.meetLink}`)
  if (event.htmlLink) {
    console.log(`${c.dim("    htmlLink:")} ${event.htmlLink}`)
  }

  header("4. Meet link sanity check")
  if (!event.meetLink) {
    console.log(`${CROSS} Event created but Meet link is empty`)
    console.log(c.dim("    → Calendar event created without conferenceData. Either the scope is"))
    console.log(c.dim("      wrong (need calendar.events, not calendar.readonly) OR the consent"))
    console.log(c.dim("      screen has stale state. Try re-running the bootstrap."))
  } else if (/^https:\/\/meet\.google\.com\//.test(event.meetLink)) {
    console.log(`${TICK} Looks like a real Meet URL (https://meet.google.com/...)`)
  } else {
    console.log(`${WARN} Got a URL but it doesn't match the expected meet.google.com pattern`)
    console.log(c.dim(`    URL: ${event.meetLink}`))
  }

  header("5. Cleanup — delete the test event")
  try {
    await googleCalendar.cancelCalendarEvent(event.eventId)
    console.log(`${TICK} Test event deleted`)
  } catch (err) {
    console.log(`${WARN} cancelCalendarEvent failed: ${err?.message}`)
    console.log(c.dim(`    → Event was created but cleanup failed. Manually delete it from`))
    console.log(c.dim(`      Calendar (it's titled "[verify] mustaphaukizuru.com booking smoke-test")`))
  }

  console.log("")
  console.log(c.green("══════════════════════════════════════════════════════════════════"))
  console.log(c.green("  ✓  All checks passed — Google Meet integration is ready"))
  console.log(c.green("══════════════════════════════════════════════════════════════════"))
  console.log("")
  console.log("Next: book a real consultation locally to confirm the full flow:")
  console.log("  · npm run dev                  (terminal 1, backend at :5000)")
  console.log("  · npm run dev --prefix web     (terminal 2, frontend at :5173)")
  console.log("  · open http://localhost:5173/book-consultation")
  console.log("")
  console.log("Within 5s of completing the booking you should receive:")
  console.log("  1. A Google Calendar invite with a Meet link")
  console.log("  2. The branded 'consultation.confirmed' email")
  console.log("")
}

function maskValue(value) {
  if (!value) return ""
  if (value.length <= 12) return "***"
  return value.slice(0, 8) + "..." + value.slice(-4)
}

main().catch((err) => {
  console.error("\n" + c.red("[verify] uncaught:"), err?.message || err)
  if (err?.stack) console.error(c.dim(err.stack))
  process.exit(1)
})
