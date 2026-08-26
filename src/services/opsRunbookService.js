/**
 * opsRunbookService.js — Tier 4 ops runbook read model.
 *
 * One admin-only snapshot of "is this deploy healthy and what is the
 * operator still on the hook for", built from what already exists:
 *
 *   - storage: every STORAGE_PATHS key — exists, writable, and a warning when
 *     the directory sits inside hbuilds/versions/<uuid>/ (a deploy replaces
 *     that tree wholesale; see src/config/storagePaths.js for the two
 *     outages that taught us this)
 *   - backup: newest file in STORAGE_PATHS.backups (name, size, age) —
 *     `<db>-<stamp>.json` from backupService, but any dump counts
 *   - prisma: declared vs installed @prisma/client / prisma versions
 *   - db: liveness via isAlive() (never throws)
 *   - runtime: node version, uptime, DISABLE_CRON
 *   - pendingSteps: operator env keys still unset, each with the explanation
 *     line that sits directly above the key in .env.example
 *   - recovery: the commands from scripts/hostinger-recover.sh and CLAUDE.md
 *
 * Nothing here writes. Storage writability is probed with fs.accessSync
 * (W_OK) — no temp files are created.
 */

const fs = require("fs")
const path = require("path")
const { STORAGE_PATHS, findHbuildsDir } = require("../config/storagePaths")
const { isAlive } = require("../lib/prisma")

const ROOT = path.resolve(__dirname, "..", "..")
const ENV_EXAMPLE = path.join(ROOT, ".env.example")
const BACKUP_STALE_HOURS = 36 // nightly job + slack

/** Keys the operator must set by hand; unset = pending step. */
const OPERATOR_ENV_KEYS = Object.freeze([
  "INVOICE_RFC",
  "TAX_RATE",
  "MP_WEBHOOK_SECRET",
  "SENTRY_DSN",
  "PREVIEW_FRAME_HOSTS",
])

/** Used only when .env.example is missing or the key has no comment above it. */
const FALLBACK_NOTES = Object.freeze({
  INVOICE_RFC:         "Mexican tax id (RFC) printed on invoices — invoices are legally incomplete without it.",
  TAX_RATE:            "VAT rate applied at checkout, as a decimal (0.16 = 16% IVA). Unset = tax is not itemised.",
  MP_WEBHOOK_SECRET:   "Required to verify Mercado Pago webhook signatures — must NOT be empty in production.",
  SENTRY_DSN:          "Empty value = Sentry is fully disabled (no error tracking).",
  PREVIEW_FRAME_HOSTS: "Comma-separated hosts allowed inside the client-project preview iframe. Unset = preview links open in a new tab only.",
})

const RECOVERY = Object.freeze({
  backupThenPush: [
    "node scripts/backup-db-json.js",
    "ALLOW_PROD_DB=1 npm run db:push",
  ],
  restart: ["mkdir -p tmp && touch tmp/restart.txt"],
  status: ["bash scripts/hostinger-recover.sh status"],
  log: ["bash scripts/hostinger-recover.sh log"],
  recover: ["bash scripts/hostinger-recover.sh recover"],
  reinstall: ["bash scripts/hostinger-recover.sh reinstall"],
})

/**
 * Map of KEY -> explanatory text: the contiguous `#` comment lines directly
 * above `KEY=` in .env.example. A placeholder like `<SET_ME>` is ignored.
 */
