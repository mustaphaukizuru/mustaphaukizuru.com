#!/usr/bin/env node
/**
 * scripts/restore-db-json.js — read back what backup-db-json.js writes.
 *
 * WHY THIS EXISTS
 *
 * The repo had two backup WRITERS (this JSON dump and backup-db.sh) and no
 * reader. backupService.js said so in as many words: "Restore is manual."
 * A backup nobody has ever restored is not a recovery plan, it is a hope —
 * and there is no dev database here, so production holds the only copy of
 * every order, invoice and subscriber.
 *
 * USAGE
 *
 *   npm run restore -- --file <path>            # into a LOCAL database
 *   npm run restore -- --file <path> --truncate # clear tables first
 *   npm run restore -- --file <path> --dry-run  # parse + coerce, write nothing
 *   npm run restore -- --latest                 # newest dump in the backup dir
 *
 * The npm script runs guard-prod-db.js first, so this refuses a non-local
 * DATABASE_URL exactly like db:push and every seed does. Restoring ONTO
 * production is the one operation more destructive than db push, so the
 * guard is not optional — the rehearsal this script exists for is meant to
 * run against a scratch database.
 *
 * REHEARSING (the point of the exercise)
 *
 *   1. create an empty local database, point DATABASE_URL at it
 *   2. npx prisma db push          — schema, which the JSON does NOT carry
 *   3. npm run restore -- --latest --truncate
 *   4. read the verification table it prints: every model must reconcile
 *
 * WHAT THIS DOES NOT DO
 *
 * The dump is rows, not schema: no tables, indexes, triggers or AUTO_INCREMENT
 * positions. Step 2 above is mandatory. For a true disaster restore prefer the
 * SQL dump from backup-db.sh; this path is for row-level recovery after a bad
 * write, and for proving the backups are readable at all.
 */
require("dotenv").config()

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const { STORAGE_PATHS } = require("../src/config/storagePaths")
const { dbNameFromUrl } = require("../src/services/backupService")

const CHUNK = 500

// ── args ────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null
}
const flag = (name) => process.argv.includes(`--${name}`)

const DRY = flag("dry-run")
const TRUNCATE = flag("truncate")

