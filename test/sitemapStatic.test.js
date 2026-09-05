// ─────────────────────────────────────────────────────────────────────────────
// T2-2 · what the build-time sitemap actually emits.
//
// Two things were wrong and neither was visible from reading the script:
//
//   1. /self-audit and /book were missing from staticRoutes. Both are real,
//      indexable pages with their own SEO entry, and both are conversion
//      surfaces — the lead magnet and the booking funnel. Neither was in the
//      sitemap and neither got hreflang alternates.
//   2. hreflang was gated on VITE_I18N_ENABLED === "true" while the SPA gated
//      on !== "false", so on every build where the variable is unset (CI and
//      the host both are) the app served /es and the sitemap said nothing
//      about it.
//
// So this runs the real generator rather than asserting on its source. The
// API base points at a closed port: the fetches fail instantly, which is the
// offline path the script is designed for, and keeps the test fast.
// ─────────────────────────────────────────────────────────────────────────────

const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const WEB = path.join(__dirname, "..", "web")
const OG_SCRIPT = path.join(WEB, "scripts", "generate-og-static.mjs")

function runSitemap(env = {}) {
  // The script resolves public/ from cwd, so give it a scratch cwd and let it
  // write there instead of into the repo.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-"))
  fs.mkdirSync(path.join(cwd, "public"))
  execFileSync(process.execPath, [path.join(WEB, "scripts", "generate-sitemap.mjs")], {
    cwd,
    env: {
      ...process.env,
      VITE_SITE_URL: "https://site.test",
      // Closed port — every fetch fails at once and the script falls back to
      // its static route list, which is what is under test here.
      VITE_API_BASE_URL: "http://127.0.0.1:9",
      ...env,
    },
    stdio: "pipe",
    timeout: 60_000,
  })
  return fs.readFileSync(path.join(cwd, "public", "sitemap-static.xml"), "utf8")
}

describe("the static sitemap", () => {
  let xml
  beforeAll(() => { xml = runSitemap() })

  test("includes the two conversion pages that were missing", () => {
    expect(xml).toContain("<loc>https://site.test/self-audit</loc>")
    expect(xml).toContain("<loc>https://site.test/book</loc>")
  })

  test("still includes the pages it always had", () => {
    for (const p of ["/", "/about", "/services", "/schools", "/store", "/portfolio", "/blog", "/contact"]) {
      expect(xml).toContain(`<loc>https://site.test${p === "/" ? "/" : p}</loc>`)
    }
  })

  test("emits hreflang with the flag UNSET — the case CI and the host are in", () => {
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain('hreflang="es" href="https://site.test/es/self-audit"')
    expect(xml).toContain('hreflang="es" href="https://site.test/es/book"')
    expect(xml).toContain('hreflang="x-default" href="https://site.test/"')
  })

  test("the home page's Spanish alternate is /es, not /es/", () => {
    expect(xml).toContain('hreflang="es" href="https://site.test/es"')
    expect(xml).not.toContain('href="https://site.test/es/"')
  })

  test('VITE_I18N_ENABLED=false really turns it off, in one place', () => {
    const off = runSitemap({ VITE_I18N_ENABLED: "false" })
    expect(off).not.toContain("hreflang")
    expect(off).not.toContain("xmlns:xhtml")
    // The pages themselves stay — only the alternates go.
    expect(off).toContain("<loc>https://site.test/book</loc>")
  })
})

describe("the static OG card map", () => {
  function runOgStatic(env = {}) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ogstatic-"))
    fs.mkdirSync(path.join(cwd, "public"))
    execFileSync(process.execPath, [OG_SCRIPT], {
      cwd,
      env: { ...process.env, ...env },
      stdio: "pipe",
      timeout: 60_000,
    })
    return JSON.parse(fs.readFileSync(path.join(cwd, "public", "og-static.json"), "utf8"))
  }

  let cards
  beforeAll(() => { cards = runOgStatic() })

  test("covers the public static pages in both languages", () => {
    const missing = []
    for (const p of ["/", "/about", "/services", "/schools", "/store", "/portfolio", "/blog", "/contact", "/self-audit", "/book"]) {
      if (!cards[p]) missing.push(p)
      const es = p === "/" ? "/es" : `/es${p}`
      if (!cards[es]) missing.push(es)
    }
    expect(missing).toEqual([])
  })

  test("every card has a title, a description and an absolute image", () => {
    const bad = []
    for (const [route, card] of Object.entries(cards)) {
      if (!card.title) bad.push(`${route}: no title`)
      if (!card.description) bad.push(`${route}: no description`)
      // A relative og:image is ignored by most crawlers, so a card with one
      // is worse than useless: it looks present and renders nothing.
      if (!/^https?:\/\//.test(card.image || "")) bad.push(`${route}: image not absolute (${card.image})`)
    }
    expect(bad).toEqual([])
  })

  test("the Spanish home card is actually Spanish, not the English one", () => {
    expect(cards["/es"].title).not.toBe(cards["/"].title)
  })

  test("a Spanish page with no Spanish entry falls back to English, not to nothing", () => {
    // Asserted as a property rather than against a named route: this used to
    // name /self-audit, which then GAINED a Spanish entry in T2-3 and broke a
    // test that was checking the fallback, not that route.
    const enOnly = Object.keys(cards)
      .filter((r) => !r.startsWith("/es"))
      .filter((r) => {
        const es = r === "/" ? "/es" : `/es${r}`
        return cards[es] && cards[es].title === cards[r].title
      })
    // Whichever routes those are, none of them may emit an empty card:
    // English is worse than Spanish here, but far better than nothing.
    for (const route of enOnly) {
      const es = route === "/" ? "/es" : `/es${route}`
      expect(cards[es].title).toBeTruthy()
      expect(cards[es].description).toBeTruthy()
    }
    // And the routes that DO have Spanish must actually differ, or the
    // merge is not happening at all.
    const translated = Object.keys(cards)
      .filter((r) => r.startsWith("/es"))
      .filter((r) => {
        const en = r === "/es" ? "/" : r.slice(3)
        return cards[en] && cards[r].title !== cards[en].title
      })
    expect(translated.length).toBeGreaterThan(5)
  })

  test("operator and auth surfaces get no share card", () => {
    const leaked = []
    for (const p of ["/login", "/signup", "/dashboard", "/admin", "/checkout", "/cart", "/reset-password", "/_system"]) {
      if (cards[p]) leaked.push(p)
      if (cards[`/es${p}`]) leaked.push(`/es${p}`)
    }
    expect(leaked).toEqual([])
  })

  test("the database-backed detail routes are not shadowed", () => {
    for (const route of Object.keys(cards)) {
      expect(route).not.toMatch(/^\/(?:es\/)?(?:store|blog|projects)\/./)
    }
  })

  test("the four service category pages ARE static — they are catalogue pages", () => {
    expect(cards["/services/it-strategy-consulting"]).toBeTruthy()
    expect(cards["/es/services/ai-automation"]).toBeTruthy()
  })

  test("VITE_I18N_ENABLED=false drops the Spanish cards", () => {
    const off = runOgStatic({ VITE_I18N_ENABLED: "false" })
    expect(Object.keys(off).some((k) => k.startsWith("/es"))).toBe(false)
    expect(off["/about"]).toBeTruthy()
  })
})
