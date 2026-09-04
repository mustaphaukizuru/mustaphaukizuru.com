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
  // Empty on purpose. The two entries that lived here (deepmerge-ts
  // GHSA-ggr8-5vv4-36mx, uuid GHSA-w5hq-g745-h8pq) stopped being reported once
  // package.json pinned both through `overrides`, and the gate flags an
  // allow-list entry that no longer matches anything as [stale]. Leaving them
  // is how this list rots into a blanket exemption, so they are gone. Add an
  // entry back only with the advisory id, the package, and a written reason
  // the advisory is unreachable here.
}

/**
 * Both package trees are audited from one place. The frontend was not
 * gated at all until Q5: `web/` had 5 high-severity advisories in its
 * PRODUCTION deps (24 advisories, 13 high — react-router, vite, postcss,
 * nanoid; all fixed by within-major bumps) and CI never looked, because this
 * script ran only for the backend. `npm audit`
 * needs package.json + package-lock.json, not node_modules, so the web
 * tree can be audited from the backend job without a second install.
 */
const TARGETS = [
  { dir: ".",   label: "backend"  },
  { dir: "web", label: "frontend" },
]

const ATTEMPTS = 3
// npm keeps retrying the advisory endpoint internally and can sit there for
// seven minutes before giving up — three of those in series is a 20-minute CI
// job that still tells you nothing. Bound each attempt instead.
const ATTEMPT_TIMEOUT_MS = 120000

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runAudit(cwd) {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: ATTEMPT_TIMEOUT_MS,
      shell: process.platform === "win32",
    })
  } catch (err) {
    // npm exits non-zero when vulnerabilities exist — the JSON is still on stdout.
    if (err.stdout) return err.stdout
    return null
  }
}

/**
 * Returns a real audit report, or exits.
 *
 * npm exits non-zero and still prints JSON in TWO different situations: when
 * advisories exist, and when the registry audit endpoint is unreachable. The
 * second prints `{"error": {...}}` with no `vulnerabilities` key, and reading
 * that naively is indistinguishable from a clean tree — so a 503 used to print
 * "Audit gate passed" and exit 0. That is not hypothetical: on the very commit
 * CI was failing, a local run timed out and reported clean.
 *
 * So this fails closed. But failing closed on the first hiccup makes every
 * merge hostage to registry.npmjs.org, so a missing report is retried before
 * it is believed. Only a report that actually arrived is trusted.
 */
function audit(cwd = ".") {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const out = runAudit(cwd)
    let report = null
    if (out) { try { report = JSON.parse(out) } catch { report = null } }

    if (report && !report.error && report.vulnerabilities && report.metadata) return report

    const why = !out ? "npm produced no output"
      : !report ? "output was not JSON"
      : report.error ? (report.error.summary || report.error.code || "registry error")
      : "report had no vulnerabilities/metadata"
    console.error(`  audit-gate: attempt ${attempt}/${ATTEMPTS} in "${cwd}" got no report — ${why}`)
    if (attempt < ATTEMPTS) sleepSync(5000 * attempt)
  }

  // Deliberate, loud escape hatch, in the same spirit as ALLOW_PROD_DB: the
  // registry can be down for longer than a release can wait, and the answer to
  // that is a human saying so out loud — not the gate quietly deciding for
  // itself that no data means no advisories. Never set in CI by default.
  if (process.env.AUDIT_GATE_ALLOW_OFFLINE === "1") {
    console.error("")
    console.error(`  !! AUDIT_GATE_ALLOW_OFFLINE=1 — skipping the "${cwd}" tree after ${ATTEMPTS} failed attempts.`)
    console.error("     This run did NOT check dependencies. Re-run the gate once the registry is back.")
    console.error("")
    return null
  }

  console.error("")
  console.error(`✖ audit-gate: npm audit in "${cwd}" never returned a report (${ATTEMPTS} attempts).`)
  console.error("  The advisory data never arrived, so this run proves nothing about the tree.")
  console.error("  Re-run the job. If the registry is down for longer than you can wait, re-run")
  console.error("  with AUDIT_GATE_ALLOW_OFFLINE=1 and say so on the PR.")
  process.exit(1)
}

// One advisory map across both trees, keyed by GHSA id. An advisory that
// appears in both is reported once, tagged with every tree it was found in,
// and an ALLOWED entry applies wherever that id shows up.
const found = new Map()

const skipped = []

for (const { dir, label } of TARGETS) {
  const report = audit(dir)
  if (!report) { skipped.push(label); continue }
  for (const vuln of Object.values(report.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (typeof via !== "object" || !via.url) continue
      const id = via.url.split("/").pop()
      const entry = found.get(id) || { id, name: via.name, severity: via.severity, url: via.url, trees: new Set() }
      entry.trees.add(label)
      found.set(id, entry)
    }
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
  for (const a of blocking) console.error(`  ${a.severity.padEnd(9)} ${a.name.padEnd(18)} [${[...a.trees].join("+")}]  ${a.url}`)
  console.error("\nFix them, or add an entry to ALLOWED in scripts/audit-gate.js with a written reason.")
  process.exit(1)
}

if (skipped.length) {
  console.log(`
Audit gate INCOMPLETE — ${skipped.join(" and ")} not checked (AUDIT_GATE_ALLOW_OFFLINE=1).`)
  console.log(`No unexpected advisories at or above "${MIN_LEVEL}" in what WAS checked.`)
} else {
console.log(`\nAudit gate passed — no unexpected advisories at or above "${MIN_LEVEL}".`)
}
