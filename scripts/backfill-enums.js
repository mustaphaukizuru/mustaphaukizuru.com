#!/usr/bin/env node
/**
 * scripts/backfill-enums.js — roadmap step 42 (schema tidy)
 *
 * Run this BEFORE `npx prisma db push` on production. Step 42 converts five
 * free-text columns to MySQL ENUMs. MySQL (strict mode) refuses the ALTER —
 * or, in non-strict mode, silently truncates the value to '' — when any
 * existing row holds a value outside the new enum set. This script lists
 * those rows so they can be fixed first.
 *
 * Columns checked (table.column -> allowed values):
 *   User.role                       -> member | admin
 *   ContactMessage.status           -> new | read | replied
 *   NewsletterSubscriber.status     -> pending | subscribed | unsubscribed
 *   EmailCampaignRecipient.status   -> queued | sent | failed | bounced
 *   DiagnosticSubmission.audience   -> EDU | SMB | IND
 *   DiagnosticSubmission.tier       -> Foundation | Stabilizing | Optimizing | Mature
 *
 * Usage
 *   node scripts/backfill-enums.js            # dry run (default) - report only
 *   node scripts/backfill-enums.js --apply    # rewrite offending rows: case-only
 *                                             # mismatches -> canonical member,
 *                                             # anything else -> FALLBACK below
 *
 * Exit code: 0 when every column is clean, 2 when offending rows exist in
 * dry-run mode (so a deploy script can gate on it), 1 on error.
 *
 * Uses raw SQL because a Prisma client generated from the NEW schema already
 * types these columns as enums and would reject the out-of-set values.
 * Requires DATABASE_URL (loaded by src/lib/prisma).
 */

const prisma = require("../src/lib/prisma")

const CHECKS = [
  { table: "User",                   column: "role",     allowed: ["member", "admin"],                                   fallback: "member" },
  { table: "ContactMessage",         column: "status",   allowed: ["new", "read", "replied"],                            fallback: "new" },
  { table: "NewsletterSubscriber",   column: "status",   allowed: ["pending", "subscribed", "unsubscribed"],             fallback: "unsubscribed" },
  { table: "EmailCampaignRecipient", column: "status",   allowed: ["queued", "sent", "failed", "bounced"],               fallback: "failed" },
  { table: "DiagnosticSubmission",   column: "audience", allowed: ["EDU", "SMB", "IND"],                                 fallback: null },
  { table: "DiagnosticSubmission",   column: "tier",     allowed: ["Foundation", "Stabilizing", "Optimizing", "Mature"], fallback: null },
]

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'" }

async function main() {
  const apply = process.argv.includes("--apply")
  let dirty = 0

  for (const c of CHECKS) {
    const list = c.allowed.map(q).join(", ")
    // BINARY comparison so "Admin" / "NEW" are flagged and normalised
    // explicitly rather than relying on MySQL's collation.
    const rows = await prisma.$queryRawUnsafe(
      "SELECT `" + c.column + "` AS value, COUNT(*) AS n FROM `" + c.table + "`" +
      " WHERE BINARY `" + c.column + "` NOT IN (" + list + ")" +
      " GROUP BY `" + c.column + "`"
    )
    if (!rows.length) {
      console.log(`[ok]    ${c.table}.${c.column}`)
      continue
    }
    dirty += rows.length
    for (const r of rows) {
      const value = Buffer.isBuffer(r.value) ? r.value.toString("utf8") : String(r.value)
      console.log(`[dirty] ${c.table}.${c.column} = ${JSON.stringify(value)} (${Number(r.n)} rows)`)
      if (!apply) continue
      const canonical = c.allowed.find((a) => a.toLowerCase() === value.toLowerCase()) ?? c.fallback
      if (canonical == null) {
        console.log(`        no fallback for ${c.table}.${c.column} - fix these rows by hand`)
        continue
      }
      const res = await prisma.$executeRawUnsafe(
        "UPDATE `" + c.table + "` SET `" + c.column + "` = " + q(canonical) +
        " WHERE BINARY `" + c.column + "` = " + q(value)
      )
      console.log(`        -> rewrote ${res} rows to ${JSON.stringify(canonical)}`)
    }
  }

  if (dirty && !apply) {
    console.log(`\n${dirty} offending value(s). Re-run with --apply, or fix by hand, then run: npx prisma db push`)
    process.exitCode = 2
  } else {
    console.log(apply ? "\nDone. Safe to run: npx prisma db push" : "\nAll clean. Safe to run: npx prisma db push")
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect?.())
