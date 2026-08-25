import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Helmet } from "react-helmet-async"
import { m } from "framer-motion"
import {
  ArrowLeft,
  Clock,
  Construction,
  Home,
  LifeBuoy,
  Lock,
  LogIn,
  RefreshCw,
  SearchX,
  ServerCrash,
  ShieldAlert,
  WifiOff,
} from "lucide-react"

import { trackEvent } from "../lib/analytics"

/**
 * ErrorPage — universal error/404 surface.
 *
 * Used by:
 *   • The catch-all "*" route as a 404 (App.jsx).
 *   • Any caller that wants to render a themed error inline. Pass an explicit
 *     `type` to pick the visual + copy; `title`/`message` override the
 *     i18n strings when callers need a context-specific message.
 *
 * The component deliberately does NOT use `useRouteError()` — this app uses
 * the component-based <Routes> pattern, not a data router. Callers that want
 * to surface a real error pass it via the `error` prop.
 *
 * Telemetry:
 *   • Every mount fires `error_page_viewed` to GA via trackEvent().
 *   • If `window.Sentry` is loaded, a captureMessage is also sent.
 *   • A short reference id is generated client-side and shown in the UI so
 *     a user can quote it when contacting support.
 *
 * Online state:
 *   • If `navigator.onLine` flips to false while the page is mounted the
 *     visible type swaps to "OFFLINE" without unmounting; flipping back
 *     restores the original.
 *
 * Indexing:
 *   • Helmet injects `robots="noindex,nofollow,noarchive"` so error states
 *     never make it into the Google index. Title is overridden too.
 */

const fadeUp  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } }
const stagger = { hidden: {},                    show: { transition: { staggerChildren: 0.08 } } }

/* ──────────────────────────────────────────────────────────────────────────
 * Status-tint CONFIGS — Brand v3.1 status-state tokens.
 *
 * `tone` drives icon-tile background + foreground:
 *   amber → caution, recoverable (network, timeout, rate-limit, maintenance)
 *   rose  → genuine failure (forbidden, server error)
 *   azure → action-required (sign-in)
 *   slate → benign / informational (not-found)
 *
 * `actions` is an allowlist of action buttons to render, in display order.
 *   "retry"   → reload the page
 *   "signIn"  → navigate to /login?next=<current>
 *   "back"    → router.history back
 *   "home"    → navigate to /
 *   "contact" → navigate to /contact
 * ────────────────────────────────────────────────────────────────────────── */
const TONES = {
  amber: { tile: "bg-amber/10 text-amber-700",  ring: "ring-amber-100" },
  rose:  { tile: "bg-rose-50 text-rose-700",    ring: "ring-rose-50"   },
  azure: { tile: "bg-azure-pale text-azure-800",ring: "ring-azure-pale" },
  slate: { tile: "bg-slate-100 text-steel-700", ring: "ring-slate-200" },
}

const CONFIGS = {
  NETWORK_ERROR: { icon: WifiOff,      tone: "amber", code: "",    actions: ["retry", "home"] },
  OFFLINE:       { icon: WifiOff,      tone: "amber", code: "",    actions: ["retry", "home"] },
  DB_UNAVAILABLE:{ icon: ServerCrash,  tone: "amber", code: "503", actions: ["retry", "home", "contact"] },
  401:           { icon: LogIn,        tone: "azure", code: "401", actions: ["signIn", "home"] },
  FORBIDDEN:     { icon: Lock,         tone: "rose",  code: "403", actions: ["back", "home", "contact"] },
  403:           { icon: Lock,         tone: "rose",  code: "403", actions: ["back", "home", "contact"] },
  404:           { icon: SearchX,      tone: "slate", code: "404", actions: ["back", "home"] },
  408:           { icon: Clock,        tone: "amber", code: "408", actions: ["retry", "home"] },
  429:           { icon: ShieldAlert,  tone: "amber", code: "429", actions: ["retry", "home", "contact"] },
  500:           { icon: ServerCrash,  tone: "rose",  code: "500", actions: ["retry", "home", "contact"] },
  502:           { icon: ServerCrash,  tone: "amber", code: "502", actions: ["retry", "home"] },
  503:           { icon: Construction, tone: "amber", code: "503", actions: ["retry", "home"] },
  504:           { icon: Clock,        tone: "amber", code: "504", actions: ["retry", "home"] },
  GENERIC:       { icon: ServerCrash,  tone: "rose",  code: "",    actions: ["retry", "home", "contact"] },
}

function getConfig(type) {
  return CONFIGS[type] || CONFIGS[String(type)] || CONFIGS.GENERIC
}

/* ──────────────────────────────────────────────────────────────────────────
 * NotFoundArt — branded illustration for the 404 state only.
 *
 * A small browser-window scene with a magnifier that found nothing: friendly
 * and on-brand (violet/azure/terracotta) where the harsher error types keep
 * the sober icon tile. Pure inline SVG — no asset request, scales crisply,
 * inherits the page's entrance animation from the parent motion wrapper.
 * ────────────────────────────────────────────────────────────────────────── */
