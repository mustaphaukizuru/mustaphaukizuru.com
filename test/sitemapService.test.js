/**
 * src/services/sitemapService — B5.
 *
 * What the sitemap must and must not say:
 *   - every routable static page, including /portfolio, /blog and /cookies
 *   - /self-audit (public lead magnet) but nothing under /admin or /dashboard
 *   - products only when published AND active AND not deleted
 *   - services = the four catalogue categories, never Service table slugs
 *     (they render the noindex "not found" page)
 *   - published blog posts, which were never listed before
 *   - a failing section is skipped, not fatal
 *   - the category slugs mirrored in src/config stay in sync with the
 *     frontend catalogue they are copied from
 */

jest.mock("../src/lib/prisma", () => ({
  product:          { findMany: jest.fn() },
  service:          { findMany: jest.fn() },
  portfolio: { findMany: jest.fn() },
  blogPost:         { findMany: jest.fn() },
}))

const fs = require("fs")
const path = require("path")
const prisma = require("../src/lib/prisma")
const { getSitemapXml, clearSitemapCache, SITE_URL } = require("../src/services/sitemapService")
const { SERVICE_CATEGORY_SLUGS } = require("../src/config/serviceCategorySlugs")

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE_URL, ""))

beforeEach(() => {
  jest.clearAllMocks()
  clearSitemapCache()
  jest.spyOn(console, "warn").mockImplementation(() => {})
  prisma.product.findMany.mockResolvedValue([{ slug: "brand-kit", updatedAt: new Date("2026-08-01") }])
  prisma.service.findMany.mockResolvedValue([{ slug: "cloud-migration-automation", updatedAt: new Date() }])
  prisma.portfolio.findMany.mockResolvedValue([{ slug: "raindrop", updatedAt: new Date("2026-07-01") }])
  prisma.blogPost.findMany.mockResolvedValue([
    { slug: "hello-world", updatedAt: new Date("2026-06-17"), publishedAt: new Date("2026-06-17") },
  ])
})

afterEach(() => console.warn.mockRestore())

test("lists every routable static page and no admin-gated one", async () => {
  const { xml } = await getSitemapXml({ force: true })
  const paths = locs(xml)
  for (const p of ["/", "/about", "/services", "/store", "/portfolio", "/blog", "/contact", "/book", "/self-audit", "/privacy", "/terms", "/refund", "/cookies"]) {
    expect(paths).toContain(p)
  }
  expect(paths.some((p) => p.startsWith("/admin") || p.startsWith("/dashboard"))).toBe(false)
})

test("products must be published, active and not deleted — same rule as the public catalogue", async () => {
  const { xml } = await getSitemapXml({ force: true })
  expect(locs(xml)).toContain("/store/brand-kit")
  const where = prisma.product.findMany.mock.calls[0][0].where
  expect(where).toEqual({ status: "published", isActive: true, deletedAt: null })
})

test("services are the catalogue categories, never Service table slugs", async () => {
  const { xml } = await getSitemapXml({ force: true })
  const paths = locs(xml)
  for (const slug of SERVICE_CATEGORY_SLUGS) expect(paths).toContain(`/services/${slug}`)
  expect(paths).not.toContain("/services/cloud-migration-automation")
  expect(prisma.service.findMany).not.toHaveBeenCalled()
})

test("published blog posts are listed with their date", async () => {
  const { xml } = await getSitemapXml({ force: true })
  expect(xml).toMatch(/<loc>[^<]*\/blog\/hello-world<\/loc>\s*<lastmod>2026-06-17<\/lastmod>/)
  expect(prisma.blogPost.findMany.mock.calls[0][0].where).toEqual({ status: "published", deletedAt: null })
})

test("a failing section is skipped, the rest of the sitemap still builds", async () => {
  prisma.blogPost.findMany.mockRejectedValueOnce(new Error("table missing"))
  const { xml } = await getSitemapXml({ force: true })
  const paths = locs(xml)
  expect(paths).toContain("/store/brand-kit")
  expect(paths).toContain("/projects/raindrop")
  expect(paths.some((p) => p.startsWith("/blog/"))).toBe(false)
})

test("the mirrored category slugs match the frontend catalogue", () => {
  const src = fs.readFileSync(path.join(__dirname, "../web/src/data/servicesCatalogue.js"), "utf8")
  // Every category slug must appear as a `slug: "<x>"` literal in the catalogue…
  for (const slug of SERVICE_CATEGORY_SLUGS) expect(src).toMatch(new RegExp("slug:\\s*\"" + slug + "\""))
  // …and the catalogue must not have grown a fifth top-level category the mirror lacks.
  const categoriesBlock = src.slice(src.indexOf("export const CATEGORIES"), src.indexOf("export const CATEGORY_FAQS"))
  const topLevel = [...categoriesBlock.matchAll(/^\s{2,4}slug:\s*"([a-z0-9-]+)"/gm)].map((m) => m[1])
  expect(topLevel.sort()).toEqual([...SERVICE_CATEGORY_SLUGS].sort())
})
