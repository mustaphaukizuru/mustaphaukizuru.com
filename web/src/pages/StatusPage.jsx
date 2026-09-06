/* ════════════════════════════════════════════════════════════════════════
   StatusPage.jsx · /status · T1-9
   ────────────────────────────────────────────────────────────────────────
   A page a customer can open when the site is not working.

   WHY IT PROBES LIVE RATHER THAN READING A FILE CI WROTE

   The plan suggested having uptime.yml commit its last result to a status
   branch and rendering that. This does the live probe instead, for a reason
   the uptime workflow's own header states: Passenger serves public/
   STATICALLY, without Node. That is the exact failure this page exists for —
   on 25 August production served pages normally while every database-backed
   route hung, and the site LOOKED alive.

   So a static page that asks the API three questions itself survives the
   outage it reports on, and is current to the second rather than to the last
   CI run. A committed file would be as stale as the last deploy, which is
   the one thing a status page must never be. The workflow keeps alerting the
   owner; this answers the customer.

   Three tiles, and what each actually distinguishes:

     API              did anything answer at all? A hang and a 500 look the
                      same to a visitor and are the same to this tile.
     Database         a 200 that says database: down is still a full outage
                      for anyone trying to sign in or check out.
     Scheduled jobs   /health/jobs answers 503 while a job is overdue, which
                      is the dead-man switch for a scheduler that stopped
                      silently. Degraded, not down: the site works, emails
                      are not going out.

   noindex, and not in the sitemap: a status page in a search result is how
   people arrive at it believing it is the site.
   ════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react"

import Seo from "../components/seo/Seo"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import { API_BASE_URL } from "../lib/api"

/** How often the page re-probes while it is open. */
const REFRESH_MS = 30_000
/** Long enough for a slow cold start, short enough to answer a person. */
const TIMEOUT_MS = 12_000

const TONE = {
  ok: {
    icon: CheckCircle2,
    chip: "bg-mint/15 text-mint-700 ring-mint/25",
    dot: "bg-mint",
  },
  degraded: {
    icon: AlertTriangle,
    chip: "bg-amber/10 text-amber-700 ring-amber/25",
    dot: "bg-amber",
  },
  down: {
    icon: XCircle,
    chip: "bg-rose/10 text-rose-700 ring-rose/25",
    dot: "bg-rose",
  },
  unknown: {
    icon: Loader2,
    chip: "bg-charcoal-80/5 text-charcoal-80/65 ring-charcoal-80/10",
    dot: "bg-charcoal-80/30",
  },
}

/**
 * One fetch that cannot hang.
 *
 * AbortController rather than a bare fetch, because the failure this page was
 * built for is a HANG: without a timeout the tiles would sit on "checking"
 * forever and say less than nothing.
 */