function NotFoundArt() {
  return (
    <svg
      viewBox="0 0 200 132"
      className="h-32 w-48 sm:h-36 sm:w-56"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ground shadow */}
      <ellipse cx="100" cy="122" rx="64" ry="7" fill="var(--color-violet)" opacity="0.08" />
      {/* Browser window */}
      <rect x="34" y="14" width="132" height="92" rx="12" fill="#FFFFFF" stroke="var(--color-violet)" strokeOpacity="0.22" strokeWidth="2" />
      <line x1="34" y1="36" x2="166" y2="36" stroke="var(--color-violet)" strokeOpacity="0.14" strokeWidth="2" />
      {/* Traffic dots */}
      <circle cx="48" cy="25" r="3.5" fill="var(--color-terracotta)" />
      <circle cx="60" cy="25" r="3.5" fill="var(--color-mint-light)" />
      <circle cx="72" cy="25" r="3.5" fill="var(--color-azure)" />
      {/* Ghost content lines */}
      <rect x="48" y="48" width="58" height="7" rx="3.5" fill="var(--color-violet)" opacity="0.12" />
      <rect x="48" y="62" width="84" height="7" rx="3.5" fill="var(--color-violet)" opacity="0.08" />
      <rect x="48" y="76" width="42" height="7" rx="3.5" fill="var(--color-violet)" opacity="0.08" />
      {/* Dashed search trail ending nowhere */}
      <path
        d="M52 94 C 78 88, 102 96, 124 84"
        fill="none"
        stroke="var(--color-azure)"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      {/* Magnifier */}
      <circle cx="134" cy="76" r="17" fill="var(--color-azure)" fillOpacity="0.08" stroke="var(--color-azure)" strokeWidth="4" />
      <line x1="146.5" y1="88.5" x2="160" y2="102" stroke="var(--color-azure)" strokeWidth="6" strokeLinecap="round" />
      {/* The missing-page question mark inside the glass */}
      <text
        x="134"
        y="83"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="19"
        fontWeight="700"
        fill="var(--color-violet)"
      >
        ?
      </text>
      {/* Floating accents */}
      <circle cx="22" cy="44" r="5" fill="var(--color-terracotta)" opacity="0.7" />
      <circle cx="180" cy="32" r="4" fill="var(--color-violet)" opacity="0.35" />
      <circle cx="186" cy="78" r="3" fill="var(--color-mint-light)" opacity="0.6" />
      <circle cx="16" cy="86" r="3" fill="var(--color-azure)" opacity="0.45" />
    </svg>
  )
}

/**
 * Short, low-collision reference id: `ERR-<base36 ms>-<6 chars>`.
 * Not a UUID — we just need something a user can read out over the phone
 * and a support agent can grep for in logs.
 */
