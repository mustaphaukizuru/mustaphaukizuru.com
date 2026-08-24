// ─────────────────────────────────────────────────────────────────────────────
// BookConsultationPage.jsx — public /book, /book/:serviceSlug, /book?service=<slug>
//
// Funnel entry point (roadmap step 25). `?service=<slug>` (or the legacy
// path param) may be a category slug, an offering slug, or a legacy SKU id;
// it is resolved against the static catalogue to preselect the category and
// show the offering the visitor came from. The matching `Service` DB row
// (same slug as the category) is fetched for `serviceId` so the booking
// carries the relationship into the dashboard (ClientProject shell is
// created server-side on success).
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m } from "framer-motion"
import {
  Calendar, Clock, Globe2, ShieldCheck, ArrowRight, Sparkles, Tag,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import BookingCalendar from "../components/booking/BookingCalendar"
import { apiGet } from "../lib/api"
import { getCategoryBySlug, getOfferingBySlug } from "../data/servicesCatalogue"
import { pick, useCatalogueLang } from "../components/services/localize"
import avatarTerracottaWebp from "../assets/avatar/avatar-terracotta.webp"
import avatarTerracottaPng from "../assets/avatar/avatar-terracotta.png"

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

/* HostCard · "who you'll meet" trust block — real photo at the conversion point. */
function HostCard() {
  const { t } = useTranslation("contact")
  return (
    <div className="overflow-hidden rounded-xl border border-violet/15 bg-white shadow-[0_12px_35px_rgb(var(--color-violet-rgb)/0.08)]">
      <div className="h-16 bg-gradient-to-r from-violet via-violet-deep to-charcoal-80" aria-hidden="true" />
      <div className="-mt-12 flex justify-center">
        <picture>
          <source srcSet={avatarTerracottaWebp} type="image/webp" />
          <img
            src={avatarTerracottaPng}
            alt={t("book.host.photoAlt")}
            width="96"
            height="96"
            className="h-24 w-24 rounded-full bg-white object-cover ring-4 ring-white shadow-[0_10px_28px_rgb(var(--color-charcoal-rgb)/0.18)]"
          />
        </picture>
      </div>
      <div className="p-4 pt-2.5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">{t("book.host.eyebrow")}</div>
        <div className="mt-1 text-[15px] font-bold text-violet">{t("book.host.name")}</div>
        <div className="mt-0.5 text-[12px] text-charcoal/70">{t("book.host.role")}</div>
        <p className="mt-2.5 border-t border-charcoal/8 pt-2.5 text-[12px] leading-5 text-charcoal/70">{t("book.host.line")}</p>
      </div>
    </div>
  )
}

function TrustItem({ icon: Icon, title, body }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white p-4 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
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

/* "You're booking about" chip — shows the preselected category / offering. */
function ServiceContextCard({ category, offering, lang }) {
  const { t } = useTranslation("services")
  if (!category) return null
  const Icon = category.Icon
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-violet/15 bg-white p-3 pr-4">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white ${category.tile}`}>
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">{t("booking.context.label")}</div>
        <div className="text-[13px] font-bold text-violet">
          {pick(category, "name", lang)}
          {offering && <span className="font-medium text-charcoal/70"> · {pick(offering, "name", lang)}</span>}
        </div>
      </div>
      <Link to={`/services/${category.slug}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-violet hover:underline">
        <Tag className="h-3 w-3" aria-hidden="true" /> {t("booking.context.change")}
      </Link>
    </div>
  )
}

export default function BookConsultationPage() {
  const { t } = useTranslation("contact")
  const { t: ts } = useTranslation("services")
  const lang = useCatalogueLang()
  const { serviceSlug: pathSlug } = useParams()
  const [searchParams] = useSearchParams()
  const requestedSlug = searchParams.get("service") || pathSlug || null

  // Resolve against the catalogue: offering (→ its category) or category.
  const offering = useMemo(() => getOfferingBySlug(requestedSlug), [requestedSlug])
  const category = useMemo(
    () => (offering ? offering.category : getCategoryBySlug(requestedSlug)),
    [offering, requestedSlug],
  )
  // Slug used for the API lookup: the category slug is the `Service.slug`
  // DB row; unknown slugs are still tried verbatim (older DB services).
  const apiSlug = category?.slug || requestedSlug

  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(Boolean(apiSlug))
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!apiSlug) { setService(null); setLoading(false); return undefined }
    let aborted = false
    async function load() {
      try {
        setLoading(true); setErrorMessage("")
        const r = await apiGet(`/api/services/${encodeURIComponent(apiSlug)}`).catch(() => null)
        if (aborted) return
        const row = r?.data || r?.service || null
        setService(row && row.id ? row : null)
      } catch (e) {
        if (!aborted) setErrorMessage(e?.message || "")
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [apiSlug])

  const catalogueTitle = category ? pick(category, "name", lang) : null
  const title = catalogueTitle || service?.title || t("book.defaultTitle")
  const subtitle = category || service ? t("book.subtitleWithService") : t("book.subtitleGeneric")

  const trustItems = [
    { icon: Calendar,    title: t("book.trust.realtimeTitle"),     body: t("book.trust.realtimeBody") },
    { icon: Globe2,      title: t("book.trust.timezoneTitle"),     body: t("book.trust.timezoneBody") },
    { icon: Clock,       title: t("book.trust.cancelTitle"),       body: t("book.trust.cancelBody") },
    { icon: ShieldCheck, title: t("book.trust.confidentialTitle"), body: t("book.trust.confidentialBody") },
  ]

  return (
    <section className="bg-mist">
      <Seo
        title={title !== t("book.defaultTitle") ? t("book.seoBookFmt", { title }) : t("book.seoDefault")}
        description={subtitle}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <m.div variants={stagger} initial="hidden" animate="show" className="mb-8 sm:mb-10">
          <m.div variants={fadeUp}><HeroBadge /></m.div>
          <m.h1 variants={fadeUp} className="mt-3 text-[28px] font-bold tracking-tight text-violet sm:text-[36px] lg:text-[42px]">
            {ts("booking.title")}
          </m.h1>
          <m.p variants={fadeUp} className="mt-3 max-w-2xl text-[14px] text-charcoal/75 sm:text-[15px]">
            {subtitle}
          </m.p>
          {category ? (
            <m.div variants={fadeUp}>
              <ServiceContextCard category={category} offering={offering} lang={lang} />
            </m.div>
          ) : (
            <m.div variants={fadeUp} className="mt-4">
              <Link to="/services" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition hover:underline">
                {t("book.browseAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </m.div>
          )}
          {requestedSlug && !category && !loading && !service && (
            <m.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/10 px-3 py-2 text-[12px] text-amber-700">
              {ts("booking.unknownService")}
            </m.div>
          )}
          {errorMessage && (
            <m.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/10 px-3 py-2 text-[12px] text-amber-700">
              {errorMessage}
            </m.div>
          )}
        </m.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="min-w-0">
            {loading ? (
              <div className="h-[520px] animate-pulse rounded-xl border border-charcoal/10 bg-white shadow-[0_12px_35px_rgb(var(--color-violet-rgb)/0.06)]" />
            ) : (
              <BookingCalendar
                serviceId={service?.id || null}
                serviceSlug={apiSlug || null}
                serviceTitle={title !== t("book.defaultTitle") ? title : t("book.discoveryCall")}
                durationMin={service?.bookingDurationMin || 30}
                policy={{
                  minNoticeHours: service?.bookingMinNoticeHours ?? 24,
                  maxAdvanceDays: service?.bookingMaxAdvanceDays ?? 60,
                }}
              />
            )}
          </div>

          <m.aside variants={stagger} initial="hidden" animate="show" className="space-y-3">
            <m.div variants={fadeUp}><HostCard /></m.div>
            {trustItems.map(({ icon, title: tTitle, body }) => (
              <m.div key={tTitle} variants={fadeUp}>
                <TrustItem icon={icon} title={tTitle} body={body} />
              </m.div>
            ))}
            <m.div variants={fadeUp} className="rounded-xl border border-violet/15 bg-gradient-to-br from-violet-ghost to-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">{t("book.expect.title")}</div>
              <ul className="mt-3 space-y-2.5 text-[12.5px] text-charcoal/85">
                <li>• {t("book.expect.item1")}</li>
                <li>• {t("book.expect.item2")}</li>
                <li>• {t("book.expect.item3")}</li>
              </ul>
            </m.div>
          </m.aside>
        </div>
      </div>
    </section>
  )
}
