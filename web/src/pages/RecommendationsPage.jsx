/* ════════════════════════════════════════════════════════════════════════
   RecommendationsPage.jsx · public /recommendations · I18N · Phase 121A
   Strings keyed under `recommendations.*`. Category labels + blurbs use
   keyId-pattern so the static CATEGORIES array stays at module scope and
   labels resolve at render time.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import {
  Sparkles, ExternalLink, Tag, BookOpen, GraduationCap, Layers,
  Briefcase, Users, Star, Loader2, ShieldCheck, ThumbsUp, MessageCircle,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import { fetchRecommendations } from "../services/recommendationService"

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }

/* I18N · CATEGORIES carries keyId references; labels + blurbs resolve at
 * render time via t("recommendations.categories.<key>.{label,blurb}"). */
const CATEGORIES = [
  { value: "",         keyId: "all",      Icon: Sparkles },
  { value: "tool",     keyId: "tool",     Icon: Sparkles },
  { value: "book",     keyId: "book",     Icon: BookOpen },
  { value: "course",   keyId: "course",   Icon: GraduationCap },
  { value: "template", keyId: "template", Icon: Layers },
  { value: "service",  keyId: "service",  Icon: Briefcase },
  { value: "partner",  keyId: "partner",  Icon: Users },
]

const HERO_GRADIENT =
  "radial-gradient(at 18% 20%, rgba(93, 63, 211, 0.55) 0px, transparent 55%), " +
  "radial-gradient(at 82% 0%, rgba(2, 132, 199, 0.30) 0px, transparent 50%), " +
  "radial-gradient(at 50% 100%, rgba(233, 196, 106, 0.18) 0px, transparent 55%), " +
  "linear-gradient(180deg, #14151B 0%, #1A1B23 100%)"

function CategoryBadge({ category }) {
  const def = CATEGORIES.find((c) => c.value === category) || { Icon: Tag }
  const Icon = def.Icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-pale/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet">
      <Icon className="h-3 w-3" /> {category}
    </span>
  )
}

/* ─── Card ────────────────────────────────────────────────────────────── */