function makeReferenceId() {
  const ts   = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ERR-${ts}-${rand}`
}

export default function ErrorPage({
  type,
  title,
  message,
  showRetry = true,
  error,
  referenceId,
}) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { t }       = useTranslation("errors")
  const headingRef  = useRef(null)

  // Stable reference id for the lifetime of this mount unless the caller
  // pinned one explicitly (e.g. ErrorBoundary forwarding its own id).
  const [refId] = useState(() => referenceId || makeReferenceId())

  // Mirror navigator.onLine so the surface can re-tone if the user drops
  // their connection while the error page is visible.
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine !== false : true
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener("online",  goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online",  goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  // Resolve the active error type. Going offline mid-view overrides whatever
  // type the caller passed — the network problem is more actionable than
  // whatever the original error was.
  const resolvedType = !isOnline ? "OFFLINE" : (type || "GENERIC")
  const cfg          = getConfig(resolvedType)
  const tone         = TONES[cfg.tone] || TONES.slate
  const Icon         = cfg.icon

  const label = title   || t(`configs.${resolvedType}.title`,   { defaultValue: t("configs.GENERIC.title") })
  const desc  = message || t(`configs.${resolvedType}.message`, { defaultValue: t("configs.GENERIC.message") })
  const code  = cfg.code

  /* ────────────────────────── Telemetry ───────────────────────────── */
  useEffect(() => {
    try {
      trackEvent("error_page_viewed", {
        type:         resolvedType,
        code:         code || null,
        reference_id: refId,
        path:         location.pathname + (location.search || ""),
      })
    } catch { /* analytics is best-effort */ }

    if (typeof window !== "undefined" && window.Sentry?.captureMessage) {
      try {
        window.Sentry.captureMessage(`ErrorPage[${resolvedType}] ${refId}`, {
          level: resolvedType === "404" ? "warning" : "error",
          tags:  { error_type: resolvedType, error_code: code || "n/a" },
          extra: {
            reference_id: refId,
            path:         location.pathname,
            error_message: error?.message,
            error_name:   error?.name,
          },
        })
      } catch { /* swallow telemetry failures */ }
    }

    // Focus the heading so screen readers announce the new state.
    headingRef.current?.focus?.()
  }, [resolvedType, code, refId, location.pathname, location.search, error])

  /* ────────────────────────── Action handlers ──────────────────────── */
  const handleRetry = useCallback(() => {
    if (typeof window !== "undefined") window.location.reload()
  }, [])

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate("/")
    }
  }, [navigate])

  const handleSignIn = useCallback(() => {
    const next = encodeURIComponent(location.pathname + (location.search || ""))
    navigate(`/login?next=${next}`)
  }, [navigate, location.pathname, location.search])

  /* ────────────────────────── Action button factory ────────────────── */
  const ActionButtons = useMemo(() => {
    const buttons = []

    if (cfg.actions.includes("retry") && showRetry) {
      buttons.push(
        <button
          key="retry"
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.20)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("actions.tryAgain")}
        </button>
      )
    }

    if (cfg.actions.includes("signIn")) {
      buttons.push(
        <button
          key="signIn"
          type="button"
          onClick={handleSignIn}
          className="inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.20)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" /> {t("actions.signIn")}
        </button>
      )
    }

    if (cfg.actions.includes("back")) {
      buttons.push(
        <button
          key="back"
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("actions.goBack")}
        </button>
      )
    }

    if (cfg.actions.includes("home")) {
      buttons.push(
        <Link
          key="home"
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/20"
        >
          <Home className="h-4 w-4" aria-hidden="true" /> {t("actions.home")}
        </Link>
      )
    }

    if (cfg.actions.includes("contact")) {
      buttons.push(
        <Link
          key="contact"
          to={`/contact?ref=${encodeURIComponent(refId)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/20"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" /> {t("actions.contactSupport")}
        </Link>
      )
    }

    return buttons
  }, [cfg.actions, showRetry, handleRetry, handleSignIn, handleBack, refId, t])

  const isDev          = !!import.meta?.env?.DEV
  const technicalDump  = error && (error.stack || error.message)

  return (
    <>
      <Helmet>
        <title>{`${label} · Mustapha Ukizuru`}</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className="relative flex min-h-[70vh] items-center justify-center px-4 py-16"
      >
        <m.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex w-full max-w-xl flex-col items-center text-center"
        >
          {/* Visual — friendly illustration for 404, tone-aware icon tile
              for every other (more serious) error type */}
          {resolvedType === "404" ? (
            <m.div variants={fadeUp} aria-hidden="true">
              <NotFoundArt />
            </m.div>
          ) : (
            <m.div
              variants={fadeUp}
              className={`flex h-24 w-24 items-center justify-center rounded-2xl ring-1 ${tone.tile} ${tone.ring} shadow-[0_12px_32px_rgb(var(--color-charcoal-rgb)/0.06)]`}
              aria-hidden="true"
            >
              <Icon className="h-12 w-12" strokeWidth={1.6} />
            </m.div>
          )}

          {/* HTTP code — large, soft, decorative */}
          {code && (
            <m.div
              variants={fadeUp}
              aria-hidden="true"
              className="mt-4 text-display font-bold leading-none text-violet/10 select-none"
            >
              {code}
            </m.div>
          )}

          {/* Title */}
          <m.h1
            ref={headingRef}
            tabIndex={-1}
            variants={fadeUp}
            className="text-section font-bold tracking-tight text-violet outline-none"
            style={{ marginTop: code ? "-1rem" : "1.5rem" }}
          >
            {label}
          </m.h1>

          {/* Message */}
          <m.p
            variants={fadeUp}
            className="mt-3 max-w-md text-body leading-7 text-charcoal-80/65"
          >
            {desc}
          </m.p>

          {/* Actions */}
          <m.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {ActionButtons}
          </m.div>

          {/* Reference id + support hint — single, calm line */}
          <m.div variants={fadeUp} className="mt-8 max-w-md space-y-2">
            <p className="text-micro text-charcoal-80/65">
              {t("reference.label")}{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-steel-700">
                {refId}
              </code>
            </p>
            <p className="text-micro text-charcoal-80/65">
              {t("support.prefix")}{" "}
              <Link
                to={`/contact?ref=${encodeURIComponent(refId)}`}
                className="text-violet hover:underline"
              >
                {t("support.linkText")}
              </Link>
              {t("support.suffix")}
            </p>
          </m.div>

          {/* Dev-only technical detail. Production users never see this. */}
          {isDev && technicalDump && (
            <m.details
              variants={fadeUp}
              className="mt-8 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-steel-700"
            >
              <summary className="cursor-pointer font-semibold uppercase tracking-[0.14em] text-steel-700">
                {t("technicalDetail.label")}
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-steel-700">
                {String(technicalDump)}
              </pre>
            </m.details>
          )}
        </m.div>
      </div>
    </>
  )
}
