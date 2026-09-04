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
  // 1, deliberately. On 2026-08-28 the host stopped being able to OPEN new
  // MySQL connections while an established one kept working: every endpoint
  // whose service runs `Promise.all` (blog, portfolio, services — two queries
  // at once, so a second connection) failed with P1001 after Prisma's 5s
  // connect timeout, while single-query routes and cached ones were fine.
  // The database itself was healthy throughout — five fresh connections from
  // outside averaged 350ms — so this is the host's path to MySQL, not ours.
  //
  // A pool of 1 serialises queries onto the connection the keepalive already
  // holds open, so the app stops depending on the host's ability to open more.
  // At this traffic level the cost is negligible (queries are small and
  // pool_timeout still bounds any queue at 10s). Raise DB_CONNECTION_LIMIT on
  // the host once Hostinger's connection path is healthy again.
  const limit = process.env.DB_CONNECTION_LIMIT || "1"
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

/**
 * T1-5 · `connection_limit=1` is a workaround for a host fault (2026-08-28),
 * not a design choice, and it is the ceiling on every Promise.all in the
 * API. A source comment cannot be seen from production, so say it in the
 * boot log of every start until the default changes, with the date it was
 * installed and the variable that lifts it.
 */
const POOL_WORKAROUND_INSTALLED = "2026-08-28"
function warnIfSerialised(url) {
  try {
    const limit = new URL(url).searchParams.get("connection_limit")
    if (limit !== "1") return null
    const line =
      `[prisma] connection_limit=1 — every query serialises onto one connection. ` +
      `Workaround installed ${POOL_WORKAROUND_INSTALLED} for the host's inability to OPEN connections. ` +
      `Raise DB_CONNECTION_LIMIT (3 is the next step) and watch /health/deep dbConcurrency.`
    console.warn(line)
    return line
  } catch { return null }
}

function createClient() {
  const url = withPoolBounds(process.env.DATABASE_URL)
  warnIfSerialised(url)
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
//
// The timeout is the load-bearing part. A dead socket does not always
// produce an error: if the peer vanished without an RST, the query sits
// there and the promise never settles. That happened in production on
// 2026-08-28 — every DB-backed route hung (routes that touch no DB still
// answered in 0.2s), and because this probe awaited the same never-settling
// query, the keepalive, the recycle and the exit guard all waited with it.
// A hang must therefore be reported as "not alive", not waited on.
const TIMED_OUT = Symbol("db-probe-timeout")
// 10s, not 5s. With the binary engine a probe can be waiting on a query
// engine CHILD PROCESS that is still starting; on a loaded shared host that
// legitimately takes longer than five seconds, and calling it "stuck" too
// early got a perfectly good process killed while it was still warming up.
const PROBE_TIMEOUT_MS = Number(process.env.DB_PROBE_TIMEOUT_MS || 10000)

let lastPanicMessage = ""   // last isAlive() failure text, read by exitIfUnrecoverable
let everHealthy = false     // has ANY query succeeded in this process?
let lastProbeTimedOut = false

/**
 * Resolve `"ok"`, reject with the query's error, or resolve TIMED_OUT —
 * never hang. Exported for tests: the timeout is the safety property.
 */
function probeWithTimeout(promise, timeoutMs) {
  let timer
  // The losing promise is deliberately left dangling; it carries a .catch
  // so a late rejection can never surface as an unhandled one.
  Promise.resolve(promise).catch(() => {})
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs)
    if (typeof timer.unref === "function") timer.unref()
  })
  return Promise.race([Promise.resolve(promise).then(() => "ok"), timeout])
    .finally(() => { if (timer) clearTimeout(timer) })
}

