// ─────────────────────────────────────────────────────────────────────────────
// T5-16 · one queue across every project.
//
// The value of a queue is entirely in what it LEAVES OUT. A list that
// includes finished projects, or mixes "you must do this" with "they must do
// this", is a list nobody clears — and a badge that never reaches zero stops
// being read, which is worse than no badge at all.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  projectFileRequest: { findMany: jest.fn() },
  projectMilestone: { findMany: jest.fn() },
  projectComment: { findMany: jest.fn() },
  supportTicket: { findMany: jest.fn() },
  changeRequest: { findMany: jest.fn() },
  invoice: { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const queue = require("../src/services/adminQueueService")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const PROJECT = { id: "p1", projectName: "Colegio Vista", trackingCode: "MU-7K4C-9XQF" }
const ago = (days) => new Date(Date.now() - days * 86_400_000)
const ahead = (days) => new Date(Date.now() + days * 86_400_000)

/** Every list empty unless a test says otherwise. */
function emptyAll() {
  for (const model of ["projectFileRequest", "projectMilestone", "projectComment", "supportTicket", "changeRequest", "invoice"]) {
    prisma[model].findMany.mockResolvedValue([])
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  emptyAll()
})

describe("what only live projects means", () => {
  test("every project-scoped query filters on closedAt AND purgedAt", async () => {
    // A finished project with an unanswered comment from March is not a
    // task, and a purged one has no files left to review.
    await queue.getQueue()
    const projectScoped = [
      prisma.projectFileRequest, prisma.projectMilestone,
      prisma.projectComment, prisma.supportTicket, prisma.changeRequest,
    ]
    for (const model of projectScoped) {
      for (const [args] of model.findMany.mock.calls) {
        expect(args.where.project).toEqual({ closedAt: null, purgedAt: null })
      }
    }
  })

  test("each query is bounded — a queue is a to-do list, not a report", async () => {
    await queue.getQueue()
    const calls = [
      ...prisma.projectFileRequest.findMany.mock.calls,
      ...prisma.projectMilestone.findMany.mock.calls,
      ...prisma.invoice.findMany.mock.calls,
    ]
    expect(calls.length).toBeGreaterThan(0)
    for (const [args] of calls) expect(args.take).toBe(queue.PER_KIND)
  })
})

describe("waiting on me", () => {
  test("a submitted document, a rejected milestone, a comment, a ticket and a quote", async () => {
    prisma.projectFileRequest.findMany.mockImplementation(async ({ where }) =>
      (where.status === "submitted"
        ? [{ id: "r1", title: "RFC", submittedAt: ago(2), project: PROJECT }]
        : []))
    prisma.projectMilestone.findMany.mockImplementation(async ({ where }) =>
      (where.changesRequestedAt
        ? [{ id: "m1", title: "Design", changesRequestedAt: ago(5), clientNote: "wrong logo", project: PROJECT }]
        : []))
    prisma.projectComment.findMany.mockResolvedValue([
      { id: "c1", body: "Any news?", createdAt: ago(1), project: PROJECT },
    ])
    prisma.supportTicket.findMany.mockResolvedValue([
      { id: "t1", subject: "Cannot log in", status: "open", updatedAt: ago(3), project: PROJECT },
    ])
    prisma.changeRequest.findMany.mockResolvedValue([
      { id: "cr1", title: "Extra page", createdAt: ago(4), project: PROJECT },
    ])

    const out = await queue.getQueue()
    expect(out.waitingOnMe.map((i) => i.kind)).toEqual([
      // Oldest first: 5, 4, 3, 2, 1 days.
      "changes_requested", "quote_change_request", "open_ticket", "review_document", "unanswered_comment",
    ])
    expect(out.counts.me).toBe(5)
  })

  test("OLDEST first — the one most likely to have been forgotten", async () => {
    prisma.projectComment.findMany.mockResolvedValue([
      { id: "new", body: "today", createdAt: ago(0), project: PROJECT },
      { id: "old", body: "a fortnight ago", createdAt: ago(14), project: PROJECT },
    ])
    const out = await queue.getQueue()
    expect(out.waitingOnMe.map((i) => i.id)).toEqual(["old", "new"])
  })

  test("every row links to the THING, not to the project page", async () => {
    // A queue that says "a document is waiting" and drops you on a project
    // page is a queue you stop using.
    prisma.projectFileRequest.findMany.mockImplementation(async ({ where }) =>
      (where.status === "submitted"
        ? [{ id: "r1", title: "RFC", submittedAt: ago(1), project: PROJECT }]
        : []))
    const out = await queue.getQueue()
    expect(out.waitingOnMe[0].href).toBe("/admin/client-projects/p1?request=r1")
  })

  test("the client's own note comes with the milestone", async () => {
    // Half the time it says what to do, and the operator should not have to
    // open the project to read one sentence.
    prisma.projectMilestone.findMany.mockImplementation(async ({ where }) =>
      (where.changesRequestedAt
        ? [{ id: "m1", title: "Design", changesRequestedAt: ago(1), clientNote: "the logo is wrong", project: PROJECT }]
        : []))
    const out = await queue.getQueue()
    expect(out.waitingOnMe[0].detail).toBe("the logo is wrong")
  })

  test("an ANSWERED comment is not in the queue", async () => {
    await queue.getQueue()
    const [args] = prisma.projectComment.findMany.mock.calls[0]
    expect(args.where).toMatchObject({ authorRole: "client", resolvedAt: null })
  })

  test("a milestone that came back but is now finished is not either", async () => {
    await queue.getQueue()
    const call = prisma.projectMilestone.findMany.mock.calls
      .find(([a]) => a.where.changesRequestedAt)
    expect(call[0].where.status).toEqual({ notIn: ["completed", "approved"] })
  })
})

describe("waiting on clients", () => {
  test("OVERDUE first — what is late is what needs the call", async () => {
    prisma.projectFileRequest.findMany.mockImplementation(async ({ where }) =>
      (where.status?.in?.includes("requested")
        ? [
          { id: "soon", title: "Logo", dueAt: ahead(3), status: "requested", remindedAt: null, project: PROJECT },
          { id: "late", title: "RFC", dueAt: ago(4), status: "requested", remindedAt: ago(1), project: PROJECT },
        ]
        : []))
    const out = await queue.getQueue()
    expect(out.waitingOnClient.map((i) => i.id)).toEqual(["late", "soon"])
    expect(out.waitingOnClient[0].overdue).toBe(true)
  })

  test("it says whether a reminder has already gone out", async () => {
    // So the operator does not send a second nudge by hand on top of the
    // job's.
    prisma.projectFileRequest.findMany.mockImplementation(async ({ where }) =>
      (where.status?.in?.includes("requested")
        ? [{ id: "r1", title: "RFC", dueAt: ago(1), status: "requested", remindedAt: ago(1), project: PROJECT }]
        : []))
    const out = await queue.getQueue()
    expect(out.waitingOnClient[0].remindedAt).toBeTruthy()
  })

  test("an unpaid invoice carries its amount", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv1", invoiceNumber: "A-000123", dueDate: ahead(5), status: "issued", totalAmount: "1160.00", currency: "MXN" },
    ])
    const out = await queue.getQueue()
    expect(out.waitingOnClient[0]).toMatchObject({ kind: "unpaid_invoice", amount: 1160, currency: "MXN" })
  })

  test("a paid or voided invoice is not in the queue", async () => {
    await queue.getQueue()
    const [args] = prisma.invoice.findMany.mock.calls[0]
    expect(args.where.status).toEqual({ in: ["issued", "overdue"] })
  })
})

