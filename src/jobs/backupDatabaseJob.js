/**
 * src/jobs/backupDatabaseJob.js · nightly logical backup
 *
 * D1. A JSON dump of every table, written to persistent storage and pruned
 * to the newest `keep` files. Runs from scheduler.js at 03:30 UTC — after the
 * 00:15 analytics roll-up and in the quietest hour for a Mexico-based
 * audience — and is also callable from scripts/backup-db-json.js.
 *
 * Why a guard before the dump: the dump touches every table, and the first
 * cold query after Hostinger's ~60s idle timeout is exactly the one that
 * panics the Prisma engine ("timer has gone away", see lib/prisma.js). So
 * probe first, recycle once if dead, and if it is still dead SKIP this night
 * rather than half-write a backup. A missing backup is logged loudly; a
 * truncated one that looks complete is worse.
 *
 * Safe to overlap-guard: the scheduler's `guarded()` refuses a second tick
 * while one is running, and the dump is read-only against the database.
 */
const prisma = require("../lib/prisma")
const { isAlive, recycle } = require("../lib/prisma")
const logger = require("../utils/logger")
const { runJsonBackup, pruneBackups } = require("../services/backupService")

const DEFAULT_KEEP = 14

async function runBackupPass({ keep = DEFAULT_KEEP, outDir } = {}) {
  if (!(await isAlive())) {
    await recycle()
    if (!(await isAlive())) {
      logger.error("[backup] database unreachable — skipping tonight's backup (no partial file written)")
      return { skipped: true, reason: "db-unreachable" }
    }
  }

  const started = Date.now()
  const result = await runJsonBackup({ outDir })
  const pruned = await pruneBackups({ dir: outDir, keep })

  logger.info(
    `[backup] ${result.rows} rows / ${result.tables} tables → ${result.outPath} ` +
    `(${(result.bytes / 1024).toFixed(0)} KB, ${Date.now() - started} ms) · kept ${pruned.kept}, removed ${pruned.removed.length}`
  )
  if (result.skipped.length) {
    logger.warn(`[backup] skipped tables: ${result.skipped.join(", ")}`)
  }

  // `skipped` means two things here and must not collide: the service uses
  // it for "tables that could not be dumped", the job for "the whole run was
  // skipped". Rename the per-table list so the run-level flag is always a
  // boolean callers can branch on.
  const { skipped: skippedTables, ...rest } = result
  return { skipped: false, skippedTables, ...rest, pruned }
}

// Exposed for the CLI wrapper and tests; prisma re-exported so callers that
// want to $disconnect after a one-shot run can do so without a second import.
module.exports = { runBackupPass, DEFAULT_KEEP, prisma }
