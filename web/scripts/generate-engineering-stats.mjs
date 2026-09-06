/**
 * generate-engineering-stats.mjs · the numbers on /about (T4-4)
 *
 * /about should be able to show a stranger engineering figures they can
 * trust. The only way that stays true is if nobody ever types one: every
 * value here is read from something a tool produced.
 *
 *   tests      the suite count, from a jest run
 *   coverage   line coverage, from coverage/coverage-summary.json
 *   lighthouse the four category scores, from .lighthouseci/
 *
 * WHAT IT DOES WHEN A SOURCE IS MISSING
 *
 * It omits that key. It does not guess, does not carry the previous value
 * forward, and does not write a zero — a zero would render as "0% coverage"
 * on a public page, which is a false claim about the work rather than a
 * missing one. The strip on /about hides any tile it has no number for, and
 * hides itself entirely when there are none.
 *
 * WHERE IT RUNS
 *
 * Locally, before committing the bundle. That is not laziness about CI: the
 * SPA bundle is committed rather than built on the server (ADR 0001), so a
 * file CI writes into its own workspace never reaches a visitor. CI runs this
 * too and uploads the result as an artifact, which is how the owner refreshes
 * the committed copy after a run whose numbers are worth publishing.
 *
 *   node web/scripts/generate-engineering-stats.mjs
 *   npm run stats:build            (from web/)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const ROOT = join(WEB, "..")
const OUT = join(WEB, "public", "engineering-stats.json")
/** The committed bundle, so a build is not required to refresh the file. */
const MIRROR = join(ROOT, "public", "engineering-stats.json")

const read = (path) => {
  try { return JSON.parse(readFileSync(path, "utf8")) } catch { return null }
}

/* ── coverage ──────────────────────────────────────────────────────────── */

function coverage() {
  const summary = read(join(ROOT, "coverage", "coverage-summary.json"))
  const pct = summary?.total?.lines?.pct
  // Rounded to a whole number on purpose: 60.89% invites a reader to believe
  // the second decimal means something, and it moves with every test added.
  return Number.isFinite(pct) ? Math.round(pct) : null
}

/* ── tests ─────────────────────────────────────────────────────────────── */

/**
 * The test count, from jest's own JSON report.
 *
 * Only from there. The first version fell back to counting `test(` and `it(`
 * calls in test/ when no report was present, and that scan read 1216 against
 * a real 1566 — it cannot see a `test.each`, a loop, or a case built inside a
 * helper. A number 22% low on a public page is worse than no number, and it
 * is exactly the "nothing typed by hand" rule broken by a regex instead of a
 * person. `npm run stats:build` runs the suite to produce it.
 */
function tests() {
  const report = read(join(ROOT, "jest-results.json"))
  return Number.isFinite(report?.numTotalTests)
    ? { count: report.numTotalTests, suites: report.numTotalTestSuites }
    : null
}

/* ── lighthouse ────────────────────────────────────────────────────────── */

/**
 * The four category scores, as the WORST across every audited URL.
 *
 * Worst rather than mean, and this is the whole ethic of the strip: an
 * average lets a slow /store hide behind a fast /terms, and the number a
 * stranger should be shown is the one they might actually get. Rounded to
 * Lighthouse's own 0-100.
 */
function lighthouse() {
  const dir = join(ROOT, ".lighthouseci")
  if (!existsSync(dir)) return null

  const worst = {}
  let seen = 0
  for (const file of readdirSync(dir)) {
    if (!file.startsWith("lhr-") || !file.endsWith(".json")) continue
    const lhr = read(join(dir, file))
    if (!lhr?.categories) continue
    seen += 1
    for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
      const score = lhr.categories[key]?.score
      if (!Number.isFinite(score)) continue
      const value = Math.round(score * 100)
      if (worst[key] === undefined || value < worst[key]) worst[key] = value
    }
  }
  if (!seen || !Object.keys(worst).length) return null
  return { ...worst, urls: seen }
}

/* ── write ─────────────────────────────────────────────────────────────── */

function main() {
  const stats = { generatedAt: new Date().toISOString() }

  const cov = coverage()
  if (cov !== null) stats.coverage = cov

  const t = tests()
  if (t) {
    stats.tests = t.count
    if (Number.isFinite(t.suites)) stats.suites = t.suites
  }

  const lh = lighthouse()
  if (lh) stats.lighthouse = lh

  const keys = Object.keys(stats).filter((k) => k !== "generatedAt")
  if (!keys.length) {
    // Still write the file, with nothing in it. The page hides the strip on
    // an empty payload, and an empty file is a clearer signal than a 404 that
    // the generator ran and found no sources.
    console.warn("[stats] no sources found — run `npm run stats:build` from web/, which produces them")
  }

  const json = `${JSON.stringify(stats, null, 2)}\n`
  for (const target of [OUT, MIRROR]) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, json, "utf8")
    console.log(`[stats] wrote ${target}`)
  }
  console.log(`[stats] ${keys.length ? keys.join(", ") : "nothing"}`)
}

main()