describe("the badge counts only what you can act on", () => {
  test("counts.me excludes everything you are waiting FOR", async () => {
    // A number that includes what the client owes never reaches zero, and a
    // badge that never reaches zero stops being read.
    prisma.projectComment.findMany.mockResolvedValue([
      { id: "c1", body: "x", createdAt: ago(1), project: PROJECT },
    ])
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv1", invoiceNumber: "A-1", dueDate: ahead(2), status: "issued", totalAmount: "100.00", currency: "MXN" },
    ])
    const out = await queue.getQueue()
    expect(out.counts.me).toBe(1)
    expect(out.counts.client).toBe(1)
  })

  test("the sidebar reads counts.me, not the total", () => {
    const sidebar = read("web", "src", "components", "admin", "AdminSidebar.jsx")
    expect(sidebar).toContain("queueData?.counts?.me")
    expect(sidebar).not.toContain("counts?.client")
  })

  test("a zero renders no badge at all", () => {
    // A "0" badge is a badge you learn to ignore, and then you miss the day
    // it says three.
    const sidebar = read("web", "src", "components", "admin", "AdminSidebar.jsx")
    expect(sidebar).toContain("{count > 0 ? (")
  })
})

describe("a queue that cannot be built", () => {
  test("returns empty rather than throwing — it feeds a badge on every page", async () => {
    prisma.projectComment.findMany.mockRejectedValue(new Error("db gone"))
    const out = await queue.getQueue()
    expect(out).toMatchObject({ waitingOnMe: [], waitingOnClient: [], counts: { me: 0, client: 0 }, error: true })
  })

  test("the sidebar fetch cannot blank the other badges", () => {
    // Settled, not raced: the queue endpoint failing must not take the order
    // and ticket counts with it.
    const sidebar = read("web", "src", "components", "admin", "AdminSidebar.jsx")
    const block = sidebar.slice(sidebar.indexOf("const [dashboard, queue] = await Promise.all"))
    expect(block.slice(0, 500)).toContain('authFetch("/api/v1/admin/dashboard").catch(() => null)')
    expect(block.slice(0, 500)).toContain("client-projects/queue\").catch(() => null)")
  })
})

describe("the route is reachable and guarded", () => {
  test("it sits BEFORE /:id, or \"queue\" is read as a project id", () => {
    const routes = read("src", "routes", "adminClientProjectRoutes.js")
    expect(routes.indexOf('router.get   ("/queue"')).toBeLessThan(routes.indexOf('router.get   ("/:id"'))
  })

  test("and behind protect + adminOnly, like the rest of the router", () => {
    const routes = read("src", "routes", "adminClientProjectRoutes.js")
    expect(routes).toContain("router.use(protect, adminOnly)")
    expect(routes.indexOf("router.use(protect, adminOnly)")).toBeLessThan(routes.indexOf('router.get   ("/queue"'))
  })
})
