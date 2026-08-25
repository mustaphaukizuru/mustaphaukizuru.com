#!/usr/bin/env node
/**
 * cancel-stale-orders.js · manual entry point for the pending-order janitor.
 *
 * The job itself lives in src/jobs/cancelStaleOrders.js and runs hourly from
 * the in-process scheduler. This script exists for ad-hoc runs and for hosts
 * where the API process is not long-lived.
 *
 *   npm run janitor:orders                # cancel pending orders > 24h
 *   npm run janitor:orders -- --dry-run   # list only
 *   npm run janitor:orders -- --hours=48
 */
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const prisma = require("../src/lib/prisma")
const { cancelStaleOrders } = require("../src/jobs/cancelStaleOrders")

const args   = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const hoursArg = args.find((a) => a.startsWith("--hours="))
const hours  = hoursArg ? Number(hoursArg.slice(8)) : 24

cancelStaleOrders({ hours: Number.isFinite(hours) && hours > 0 ? hours : 24, dryRun })
  .then((r) => {
    if (dryRun) {
      console.log(`[janitor · DRY RUN] ${r.scanned} stale pending order(s):`)
      for (const o of r.candidates || []) console.log(`  · ${o.orderNumber}  ${o.customerEmail}`)
    } else {
      console.log(`[janitor] scanned ${r.scanned} · cancelled ${r.cancelled} · coupons released ${r.couponsReleased}`)
    }
  })
  .catch((err) => { console.error("[janitor] FAILED:", err.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
