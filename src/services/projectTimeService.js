const PDFDocument = require("pdfkit")

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectEvents = require("./projectEventService")

/**
 * projectTimeService.js · hours against a retainer (T5-18)
 *
 * A retainer client ("iguala mensual") buys a number of hours a month and had
 * no way to see how many were left. The answer lived in the operator's head,
 * which means the client either over-asks and is surprised by an invoice, or
 * under-asks and quietly wastes what they already paid for. Both are worse
 * than a number on a page.
 *
 * MINUTES, NOT HOURS
 *
 * Entries store minutes. An hour and a half logged as 1.5 is a rounding
 * argument waiting to happen; minutes make the month total exact and the
 * display rounds once, at the end, for a human.
 *
 * THE MONTH IS THE CLIENT'S MONTH
 *
 * Boundaries are computed in America/Mexico_City, not UTC. Work logged at
 * 19:00 on the 31st is that month's work, and a UTC month would move it into
 * the next one — which is exactly the kind of arithmetic a client notices
 * when it costs them an hour of allowance.
 *
 * WHAT NON-BILLABLE MEANS
 *
 * It is shown and it does not count. A client seeing "we spent two hours on
 * this and did not charge you" is the entire reason to show it; counting it
 * against the allowance would make the gesture a cost.
 *
 * THE ALLOWANCE
 *
 * `ServicePackage.includedHoursPerMonth`, reached through the project's
 * service order. Null for everything that is not a retainer — the ledger
 * still shows the hours, it simply has nothing to show them against, and
 * says so rather than implying a limit of zero.
 */

/** The client's timezone, not the server's. */
const TZ = "America/Mexico_City"
/** A day of work in one entry is a mistake, not a day. */
const MAX_MINUTES_PER_ENTRY = 24 * 60
const MAX_ENTRIES_PER_MONTH = 500

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

/**
 * "2026-09" for a date, in the client's timezone.
 *
 * en-CA gives ISO-ordered parts, which is the shortest correct way to get a
 * timezone-shifted Y-M without a date library.
 */
function monthKeyOf(date, timeZone = TZ) {
  const d = date instanceof Date ? date : new Date(date)
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(d).split("-")
  return `${y}-${m}`
}

/** Start of a "YYYY-MM" and start of the month after it, as UTC instants. */
function monthRange(monthKey, timeZone = TZ) {
  const [y, m] = String(monthKey).split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) throw err("month must be YYYY-MM", "VALIDATION_ERROR")

  // Find the UTC instant whose local date in `timeZone` is the 1st at 00:00.
  // The offset is at most a day either way, so probing midnight UTC and
  // correcting by the observed offset is exact for every real zone.
  const probe = (year, month) => {
    const guess = Date.UTC(year, month - 1, 1, 0, 0, 0)
    const local = new Date(guess).toLocaleString("en-US", { timeZone, hour12: false })
    // Round-trip the local wall time back to a UTC instant to read the shift.
    const asUtc = Date.parse(`${local.replace(",", "")} UTC`)
    return new Date(guess + (guess - asUtc))
  }
  const start = probe(y, m)
  const end = m === 12 ? probe(y + 1, 1) : probe(y, m + 1)
  return { start, end }
}

const hoursOf = (minutes) => Math.round((Number(minutes) || 0) / 6) / 10

function serialize(row, locale = "en") {
  if (!row) return null
  const es = locale === "es"
  return {
    id: row.id,
    date: row.date?.toISOString?.().slice(0, 10) || null,
    minutes: row.minutes,
    hours: hoursOf(row.minutes),
    note: (es && row.noteEs) || row.note || null,
    milestoneId: row.milestoneId || null,
    billable: row.billable !== false,
  }
}

/* ── admin · log time ────────────────────────────────────────────────── */

/**
 * @param {string} projectId
 * @param {object} data { date, minutes, note?, noteEs?, milestoneId?, billable? }
 */
async function logTime(projectId, data = {}, { createdById = null } = {}) {
  if (!projectId) throw err("Project id is required", "VALIDATION_ERROR")

  const minutes = Math.round(Number(data.minutes))
  if (!Number.isFinite(minutes) || minutes <= 0) throw err("Minutes must be a positive number", "VALIDATION_ERROR")
  if (minutes > MAX_MINUTES_PER_ENTRY) {
    throw err(`One entry cannot be more than ${MAX_MINUTES_PER_ENTRY} minutes — split it by day`, "VALIDATION_ERROR")
  }

  const date = data.date ? new Date(data.date) : new Date()
  if (Number.isNaN(date.getTime())) throw err("date is not a valid date", "VALIDATION_ERROR")

  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, userId: true, projectName: true },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)

  if (data.milestoneId) {
    // A milestone from another project would attribute this client's hours
    // to somebody else's work.
    const ms = await prisma.projectMilestone.findFirst({
      where: { id: String(data.milestoneId), projectId: project.id },
      select: { id: true },
    })
    if (!ms) throw err("That milestone is not on this project", "VALIDATION_ERROR")
  }

  const row = await prisma.projectTimeEntry.create({
    data: {
      projectId: project.id,
      date,
      minutes,
      note: data.note ? String(data.note).trim().slice(0, 2000) : null,
      noteEs: data.noteEs ? String(data.noteEs).trim().slice(0, 2000) : null,
      milestoneId: data.milestoneId ? String(data.milestoneId) : null,
      billable: data.billable !== false,
      createdById: createdById ? String(createdById) : null,
    },
  })

  // Once a day at most, not once an entry. An operator logging six entries
  // on a Friday afternoon should not produce six timeline rows saying the
  // same thing — the ledger is where the detail belongs.
  await recordDailyEvent(project.id, date).catch(() => null)

  return { entry: serialize(row), project }
}

