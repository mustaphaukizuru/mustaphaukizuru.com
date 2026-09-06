#!/usr/bin/env node
/**
 * scripts/lighthouse-server.js — deterministic server for Lighthouse runs.
 *
 * WHY THIS EXISTS
 * Pointing Lighthouse at `src/server.js` boots the real API, which queries the
 * remote Hostinger database (~450 ms per call from outside their network).
 * Under Lighthouse's 4x CPU throttling some of those requests exceed its
 * patience and the whole run errors out with a performance score of 0 — we
 * measured /contact returning 0, 64, 0 across three runs. That made the CI job
 * flaky AND meant it was partly measuring network latency to Hostinger rather
 * than the frontend.
 *
 * This serves the SAME built bundle from public/ with the same SPA fallback
 * and 404 semantics, answering every /api/* call locally from a fixture. What
 * Lighthouse then measures is the cost of the frontend. API behaviour is
 * covered by the Jest + supertest suites.
 *
 * ZERO DEPENDENCIES ON PURPOSE. The CI Lighthouse job downloads the build
 * artifact and never runs `npm ci`, so anything requiring express here would
 * fail to boot. Node built-ins only: http, fs, path, zlib.
 *
 *   PORT=5097 node scripts/lighthouse-server.js
 */
const http = require("http")
const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const PORT = Number(process.env.PORT) || 5097
const ROOT = path.join(__dirname, "..", "public")

/* ── API fixtures ────────────────────────────────────────────────────────── */
const ok = (data) => ({ success: true, data })

