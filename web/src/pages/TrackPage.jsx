/* ════════════════════════════════════════════════════════════════════════
   TrackPage.jsx · /track and /track/:code · T5-5
   ────────────────────────────────────────────────────────────────────────
   "Where is my project?", answered without a login.

   A client who has been sent a tracking code should be able to type it in
   and see progress, the way they would with a parcel. That is the whole
   idea; the discipline is in what it does NOT show. No project name, no
   amounts, no file names, no portal token — a code can be forwarded, and
   the surface it opens has to be safe to forward. The contract is
   docs/decisions/0006-tracking-code-public-surface.md and the server is
   what enforces it; this page renders only what it is handed.

   Unknown, malformed and expired codes all answer alike, so this page
   cannot tell a visitor which of the three it was either. That is
   deliberate: a distinguishable "expired" would confirm the code was once
   real.
   ════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import {
  Search, PackageSearch, ArrowRight, ArrowLeft, FileWarning, LayoutDashboard,
  KeyRound, Loader2, CheckCircle2, Circle, CircleDot, Copy, Check,
  CalendarClock, TriangleAlert, Clock3, Mail,
} from "lucide-react"

import { LocalizedLink as Link } from "../components/LocalizedLink"
import useLocalizedNavigate from "../hooks/useLocalizedNavigate"
import { requestPortalPinByCode, verifyPortalPinByCode } from "../services/portalService"
import Seo from "../components/seo/Seo"
import { Button, Input, InlineBanner } from "../components/ui"
import ProjectTimeline from "../components/projects/ProjectTimeline"
import useLazyNamespace from "../hooks/useLazyNamespace"
import {
  fetchProjectByCode,
  formatTrackingCode,
  isCompleteTrackingCode,
} from "../services/trackingService"

const EASE = [0.22, 1, 0.36, 1]

/**
 * The phase strip.
 *
 * `cancelled` is not a phase — it is the strip not applying — so it is
 * handled as its own state rather than given a fifth dot nobody wants to
 * see their project reach.
 */
const PHASES = ["planning", "in_progress", "review", "completed"]

function phaseIndex(status) {
  const i = PHASES.indexOf(status)
  return i === -1 ? 0 : i
}

/* ── the lookup form, shared by both routes ─────────────────────────── */

function CodeForm({ initial = "", autoFocus = false, busy = false, onSubmit }) {
  const { t } = useTranslation("dashboard")
  const [value, setValue] = useState(initial)
  const complete = isCompleteTrackingCode(value)

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (complete && !busy) onSubmit(value)
      }}
    >
      <Input
        // inputClass, not className: on this component className styles the
        // wrapping div and the field keeps its own default.
        //
        // Monospace and wide-tracked, because the code is read off a printed
        // invoice one character at a time and a proportional font makes that
        // harder than it needs to be.
        inputClass="font-mono tracking-[0.18em] uppercase"
        className="flex-1"
        value={value}
        autoFocus={autoFocus}
        // Hyphens are inserted as the reader types, so what is on screen
        // matches what is on the invoice at every keystroke.
        onChange={(e) => setValue(formatTrackingCode(e.target.value))}
        placeholder={t("track.placeholder")}
        aria-label={t("track.inputLabel")}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
      />
      <Button type="submit" disabled={!complete || busy} className="shrink-0">
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="size-4" aria-hidden="true" />
        )}
        {t("track.submit")}
      </Button>
    </form>
  )
}

/**
 * The code, with a copy button.
 *
 * A client who lands here from a forwarded link usually wants to send the
 * code on to somebody else, and reading eight characters off a screen to
 * retype them is exactly where a confusable-glyph mistake happens — which is
 * the reason the alphabet excludes both halves of every confusable pair in
 * the first place.
 */