async function probe(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // The shared client is exactly wrong here: apiRequest throws on a
    // non-2xx (a 503 IS the answer this page wants), sends credentials, and
    // runs the session-expired flow on a 401 — so probing a struggling API
    // would sign the visitor out. A bare, credential-free, aborting fetch is
    // the point.
    // eslint-disable-next-line no-restricted-syntax -- see above
    const res = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      // No credentials: this page must work for a signed-out stranger, and
      // an expired cookie must not change what it reports.
      credentials: "omit",
      cache: "no-store",
    })
    let body = null
    try { body = await res.json() } catch { /* a 502 from the proxy is HTML */ }
    return { ok: res.ok, status: res.status, body }
  } catch {
    // Aborted, DNS, offline, CORS — from a visitor's side these are one
    // thing: no answer.
    return { ok: false, status: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

function Tile({ state, title, detail }) {
  const tone = TONE[state] || TONE.unknown
  const Icon = tone.icon
  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-body font-medium text-charcoal-80">{title}</p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-semibold ring-1 ${tone.chip}`}>
          <Icon className={`size-3.5 ${state === "unknown" ? "animate-spin" : ""}`} aria-hidden="true" />
          {detail.label}
        </span>
      </div>
      {detail.note ? (
        <p className="mt-2 text-meta text-charcoal-80/65">{detail.note}</p>
      ) : null}
    </div>
  )
}

export default function StatusPage() {
  const { t, i18n } = useTranslation("common")
  const reduced = useReducedMotion()
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(true)

  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"

  /**
   * Probe and record. Sets no state before its first await, so the effect
   * below can call it without cascading a render.
   */
  const run = useCallback(async () => {
    const [health, jobs] = await Promise.all([
      probe("/api/v1/health"),
      probe("/api/v1/health/jobs"),
    ])

    const apiUp = health.ok && health.body?.status === "ok"
    const dbUp = health.body?.database === "ok"
    // A 503 here is the dead-man switch firing, which is a real answer.
    // Anything else while the API is up is "we could not tell".
    const jobsState = jobs.status === 503 ? "degraded" : jobs.ok ? "ok" : apiUp ? "unknown" : "down"

    setResult({
      at: new Date(),
      api: apiUp ? "ok" : "down",
      database: apiUp ? (dbUp ? "ok" : "down") : "down",
      jobs: jobsState,
      commit: health.body?.commit || null,
      staleJobs: Number(jobs.body?.stale) || 0,
      // prisma generate failing at install leaves the app running on a client
      // older than its schema: up, and 500ing the moment a query touches a
      // new column. Worth surfacing, because "the API is fine" is misleading.
      prismaStale: health.body?.prismaGenerate === "stale",
    })
    setChecking(false)
  }, [])

  /** The button. Shows the spinner first, which is a synchronous setState —
   *  fine in an event handler, not in an effect. */
  const check = useCallback(() => { setChecking(true); run() }, [run])

  useEffect(() => {
    let alive = true
    // In a callback rather than the effect body: the linter (rightly) treats
    // a call that reaches setState as a synchronous one.
    ;(async () => { if (alive) await run() })()
    const timer = setInterval(run, REFRESH_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [run])

  const overall = !result
    ? "unknown"
    : result.api === "down" || result.database === "down"
      ? "down"
      : result.jobs === "degraded" || result.prismaStale
        ? "degraded"
        : "ok"

  const label = (state) => t(`serviceStatus.state.${state}`)

  return (
    <>
      <Seo
        title={t("serviceStatus.seoTitle")}
        description={t("serviceStatus.seoDescription")}
        robots="noindex,follow"
        noBreadcrumbs
      />
      <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-20">
        <m.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-h1 font-semibold text-charcoal-80">{t("serviceStatus.title")}</h1>
              <p className="mt-2 flex items-center gap-2 text-body text-charcoal-80/70">
                <span
                  aria-hidden="true"
                  className={`inline-block size-2.5 rounded-full ${(TONE[overall] || TONE.unknown).dot}`}
                />
                {t(`serviceStatus.overall.${overall}`)}
              </p>
            </div>
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 px-3 py-2 text-meta font-medium text-charcoal-80/70 transition-colors hover:border-violet hover:text-violet disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
              {t("serviceStatus.recheck")}
            </button>
          </div>

          <div className="grid gap-3">
            <Tile
              state={result ? result.api : "unknown"}
              title={t("serviceStatus.tiles.api")}
              detail={{
                label: result ? label(result.api) : label("unknown"),
                note: result?.api === "down" ? t("serviceStatus.tiles.apiDown") : t("serviceStatus.tiles.apiNote"),
              }}
            />
            <Tile
              state={result ? result.database : "unknown"}
              title={t("serviceStatus.tiles.database")}
              detail={{
                label: result ? label(result.database) : label("unknown"),
                note: result?.database === "down" ? t("serviceStatus.tiles.databaseDown") : t("serviceStatus.tiles.databaseNote"),
              }}
            />
            <Tile
              state={result ? result.jobs : "unknown"}
              title={t("serviceStatus.tiles.jobs")}
              detail={{
                label: result ? label(result.jobs) : label("unknown"),
                note: result?.jobs === "degraded"
                  ? t("serviceStatus.tiles.jobsLate", { count: result.staleJobs })
                  : t("serviceStatus.tiles.jobsNote"),
              }}
            />
          </div>

          {result?.prismaStale ? (
            <p className="mt-4 rounded-xl bg-amber/10 px-4 py-3 text-meta text-amber-700">
              {t("serviceStatus.prismaStale")}
            </p>
          ) : null}

          <p className="mt-6 text-meta text-charcoal-80/65">
            {result
              ? t("serviceStatus.lastChecked", {
                time: new Intl.DateTimeFormat(locale, {
                  hour: "numeric", minute: "2-digit", second: "2-digit",
                }).format(result.at),
              })
              : t("serviceStatus.checking")}
            {result?.commit ? ` · ${t("serviceStatus.build", { commit: result.commit })}` : ""}
          </p>

          <p className="mt-6 text-meta text-charcoal-80/65">
            {t("serviceStatus.contact")}{" "}
            <Link to="/contact" className="font-medium text-violet underline-offset-2 hover:underline">
              {t("serviceStatus.contactLink")}
            </Link>
          </p>
        </m.div>
      </section>
    </>
  )
}
