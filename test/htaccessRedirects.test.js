// ─────────────────────────────────────────────────────────────────────────────
// T2-6 · the canonical-URL rules, and the order they must stay in.
//
// One URL per page, or the same content competes with itself in the index and
// every share link splits its signals across variants. Three rules do it:
// https, apex-not-www, and no trailing slash.
//
// A .htaccess cannot be executed here, so what these check is the things that
// actually go wrong with rewrite rules: the wrong order, a missing condition
// that turns a redirect into a loop, and editing the copy instead of the
// source. All three are silent until the site is live and wrong.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const SOURCE = path.join(ROOT, "web", "public", ".htaccess")
const BUILT = path.join(ROOT, "public", ".htaccess")

const src = fs.readFileSync(SOURCE, "utf8")

const lineOf = (needle) => src.split("\n").findIndex((l) => l.includes(needle))

describe("the source file is the one that was edited", () => {
  test("web/public/.htaccess and public/.htaccess agree", () => {
    // Vite copies web/public/ into the repo-root public/ on every build, so
    // editing only the built copy is undone by the next build — the file says
    // so itself, which is a good sign someone has already been caught by it.
    expect(fs.readFileSync(BUILT, "utf8")).toBe(src)
  })
})

describe("maintenance still comes first", () => {
  test("the 503 rule is above every redirect", () => {
    // During a deploy window a request should get the 503 immediately, not a
    // redirect to a host that is also 503.
    const maintenance = lineOf("RewriteRule ^ - [R=503,L]")
    const firstRedirect = lineOf("[R=301,L]")
    expect(maintenance).toBeGreaterThan(-1)
    expect(firstRedirect).toBeGreaterThan(maintenance)
  })

  test("the error pages are still excluded from it", () => {
    // Otherwise the ErrorDocument subrequest is itself answered 503, in a loop.
    expect(src).toContain("RewriteCond %{REQUEST_URI} !^/(404|500|503)\\.html$")
  })
})

describe("https", () => {
  test("redirects, and checks the forwarded header so it cannot loop", () => {
    // Behind a terminating proxy %{HTTPS} is "off" for an already-secure
    // request. Redirecting that is an infinite loop, and it is the single
    // most common way this rule takes a site down.
    expect(src).toContain("RewriteCond %{HTTPS} !=on")
    expect(src).toContain("RewriteCond %{HTTP:X-Forwarded-Proto} !=https")
    expect(src).toMatch(/RewriteRule \^ https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\} \[R=301,L\]/)
  })
})

describe("apex, not www", () => {
  test("strips www and keeps the rest of the URL", () => {
    expect(src).toContain("RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]")
    expect(src).toContain("RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]")
  })

  test("matches the direction the app's own canonical tags point", () => {
    // siteSeo.js SITE_URL is apex. If the redirect went the other way every
    // page would contradict its own canonical tag.
    const siteSeo = fs.readFileSync(path.join(ROOT, "web", "src", "seo", "siteSeo.js"), "utf8")
    const m = siteSeo.match(/export const SITE_URL = "([^"]+)"/)
    expect(m).toBeTruthy()
    expect(m[1]).not.toMatch(/\/\/www\./)
  })
})

describe("trailing slash", () => {
  test("is stripped, but never for a real directory", () => {
    // Apache serves a directory only when the URL ends in a slash. Stripping
    // it unconditionally breaks /assets/ and everything else on disk.
    expect(src).toContain("RewriteCond %{REQUEST_FILENAME} !-d")
    expect(src).toContain("RewriteRule ^(.+)/$ /$1 [R=301,L,QSA]")
  })

  test("keeps the query string", () => {
    // QSA. Dropping utm_* on a canonicalisation is how attribution goes
    // missing, and it goes missing invisibly.
    const rule = src.split("\n").find((l) => l.includes("RewriteRule ^(.+)/$"))
    expect(rule).toContain("QSA")
  })

  test("cannot match the root, so `/` is never redirected to the empty path", () => {
    // `^(.+)/$` requires at least one character before the slash.
    const rule = src.split("\n").find((l) => l.includes("RewriteRule ^(.+)/$"))
    const pattern = new RegExp(rule.match(/RewriteRule (\S+)/)[1])
    expect(pattern.test("/")).toBe(false)
    expect(pattern.test("about/")).toBe(true)
  })
})

describe("the rules are ordered so a request needs at most three hops", () => {
  test("https, then www, then slash", () => {
    const https = lineOf("RewriteCond %{HTTPS} !=on")
    const www = lineOf("RewriteCond %{HTTP_HOST} ^www")
    const slash = lineOf("RewriteCond %{REQUEST_FILENAME} !-d")
    expect(https).toBeLessThan(www)
    expect(www).toBeLessThan(slash)
  })

  test("every redirect is permanent", () => {
    // A 302 on a canonicalisation tells crawlers the split is temporary and
    // keeps both variants indexed.
    const redirects = src.split("\n").filter((l) => /RewriteRule .*R=30\d/.test(l))
    expect(redirects.length).toBeGreaterThanOrEqual(3)
    for (const rule of redirects) expect(rule).toContain("R=301")
  })
})