function envExampleNotes(file = ENV_EXAMPLE) {
  let text
  try { text = fs.readFileSync(file, "utf8") } catch { return {} }
  const notes = {}
  let pending = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith("#")) { pending.push(line.replace(/^#\s?/, "").trim()); continue }
    const m = line.match(/^([A-Z0-9_]+)=/)
    if (m && pending.length) {
      // Keep the sentence-bearing lines only; drop section rules ("── … ──").
      const useful = pending.filter((l) => l && !/^[─—-]{2,}/.test(l))
      if (useful.length) notes[m[1]] = useful.join(" ")
    }
    pending = []
  }
  return notes
}

function pendingOperatorSteps(env = process.env, notes = envExampleNotes()) {
  return OPERATOR_ENV_KEYS
    .filter((key) => !(env[key] && String(env[key]).trim() && !/^<SET_ME>$/i.test(env[key].trim())))
    .map((key) => ({ key, note: notes[key] || FALLBACK_NOTES[key] || "" }))
}

function checkStoragePath(key, dir) {
  let exists = false
  let writable = false
  try { exists = fs.statSync(dir).isDirectory() } catch { exists = false }
  if (exists) {
    try { fs.accessSync(dir, fs.constants.W_OK); writable = true } catch { writable = false }
  }
  const hbuilds = findHbuildsDir(dir)
  const insideVersionedDeploy = Boolean(
    hbuilds && dir.startsWith(path.join(hbuilds, "versions") + path.sep),
  )
  const status = !exists || !writable ? "red" : insideVersionedDeploy ? "amber" : "green"
  return {
    key, path: dir, exists, writable, insideVersionedDeploy, status,
    warning: insideVersionedDeploy
      ? "Inside hbuilds/versions/<uuid> — wiped by the next deploy. Set STORAGE_DIR or use <hbuilds>/storage."
      : !exists ? "Directory missing (created on first write; confirm the parent is persistent)."
      : !writable ? "Not writable by the app user." : null,
  }
}

function checkStorage(paths = STORAGE_PATHS) {
  return Object.entries(paths).map(([key, dir]) => checkStoragePath(key, dir))
}

function latestBackup(dir = STORAGE_PATHS.backups, now = Date.now()) {
  let names
  try { names = fs.readdirSync(dir) } catch { return { present: false, status: "red", reason: "backups directory missing" } }
  const files = names
    .filter((n) => /\.(json|sql|gz)$/i.test(n))
    .map((name) => {
      try {
        const st = fs.statSync(path.join(dir, name))
        return st.isFile() ? { name, size: st.size, mtimeMs: st.mtimeMs } : null
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  if (files.length === 0) return { present: false, status: "red", reason: "no backup file yet", count: 0 }
  const newest = files[0]
  const ageHours = Math.max(0, (now - newest.mtimeMs) / 36e5)
  const stale = ageHours > BACKUP_STALE_HOURS
  return {
    present: true,
    name: newest.name,
    size: newest.size,
    takenAt: new Date(newest.mtimeMs).toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
    stale,
    count: files.length,
    status: stale ? "amber" : "green",
    reason: stale ? `newest backup is ${Math.round(ageHours)}h old (> ${BACKUP_STALE_HOURS}h)` : null,
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return null }
}

function prismaVersions(root = ROOT) {
  const pkg = readJson(path.join(root, "package.json")) || {}
  const declared = (name) => pkg.dependencies?.[name] || pkg.devDependencies?.[name] || null
  const installed = (name) => readJson(path.join(root, "node_modules", name, "package.json"))?.version || null
  const client = { declared: declared("@prisma/client"), installed: installed("@prisma/client") }
  const cli = { declared: declared("prisma"), installed: installed("prisma") }
  const mismatch = Boolean(client.installed && cli.installed && client.installed !== cli.installed)
  return {
    client, cli, mismatch,
    status: !client.installed ? "red" : mismatch ? "amber" : "green",
    reason: !client.installed ? "@prisma/client not installed — run hostinger-recover.sh recover"
      : mismatch ? "prisma CLI and @prisma/client versions differ — run prisma generate" : null,
  }
}

function worst(statuses) {
  if (statuses.includes("red")) return "red"
  if (statuses.includes("amber")) return "amber"
  return "green"
}

/**
 * @param {object} [deps] injectable for tests
 */
async function getOpsReport({ env = process.env, now = Date.now() } = {}) {
  const [dbAlive, storage, backup, prisma] = await Promise.all([
    isAlive().catch(() => false),
    Promise.resolve(checkStorage()),
    Promise.resolve(latestBackup(STORAGE_PATHS.backups, now)),
    Promise.resolve(prismaVersions()),
  ])
  const pendingSteps = pendingOperatorSteps(env)
  const cronDisabled = String(env.DISABLE_CRON || "").trim() === "1" || String(env.DISABLE_CRON || "").toLowerCase() === "true"

  const db = { alive: dbAlive, status: dbAlive ? "green" : "red", reason: dbAlive ? null : "SELECT 1 failed — MySQL unreachable or engine wedged (restart + recover)" }
  const cron = { disabled: cronDisabled, status: cronDisabled ? "amber" : "green", reason: cronDisabled ? "DISABLE_CRON is set — nightly backup and every other job are silent" : null }
  const steps = { count: pendingSteps.length, status: pendingSteps.length ? "amber" : "green" }

  return {
    generatedAt: new Date(now).toISOString(),
    overall: worst([db.status, cron.status, backup.status, prisma.status, steps.status, ...storage.map((s) => s.status)]),
    runtime: {
      node: process.version,
      uptimeSec: Math.round(process.uptime()),
      nodeEnv: env.NODE_ENV || "development",
      storageBase: STORAGE_PATHS.base,
    },
    db, cron, prisma, storage, backup,
    pendingSteps,
    recovery: RECOVERY,
  }
}

module.exports = {
  getOpsReport,
  envExampleNotes,
  pendingOperatorSteps,
  checkStorage,
  checkStoragePath,
  latestBackup,
  prismaVersions,
  OPERATOR_ENV_KEYS,
  BACKUP_STALE_HOURS,
  RECOVERY,
}