function CopyableCode({ code }) {
  const { t } = useTranslation("dashboard")
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard permission (an insecure origin, an old browser). The
      // code is on screen and selectable, so there is nothing to report.
    }
  }

  return (
    <div className="mb-1 flex flex-wrap items-center gap-3">
      <h1 className="font-mono text-h2 font-semibold tracking-[0.12em] text-charcoal-80">
        {code}
      </h1>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 px-2.5 py-1.5 text-meta font-medium text-charcoal-80/70 transition-colors hover:border-violet hover:text-violet"
      >
        {copied ? (
          <Check className="size-4 text-mint-700" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? t("track.copied") : t("track.copy")}
      </button>
    </div>
  )
}

/**
 * On time, or not (T5-12).
 *
 * The three words a carrier uses, with the next expected date beside them.
 * "In progress, 40%" answers where the work is; this answers the question a
 * client actually has, which is whether it will be ready when they were told.
 *
 * on_track is deliberately quiet. A green badge shouting ON TRACK on every
 * project teaches a reader to stop seeing the strip, and then to miss the day
 * it says something else.
 */
const HEALTH_TONE = {
  on_track: { icon: CalendarClock, chip: "bg-mint/15 text-mint-700 ring-mint/25" },
  at_risk: { icon: Clock3, chip: "bg-amber/10 text-amber-700 ring-amber/25" },
  late: { icon: TriangleAlert, chip: "bg-rose/10 text-rose-700 ring-rose/25" },
}

