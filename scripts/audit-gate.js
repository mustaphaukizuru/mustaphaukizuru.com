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

function audit(cwd = ".") {
  let out
  try {
    out = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, shell: process.platform === "win32",
    })
  } catch (err) {
    // npm exits non-zero when vulnerabilities exist — the JSON is still on stdout.
    if (!err.stdout) throw err
    out = err.stdout
  }

  // npm ALSO exits non-zero, and still prints JSON, when the registry audit
  // endpoint is unreachable — but that JSON is `{"error": {...}}` with no
  // `vulnerabilities` key. Read naively that is indistinguishable from a clean
  // tree, so a 503 or a network timeout used to print "Audit gate passed" and
  // exit 0. A security gate that silently passes when it did not run is worse
  // than no gate: this one reported clean locally on the exact commit CI was
  // failing. Fail closed instead — a flaky registry is a re-run, not a pass.
  let report
  try {
    report = JSON.parse(out)
  } catch {
    console.error(`✖ audit-gate: npm audit in ${cwd} produced output that is not JSON.`)
    process.exit(1)
  }
  if (report.error || !report.vulnerabilities || !report.metadata) {
    const detail = report.error ? (report.error.summary || report.error.code || "unknown error") : "no vulnerabilities/metadata in report"
    console.error(`✖ audit-gate: npm audit in ${cwd} did not return a report — ${detail}`)
    console.error("  The advisory data never arrived, so this run proves nothing. Re-run it.")
    process.exit(1)
  }
  return report
}

// One advisory map across both trees, keyed by GHSA id. An advisory that
// appears in both is reported once, tagged with every tree it was found in,
// and an ALLOWED entry applies wherever that id shows up.
const found = new Map()

for (const { dir, label } of TARGETS) {
  const report = audit(dir)
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

console.log(`\nAudit gate passed — no unexpected advisories at or above "${MIN_LEVEL}".`)
