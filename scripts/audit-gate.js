#!/usr/bin/env node
/**
 * scripts/audit-gate.js — CI dependency gate with justified exceptions.
 *
 * `npm audit --audit-level=moderate` is all-or-nothing: it fails on advisories
 * that cannot be fixed without a breaking major, which turns the gate
 * permanently red. A permanently red gate gets ignored, and then it stops
 * catching the advisories that DO matter.
 *
 * This wrapper fails on anything new while allowing a short, explicit list of
 * advisories that have been read and judged unreachable in this codebase.
 * Every entry must carry a reason and an owner-facing note in
 * docs/LAUNCH_HANDOVER_2026-08.md § 8. Adding one is a deliberate act, not a
 * silent suppression — and if an allowed advisory ever becomes fixable, the
 * gate tells you it is no longer needed.
 *
 *   node scripts/audit-gate.js               # fails on unexpected advisories
 *   node scripts/audit-gate.js --level=high  # default: moderate
 */
const { execFileSync } = require("child_process")

const LEVELS = ["info", "low", "moderate", "high", "critical"]
const levelArg = process.argv.find((a) => a.startsWith("--level="))
const MIN_LEVEL = levelArg ? levelArg.split("=")[1] : "moderate"
const minIndex = LEVELS.indexOf(MIN_LEVEL)

/**
 * Advisories deliberately accepted. Keyed by GHSA id so a different advisory
 * in the same package still fails the gate.
 */
const ALLOWED = {
  "GHSA-ggr8-5vv4-36mx": {
    package: "deepmerge-ts",
    reason:
      "Stack exhaustion when merging recursive object graphs. Reached only via " +
      "@prisma/config while Prisma loads its own config file at build time — that " +
      "input is ours, not attacker-supplied. The fix is a Prisma major on a working " +
      "MySQL layer.",
  },
  "GHSA-w5hq-g745-h8pq": {
    package: "uuid",
    reason:
      "Missing buffer bounds check in uuid v3/v5/v6 when `buf` is supplied. Nothing " +
      "in src/ calls uuid directly; it is reached through gaxios and node-cron, " +
      "neither of which passes caller-controlled buffers. The fix is a node-cron " +
      "major that changes the schedule() signature used by four live jobs.",
  },
}

function audit() {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024, shell: process.platform === "win32",
    })
  } catch (err) {
    // npm exits non-zero when vulnerabilities exist — the JSON is still on stdout.
    if (err.stdout) return err.stdout
    throw err
  }
}

const report = JSON.parse(audit())
const found = new Map()

for (const vuln of Object.values(report.vulnerabilities || {})) {
  for (const via of vuln.via || []) {
    if (typeof via !== "object" || !via.url) continue
    const id = via.url.split("/").pop()
    if (!found.has(id)) found.set(id, { id, name: via.name, severity: via.severity, url: via.url })
  }
}

const blocking = []
const allowedSeen = new Set()

for (const adv of found.values()) {
  if (ALLOWED[adv.id]) { allowedSeen.add(adv.id); continue }
  if (LEVELS.indexOf(adv.severity) >= minIndex) blocking.push(adv)
}

for (const adv of allowedSeen) {
  console.log(`[allowed] ${adv} · ${ALLOWED[adv].package} — ${ALLOWED[adv].reason.slice(0, 96)}…`)
}

const stale = Object.keys(ALLOWED).filter((id) => !allowedSeen.has(id))
if (stale.length) {
  console.log(`\n[stale] no longer reported, remove from ALLOWED: ${stale.join(", ")}`)
}

if (blocking.length) {
  console.error(`\n${blocking.length} advisory(ies) at or above "${MIN_LEVEL}" are NOT allow-listed:\n`)
  for (const a of blocking) console.error(`  ${a.severity.padEnd(9)} ${a.name.padEnd(18)} ${a.url}`)
  console.error("\nFix them, or add an entry to ALLOWED in scripts/audit-gate.js with a written reason.")
  process.exit(1)
}

console.log(`\nAudit gate passed — no unexpected advisories at or above "${MIN_LEVEL}".`)