/** Newest `<db>-<stamp>.json` in the backup directory. */
function latestBackup() {
  const dir = STORAGE_PATHS.backups
  if (!fs.existsSync(dir)) throw new Error(`no backup directory at ${dir}`)
  const db = dbNameFromUrl()
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${db}-`) && f.endsWith(".json"))
    .sort()
  if (!files.length) throw new Error(`no backups for "${db}" in ${dir}`)
  return path.join(dir, files[files.length - 1])
}

// ── schema-driven type coercion ─────────────────────────────────────────
/**
 * JSON has no Date, BigInt or Buffer, so the dump stringifies them (see
 * `replacer` in backupService). Feeding those strings straight back to Prisma
 * fails validation, so every value has to be converted to the type the schema
 * declares. The schema file is the source of truth for that — the same rule
 * the rest of the repo follows, and the reason this is parsed rather than
 * guessed from the data (an ISO-looking string in a String column must stay
 * a string).
 *
 * @returns {Map<string, Map<string, {type: string, isList: boolean}>>}
 */
function scalarFieldsByModel() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8")
  const SCALARS = new Set(["String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes"])
  const enums = new Set([...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]))

  const out = new Map()
  for (const block of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, model, body] = block
    const fields = new Map()
    for (const line of body.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("//") || t.startsWith("@@")) continue
      const m = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(t)
      if (!m) continue
      const [, name, type, list] = m
      // Relation fields carry a model type — skip them. Their FK *columns*
      // are separate scalar fields and are restored normally.
      if (!SCALARS.has(type) && !enums.has(type)) continue
      fields.set(name, { type, isList: Boolean(list) })
    }
    out.set(model, fields)
  }
  return out
}

function coerceValue(value, field) {
  if (value === null || value === undefined) return value
  switch (field.type) {
    case "DateTime":
      return field.isList ? value.map((v) => new Date(v)) : new Date(value)
    case "BigInt":
      return field.isList ? value.map((v) => BigInt(v)) : BigInt(value)
    case "Bytes":
      return field.isList ? value.map((v) => Buffer.from(v, "base64")) : Buffer.from(value, "base64")
    default:
      // String / Int / Float / Boolean / Json / Decimal / enum all round-trip.
      // Prisma accepts a Decimal as its string form, which is how it was dumped.
      return value
  }
}

/** Drop unknown keys and convert the rest. Unknown = column dropped from the
 *  schema since the dump; keeping it would fail the whole chunk. */
function coerceRow(row, fields, dropped) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const field = fields.get(k)
    if (!field) { dropped.add(k); continue }
    out[k] = coerceValue(v, field)
  }
  return out
}

module.exports = { scalarFieldsByModel, coerceValue, coerceRow, latestBackup }

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const file = arg("file") || (flag("latest") ? latestBackup() : null)
  if (!file) {
    console.error("usage: node scripts/restore-db-json.js --file <path> | --latest [--truncate] [--dry-run]")
    process.exit(1)
  }
  if (!fs.existsSync(file)) throw new Error(`no such backup: ${file}`)

  const dump = JSON.parse(fs.readFileSync(file, "utf8"))
  if (!dump || typeof dump.tables !== "object") throw new Error(`${file} is not a backup-db-json dump`)

  const target = dbNameFromUrl()
  console.log(`restore ${DRY ? "(DRY RUN) " : ""}`)
  console.log(`  from : ${file}`)
  console.log(`  taken: ${dump.takenAt}  (database "${dump.database}")`)
  console.log(`  into : "${target}"`)
  if (dump.database !== target) {
    console.log(`  note : dump came from a different database name — intentional for a rehearsal, check it is not an accident`)
  }
  console.log("")

  const schema = scalarFieldsByModel()
  const models = Object.keys(dump.tables)
  const results = []
  const droppedCols = new Set()

  // Rows are restored table by table, and a table's FK targets may not be
  // loaded yet. Rather than compute a topological order (which cycles anyway —
  // User↔Order both reference each other here), load with FK checks off, the
  // same thing mysqldump does.
  if (!DRY) await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")

  try {
    // Truncate in reverse so the log reads as an unwind of the load order.
    if (TRUNCATE && !DRY) {
      for (const model of [...models].reverse()) {
        if (!schema.has(model)) continue
        await prisma.$executeRawUnsafe("TRUNCATE TABLE `" + model + "`")
      }
      console.log(`truncated ${models.length} tables\n`)
    }

    for (const model of models) {
      const rows = dump.tables[model] || []
      const fields = schema.get(model)

      if (!fields) {
        results.push({ model, expected: rows.length, inserted: 0, note: "not in schema — skipped" })
        continue
      }
      if (!rows.length) {
        results.push({ model, expected: 0, inserted: 0, note: "" })
        continue
      }

      const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)]
      if (!delegate?.createMany) {
        results.push({ model, expected: rows.length, inserted: 0, note: "no client delegate — skipped" })
        continue
      }

      const data = rows.map((r) => coerceRow(r, fields, droppedCols))
      let inserted = 0

      if (DRY) {
        inserted = data.length
      } else {
        for (let i = 0; i < data.length; i += CHUNK) {
          const res = await delegate.createMany({ data: data.slice(i, i + CHUNK), skipDuplicates: true })
          inserted += res.count
        }
      }

      results.push({
        model,
        expected: rows.length,
        inserted,
        note: inserted === rows.length ? "" : `${rows.length - inserted} not inserted (already present?)`,
      })
      console.log(`  ${model}: ${inserted}/${rows.length}`)
    }
  } finally {
    if (!DRY) await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1")
  }

  // ── verification · the reason to run this at all ──────────────────────
  console.log("\nverification")
  let mismatches = 0
  for (const r of results) {
    const bad = r.inserted !== r.expected
    if (bad) mismatches += 1
    const mark = bad ? "✖" : "✓"
    const note = r.note ? `  ${r.note}` : ""
    console.log(`  ${mark} ${r.model.padEnd(28)} ${String(r.inserted).padStart(6)} / ${String(r.expected).padEnd(6)}${note}`)
  }

  const totalExpected = results.reduce((s, r) => s + r.expected, 0)
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  console.log(`\n  ${totalInserted} / ${totalExpected} rows across ${results.length} tables`)

  if (droppedCols.size) {
    console.log(`\n  columns in the dump that no longer exist in the schema, ignored:`)
    console.log(`    ${[...droppedCols].join(", ")}`)
  }

  if (DRY) {
    console.log("\ndry run — nothing was written.")
    return
  }
  if (mismatches) {
    console.error(`\n✖ ${mismatches} table(s) did not reconcile. The restore is INCOMPLETE — do not treat this backup as proven.`)
    process.exitCode = 1
    return
  }
  console.log("\n✓ every table reconciled — this backup restores cleanly.")
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("RESTORE FAILED:", e.message)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect().catch(() => {}))
}
