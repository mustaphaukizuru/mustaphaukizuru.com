// ─────────────────────────────────────────────────────────────────────────────
// T5-2 · the event log, and the first anonymous endpoint that returns data
// about a named client engagement.
//
// The contract is docs/decisions/0006-tracking-code-public-surface.md. These
// tests are the enforcement: several of them fail if somebody adds a field to
// the public projection without going back to that record, which is the exact
// drift the record was written to prevent.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  projectEvent:       { create: jest.fn(), findMany: jest.fn() },
  clientProject:      { findUnique: jest.fn() },
  projectFileRequest: { count: jest.fn() },
}))

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const events = require("../src/services/projectEventService")
const tracking = require("../src/services/projectTrackingService")

beforeEach(() => {
  jest.clearAllMocks()
  prisma.projectEvent.create.mockImplementation(async ({ data }) => ({ id: "ev1", ...data }))
  prisma.projectFileRequest.count.mockResolvedValue(0)
})

/* ══════════════════════════════════════════════════════════════════════════
   The event log
   ══════════════════════════════════════════════════════════════════════════ */

describe("the type list is closed", () => {
  test("every type has both languages and a visibility", () => {
    const bad = []
    for (const [type, def] of Object.entries(events.EVENT_DEFINITIONS)) {
      if (!def.title) bad.push(`${type}: no title`)
      if (!def.titleEs) bad.push(`${type}: no titleEs`)
      if (def.title === def.titleEs) bad.push(`${type}: Spanish equals English`)
      if (!events.VISIBILITIES.includes(def.visibility)) bad.push(`${type}: bad visibility`)
    }
    expect(bad).toEqual([])
  })

  test("nothing that names a file, a comment or money is public", () => {
    // The rule from ADR 0006. A file name can carry the client's own client;
    // "invoice.overdue" on a page anyone can open would tell whoever holds a
    // forwarded link that this client is behind on payment.
    const leaky = Object.entries(events.EVENT_DEFINITIONS)
      .filter(([type, def]) => /^(file|comment|invoice)\./.test(type) && def.visibility === "public")
      .map(([type]) => type)
    expect(leaky).toEqual([])
  })

  test("an unknown type is refused rather than written", async () => {
    const result = await events.record({ projectId: "p1", type: "project.exploded", actorRole: "admin" })
    expect(result).toBeNull()
    expect(prisma.projectEvent.create).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })
})

describe("record()", () => {
  test("writes the dictionary's title and visibility", async () => {
    await events.record({ projectId: "p1", type: "milestone.approved", actorRole: "client" })
    const { data } = prisma.projectEvent.create.mock.calls[0][0]
    expect(data).toMatchObject({
      projectId: "p1",
      type: "milestone.approved",
      title: "Milestone approved",
      titleEs: "Etapa aprobada",
      visibility: "public",
      actorRole: "client",
    })
  })

  test("an override may NARROW visibility", async () => {
    await events.record({ projectId: "p1", type: "milestone.approved", actorRole: "admin", visibility: "admin" })
    expect(prisma.projectEvent.create.mock.calls[0][0].data.visibility).toBe("admin")
  })

  test("an override may NOT widen it, and says so", async () => {
    // The dangerous direction. A caller must not be able to promote a file
    // event onto the anonymous surface by passing a string.
    await events.record({ projectId: "p1", type: "file.received", actorRole: "client", visibility: "public" })
    expect(prisma.projectEvent.create.mock.calls[0][0].data.visibility).toBe("client")
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("refused to widen"))
  })

  test("never throws — a failed event must not roll back what it describes", async () => {
    prisma.projectEvent.create.mockRejectedValueOnce(new Error("db down"))
    await expect(events.record({ projectId: "p1", type: "project.started", actorRole: "admin" }))
      .resolves.toBeNull()
    // But it must be loud: a silently missing timeline is very hard to notice.
    expect(logger.error).toHaveBeenCalled()
  })

  test("caps detail so one caller cannot write an essay into the timeline", async () => {
    await events.record({ projectId: "p1", type: "comment.added", actorRole: "client", detail: "x".repeat(5000) })
    expect(prisma.projectEvent.create.mock.calls[0][0].data.detail).toHaveLength(2000)
  })
})

