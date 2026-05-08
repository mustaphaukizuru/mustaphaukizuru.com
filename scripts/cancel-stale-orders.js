#!/usr/bin/env node
/**
 * cancel-stale-orders.js · Order janitor
 *
 * Why this exists:
 *   CheckoutPage creates the Order row BEFORE the user picks a payment
 *   method (so the MP/PayPal preference can reference an existing
 *   orderNumber). If the user closes the tab, an "abandoned" Order sits
 *   in the DB with status = "pending" forever, polluting metrics and
 *   blocking duplicate-coupon-use checks.
 *
 *   This script transitions any Order that has been "pending" for
 *   longer than CUTOFF_HOURS to "cancelled". Orders with a successful
 *   payment that arrives later via webhook are not affected — the
 *   webhook handler uses gatewayTransactionId, not Order.status, to
 *   trigger fulfillment.
 *
 * What it does NOT touch:
 *   - Orders with status != "pending"
 *   - Orders with paidAt set (defensive — should never coincide with
 *     pending, but cheap insurance)
 *   - Orders younger than the cutoff
 *   - Any associated Cart (those already get cleaned up by the cart's
 *     own "abandoned" sweep)
 *
 * How to run:
 *   Manual:        npm run janitor:orders
 *   Scheduled:     add to Hostinger cron — see CRON_SETUP at the bottom
 *
 *   Flags:
 *     --dry-run    Print what would be cancelled without writing
 *     --hours=N    Override the cutoff (default 24)
 *
 * Exit codes:
 *   0   success (even when zero rows were touched)
 *   1   unrecoverable error (DB unreachable, etc.)
 */

const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const prisma = require("../src/lib/prisma")

const DEFAULT_CUTOFF_HOURS = 24

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { dryRun: false, hours: DEFAULT_CUTOFF_HOURS }
  for (const a of args) {
    if (a === "--dry-run") out.dryRun = true
    else if (a.startsWith("--hours=")) {
      const n = Number(a.slice(8))
      if (Number.isFinite(n) && n > 0) out.hours = n
    }
  }
  return out
}

async function main() {
  const { dryRun, hours } = parseArgs()
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  const tag = dryRun ? "[janitor · DRY RUN]" : "[janitor]"

  console.log(`${tag} cutoff = ${cutoff.toISOString()} (orders older than ${hours}h)`)

  // 1. Find candidates so we can log + audit. Limit avoids loading
  //    100k rows into memory if the script wasn't run for months.
  const candidates = await prisma.order.findMany({
    where: {
      status:    "pending",
      paidAt:    null,
      createdAt: { lt: cutoff },
    },
    select: {
      id: true, orderNumber: true, customerEmail: true,
      totalAmount: true, currency: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take:    1000, // ample headroom; re-runs sweep the rest
  })

  if (candidates.length === 0) {
    console.log(`${tag} nothing to cancel.`)
    return
  }

  console.log(`${tag} found ${candidates.length} stale pending order(s):`)
  candidates.forEach((o) => {
    const ageH = ((Date.now() - new Date(o.createdAt).getTime()) / 3600000).toFixed(1)
    console.log(
      `  · ${o.orderNumber}  ${o.customerEmail.padEnd(35)}  ` +
      `${o.totalAmount} ${o.currency}  age ${ageH}h`
    )
  })

  if (dryRun) {
    console.log(`${tag} dry run — no changes written.`)
    return
  }

  // 2. Apply cancellation in a single batched updateMany. Re-checks
  //    status + paidAt + createdAt inside the WHERE so a race with a
  //    just-arriving webhook can't flip a freshly-paid order back to
  //    cancelled.
  const result = await prisma.order.updateMany({
    where: {
      id:        { in: candidates.map((c) => c.id) },
      status:    "pending",
      paidAt:    null,
      createdAt: { lt: cutoff },
    },
    data: { status: "cancelled" },
  })

  console.log(`${tag} cancelled ${result.count} order(s).`)
  if (result.count !== candidates.length) {
    console.log(
      `${tag} ${candidates.length - result.count} order(s) skipped — ` +
      `likely transitioned to paid between SELECT and UPDATE.`
    )
  }
}

main()
  .catch((err) => {
    console.error("[janitor] FAILED:", err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/* ────────────────────────────────────────────────────────────────────────
 *  CRON_SETUP — Hostinger shared/VPS
 *
 *  Run hourly (light DB load, sweeps any new abandons quickly):
 *    0 * * * * cd /home/USER/public_html && /usr/bin/node scripts/cancel-stale-orders.js >> logs/janitor.log 2>&1
 *
 *  Or once a day at 03:00 server time (lower DB pressure, larger batches):
 *    0 3 * * * cd /home/USER/public_html && /usr/bin/node scripts/cancel-stale-orders.js >> logs/janitor.log 2>&1
 *
 *  Test before scheduling:
 *    npm run janitor:orders -- --dry-run
 *    npm run janitor:orders -- --hours=48 --dry-run
 *  ──────────────────────────────────────────────────────────────────── */
