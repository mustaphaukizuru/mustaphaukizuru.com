const path = require("path")
const { injectMeta, escapeAttr, absoluteUrl, createOgInjector } = require("../src/middleware/ogInjector")

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

  test("skips non-detail routes", async () => {
    const mw = createOgInjector({ indexPath, lookupFn: async () => ({}) })
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
