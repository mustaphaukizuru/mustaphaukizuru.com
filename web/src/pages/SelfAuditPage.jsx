import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "framer-motion"
import {
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react"

import Seo from "../components/seo/Seo"
import { trackEvent } from "../lib/analytics"

/**
 * SelfAuditPage · /self-audit
 *
 * Hosts the digital + technology self-audit. The audit itself is a self-
 * contained static document at /diagnostic (one file, ~1200 lines of
 * vanilla HTML/CSS/JS, written separately from the React SPA so it can
 * be opened directly or printed without bundling overhead). This page
 * wraps that document in a React shell that adds:
 *
 *   · SEO meta (title, description, og:image, canonical, noindex off
 *     so it shows up in search)
 *   · A brand-consistent intro band above the iframe so the embed
 *     doesn't look like a foreign object pasted into the SPA
 *   · A postMessage listener that forwards every diagnostic_* event
 *     fired inside the iframe to trackEvent() — so the business can
 *     see, per visitor:
 *       · which audit step they reached
 *       · which audience segment they picked
 *       · how each item was scored
 *       · what their final tier + service shortlist was
 *       · which CTA they clicked (discovery call, proposal, single
 *         service, or email-my-report)
 *   · A bottom CTA strip with paths out to /services and /contact
 *
 * Why an iframe instead of a JSX port: the audit is ~1200 lines of
 * vanilla JS with persistent localStorage state, audience-conditional
 * sections, score normalisation, and a printable layout. A JSX port
 * would take 2-3 days and risk regressions; iframe embedding ships
 * the same UX today and lets us add analytics without rewriting.
 */

const PAGE_TITLE = "Free Digital & Technology Self-Audit · 15 min"
const PAGE_DESC  =
  "A 15-minute capability assessment across six dimensions of your digital presence and technology operations. Score yourself, see your maturity tier, and walk away with a prioritized shortlist drawn from an 82-service catalog."

// `message.data.source` filter. The static page sets exactly this
// string when it postMessages — anything else gets ignored so we
// don't pollute analytics with cross-origin chrome traffic.
const MESSAGE_SOURCE = "ukz-self-audit"

export default function SelfAuditPage() {
  const { t } = useTranslation("services")
  const reduce = useReducedMotion()
  const iframeRef = useRef(null)
  const [iframeReady, setIframeReady] = useState(false)

  /* ────────────────────────── Telemetry on mount ────────────────────── */
  useEffect(() => {
    try {
      trackEvent("self_audit_page_viewed", {
        path: typeof window !== "undefined" ? window.location.pathname : "/self-audit",
      })
    } catch { /* analytics is best-effort */ }
  }, [])

  /* ─────── postMessage listener · forwards diagnostic_* events ──────── */
  useEffect(() => {
    if (typeof window === "undefined") return undefined

    function onMessage(e) {
      // Same-origin guard: the iframe is hosted on /diagnostic of this
      // very domain, so its messages must come from window.location.origin.
      // Anything from another origin is either chrome extension noise
      // (MetaMask, Honey) or a malicious cross-origin frame trying to
      // ping us — drop it.
      if (e.origin !== window.location.origin) return
      if (!e.data || e.data.source !== MESSAGE_SOURCE) return

      const { event, props } = e.data
      if (!event) return

      // Forward to GA / Sentry / future backend telemetry. Prefix with
      // `self_audit_` so analytics dashboards can pivot on this one
      // class of events (separate from store / checkout / blog events).
      try {
        trackEvent(`self_audit_${event}`, {
          ...(props || {}),
          // Echo so dashboard filters by `embedded:true` if needed.
          embedded: true,
        })
      } catch { /* swallow — analytics is best-effort */ }

      // Sentry breadcrumb-style: helpful when correlating an error
      // report with audit progression. Skipped when Sentry isn't loaded.
      if (typeof window.Sentry?.addBreadcrumb === "function") {
        try {
          window.Sentry.addBreadcrumb({
            category: "self-audit",
            message:  event,
            data:     props || {},
            level:    "info",
          })
        } catch { /* noop */ }
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  /* ────────────────────────── Motion variants ───────────────────────── */
  const fadeUp = reduce
    ? {}
    : {
        initial:    { opacity: 0, y: 16 },
        animate:    { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <>
      <Seo
        title={PAGE_TITLE}
        description={PAGE_DESC}
        canonical="/self-audit"
        keywords={[
          "free digital audit",
          "technology self-audit",
          "IT maturity assessment",
          "school IT audit",
          "SMB technology assessment",
          "digital transformation roadmap",
        ]}
      />

      {/* ── Intro band ─────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden bg-mist"
        aria-label={t("selfAudit.heroLabel", { defaultValue: "Self-audit intro" })}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(at 14% 0%, rgba(93,63,211,0.10) 0px, transparent 50%), " +
              "radial-gradient(at 90% 0%, rgba(2,132,199,0.07) 0px, transparent 55%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-14 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8">
          <motion.div {...fadeUp} className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-deep">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t("selfAudit.eyebrow", { defaultValue: "Free · 15 minutes · No sign-up needed" })}
            </span>

            <h1 className="mt-4 font-display text-[clamp(28px,4.5vw,44px)] font-extrabold leading-tight tracking-tight text-charcoal text-balance">
              {t("selfAudit.headline", {
                defaultValue: "Find the technology gaps holding your organisation back.",
              })}
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-charcoal-80/70 sm:text-[16px]">
              {t("selfAudit.subhead", {
                defaultValue:
                  "Score yourself across six dimensions of digital and technology maturity. Get a tier, a prioritised shortlist of services, and a one-page summary you can print or email — all without leaving this page.",
              })}
            </p>

            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-charcoal-80/70">
              <li className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-violet" aria-hidden="true" />
                {t("selfAudit.feat.duration", { defaultValue: "~15 minutes" })}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-violet" aria-hidden="true" />
                {t("selfAudit.feat.coverage", { defaultValue: "6 dimensions · 82 services" })}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-violet" aria-hidden="true" />
                {t("selfAudit.feat.privacy", { defaultValue: "No data stored unless you email it to yourself" })}
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ── Embedded audit ────────────────────────────────────────────
          The iframe sandboxes the static document so its localStorage,
          CSS, and JS can't interact with the SPA. `allow-same-origin`
          is required for the static page to read its own localStorage
          (saved progress); `allow-scripts` lets its event handlers
          run. `allow-popups` lets the email-my-report button open a
          mailto: link if the visitor chose that path. We deliberately
          don't allow `allow-top-navigation` — the iframe must never
          redirect the host page. ─────────────────────────────────── */}
      <section
        aria-label={t("selfAudit.iframeLabel", { defaultValue: "Self-audit interactive tool" })}
        className="relative mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 lg:px-8"
      >
        {!iframeReady && (
          <div
            aria-hidden="true"
            className="absolute inset-x-4 top-0 flex h-[80vh] items-center justify-center rounded-2xl bg-white text-violet sm:inset-x-6 lg:inset-x-8"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <ClipboardCheck className="h-8 w-8 animate-pulse" aria-hidden="true" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
                {t("selfAudit.loading", { defaultValue: "Preparing your audit" })}
              </p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title={t("selfAudit.iframeTitle", { defaultValue: "Digital & Technology Self-Audit" })}
          src="/diagnostic/"
          // Min-height covers the audit's first paint; the page is tall
          // (hero + audience picker + 6 sections) so we lean generous.
          // On mobile, 100vh - 64px leaves room for the host nav.
          className="block h-[calc(100vh-64px)] min-h-[820px] w-full overflow-hidden rounded-2xl border border-charcoal-80/8 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.20)] sm:min-h-[900px]"
          loading="lazy"
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          onLoad={() => setIframeReady(true)}
        />
      </section>

      {/* ── Bottom path-out CTAs ────────────────────────────────────── */}
      <section
        aria-label={t("selfAudit.exitLabel", { defaultValue: "Next steps after the audit" })}
        className="border-t border-charcoal-80/8 bg-mist py-12 sm:py-16"
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            <Link
              to="/services"
              onClick={() => trackEvent("self_audit_exit_clicked", { target: "services" })}
              className="group relative flex flex-col gap-2 rounded-2xl border border-charcoal-80/10 bg-white p-6 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_18px_46px_-16px_rgba(93,63,211,0.20)]"
            >
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-violet">
                {t("selfAudit.exitServicesEyebrow", { defaultValue: "Browse the catalogue" })}
              </span>
              <h3 className="text-[18px] font-bold text-charcoal">
                {t("selfAudit.exitServicesTitle", { defaultValue: "See the 82 services your shortlist comes from" })}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-charcoal-80/65">
                {t("selfAudit.exitServicesBody", {
                  defaultValue: "Every audit item maps to an atomic service with a scope, timeline, and price band.",
                })}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition group-hover:gap-2">
                {t("selfAudit.exitServicesCta", { defaultValue: "Open services" })}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>

            <Link
              to="/contact"
              onClick={() => trackEvent("self_audit_exit_clicked", { target: "contact" })}
              className="group relative flex flex-col gap-2 rounded-2xl border border-violet/20 bg-violet/[0.04] p-6 transition hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-[0_18px_46px_-16px_rgba(93,63,211,0.22)]"
            >
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-violet">
                {t("selfAudit.exitContactEyebrow", { defaultValue: "Talk it through" })}
              </span>
              <h3 className="text-[18px] font-bold text-charcoal">
                {t("selfAudit.exitContactTitle", { defaultValue: "Book a free 30-min discovery call" })}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-charcoal-80/65">
                {t("selfAudit.exitContactBody", {
                  defaultValue: "Walk through your audit results with me — no sales pitch, just an honest read on what to prioritise.",
                })}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition group-hover:gap-2">
                {t("selfAudit.exitContactCta", { defaultValue: "Book a call" })}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