function HealthPill({ health, expectedAt, lateCount, fmtDate }) {
  const { t } = useTranslation("dashboard")
  const tone = HEALTH_TONE[health]
  if (!tone) return null
  const Icon = tone.icon

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-semibold ring-1 ${tone.chip}`}>
        <Icon className="size-4" aria-hidden="true" />
        {health === "late" && lateCount > 0
          ? t("track.health.lateCount", { count: lateCount })
          : t(`track.health.${health}`)}
      </span>
      {expectedAt ? (
        <span className="text-meta text-charcoal-80/70">
          {t("track.health.expected", { date: fmtDate.format(new Date(expectedAt)) })}
        </span>
      ) : null}
    </div>
  )
}

/* ── the result ───────────────────────────────────────────── */

function PhaseStrip({ status, percent }) {
  const { t } = useTranslation("dashboard")
  const reduced = useReducedMotion()

  if (status === "cancelled") {
    return (
      <InlineBanner tone="warning" className="mb-6">
        {t("track.cancelled")}
      </InlineBanner>
    )
  }

  const current = phaseIndex(status)
  return (
    <div className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {PHASES.map((phase, i) => {
          const done = i < current || status === "completed"
          const active = i === current && status !== "completed"
          const Icon = done ? CheckCircle2 : active ? CircleDot : Circle
          return (
            <li key={phase} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-medium ${
                  done
                    ? "bg-mint/15 text-mint-700"
                    : active
                      ? "bg-violet-pale text-violet"
                      : "bg-charcoal-80/5 text-charcoal-80/65"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`track.phase.${phase}`)}
              </span>
              {i < PHASES.length - 1 ? (
                <span aria-hidden="true" className="hidden h-px w-6 bg-charcoal-80/15 sm:block" />
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-meta font-medium text-charcoal-80/70">{t("track.progress")}</p>
          <p className="text-meta font-semibold tabular-nums text-charcoal-80">{percent}%</p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-charcoal-80/10"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("track.progress")}
        >
          <m.span
            className="block h-full rounded-full bg-violet"
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * The second door (T5-8).
 *
 * A client who has the code but not the emailed link had nowhere to go from
 * this page — asking for a new link is a message to a person, which is the
 * friction the portal exists to remove. This is the same PIN handshake,
 * inline, without leaving the page.
 *
 * WHAT HOLDING THE CODE BUYS YOU, WHICH IS ALMOST NOTHING
 *
 * A PIN sent to the address on the PROJECT — an inbox the holder of a
 * forwarded code very likely does not control. The code stays what ADR 0006
 * says it is: shareable, and not a credential.
 */
function PortalDoor({ code }) {
  const { t } = useTranslation("dashboard")
  const navigate = useLocalizedNavigate()
  const [stage, setStage] = useState("idle")   // idle | sent | verifying
  const [hint, setHint] = useState(null)
  // T5-17 · optional, and left blank by the client the project belongs to.
  // Typing an address only matters for the OTHER people on a project — the
  // IT person who has the code and whose inbox is not the one on the account.
  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    setError("")
    try {
      const data = await requestPortalPinByCode(code, email.trim() || undefined)
      setHint(data?.emailHint || null)
      setStage("sent")
    } catch (e) {
      setError(e?.message || t("track.door.failed"))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await verifyPortalPinByCode(code, pin)
      // The cookie is set; the portal reads it and needs no token in the URL.
      navigate("/portal")
    } catch (e) {
      setError(e?.message || t("track.door.pinFailed"))
    } finally {
      setBusy(false)
    }
  }

  if (stage === "idle") {
    return (
      <div className="mt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            type="email"
            className="flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label={t("track.door.emailLabel")}
            placeholder={t("track.door.emailPlaceholder")}
            autoComplete="email"
          />
          <Button size="sm" variant="secondary" disabled={busy} onClick={send} className="shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
            {t("track.door.sendPin")}
          </Button>
        </div>
        {/* Says what happens to an address that is not on the project, so
            nobody is left wondering why no PIN arrived. */}
        <p className="mt-2 text-micro text-charcoal-80/65">{t("track.door.emailHint")}</p>
        {error ? <p className="mt-2 text-meta text-rose-700">{error}</p> : null}
      </div>
    )
  }

  return (
    <form className="mt-3" onSubmit={verify}>
      <p className="mb-2 text-meta text-charcoal-80/70">
        {hint ? t("track.door.sentTo", { email: hint }) : t("track.door.sent")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          inputClass="font-mono tracking-[0.3em] text-center"
          className="flex-1"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          aria-label={t("track.door.pinLabel")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
        />
        <Button type="submit" size="sm" disabled={busy || pin.length !== 6} className="shrink-0">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t("track.door.open")}
        </Button>
      </div>
      {error ? <p className="mt-2 text-meta text-rose-700">{error}</p> : null}
    </form>
  )
}

export default function TrackPage() {
  const { t, i18n } = useTranslation("dashboard")
  const navigate = useLocalizedNavigate()
  const { code } = useParams()
  const reduced = useReducedMotion()

  // One piece of state, stamped with the code it belongs to, and the view
  // state DERIVED from it. Storing "loading" separately meant setting it
  // synchronously inside the effect on every code change — a cascading
  // render, and a window in which a new code briefly showed the previous
  // code's result.
  const [result, setResult] = useState(null)
  // Boolean(result) FIRST. Optional chaining alone made this true on the
  // bare /track: `undefined === undefined` for a null result and an absent
  // code, so the next line read .state off null, threw, and the error
  // boundary rendered the whole landing page as nothing. e2e/track.spec.js
  // is what found it.
  const fresh = Boolean(result) && result.code === code
  const state = fresh ? result.state : code ? "loading" : "idle"
  const project = fresh ? result.project : null
  const resultRef = useRef(null)

  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"
  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }),
    [locale],
  )

  // T5-23 · which clock these times are on.
  //
  // Intl already renders in the READER's zone, which is the right default —
  // "3pm" should mean 3pm where they are. What was missing is saying so: a
  // timeline of bare times invites the reader to assume theirs and the
  // operator to assume Mexico City, and nobody notices the difference until
  // a due date lands on the wrong day.
  //
  // Falls back to America/Mexico_City when the browser will not say, which is
  // the studio's own zone and therefore the one the dates were set in.
  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City"
    } catch {
      return "America/Mexico_City"
    }
  }, [])

  useEffect(() => {
    if (!code) return undefined
    let alive = true
    ;(async () => {
      try {
        const data = await fetchProjectByCode(code)
        if (alive) setResult({ code, state: data ? "found" : "missing", project: data })
      } catch {
        if (alive) setResult({ code, state: "error", project: null })
      }
    })()
    return () => { alive = false }
  }, [code])

  // Navigating to the code puts it in the address bar, which is what makes
  // the result reloadable and shareable — the thing a client will do with it.
  const lookup = useCallback((value) => {
    navigate(`/track/${encodeURIComponent(value)}`)
  }, [navigate])

  // T5-5 · `dashboard` is route-scoped now (LAZY_NAMESPACES in
  // i18n/resources.js): 50 KB per language that no public page reads. It is
  // fetched here and this tree waits for it, because the project does not use
  // Suspense for translations and rendering early paints raw keys.
  //
  // The guard sits AFTER every hook, not at the top: an early return above
  // them would change the hook order between renders.
  const i18nReady = useLazyNamespace("dashboard")
  if (!i18nReady) return null

  const seo = (
    <Seo
      title={t("track.seoTitle")}
      description={t("track.seoDescription")}
      // Never indexed. A code in a crawled URL would put a client's progress
      // into a search result, and /track/:code is exactly such a URL.
      robots="noindex,nofollow"
      noBreadcrumbs
    />
  )

  /* ── the landing form ───────────────────────────────────────────── */
  if (!code) {
    return (
      <>
        {seo}
        <section className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
          <m.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <PackageSearch className="mb-4 size-10 text-violet" aria-hidden="true" />
            <h1 className="text-h1 font-semibold text-charcoal-80">{t("track.title")}</h1>
            <p className="mt-3 text-body text-charcoal-80/70">{t("track.intro")}</p>

            <div className="mt-8">
              <CodeForm autoFocus onSubmit={lookup} />
              <p className="mt-3 text-meta text-charcoal-80/65">{t("track.hint")}</p>
            </div>

            <div className="mt-10 rounded-xl border border-charcoal-80/10 bg-white p-5">
              <p className="text-body font-medium text-charcoal-80">{t("track.moreTitle")}</p>
              <p className="mt-1 text-meta text-charcoal-80/70">{t("track.moreBody")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/dashboard/projects"
                  className="inline-flex items-center gap-1.5 text-meta font-medium text-violet underline-offset-2 hover:underline"
                >
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                  {t("track.openDashboard")}
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1.5 text-meta font-medium text-charcoal-80/70 underline-offset-2 hover:underline"
                >
                  {t("track.askUs")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </m.div>
        </section>
      </>
    )
  }

  /* ── a code was given ───────────────────────────────────────────── */
  return (
    <>
      {seo}
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16" ref={resultRef}>
        <Link
          to="/track"
          className="mb-6 inline-flex items-center gap-1.5 text-meta font-medium text-charcoal-80/70 underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("track.anotherCode")}
        </Link>

        {state === "loading" ? (
          <div className="flex items-center gap-3 py-16 text-body text-charcoal-80/70">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {t("track.loading")}
          </div>
        ) : null}

        {state === "error" ? (
          <>
            <InlineBanner tone="danger" className="mb-6">{t("track.error")}</InlineBanner>
            <CodeForm initial={code} onSubmit={lookup} />
          </>
        ) : null}

        {state === "missing" ? (
          <>
            <h1 className="text-h2 font-semibold text-charcoal-80">{t("track.missingTitle")}</h1>
            {/* One message for unknown, malformed and expired alike — the
                server does not distinguish them and neither may this page. */}
            <p className="mt-2 mb-6 text-body text-charcoal-80/70">{t("track.missingBody")}</p>
            <CodeForm initial={code} onSubmit={lookup} />
          </>
        ) : null}

        {state === "found" && project ? (
          <m.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <p className="text-meta font-medium uppercase tracking-wide text-charcoal-80/65">
              {t("track.reference")}
            </p>
            <CopyableCode code={project.reference} />
            <p className="mb-8 text-meta text-charcoal-80/70">
              {project.startDate
                ? t("track.startedOn", { date: fmtDate.format(new Date(project.startDate)) })
                : t("track.notStarted")}
              {project.dueDate
                ? ` · ${t("track.dueOn", { date: fmtDate.format(new Date(project.dueDate)) })}`
                : ""}
            </p>

            <PhaseStrip status={project.status} percent={project.percentComplete} />

            {/* Whether it will be ready when we said, which is the question
                the phase strip above does not answer. */}
            <HealthPill
              health={project.health}
              expectedAt={project.expectedAt}
              lateCount={project.lateCount}
              fmtDate={fmtDate}
            />

            {/* A count, never the documents themselves: which documents is
                not an anonymous surface's business (ADR 0006). Acting on it
                needs the portal or the dashboard, and both ask who you are. */}
            {project.openRequestCount > 0 ? (
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber/25 bg-amber/10 p-5">
                <div className="flex items-start gap-3">
                  <FileWarning className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
                  <div>
                    <p className="text-body font-medium text-charcoal-80">
                      {t("track.waitingOnYou", { count: project.openRequestCount })}
                    </p>
                    <p className="mt-0.5 text-meta text-charcoal-80/70">{t("track.waitingBody")}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {project.milestones?.length ? (
              <section className="mb-8">
                <h2 className="mb-3 text-h4 font-semibold text-charcoal-80">{t("track.milestones")}</h2>
                <ul className="space-y-2">
                  {project.milestones.map((milestone, i) => {
                    const done = milestone.status === "completed" || milestone.completedAt
                    return (
                      <li
                        key={`${milestone.title}-${i}`}
                        className="flex items-center gap-3 rounded-lg border border-charcoal-80/10 bg-white px-4 py-3"
                      >
                        {done ? (
                          <CheckCircle2 className="size-4 shrink-0 text-mint-700" aria-hidden="true" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-charcoal-80/65" aria-hidden="true" />
                        )}
                        <span className={`text-body ${done ? "text-charcoal-80" : "text-charcoal-80/70"}`}>
                          {milestone.title}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <section className="mb-10">
              <h2 className="mb-4 text-h4 font-semibold text-charcoal-80">{t("track.activity")}</h2>
              <ProjectTimeline events={project.events} />
            </section>

            {/* Said once, under the timeline rather than beside every
                timestamp — repeating it on each row is noise, and omitting
                it entirely is the trap. */}
            <p className="mb-8 text-meta text-charcoal-80/65">
              {t("track.timezone", { zone: timeZone.replace(/_/g, " ") })}
            </p>

            {/* The two doors. Destinations, not credentials: the response
                carries no portal token, so signing in is what unlocks
                anything actionable. */}
            <section className="grid gap-4 sm:grid-cols-2">
              {/* T5-8 · not a link any more. The client already HAS the code
                  — sending them to /portal to be asked for a link they do
                  not have was the dead end this replaces. */}
              <div className="rounded-xl border border-charcoal-80/10 bg-white p-5">
                <KeyRound className="mb-3 size-5 text-violet" aria-hidden="true" />
                <p className="text-body font-medium text-charcoal-80">{t("track.doorPortal")}</p>
                <p className="mt-1 text-meta text-charcoal-80/70">{t("track.doorPortalBody")}</p>
                <PortalDoor code={project.reference} />
              </div>
              <Link
                to={project.links?.dashboard || "/dashboard/projects"}
                className="group rounded-xl border border-charcoal-80/10 bg-white p-5 transition-colors hover:border-violet"
              >
                <LayoutDashboard className="mb-3 size-5 text-violet" aria-hidden="true" />
                <p className="text-body font-medium text-charcoal-80">{t("track.doorDashboard")}</p>
                <p className="mt-1 text-meta text-charcoal-80/70">{t("track.doorDashboardBody")}</p>
              </Link>
            </section>
          </m.div>
        ) : null}
      </section>
    </>
  )
}
