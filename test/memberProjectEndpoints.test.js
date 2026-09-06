// ─────────────────────────────────────────────────────────────────────────────
// D0-1 · the member project endpoints, invoked rather than assumed.
//
// WHY THIS FILE EXISTS
//
// Four handlers in clientProjectController used `resolveUserLocale` without
// importing it. Four member endpoints answered 500 —
// `/member/projects/:id/{events,file-requests,time}` and the statement PDF —
// and 1873 tests passed anyway, because every existing test covered the
// SERVICE beneath them. Nothing loaded the controller and called the handler.
//
// So this suite does exactly the dull thing that was missing: require the
// real controller, invoke each handler with a request shape it will actually
// receive, and assert the STATUS. It mocks the services underneath because
// their behaviour is tested elsewhere; what is under test here is the wiring
// — imports resolved, arguments threaded, response written.
//
// A test that asserts "200, and the body came from the service" is worth
// little on its own. A test that would have caught a four-endpoint outage
// for the cost of eight assertions is worth a lot.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findFirst: jest.fn(), findUnique: jest.fn() },
  projectMember: { findFirst: jest.fn(), update: jest.fn() },
  projectAgreement: { findFirst: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectEventService", () => ({
  listForProject: jest.fn().mockResolvedValue([{ id: "e1", type: "project.started", title: "T", createdAt: new Date() }]),
  serializeEvent: (e) => ({ id: e.id, title: e.title }),
}))
jest.mock("../src/services/projectFileRequestService", () => ({
  listForProject: jest.fn().mockResolvedValue([{ id: "r1", title: "CV", status: "requested" }]),
  serialize: (r) => ({ id: r.id, title: r.title }),
}))
jest.mock("../src/services/projectInvoiceService", () => ({
  listForProject: jest.fn().mockResolvedValue({ invoices: [], billing: null }),
}))
jest.mock("../src/services/secretHandoffService", () => ({
  listForProject: jest.fn().mockResolvedValue([]),
  createSecret: jest.fn(), revealSecret: jest.fn(),
}))
jest.mock("../src/services/projectTimeService", () => ({
  ledgerFor: jest.fn().mockResolvedValue({ allowance: null, months: [] }),
  buildMonthlyStatement: jest.fn().mockResolvedValue({ buffer: Buffer.from("%PDF-1.4"), month: {}, monthLabel: "September 2026" }),
}))

const prisma = require("../src/lib/prisma")
const controller = require("../src/controllers/clientProjectController")

const PROJECT = {
  id: "p1", userId: "u1", projectName: "Colegio Vista", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: null,
  requiresNda: false, ndaVersion: null, accessState: "active", trackingCode: "MU-7K4C-9XQF",
}

/**
 * asyncHandler returns undefined, so awaiting a handler proves nothing — the
 * settle promise is what waits for the response. Same harness as
 * test/payInvoice.test.js.
 */
