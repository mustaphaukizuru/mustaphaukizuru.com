#!/usr/bin/env node
/**
 * scripts/explain-hot-queries.js — D2 · index review against real query shapes.
 *
 * Runs EXPLAIN (read-only) on the SQL MySQL actually receives for the hot
 * query shapes in src/, and prints the access type, chosen key and row
 * estimate per table. Grepping the schema tells you which indexes exist;
 * only the optimizer tells you which ones it uses.
 *
 *   node scripts/explain-hot-queries.js
 *
 * Safe on production: EXPLAIN never reads or writes rows. It deliberately
 * bypasses scripts/guard-prod-db.js because there is nothing to guard.
 * A shape is flagged when the optimizer picks a full scan (type=ALL) on a
 * table that has more than SCAN_ROWS rows — small tables scan faster than
 * they seek, so a scan there is not a finding.
 */
const fs = require("fs")
const path = require("path")
const prisma = require("../src/lib/prisma")

const SCAN_ROWS = 500

/* Shapes are written against model names; a model with @@map lives under
 * another table name in MySQL (Review → product_reviews), so rewrite those
 * identifiers before EXPLAIN. */
const SCHEMA = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8")
const TABLE_OF = {}
for (const m of SCHEMA.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const map = m[2].match(/@@map\("([^"]+)"\)/)
  if (map) TABLE_OF[m[1]] = map[1]
}
function toSql(sql) {
  return Object.entries(TABLE_OF).reduce(
    (acc, [model, table]) => acc.replace(new RegExp(`\\b${model}\\b`, "g"), "`" + table + "`"),
    sql,
  )
}

/* The shapes, as the services issue them (parameters are placeholders). */
const SHAPES = [
  { name: "admin contact inbox by status, newest first",
    sql: "SELECT id FROM ContactMessage WHERE status = 'new' ORDER BY createdAt DESC LIMIT 20" },
  { name: "contact status counts (groupBy)",
    sql: "SELECT status, COUNT(*) FROM ContactMessage GROUP BY status" },
  { name: "campaign audience count",
    sql: "SELECT COUNT(*) FROM NewsletterSubscriber WHERE status = 'subscribed'" },
  { name: "newsletter export, cursor-paged",
    sql: "SELECT id FROM NewsletterSubscriber WHERE status = 'subscribed' ORDER BY subscribedAt DESC, id DESC LIMIT 1000" },
  { name: "member notifications, newest first",
    sql: "SELECT id FROM Notification WHERE userId = 'x' ORDER BY createdAt DESC LIMIT 20" },
  { name: "unread notifications for a member",
    sql: "SELECT id FROM Notification WHERE userId = 'x' AND isRead = 0" },
  { name: "abandoned-cart dedupe (EmailLog)",
    sql: "SELECT id FROM EmailLog WHERE userId = 'x' AND templateKey = 'cart.abandoned' AND createdAt >= NOW() - INTERVAL 7 DAY AND status IN ('queued','sent') LIMIT 1" },
  { name: "email retry queue",
    sql: "SELECT id FROM EmailLog WHERE status = 'failed' AND nextAttemptAt <= NOW() LIMIT 50" },
  { name: "retention sweep (EmailLog by age, queue excluded)",
    sql: "SELECT id FROM EmailLog WHERE createdAt < NOW() - INTERVAL 180 DAY AND status <> 'queued' AND nextAttemptAt IS NULL LIMIT 5000" },
  { name: "retention sweep (expired sessions)",
    sql: "SELECT id FROM Session WHERE expiresAt < NOW() LIMIT 5000" },
  { name: "admin audit log, newest first",
    sql: "SELECT id FROM AdminAuditLog ORDER BY createdAt DESC LIMIT 50" },
  { name: "abandoned carts selection",
    sql: "SELECT id FROM Cart WHERE status = 'active' AND userId IS NOT NULL AND updatedAt <= NOW() - INTERVAL 1 HOUR AND updatedAt >= NOW() - INTERVAL 7 DAY LIMIT 200" },
  { name: "member active cart",
    sql: "SELECT id FROM Cart WHERE userId = 'x' AND status = 'active' LIMIT 1" },
  { name: "admin payment KPIs by status",
    sql: "SELECT COUNT(*) FROM Payment WHERE paymentStatus = 'paid'" },
  { name: "admin orders by status + date",
    sql: "SELECT id FROM `Order` WHERE status = 'paid' ORDER BY createdAt DESC LIMIT 20" },
  { name: "member orders",
    sql: "SELECT id FROM `Order` WHERE userId = 'x' ORDER BY createdAt DESC LIMIT 20" },
  { name: "public store listing",
    sql: "SELECT id FROM Product WHERE isActive = 1 AND deletedAt IS NULL AND status = 'published' ORDER BY createdAt DESC LIMIT 24" },
  { name: "related products in a category",
    sql: "SELECT id FROM Product WHERE category = 'Templates' AND isActive = 1 AND deletedAt IS NULL AND id <> 'x' ORDER BY rating DESC, reviewCount DESC, publishedAt DESC LIMIT 4" },
  { name: "funnel: product views by session",
    sql: "SELECT DISTINCT sessionHash FROM PageView WHERE createdAt >= NOW() - INTERVAL 30 DAY AND path LIKE '/store/%'" },
  { name: "funnel: events by name in range",
    sql: "SELECT DISTINCT sessionHash FROM AnalyticsEvent WHERE createdAt >= NOW() - INTERVAL 30 DAY AND name = 'purchase'" },
  { name: "product reviews, approved, newest",
    sql: "SELECT id FROM Review WHERE productId = 'x' AND status = 'approved' ORDER BY createdAt DESC LIMIT 10" },
  { name: "upcoming consultations for a member",
    sql: "SELECT id FROM Consultation WHERE userId = 'x' AND scheduledAt >= NOW() AND status IN ('confirmed','pending') ORDER BY scheduledAt DESC LIMIT 20" },
]

async function tableRows(table) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT TABLE_ROWS AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", table,
  )
  return Number(rows?.[0]?.n ?? 0)
}

async function main() {
  const findings = []
  for (const shape of SHAPES) {
    let plan
    try {
      plan = await prisma.$queryRawUnsafe(`EXPLAIN ${toSql(shape.sql)}`)
    } catch (err) {
      console.log(`✗ ${shape.name}\n    ${err.message.split("\n")[0]}`)
      continue
    }
    for (const row of plan) {
      const rows = await tableRows(row.table)
      const scan = row.type === "ALL"
      const flag = scan && rows > SCAN_ROWS
      if (flag) findings.push({ shape: shape.name, table: row.table, rows })
      console.log(`${flag ? "!" : scan ? "·" : "✓"} ${shape.name}`)
      console.log(`    ${row.table}: type=${row.type} key=${row.key || "—"} rows≈${row.rows} (table≈${rows})${row.Extra ? "  " + row.Extra : ""}`)
    }
  }
  console.log(`\n${findings.length} full scan(s) on tables over ${SCAN_ROWS} rows.`)
  for (const f of findings) console.log(`  ${f.table} (${f.rows} rows) — ${f.shape}`)
  await prisma.$disconnect()
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1) })
