#!/usr/bin/env node
/**
 * scripts/backup-db-json.js — logical backup without mysqldump.
 *
 * scripts/backup-db.sh is the primary backup (proper SQL dump, run on the
 * Hostinger server where mysqldump exists). On a Windows dev machine there is
 * usually no mysqldump on PATH, so this Prisma-based fallback dumps every
 * table to a single JSON file — enough to restore rows after a bad migration.
 *
 *   node scripts/backup-db-json.js                # → storage/backups/<db>-<ts>.json
 *   node scripts/backup-db-json.js --out path.json
 *
 * Caveats: JSON, not SQL — it captures ROWS, not schema, indexes or triggers.
 * BigInt and Decimal are stringified; Date becomes ISO. Restore is manual.
 * Do not use this as the only backup for a large production database.
 */
require("dotenv").config()
const fs = require("fs")
const path = require("path")
const prisma = require("../src/lib/prisma")

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

// Prisma exposes each model as a camelCase delegate; derive them from the schema.
function modelNames() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8")
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1])
}

const outArg = process.argv.indexOf("--out")

async function main() {
  const dbName = (process.env.DATABASE_URL || "").match(/\/([^/?]+)(\?|$)/)?.[1] || "database"
  const dir = path.join(__dirname, "..", "storage", "backups")
  fs.mkdirSync(dir, { recursive: true })
  const outPath = outArg !== -1 && process.argv[outArg + 1]
    ? process.argv[outArg + 1]
    : path.join(dir, `${dbName}-${stamp()}.json`)

  const dump = { database: dbName, takenAt: new Date().toISOString(), tables: {} }
  let total = 0, skipped = []

  for (const model of modelNames()) {
    const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)]
    if (!delegate?.findMany) { skipped.push(model); continue }
    try {
      const rows = await delegate.findMany()
      dump.tables[model] = rows
      total += rows.length
      if (rows.length) console.log(`  ${model}: ${rows.length}`)
    } catch (err) {
      // P2022 = the generated client knows a column the DB does not have yet.
      // That is exactly the pre-migration state this backup exists for, so
      // fall back to raw SQL, which only sees the columns that really exist.
      if (err.code === "P2022") {
        try {
          const rows = await prisma.$queryRawUnsafe("SELECT * FROM `" + model + "`")
          dump.tables[model] = rows
          total += rows.length
          console.log(`  ${model}: ${rows.length} (raw — client/DB column drift)`)
          continue
        } catch (rawErr) {
          skipped.push(`${model} (raw: ${rawErr.message.slice(0, 40)})`)
          continue
        }
      }
      skipped.push(`${model} (${err.code || err.message.slice(0, 40)})`)
    }
  }

  // BigInt/Decimal are not JSON-serialisable by default.
  const json = JSON.stringify(dump, (_k, v) => {
    if (typeof v === "bigint") return v.toString()
    if (v && typeof v === "object" && typeof v.toFixed === "function" && v.constructor?.name === "Decimal") return v.toString()
    return v
  }, 2)
  fs.writeFileSync(outPath, json)

  console.log(`\n${total} rows from ${Object.keys(dump.tables).length} tables → ${outPath}`)
  console.log(`size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`)
  if (skipped.length) console.log(`skipped: ${skipped.join(", ")}`)
}

main().catch((e) => { console.error("BACKUP FAILED:", e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
