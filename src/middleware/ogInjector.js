/**
 * ogInjector · server-side Open Graph / Twitter card injection for shareable
 * detail pages (/store/:slug, /blog/:slug, /services/:slug, /projects/:slug,
 * plus the /es/ mirrors). Crawlers (Facebook, LinkedIn, Slack, X) never run
 * the SPA, so we rewrite the meta tags in index.html before sending.
 *
 * Safety properties:
 *   - DB lookup is wrapped in try/catch AND a 300 ms timeout → never blocks HTML.
 *   - index.html is cached in memory, re-read when its mtime changes.
 *   - every injected value is HTML-attribute escaped.
 *   - entity not found → next() so the SPA fallback answers with 404.
 *   - lookup error/timeout → plain index.html with 200 (never a false 404).
 */

const fs = require("fs")
const path = require("path")

// Budget for the entity lookup. This has to cover a real round-trip to a
// remote MySQL host (Hostinger answers in ~450 ms from outside its network),
// otherwise every share link silently falls back to the generic OG card —
// which is exactly the bug this middleware exists to prevent. Crawlers wait
// seconds, so 2 s is safe; results are cached below so only the first hit per
// URL pays it. Override with OG_LOOKUP_TIMEOUT_MS.
const LOOKUP_TIMEOUT_MS = Number(process.env.OG_LOOKUP_TIMEOUT_MS) || 2000

// Small TTL cache: share/crawl traffic hammers the same handful of URLs.
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX = 200
const lookupCache = new Map() // "kind:slug:locale" → { at, value }

function cacheGet(key) {
  const hit = lookupCache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) { lookupCache.delete(key); return undefined }
  // refresh recency
  lookupCache.delete(key)
  lookupCache.set(key, hit)
  return hit.value
}

function cacheSet(key, value) {
  if (lookupCache.size >= CACHE_MAX) lookupCache.delete(lookupCache.keys().next().value)
  lookupCache.set(key, { at: Date.now(), value })
}
const SITE_NAME = "Mustapha Ukizuru"

/**
 * Append the brand once. Several services already return a metaTitle ending
 * in "· Mustapha Ukizuru", which used to produce
 * "Foo · Mustapha Ukizuru | Mustapha Ukizuru".
 */
function withBrand(rawTitle) {
  const title = String(rawTitle || "").trim()
  if (!title) return SITE_NAME
  const bare = title.replace(/\s*[·|–—-]\s*Mustapha Ukizuru\s*$/i, "").trim() || SITE_NAME
  if (bare.toLowerCase() === SITE_NAME.toLowerCase()) return SITE_NAME
  return `${truncate(bare, 90)} | ${SITE_NAME}`
}
const DEFAULT_OG_IMAGE = "/og/og-default.png"
// Pre-rendered per-entity cards (web `npm run og:build -- --from-json …`) land in public/og/<type>/<slug>.png
const DEFAULT_OG_DIR = path.resolve(__dirname, "..", "..", "public", "og")
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i