function RecommendationCard({ rec }) {
  const { t } = useTranslation("recommendations")
  const targetHref = rec.product
    ? `/store/${rec.product.slug}`
    : rec.service
      ? `/services/${rec.service.slug}`
      : rec.externalUrl || `/recommendations/${rec.slug}`
  const isExternal = rec.externalUrl && !rec.product && !rec.service
  const ctaLabel =
    rec.product   ? t("card.viewProduct")
    : rec.service ? t("card.viewService")
    : isExternal  ? t("card.visitSite")
                  : t("card.readMore")

  return (
    <motion.article
      variants={fadeUp}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(93,63,211,0.10)]"
    >
      {rec.imageUrl ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-violet-pale/40">
          <img
            src={rec.imageUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-violet-pale/60 to-violet/10 text-violet">
          <Sparkles className="h-10 w-10 opacity-60" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={rec.category} />
          {rec.isAffiliate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <Star className="h-2.5 w-2.5" /> {t("card.affiliate")}
            </span>
          )}
        </div>

        <h3 className="text-[16px] font-bold leading-snug text-violet">
          <Link to={`/recommendations/${rec.slug}`} className="hover:underline">
            {rec.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-meta leading-6 text-charcoal-80/75">{rec.summary}</p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <a
            href={targetHref}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1.5 text-meta font-semibold text-violet hover:underline"
          >
            {ctaLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {rec.body && (
            <Link
              to={`/recommendations/${rec.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale/60 px-3 py-1 text-micro font-semibold text-violet transition hover:bg-violet-pale"
            >
              {t("card.readWhy")}
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  )
}

/* ─── Rich empty state ────────────────────────────────────────────────── */

function EmptyState({ category }) {
  const { t } = useTranslation("recommendations")
  return (
    <div className="rounded-2xl border border-charcoal-80/10 bg-white p-8 sm:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-card font-bold !text-violet">
          {category ? t("empty.titleCategory") : t("empty.titleAll")}
        </h2>
        <p className="mt-2 text-meta text-charcoal-80/65">
          {category ? t("empty.bodyCategory") : t("empty.bodyAll")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)] transition hover:bg-violet-deep"
          >
            <MessageCircle className="h-4 w-4" /> {t("empty.suggest")}
          </Link>
          {category && (
            <Link
              to="/recommendations"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
            >
              {t("empty.seeAll")}
            </Link>
          )}
        </div>
      </div>

      {!category && (
        <>
          <div className="mx-auto mt-10 max-w-3xl border-t border-charcoal-80/8 pt-8">
            <p className="text-center text-micro font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
              {t("empty.browseHeading")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.filter((c) => c.value).map((c) => (
                <Link
                  key={c.value}
                  to={`/recommendations?category=${c.value}`}
                  className="group flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_8px_22px_rgba(93,63,211,0.06)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet transition group-hover:bg-violet group-hover:text-white">
                    <c.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-meta font-bold !text-violet">{t(`categories.${c.keyId}.label`)}</div>
                    <p className="mt-0.5 line-clamp-2 text-micro text-charcoal-80/65">{t(`categories.${c.keyId}.blurb`)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── How I curate trust strip ────────────────────────────────────────── */

function HowICurate() {
  const { t } = useTranslation("recommendations")
  const items = [
    { Icon: ShieldCheck, titleKey: "curate.items.personalTitle", bodyKey: "curate.items.personalBody" },
    { Icon: ThumbsUp,    titleKey: "curate.items.outcomeTitle",  bodyKey: "curate.items.outcomeBody" },
    { Icon: Sparkles,    titleKey: "curate.items.updateTitle",   bodyKey: "curate.items.updateBody" },
  ]
  return (
    <section className="border-t border-charcoal-80/8 bg-white/60 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-bold uppercase tracking-[0.18em] text-violet">
            <Sparkles className="h-3 w-3" /> {t("curate.eyebrow")}
          </span>
          <h2 className="mt-3 text-section font-bold !text-violet">{t("curate.title")}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.titleKey}
              className="rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
                <it.Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-card font-bold !text-violet">{t(it.titleKey)}</h3>
              <p className="mt-2 text-meta leading-6 text-charcoal-80/70">{t(it.bodyKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════ */

export default function RecommendationsPage() {
  const { t } = useTranslation("recommendations")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    return params.get("category") || ""
  })

  useEffect(() => {
    let aborted = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchRecommendations({ category, limit: 48 })
        if (!aborted) setItems(Array.isArray(data) ? data : [])
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [category])

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (category) url.searchParams.set("category", category)
    else url.searchParams.delete("category")
    window.history.replaceState({}, "", url.toString())
  }, [category])

  const counts = useMemo(() => {
    const map = items.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1
      return acc
    }, {})
    map[""] = items.length
    return map
  }, [items])

  const itemListSchema = useMemo(() => {
    if (!items.length) return null
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: items.map((rec, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: rec.externalUrl
                    || (rec.product ? `/store/${rec.product.slug}` : null)
                    || (rec.service ? `/services/${rec.service.slug}` : null)
                    || `/recommendations/${rec.slug}`,
        name: rec.title,
      })),
    }
  }, [items])

  return (
    <div className="bg-mist">
      <Seo
        {...{
          title:       t("seo.title"),
          description: t("seo.description"),
          type:        "article",
          schemaType:  "ItemList",
        }}
        jsonLd={itemListSchema ? [itemListSchema] : []}
      />

      {/* Hero · brand mesh gradient */}
      <section
        className="relative isolate overflow-hidden py-16 text-white sm:py-20"
        style={{ background: HERO_GRADIENT }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:32px_32px]"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" /> {t("hero.eyebrow")}
          </span>
          <h1 className="mt-5 text-[clamp(32px,4.4vw,46px)] font-bold leading-[1.05] tracking-[-0.012em]">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15.5px] leading-relaxed text-white/65">
            {t("hero.body")} <span className="text-white/85">{t("hero.callout")}</span>{t("hero.tail")}
          </p>
        </div>
      </section>

      {/* Filter rail */}
      <div className="sticky top-[72px] z-20 border-b border-charcoal-80/8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {CATEGORIES.map((c) => {
            const active = category === c.value
            return (
              <button
                key={c.value || "all"}
                type="button"
                onClick={() => setCategory(c.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
                  active
                    ? "bg-violet text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)]"
                    : "bg-violet-pale text-violet hover:bg-violet-pale/70"
                }`}
              >
                <c.Icon className="h-3.5 w-3.5" />
                {t(`categories.${c.keyId}.label`)}
                {counts[c.value] !== undefined && counts[c.value] > 0 && (
                  <span className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-white text-violet"
                  }`}>
                    {counts[c.value]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[5/4] animate-pulse rounded-2xl bg-violet-pale/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState category={category} />
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((rec) => <RecommendationCard key={rec.id} rec={rec} />)}
          </motion.div>
        )}

        {/* Affiliate disclosure */}
        {items.some((r) => r.isAffiliate) && (
          <p className="mx-auto mt-12 max-w-2xl text-center text-micro text-charcoal-80/55">
            <strong>{t("disclosure.label")}</strong> {t("disclosure.body")} <em>{t("disclosure.italic")}</em> {t("disclosure.tail")}
          </p>
        )}
      </div>

      <HowICurate />
    </div>
  )
}