describe("visibilitiesFor", () => {
  test("is a threshold, not a list", () => {
    expect(events.visibilitiesFor("public")).toEqual(["public"])
    expect(events.visibilitiesFor("client")).toEqual(["public", "client"])
    expect(events.visibilitiesFor("admin")).toEqual(["public", "client", "admin"])
  })

  test("an unknown audience gets the narrowest view, not the widest", () => {
    // Fail closed. A typo in a caller must not open the admin timeline.
    expect(events.visibilitiesFor(undefined)).toEqual(["public"])
    expect(events.visibilitiesFor("superuser")).toEqual(["public"])
    expect(events.visibilitiesFor(null)).toEqual(["public"])
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   The public endpoint
   ══════════════════════════════════════════════════════════════════════════ */

const projectRow = (overrides = {}) => ({
  id: "p1",
  trackingCode: "MU-7K4C-9XQF",
  projectStatus: "in_progress",
  startDate: new Date("2026-01-05T00:00:00Z"),
  dueDate: new Date("2026-06-05T00:00:00Z"),
  closedAt: null,
  milestones: [
    { title: "Discovery", status: "completed", completedAt: new Date("2026-02-01T00:00:00Z"), approvedAt: null },
    { title: "Build", status: "in_progress", completedAt: null, approvedAt: null },
  ],
  events: [
    { type: "project.started", title: "Work started", titleEs: "Trabajo iniciado", createdAt: new Date("2026-01-06T00:00:00Z") },
  ],
  ...overrides,
})

describe("what the public projection contains", () => {
  test("the agreed fields, and nothing else", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    // An exact key set. Adding a field here means editing ADR 0006 first,
    // which is the whole point of writing this assertion as equality.
    expect(Object.keys(out).sort()).toEqual([
      "dueDate", "events", "isClosed", "links", "milestones",
      "openRequestCount", "percentComplete", "reference", "startDate", "status",
    ])
  })

  test("no project name, ever", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    // A project name is usually the client's name, or names something they
    // have not announced.
    expect(JSON.stringify(out)).not.toMatch(/projectName|name"/i)
    expect(out.reference).toBe("MU-7K4C-9XQF")
  })

  test("no portal token — a shareable code must not become a credential", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    expect(JSON.stringify(out)).not.toMatch(/token/i)
    expect(out.links).toEqual({ portal: "/portal", dashboard: "/dashboard/projects" })
  })

  test("milestone titles only — no descriptions", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    for (const m of out.milestones) {
      expect(Object.keys(m).sort()).toEqual(["completedAt", "status", "title"])
    }
  })

  test("events are projected to type, title and time — never detail", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow({
      events: [{ type: "project.started", title: "Work started", titleEs: "Trabajo iniciado", detail: "internal note", createdAt: new Date() }],
    }))
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    expect(Object.keys(out.events[0]).sort()).toEqual(["createdAt", "title", "type"])
    expect(JSON.stringify(out)).not.toContain("internal note")
  })

  test("only public events are asked for", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    await tracking.findByTrackingCode("MU-7K4C-9XQF")
    const { select } = prisma.clientProject.findUnique.mock.calls[0][0]
    expect(select.events.where).toEqual({ visibility: "public" })
  })

  test("a count of open requests, not the requests", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    prisma.projectFileRequest.count.mockResolvedValue(3)
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    expect(out.openRequestCount).toBe(3)
    expect(prisma.projectFileRequest.count).toHaveBeenCalledWith({
      where: { projectId: "p1", status: { in: ["requested", "rejected"] } },
    })
  })

  test("Spanish titles when the locale is es", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF", { locale: "es" })
    expect(out.events[0].title).toBe("Trabajo iniciado")
  })
})

describe("what answers and what does not", () => {
  test("a malformed code never reaches the database", async () => {
    expect(await tracking.findByTrackingCode("nonsense")).toBeNull()
    expect(await tracking.findByTrackingCode("MU-OOOO-1111")).toBeNull()
    expect(prisma.clientProject.findUnique).not.toHaveBeenCalled()
  })

  test("sloppy but valid input is accepted", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    expect(await tracking.findByTrackingCode(" mu7k4c9xqf ")).toBeTruthy()
    expect(prisma.clientProject.findUnique.mock.calls[0][0].where)
      .toEqual({ trackingCode: "MU-7K4C-9XQF" })
  })

  test("an expired code is indistinguishable from an unknown one", async () => {
    // Both null. A distinguishable "expired" answer confirms a code was once
    // real, which is a small oracle but a free one to close.
    const longClosed = new Date()
    longClosed.setDate(longClosed.getDate() - 400)
    prisma.clientProject.findUnique.mockResolvedValue(projectRow({ closedAt: longClosed, projectStatus: "completed" }))
    expect(await tracking.findByTrackingCode("MU-7K4C-9XQF")).toBeNull()

    prisma.clientProject.findUnique.mockResolvedValue(null)
    expect(await tracking.findByTrackingCode("MU-7K4C-9XQF")).toBeNull()
  })

  test("a recently closed project still answers, inside the grace window", async () => {
    const justClosed = new Date()
    justClosed.setDate(justClosed.getDate() - 3)
    prisma.clientProject.findUnique.mockResolvedValue(projectRow({ closedAt: justClosed, projectStatus: "completed" }))
    const out = await tracking.findByTrackingCode("MU-7K4C-9XQF")
    expect(out).toBeTruthy()
    expect(out.isClosed).toBe(true)
  })
})

