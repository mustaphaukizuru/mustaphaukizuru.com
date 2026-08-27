const { PrismaClient } = require("@prisma/client")

let prisma

/**
 * Bound the connection pool for shared MySQL.
 *
 * Prisma's default pool is (num_cpus * 2 + 1) connections PER CLIENT. That is
 * a sensible default on a dedicated box and a bad one on Hostinger shared
 * hosting, where the account has a hard `max_user_connections` quota and a
 * deploy can leave more than one app instance briefly alive at once. Several
 * instances x a double-digit pool each exhausts the quota, and the symptom is
 * not a refusal — new queries simply queue until they time out, so every API
 * route hangs while static files keep serving. That is precisely the outage
 * signature this project has hit.
 *
 * `pool_timeout` matters as much as the size: without it a starved request
 * waits indefinitely. Ten seconds turns an invisible hang into a fast, logged
 * error that says what is wrong.
 *
 * Both are appended only when the URL does not already set them, so a value
 * tuned in .env always wins.
 */
function withPoolBounds(rawUrl) {
  if (!rawUrl) return rawUrl
  const limit = process.env.DB_CONNECTION_LIMIT || "5"
  const timeout = process.env.DB_POOL_TIMEOUT || "10"
  try {
    const url = new URL(rawUrl)
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", limit)
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", timeout)
    return url.toString()
  } catch {
    // Passwords with URL-hostile characters make new URL() throw. Fall back to
    // string append rather than dropping the bounds silently — an unbounded
    // pool is the thing being prevented.
    if (/[?&]connection_limit=/.test(rawUrl)) return rawUrl
    const sep = rawUrl.includes("?") ? "&" : "?"
    return `${rawUrl}${sep}connection_limit=${limit}&pool_timeout=${timeout}`
  }
}

function createClient() {
  const url = withPoolBounds(process.env.DATABASE_URL)
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    errorFormat: "pretty",
    ...(url ? { datasources: { db: { url } } } : {}),
  })
  // Every write to a catalogue model clears the matching read cache
  // (lib/ttlCache.js) — one hook here rather than a call in each of the
  // admin services' 21 write functions. See lib/cacheInvalidation.js.
  // Returns the plain client when $extends is unavailable (stubbed clients
  // in tests), so this can never stop the app from booting.
  const { extendWithInvalidation } = require("./cacheInvalidation")
  return extendWithInvalidation(client)
}

if (process.env.NODE_ENV === "production") {
  prisma = createClient()
} else {
  if (!global.__prisma) {
    global.__prisma = createClient()
  }
  prisma = global.__prisma
}

// Non-blocking connect with retries
;(async () => {
  for (let i = 1; i <= 5; i++) {
    try {
      await prisma.$connect()
      console.log("Database connected")
      return
    } catch (e) {
      console.error(`DB attempt ${i}/5: ${e.message}`)
      if (i < 5) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }
  console.warn("DB unavailable — server running, DB operations will retry")
})()

/* ─────────────────────────── connection-health helpers ─────────────────
 * Why this exists:
 *   Hostinger shared MySQL kills idle TCP connections after ~60s
 *   (wait_timeout). Prisma's connection pool doesn't always notice the
 *   socket was closed by the server, so on the NEXT query (often from a
 *   cron firing every 5 minutes — way past wait_timeout) the Rust query
 *   engine grabs a dead socket and panics:
 *     "PANIC: timer has gone away"
 *   This is the tokio runtime crashing because its internal timer task
 *   was dropped during teardown, not a logic bug.
 *
 *   Standard mitigation in serverful Prisma + shared-MySQL deployments
 *   is to PROBE the connection (cheap SELECT 1) before any cold-cache
 *   query, and RECYCLE the engine if the probe fails. That's what these
 *   two helpers do.
 *
 * Usage:
 *   const prisma = require("../lib/prisma")
 *   const { isAlive, recycle } = require("../lib/prisma")
 *
 *   if (!(await isAlive())) {
 *     await recycle()
 *     if (!(await isAlive())) return  // give up this pass; cron retries
 *   }
 *   await prisma.consultation.findMany(...)
 *
 * Cost:
 *   `SELECT 1` is a single packet — typically < 5ms on a warm pool, and
 *   fails fast (< 100ms) on a dead one. The cost is negligible compared
 *   to the cost of letting the engine panic.
 * ──────────────────────────────────────────────────────────────────── */

// Cheap connection probe. Returns true on a healthy socket, false if the
// engine can't talk to MySQL right now (closed socket, network blip,
// MySQL paused for maintenance, etc.). NEVER throws — catches every
// possible error class so the caller can branch on a clean boolean.
async function isAlive() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (err) {
    // We deliberately don't log here — callers (mostly crons) decide
    // whether a failed ping is worth surfacing. A noisy ping log would
    // drown the actual error in any 5-minute cron loop.
    return false
  }
}

