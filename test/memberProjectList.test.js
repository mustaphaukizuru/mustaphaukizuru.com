// ─────────────────────────────────────────────────────────────────────────────
// D5-1 · GET /member/projects and the expired project it kept offering.
//
// `listMyProjects` returns every project the account owns. The detail route
// runs `assertReadable` and answers 410 PROJECT_EXPIRED once the grace window
// after closure has passed. So the list handed back an expired project as a
// plain row with nothing to distinguish it, and the card rendered an "Open
// project" button whose only destination was the detail page's
// "no longer available" panel.
//
// The list route now presents every row through the SAME `presentForMember`
// the detail route uses, so a card and a detail response carry one `access`
// shape and the SPA reads them the same way.
//
// What is under test is the CONTRACT, not the lifecycle arithmetic — that is
// covered in projectAccessGate.test.js. Here: does an expired row arrive
// marked, does a live one arrive unmarked, and does the presenter's blanking
// of a suspended project's preview URL still apply on the list.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  projectMember: { findFirst: jest.fn() },
  projectAgreement: { findFirst: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const controller = require("../src/controllers/clientProjectController")

const DAY = 24 * 60 * 60 * 1000

/** Closure `days` ago. The grace window is PROJECT_GRACE_DAYS, default 30. */
const closedDaysAgo = (days) => new Date(Date.now() - days * DAY)

function row(over = {}) {
  return {
    id: "p1", userId: "u1", projectName: "Colegio Vista",
    projectStatus: "in_progress", closedAt: null, updatedAt: new Date(),
    accessState: "active", previewUrl: null,
    milestones: [], _count: { files: 0 },
    ...over,
  }
}

function invoke(handler, { user = { id: "u1", role: "member" } } = {}) {
  return new Promise((resolve, reject) => {
    const req = { params: {}, query: {}, user, body: {}, headers: {}, get: () => undefined }
    const res = { statusCode: 200, body: null, headers: {} }
    res.status = (c) => { res.statusCode = c; return res }
    res.setHeader = (k, v) => { res.headers[k] = v; return res }
    res.json = (b) => { res.body = b; resolve(res); return res }
    res.send = (b) => { res.body = b; resolve(res); return res }
    handler(req, res, (e) => (e ? reject(e) : resolve(res)))
  })
}

const list = () => invoke(controller.listMine)

beforeEach(() => {
  jest.clearAllMocks()
})

describe("every row carries an access object", () => {
  test("a live project is not expired and not closed", async () => {
    prisma.clientProject.findMany.mockResolvedValue([row()])
    const res = await list()
    expect(res.statusCode).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].access).toMatchObject({
      isExpired: false, isClosed: false, readOnly: false, state: "active",
    })
  })

  test("a closed project inside the grace window is closed but still readable", async () => {
    // This is the case that must NOT be marked: the detail route serves it,
    // read-only. Marking it would hide a project the client can still open.
    prisma.clientProject.findMany.mockResolvedValue([
      row({ projectStatus: "completed", closedAt: closedDaysAgo(3) }),
    ])
    const [p] = (await list()).body.data
    expect(p.access.isClosed).toBe(true)
    expect(p.access.readOnly).toBe(true)
    expect(p.access.isExpired).toBe(false)
  })

  test("a project past the grace window is marked expired", async () => {
    // The defect: this row used to be indistinguishable from a live one.
    prisma.clientProject.findMany.mockResolvedValue([
      row({ projectStatus: "completed", closedAt: closedDaysAgo(400) }),
    ])
    const [p] = (await list()).body.data
    expect(p.access.isExpired).toBe(true)
    expect(p.access.expiresAt).toBeInstanceOf(Date)
  })

  test("the expired row is still RETURNED, deliberately", async () => {
    // Dropping it was the other option and is worse: the client is told
    // "contact support if you need its files", which they cannot do about a
    // project that silently vanished from their list.
    prisma.clientProject.findMany.mockResolvedValue([
      row({ id: "old", projectStatus: "completed", closedAt: closedDaysAgo(400) }),
      row({ id: "live" }),
    ])
    const data = (await list()).body.data
    expect(data.map((p) => p.id)).toEqual(["old", "live"])
  })
})

describe("the presenter's other guarantees apply to the list too", () => {
  test("a suspended project's preview URL is blanked", async () => {
    // This is the reason to reuse presentForMember rather than bolt a
    // lifecycle flag onto the raw row: the presenter withholds things, and a
    // list built by hand would have shipped the preview URL of a project
    // whose access is suspended for non-payment.
    prisma.clientProject.findMany.mockResolvedValue([
      row({ accessState: "suspended", previewUrl: "https://staging.example.test" }),
    ])
    const [p] = (await list()).body.data
    expect(p.previewUrl).toBeNull()
    expect(p.previewCanFrame).toBe(false)
    expect(p.access).toMatchObject({ state: "suspended", suspended: true })
  })

  test("an active project keeps its preview URL", async () => {
    prisma.clientProject.findMany.mockResolvedValue([
      row({ previewUrl: "https://staging.example.test" }),
    ])
    const [p] = (await list()).body.data
    expect(p.previewUrl).toBe("https://staging.example.test")
  })

  test("the fields the card renders survive the presenter", async () => {
    // presentForMember spreads the row, but it is written for the detail
    // payload. The card needs milestones and the file count, and a presenter
    // that dropped either would empty every card on the page.
    prisma.clientProject.findMany.mockResolvedValue([
      row({ milestones: [{ id: "m1", status: "completed" }, { id: "m2", status: "pending" }], _count: { files: 4 } }),
    ])
    const [p] = (await list()).body.data
    expect(p.milestones).toHaveLength(2)
    expect(p._count.files).toBe(4)
    expect(p.projectName).toBe("Colegio Vista")
  })
})

describe("the guard in front of it", () => {
  test("no user is 401, and the database is never touched", async () => {
    // `user: null`, not undefined — undefined satisfies the destructuring
    // default in invoke() and would assert nothing.
    const res = await invoke(controller.listMine, { user: null })
    expect(res.statusCode).toBe(401)
    expect(res.body.error.code).toBe("AUTH_MISSING")
    expect(prisma.clientProject.findMany).not.toHaveBeenCalled()
  })

  test("the query is scoped to the caller", async () => {
    prisma.clientProject.findMany.mockResolvedValue([])
    await invoke(controller.listMine, { user: { id: "u9", role: "member" } })
    expect(prisma.clientProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u9" } }),
    )
  })

  test("an empty list is an empty array, not null", async () => {
    prisma.clientProject.findMany.mockResolvedValue([])
    const res = await list()
    expect(res.body).toEqual({ success: true, data: [] })
  })
})
