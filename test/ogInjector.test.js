const fs = require("fs")
const os = require("os")
const path = require("path")
const { injectMeta, escapeAttr, absoluteUrl, createOgInjector, staticKey, fallbackOgImage } = require("../src/middleware/ogInjector")

// A path that cannot exist, for the "the generator never ran" case.
const MISSING_CARDS = path.join(os.tmpdir(), "og-static-does-not-exist-8f2b1c.json")

const FIXTURE = `<!doctype html><html><head>
    <meta name="description" content="Default desc" />
    <title>Default Title</title>
    <meta property="og:title" content="Default Title" />
    <meta property="og:image" content="https://example.com/og/og-default.png" />
    <meta name="twitter:card" content="summary" />
  </head><body><div id="root"></div></body></html>`

describe("escapeAttr", () => {
  test("escapes attribute-breaking characters", () => {
    expect(escapeAttr(`a"b'c<d>e&f`)).toBe("a&quot;b&#39;c&lt;d&gt;e&amp;f")
  })
})

describe("injectMeta", () => {
  const out = injectMeta(FIXTURE, {
    title: `Cool "Product" <b>`,
    description: "Buy & enjoy",
    image: "https://site.test/img.png",
    url: "https://site.test/store/cool",
  })

  test("replaces title and existing tags", () => {
    expect(out).toContain(`<title>Cool &quot;Product&quot; &lt;b&gt;</title>`)
    expect(out).toContain(`<meta property="og:title" content="Cool &quot;Product&quot; &lt;b&gt;" />`)
    expect(out).toContain(`<meta property="og:image" content="https://site.test/img.png" />`)
    expect(out).toContain(`<meta name="twitter:card" content="summary_large_image" />`)
    expect(out).not.toContain("Default Title")
    expect(out).not.toContain("og-default.png")
  })

  test("appends tags that did not exist, without duplicates", () => {
    expect(out).toContain(`<meta property="og:url" content="https://site.test/store/cool" />`)
    expect(out).toContain(`<meta name="twitter:image" content="https://site.test/img.png" />`)
    expect(out).toContain(`<meta name="description" content="Buy &amp; enjoy" />`)
    expect((out.match(/og:title/g) || []).length).toBe(1)
  })
})

describe("absoluteUrl", () => {
  test("prefixes relative paths", () => expect(absoluteUrl("https://a.b/", "/x.png")).toBe("https://a.b/x.png"))
  test("keeps absolute", () => expect(absoluteUrl("https://a.b", "https://c.d/x.png")).toBe("https://c.d/x.png"))
  test("null passthrough", () => expect(absoluteUrl("https://a.b", null)).toBeNull())
})