const FIXTURES = {
  "/health": { status: "ok", database: "ok" },
  "/products": ok({
    products: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i + 1}`, slug: `sample-product-${i + 1}`, title: `Sample Product ${i + 1}`,
      shortDescription: "A representative digital product used only for performance measurement.",
      price: 49 + i * 10, currency: "MXN", isActive: true, isFeatured: i < 2,
      rating: 4.8, reviewCount: 12, images: [], files: [],
    })),
    pagination: { page: 1, limit: 12, total: 6 },
  }),
  "/services": ok([
    { id: "s1", slug: "it-strategy-consulting", title: "IT Strategy Consulting", shortDescription: "Audits, fractional CTO, roadmaps.", status: "published", features: [], packages: [] },
    { id: "s2", slug: "ai-automation", title: "AI Integration & Workflow Automation", shortDescription: "Bots, RAG, pipelines.", status: "published", features: [], packages: [] },
    { id: "s3", slug: "cloud-architecture-migration", title: "Cloud Architecture & Migration", shortDescription: "AWS/Azure/GCP, Docker, zero trust.", status: "published", features: [], packages: [] },
    { id: "s4", slug: "digital-product-engineering", title: "Digital Product Engineering", shortDescription: "UI/UX, MVPs, APIs, CI/CD.", status: "published", features: [], packages: [] },
  ]),
  "/portfolio": ok({
    projects: Array.from({ length: 3 }, (_, i) => ({
      id: `pf${i + 1}`, slug: `sample-project-${i + 1}`, title: `Sample Project ${i + 1}`,
      shortDescription: "Representative case study used only for performance measurement.",
      results: [], tools: ["React", "Node.js"], status: "published",
    })),
    total: 3,
  }),
  "/blog": ok({
    posts: Array.from({ length: 6 }, (_, i) => ({
      id: `b${i + 1}`, slug: `sample-post-${i + 1}`, title: `Sample Post ${i + 1}`,
      excerpt: "A representative article summary used only for performance measurement.",
      publishedAt: `2026-01-0${i + 1}T00:00:00.000Z`, readMinutes: 5, tags: [], body: [],
    })),
    pagination: { page: 1, limit: 9, total: 6 },
  }),
  "/bio": ok({ experience: [], education: [], certificates: [], skills: [] }),
  "/reviews": ok({ reviews: [], total: 0 }),
  "/availability": ok({ slots: [], days: [] }),
}

function fixtureFor(pathname) {
  const bare = pathname.replace(/^\/api(\/v1)?/, "") || "/"
  let best = null
  for (const key of Object.keys(FIXTURES)) {
    if ((bare === key || bare.startsWith(`${key}/`)) && (!best || key.length > best.length)) best = key
  }
  return best ? FIXTURES[best] : ok(null)
}

/* ── static serving ──────────────────────────────────────────────────────── */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".pdf": "application/pdf", ".map": "application/json",
}
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest|xml)|image\/svg)/

// Mirrors src/app.js: hashed assets and pinned fonts are immutable for a year,
// index.html is never cached, everything else gets a week. Lighthouse scores
// cache policy, so a mismatch here would make the measurement unrepresentative.
function cacheControlFor(urlPath) {
  if (urlPath.startsWith("/assets/") || urlPath.startsWith("/fonts/")) {
    return "public, max-age=31536000, immutable"
  }
  if (urlPath.endsWith(".html")) return "no-cache, no-store, must-revalidate"
  return "public, max-age=604800"
}

// gzipSync blocks the event loop, and the bundle is requested dozens of times
// per run. Compressing on every request measurably slowed responses — /terms
// scored 68 against 77-78 with a streaming compressor. The files never change
// while the server is up, so each body is compressed at most once.
const fileCache = new Map()
function readFileOnce(p) {
  let hit = fileCache.get(p)
  if (!hit) { hit = fs.readFileSync(p); fileCache.set(p, hit) }
  return hit
}

const gzipCache = new Map()
function gzipOnce(key, body) {
  let hit = gzipCache.get(key)
  if (!hit) { hit = zlib.gzipSync(body, { level: 6 }); gzipCache.set(key, hit) }
  return hit
}

function send(req, res, status, body, type, cacheControl, cacheKey) {
  const headers = { "Content-Type": type, "Cache-Control": cacheControl }
  const accepts = String(req.headers["accept-encoding"] || "")
  if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(accepts) && body.length > 1024) {
    const gz = cacheKey ? gzipOnce(cacheKey, body) : zlib.gzipSync(body, { level: 6 })
    res.writeHead(status, { ...headers, "Content-Encoding": "gzip", "Content-Length": gz.length })
    return res.end(req.method === "HEAD" ? undefined : gz)
  }
  res.writeHead(status, { ...headers, "Content-Length": body.length })
  return res.end(req.method === "HEAD" ? undefined : body)
}

let spaRoutes = null
try { spaRoutes = require("../src/utils/spaRoutes") } catch { /* optional */ }

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0])

  if (urlPath.startsWith("/api/")) {
    const body = Buffer.from(JSON.stringify(fixtureFor(urlPath)))
    return send(req, res, 200, body, "application/json; charset=utf-8", "no-store")
  }

  // Never escape public/.
  const resolved = path.resolve(ROOT, `.${urlPath}`)
  if (resolved.startsWith(ROOT) && urlPath !== "/") {
    try {
      const stat = fs.statSync(resolved)
      if (stat.isFile()) {
        const ext = path.extname(resolved).toLowerCase()
        return send(req, res, 200, readFileOnce(resolved),
          MIME[ext] || "application/octet-stream", cacheControlFor(urlPath), resolved)
      }
    } catch { /* fall through to the SPA shell */ }
  }

  const indexPath = path.join(ROOT, "index.html")
  if (!fs.existsSync(indexPath)) {
    return send(req, res, 500, Buffer.from("public/index.html is missing — run `cd web && npm run build`."),
      "text/plain; charset=utf-8", "no-store")
  }
  const known = !spaRoutes || spaRoutes.matchesSpaRoute(urlPath)
  return send(req, res, known ? 200 : 404, readFileOnce(indexPath),
    "text/html; charset=utf-8", "no-cache, no-store, must-revalidate", indexPath)
})

server.listen(PORT, () => {
   
  console.log(`Server running on port ${PORT} (lighthouse fixture mode — no database, no deps)`)
})
