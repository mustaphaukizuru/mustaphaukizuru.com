// ─────────────────────────────────────────────────────────────────────────────
// T5-18 · hours against a retainer.
//
// This feature is arithmetic about money, so the tests are about arithmetic
// and about the two places it can quietly be wrong.
//
//   THE MONTH BOUNDARY is the client's, not UTC's. Work logged at 19:00 on
//   the 31st is that month's work, and a UTC month moves it into the next
//   one — which the client notices, because it costs them an hour of
//   allowance.
//
//   NON-BILLABLE is shown and does not count. Counting it would turn "we
//   did not charge you for this" into a cost, which is the opposite of why
//   it is shown at all.
//
// Plus the honest nulls: a project with no allowance has no allowance, and
// saying zero would read as "you have used all of it".
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn() },
  projectMilestone: { findFirst: jest.fn() },
  projectTimeEntry: { create: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
  projectEvent: { findFirst: jest.fn(), create: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectEventService", () => ({
  record: jest.fn().mockResolvedValue({ id: "e1" }),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const projectEvents = require("../src/services/projectEventService")
const time = require("../src/services/projectTimeService")
const { previousMonthKey } = require("../src/jobs/monthlyStatementJob")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const NOW = new Date("2026-09-15T18:00:00.000Z")

const withPackage = (includedHoursPerMonth) => prisma.clientProject.findUnique.mockResolvedValue({
  id: "p1", userId: "u1", projectName: "Colegio Vista",
  serviceOrder: { servicePackage: { id: "pkg1", name: "Retainer · medium", nameEs: "Iguala · media", includedHoursPerMonth } },
})

const entry = (date, minutes, over = {}) => ({
  id: `e-${date}-${minutes}`, date: new Date(date), minutes, note: "work", noteEs: null,
  milestoneId: null, billable: true, ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  withPackage(10)
  prisma.projectTimeEntry.findMany.mockResolvedValue([])
  prisma.projectTimeEntry.create.mockImplementation(async ({ data }) => ({ id: "e1", ...data }))
  prisma.projectEvent.findFirst.mockResolvedValue(null)
})

/* ══════════════════════════════════════════════════════════════════════════
   1 · the month is the client's month
   ══════════════════════════════════════════════════════════════════════════ */

describe("month boundaries are Mexico City, not UTC", () => {
  test("19:00 on the 31st belongs to that month, not the next one", () => {
    // 2026-09-01T01:00Z is 2026-08-31 19:00 in Mexico City.
    expect(time.monthKeyOf(new Date("2026-09-01T01:00:00Z"))).toBe("2026-08")
    // And 01:00Z on the 1st of October is still September there.
    expect(time.monthKeyOf(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09")
  })

  test("the range starts and ends at local midnight, six hours off UTC", () => {
    const { start, end } = time.monthRange("2026-09")
    expect(start.toISOString()).toBe("2026-09-01T06:00:00.000Z")
    expect(end.toISOString()).toBe("2026-10-01T06:00:00.000Z")
  })

  test("December rolls into the next January rather than month 13", () => {
    const { start, end } = time.monthRange("2026-12")
    expect(start.toISOString()).toBe("2026-12-01T06:00:00.000Z")
    expect(end.toISOString()).toBe("2027-01-01T06:00:00.000Z")
  })

  test("a junk month is refused rather than silently becoming a range", () => {
    for (const bad of ["", "2026", "2026-13", "not-a-month", "2026-00"]) {
      expect(() => time.monthRange(bad)).toThrow(/YYYY-MM/)
    }
  })

  test("the monthly job closes the month that just ended, across a year boundary", () => {
    expect(previousMonthKey(new Date("2026-09-01T15:00:00Z"))).toBe("2026-08")
    expect(previousMonthKey(new Date("2027-01-01T15:00:00Z"))).toBe("2026-12")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · the arithmetic
   ══════════════════════════════════════════════════════════════════════════ */

describe("hours against the allowance", () => {
  test("used, remaining and over are all reported, and rounded once", () => {
    // 0.30000000000000004 must never reach a page.
    prisma.projectTimeEntry.findMany.mockResolvedValue([
      entry("2026-09-02T15:00:00Z", 90),
      entry("2026-09-03T15:00:00Z", 100),
    ])
    return time.ledgerFor("p1", { now: NOW }).then(({ months }) => {
      const current = months[0]
      expect(current.month).toBe("2026-09")
      expect(current.usedHours).toBe(3.2)   // 190 minutes
      expect(current.includedHours).toBe(10)
      expect(current.remainingHours).toBe(6.8)
      expect(current.overHours).toBe(0)
    })
  })

  test("over-run is a positive number, and remaining goes negative rather than clamping", async () => {
    // Both directions matter: remaining is what they paid for and did not
    // spend, over is what the next invoice will be about.
    prisma.projectTimeEntry.findMany.mockResolvedValue([entry("2026-09-02T15:00:00Z", 12 * 60)])
    const { months } = await time.ledgerFor("p1", { now: NOW })
    expect(months[0].usedHours).toBe(12)
    expect(months[0].overHours).toBe(2)
    expect(months[0].remainingHours).toBe(-2)
  })

  test("non-billable time is REPORTED and does not count against the plan", async () => {
    prisma.projectTimeEntry.findMany.mockResolvedValue([
      entry("2026-09-02T15:00:00Z", 60),
      entry("2026-09-03T15:00:00Z", 120, { billable: false }),
    ])
    const { months } = await time.ledgerFor("p1", { now: NOW })
    expect(months[0].usedHours).toBe(1)
    expect(months[0].nonBillableHours).toBe(2)
    expect(months[0].remainingHours).toBe(9)
    // Still in the list — that is the whole point of recording it.
    expect(months[0].entries).toHaveLength(2)
  })

  test("no allowance means null, never zero", async () => {
    // Zero would draw a full bar and read as "you have used all of it".
    withPackage(null)
    prisma.projectTimeEntry.findMany.mockResolvedValue([entry("2026-09-02T15:00:00Z", 60)])
    const { allowance, months } = await time.ledgerFor("p1", { now: NOW })
    expect(allowance).toBeNull()
    expect(months[0].includedHours).toBeNull()
    expect(months[0].remainingHours).toBeNull()
    expect(months[0].overHours).toBeNull()
    expect(months[0].usedHours).toBe(1)
  })

  test("the plan's name comes through in both languages", async () => {
    const { allowance } = await time.ledgerFor("p1", { now: NOW })
    expect(allowance).toMatchObject({ packageName: "Retainer · medium", packageNameEs: "Iguala · media", includedHours: 10 })
  })

  test("months with nothing in them are still listed, so a client can see the gap", async () => {
    const { months } = await time.ledgerFor("p1", { months: 3, now: NOW })
    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-08", "2026-07"])
    expect(months[1].usedHours).toBe(0)
  })

  test("entries are bucketed by the CLIENT's month, not the row's UTC month", async () => {
    // 2026-09-01T01:00Z is August in Mexico City. Bucketing by UTC would
    // move an hour of allowance from one month to another.
    prisma.projectTimeEntry.findMany.mockResolvedValue([entry("2026-09-01T01:00:00Z", 60)])
    const { months } = await time.ledgerFor("p1", { months: 2, now: NOW })
    expect(months[0].usedHours).toBe(0)
    expect(months[1].month).toBe("2026-08")
    expect(months[1].usedHours).toBe(1)
  })

  test("the window is capped, so months=999 cannot become a table scan", async () => {
    await time.ledgerFor("p1", { months: 999, now: NOW })
    expect(prisma.projectTimeEntry.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(500 * 24)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   3 · logging it
   ══════════════════════════════════════════════════════════════════════════ */

describe("logging time", () => {
  test("minutes are stored, and the day is the day the work happened", async () => {
    await time.logTime("p1", { date: "2026-09-04", minutes: 90, note: "Form validation" })
    const data = prisma.projectTimeEntry.create.mock.calls[0][0].data
    expect(data.minutes).toBe(90)
    expect(data.date.toISOString().slice(0, 10)).toBe("2026-09-04")
    expect(data.billable).toBe(true)
  })

  test("zero, negative, fractional-nonsense and a whole day are all refused", async () => {
    for (const minutes of [0, -30, NaN, "abc", 25 * 60]) {
      await expect(time.logTime("p1", { minutes })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    }
    expect(prisma.projectTimeEntry.create).not.toHaveBeenCalled()
  })

  test("a milestone from ANOTHER project is refused", async () => {
    // It would attribute this client's hours to somebody else's work.
    prisma.projectMilestone.findFirst.mockResolvedValue(null)
    await expect(time.logTime("p1", { minutes: 60, milestoneId: "m-elsewhere" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  test("billable defaults to true and false is respected", async () => {
    await time.logTime("p1", { minutes: 60 })
    expect(prisma.projectTimeEntry.create.mock.calls[0][0].data.billable).toBe(true)
    await time.logTime("p1", { minutes: 60, billable: false })
    expect(prisma.projectTimeEntry.create.mock.calls[1][0].data.billable).toBe(false)
  })

  test("the timeline gets ONE row a day, not one an entry", async () => {
    // An operator logging six entries on a Friday afternoon should not
    // produce six rows saying the same thing.
    await time.logTime("p1", { date: "2026-09-04", minutes: 60 })
    expect(projectEvents.record).toHaveBeenCalledTimes(1)

    prisma.projectEvent.findFirst.mockResolvedValue({ id: "already" })
    projectEvents.record.mockClear()
    await time.logTime("p1", { date: "2026-09-04", minutes: 30 })
    expect(projectEvents.record).not.toHaveBeenCalled()
  })

  test("the event carries no number — a total on a shared page is money", () => {
    const svc = read("src", "services", "projectEventService.js")
    const block = svc.slice(svc.indexOf('"project.hours_logged"'), svc.indexOf('"project.hours_logged"') + 200)
    expect(block).toContain('visibility: "client"')
    expect(block).not.toContain('visibility: "public"')
  })

  test("a missing project is 404, not a row on nothing", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await expect(time.logTime("nope", { minutes: 60 })).rejects.toMatchObject({ statusCode: 404 })
  })

  test("deleting is scoped to the project", async () => {
    prisma.projectTimeEntry.deleteMany.mockResolvedValue({ count: 0 })
    await expect(time.removeEntry("p1", "e-elsewhere")).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.projectTimeEntry.deleteMany.mock.calls[0][0].where).toEqual({ id: "e-elsewhere", projectId: "p1" })
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   4 · the statement
   ══════════════════════════════════════════════════════════════════════════ */

describe("the monthly statement PDF", () => {
  test("it renders, in the same pdfkit layout as an invoice", async () => {
    prisma.projectTimeEntry.findMany.mockResolvedValue([
      entry("2026-09-02T15:00:00Z", 90, { note: "Form validation" }),
      entry("2026-09-03T15:00:00Z", 60, { billable: false, note: "Looked into the email bounce" }),
    ])
    const out = await time.buildMonthlyStatement("p1", "2026-09", { locale: "en" })
    expect(out.buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(out.buffer.length).toBeGreaterThan(1500)
    expect(out.month.usedHours).toBe(1.5)
  })

  test("a month with nothing in it still renders rather than 404ing", async () => {
    // A retainer client asking "what did we spend in July" deserves an
    // answer, and "nothing" is an answer.
    const out = await time.buildMonthlyStatement("p1", "2026-09", { locale: "es" })
    expect(out.buffer.subarray(0, 5).toString()).toBe("%PDF-")
  })

  test("a month outside the window returns null, not an empty PDF", async () => {
    expect(await time.buildMonthlyStatement("p1", "2019-01", { locale: "en" })).toBeNull()
  })

  test("a missing project returns null", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(null)
    expect(await time.buildMonthlyStatement("nope", "2026-09")).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   5 · wiring
   ══════════════════════════════════════════════════════════════════════════ */

describe("it is actually reachable and scheduled", () => {
  test("the allowance lives on ServicePackage, which is the price source of truth", () => {
    const schema = read("prisma", "schema.prisma")
    const pkg = schema.slice(schema.indexOf("model ServicePackage"))
    expect(pkg.slice(0, pkg.indexOf("\n}"))).toContain("includedHoursPerMonth Int?")
  })

  test("every surface can read the ledger; only the admin can write it", () => {
    const admin = read("src", "routes", "adminClientProjectRoutes.js")
    const member = read("src", "routes", "memberClientProjectRoutes.js")
    const portal = read("src", "routes", "portalRoutes.js")

    expect(admin).toMatch(/router\.post\s*\(\s*"\/:id\/time"/)
    expect(member).toMatch(/router\.get\s*\(\s*"\/:id\/time"/)
    expect(member).not.toMatch(/router\.post\s*\(\s*"\/:id\/time"/)
    expect(portal).toMatch(/router\.get\s*\(\s*"\/me\/time"/)
    expect(portal).not.toMatch(/router\.post\s*\(\s*"\/me\/time"/)
  })

  test("the statement route is declared before the bare entry route", () => {
    // Otherwise "2026-09" is read as an entry id.
    const admin = read("src", "routes", "adminClientProjectRoutes.js")
    expect(admin.indexOf('"/:id/time/:month/statement.pdf"')).toBeLessThan(admin.indexOf('"/:id/time/:entryId"'))
  })

  test("the monthly job is scheduled and in the heartbeat registry", () => {
    // fileRequestReminders was missing from that registry for three waves
    // and /health/jobs reported healthy the whole time.
    expect(read("src", "jobs", "scheduler.js")).toMatch(/guarded\("monthlyStatement", runMonthlyStatementPass\)/)
    expect(read("src", "jobs", "heartbeat.js")).toMatch(/monthlyStatement:\s*35 \* DAY/)
  })

  test("the email exists in both languages with matching placeholders", () => {
    const { TEMPLATES, TEMPLATES_ES } = require("../prisma/seed-email-templates")
    const en = TEMPLATES.find((t) => t.key === "project.monthly-statement")
    const es = TEMPLATES_ES.find((t) => t.key === "project.monthly-statement")
    expect(en).toBeTruthy()
    expect(es).toBeTruthy()
    const ph = (t) => new Set([...`${t.subject}\n${t.html}\n${t.text}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
    expect([...ph(en)].sort()).toEqual([...ph(es)].sort())
  })

  test("the statement email rides digestOptOut rather than adding a second switch", () => {
    // A client who turned off the weekly note has said what they think
    // about routine mail from us.
    expect(read("src", "jobs", "monthlyStatementJob.js")).toContain("digestOptOut: false")
  })
})
