#!/usr/bin/env node
/**
 * scripts/check-db-drift.js — read-only pre-`db push` safety check.
 *
 * `prisma db push` DROPS anything that exists in the database but not in
 * prisma/schema.prisma. On a live database that is unrecoverable without a
 * backup, and the enum backfill script does not cover it. Run this first:
 *
 *   node scripts/check-db-drift.js
 *
 * Reports tables and columns present in MySQL but absent from the schema
 * (with row / non-null counts so you can judge the impact), plus row counts
 * for the tables an enum ALTER touches. Writes nothing. Exit 2 if drift was
 * found so a deploy script can gate on it.
 */
require("dotenv").config()
const fs = require("fs")
const prisma = require("../src/lib/prisma")

const schema = fs.readFileSync("prisma/schema.prisma", "utf8")

// Model name → its scalar/field names, and model name → mapped table name.
const modelFields = new Map()
const tableOf = new Map()
for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, name, body] = m
  const fields = new Set()
  for (const raw of body.split("\n")) {
    const t = raw.trim()
    if (!t || t.startsWith("//") || t.startsWith("@@")) continue
    const fm = t.match(/^(\w+)\s+\w+/)
    if (fm) fields.add(fm[1])
  }
  modelFields.set(name, fields)
  const mapped = body.match(/@@map\("([^"]+)"\)/)
  tableOf.set(name, mapped ? mapped[1] : name)
}

const ENUM_ALTERED = [
  "User", "ContactMessage", "NewsletterSubscriber",
  "EmailCampaignRecipient", "DiagnosticSubmission", "EmailLog",
]
const BUSINESS = ["Order", "OrderItem", "Payment", "UserDownload", "Consultation", "Product", "BlogPost", "Refund"]

async function count(table, where = "") {
  const r = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS n FROM `" + table + "`" + where)
  return Number(r[0].n)
}

async function main() {
  const dbName = (process.env.DATABASE_URL || "").match(/\/([^/?]+)(\?|$)/)?.[1]
  if (!dbName) { console.error("Could not read the database name from DATABASE_URL"); process.exitCode = 1; return }
  console.log(`database: ${dbName}\n`)

  const liveTables = (await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", dbName)).map((r) => r.t)
  const schemaTables = new Set(tableOf.values())
  let drift = 0

  const orphanTables = liveTables.filter((t) => !schemaTables.has(t) && t !== "_prisma_migrations")
  console.log(`tables · live ${liveTables.length} · schema ${schemaTables.size}`)
  if (orphanTables.length) {
    drift += orphanTables.length
    console.log("  !! in the DB but NOT in the schema — `db push` would DROP these:")
    for (const t of orphanTables) console.log(`     - ${t}  (${await count(t)} rows)`)
  } else {
    console.log("  ok · no orphan tables")
  }

  const cols = await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?", dbName)
  const live = new Map()
  for (const r of cols) {
    if (!live.has(r.t)) live.set(r.t, [])
    live.get(r.t).push(r.c)
  }
  const wantByTable = new Map()
  for (const [model, table] of tableOf) wantByTable.set(table, modelFields.get(model))

  console.log("\ncolumns")
  let orphanCols = 0
  for (const [table, liveCols] of live) {
    const want = wantByTable.get(table)
    if (!want) continue
    const missing = liveCols.filter((c) => !want.has(c))
    if (!missing.length) continue
    const detail = []
    for (const c of missing) detail.push(`${c} (${await count(table, " WHERE `" + c + "` IS NOT NULL")} non-null)`)
    console.log(`  !! ${table}: ${detail.join(", ")}`)
    orphanCols += missing.length
  }
  drift += orphanCols
  if (!orphanCols) console.log("  ok · no orphan columns")

  console.log("\nrows on enum-altered tables")
  for (const t of ENUM_ALTERED) {
    console.log(liveTables.includes(t) ? `  ${t}: ${await count(t)}` : `  ${t}: (absent)`)
  }
  console.log("\nrows in business tables")
  for (const t of BUSINESS) {
    if (liveTables.includes(t)) console.log(`  ${t}: ${await count(t)}`)
  }

  if (drift) {
    console.log(`\n${drift} drift item(s). Review each before running \`prisma db push\` — it will drop them.`)
    process.exitCode = 2
  } else {
    console.log("\nNo drift. `npx prisma db push` will only add/alter, never drop.")
  }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
