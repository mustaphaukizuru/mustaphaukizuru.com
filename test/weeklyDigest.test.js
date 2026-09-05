// ─────────────────────────────────────────────────────────────────────────────
// T5-15 · the Monday digest.
//
// The whole feature is one rule: nothing to report, no email. A digest that
// arrives every Monday saying "nothing happened" is one people filter, and
// once filtered it is gone for the week something DID happen — which is the
// week it existed for.
//
// So most of these are about the decision NOT to send.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findMany: jest.fn(), update: jest.fn() },
  projectEvent: { findMany: jest.fn() },
  projectFileRequest: { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectInvoiceService", () => ({
  listForProject: jest.fn().mockResolvedValue({ invoices: [], billing: { unpaidCount: 0 } }),
}))
jest.mock("../src/services/projectEmailService", () => ({
  sendWeeklyDigest: jest.fn().mockResolvedValue(true),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const invoices = require("../src/services/projectInvoiceService")
const emails = require("../src/services/projectEmailService")
const digest = require("../src/jobs/weeklyDigestJob")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const PROJECT = {
  id: "p1", userId: "u1", projectName: "Colegio Vista",
  trackingCode: "MU-7K4C-9XQF", projectStatus: "in_progress", assignedAdminId: null,
}
const NOW = new Date("2026-09-07T08:00:00Z")

function nothingHappened() {
  prisma.projectEvent.findMany.mockResolvedValue([])
  prisma.projectFileRequest.findMany.mockResolvedValue([])
  invoices.listForProject.mockResolvedValue({ invoices: [], billing: { unpaidCount: 0 } })
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findMany.mockResolvedValue([PROJECT])
  emails.sendWeeklyDigest.mockResolvedValue(true)
  nothingHappened()
})

describe("nothing to report, no email", () => {
  test("a silent week sends nothing at all — not a shorter email, NONE", async () => {
    const out = await digest.runWeeklyDigestPass({ now: NOW })
    expect(emails.sendWeeklyDigest).not.toHaveBeenCalled()
    expect(out).toMatchObject({ sent: 0, skipped: 1 })
  })

  test("but a silent week with a document still owed DOES send", async () => {
    // The week where nothing moved and the client still owes us something is
    // exactly the week worth writing.
    prisma.projectFileRequest.findMany.mockResolvedValue([
      { id: "r1", title: "RFC", titleEs: null, dueAt: null },
    ])
    const out = await digest.runWeeklyDigestPass({ now: NOW })
    expect(out.sent).toBe(1)
  })

  test("and a silent week with an unpaid invoice does too", async () => {
    invoices.listForProject.mockResolvedValue({ invoices: [], billing: { unpaidCount: 2 } })
    const out = await digest.runWeeklyDigestPass({ now: NOW })
    expect(out.sent).toBe(1)
  })

  test("buildDigest returns null rather than an empty digest", async () => {
    // The decision lives here, not in the sender, so it is testable without
    // a mail transport.
    expect(await digest.buildDigest(PROJECT, { now: NOW })).toBeNull()
  })
})

describe("who gets one", () => {
  test("closed, purged and opted-out projects are excluded by the query", async () => {
    await digest.runWeeklyDigestPass({ now: NOW })
    const [args] = prisma.clientProject.findMany.mock.calls[0]
    expect(args.where).toMatchObject({
      closedAt: null,
      purgedAt: null,
      digestOptOut: false,
    })
  })

  test("a project with no tracking code is excluded", async () => {
    // Every project email refuses to send without one rather than mail a
    // literal placeholder (T5-6), so including these would be a guaranteed
    // no-op plus a warning, per project, every week.
    await digest.runWeeklyDigestPass({ now: NOW })
    const [args] = prisma.clientProject.findMany.mock.calls[0]
    expect(args.where.trackingCode).toEqual({ not: null })
  })

  test("one project failing does not silence the rest", async () => {
    // The alternative is that a single bad row stops the digest for every
    // client, and nobody finds out for a week.
    prisma.clientProject.findMany.mockResolvedValue([PROJECT, { ...PROJECT, id: "p2" }])
    prisma.projectFileRequest.findMany.mockResolvedValue([{ id: "r1", title: "RFC", dueAt: null }])
    emails.sendWeeklyDigest
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce(true)

    const out = await digest.runWeeklyDigestPass({ now: NOW })
    expect(out.sent).toBe(1)
    expect(out.skipped).toBe(1)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe("what it may say", () => {
  test("events are read at the CLIENT ceiling, never the admin one", async () => {
    // A digest is an email, and an email is the easiest thing in the world
    // to forward.
    prisma.projectEvent.findMany.mockResolvedValue([
      { type: "milestone.approved", title: "Milestone approved", createdAt: NOW },
    ])
    await digest.runWeeklyDigestPass({ now: NOW })
    const [args] = prisma.projectEvent.findMany.mock.calls[0]
    expect(args.where.visibility.in).toEqual(["public", "client"])
    expect(args.where.visibility.in).not.toContain("admin")
  })

  test("it looks back exactly seven days", async () => {
    await digest.runWeeklyDigestPass({ now: NOW })
    const [args] = prisma.projectEvent.findMany.mock.calls[0]
    const since = args.where.createdAt.gte
    expect(NOW.getTime() - since.getTime()).toBe(digest.WINDOW_DAYS * 86_400_000)
  })

  test("a busy week is capped, and says how many more there were", async () => {
    // Twenty rows in an email is a wall nobody reads; "and 12 more" with a
    // link is a sentence.
    const many = Array.from({ length: 20 }, (_, i) => ({
      type: "comment.added", title: `Event ${i}`, createdAt: NOW,
    }))
    prisma.projectEvent.findMany.mockResolvedValue(many)
    await digest.runWeeklyDigestPass({ now: NOW })
    const built = emails.sendWeeklyDigest.mock.calls[0][0]
    expect(built.events).toHaveLength(digest.MAX_EVENTS)
    expect(built.moreEvents).toBeGreaterThan(0)
  })

  test("the query itself is bounded, not just the slice", async () => {
    await digest.runWeeklyDigestPass({ now: NOW })
    const [args] = prisma.projectEvent.findMany.mock.calls[0]
    expect(args.take).toBe(digest.MAX_EVENTS + 1)
  })
})

describe("the opt-out", () => {
  test("it is per PROJECT, not per person", () => {
    // A client with three projects may want the digest for the live one and
    // not for the two winding down.
    const schema = read("prisma", "schema.prisma")
    const block = schema.slice(schema.indexOf("digestOptOut"))
    expect(schema).toContain("digestOptOut    Boolean       @default(false)")
    expect(block.slice(-0)).toBeDefined()
    // On the project model, not the user.
    const projectModel = schema.slice(schema.indexOf("model ClientProject"), schema.indexOf("model ProjectMilestone"))
    expect(projectModel).toContain("digestOptOut")
  })

  test("a malformed code never reaches the database", async () => {
    const tracking = jest.requireActual("../src/services/projectTrackingService")
    expect(await tracking.setDigestOptOut("not-a-code")).toBeNull()
    expect(prisma.clientProject.update).not.toHaveBeenCalled()
  })

  test("an unknown code answers like any other miss", async () => {
    const tracking = jest.requireActual("../src/services/projectTrackingService")
    prisma.clientProject.update.mockRejectedValue(Object.assign(new Error("nope"), { code: "P2025" }))
    expect(await tracking.setDigestOptOut("MU-7K4C-9XQF")).toBeNull()
  })

  test("the link is a GET, because mail clients follow links and not forms", () => {
    const routes = read("src", "routes", "trackRoutes.js")
    expect(routes).toMatch(/router\.get\("\/:code\/digest-opt-out"/)
    // Same rate limiter as the lookup: it takes the same code and must not
    // become a way around that one.
    expect(routes).toMatch(/digest-opt-out",\s*trackRateLimiter/)
  })
})

describe("the schedule", () => {
  test("Monday 08:00 Mexico City — the start of a working week", () => {
    // Not Sunday night and not Friday: the digest is a thing to act on.
    const scheduler = read("src", "jobs", "scheduler.js")
    const block = scheduler.slice(scheduler.indexOf('guarded("weeklyDigest"') - 400)
    expect(block.slice(0, 500)).toContain('"0 8 * * 1"')
    expect(block.slice(0, 700)).toContain('timezone: "America/Mexico_City"')
  })

  test("it is watched by the dead-man switch, with a weekly allowance", () => {
    // A weekly job checked against a daily allowance would alert every
    // Tuesday.
    const { JOB_INTERVALS } = jest.requireActual("../src/jobs/heartbeat")
    expect(JOB_INTERVALS.weeklyDigest).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