const ROUTE_RE = /^\/(?:es\/)?(store|blog|services|projects)\/([^/?#]+)\/?$/

/**
 * Fallback image for an entity without its own artwork:
 * /og/<kind>/<slug>.png when that file exists on disk, else /og/og-default.png.
 */
function fallbackOgImage(kind, slug, ogDir = DEFAULT_OG_DIR) {
  if (SAFE_SLUG_RE.test(slug) && !slug.includes("..")) {
    try {
      if (fs.existsSync(path.join(ogDir, kind, `${slug}.png`))) return `/og/${kind}/${slug}.png`
    } catch { /* fall through */ }
  }
  return DEFAULT_OG_IMAGE
}

/* ─── HTML helpers (pure, unit-tested) ─────────────────────────────────── */

function escapeAttr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function truncate(s, n) {
  const t = stripHtml(s)
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

function absoluteUrl(base, u) {
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return `${String(base).replace(/\/+$/, "")}/${String(u).replace(/^\/+/, "")}`
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Replace (or append into <head>) a <meta> tag identified by property= or
 * name=. Existing tags are matched regardless of attribute order / self-closing.
 */
function upsertMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${escapeAttr(key)}" content="${escapeAttr(content)}" />`
  const re = new RegExp(`<meta\\s+(?:[^>]*?\\s)?${attr}=["']${escapeRe(key)}["'][^>]*>`, "i")
  if (re.test(html)) return html.replace(re, tag)
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`)
}

/**
 * @param {string} html   base index.html
 * @param {{title:string, description:string, image?:string|null, url:string, type?:string}} meta
 */
function injectMeta(html, meta) {
  let out = html
  const title = meta.title
  const desc = meta.description
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(title)}</title>`)
  out = upsertMeta(out, "name", "description", desc)
  out = upsertMeta(out, "property", "og:type", meta.type || "article")
  out = upsertMeta(out, "property", "og:title", title)
  out = upsertMeta(out, "property", "og:description", desc)
  out = upsertMeta(out, "property", "og:url", meta.url)
  if (meta.image) out = upsertMeta(out, "property", "og:image", meta.image)
  out = upsertMeta(out, "name", "twitter:card", "summary_large_image")
  out = upsertMeta(out, "name", "twitter:title", title)
  out = upsertMeta(out, "name", "twitter:description", desc)
  if (meta.image) out = upsertMeta(out, "name", "twitter:image", meta.image)
  return out
}

/* ─── index.html cache (re-read on mtime change) ───────────────────────── */

const cache = { file: null, mtimeMs: 0, html: "" }

function readIndexHtml(indexPath) {
  const stat = fs.statSync(indexPath)
  if (cache.file !== indexPath || stat.mtimeMs !== cache.mtimeMs) {
    cache.file = indexPath
    cache.mtimeMs = stat.mtimeMs
    cache.html = fs.readFileSync(indexPath, "utf8")
  }
  return cache.html
}

/* ─── entity lookup ────────────────────────────────────────────────────── */

function firstOf(...vals) {
  return vals.find((v) => typeof v === "string" && v.trim().length > 0) || null
}

async function lookup(kind, slug, locale) {
  switch (kind) {
    case "store": {
      const { getProductBySlug } = require("../services/productService")
      const p = await getProductBySlug(slug, locale)
      if (!p) return null
      const first = Array.isArray(p.images) && p.images[0]
      return {
        title: firstOf(p.metaTitle, p.title, p.name),
        description: firstOf(p.metaDescription, p.shortDescription, p.description),
        image: firstOf(p.thumbnail, p.coverImage, p.imageUrl, p.image, first && (first.url || first)),
        type: "product",
      }
    }
    case "blog": {
      const { getPublicPostBySlug } = require("../services/blogService")
      const b = await getPublicPostBySlug(slug)
      if (!b) return null
      return {
        title: firstOf(b.metaTitle, b.title),
        description: firstOf(b.metaDescription, b.excerpt),
        image: firstOf(b.cover, b.coverImage),
        type: "article",
      }
    }
    case "services": {
      const { getServiceBySlug } = require("../services/serviceService")
      const s = await getServiceBySlug(slug, locale)
      if (!s) return null
      return {
        title: firstOf(s.metaTitle, s.title, s.name),
        description: firstOf(s.metaDescription, s.shortDescription, s.description),
        image: firstOf(s.heroImage, s.coverImage, s.image, s.thumbnail),
        type: "website",
      }
    }
    case "projects": {
      const { getPortfolioBySlug } = require("../services/portfolioService")
      const r = await getPortfolioBySlug(slug, locale)
      if (!r) return null
      return {
        title: firstOf(r.metaTitle, r.title),
        description: firstOf(r.metaDescription, r.shortDescription, r.description),
        image: firstOf(r.coverImage, r.thumbnail),
        type: "article",
      }
    }
    default:
      return null
  }
}

function withTimeout(promise, ms) {
  let t
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error("og lookup timeout")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t))
}

/* ─── middleware factory ───────────────────────────────────────────────── */

/**
 * @param {{ indexPath: string, siteUrl?: string, timeoutMs?: number, lookupFn?: Function, ogDir?: string }} opts
 */
function createOgInjector(opts) {
  const { indexPath } = opts
  const timeoutMs = opts.timeoutMs || LOOKUP_TIMEOUT_MS
  const lookupFn = opts.lookupFn || lookup

  return async function ogInjector(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next()
    const m = ROUTE_RE.exec(req.path)
    if (!m) return next()
    const [, kind, rawSlug] = m
    const locale = req.path.startsWith("/es/") ? "es" : "en"
    let slug
    try { slug = decodeURIComponent(rawSlug) } catch { return next() }

    let entity = null
    let failed = false
    const cacheKey = `${kind}:${slug}:${locale}`
    const cached = cacheGet(cacheKey)
    if (cached !== undefined) {
      entity = cached
    } else {
      try {
        entity = await withTimeout(Promise.resolve(lookupFn(kind, slug, locale)), timeoutMs)
        cacheSet(cacheKey, entity) // caches misses too — a bad slug shouldn't re-query
      } catch {
        failed = true // timeout / DB error: serve un-injected HTML, never a false 404
      }
    }
    // The lookup succeeded and the entity does not exist: /store/<dead-slug>
    // is a real 404, not a 200 with a "not found" screen. Serving the SPA
    // shell with a 404 status keeps the client-side not-found UI while
    // telling crawlers the truth (the audit's soft-404 finding).
    if (!failed && !entity) {
      try {
        const shell = readIndexHtml(indexPath)
        res.status(404)
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        res.setHeader("Content-Type", "text/html; charset=utf-8")
        return res.send(shell)
      } catch {
        return next() // no index.html — let the SPA fallback deal with it
      }
    }

    let html
    try {
      html = readIndexHtml(indexPath)
    } catch {
      return next()
    }

    if (entity) {
      const siteUrl = String(opts.siteUrl || process.env.PUBLIC_SITE_URL || process.env.CLIENT_URL || "").replace(/\/+$/, "")
      html = injectMeta(html, {
        title: withBrand(entity.title),
        description: truncate(entity.description || "", 200) || SITE_NAME,
        image: absoluteUrl(siteUrl, entity.image || fallbackOgImage(kind, slug, opts.ogDir)),
        url: `${siteUrl}${req.path}`,
        type: entity.type,
      })
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.status(200).send(html)
  }
}

module.exports = { createOgInjector, injectMeta, escapeAttr, upsertMeta, absoluteUrl, truncate, lookup, fallbackOgImage }
