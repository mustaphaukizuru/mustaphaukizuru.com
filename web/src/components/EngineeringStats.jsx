import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"

/* ──────────────────────────────────────────────────────────────────────────
 *  EngineeringStats · numbers a stranger can check (T4-4)
 *
 *  Test count, line coverage and the four Lighthouse scores, in mono tiles,
 *  with the date they were measured.
 *
 *  NOTHING HERE IS TYPED BY HAND. Every value comes from
 *  /engineering-stats.json, which web/scripts/generate-engineering-stats.mjs
 *  writes from jest's own report, coverage-summary.json and the Lighthouse
 *  runs. That is the entire point: a hand-written "99% coverage" on an about
 *  page is a claim, and this is meant to be evidence.
 *
 *  Which means the failure modes matter more than the happy path:
 *
 *    · a tile with no number is not rendered. Not a zero, not a dash, not
 *      "N/A" — a "0%" beside the word coverage is a false statement about
 *      the work, and worse than silence.
 *    · with no numbers at all, the whole strip is absent. A heading over an
 *      empty row invites the reader to wonder what was removed.
 *    · the measurement DATE is always shown when anything is. Numbers with
 *      no date are the ones that quietly become untrue.
 *  ──────────────────────────────────────────────────────────────────── */

/** Lighthouse's own bands, so the colour matches what the report would say. */
function band(score) {
  if (score >= 90) return "text-mint-700"
  if (score >= 50) return "text-amber-700"
  return "text-rose-700"
}

function Tile({ name, value, label, tone = "text-violet", hint }) {
  return (
    <div
      // Named so a test can ask "is there a coverage tile" without matching
      // the word in the intro copy, which is how the first version of that
      // assertion passed on prose rather than on a number.
      data-stat-tile={name}
      className="rounded-xl border border-charcoal-80/10 bg-white px-4 py-4 text-center"
      title={hint}
    >
      <div className={`font-mono text-[26px] font-bold leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1.5 text-micro font-semibold uppercase tracking-[0.12em] text-charcoal-80/65">
        {label}
      </div>
    </div>
  )
}

export default function EngineeringStats() {
  const { t, i18n } = useTranslation("about")
  const reduce = useReducedMotion()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // A static file in the BUNDLE, not an API call — which is why the
        // shared client would be wrong: apiRequest prefixes /api/v1, sends
        // credentials and throws on a non-2xx. This wants a plain GET of a
        // JSON file that Passenger serves without Node, and a 404 for it is
        // an ordinary answer meaning "nobody has generated the numbers yet".
        // eslint-disable-next-line no-restricted-syntax -- see above
        const res = await fetch("/engineering-stats.json", { cache: "no-cache" })
        if (!res.ok) return
        const data = await res.json()
        if (alive) setStats(data)
      } catch {
        // Absent or unparseable. The strip simply does not appear, which is
        // the same outcome as a build that never generated it.
      }
    })()
    return () => { alive = false }
  }, [])

  const lh = stats?.lighthouse
  const tiles = []

  if (Number.isFinite(stats?.tests)) {
    tiles.push({
      key: "tests",
      value: stats.tests.toLocaleString(),
      label: t("engineering.tests"),
      hint: Number.isFinite(stats.suites) ? t("engineering.suitesHint", { count: stats.suites }) : undefined,
    })
  }
  if (Number.isFinite(stats?.coverage)) {
    tiles.push({ key: "coverage", value: `${stats.coverage}%`, label: t("engineering.coverage") })
  }
  for (const [key, labelKey] of [
    ["performance", "engineering.performance"],
    ["accessibility", "engineering.accessibility"],
    ["best-practices", "engineering.bestPractices"],
    ["seo", "engineering.seo"],
  ]) {
    if (Number.isFinite(lh?.[key])) {
      tiles.push({
        key,
        value: lh[key],
        label: t(labelKey),
        tone: band(lh[key]),
        // The worst score across the audited pages, not the average — an
        // average lets a slow page hide behind a fast one.
        hint: Number.isFinite(lh.urls) ? t("engineering.worstHint", { count: lh.urls }) : undefined,
      })
    }
  }

  if (!tiles.length) return null

  const measured = stats?.generatedAt ? new Date(stats.generatedAt) : null
  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      data-engineering-stats
    >
      <p className="mb-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
        {t("engineering.eyebrow")}
      </p>
      <h2 className="mb-2 text-center text-[clamp(22px,3vw,32px)] font-extrabold tracking-tight text-charcoal">
        {t("engineering.heading")}
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-center text-meta leading-6 text-charcoal-80/70">
        {t("engineering.body")}
      </p>

      <div className={`grid gap-3 ${tiles.length > 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        {tiles.map((tile) => (
          <Tile key={tile.key} name={tile.key} value={tile.value} label={tile.label} tone={tile.tone} hint={tile.hint} />
        ))}
      </div>

      {measured && !Number.isNaN(measured.getTime()) ? (
        <p className="mt-3 text-center text-micro text-charcoal-80/65">
          {t("engineering.measured", {
            date: new Intl.DateTimeFormat(locale, {
              year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
            }).format(measured),
          })}
        </p>
      ) : null}
    </m.div>
  )
}
