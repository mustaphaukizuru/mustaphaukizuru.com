/**
 * backupService.js — logical (JSON) database backup + retention.
 *
 * WHY THIS IS A SERVICE AND NOT JUST A SCRIPT
 * -------------------------------------------
 * scripts/backup-db-json.js existed and worked (1664 rows / 72 tables) but
 * only ran when someone remembered to run it. With .env pointing at
 * production and no dev database, the gap between "a backup exists" and "a
 * backup ran last night" was the entire risk. The dump logic now lives here
 * so the nightly job (src/jobs/backupDatabaseJob.js) and the CLI share one
 * implementation instead of drifting apart.
 *
 * WHERE THE FILES GO
 * ------------------
 * The script used to write to path.join(__dirname, "..", "storage", "backups")
 * — relative to the app directory. On Hostinger that is INSIDE the versioned
 * hbuilds/versions/<uuid>/ tree, which a deploy replaces wholesale. A backup
 * taken there would have been deleted by the very next deploy, i.e. the
 * moment it was most likely to be needed. STORAGE_PATHS.backups resolves to
 * the persistent <hbuilds>/storage/ location (see config/storagePaths.js).
 *
 * WHAT IT CAPTURES
 * ----------------
 * Rows only — JSON, not SQL. No schema, indexes or triggers. Enough to restore
 * data after a bad migration; not a substitute for scripts/backup-db.sh
 * (mysqldump) where mysqldump exists. BigInt and Decimal are stringified,
 * Date becomes ISO. Restore is manual by design.
 */

const fs = require("fs")
const path = require("path")
const prisma = require("../lib/prisma")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")

function stamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

function dbNameFromUrl(url = process.env.DATABASE_URL || "") {
  return url.match(/\/([^/?]+)(\?|$)/)?.[1] || "database"
}

/** Model names from the schema file — the source of truth per CLAUDE.md. */
function modelNames() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "..", "prisma", "schema.prisma"), "utf8")
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1])
}

/** BigInt / Decimal are not JSON-serialisable by default. */
function replacer(_k, v) {
  if (typeof v === "bigint") return v.toString()
  if (v && typeof v === "object" && typeof v.toFixed === "function" && v.constructor?.name === "Decimal") return v.toString()
  return v
}

/**
 * Dump every table to one JSON file.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.outDir]   defaults to STORAGE_PATHS.backups
 * @param {string}   [opts.outPath]  explicit file path (CLI --out); overrides outDir
 * @param {Function} [opts.log]      per-table progress sink (console.log for the CLI, no-op for the job)
 * @returns {Promise<{ outPath: string, rows: number, tables: number, bytes: number, skipped: string[] }>}
 */
async function runJsonBackup({ outDir = STORAGE_PATHS.backups, outPath, log = () => {} } = {}) {
  const dbName = dbNameFromUrl()
  const target = outPath || path.join(ensureDir(outDir), `${dbName}-${stamp()}.json`)
  ensureDir(path.dirname(target))

  const dump = { database: dbName, takenAt: new Date().toISOString(), tables: {} }
  let rows = 0
  const skipped = []

  for (const model of modelNames()) {
    const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)]
    if (!delegate?.findMany) { skipped.push(model); continue }
    try {
      const data = await delegate.findMany()
      dump.tables[model] = data
      rows += data.length
      if (data.length) log(`  ${model}: ${data.length}`)
    } catch (err) {
      // P2022: the generated client knows a column the DB does not have yet —
      // exactly the pre-migration state a backup exists for. Fall back to raw
      // SQL, which only sees the columns that really exist.
      if (err?.code === "P2022") {
        try {
          const data = await prisma.$queryRawUnsafe("SELECT * FROM `" + model + "`")
          dump.tables[model] = data
          rows += data.length
          log(`  ${model}: ${data.length} (raw — client/DB column drift)`)
          continue
        } catch (rawErr) {
          skipped.push(`${model} (raw: ${String(rawErr.message).slice(0, 40)})`)
          continue
        }
      }
      skipped.push(`${model} (${err?.code || String(err?.message).slice(0, 40)})`)
    }
  }

  const json = JSON.stringify(dump, replacer, 2)
  fs.writeFileSync(target, json)

  return { outPath: target, rows, tables: Object.keys(dump.tables).length, bytes: Buffer.byteLength(json), skipped }
}

/**
 * Keep the newest `keep` backup files for this database; delete the rest.
 * Only touches files matching `<dbName>-<stamp>.json`, so anything else in
 * the directory (SQL dumps from backup-db.sh, manual exports) is left alone.
 *
 * @returns {Promise<{ kept: number, removed: string[] }>}
 */
async function pruneBackups({ dir = STORAGE_PATHS.backups, keep = 14, dbName = dbNameFromUrl() } = {}) {
  if (!fs.existsSync(dir)) return { kept: 0, removed: [] }
  const prefix = `${dbName}-`
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  const removed = []
  for (const { f } of files.slice(Math.max(0, keep))) {
    fs.unlinkSync(path.join(dir, f))
    removed.push(f)
  }
  return { kept: Math.min(files.length, keep), removed }
}

module.exports = { runJsonBackup, pruneBackups, dbNameFromUrl, modelNames, stamp }