// Force a fresh engine + connection. Safe to call after a panic — even
// if $disconnect() throws (because the engine is already dead), we still
// try $connect() to bring a new one online. NEVER throws; if reconnect
// fails the next isAlive() will return false and the caller can decide.
async function recycle() {
  try { await prisma.$disconnect() } catch { /* engine may already be dead */ }
  try { await prisma.$connect()    } catch { /* will retry on next call */ }
}

/* ─────────────────────────── self-healing (HTTP path) ───────────────────
 * The isAlive/recycle helpers above are only called by cron jobs. On the
 * HTTP path a panicked engine used to stay dead until someone touched
 * tmp/restart.txt — every request (login, Google OAuth callback, …) failed
 * with "PANIC: timer has gone away" while /health reported database=down.
 *
 * Two layers fix that:
 *   1. keepalive  — a cheap SELECT 1 every KEEPALIVE_MS (< MySQL wait_timeout
 *                   ≈ 60s) so pooled sockets never sit idle long enough for
 *                   the server to drop them; if the ping fails the engine is
 *                   recycled immediately, before a real request hits it.
 *   2. recoverIfPanicked(err) — called from the global error handler: when a
 *                   request still trips a PrismaClientRustPanicError, recycle
 *                   the engine (debounced) so the *next* request succeeds.
 * ──────────────────────────────────────────────────────────────────── */

const KEEPALIVE_MS = Number(process.env.DB_KEEPALIVE_MS || 30_000)

let recycling = null
function recycleOnce() {
  if (!recycling) {
    recycling = recycle().finally(() => { recycling = null })
  }
  return recycling
}

function isEnginePanic(err) {
  return err?.name === "PrismaClientRustPanicError"
      || /timer has gone away|Query Engine has a panic/i.test(err?.message || "")
}

// Returns true when a recycle was triggered for this error. Never throws.
function recoverIfPanicked(err) {
  if (!isEnginePanic(err)) return false
  console.error("[prisma] query engine panicked — recycling connection:", String(err?.message || "").split("\n").find(Boolean))
  recycleOnce()
  return true
}

let keepaliveTimer = null
function startKeepalive() {
  if (keepaliveTimer || process.env.NODE_ENV === "test" || process.env.DISABLE_DB_KEEPALIVE === "1") return
  keepaliveTimer = setInterval(async () => {
    if (await isAlive()) return
    console.warn("[prisma] keepalive ping failed — recycling engine")
    await recycleOnce()
    if (!(await isAlive())) console.error("[prisma] engine still unreachable after recycle")
  }, KEEPALIVE_MS)
  // Never keep the process alive just for the ping (one-shot scripts, tests).
  if (typeof keepaliveTimer.unref === "function") keepaliveTimer.unref()
}
startKeepalive()

module.exports = prisma
module.exports.isAlive = isAlive
module.exports.recycle = recycle
module.exports.recoverIfPanicked = recoverIfPanicked
module.exports.isEnginePanic = isEnginePanic
// Exported for tests: the pool bounds are a safety property, not an
// implementation detail, so they get pinned like one.
module.exports.withPoolBounds = withPoolBounds