async function isAlive({ timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  try {
    const result = await probeWithTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs)
    if (result === TIMED_OUT) {
      lastProbeTimedOut = true
      lastPanicMessage = `database probe did not answer within ${timeoutMs}ms`
      return false
    }
    lastPanicMessage = ""
    lastProbeTimedOut = false
    everHealthy = true
    return true
  } catch (err) {
    lastProbeTimedOut = false
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
 *   3. a MUCH longer uptime when the engine never worked in this process.
 *      Both causes look identical from inside: a transient boot-time engine
 *      crash (a fresh process fixes it) and a genuinely broken build (a
 *      restart cannot). Waiting 5 minutes before exiting serves both: the
 *      transient case recovers on the next process, and a broken build
 *      restarts at most every 5 min — slow enough that Passenger keeps
 *      respawning and `/health` (commit + dbError) shows what is wrong,
 *      instead of the restart storm that took the API offline on 2026-08-28.
 */
const EXIT_MIN_UPTIME_WARM_S = 60    // engine worked here, then died
const EXIT_MIN_UPTIME_COLD_S = 300   // engine never worked in this process
let exiting = false
function exitIfUnrecoverable(reason, { stuck = false } = {}) {
  if (exiting) return
  if (process.env.NODE_ENV !== "production" || process.env.DB_PANIC_EXIT === "0") return
  const looksLikePanic = /timer has gone away|Query Engine has a panic|PrismaClientRustPanicError/i.test(String(reason || ""))
  // `stuck` = the probe stopped answering entirely. A fresh process is the
  // only thing that reliably clears a wedged socket, and it is exactly as
  // unrecoverable in-process as a panic.
  if (!looksLikePanic && !stuck) return
  if (process.uptime() < (everHealthy ? EXIT_MIN_UPTIME_WARM_S : EXIT_MIN_UPTIME_COLD_S)) return
  exiting = true
  console.error(`[prisma] query engine panicked and did not recover after recycle (everHealthy=${everHealthy}, uptime=${Math.round(process.uptime())}s) — exiting so Passenger starts a fresh process`)
  setTimeout(() => process.exit(1), 1500).unref()
}

let keepaliveTimer = null
let consecutiveFailures = 0
let engineRecycles = 0
const MAX_ENGINE_RECYCLES = 3
// ~6 pings with backoff ≈ 3 minutes of a completely unresponsive database
// before we trade the process in. Long enough to ride out a blip.
const STUCK_PINGS_BEFORE_EXIT = 6
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
      engineRecycles = 0
    } else {
      consecutiveFailures += 1
      const panicked = isEnginePanic({ message: lastPanicMessage })
      // A panic and a wedged engine are both "the engine is unusable". The
      // difference used to matter because the library engine lives inside
      // this process and a new client could not revive it. Under the binary
      // engine the engine is a CHILD PROCESS, so recycling genuinely spawns a
      // fresh one — that is a real repair, and far cheaper than trading the
      // whole app in. Try it for either failure, bounded, before the exit
      // guard is even consulted.
      if (panicked || lastProbeTimedOut) {
        if (engineRecycles < MAX_ENGINE_RECYCLES) {
          engineRecycles += 1
          console.warn(
            `[prisma] engine ${panicked ? "panicked" : "stopped answering"} — recycling (${engineRecycles}/${MAX_ENGINE_RECYCLES})`
          )
          await recycleOnce()
          if (await isAlive()) {
            console.warn("[prisma] engine recovered after recycle")
            return
          }
        } else if (!panicked && consecutiveFailures < STUCK_PINGS_BEFORE_EXIT) {
          // Out of recycles but not yet out of patience: keep pinging. The
          // database itself may simply be unreachable, and a restart cannot
          // fix that.
          return
        } else {
          console.error("[prisma] engine still unusable after recycle attempts")
          exitIfUnrecoverable(lastPanicMessage, { stuck: !panicked })
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
const INVOCATION_RE = /invocation:?$/i
const READ_MORE_RE = /^Read more/i
const URL_RE = /^https?:/i

/**
 * The first line of a Prisma error is always the useless preamble
 * "Invalid `prisma.x()` invocation:" — reporting that in /health said
 * nothing about why the database was unreachable. Skip the preamble and the
 * "Read more at" / issue-tracker tail so the field carries the actual cause
 * ("PANIC: timer has gone away", "Can't reach database server at ...").
 * Carries no credentials: Prisma never puts the password in these lines.
 */
function summariseDbError(message) {
  if (!message) return null
  const lines = String(message).split("\n").map((l) => l.trim()).filter(Boolean)
  const meaningful = lines.find(
    (l) => !INVOCATION_RE.test(l) && !READ_MORE_RE.test(l) && !URL_RE.test(l)
  )
  return (meaningful || lines[0] || "").slice(0, 160) || null
}

module.exports.probeWithTimeout = probeWithTimeout
module.exports.summariseDbError = summariseDbError
module.exports.TIMED_OUT = TIMED_OUT
module.exports.poolBoundsUrl = () => withPoolBounds(process.env.DATABASE_URL)
module.exports.warnIfSerialised = warnIfSerialised
module.exports.POOL_WORKAROUND_INSTALLED = POOL_WORKAROUND_INSTALLED

module.exports.engineInfo = () => ({
  everHealthy,
  stuck: lastProbeTimedOut,
  lastError: summariseDbError(lastPanicMessage),
})