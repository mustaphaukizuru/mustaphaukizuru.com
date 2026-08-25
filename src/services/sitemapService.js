const prisma = require("../lib/prisma")

/* ──────────────────────────────────────────────────────────────────────────
 *  sitemapService
 *
 *  Builds an XML sitemap (sitemaps.org/0.9) from live DB content + a
 *  hand-curated list of static marketing pages. Result is cached in-process
 *  for 1 hour to keep search-engine traffic from hammering the DB.
 *
 *  Pages included:
 *    Static       — Home, About, Services, Store, Contact, Book,
 *                   Privacy, Terms, Refund
 *    Products     — every active Product, by /store/:slug
 *    Services     — every active Service, by /services/:slug
 *    Portfolio    — every published PortfolioProject, by /projects/:slug
 *
 *  Frequency / priority hints follow Google's modern guidance — most signals
 *  are now ignored except <lastmod>, but we set the others for older crawlers
 *  (Bing, Yandex, Baidu) that still respect them.
 *  ──────────────────────────────────────────────────────────────────── */

const ONE_HOUR_MS = 60 * 60 * 1000
let cache = { xml: null, builtAt: 0 }

const SITE_URL = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://mustaphaukizuru.com")
  .replace(/\/$/, "")

/* Static pages — manually curated. Keep in sync with public router list. */
const STATIC_PAGES = [
  { path: "/",          changefreq: "weekly",  priority: 1.0 },
  { path: "/about",     changefreq: "monthly", priority: 0.8 },
  { path: "/services",  changefreq: "weekly",  priority: 0.9 },
  { path: "/store",     changefreq: "daily",   priority: 0.9 },
  { path: "/contact",   changefreq: "monthly", priority: 0.7 },
  { path: "/book",      changefreq: "weekly",  priority: 0.8 },
  { path: "/privacy",   changefreq: "yearly",  priority: 0.3 },
  { path: "/terms",     changefreq: "yearly",  priority: 0.3 },
  { path: "/refund",    changefreq: "yearly",  priority: 0.3 },
]

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`]
  if (lastmod)    parts.push(`    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`)
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority != null) parts.push(`    <priority>${Number(priority).toFixed(2)}</priority>`)
  parts.push(`  </url>`)
  return parts.join("\n")
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Build sitemap from current DB state.
 *  Each query is wrapped in try/catch so a missing model (e.g. portfolio
 *  not yet seeded) doesn't break the whole sitemap.
 *  ──────────────────────────────────────────────────────────────────── */
async function buildSitemapXml() {
  const today = new Date().toISOString().slice(0, 10)
  const entries = []

  // Static pages — use today's date as lastmod since we can't track per-page changes.
  STATIC_PAGES.forEach((p) => {
    entries.push(urlEntry({
      loc:        `${SITE_URL}${p.path}`,
      lastmod:    today,
      changefreq: p.changefreq,
      priority:   p.priority,
    }))
  })

  // Products — only active and visible
  try {
    const products = await prisma.product.findMany({
      where:  { isActive: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
    })
    products.forEach((p) => {
      if (!p.slug) return
      entries.push(urlEntry({
        loc:        `${SITE_URL}/store/${encodeURIComponent(p.slug)}`,
        lastmod:    p.updatedAt,
        changefreq: "weekly",
        priority:   0.7,
      }))
    })
  } catch (e) {
    console.warn("[sitemap] product query failed:", e.message)
  }

  // Services — published + not soft-deleted. (Service has no `isActive`
  // column; the previous filter threw on every build and services were
  // silently missing from the sitemap.)
  try {
    const services = await prisma.service.findMany({
      where:  { status: "published", deletedAt: null },
      select: { slug: true, updatedAt: true },
    })
    services.forEach((s) => {
      if (!s.slug) return
      entries.push(urlEntry({
        loc:        `${SITE_URL}/services/${encodeURIComponent(s.slug)}`,
        lastmod:    s.updatedAt,
        changefreq: "monthly",
        priority:   0.7,
      }))
    })
  } catch (e) {
    console.warn("[sitemap] service query failed:", e.message)
  }

  // Portfolio projects — published only
  try {
    if (typeof prisma.portfolioProject?.findMany === "function") {
      const projects = await prisma.portfolioProject.findMany({
        where:  { status: "published" },
        select: { slug: true, updatedAt: true },
      })
      projects.forEach((p) => {
        if (!p.slug) return
        entries.push(urlEntry({
          loc:        `${SITE_URL}/projects/${encodeURIComponent(p.slug)}`,
          lastmod:    p.updatedAt,
          changefreq: "yearly",
          priority:   0.5,
        }))
      })
    }
  } catch (e) {
    console.warn("[sitemap] portfolio query failed:", e.message)
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entries.join("\n"),
    `</urlset>`,
    ``,
  ].join("\n")
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Public API — call from the route handler. Caches for 1 hour.
 *  Pass `force: true` to bypass the cache (used by an admin "regenerate"
 *  endpoint if we ever add one).
 *  ──────────────────────────────────────────────────────────────────── */
async function getSitemapXml({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache.xml && now - cache.builtAt < ONE_HOUR_MS) {
    return { xml: cache.xml, fromCache: true, builtAt: cache.builtAt }
  }
  const xml = await buildSitemapXml()
  cache = { xml, builtAt: now }
  return { xml, fromCache: false, builtAt: now }
}

function clearSitemapCache() {
  cache = { xml: null, builtAt: 0 }
}

module.exports = { getSitemapXml, clearSitemapCache, SITE_URL }
