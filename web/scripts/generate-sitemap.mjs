import fs from "node:fs/promises"
import path from "node:path"
import { CATEGORIES } from "../src/data/servicesCatalogue.js"

/* ───────────────────────────── config ──────────────────────────────────── */
const SITE_URL    = (process.env.VITE_SITE_URL    || "https://mustaphaukizuru.com").replace(/\/$/, "")
const API_BASE    = (process.env.VITE_API_BASE_URL || process.env.SITEMAP_API_BASE || SITE_URL).replace(/\/$/, "")
const I18N_ENABLED = process.env.VITE_I18N_ENABLED === "true"
const SPLIT_THRESHOLD = 500          // single file under this; sitemap index above
const FETCH_TIMEOUT_MS = 8000        // per-endpoint deadline

const publicDir   = path.resolve(process.cwd(), "public")
const outDir      = publicDir
// B5 · `build:seo` runs this AFTER `vite build` has already copied web/public
// into ../public, so a sitemap written only here reached the served build one
// deploy late — production kept serving the previous run's 12 URLs. Mirror
// the file into the build output whenever it exists.
const buildOutDir = path.resolve(process.cwd(), "..", "public")
// NOT "sitemap.xml": Hostinger's web server serves any existing file in the
// document root itself, so a static public/sitemap.xml shadows the dynamic
// Express route (src/app.js) that emits the DB-backed sitemap with hreflang
// alternates. This build-time file is the offline fallback only.
const STATIC_SITEMAP = "sitemap-static.xml"
const indexFile   = path.join(outDir, STATIC_SITEMAP)
const pagesFile   = path.join(outDir, "sitemap-pages.xml")
const productsXml = path.join(outDir, "sitemap-products.xml")
const servicesXml = path.join(outDir, "sitemap-services.xml")
const portfolioXml = path.join(outDir, "sitemap-portfolio.xml")
const blogXml      = path.join(outDir, "sitemap-blog.xml")

const routesFile   = path.join(publicDir, "sitemap-routes.json")
const productsFile = path.join(publicDir, "sitemap-products.json") // legacy override

/* ───────────────────────────── data ────────────────────────────────────── */
const staticRoutes = [
  { path: "/",           changefreq: "weekly",  priority: "1.0" },
  { path: "/about",      changefreq: "monthly", priority: "0.8" },
  { path: "/services",   changefreq: "weekly",  priority: "0.9" },
  { path: "/schools",    changefreq: "monthly", priority: "0.85" },
  { path: "/store",      changefreq: "daily",   priority: "0.9" },
  { path: "/portfolio",  changefreq: "weekly",  priority: "0.85" },
  { path: "/blog",       changefreq: "weekly",  priority: "0.85" },
  { path: "/contact",    changefreq: "monthly", priority: "0.7" },
  { path: "/terms",      changefreq: "yearly",  priority: "0.3" },
  { path: "/privacy",    changefreq: "yearly",  priority: "0.3" },
  { path: "/refund",     changefreq: "yearly",  priority: "0.3" },
  { path: "/cookies",    changefreq: "yearly",  priority: "0.3" },
]

/* ───────────────────────────── helpers ─────────────────────────────────── */
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw)
  } catch { return [] }
}

async function fetchJsonWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function tryFetchList(endpoints) {
  for (const url of endpoints) {
    try {
      const data = await fetchJsonWithTimeout(url)
      // B5 · the blog list answers { posts, total }; it was silently read as
      // zero items and no post ever reached the sitemap.
      const items = Array.isArray(data?.items) ? data.items
                  : Array.isArray(data?.data)  ? data.data
                  : Array.isArray(data?.posts) ? data.posts
                  : Array.isArray(data)        ? data
                  : []
      console.log(`  â ${url} â ${items.length} items`)
      return items
    } catch (err) {
      console.warn(`  â  ${url} â ${err.message}`)
    }
  }
  return []
}