async function recordDailyEvent(projectId, date) {
  const dayStart = new Date(date)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)

  const existing = await prisma.projectEvent.findFirst({
    where: { projectId, type: "project.hours_logged", createdAt: { gte: dayStart, lt: dayEnd } },
    select: { id: true },
  })
  if (existing) return null

  return projectEvents.record({
    projectId,
    type: "project.hours_logged",
    actorRole: "admin",
  })
}

async function removeEntry(projectId, entryId) {
  const res = await prisma.projectTimeEntry.deleteMany({
    where: { id: String(entryId), projectId: String(projectId) },
  })
  if (res.count !== 1) throw err("Time entry not found", "NOT_FOUND", 404)
  return { id: String(entryId), removed: true }
}

/* ── the allowance ───────────────────────────────────────────────────── */

/**
 * How many hours a month this project includes, or null.
 *
 * Null is the honest answer for the majority of projects, which are not
 * retainers. The UI says "no monthly allowance on this plan" rather than
 * drawing a bar against zero.
 */
async function allowanceFor(projectId) {
  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: {
      serviceOrder: {
        select: {
          servicePackage: { select: { id: true, name: true, nameEs: true, includedHoursPerMonth: true } },
        },
      },
    },
  }).catch(() => null)

  const pkg = project?.serviceOrder?.servicePackage
  if (!pkg?.includedHoursPerMonth) return null
  return {
    packageId: pkg.id,
    packageName: pkg.name,
    packageNameEs: pkg.nameEs || null,
    includedHours: pkg.includedHoursPerMonth,
  }
}

/* ── the ledger ──────────────────────────────────────────────────────── */

/**
 * Month by month, newest first, with the allowance applied.
 *
 * @param {string} projectId
 * @param {object} [opts] { months = 6, locale = "en", now = new Date() }
 */
