// ─────────────────────────────────────────────────────────────────────────────
// T5-5 · the panels, and the reads behind them.
//
// Three components render on three surfaces, and each surface asks a
// different endpoint because a portal holder has no session and an anonymous
// visitor has nothing at all. That is exactly the shape in which an
// authorisation hole hides, so what is asserted here is not what the panels
// look like — it is that every new read is behind the gate its surface uses,
// and that the public one stays out of the index.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

describe("the new reads are behind the right gate", () => {
  const memberRoutes = read("src", "routes", "memberClientProjectRoutes.js")
  const portalRoutes = read("src", "routes", "portalRoutes.js")
  const adminRoutes = read("src", "routes", "adminClientProjectRoutes.js")

  test("the member reads sit under the router-level protect", () => {
    expect(memberRoutes).toContain("router.use(protect)")
    expect(memberRoutes).toMatch(/router\.get\("\/:id\/events",/)
    expect(memberRoutes).toMatch(/router\.get\("\/:id\/file-requests",/)
  })

  test("both member handlers check ownership BEFORE reading anything", () => {
    // Without it any signed-in member could read any project's timeline or
    // outstanding documents by id — the plainest IDOR there is.
    const controller = read("src", "controllers", "clientProjectController.js")
    for (const [handler, call] of [
      ["const listEvents", "projectEvents.listForProject"],
      ["const listFileRequests", "fileRequests.listForProject"],
    ]) {
      const block = controller.slice(controller.indexOf(handler))
      const own = block.indexOf("loadOwnedProject")
      const readAt = block.indexOf(call)
      expect(own).toBeGreaterThan(-1)
      expect(own).toBeLessThan(readAt)
    }
  })

  test("the portal reads sit behind portalAuth", () => {
    expect(portalRoutes).toMatch(/router\.get\s*\("\/me\/events",\s*portalAuth/)
    expect(portalRoutes).toMatch(/router\.get\s*\("\/me\/file-requests",\s*portalAuth/)
  })

  test("the admin timeline sits behind protect + adminOnly", () => {
    expect(adminRoutes).toContain("router.use(protect, adminOnly)")
    expect(adminRoutes).toMatch(/router\.get\s*\("\/:id\/events",/)
  })
})

describe("audience ceilings", () => {
  const events = require("../src/services/projectEventService")

  test("a client read can never reach admin-only rows", () => {
    expect(events.visibilitiesFor("client")).toEqual(["public", "client"])
    expect(events.visibilitiesFor("client")).not.toContain("admin")
  })

  test("the member and portal handlers both ask for the CLIENT ceiling", () => {
    // Not "admin" by a slip of the keyboard — the two calls sit in different
    // files and the wrong constant in either one leaks operator notes.
    const member = read("src", "controllers", "clientProjectController.js")
    const portal = read("src", "controllers", "portalController.js")
    for (const src of [member, portal]) {
      const block = src.slice(src.indexOf("const listEvents"))
      expect(block).toContain('audience: "client"')
      expect(block.slice(0, block.indexOf("res.json"))).not.toContain('audience: "admin"')
    }
  })
})

describe("the public tracking page stays out of the index", () => {
  const seo = read("web", "src", "seo", "pageSeo.js")

  test("/track is a noindex prefix, so /track/:code is too", () => {
    const block = seo.slice(seo.indexOf("export const noindexPrefixes"))
    expect(block.slice(0, block.indexOf("]"))).toContain('"/track"')
  })

  test("shouldNoindex covers a real code URL, not just the bare page", () => {
    // The prefix form is the whole point: the indexable-looking URL is the
    // one with a live code in it.
    const src = seo.slice(seo.indexOf("export function shouldNoindex"))
    expect(src).toContain("startsWith(`${prefix}/`)")
  })

  test("no share card is generated for it", () => {
    const gen = read("web", "scripts", "generate-og-static.mjs")
    const block = gen.slice(gen.indexOf("const PRIVATE"))
    expect(block.slice(0, block.indexOf("])"))).toContain('"/track"')
  })

  test("it is not in the sitemap", () => {
    const sitemap = read("web", "scripts", "generate-sitemap.mjs")
    expect(sitemap).not.toContain('path: "/track"')
  })
})

describe("the public surface the page renders", () => {
  const page = read("web", "src", "pages", "TrackPage.jsx")

  test("the page reads /track/:code and nothing member-scoped", () => {
    // A convenience import of a member fetch here is how an anonymous page
    // starts asking for data it has no business showing.
    expect(page).toContain("fetchProjectByCode")
    for (const forbidden of ["fetchProjectInvoices", "fetchProjectFileRequests", "authFetch"]) {
      expect(page).not.toContain(forbidden)
    }
  })

  test("it renders only the keys ADR 0006 allows", () => {
    // project.<field> reads in the page, against the serializer's own list.
    const allowed = new Set([
      "reference", "status", "percentComplete", "startDate", "dueDate",
      "isClosed", "milestones", "events", "openRequestCount", "links",
    ])
    const used = new Set([...page.matchAll(/\bproject\.([A-Za-z]+)/g)].map((m) => m[1]))
    expect([...used].filter((k) => !allowed.has(k))).toEqual([])
  })

  test("the lookup service sends no credentials on the public call", () => {
    const svc = read("web", "src", "services", "trackingService.js")
    const block = svc.slice(svc.indexOf("export async function fetchProjectByCode"))
    const body = block.slice(0, block.indexOf("\n}"))
    expect(body).toContain("apiRequest")
    expect(body).not.toContain("authFetch")
  })
})

describe("the shared components are shared, not copied", () => {
  test("one timeline, rendered on all three surfaces", () => {
    // The failure this guards against is a fourth copy appearing when a
    // fourth surface needs one, and the four then drifting apart.
    const importers = [
      ["web", "src", "pages", "TrackPage.jsx"],
      ["web", "src", "pages", "PortalPage.jsx"],
      ["web", "src", "pages", "DashboardProjectDetailPage.jsx"],
      ["web", "src", "pages", "AdminClientProjectDetailPage.jsx"],
    ]
    for (const file of importers) {
      expect(read(...file)).toMatch(/import ProjectTimeline from ".*ProjectTimeline"/)
    }
  })

  test("the two surfaces that can act share one panel and one upload hook", () => {
    for (const page of ["PortalPage.jsx", "DashboardProjectDetailPage.jsx"]) {
      const src = read("web", "src", "pages", page)
      expect(src).toContain("FileRequestPanel")
      expect(src).toContain("useProjectPanels")
    }
  })
})
