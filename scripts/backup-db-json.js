#!/usr/bin/env node
/**
 * scripts/backup-db-json.js — logical backup without mysqldump.
 *
 * scripts/backup-db.sh is the primary backup (proper SQL dump, run on the
 * Hostinger server where mysqldump exists). On a Windows dev machine there is
 * usually no mysqldump on PATH, so this Prisma-based fallback dumps every
 * table to a single JSON file — enough to restore rows after a bad migration.
 *
 *   node scripts/backup-db-json.js                # → <storage>/backups/<db>-<ts>.json
 *   node scripts/backup-db-json.js --out path.json
 *
 * This is now a thin wrapper: the dump and retention logic live in
 * src/services/backupService.js so the nightly job
 * (src/jobs/backupDatabaseJob.js) and this CLI cannot drift apart. The
 * default directory is STORAGE_PATHS.backups — persistent on Hostinger,
 * where the old hardcoded storage/backups sat inside the versioned deploy
 * tree and would have been wiped by the next deploy.
 *
 * Caveats: JSON, not SQL — it captures ROWS, not schema, indexes or triggers.
 * BigInt and Decimal are stringified; Date becomes ISO. Restore is manual.
 * Do not use this as the only backup for a large production database.
 */
require("dotenv").config()

const prisma = require("../src/lib/prisma")
const { runJsonBackup } = require("../src/services/backupService")

const outArg = process.argv.indexOf("--out")
const outPath = outArg !== -1 && process.argv[outArg + 1] ? process.argv[outArg + 1] : undefined

async function main() {
  const r = await runJsonBackup({ outPath, log: console.log })
  console.log(`\n${r.rows} rows from ${r.tables} tables → ${r.outPath}`)
  console.log(`size: ${(r.bytes / 1024).toFixed(1)} KB`)
  if (r.skipped.length) console.log(`skipped: ${r.skipped.join(", ")}`)
}

main()
  .catch((e) => { console.error("BACKUP FAILED:", e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect().catch(() => {}))
