/**
 * check-typography.mjs — CI ratchet against new arbitrary font sizes.
 *
 * T3-1, cloned from check-shadows.mjs and given one extra rule.
 *
 * tokens.css carries a type scale with size, line-height and tracking baked
 * into each step: micro 10, meta 12, body 14, lead 16, card 18, section 24,
 * page 32, plus the fluid display/hero clamps. web/src also contains 1,625
 * arbitrary `text-[13px]`-style sizes across 34 distinct values, which is
 * why this is a ratchet and not a cliff: every distinct value in the tree
 * today is committed to scripts/typography-baseline.json and reported as
 * one debt line. The gate fails only on a value that is not in the
 * baseline.
 *
 * The key is the VALUE, not file+value. A one-off reused somewhere else is
 * the same debt; a 35th distinct value anywhere is new debt.
 *
 * THE EXTRA RULE — a legibility floor.
 * A new value below 12px fails and cannot be waved through by adding it to
 * the baseline, because that category is already a known problem: roughly
 * 44% of the text on /about is under 12px today, and iOS zooms any input
 * under 16px on focus. Existing sub-12px values stay in the baseline as
 * debt to pay down; the tree is not allowed to grow more of them. If a
 * design genuinely needs 11px, the answer is `text-micro` (10px with the
 * tracking that makes it readable) or a decision recorded in tokens.css —
 * not a fourth spelling of "small".
 *
 * Sizes that go through the scale — `text-micro`, `text-meta`,
 * `text-[length:var(--text-body-size)]` — are never counted.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const SRC = join(WEB, "src")
const BASELINE_PATH = join(WEB, "scripts", "typography-baseline.json")

// Arbitrary px font sizes only. `text-[color:...]`, `text-[var(...)]` and
// non-px units are somebody else's gate (check-raw-hex owns colour).
const TYPE = /\btext-\[(\d+(?:\.\d+)?)px\]/g

const FLOOR_PX = 12

const SCALE = [
  ["text-micro", 10, "uppercase labels, badges — carries 0.12em tracking"],
  ["text-meta", 12, "captions, table cells, helper text"],
  ["text-body", 14, "paragraphs, list items"],
  ["text-lead", 16, "intro paragraphs, form inputs (iOS zooms below 16)"],
  ["text-card", 18, "card titles"],
  ["text-section", 24, "section headings"],
  ["text-page", 32, "page titles"],
]

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?)$/.test(e)) out.push(p)
  }
  return out
}

/** value -> { where: "src/x.jsx:12", count } */
const seen = new Map()
for (const abs of walk(SRC)) {
  const text = readFileSync(abs, "utf8")
  for (const m of text.matchAll(TYPE)) {
    const value = m[1]
    const entry = seen.get(value)
    if (entry) {
      entry.count += 1
    } else {
      const line = text.slice(0, m.index).split("\n").length
      seen.set(value, { where: `${abs.replace(SRC, "src").replace(/\\/g, "/")}:${line}`, count: 1 })
    }
  }
}

const current = [...seen.keys()].sort((a, b) => Number(a) - Number(b))
const nearest = (px) =>
  SCALE.reduce((best, s) => (Math.abs(s[1] - px) < Math.abs(best[1] - px) ? s : best), SCALE[0])

if (process.argv.includes("--update-baseline")) {
  const belowFloor = current.filter((v) => Number(v) < FLOOR_PX)
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n")
  console.log(`  baseline written: ${current.length} distinct arbitrary font sizes → ${BASELINE_PATH}`)
  if (belowFloor.length) {
    console.log(`  note: ${belowFloor.length} of them are below the ${FLOOR_PX}px floor (${belowFloor.map((v) => v + "px").join(", ")}) — debt to migrate, not a licence to add more`)
  }
}

const baseline = new Set(existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [])
const fresh = current.filter((v) => !baseline.has(v))
const known = current.length - fresh.length
const retired = [...baseline].filter((v) => !seen.has(v)).length
const total = [...seen.values()].reduce((n, e) => n + e.count, 0)
const tiny = current.filter((v) => Number(v) < FLOOR_PX)
const tinyUses = tiny.reduce((n, v) => n + seen.get(v).count, 0)

if (known) {
  console.log(
    `  ⚠ ${known} known arbitrary font sizes in the baseline across ${total} usages (debt, not a failure)` +
    `${retired ? ` · ${retired} retired since — run --update-baseline to shrink it` : ""}`,
  )
  if (tinyUses) {
    console.log(`  ⚠ ${tinyUses} of those usages are under ${FLOOR_PX}px (${tiny.map((v) => v + "px").join(", ")}) — the legibility debt T3-1 exists to shrink`)
  }
}

if (fresh.length) {
  const belowFloor = fresh.filter((v) => Number(v) < FLOOR_PX)
  console.error("\n\x1b[31m✖ Typography ratchet failed\x1b[0m — a NEW arbitrary font size appeared.\n")
  for (const v of fresh) {
    const [name, px, use] = nearest(Number(v))
    console.error(`    ${seen.get(v).where}  text-[${v}px]  →  ${name} (${px}px · ${use})`)
  }
  if (belowFloor.length) {
    console.error(`\n  \x1b[31m${belowFloor.map((v) => v + "px").join(", ")} is below the ${FLOOR_PX}px legibility floor.\x1b[0m`)
    console.error("  Do not add it to the baseline. Roughly 44% of the text on /about is already")
    console.error("  under 12px, iOS zooms any input under 16px on focus, and a fourth spelling of")
    console.error("  \"small\" makes that worse. Use text-micro (10px, with the tracking that makes")
    console.error("  it readable) or add a step to tokens.css as a deliberate decision.")
  } else {
    console.error("\n  Pick a step from the scale in web/src/styles/tokens.css:")
    for (const [name, px, use] of SCALE) console.error(`    ${name.padEnd(13)} ${String(px + "px").padEnd(6)} ${use}`)
    console.error("\n  If this really is a deliberate one-off, add it to scripts/typography-baseline.json with the PR.")
  }
  console.error("")
  process.exit(1)
}

console.log(`✓ Typography ratchet passed — no new arbitrary font sizes (${current.length} known values, ${total} usages, scale classes uncounted).`)
