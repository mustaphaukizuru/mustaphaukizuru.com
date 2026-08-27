/**
 * src/jobs/projectPurgeJob.js · Tier 4 data-retention purge
 *
 * Client deliverables must not live on disk forever. Once a project has been
 * closed (completed / cancelled) for PROJECT_PURGE_DAYS (default 60 — i.e.
 * well after the PROJECT_ACCESS_GRACE_DAYS read window), this job:
 *
 *   1. unlinks every ProjectFile's bytes via resolveSafePath (the same
 *      startsWith guard the download path uses — a bad filePath is skipped,
 *      never resolved outside the storage root),
 *   2. stamps ProjectFile.purgedAt on each row (metadata stays: name, size,
 *      who uploaded it, when — the audit trail survives, the bytes do not),
 *   3. stamps ClientProject.purgedAt so the project is never scanned again.
 *
 * Already-missing files count as purged (ENOENT is fine). Any other unlink
 * error leaves that row un-stamped so the next nightly pass retries it, and
 * the project is only stamped when every file is gone. Batch-capped; runs
 * at 04:00 UTC from scheduler.js; also callable with { dryRun: true }.
 */
const fsp = require("fs/promises")
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { resolveSafePath } = require("../controllers/clientProjectController")

const DEFAULT_PURGE_DAYS = 60
const BATCH = 25
const DAY_MS = 24 * 60 * 60 * 1000

function purgeDays() {
  const n = Number(process.env.PROJECT_PURGE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PURGE_DAYS
}

/** Remove one file's bytes. Returns true when the file is gone (or never was). */
async function unlinkFile(filePath) {
  const abs = resolveSafePath(filePath)
  if (!abs) {
    logger.warn("[purge] skipping suspicious path", { filePath })
    return true // nothing safe to delete; treat as gone so the row is stamped
  }
  try {
    await fsp.unlink(abs)
    return true
  } catch (err) {
    if (err?.code === "ENOENT") return true
    logger.error(`[purge] unlink failed for ${abs}: ${err.message}`)
    return false
  }
}

async function purgeProject(project, now, dryRun) {
  const files = await prisma.projectFile.findMany({
    where:  { projectId: project.id, purgedAt: null },
    select: { id: true, filePath: true },
  })
  if (dryRun) return { projectId: project.id, files: files.length, purged: 0, failed: 0 }

  let purged = 0
  let failed = 0
  for (const f of files) {
    const gone = await unlinkFile(f.filePath)
    if (!gone) { failed += 1; continue }
    await prisma.projectFile.update({ where: { id: f.id }, data: { purgedAt: now } })
    purged += 1
  }
  if (failed === 0) {
    await prisma.clientProject.update({ where: { id: project.id }, data: { purgedAt: now } })
  }
  return { projectId: project.id, files: files.length, purged, failed }
}

async function runProjectPurgePass({ dryRun = false, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - purgeDays() * DAY_MS)
  const candidates = await prisma.clientProject.findMany({
    where:   { purgedAt: null, closedAt: { not: null, lt: cutoff } },
    select:  { id: true, projectName: true, closedAt: true },
    orderBy: { closedAt: "asc" },
    take:    BATCH,
  })
  if (candidates.length === 0) return { scanned: 0, projects: 0, files: 0, failed: 0, results: [] }

  const results = []
  for (const p of candidates) {
    try {
      results.push(await purgeProject(p, now, dryRun))
    } catch (err) {
      logger.error(`[purge] project ${p.id} failed: ${err.message}`)
      results.push({ projectId: p.id, files: 0, purged: 0, failed: 1, error: err.message })
    }
  }
  const summary = {
    scanned:  candidates.length,
    projects: results.filter((r) => r.failed === 0 && !dryRun).length,
    files:    results.reduce((n, r) => n + r.purged, 0),
    failed:   results.reduce((n, r) => n + r.failed, 0),
    results,
  }
  logger.info(`[purge] ${dryRun ? "dry-run · " : ""}${summary.projects}/${summary.scanned} projects purged · ${summary.files} files removed · ${summary.failed} failures`)
  return summary
}

module.exports = { runProjectPurgePass, purgeDays, DEFAULT_PURGE_DAYS }