async function ledgerFor(projectId, { months = 6, locale = "en", now = new Date() } = {}) {
  if (!projectId) return { allowance: null, months: [] }

  const span = Math.min(Math.max(1, Number(months) || 6), 24)
  const allowance = await allowanceFor(projectId)

  // The window starts at the beginning of the earliest month we will show,
  // in the CLIENT's timezone — so an entry on the 1st is not dropped by a
  // UTC boundary an hour or six earlier.
  const keys = []
  {
    const [y, m] = monthKeyOf(now).split("-").map(Number)
    for (let i = 0; i < span; i += 1) {
      const total = y * 12 + (m - 1) - i
      keys.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`)
    }
  }
  const { start } = monthRange(keys[keys.length - 1])

  const rows = await prisma.projectTimeEntry.findMany({
    where: { projectId: String(projectId), date: { gte: start } },
    orderBy: { date: "desc" },
    take: MAX_ENTRIES_PER_MONTH * span,
  })

  const byMonth = new Map(keys.map((k) => [k, []]))
  for (const row of rows) {
    const key = monthKeyOf(row.date)
    if (byMonth.has(key)) byMonth.get(key).push(row)
  }

  const monthsOut = keys.map((key) => {
    const entries = byMonth.get(key) || []
    const billableMinutes = entries.filter((e) => e.billable !== false).reduce((n, e) => n + e.minutes, 0)
    const otherMinutes = entries.filter((e) => e.billable === false).reduce((n, e) => n + e.minutes, 0)
    const usedHours = hoursOf(billableMinutes)
    const includedHours = allowance?.includedHours ?? null
    return {
      month: key,
      entries: entries.map((e) => serialize(e, locale)),
      billableMinutes,
      nonBillableMinutes: otherMinutes,
      usedHours,
      nonBillableHours: hoursOf(otherMinutes),
      includedHours,
      // Both directions, and both matter: unused hours are what the client
      // paid for and did not spend, over-run is what the next invoice will
      // be about. Rounded to one decimal so 0.30000000000000004 never
      // reaches a page.
      remainingHours: includedHours == null ? null : Math.round((includedHours - usedHours) * 10) / 10,
      overHours: includedHours == null ? null : Math.max(0, Math.round((usedHours - includedHours) * 10) / 10),
    }
  })

  return { allowance, months: monthsOut }
}

/* ── the statement ───────────────────────────────────────────────────── */

const BRAND = Object.freeze({
  primary: "#5D3FD3", primaryDark: "#2d003f", text: "#1f2937", muted: "#6b7280", line: "#e5e7eb", accentBg: "#f5f0fe",
})

/**
 * One month, as a PDF, in the same pdfkit layout as an invoice.
 *
 * Deliberately the same visual language: a client filing a statement beside
 * an invoice should not have to work out that they came from the same place.
 */
async function buildMonthlyStatement(projectId, monthKey, { locale = "en" } = {}) {
  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, projectName: true, trackingCode: true },
  })
  if (!project) return null

  const { allowance, months } = await ledgerFor(projectId, { months: 24, locale })
  const month = months.find((m) => m.month === monthKey)
  if (!month) return null

  const es = locale === "es"
  const monthLabel = new Intl.DateTimeFormat(es ? "es-MX" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(monthRange(monthKey).start)

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 })
      const chunks = []
      doc.on("data", (c) => chunks.push(c))
      doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), month, monthLabel }))
      doc.on("error", reject)

      const left = doc.page.margins.left
      const right = doc.page.width - doc.page.margins.right

      doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND.primary)
        .text(es ? "Estado de horas" : "Hours statement")
      doc.font("Helvetica").fontSize(11).fillColor(BRAND.text).text(project.projectName)
      doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted)
        .text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1))
      if (project.trackingCode) doc.text(project.trackingCode)

      doc.moveDown(1)
      doc.strokeColor(BRAND.line).lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke()
      doc.moveDown(0.8)

      // The summary first: it is the only part most readers open this for.
      const summaryY = doc.y
      doc.rect(left, summaryY - 4, right - left, 54).fill(BRAND.accentBg)
      doc.fillColor(BRAND.primaryDark).font("Helvetica-Bold").fontSize(11)
        .text(es ? "Horas usadas" : "Hours used", left + 12, summaryY + 4)
      doc.font("Helvetica").fontSize(20)
        .text(`${month.usedHours}`, left + 12, summaryY + 20)
      if (month.includedHours != null) {
        doc.font("Helvetica-Bold").fontSize(11)
          .text(es ? "Incluidas en el plan" : "Included in the plan", left + 180, summaryY + 4)
        doc.font("Helvetica").fontSize(20)
          .text(`${month.includedHours}`, left + 180, summaryY + 20)
        doc.font("Helvetica-Bold").fontSize(11)
          .text(month.overHours > 0
            ? (es ? "Excedente" : "Over")
            : (es ? "Sin usar" : "Unused"), left + 360, summaryY + 4)
        doc.font("Helvetica").fontSize(20)
          .text(`${month.overHours > 0 ? month.overHours : Math.max(0, month.remainingHours)}`, left + 360, summaryY + 20)
      }
      doc.y = summaryY + 62
      doc.fillColor(BRAND.text)

      if (month.nonBillableMinutes > 0) {
        doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted)
          .text(es
            ? `Además ${month.nonBillableHours} h sin cargo, que no cuentan contra el plan.`
            : `Plus ${month.nonBillableHours} h at no charge, which do not count against the plan.`, left)
        doc.moveDown(0.6)
      }

      doc.moveDown(0.4)
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.text).text(es ? "Detalle" : "Detail", left)
      doc.moveDown(0.4)

      if (!month.entries.length) {
        doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted)
          .text(es ? "No se registraron horas este mes." : "No hours were logged this month.")
      }

      for (const entry of month.entries) {
        const y = doc.y
        doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted).text(entry.date, left, y, { width: 70 })
        doc.font("Helvetica").fontSize(10).fillColor(BRAND.text)
          .text(entry.note || (es ? "Trabajo del proyecto" : "Project work"), left + 80, y, { width: right - left - 160 })
        doc.font("Helvetica").fontSize(10).fillColor(entry.billable ? BRAND.text : BRAND.muted)
          .text(`${entry.hours} h${entry.billable ? "" : es ? " (sin cargo)" : " (no charge)"}`, right - 80, y, { width: 80, align: "right" })
        doc.moveDown(0.5)
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage()
      }

      if (allowance) {
        doc.moveDown(0.8)
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.muted)
          .text(es
            ? `Plan: ${allowance.packageNameEs || allowance.packageName} · ${allowance.includedHours} h al mes.`
            : `Plan: ${allowance.packageName} · ${allowance.includedHours} h per month.`, left, doc.y, { width: right - left })
      }

      doc.end()
    } catch (e) {
      logger.error(`[projectTime] statement failed for ${projectId}: ${e.message}`)
      reject(e)
    }
  })
}

module.exports = {
  TZ,
  MAX_MINUTES_PER_ENTRY,
  monthKeyOf,
  monthRange,
  hoursOf,
  serialize,
  logTime,
  removeEntry,
  allowanceFor,
  ledgerFor,
  buildMonthlyStatement,
}
