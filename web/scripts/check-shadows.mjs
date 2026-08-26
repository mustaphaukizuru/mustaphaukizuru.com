/**
 * check-shadows.mjs — CI ratchet against new arbitrary shadow values.
 *
 * U4. tokens.css carries an elevation scale (--shadow-e1..e7, n1..n3,
 * lift-1..4) and 270 of 497 usages now resolve through it. The other 227 are
 * deliberate one-offs (negative spreads, insets, multi-layer stacks) that
 * would change designs if collapsed, so they stay. What must NOT happen is
 * a 174th distinct raw value appearing because a new card reached for
 * `shadow-[0_5px_17px_...]` instead of a step.
 *
 * So this is a ratchet, not a cliff: every distinct raw `shadow-[...]` value
 * in web/src today is committed to scripts/shadow-baseline.json and printed
 * as one debt line; the gate fails only on a value that is not in the
 * baseline. Paying the debt down (migrating a one-off onto a token) then
 * `--update-baseline` shrinks the list. Values that go through the scale —
 * `shadow-[var(--shadow-*)]` — are never counted.
 *
 * The key is the VALUE, not file+value: a one-off reused in a second place
 * is not new debt, it is the same debt. Adding a 174th value anywhere is.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const SRC = join(WEB, "src")
const BASELINE_PATH = join(WEB, "scripts", "shadow-baseline.json")

const SHADOW = /\bshadow-\[([^\]]+)\]/g

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?)$/.test(e)) out.push(p)
  }
  return out
}

/** value -> first file:line it was seen at (for the report) */
const seen = new Map()
for (const abs of walk(SRC)) {
  const text = readFileSync(abs, "utf8")
  for (const m of text.matchAll(SHADOW)) {
    const value = m[1]
    if (value.startsWith("var(--shadow-")) continue
    if (!seen.has(value)) {
      const line = text.slice(0, m.index).split("\n").length
      seen.set(value, `${abs.replace(SRC, "src").replace(/\\/g, "/")}:${line}`)
    }
  }
}

const current = [...seen.keys()].sort()

if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n")
  console.log(`  baseline written: ${current.length} distinct raw shadow values → ${BASELINE_PATH}`)
}

const baseline = new Set(existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [])
const fresh = current.filter((v) => !baseline.has(v))
const known = current.length - fresh.length
const retired = [...baseline].filter((v) => !seen.has(v)).length

if (known) {
  console.log(`  ⚠ ${known} known raw shadow values in the baseline (debt, not a failure)${retired ? ` · ${retired} retired since — run --update-baseline to shrink it` : ""}`)
}

if (fresh.length) {
  console.error("\n\x1b[31m✖ Shadow ratchet failed\x1b[0m — a NEW arbitrary shadow value appeared.\n")
  for (const v of fresh) console.error(`    ${seen.get(v)}  shadow-[${v}]`)
  console.error("\n  Pick a step from the elevation scale in web/src/styles/tokens.css instead:")
  console.error("    ambient  shadow-[var(--shadow-e1)] … e7   neutral  n1 … n3   emphasis  lift-1 … lift-4")
  console.error("  If this really is a deliberate one-off, add it to scripts/shadow-baseline.json with the PR.\n")
  process.exit(1)
}

console.log(`✓ Shadow ratchet passed — no new arbitrary shadow values (${current.length} known one-offs, scale tokens uncounted).`)
