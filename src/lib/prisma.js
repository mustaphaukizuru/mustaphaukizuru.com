const { PrismaClient } = require("@prisma/client")


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
  // 10 (was 5): the admin console fans out 5-8 queries per page and the pool
  // timed out (P2024 → "Database operation failed"). max_user_connections is 75.
  const limit = process.env.DB_CONNECTION_LIMIT || "10"
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

/*
 * The exported object is a Proxy over a *replaceable* client. Recycling a
 * panicked engine by $disconnect()/$connect() on the same instance does not
 * work with the library engine — once its tokio runtime is torn down every
 * later query fails with "PANIC: timer has gone away" until the process is
 * restarted (prod incident 2026-08-27). So recycle() builds a brand-new
 * PrismaClient and swaps it in; every module that did `require("../lib/prisma")`
 * keeps working because they hold the Proxy, not the instance.
 */
let current
if (process.env.NODE_ENV === "production") {
  current = createClient()
} else {
  if (!global.__prisma) {
    global.__prisma = createClient()
  }
  current = global.__prisma
}

// The proxy TARGET holds the module's own helpers (isAlive, recycle, …)
// assigned via `module.exports.x = …` below. They must live on the target,
// not on the client instance: a previous version wrote them onto `current`,
// so the first recycle() (which swaps `current` for a fresh client) silently
// dropped every helper — errorHandler/scheduler then saw `undefined` and the
// panic handling stopped working exactly when it was needed.
const helpers = {}
const prisma = new Proxy(helpers, {
  get(t, prop) {
    if (prop in t) return t[prop]
    const v = current[prop]
    return typeof v === "function" ? v.bind(current) : v
  },
  set(t, prop, value) { t[prop] = value; return true },
  has(t, prop) { return prop in t || prop in current },
})

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
let lastPanicMessage = ""   // last isAlive() failure text, read by exitIfUnrecoverable
let everHealthy = false     // has ANY query succeeded in this process?
async function isAlive() {
  try {
    await prisma.$queryRaw`SELECT 1`
    lastPanicMessage = ""
    everHealthy = true
    return true
  } catch (err) {
    lastPanicMessage = String(err?.message || "")
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
  // Must NEVER throw or reject: it runs from a setInterval and from the
  // error handler, where an escaped rejection would take the whole process
  // down (server.js treats unhandled rejections as fatal) and put Passenger
  // into a restart loop.
  const old = current
  let fresh
  try {
    fresh = createClient()
  } catch (err) {
    console.error("[prisma] recycle: could not construct a new client:", err?.message)
    return
  }
  try { await fresh.$connect() } catch { /* will retry on next call */ }
  current = fresh
  if (process.env.NODE_ENV !== "production") global.__prisma = fresh
  // Best-effort teardown of the dead engine; it may already have panicked.
  try { Promise.resolve(old.$disconnect()).catch(() => {}) } catch { /* ignore */ }
}

/* ─────────────────────────── self-healing (HTTP path) ───────────────────
 * The isAlive/recycle helpers above are only called by cron jobs. On the
 * HTTP path a panicked engine used to stay dead until someone touched
 * tmp/restart.txt — every request (login, Google OAuth callback, …) failed
 * with "PANIC: timer has gone away" while /health reported database=down.
 *
 * Two layers fix that:
 *   1. keepalive  — a cheap SELECT 1 every KEEPALIVE_MS (< MySQL wait_timeout,
 *                   20s on Hostinger) so pooled sockets never sit idle long enough for
 *                   the server to drop them; if the ping fails the engine is
 *                   recycled immediately, before a real request hits it.
 *   2. recoverIfPanicked(err) — called from the global error handler: when a
 *                   request still trips a PrismaClientRustPanicError, recycle
 *                   the engine (debounced) so the *next* request succeeds.
 * ──────────────────────────────────────────────────────────────────── */

// Hostinger MariaDB reports wait_timeout=20s, so the ping must be well under
// that or pooled sockets die between pings (which is what caused the panic).
const KEEPALIVE_MS = Number(process.env.DB_KEEPALIVE_MS || 10_000)

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

/*
 * Last resort. "PANIC: timer has gone away" is a crash of the tokio runtime
 * inside the native query-engine library. That library is loaded once per
 * process, so constructing a fresh PrismaClient in the same process does
 * NOT bring it back — every query keeps failing until the process itself
 * restarts. On Passenger a clean exit is exactly what triggers a fresh
 * process, so after a failed recycle we exit(1) (graceful: logs flush,
 * inflight requests get a moment).
 *
 * THREE guards, all required, because a wrong exit here is worse than the
 * bug it fixes — it turns a degraded API into a crash loop and Passenger
 * eventually stops respawning, taking the whole API offline:
 *   1. the failure must look like an engine panic (not "can't reach DB"),
 *   2. the process must have been up > 60s,
 *   3. the engine must have worked at least once in THIS process. A build
 *      whose engine never initialises (wrong binaryTarget, failed
 *      `prisma generate`) is not fixable by restarting — staying up and
 *      serving 503s is strictly better than looping.
 */
let exiting = false
function exitIfUnrecoverable(reason) {
  if (exiting) return
  if (process.env.NODE_ENV !== "production" || process.env.DB_PANIC_EXIT === "0") return
  if (!/timer has gone away|Query Engine has a panic|PrismaClientRustPanicError/i.test(String(reason || ""))) return
  if (process.uptime() < 60) return   // never tight-loop a process that just booted
  if (!everHealthy) return            // never worked here — a restart cannot fix it
  exiting = true
  console.error("[prisma] query engine panicked and did not recover after recycle — exiting so Passenger starts a fresh process")
  setTimeout(() => process.exit(1), 1500).unref()
}

let keepaliveTimer = null
let consecutiveFailures = 0
const MAX_KEEPALIVE_MS = 60_000

/**
 * Self-scheduling ping. Two rules learned from the 2026-08-28 outage, when
 * MySQL was unreachable from the host for hours:
 *
 *   1. Only an engine PANIC is fixed by recycling. A fresh PrismaClient
 *      cannot reach a server that is unreachable, so recycling on a
 *      connectivity error (P1001) just built ~2000 clients over six hours —
 *      churning sockets and memory while making no difference.
 *   2. Back off while down (10s → 60s) so a long outage is quiet in the
 *      logs and cheap on the host; reset to the fast interval on recovery,
 *      which is what keeps sockets under MySQL's 20s wait_timeout.
 */
async function keepaliveTick() {
  try {
    if (await isAlive()) {
      if (consecutiveFailures > 0) console.warn(`[prisma] database reachable again after ${consecutiveFailures} failed pings`)
      consecutiveFailures = 0
    } else {
      consecutiveFailures += 1
      if (isEnginePanic({ message: lastPanicMessage })) {
        console.warn("[prisma] keepalive ping failed with an engine panic — recycling")
        await recycleOnce()
        if (!(await isAlive())) {
          console.error("[prisma] engine still unreachable after recycle")
          exitIfUnrecoverable(lastPanicMessage)
        }
      } else if (consecutiveFailures === 1 || consecutiveFailures % 30 === 0) {
        // Connectivity, not a panic: log on the first failure and then only
        // every 30th ping so an hours-long outage stays readable.
        console.warn(`[prisma] database unreachable (ping ${consecutiveFailures}):`, String(lastPanicMessage || "").slice(0, 120))
      }
    }
  } catch (err) {
    console.error("[prisma] keepalive error (ignored):", err?.message)
  } finally {
    const delay = consecutiveFailures === 0
      ? KEEPALIVE_MS
      : Math.min(KEEPALIVE_MS * Math.min(consecutiveFailures, 6), MAX_KEEPALIVE_MS)
    scheduleKeepalive(delay)
  }
}

function scheduleKeepalive(delay) {
  keepaliveTimer = setTimeout(keepaliveTick, delay)
  // Never keep the process alive just for the ping (one-shot scripts, tests).
  if (typeof keepaliveTimer.unref === "function") keepaliveTimer.unref()
}

function startKeepalive() {
  if (keepaliveTimer || process.env.NODE_ENV === "test" || process.env.DISABLE_DB_KEEPALIVE === "1") return
  scheduleKeepalive(KEEPALIVE_MS)
}
startKeepalive()

module.exports = prisma
module.exports.isAlive = isAlive
module.exports.recycle = recycle
module.exports.recoverIfPanicked = recoverIfPanicked
module.exports.isEnginePanic = isEnginePanic
module.exports.exitIfUnrecoverable = exitIfUnrecoverable
// Exported for tests: the pool bounds are a safety property, not an
// implementation detail, so they get pinned like one.
module.exports.withPoolBounds = withPoolBounds
// Diagnostics for /health — never throws, safe to read at any time.
module.exports.engineInfo = () => ({
  everHealthy,
  lastError: lastPanicMessage ? String(lastPanicMessage).split("\n").find(Boolean)?.slice(0, 160) || null : null,
})