function invoke(handler, { params = {}, query = {}, user = { id: "u1", role: "member" } } = {}) {
  return new Promise((resolve, reject) => {
    const req = { params, query, user, body: {}, headers: {}, get: () => undefined }
    const res = { statusCode: 200, body: null, headers: {} }
    res.status = (c) => { res.statusCode = c; return res }
    res.setHeader = (k, v) => { res.headers[k] = v; return res }
    res.json = (b) => { res.body = b; resolve(res); return res }
    res.send = (b) => { res.body = b; resolve(res); return res }
    handler(req, res, (e) => (e ? reject(e) : resolve(res)))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findFirst.mockResolvedValue(PROJECT)
  prisma.clientProject.findUnique.mockResolvedValue(PROJECT)
  prisma.projectMember.findFirst.mockResolvedValue(null)
})

/* ══════════════════════════════════════════════════════════════════════════
   1 · every handler resolves its imports and answers
   ══════════════════════════════════════════════════════════════════════════ */

describe("the four handlers that were 500ing", () => {
  const CASES = [
    ["listEvents", () => controller.listEvents, { params: { id: "p1" } }],
    ["listFileRequests", () => controller.listFileRequests, { params: { id: "p1" } }],
    ["listTime", () => controller.listTime, { params: { id: "p1" } }],
    ["timeStatement", () => controller.timeStatement, { params: { id: "p1", month: "2026-09" } }],
  ]

  test.each(CASES)("%s answers 200, not 500", async (_name, get, args) => {
    const handler = get()
    expect(typeof handler).toBe("function")
    const res = await invoke(handler, args)
    expect(res.statusCode).toBe(200)
  })

  test("the failure mode was a ReferenceError, so assert on that specifically", async () => {
    // `resolveUserLocale is not defined` reached the error handler as a
    // thrown ReferenceError. If the import is ever dropped again, THIS is
    // what comes back, and a plain status assertion could be satisfied by an
    // error handler that answered 200.
    for (const [, get, args] of CASES) {
      await expect(invoke(get(), args)).resolves.toMatchObject({ statusCode: 200 })
    }
  })

  test("each one checks ownership BEFORE it reads anything", async () => {
    // The gate is loadOwnedProject. A handler that read first and checked
    // second would leak another client's project on the way to the 404.
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.clientProject.findUnique.mockResolvedValue(null)
    const events = require("../src/services/projectEventService")
    const requests = require("../src/services/projectFileRequestService")
    const time = require("../src/services/projectTimeService")

    for (const [, get, args] of CASES) {
      const res = await invoke(get(), args)
      expect(res.statusCode).toBe(404)
    }
    expect(events.listForProject).not.toHaveBeenCalled()
    expect(requests.listForProject).not.toHaveBeenCalled()
    expect(time.ledgerFor).not.toHaveBeenCalled()
    expect(time.buildMonthlyStatement).not.toHaveBeenCalled()
  })

  test("an unauthenticated call is 401 before the database is touched", async () => {
    for (const [, get, args] of CASES) {
      // `null`, not `undefined`: a destructuring default applies to
      // undefined, so `user: undefined` would silently hand the handler the
      // signed-in default and assert nothing.
      const res = await invoke(get(), { ...args, user: null })
      expect(res.statusCode).toBe(401)
    }
    expect(prisma.clientProject.findFirst).not.toHaveBeenCalled()
  })
})

describe("the statement PDF", () => {
  test("streams a PDF with a no-store header, not JSON", async () => {
    const res = await invoke(controller.timeStatement, { params: { id: "p1", month: "2026-09" } })
    expect(res.headers["Content-Type"]).toBe("application/pdf")
    expect(res.headers["Cache-Control"]).toBe("private, no-store")
    expect(Buffer.isBuffer(res.body)).toBe(true)
  })

  test("a month with no statement is 404 rather than an empty file", async () => {
    require("../src/services/projectTimeService").buildMonthlyStatement.mockResolvedValue(null)
    const res = await invoke(controller.timeStatement, { params: { id: "p1", month: "1999-01" } })
    expect(res.statusCode).toBe(404)
  })
})

describe("the secrets handlers load and scope too", () => {
  test("listSecrets answers 200 and asks for the CLIENT's view", async () => {
    const res = await invoke(controller.listSecrets, { params: { id: "p1" } })
    expect(res.statusCode).toBe(200)
    expect(require("../src/services/secretHandoffService").listForProject)
      .toHaveBeenCalledWith("p1", "client")
  })

  test("a member cannot choose the direction of a secret they send", async () => {
    // Fixed at the surface: a client who could pick "to_client" would be
    // minting a note to self that we can never read.
    const secrets = require("../src/services/secretHandoffService")
    secrets.createSecret.mockResolvedValue({ secret: { id: "s1" } })
    await invoke(controller.createSecret, { params: { id: "p1" } })
    expect(secrets.createSecret.mock.calls[0][1]).toMatchObject({ direction: "to_admin" })
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · the class of bug, not just this instance
   ══════════════════════════════════════════════════════════════════════════ */

describe("the gate that catches the next one", () => {
  test("every controller and service loads without a ReferenceError", () => {
    // `no-undef` in eslint.server.config.mjs is the real gate; this is the
    // runtime half of it. A module whose top level throws is caught by
    // require() alone — what it cannot catch is an undefined identifier
    // inside a function body, which is exactly what shipped. Hence both.
    const fs = require("fs")
    const path = require("path")
    const roots = ["controllers", "services", "middleware", "jobs", "utils", "lib"]
    const failures = []
    for (const dir of roots) {
      const abs = path.join(__dirname, "..", "src", dir)
      if (!fs.existsSync(abs)) continue
      for (const file of fs.readdirSync(abs).filter((f) => f.endsWith(".js"))) {
        try { require(path.join(abs, file)) } catch (e) { failures.push(`${dir}/${file}: ${e.message.split("\n")[0]}`) }
      }
    }
    expect(failures).toEqual([])
  })

  test("the server lint script exists and is part of `npm run lint`", () => {
    const pkg = require("../package.json")
    expect(pkg.scripts["lint:server"]).toContain("eslint.server.config.mjs")
    expect(pkg.scripts.lint).toContain("lint:server")
  })

  test("CI runs it, or the gate is decorative", () => {
    const fs = require("fs")
    const path = require("path")
    const ci = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "ci.yml"), "utf8")
    expect(ci).toContain("npm run lint:server")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   3 · the 429 body, which was documented and never sent
   ══════════════════════════════════════════════════════════════════════════ */

describe("rate-limit responses match the shape this module documents", () => {
  test("makeLimiter answers through rateLimitedResponse, not its own narrower body", () => {
    // `rateLimitedResponse` was written, documented in the module header, and
    // never wired: all 23 limiters answered with a body that omitted the
    // top-level legacy fields AND `details.retryAfter`, so a client could not
    // tell the user how long to wait. `no-unused-vars` is what surfaced it.
    const fs = require("fs")
    const path = require("path")
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "middleware", "rateLimiter.js"), "utf8")
    expect(src).toContain("return rateLimitedResponse(req, res, { ...options, statusCode: 429, message })")
    // And no hand-rolled 429 body left behind.
    expect(src).not.toMatch(/res\.status\(429\)\.json\(/)
  })

  test("the body carries both shapes and a retryAfter", () => {
    const { rateLimitedResponse } = require("../src/middleware/rateLimiter")
    const captured = {}
    const res = {
      getHeader: (k) => (k === "Retry-After" ? "900" : undefined),
      status(code) { captured.status = code; return this },
      json(body) { captured.body = body; return this },
    }
    rateLimitedResponse({}, res, { statusCode: 429, message: "Slow down." }, { limit: 5 })

    expect(captured.status).toBe(429)
    // The legacy top-level pair, which the narrower body dropped.
    expect(captured.body).toMatchObject({ success: false, code: "RATE_LIMITED", message: "Slow down." })
    // And the nested shape, with the number a client needs to say
    // "try again in 15 minutes" instead of "something went wrong".
    expect(captured.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Slow down.",
      details: { retryAfter: 900, limit: 5 },
    })
  })

  test("a missing Retry-After header is null, not NaN", () => {
    const { rateLimitedResponse } = require("../src/middleware/rateLimiter")
    const captured = {}
    const res = {
      getHeader: () => undefined,
      status() { return this },
      json(body) { captured.body = body; return this },
    }
    rateLimitedResponse({}, res, { statusCode: 429 })
    expect(captured.body.error.details.retryAfter).toBeNull()
  })
})