function normalizeEntries(entries = []) {
  return entries
    .filter(Boolean)
    .map((entry) => {
      if (typeof entry === "string") {
        return { path: entry, changefreq: "monthly", priority: "0.7" }
      }
      return {
        path:       entry.path,
        lastmod:    entry.lastmod,
        changefreq: entry.changefreq || "monthly",
        priority:   entry.priority   || "0.7",
        images:     entry.images || [],
      }
    })
    .filter((e) => e.path && !e.path.startsWith("/admin") && !e.path.startsWith("/dashboard"))
}

function isoDate(value) {
  if (!value) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function imageBlock(img) {
  if (!img?.loc) return ""
  return [
    "    <image:image>",
    `      <image:loc>${escapeXml(img.loc)}</image:loc>`,
    img.title   ? `      <image:title>${escapeXml(img.title)}</image:title>`     : "",
    img.caption ? `      <image:caption>${escapeXml(img.caption)}</image:caption>` : "",
    "    </image:image>",
  ].filter(Boolean).join("\n")
}

function hreflangBlock(routePath) {
  if (!I18N_ENABLED) return ""
  const cleanPath = routePath === "/" ? "/" : routePath.replace(/\/$/, "")
  return [
    `    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${cleanPath}" />`,
    `    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/es${cleanPath === "/" ? "" : cleanPath}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${cleanPath}" />`,
  ].join("\n")
}

function urlBlock(entry) {
  const loc = `${SITE_URL}${entry.path === "/" ? "/" : entry.path.replace(/\/$/, "")}`
  const parts = [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : "",
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : "",
    entry.priority ? `    <priority>${entry.priority}</priority>` : "",
    hreflangBlock(entry.path),
    ...(entry.images || []).map(imageBlock),
    "  </url>",
  ].filter(Boolean)
  return parts.join("\n")
}

const URLSET_NS = [
  'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
  I18N_ENABLED ? 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' : "",
].filter(Boolean).join(" ")

function urlSetXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${URLSET_NS}>`,
    ...entries.map(urlBlock),
    "</urlset>",
    "",
  ].join("\n")
}

function sitemapIndexXml(children) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...children.map((c) => [
      "  <sitemap>",
      `    <loc>${SITE_URL}/${c.filename}</loc>`,
      c.lastmod ? `    <lastmod>${c.lastmod}</lastmod>` : "",
      "  </sitemap>",
    ].filter(Boolean).join("\n")),
    "</sitemapindex>",
    "",
  ].join("\n")
}

/* ───────────────────────── builders per resource ───────────────────────── */
function productEntries(products = []) {
  return products
    .filter((p) => p && p.slug)
    .map((p) => {
      const images = Array.isArray(p.images)
        ? p.images.map((i) => ({
            loc: i?.url?.startsWith("http") ? i.url : `${SITE_URL}${i?.url || ""}`,
            title: p.title,
            caption: p.shortDescription ? String(p.shortDescription).slice(0, 100) : undefined,
          })).filter((i) => i.loc && !i.loc.endsWith(SITE_URL))
        : []
      return {
        path:       `/store/${p.slug}`,
        lastmod:    isoDate(p.updatedAt || p.createdAt),
        changefreq: "weekly",
        priority:   p.isFeatured ? "0.9" : "0.7",
        images,
      }
    })
}

// B5 · /services/:slug resolves against the static catalogue CATEGORIES,
// not the Service table — DB slugs render the "not found" page with
// noindex, so listing them only invited crawlers to dead ends.
function serviceEntries() {
  return CATEGORIES
    .filter((c) => c && c.slug)
    .map((c) => ({
      path:       `/services/${c.slug}`,
      changefreq: "monthly",
      priority:   "0.8",
    }))
}

function portfolioEntries(items = []) {
  return items
    .filter((p) => p && p.slug)
    .map((p) => ({
      path:       `/projects/${p.slug}`,
      lastmod:    isoDate(p.updatedAt || p.createdAt),
      changefreq: "monthly",
      priority:   "0.7",
    }))
}

function blogEntries(posts = []) {
  return posts
    .filter((p) => p && p.slug)
    .map((p) => ({
      path:       `/blog/${p.slug}`,
      lastmod:    isoDate(p.updatedAt || p.publishedAt || p.createdAt),
      changefreq: "weekly",
      priority:   "0.7",
    }))
}

async function writeMirrored(filename, xml) {
  await fs.writeFile(path.join(outDir, filename), xml, "utf8")
  const mirrored = path.join(buildOutDir, filename)
  if (mirrored !== path.join(outDir, filename) && (await fs.stat(buildOutDir).then((st) => st.isDirectory()).catch(() => false))) {
    await fs.writeFile(mirrored, xml, "utf8")
    console.log(`[sitemap] mirrored → ${mirrored}`)
  }
}
/* ───────────────────────────── main ────────────────────────────────────── */
async function main() {
  console.log(`[sitemap] generating from API_BASE=${API_BASE}`)

  const [products, portfolio, blogPosts] = await Promise.all([
    tryFetchList([
      `${API_BASE}/api/v1/products?limit=500`,
      `${API_BASE}/api/products?limit=500`,
    ]),
    tryFetchList([
      `${API_BASE}/api/v1/portfolio?limit=200`,
      `${API_BASE}/api/portfolio?limit=200`,
    ]),
    tryFetchList([
      `${API_BASE}/api/v1/blog?limit=200`,
      `${API_BASE}/api/blog?limit=200`,
    ]),
  ])

  const extraRoutes  = normalizeEntries(await readJson(routesFile))
  const legacyExtra  = normalizeEntries(await readJson(productsFile))

  const productList   = productEntries(products)
  const serviceList   = serviceEntries()
  const portfolioList = portfolioEntries(portfolio)
  const blogList      = blogEntries(blogPosts)

  const allPages = [...staticRoutes, ...extraRoutes, ...legacyExtra]
    .filter((e, i, arr) => i === arr.findIndex((o) => o.path === e.path))
    .sort((a, b) => a.path.localeCompare(b.path))

  const totalCount = allPages.length + productList.length + serviceList.length + portfolioList.length + blogList.length
  console.log(`[sitemap] totals: pages=${allPages.length} products=${productList.length} services=${serviceList.length} portfolio=${portfolioList.length} blog=${blogList.length} â ${totalCount}`)

  // Single file path — total under SPLIT_THRESHOLD.
  if (totalCount <= SPLIT_THRESHOLD) {
    const flat = [...allPages, ...productList, ...serviceList, ...portfolioList, ...blogList]
      .sort((a, b) => a.path.localeCompare(b.path))
    await writeMirrored(STATIC_SITEMAP, urlSetXml(flat))
    // Clean up split files if they exist from a previous large run.
    for (const f of [pagesFile, productsXml, servicesXml, portfolioXml, blogXml]) {
      try { await fs.unlink(f) } catch { /* not present â fine */ }
    }
    console.log(`[sitemap] single-file mode â ${indexFile} (${flat.length} URLs)`)
    return
  }

  // Sitemap-index path — write per-resource children + index pointing to them.
  const today = new Date().toISOString().slice(0, 10)
  const writes = []
  if (allPages.length)     writes.push(["sitemap-pages.xml",     pagesFile,    allPages])
  if (productList.length)  writes.push(["sitemap-products.xml",  productsXml,  productList])
  if (serviceList.length)  writes.push(["sitemap-services.xml",  servicesXml,  serviceList])
  if (portfolioList.length) writes.push(["sitemap-portfolio.xml", portfolioXml, portfolioList])
  if (blogList.length)     writes.push(["sitemap-blog.xml",      blogXml,      blogList])

  await Promise.all(writes.map(([_, file, list]) => fs.writeFile(file, urlSetXml(list), "utf8")))

  const indexXml = sitemapIndexXml(writes.map(([filename]) => ({ filename, lastmod: today })))
  await fs.writeFile(indexFile, indexXml, "utf8")
  console.log(`[sitemap] index mode â ${writes.length} child sitemaps + ${indexFile}`)
}

main().catch((err) => {
  console.error("[sitemap] failed", err)
  process.exit(1)
})
