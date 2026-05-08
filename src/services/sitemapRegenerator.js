// @ts-check
const { spawn } = require("child_process")
const path = require("path")

/**
 * sitemapRegenerator.js · SEO03 · admin-driven non-blocking sitemap rebuild
 *
 * Called by admin controllers after publishing a Product/Service/Portfolio
 * item. Fires a detached `node ./web/scripts/generate-sitemap.mjs` process
 * and returns immediately — the HTTP response is never blocked.
 *
 * Gated by `SITEMAP_AUTO_REGEN=true` so dev environments don't churn the
 * sitemap on every save. Production should set it via .env. Failures are
 * logged and never propagated.
 *
 * Coalescing: a single in-flight regeneration is kept; subsequent calls
 * within the cooldown window (default 60 s) become no-ops, then the next
 * call after the window triggers a fresh run. This protects against bulk
 * publish bursts triggering N concurrent rebuilds.
 */

const COOLDOWN_MS = Number(process.env.SITEMAP_COOLDOWN_MS || 60 * 1000)
let lastRunAt = 0
let inFlight = false

function enabled() {
  return process.env.SITEMAP_AUTO_REGEN === "true"
}

function enqueueSitemapRegen({ reason = "admin.publish" } = {}) {
  if (!enabled()) return { enqueued: false, reason: "disabled" }
  if (inFlight) return { enqueued: false, reason: "in-flight" }

  const now = Date.now()
  if (now - lastRunAt < COOLDOWN_MS) {
    return { enqueued: false, reason: "cooldown", nextEligibleAt: lastRunAt + COOLDOWN_MS }
  }

  inFlight = true
  lastRunAt = now

  // Resolve repo root from src/services/ → ../..
  const repoRoot = path.resolve(__dirname, "../..")
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["--prefix", "web", "run", "seo:sitemap"],
    {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, SITEMAP_REASON: reason },
    },
  )
  child.on("error", (err) => {
    inFlight = false
    console.warn(`[sitemap] spawn failed (${reason}):`, err.message)
  })
  child.on("exit", (code) => {
    inFlight = false
    if (code !== 0) console.warn(`[sitemap] regen exited ${code} (${reason})`)
  })
  child.unref()

  return { enqueued: true, reason }
}

module.exports = { enqueueSitemapRegen }
