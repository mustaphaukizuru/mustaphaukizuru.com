/**
 * src/services/opsRunbookService — Tier 4 ops runbook.
 *
 * Pinned, with fs and prisma mocked (no disk writes, no DB):
 *   - every STORAGE_PATHS key is reported with exists / writable
 *   - a storage dir inside hbuilds/versions/<uuid> is flagged amber
 *   - a missing or unwritable dir is red
 *   - the newest backup wins; > 36h old is amber; none is red
 *   - pending operator steps come from unset env keys with the explanatory
 *     line that precedes the key in .env.example (fallback text otherwise)
 *   - a dead DB is red and makes the overall status red
 *   - the report never throws when isAlive rejects
 */

const path = require("path")

jest.mock("fs", () => {
  const real = jest.requireActual("fs")
  return { ...real, statSync: jest.fn(), accessSync: jest.fn(), readdirSync: jest.fn(), readFileSync: jest.fn() }
})
jest.mock("../src/lib/prisma", () => ({ isAlive: jest.fn() }))
jest.mock("../src/config/storagePaths", () => {
  const p = require("path")
  const base = p.join("/srv", "hbuilds", "storage")
  return {
    STORAGE_PATHS: {
      base,
      avatars: p.join(base, "uploads", "avatars"),
      backups: p.join(base, "backups"),
      logs: p.join("/srv", "hbuilds", "versions", "abc-uuid", "nodejs", "storage", "logs"),
    },
    findHbuildsDir: jest.requireActual("../src/config/storagePaths").findHbuildsDir,
    ensureDir: jest.fn(),
  }
})

const fs = require("fs")
const prisma = require("../src/lib/prisma")
const { STORAGE_PATHS } = require("../src/config/storagePaths")
const svc = require("../src/services/opsRunbookService")

const NOW = Date.parse("2026-08-26T12:00:00Z")
const H = 36e5

const ENV_EXAMPLE = [
  "# ── Section rule ──",
  "# Mexican tax id (RFC) printed on invoices.",
  "INVOICE_RFC=",
  "",
  "# Required to verify webhook signatures — must NOT be empty in production.",
  "MP_WEBHOOK_SECRET=<SET_ME>",
  "OTHER=1",
].join("\n")

function dirStat() { return { isDirectory: () => true, isFile: () => false } }
function fileStat(mtimeMs, size = 1024) { return { isDirectory: () => false, isFile: () => true, mtimeMs, size } }

beforeEach(() => {
  jest.clearAllMocks()
  fs.statSync.mockImplementation(() => dirStat())
  fs.accessSync.mockImplementation(() => undefined)
  fs.readdirSync.mockReturnValue([])
  fs.readFileSync.mockImplementation((file) => {
    if (String(file).endsWith(".env.example")) return ENV_EXAMPLE
    if (String(file).endsWith(path.join("node_modules", "@prisma", "client", "package.json"))) return JSON.stringify({ version: "6.19.3" })
    if (String(file).endsWith(path.join("node_modules", "prisma", "package.json"))) return JSON.stringify({ version: "6.19.3" })
    if (String(file).endsWith("package.json")) return JSON.stringify({ dependencies: { "@prisma/client": "^6.19.3" }, devDependencies: { prisma: "^6.19.3" } })
    throw new Error("ENOENT " + file)
  })
  prisma.isAlive.mockResolvedValue(true)
})

test("reports every storage key and flags a versioned-deploy path amber", () => {
  const rows = svc.checkStorage()
  expect(rows.map((r) => r.key)).toEqual(Object.keys(STORAGE_PATHS))
  const logs = rows.find((r) => r.key === "logs")
  expect(logs).toMatchObject({ exists: true, writable: true, insideVersionedDeploy: true, status: "amber" })
  expect(logs.warning).toMatch(/hbuilds\/versions/)
  expect(rows.find((r) => r.key === "avatars")).toMatchObject({ insideVersionedDeploy: false, status: "green", warning: null })
})

test("missing or unwritable storage is red", () => {
  fs.statSync.mockImplementation((p) => { if (p === STORAGE_PATHS.avatars) throw new Error("ENOENT"); return dirStat() })
  fs.accessSync.mockImplementation((p) => { if (p === STORAGE_PATHS.backups) throw new Error("EACCES") })
  const rows = svc.checkStorage()
  expect(rows.find((r) => r.key === "avatars")).toMatchObject({ exists: false, writable: false, status: "red" })
  expect(rows.find((r) => r.key === "backups")).toMatchObject({ exists: true, writable: false, status: "red" })
})