describe("createOgInjector", () => {
  const indexPath = path.join(__dirname, "../public/index.html")
  const mkRes = () => {
    const res = { headers: {}, statusCode: 0, body: null }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.status = (c) => { res.statusCode = c; return res }
    res.send = (b) => { res.body = b }
    return res
  }

  test("falls through on a route with no card and no static map", async () => {
    // staticCardsPath deliberately points at nothing: a build that skipped
    // generate-og-static.mjs must degrade to the generic card baked into
    // index.html, never to a 500 on the home page.
    const mw = createOgInjector({ indexPath, lookupFn: async () => ({}), staticCardsPath: MISSING_CARDS })
    const next = jest.fn()
    await mw({ method: "GET", path: "/about" }, mkRes(), next)
    expect(next).toHaveBeenCalled()
  })

  test("serves the SPA shell with a real 404 when the entity does not exist", async () => {
    const mw = createOgInjector({ indexPath, lookupFn: async () => null })
    const next = jest.fn()
    const res = mkRes()
    await mw({ method: "GET", path: "/blog/missing" }, res, next)
    // A dead detail URL must not be a soft-404: the client still renders its
    // not-found screen, but crawlers get the correct status.
    expect(res.statusCode).toBe(404)
    expect(res.body).toContain("<html")
    expect(next).not.toHaveBeenCalled()
  })

  test("still falls through when the lookup itself fails (never a false 404)", async () => {
    const mw = createOgInjector({
      indexPath,
      timeoutMs: 5,
      lookupFn: () => new Promise((r) => setTimeout(() => r({ title: "Slow" }), 50)),
    })
    const next = jest.fn()
    const res = mkRes()
    await mw({ method: "GET", path: "/blog/slow" }, res, next)
    expect(res.statusCode).not.toBe(404)
  })

  test("injects and sends 200 when found", async () => {
    const mw = createOgInjector({
      indexPath,
      siteUrl: "https://site.test",
      lookupFn: async () => ({ title: "Post", description: "D", image: "/c.png" }),
    })
    const res = mkRes()
    const next = jest.fn()
    await mw({ method: "GET", path: "/es/blog/post" }, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`content="https://site.test/c.png"`)
    expect(res.body).toContain(`content="https://site.test/es/blog/post"`)
    expect(res.body).toContain("<title>Post | Mustapha Ukizuru</title>")
  })

  test("times out slow lookup and still serves html with 200", async () => {
    const mw = createOgInjector({
      indexPath,
      timeoutMs: 20,
      lookupFn: () => new Promise((r) => setTimeout(() => r({ title: "ZZ_LATE_MARKER_ZZ" }), 200)),
    })
    const res = mkRes()
    await mw({ method: "GET", path: "/store/slow" }, res, jest.fn())
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain("ZZ_LATE_MARKER_ZZ")
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Static page cards (T2-2)

   The database-backed branch only covers /store, /blog, /services and
   /projects detail pages. Everything else — the home page, /about, /schools,
   /self-audit, /book, the legal pages and every /es mirror — used to fall
   through to next(), so a crawler got the one generic English card baked into
   index.html regardless of page or language. web/scripts/generate-og-static.mjs
   emits the SPA's own per-page metadata as a flat map and the injector serves
   it from memory.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("static page cards", () => {
  const indexPath = path.join(__dirname, "../public/index.html")
  let cardsPath

  const CARDS = {
    "/": { title: "Home EN", description: "English home", image: "/og/home.png", type: "website" },
    "/es": { title: "Inicio ES", description: "Portada en espanol", image: "/og/home.png", type: "website" },
    "/about": { title: "About", description: "About page", image: "https://cdn.test/a.png", type: "profile" },
  }

  const mkRes = () => {
    const res = { headers: {}, statusCode: 0, body: null }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.status = (c) => { res.statusCode = c; return res }
    res.send = (b) => { res.body = b }
    return res
  }

  const run = async (reqPath, opts = {}) => {
    const mw = createOgInjector({
      indexPath,
      siteUrl: "https://site.test",
      staticCardsPath: cardsPath,
      lookupFn: async () => null,
      ...opts,
    })
    const res = mkRes()
    const next = jest.fn()
    await mw({ method: "GET", path: reqPath }, res, next)
    return { res, next }
  }

  beforeAll(() => {
    cardsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "og-static-")), "og-static.json")
    fs.writeFileSync(cardsPath, JSON.stringify(CARDS), "utf8")
  })

  test("the home page gets its own card instead of the generic one", async () => {
    const { res, next } = await run("/")
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain("<title>Home EN | Mustapha Ukizuru</title>")
    expect(res.body).toContain('content="https://site.test/og/home.png"')
    expect(res.body).toContain('content="en_US"')
  })

  test("the Spanish mirror gets the Spanish card and es_MX", async () => {
    const { res } = await run("/es")
    expect(res.body).toContain("<title>Inicio ES | Mustapha Ukizuru</title>")
    expect(res.body).toContain('content="es_MX"')
    expect(res.body).toContain('content="https://site.test/es"')
  })

  test("a trailing slash is the same page", async () => {
    // /es/ and /es are one page and only one of them is a key. Without the
    // normalisation a shared slashed URL silently gets the generic card.
    const { res } = await run("/es/")
    expect(res.body).toContain("Inicio ES")
  })

  test("an absolute image is left alone", async () => {
    const { res } = await run("/about")
    expect(res.body).toContain('content="https://cdn.test/a.png"')
    expect(res.body).toContain('content="profile"')
  })

  test("an unlisted page still falls through to the SPA", async () => {
    const { next } = await run("/some/unlisted/page")
    expect(next).toHaveBeenCalled()
  })

  test("a malformed map degrades to the generic card, it does not throw", async () => {
    const broken = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "og-bad-")), "og-static.json")
    fs.writeFileSync(broken, "{ not json", "utf8")
    const { next } = await run("/", { staticCardsPath: broken })
    expect(next).toHaveBeenCalled()
  })

  test("detail routes still reach the database lookup", async () => {
    // The static branch must not shadow the entity branch: /store/x is a real
    // product page whose card comes from its own row.
    const { res } = await run("/store/thing", {
      lookupFn: async () => ({ title: "Real Product", description: "D", image: "/p.png" }),
    })
    expect(res.body).toContain("Real Product")
  })

  test("staticKey normalises exactly the trailing slash", () => {
    expect(staticKey("/")).toBe("/")
    expect(staticKey("/es/")).toBe("/es")
    expect(staticKey("/es")).toBe("/es")
    expect(staticKey("/a/b/")).toBe("/a/b")
    expect(staticKey("///")).toBe("/")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   Per-category share cards · the coupling that broke silently
   ══════════════════════════════════════════════════════════════════════════

   `/services/:slug` matches ROUTE_RE, so it takes the DATABASE path — and no
   Service row has an image column populated. `fallbackOgImage()` is what
   saves it, and it looks for exactly one path: /og/<kind>/<slug>.png.

   The first attempt at these cards wrote them to `og-service-<slug>.png` and
   pointed src/seo/pageSeo.js at them. Every unit test passed, the files
   existed, the SPA rendered the right tag — and a crawler still got
   og-default.png, because the static map pageSeo feeds is only consulted for
   paths that do NOT match ROUTE_RE. Found with `curl -A facebookexternalhit`,
   which is the only thing that looks at this the way the consumer does.

   So the test is not "does a card exist" but "does a card exist WHERE THE
   INJECTOR LOOKS", for every slug in the closed set of four. Rename the
   files or the folder and this goes red.
   ══════════════════════════════════════════════════════════════════════════ */

describe("service category share cards", () => {
  const OG_DIR = path.join(__dirname, "..", "public", "og")
  const CATEGORIES = [
    "it-strategy-consulting",
    "ai-automation",
    "cloud-architecture-migration",
    "digital-product-engineering",
  ]

  test.each(CATEGORIES)("%s resolves to its own card, not the generic one", (slug) => {
    const resolved = fallbackOgImage("services", slug, OG_DIR)
    expect(resolved).toBe(`/og/services/${slug}.png`)
    expect(resolved).not.toMatch(/og-default/)
  })

  test("the four cards are distinct files, not four copies of one", () => {
    // A generator bug that wrote the same SVG four times would pass the
    // resolution test above and still ship four identical previews, which is
    // the defect this whole change exists to remove.
    const sizes = CATEGORIES.map((slug) => fs.statSync(path.join(OG_DIR, "services", `${slug}.png`)).size)
    expect(new Set(sizes).size).toBe(CATEGORIES.length)
  })

  test("an unknown service slug still falls back to the generic card", () => {
    // The fallback must stay a fallback. A retired slug or a typo gets the
    // generic card rather than a 404 image reference in a share preview.
    expect(fallbackOgImage("services", "not-a-real-category", OG_DIR)).toMatch(/og-default/)
  })
})
