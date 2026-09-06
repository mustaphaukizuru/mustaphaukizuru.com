const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectTime = require("../services/projectTimeService")
const projectEmails = require("../services/projectEmailService")

/**
 * monthlyStatementJob.js · the retainer month, closed (T5-18)
 *
 * On the 1st, for the month that just ended. The ledger on the project page
 * already shows the current month as it goes, so this is not news — it is the
 * record, arriving at the moment the month becomes a fact.
 *
 * IT ONLY SENDS WHEN THERE IS SOMETHING TO SAY
 *
 * A month with no hours logged is not an email. A project with no monthly
 * allowance AND no hours is even less of one. Sending either is the fastest
 * way to teach a client to ignore everything we send, and a retainer client
 * is precisely the one whose attention is worth keeping.
 *
 * It rides `digestOptOut` rather than adding a second switch. A client who
 * turned off the weekly note has said what they think about routine mail from
 * us, and asking them to find a second toggle is how a preference becomes a
 * complaint.
 *
 * THE MONTH IS THE CLIENT'S MONTH
 *
 * projectTimeService computes boundaries in America/Mexico_City, so a run at
 * 09:00 Mexico City on the 1st closes the month the client just lived
 * through — not a UTC month that ended six hours earlier.
 */

/** A ceiling, so a backlog cannot become a mailshot. */
const MAX_PER_PASS = 200

/** "YYYY-MM" for the month before the one `now` falls in. */
function previousMonthKey(now) {
  const [y, m] = projectTime.monthKeyOf(now).split("-").map(Number)
  const total = y * 12 + (m - 1) - 1
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

async function runMonthlyStatementPass({ now = new Date() } = {}) {
  const monthKey = previousMonthKey(now)

  const projects = await prisma.clientProject.findMany({
    where: {
      purgedAt: null,
      digestOptOut: false,
      // No code, no email: every project email refuses to send without one
      // rather than mail a literal placeholder (T5-6).
      trackingCode: { not: null },
      // A project closed before the month even started has nothing to
      // report; one closed during it does, and gets its final statement.
      OR: [{ closedAt: null }, { closedAt: { gte: projectTime.monthRange(monthKey).start } }],
    },
    select: { id: true, userId: true, projectName: true, trackingCode: true },
    take: MAX_PER_PASS,
  })

  let sent = 0
  let skipped = 0

  for (const project of projects) {
    try {
      const { allowance, months } = await projectTime.ledgerFor(project.id, { months: 2, now })
      const month = months.find((m) => m.month === monthKey)

      // Nothing logged AND nothing promised — say nothing.
      //
      // Nothing logged on a RETAINER is a different matter and does send:
      // the client paid for hours they did not use, and finding that out in
      // December is worse than finding it out in February.
      if (!month || (month.entries.length === 0 && !allowance)) { skipped += 1; continue }

      const ok = await projectEmails.sendMonthlyStatement({ project, month, allowance })
      if (ok) sent += 1
      else skipped += 1
    } catch (err) {
      logger.error(`[monthlyStatement] ${project.id}: ${err.message}`)
      skipped += 1
    }
  }

  if (sent || skipped) {
    logger.info(`[monthlyStatement] ${monthKey}: ${sent} sent, ${skipped} skipped, ${projects.length} candidates`)
  }
  return { month: monthKey, sent, skipped, candidates: projects.length }
}

module.exports = { runMonthlyStatementPass, previousMonthKey, MAX_PER_PASS }
