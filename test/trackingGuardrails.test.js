// ─────────────────────────────────────────────────────────────────────────────
// T5-7 · the guardrails around the tracker.
//
// This wave added the platform's FIRST anonymous read of a specific client
// engagement, and its first write from the PIN portal. Those are the two
// things worth being paranoid about, so the assertions here are the ones that
// fail loudly if a later change quietly widens either.
//
// Four questions:
//   1. Does the public response ever carry something it must not?
//   2. Is every route this wave added actually behind a gate, with exactly
//      one deliberate exception?
//   3. Can one client reach another client's things by id?
//   4. Does a sweep of the code space look different from a real lookup?
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn() },
  projectFileRequest: { count: jest.fn(), findUnique: jest.fn() },
  invoice: { findMany: jest.fn(), findUnique: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectPortalService", () => ({ loadBillingLinks: jest.fn() }))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const tracking = require("../src/services/projectTrackingService")
const fileRequests = require("../src/services/projectFileRequestService")
const projectInvoices = require("../src/services/projectInvoiceService")
const { protect } = require("../src/middleware/authMiddleware")
const { portalAuth } = require("../src/middleware/portalAuth")
const { adminOnly } = require("../src/middleware/authMiddleware")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

/* ══════════════════════════════════════════════════════════════════════════
   1 · the public response
   ══════════════════════════════════════════════════════════════════════════ */

describe("the anonymous response carries exactly what ADR 0006 allows", () => {
  // A row with every field a project actually has on it, so the serializer is
  // asked to ignore rather than merely not be given.
  const ROW = {
    id: "p1",
    trackingCode: "MU-7K4C-9XQF",
    projectName: "Colegio Vista · payroll migration",
    projectStatus: "in_progress",
    startDate: new Date("2026-07-01T00:00:00Z"),
    dueDate: new Date("2026-10-15T00:00:00Z"),
    closedAt: null,
    openRequestCount: 2,
    // Everything below must NOT come out the other side.
    userId: "u1",
    portalToken: "prt_live_abc123",
    previewUrl: "https://staging.example.com",
    accessState: "active",
    description: "Migrating 240 staff records off the old system",
    user: { email: "director@colegiovista.mx", fullName: "Ana Ruiz" },
    milestones: [{
      title: "Discovery",
      status: "completed",
      completedAt: new Date("2026-07-10T00:00:00Z"),
      approvedAt: null,
      // A milestone description carries scope notes and figures.
      description: "Interviews with 6 staff; quoted at 48,000 MXN",
      sortOrder: 1,
    }],
    events: [{
      type: "project.started",
      title: "Work started",
      titleEs: "Trabajo iniciado",
      createdAt: new Date("2026-07-01T00:00:00Z"),
      // The public projection must drop detail even when it is handed one.
      detail: "kickoff@colegiovista.mx confirmed · payroll-2026.xlsx received",
      detailEs: "confirmado · payroll-2026.xlsx recibido",
      visibility: "public",
    }],
  }

  const ALLOWED = [
    "reference", "status", "percentComplete", "startDate", "dueDate",
    "isClosed", "milestones", "events", "openRequestCount", "links",
    // ADR 0008 extends 0006 with dates and an on-time indicator. Each is a
    // date this client already agreed to, or a judgement about one — never
    // an amount, a name, or a reason.
    "health", "expectedAt", "lateCount", "openCount",
  ]

  test("the top-level key set is exactly the allowlist, in both directions", () => {
    // Both directions on purpose: a MISSING key breaks the page, and an EXTRA
    // one is the leak. The risk is never the first version of this response,
    // it is the fourth — when somebody adds the invoice total because a page
    // needed it.
    const out = tracking.serializePublicProject(ROW, "en")
    expect(Object.keys(out).sort()).toEqual([...ALLOWED].sort())
  })

  test("a milestone gives up its title, status and DATES, and nothing else", () => {
    // The dates joined the set in ADR 0008: a client cannot have a schedule
    // they were never told, so those dates were already theirs. The
    // description — scope notes, names and figures — still may not.
    const { milestones } = tracking.serializePublicProject(ROW, "en")
    expect(Object.keys(milestones[0]).sort())
      .toEqual(["completedAt", "dueDate", "estimatedAt", "status", "title"])
  })

  test("an event's detail never survives, even when the row has one", () => {
    const { events } = tracking.serializePublicProject(ROW, "en")
    expect(events[0].detail).toBeUndefined()
    expect(JSON.stringify(events)).not.toContain("payroll-2026.xlsx")
  })

  test("no email, amount, file name, comment body or customer name anywhere in the JSON", () => {
    // The negative assertion the ADR is actually about. Serialized and
    // scanned as a whole so a nested field cannot slip through.
    const json = JSON.stringify(tracking.serializePublicProject(ROW, "en"))
    const forbidden = {
      email: /@[a-z0-9-]+\.[a-z]{2,}/i,
      amount: /\d[\d,]*\s?(MXN|USD)|48,000/,
      fileName: /\.(pdf|xlsx|docx|zip|png|jpg)\b/i,
      "comment body": /Interviews with/,
      "customer name": /Ana Ruiz/,
      "project name": /Colegio Vista/,
      "portal token": /prt_/,
      "preview url": /staging\.example\.com/,
      "internal id": /"p1"|"u1"/,
    }
    const leaked = Object.entries(forbidden)
      .filter(([, re]) => re.test(json))
      .map(([name]) => name)
    expect(leaked).toEqual([])
  })

  test("the links are destinations, never credentials", () => {
    // Returning a portal token in a response keyed by a SHAREABLE code would
    // turn the shareable code into a credential.
    const { links } = tracking.serializePublicProject(ROW, "en")
    expect(links).toEqual({ portal: "/portal", dashboard: "/dashboard/projects" })
    expect(JSON.stringify(links)).not.toMatch(/token|pin|secret/i)
  })

  test("the Spanish projection leaks no more than the English one", () => {
    const en = Object.keys(tracking.serializePublicProject(ROW, "en"))
    const es = Object.keys(tracking.serializePublicProject(ROW, "es"))
    expect(es).toEqual(en)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · every route this wave added
   ══════════════════════════════════════════════════════════════════════════ */

describe("one unauthenticated route, and it is the one we meant", () => {
  const GATES = [protect, portalAuth, adminOnly]
  const isGate = (layer) => GATES.some((g) => layer.handle === g || (g.name && layer.name === g.name))

  /** Every route on a router, with whether a gate precedes or wraps it. */
  function walk(router) {
    const out = []
    let routerGated = false
    for (const layer of router.stack) {
      if (!layer.route) {
        if (isGate(layer)) routerGated = true
        continue
      }
      const gated = routerGated || layer.route.stack.some(isGate)
      const methods = Object.keys(layer.route.methods).join(",").toUpperCase()
      out.push({ route: `${methods} ${layer.route.path}`, gated })
    }
    return out
  }

  const ROUTERS = {
    "/track": require("../src/routes/trackRoutes"),
    "/portal": require("../src/routes/portalRoutes"),
    "/member/projects": require("../src/routes/memberClientProjectRoutes"),
    "/admin/client-projects": require("../src/routes/adminClientProjectRoutes"),
  }

  /**
   * The complete list of routes in this wave's tree that answer without a
   * session, a portal cookie or an admin check.
   *
   * Adding to it is a security decision. /portal's four are the PIN handshake
   * itself — they cannot require the cookie they exist to issue — and each is
   * behind its own tight rate limiter.
   */
  const PUBLIC_ALLOWLIST = new Set([
    "/track · GET /:code",
    // T5-15 · the opt-out link at the foot of the weekly digest. No token,
    // deliberately: it can only turn a digest OFF for a project whose
    // tracking code the holder already has, so the worst a stranger who
    // intercepted the link can do is stop an email they were not receiving.
    // Same rate limiter as the lookup, so it is not a way around that one.
    "/track · GET /:code/digest-opt-out",
    "/portal · POST /logout",
    "/portal · GET /:token",
    "/portal · POST /:token/pin",
    "/portal · POST /:token/verify",
  ])

  test("the walk actually found the routes", () => {
    // A silent zero here would make every assertion below vacuously true,
    // which is the way a guard test stops guarding without ever going red.
    const all = Object.entries(ROUTERS).flatMap(([m, r]) => walk(r).map((x) => `${m} · ${x.route}`))
    expect(all.length).toBeGreaterThan(35)
    expect(all).toContain("/track · GET /:code")
    expect(all).toContain("/member/projects · GET /:id/file-requests")
    expect(all).toContain("/portal · POST /me/file-requests/:reqId/files")
    expect(all).toContain("/admin/client-projects · GET /:id/events")
    // And that gating is being detected at all, not just absent everywhere.
    const gated = Object.values(ROUTERS).flatMap((r) => walk(r)).filter((x) => x.gated)
    expect(gated.length).toBeGreaterThan(30)
  })

  test("nothing is ungated except the allowlist", () => {
    const ungated = []
    for (const [mount, router] of Object.entries(ROUTERS)) {
      for (const { route, gated } of walk(router)) {
        const id = `${mount} · ${route}`
        if (!gated && !PUBLIC_ALLOWLIST.has(id)) ungated.push(id)
      }
    }
    expect(ungated).toEqual([])
  })

  test("the allowlist has no dead entries", () => {
    // A stale entry is worse than none: it silently pre-approves a path that
    // might be re-added later with different behaviour.
    const seen = new Set()
    for (const [mount, router] of Object.entries(ROUTERS)) {
      for (const { route } of walk(router)) seen.add(`${mount} · ${route}`)
    }
    expect([...PUBLIC_ALLOWLIST].filter((k) => !seen.has(k))).toEqual([])
  })

  test("the public one is rate limited, tightly", () => {
    const routes = read("src", "routes", "trackRoutes.js")
    expect(routes).toMatch(/router\.get\("\/:code",\s*trackRateLimiter/)
    const limiter = read("src", "middleware", "rateLimiter.js")
    const block = limiter.slice(limiter.indexOf('name:         "track"'))
    expect(block.slice(0, 200)).toContain("max:          30")
  })

  test("the portal's only write is CSRF-guarded like every other cookie write", () => {
    // mu_portal is an ambient credential; the guard originally keyed on
    // mu_session alone, which left this route open.
    const csrf = read("src", "middleware", "csrf.js")
    expect(csrf).toContain("PORTAL_COOKIE")
    expect(csrf).toMatch(/if \(!hasSession && !hasPortal\) return next\(\)/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   3 · one client cannot reach another's things
   ══════════════════════════════════════════════════════════════════════════ */

describe("ids are not authorisation", () => {
  beforeEach(() => jest.clearAllMocks())

  test("a document request belonging to another project is refused", async () => {
    // The id arrives from a browser. Without this check a client could answer
    // someone else's request — and see its title in the error — by guessing.
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "r1", projectId: "SOMEONE-ELSE", status: "requested", acceptExt: null, title: "Payroll export",
    })
    await expect(fileRequests.assertUploadable("r1", "p1", ["a.pdf"]))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
  })

  test("a foreign request and a missing one answer identically", async () => {
    // A different message would confirm that an id is real.
    const messages = []
    prisma.projectFileRequest.findUnique.mockResolvedValue(null)
    await fileRequests.assertUploadable("r1", "p1").catch((e) => messages.push(e.message))
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "r1", projectId: "OTHER", status: "requested", acceptExt: null, title: "Payroll export",
    })
    await fileRequests.assertUploadable("r1", "p1").catch((e) => messages.push(e.message))
    expect(messages[0]).toBe(messages[1])
    expect(messages[0]).not.toContain("Payroll")
  })

  test("a foreign invoice is refused through the portal gate", async () => {
    const { loadBillingLinks } = require("../src/services/projectPortalService")
    loadBillingLinks.mockResolvedValue({ id: "p1", serviceOrderId: "so1", orderIds: ["o1"] })
    prisma.invoice.findUnique.mockResolvedValue({
      id: "inv1", serviceOrderId: "OTHER", orderId: "OTHER", status: "issued",
    })
    expect(await projectInvoices.findForProject("inv1", "p1")).toBeNull()
  })

  test("both member reads check ownership before reading", () => {
    // Asserted at the source because the alternative is booting an app with a
    // signed session, which this file does not need for anything else.
    const controller = read("src", "controllers", "clientProjectController.js")
    for (const handler of ["const listEvents", "const listFileRequests", "const listInvoices"]) {
      const block = controller.slice(controller.indexOf(handler))
      const own = block.indexOf("loadOwnedProject")
      const firstRead = Math.min(
        ...["projectEvents.listForProject", "fileRequests.listForProject", "projectInvoices.listForProject"]
          .map((c) => block.indexOf(c))
          .filter((i) => i > -1),
      )
      expect(own).toBeGreaterThan(-1)
      expect(own).toBeLessThan(firstRead)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   4 · enumeration
   ══════════════════════════════════════════════════════════════════════════ */

describe("a sweep looks like a sweep", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tracking.noteHit("1.2.3.4")
  })

  test("unknown, malformed and expired all resolve to the same null", async () => {
    // A distinguishable "expired" would confirm that a code was once real.
    // Small oracle, free to close.
    expect(await tracking.findByTrackingCode("not-a-code")).toBeNull()
    expect(await tracking.findByTrackingCode("")).toBeNull()

    prisma.clientProject.findUnique.mockResolvedValue(null)
    expect(await tracking.findByTrackingCode("MU-7K4C-9XQF")).toBeNull()

    prisma.clientProject.findUnique.mockResolvedValue({
      id: "p1", trackingCode: "MU-7K4C-9XQF", projectStatus: "completed",
      closedAt: new Date("2020-01-01"), milestones: [], events: [],
    })
    expect(await tracking.findByTrackingCode("MU-7K4C-9XQF")).toBeNull()
  })

  test("a malformed code is refused before the database is touched", async () => {
    await tracking.findByTrackingCode("MU-OOOO-1111")
    expect(prisma.clientProject.findUnique).not.toHaveBeenCalled()
  })

  test("repeated misses from one address get logged as a possible sweep", () => {
    for (let i = 0; i < tracking.MISS_ALERT_THRESHOLD; i += 1) tracking.noteMiss("9.9.9.9")
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("enumeration sweep"))
  })

  test("it warns once per burst, not once per request", () => {
    // A line per miss would bury the signal in the noise it is reporting.
    for (let i = 0; i < tracking.MISS_ALERT_THRESHOLD * 3; i += 1) tracking.noteMiss("8.8.8.8")
    expect(logger.warn.mock.calls.filter(([m]) => m.includes("8.8.8.8"))).toHaveLength(1)
  })

  test("a hit clears the counter, so a real client is never reported", () => {
    for (let i = 0; i < tracking.MISS_ALERT_THRESHOLD - 1; i += 1) tracking.noteMiss("7.7.7.7")
    tracking.noteHit("7.7.7.7")
    tracking.noteMiss("7.7.7.7")
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test("the controller answers a miss with one fixed body", () => {
    const controller = read("src", "controllers", "trackController.js")
    expect(controller).toContain("PROJECT_NOT_FOUND")
    expect(controller).toContain("No project matches that code.")
    // And never at the edge: a shared cache keyed on the URL would serve one
    // client's progress to the next person who tried the same code.
    expect(controller).toContain('res.setHeader("Cache-Control", "no-store")')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   5 · what we told people we would do with their documents
   ══════════════════════════════════════════════════════════════════════════ */

describe("the privacy notice covers requested documents", () => {
  const clause = (lang) => {
    const legal = JSON.parse(read("web", "src", "i18n", "locales", lang, "legal.json"))
    const sections = legal.privacy.notice.sections
    return sections.find((s) => s.slug === "finalidades-primarias").content
  }

  test("both languages say what happens to a document a client uploads", () => {
    // The tracker asks clients for a CV, an RFC, a signed contract. Under the
    // LFPDPPP the purpose and the retention belong in the Aviso, not in a
    // support reply after the fact.
    for (const lang of ["en", "es"]) {
      const text = clause(lang)
      expect(text.length).toBeGreaterThan(200)
      expect(text).toMatch(lang === "es" ? /CV|RFC/ : /CV|tax ID/)
      expect(text).toMatch(lang === "es" ? /retenci[oó]n|conservamos/i : /retention|keep/i)
      expect(text).toMatch(lang === "es" ? /nunca lo usamos para otro fin/i : /never use it for anything else/i)
    }
  })
})