describe("percentComplete", () => {
  test("counts completed and approved milestones", () => {
    expect(tracking.percentComplete([
      { status: "completed" }, { status: "pending" }, { status: "pending", approvedAt: new Date() }, { status: "pending" },
    ])).toBe(50)
  })

  test("no milestones is 0, not 100", () => {
    // Dividing by zero to reach "done" would tell a client their project was
    // finished before it started.
    expect(tracking.percentComplete([])).toBe(0)
    expect(tracking.percentComplete()).toBe(0)
  })
})

describe("enumeration is visible as well as slow", () => {
  test("a run of misses from one IP logs once at the threshold", () => {
    for (let i = 0; i < tracking.MISS_ALERT_THRESHOLD - 1; i += 1) tracking.noteMiss("203.0.113.9")
    expect(logger.warn).not.toHaveBeenCalled()
    tracking.noteMiss("203.0.113.9")
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("enumeration sweep"))
    // Once, not on every subsequent miss.
    tracking.noteMiss("203.0.113.9")
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  test("a hit clears the run", () => {
    for (let i = 0; i < 5; i += 1) tracking.noteMiss("198.51.100.4")
    tracking.noteHit("198.51.100.4")
    for (let i = 0; i < tracking.MISS_ALERT_THRESHOLD - 1; i += 1) tracking.noteMiss("198.51.100.4")
    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe("the route is wired the way ADR 0006 requires", () => {
  const fs = require("fs")
  const path = require("path")
  const ROOT = path.join(__dirname, "..")

  test("the endpoint is rate limited", () => {
    // The limit, not the code's length, is what makes enumeration
    // impractical: 30 guesses per window against 2^39 is not a search.
    const route = fs.readFileSync(path.join(ROOT, "src", "routes", "trackRoutes.js"), "utf8")
    expect(route).toContain("trackRateLimiter")
    expect(route).toMatch(/router\.get\("\/:code",\s*trackRateLimiter/)
  })

  test("the limiter is 30 per 15 minutes, keyed by IP", () => {
    const limiter = fs.readFileSync(path.join(ROOT, "src", "middleware", "rateLimiter.js"), "utf8")
    const block = limiter.slice(limiter.indexOf("const trackRateLimiter"))
    expect(block).toContain("windowMs:     FIFTEEN_MIN")
    expect(block).toContain("max:          30")
    expect(block).toContain("keyGenerator: ipKey")
  })

  test("it carries no auth middleware — public by design", () => {
    const route = fs.readFileSync(path.join(ROOT, "src", "routes", "trackRoutes.js"), "utf8")
    expect(route).not.toMatch(/protect|adminOnly|portalAuth/)
  })

  test("it is mounted on v1 only, not the deprecated /api surface", () => {
    const index = fs.readFileSync(path.join(ROOT, "src", "routes", "index.js"), "utf8")
    expect(index).toContain('v1.use("/track",       trackRoutes)')
    // A new anonymous endpoint has no business on the legacy path.
    expect(index).not.toMatch(/router\.use\("\/track"/)
  })

  test("the response is never cached at the edge", () => {
    // A shared cache keyed on the URL would serve one client's progress to
    // the next person who tried the same code.
    const controller = fs.readFileSync(path.join(ROOT, "src", "controllers", "trackController.js"), "utf8")
    expect(controller).toContain('res.setHeader("Cache-Control", "no-store")')
  })

  test("ADR 0006 is accepted, because the endpoint it governs now exists", () => {
    const adr = fs.readFileSync(path.join(ROOT, "docs", "decisions", "0006-tracking-code-public-surface.md"), "utf8")
    expect(adr).toMatch(/\*\*Status:\*\* accepted/)
  })
})
