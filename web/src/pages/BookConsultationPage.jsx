// ─────────────────────────────────────────────────────────────────────────────
// BookConsultationPage.jsx — public /book and /book/:serviceSlug
//
// When :serviceSlug is supplied, fetches that service's metadata (title, slug,
// id, booking policy) and seeds the BookingCalendar with it. Without a slug,
// the calendar runs in "generic discovery call" mode against the default host.
//
// I18N · Phase 117 — strings flipped to t() under the `contact` namespace
// (book.* sub-tree). Service titles returned by the API stay verbatim —
// the bilingual schema work in Phase 4B already handles those server-side.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import {
  Calendar, Clock, Globe2, ShieldCheck, ArrowRight, Sparkles,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import BookingCalendar from "../components/booking/BookingCalendar"
import { apiGet } from "../lib/api"

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }

function HeroBadge() {
  const { t } = useTranslation("contact")
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">
      <Sparkles className="h-3 w-3" />
      {t("book.badge")}
    </span>
  )
}

function TrustItem({ icon: Icon, title, body }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-violet">{title}</div>
        <div className="mt-0.5 text-[12px] text-charcoal/70">{body}</div>
      </div>
    </div>
  )
}

export default function BookConsultationPage() {
  const { t } = useTranslation("contact")
  const { serviceSlug } = useParams()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(Boolean(serviceSlug))
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!serviceSlug) { setService(null); setLoading(false); return }
    let aborted = false
    async function load() {
      try {
        setLoading(true); setErrorMessage("")
        // Reuses existing /api/services or /api/products endpoint pattern;
        // service detail is intentionally optional — booking still works without it.
        const r = await apiGet(`/api/services/${encodeURIComponent(serviceSlug)}`).catch(() => null)
        if (aborted) return
        if (r?.data) setService(r.data)
      } catch (e) {
        if (!aborted) setErrorMessage(e?.message || "")
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [serviceSlug])

  // Service title is server-driven (already bilingual via pickLocale in
  // serviceService) — fall back to the i18n default when unauthenticated /
  // discovery-mode is in play.
  const title = service?.title || t("book.defaultTitle")
  const subtitle = service
    ? t("book.subtitleWithService")
    : t("book.subtitleGeneric")

  // Trust column · keyed array so the order is stable and the strings
  // come from the namespace.
  const trustItems = [
    { icon: Calendar,    title: t("book.trust.realtimeTitle"),     body: t("book.trust.realtimeBody") },
    { icon: Globe2,      title: t("book.trust.timezoneTitle"),     body: t("book.trust.timezoneBody") },
    { icon: Clock,       title: t("book.trust.cancelTitle"),       body: t("book.trust.cancelBody") },
    { icon: ShieldCheck, title: t("book.trust.confidentialTitle"), body: t("book.trust.confidentialBody") },
  ]

  return (
    <section className="bg-mist">
      <Seo
        title={service ? t("book.seoBookFmt", { title: service.title }) : t("book.seoDefault")}
        description={subtitle}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-8 sm:mb-10">
          <motion.div variants={fadeUp}>
            <HeroBadge />
          </motion.div>
          <motion.h1 variants={fadeUp} className="mt-3 text-[28px] font-bold tracking-tight text-violet sm:text-[36px] lg:text-[42px]">
            {title}
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-3 max-w-2xl text-[14px] text-charcoal/75 sm:text-[15px]">
            {subtitle}
          </motion.p>
          {!service && (
            <motion.div variants={fadeUp} className="mt-4">
              <Link
                to="/services"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition hover:underline"
              >
                {t("book.browseAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          )}
          {errorMessage && (
            <motion.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/10 px-3 py-2 text-[12px] text-amber-700">
              {errorMessage}
            </motion.div>
          )}
        </motion.div>

        {/* ── 2-column: calendar + trust panel ──────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">

          {/* Calendar */}
          <div className="min-w-0">
            {loading ? (
              <div className="h-[520px] animate-pulse rounded-xl border border-charcoal/10 bg-white shadow-[0_12px_35px_rgba(93,63,211,0.06)]" />
            ) : (
              <BookingCalendar
                serviceId={service?.id || null}
                serviceSlug={serviceSlug || null}
                serviceTitle={service?.title || t("book.discoveryCall")}
                durationMin={service?.bookingDurationMin || 30}
                policy={{
                  minNoticeHours: service?.bookingMinNoticeHours ?? 24,
                  maxAdvanceDays: service?.bookingMaxAdvanceDays ?? 60,
                }}
              />
            )}
          </div>

          {/* Trust column · i18n-keyed so order is stable and the labels
              come from the namespace. */}
          <motion.aside variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {trustItems.map(({ icon, title: tTitle, body }) => (
              <motion.div key={tTitle} variants={fadeUp}>
                <TrustItem icon={icon} title={tTitle} body={body} />
              </motion.div>
            ))}

            <motion.div variants={fadeUp} className="rounded-xl border border-violet/15 bg-gradient-to-br from-violet-ghost to-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">{t("book.expect.title")}</div>
              <ul className="mt-3 space-y-2.5 text-[12.5px] text-charcoal/85">
                <li>• {t("book.expect.item1")}</li>
                <li>• {t("book.expect.item2")}</li>
                <li>• {t("book.expect.item3")}</li>
              </ul>
            </motion.div>
          </motion.aside>
        </div>
      </div>
    </section>
  )
}
