const asyncHandler = require("../utils/asyncHandler")
const prisma       = require("../lib/prisma")
const logger       = require("../utils/logger")

let _packageVersion = "unknown"
try {
  _packageVersion = require("../../package.json").version || "unknown"
} catch { /* ignore */ }

/**
 * Short commit SHA of the running build, read once from .git without
 * spawning git. Hostinger deploys by cloning the repo, so this answers
 * "is the fix actually deployed?" from outside — the question that cost
 * hours during the 2026-08-27/28 outage.
 */
const _commit = (() => {
  try {
    const fs = require("fs")
    const path = require("path")
    const gitDir = path.join(__dirname, "../../.git")
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim()
    if (head.startsWith("ref: ")) {
      const ref = head.slice(5).trim()
      try {
        return fs.readFileSync(path.join(gitDir, ref), "utf8").trim().slice(0, 7)
      } catch {
        const packed = fs.readFileSync(path.join(gitDir, "packed-refs"), "utf8")
        const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`))
        return line ? line.slice(0, 7) : null
      }
    }
    return head.slice(0, 7)
  } catch {
    return null
  }
})()

/**
 * GET /api/health
 * Lightweight liveness probe. Used by uptime monitors that want a fast OK.
 * Returns 200 when DB is reachable, 503 otherwise.
 */
const getHealth = asyncHandler(async (req, res) => {
  let database = "ok"
  let dbError = null
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    database = "down"
    // Error CLASS only (never the message, which can carry the DSN): enough
    // to tell an engine panic from an init failure from an unreachable host.
    dbError = err?.errorCode || err?.code || err?.name || "unknown"
  }

  const status = database === "ok" ? "ok" : "degraded"
  const code   = database === "ok" ? 200 : 503

  res.status(code).json({
    status,
    uptime:    Math.round(process.uptime()),
    version:   _packageVersion,
    commit:    _commit,
    env:       process.env.NODE_ENV || "development",
    database,
    ...(dbError ? { dbError, engine: prisma.engineInfo?.() || null } : {}),
    timestamp: new Date().toISOString(),
  })
})

/**
 * GET /api/health/deep
 *
 * Probes every downstream dependency and reports per-check status.
 * Returns 200 only if every check passes; 503 if any fail.
 *
 * Checks (executed in parallel via Promise.allSettled so a slow/timed-out
 * dependency doesn't extend total response time beyond the slowest single
 * check):
 *
 *   db        — Prisma `SELECT 1`
 *   smtp      — nodemailer transporter.verify() (skipped if not configured)
 *   mercadopago — GET /v1/payment_methods (skipped if MP_ACCESS_TOKEN unset)
 *   paypal    — POST /v1/oauth2/token         (skipped if creds unset)
 *
 * Skipped checks report status "skipped" and do NOT cause 503. This means a
 * dev environment with no payment provider configured still returns 200.
 *
 * No auth — used by external monitors. Rate-limited by the global API
 * limiter (100 / 15 min / IP), which is plenty for any uptime service.
 */
const getDeepHealth = asyncHandler(async (req, res) => {
  const TIMEOUT_MS = 5000

  const [dbResult, smtpResult, mpResult, paypalResult] = await Promise.allSettled([
    timeboxed(checkDatabase(),    TIMEOUT_MS, "db"),
    timeboxed(checkSmtp(),        TIMEOUT_MS, "smtp"),
    timeboxed(checkMercadoPago(), TIMEOUT_MS, "mercadopago"),
    timeboxed(checkPaypal(),      TIMEOUT_MS, "paypal"),
  ])

  const checks = {
    database:    settledToStatus(dbResult),
    smtp:        settledToStatus(smtpResult),
    mercadopago: settledToStatus(mpResult),
    paypal:      settledToStatus(paypalResult),
  }

  // Per spec: 200 only if ALL checks pass. Skipped does NOT count as fail.
  const allOk = Object.values(checks).every((c) => c.status === "ok" || c.status === "skipped")

  // But if the database check fails, that ALWAYS becomes 503 — no gracious
  // degradation for the canonical dependency.
  const dbDown = checks.database.status === "down"

  const overall = (allOk && !dbDown) ? "ok" : "degraded"
  const code    = (allOk && !dbDown) ? 200 : 503

  if (!allOk || dbDown) {
    logger.warn("[health/deep] degraded", { checks })
  }

  res.status(code).json({
    status:    overall,
    uptime:    Math.round(process.uptime()),
    version:   _packageVersion,
    env:       process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    checks,
  })
})

/* ── Individual checks ─────────────────────────────────────────────────── */

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`
  return { ok: true }
}

async function checkSmtp() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { skipped: true, reason: "SMTP not configured" }
  }
  // Verify through the single shared transport (services/emailService).
  const { verifyTransport } = require("../services/emailService")
  return verifyTransport()
}

async function checkMercadoPago() {
  if (!process.env.MP_ACCESS_TOKEN) {
    return { skipped: true, reason: "MP_ACCESS_TOKEN not set" }
  }
  const axios = require("axios")
  // Lightweight authenticated GET — confirms token + reachability without
  // creating any side-effect on the MP account.
  await axios.get("https://api.mercadopago.com/v1/payment_methods", {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    timeout: 4000,
  })
  return { ok: true }
}

async function checkPaypal() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return { skipped: true, reason: "PayPal credentials not set" }
  }
  const axios = require("axios")
  const baseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com"
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64")
  // Token request is the cheapest possible "are you alive + are creds valid"
  // round-trip with PayPal.
  await axios.post(
    `${baseUrl}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 4000,
    }
  )
  return { ok: true }
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function timeboxed(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} check timed out after ${ms}ms`)), ms)
    ),
  ])
}

function settledToStatus(settled) {
  if (settled.status === "fulfilled") {
    if (settled.value?.skipped) {
      return { status: "skipped", reason: settled.value.reason }
    }
    return { status: "ok" }
  }
  return { status: "down", error: settled.reason?.message || "Unknown error" }
}

module.exports = {
  getHealth,
  getDeepHealth,
}
