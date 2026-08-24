#!/usr/bin/env node
/**
 * scripts/lighthouse-server.js — deterministic server for Lighthouse runs.
 *
 * WHY THIS EXISTS
 * Pointing Lighthouse at `src/server.js` boots the real API, which queries the
 * remote Hostinger database (~450 ms per call from outside their network).
 * Under Lighthouse's 4× CPU throttling some of those requests exceed its
 * patience and the whole run errors out with a performance score of 0 — we
 * measured `/contact` returning 0, 64, 0 across three runs. That makes the CI
 * job flaky AND means it was partly measuring network latency to Hostinger
 * rather than the frontend.
 *
 * This server serves the SAME built bundle from public/ with the SAME SPA
 * fallback semantics, but answers every /api/* call locally from a fixture.
 * What Lighthouse then measures is exactly what it should: the cost of the
 * frontend shell. API behaviour is covered by the Jest + supertest suites.
 *
 *   PORT=5097 node scripts/lighthouse-server.js
 *
 * Fixtures are intentionally small and shaped like the real payloads (the
 * `{ success, data }` envelope lib/api.js expects) so pages render their
 * populated state rather than an empty one.
 */
const express = require("express")
const compression = require("compression")
const path = require("path")
const fs = require("fs")

const app = express()
const PORT = Number(process.env.PORT) || 5097
const frontendPath = path.join(__dirname, "..", "public")

app.use(compression())

/* ── API fixtures ──────────────────────────────────────────────────────────
 * Keyed by the path AFTER the /api/v1 (or /api) prefix. Longest match wins so
 * "/products/slug" can differ from "/products".
 */
const ok = (data) => ({ success: true, data })

const FIXTURES = {
  "/health": { status: "ok", database: "ok" },

  "/products": ok({
    products: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i + 1}`,
      slug: `sample-product-${i + 1}`,
      title: `Sample Product ${i + 1}`,
      shortDescription: "A representative digital product used only for performance measurement.",
      price: 49 + i * 10,
      currency: "MXN",
      isActive: true,
      isFeatured: i < 2,
      rating: 4.8,
      reviewCount: 12,
      images: [],
      files: [],
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
      id: `pf${i + 1}`,
      slug: `sample-project-${i + 1}`,
      title: `Sample Project ${i + 1}`,
      shortDescription: "Representative case study used only for performance measurement.",
      results: [],
      tools: ["React", "Node.js"],
      status: "published",
    })),
    total: 3,
  }),

  "/blog": ok({
    posts: Array.from({ length: 6 }, (_, i) => ({
      id: `b${i + 1}`,
      slug: `sample-post-${i + 1}`,
      title: `Sample Post ${i + 1}`,
      excerpt: "A representative article summary used only for performance measurement.",
      publishedAt: "2026-01-0" + (i + 1) + "T00:00:00.000Z",
      readMinutes: 5,
      tags: [],
      body: [],
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
    if ((bare === key || bare.startsWith(key + "/")) && (!best || key.length > best.length)) best = key
  }
  return best ? FIXTURES[best] : ok(null)
}

app.all(/^\/api\/.*/, (req, res) => {
  // Never let a fixture miss stall the page — always answer immediately.
  res.set("Cache-Control", "no-store")
  res.json(fixtureFor(req.path))
})

/* ── Static bundle + SPA fallback (mirrors src/app.js) ─────────────────── */
// Mirror src/app.js exactly: /assets and /fonts are content-hashed and mounted
// separately as immutable, everything else gets the 7-day default. Matching
// production matters here — Lighthouse scores cache policy, so a mismatch
// would make these measurements not reflect the real site.
const YEAR_MS = 31557600000
app.use("/assets", express.static(path.join(frontendPath, "assets"), { maxAge: YEAR_MS, immutable: true }))
app.use("/fonts", express.static(path.join(frontendPath, "fonts"), { maxAge: YEAR_MS, immutable: true }))
app.use(express.static(frontendPath, {
  index: false,
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    }
  },
}))

let spaRoutes = null
try { spaRoutes = require("../src/utils/spaRoutes") } catch { /* optional */ }

app.get(/^\/(?!api).*/, (req, res) => {
  const indexPath = path.join(frontendPath, "index.html")
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send("public/index.html is missing — run `cd web && npm run build` first.")
  }
  const known = !spaRoutes || spaRoutes.matchesSpaRoute(req.path)
  res.status(known ? 200 : 404)
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
  res.sendFile(indexPath)
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT} (lighthouse fixture mode — no database)`)
})
