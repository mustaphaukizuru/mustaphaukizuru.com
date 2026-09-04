/**
 * The server's SPA route list must cover every route the app declares.
 *
 * T3-3. This is the test that would have caught a live 404. `/schools` was
 * added to App.jsx, the navbar, the footer and sitemap.xml, and not to
 * src/utils/spaRoutes.js — so Express answered 404 for it while clicking
 * through the site worked perfectly, because React Router never asks the
 * server. The only ways to hit it were the ways a stranger arrives: typing
 * the address, reloading, or following a shared link. Google was being told
 * to index it in the sitemap.
 *
 * So this parses App.jsx for every absolute route path and asserts the
 * server would serve each one. It reads the file rather than importing it —
 * App.jsx is JSX with 60-odd lazy imports and belongs to the other test
 * lane — which is the same trade-off test/uploadDestinations.test.js makes.
 */
const fs = require("fs")
const path = require("path")

const { SPA_ROUTES, matchesSpaRoute } = require("../src/utils/spaRoutes")

const APP = fs.readFileSync(path.join(__dirname, "..", "web", "src", "App.jsx"), "utf8")

/**
 * Absolute paths only. Nested children inside the /dashboard and /admin
 * routers are relative ("orders", "blog/:id/edit") and are covered by the
 * wildcards in PRIVATE_ROUTES; a catch-all "*" is not a route.
 */
const declared = [...new Set([...APP.matchAll(/<Route\s+path="(\/[^"*]+)"/g)].map((m) => m[1]))]

/** Turn ":slug" into a concrete segment so the matcher can be exercised. */
const concrete = (p) => p.replace(/:[A-Za-z0-9_]+/g, "sample")

describe("App.jsx and the server agree on what exists", () => {
  test("the parse found the routes (a silent zero would make this test useless)", () => {
    expect(declared.length).toBeGreaterThan(25)
    expect(declared).toContain("/schools")
    expect(declared).toContain("/services/:slug")
  })

  test("every absolute route in App.jsx is served rather than 404'd", () => {
    const orphaned = declared.filter((p) => !matchesSpaRoute(concrete(p)))
    expect(orphaned).toEqual([])
  })

  test("the Spanish mirror serves the same public tree", () => {
    // The mirror deliberately omits three things: /home (an alias of /),
    // /_system (an internal preview surface) and /es itself, which is the
    // mirror's own root — prefixing that again would be /es/es.
    const NOT_MIRRORED = ["/home", "/_system", "/es"]
    const publicish = declared
      .filter((p) => !p.startsWith("/admin") && !p.startsWith("/dashboard") && !p.startsWith("/es"))
      .filter((p) => !NOT_MIRRORED.includes(p))

    const orphaned = publicish.filter((p) => !matchesSpaRoute(`/es${concrete(p)}`))
    expect(orphaned).toEqual([])

    // And the omissions are deliberate, not an oversight: assert they really
    // are absent, so removing them from the filter above fails loudly.
    expect(matchesSpaRoute("/es/home")).toBe(false)
    expect(matchesSpaRoute("/es/_system")).toBe(false)
    expect(matchesSpaRoute("/es")).toBe(true)
  })

  test("a Spanish visitor can reload the schools page", () => {
    expect(matchesSpaRoute("/schools")).toBe(true)
    expect(matchesSpaRoute("/es/schools")).toBe(true)
  })
})

describe("the sitemap never advertises a URL the server refuses", () => {
  const SITEMAP = fs.readFileSync(
    path.join(__dirname, "..", "web", "scripts", "generate-sitemap.mjs"), "utf8",
  )
  const sitemapPaths = [...new Set([...SITEMAP.matchAll(/path:\s*"(\/[^"]*)"/g)].map((m) => m[1]))]

  test("the parse found the static sitemap routes", () => {
    expect(sitemapPaths.length).toBeGreaterThan(8)
    expect(sitemapPaths).toContain("/schools")
  })

  test("every static sitemap path is served", () => {
    const lying = sitemapPaths.filter((p) => !matchesSpaRoute(p))
    expect(lying).toEqual([])
  })
})

describe("route list hygiene", () => {
  test("no duplicates, and every entry starts with a slash", () => {
    expect(SPA_ROUTES.length).toBe(new Set(SPA_ROUTES).size)
    expect(SPA_ROUTES.filter((p) => !p.startsWith("/"))).toEqual([])
  })

  test("a genuinely unknown path still 404s — the matcher is not a catch-all", () => {
    expect(matchesSpaRoute("/nope")).toBe(false)
    expect(matchesSpaRoute("/schools/extra/segments")).toBe(false)
  })
})