test("latest backup: newest file wins, age drives amber, none is red", () => {
  fs.readdirSync.mockReturnValue(["mu-2026-08-20T01-00-00.json", "mu-2026-08-26T01-00-00.json", "README.txt"])
  fs.statSync.mockImplementation((p) => {
    if (p.endsWith("mu-2026-08-26T01-00-00.json")) return fileStat(NOW - 11 * H, 2048)
    if (p.endsWith("mu-2026-08-20T01-00-00.json")) return fileStat(NOW - 6 * 24 * H, 4096)
    return dirStat()
  })
  expect(svc.latestBackup(STORAGE_PATHS.backups, NOW)).toMatchObject({
    present: true, name: "mu-2026-08-26T01-00-00.json", size: 2048, ageHours: 11, stale: false, status: "green", count: 2,
  })

  fs.readdirSync.mockReturnValue(["mu-2026-08-20T01-00-00.json"])
  expect(svc.latestBackup(STORAGE_PATHS.backups, NOW)).toMatchObject({ stale: true, status: "amber" })

  fs.readdirSync.mockReturnValue([])
  expect(svc.latestBackup(STORAGE_PATHS.backups, NOW)).toMatchObject({ present: false, status: "red" })

  fs.readdirSync.mockImplementation(() => { throw new Error("ENOENT") })
  expect(svc.latestBackup(STORAGE_PATHS.backups, NOW)).toMatchObject({ present: false, status: "red", reason: /missing/ })
})

test("pending operator steps use the .env.example comment above the key, <SET_ME> counts as unset", () => {
  const steps = svc.pendingOperatorSteps({ TAX_RATE: "0.16", SENTRY_DSN: "https://x@sentry.io/1", MP_WEBHOOK_SECRET: "<SET_ME>" })
  expect(steps.map((s) => s.key)).toEqual(["INVOICE_RFC", "MP_WEBHOOK_SECRET", "PREVIEW_FRAME_HOSTS"])
  expect(steps[0].note).toBe("Mexican tax id (RFC) printed on invoices.")           // section rule dropped
  expect(steps[1].note).toMatch(/must NOT be empty in production/)
  expect(steps[2].note).toMatch(/preview/i)                                         // fallback text
})

test("full report: dead DB is red overall; healthy env is green", async () => {
  fs.readdirSync.mockReturnValue(["mu-2026-08-26T01-00-00.json"])
  fs.statSync.mockImplementation((p) => (p.endsWith(".json") ? fileStat(NOW - 2 * H) : dirStat()))
  const env = { INVOICE_RFC: "X", TAX_RATE: "0.16", MP_WEBHOOK_SECRET: "s", SENTRY_DSN: "d", PREVIEW_FRAME_HOSTS: "h" }

  prisma.isAlive.mockRejectedValueOnce(new Error("boom"))
  const dead = await svc.getOpsReport({ env, now: NOW })
  expect(dead.db).toMatchObject({ alive: false, status: "red" })
  expect(dead.overall).toBe("red")

  const ok = await svc.getOpsReport({ env, now: NOW })
  expect(ok.db.status).toBe("green")
  expect(ok.prisma).toMatchObject({ client: { installed: "6.19.3" }, mismatch: false, status: "green" })
  expect(ok.backup.status).toBe("green")
  expect(ok.pendingSteps).toEqual([])
  expect(ok.cron.disabled).toBe(false)
  // the versioned "logs" path still holds the overall at amber
  expect(ok.overall).toBe("amber")
  expect(ok.recovery.backupThenPush).toEqual(["node scripts/backup-db-json.js", "ALLOW_PROD_DB=1 npm run db:push"])
  expect(ok.runtime.node).toBe(process.version)
})

test("DISABLE_CRON and missing env are amber, not red", async () => {
  fs.readdirSync.mockReturnValue(["mu-2026-08-26T01-00-00.json"])
  fs.statSync.mockImplementation((p) => (p.endsWith(".json") ? fileStat(NOW - 2 * H) : dirStat()))
  const r = await svc.getOpsReport({ env: { DISABLE_CRON: "1" }, now: NOW })
  expect(r.cron).toMatchObject({ disabled: true, status: "amber" })
  expect(r.pendingSteps).toHaveLength(svc.OPERATOR_ENV_KEYS.length)
  expect(r.overall).toBe("amber")
})
