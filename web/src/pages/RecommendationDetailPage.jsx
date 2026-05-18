/* ════════════════════════════════════════════════════════════════════════
   RecommendationDetailPage.jsx · /recommendations/:slug
   ────────────────────────────────────────────────────────────────────────
   Long-form view for a single recommendation. Renders the markdown `body`
   field, shows linked subject (product / service / external URL), surfaces
   affiliate disclosure where applicable, and emits JSON-LD Article schema
   so search engines treat it as a credible endorsement page.

   Markdown is rendered via a tiny safe renderer — no extra deps, no
   raw-HTML interpolation. We support the subset that admins actually use
   in practice: paragraphs, headings, lists, links, bold/italic, code.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft, Sparkles, ExternalLink, Star, Loader2, AlertCircle,
  Tag, BookOpen, GraduationCap, Layers, Briefcase, Users,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import { fetchRecommendationBySlug } from "../services/recommendationService"

import { useTranslation } from "react-i18next"
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } }

const CATEGORY_ICONS = {
  tool: Sparkles,
  book: BookOpen,
  course: GraduationCap,
  template: Layers,
  service: Briefcase,
  partner: Users,
}

/* ─── Lightweight, safe markdown renderer ──────────────────────────────
   Supported syntax (intentionally narrow for trust + bundle size):
     · Paragraphs (blank-line separated)
     · # / ## / ### headings
     · - or * unordered lists
     · 1. ordered lists
     · **bold** and *italic*
     · `inline code`
     · [text](url) links — http/https only
   Anything else renders as text. No raw HTML is ever evaluated.
   ──────────────────────────────────────────────────────────────────── */

function renderInline(text) {
  // Escape HTML metacharacters first so the output is safe to dangerouslySet.
  let safe = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Inline code first so its contents aren't re-formatted.
  safe = safe.replace(/`([^`]+?)`/g, '<code class="rounded bg-violet-pale/60 px-1.5 py-0.5 font-mono text-[12.5px] text-violet">$1</code>')
  // Bold then italic.
  safe = safe.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold text-violet">$1</strong>')
  safe = safe.replace(/\*([^*]+?)\*/g, '<em>$1</em>')

  // Safe http(s) links only — strict regex, no on* attributes possible.
  safe = safe.replace(
    /\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet underline decoration-violet/30 underline-offset-2 hover:decoration-violet">$1</a>'
  )
  return safe
}

function MarkdownBody({ source }) {
  if (!source) return null
  const lines = String(source).replace(/\r\n/g, "\n").split("\n")

  const blocks = []
  let para = []
  let list = null // { ordered: bool, items: [] }

  function flushPara() {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") })
      para = []
    }
  }
  function flushList() {
    if (list) {
      blocks.push({ type: list.ordered ? "ol" : "ul", items: list.items })
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushPara(); flushList(); continue }
    if (line.startsWith("### ")) { flushPara(); flushList(); blocks.push({ type: "h3", text: line.slice(4) }); continue }
    if (line.startsWith("## ")) { flushPara(); flushList(); blocks.push({ type: "h2", text: line.slice(3) }); continue }
    if (line.startsWith("# ")) { flushPara(); flushList(); blocks.push({ type: "h1", text: line.slice(2) }); continue }

    const ulMatch = line.match(/^[-*] (.+)$/)
    if (ulMatch) {
      flushPara()
      if (!list || list.ordered) flushList()
      if (!list) list = { ordered: false, items: [] }
      list.items.push(ulMatch[1])
      continue
    }
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      flushPara()
      if (!list || !list.ordered) flushList()
      if (!list) list = { ordered: true, items: [] }
      list.items.push(olMatch[1])
      continue
    }

    flushList()
    para.push(line)
  }
  flushPara()
  flushList()

  return (
    <div className="prose-mu space-y-4 text-meta leading-7 text-charcoal-80/85">
      {blocks.map((b, i) => {
        if (b.type === "h1") return <h2 key={i} className="mt-8 text-section font-bold !text-violet" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
        if (b.type === "h2") return <h3 key={i} className="mt-7 text-card font-bold !text-violet" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
        if (b.type === "h3") return <h4 key={i} className="mt-6 text-body font-bold !text-violet" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
        if (b.type === "ul") {
          return (
            <ul key={i} className="ml-6 list-disc space-y-1.5">
              {b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
            </ul>
          )
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="ml-6 list-decimal space-y-1.5">
              {b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
            </ol>
          )
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
      })}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function RecommendationDetailPage() {
  const { t } = useTranslation("recommendations")
  const { slug } = useParams()
  const [rec, setRec] = useState(null)
  const [error, setErr] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      setLoading(true); setErr("")
      try {
        const data = await fetchRecommendationBySlug(slug)
        if (aborted) return
        if (!data) setErr("not-found")
        else setRec(data)
      } catch (e) {
        if (!aborted) setErr(e?.message || "Could not load recommendation")
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [slug])

  const targetHref = rec
    ? rec.product
        ? `/store/${rec.product.slug}`
        : rec.service
          ? `/services/${rec.service.slug}`
          : rec.externalUrl || null
    : null
  const isExternal = Boolean(rec?.externalUrl && !rec?.product && !rec?.service)
  const ctaLabel =
    rec?.product ? `View ${rec.product.title}`
    : rec?.service ? `View ${rec.service.title}`
    : isExternal ? "Visit site"
    : null

  const articleSchema = useMemo(() => {
    if (!rec) return null
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: rec.title,
      description: rec.summary,
      image: rec.imageUrl || undefined,
      datePublished: rec.createdAt,
      dateModified: rec.updatedAt,
      author: {
        "@type": "Person",
        name: "Mustapha Ukizuru",
      },
    }
  }, [rec])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-mist">
        <Loader2 className="h-8 w-8 animate-spin text-violet" />
      </div>
    )
  }

  if (error === "not-found" || !rec) {
    return (
      <div className="bg-mist py-20">
        <div className="mx-auto max-w-xl px-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-page font-bold !text-violet">{t("detail.notFound")}</h1>
          <p className="mt-2 text-meta text-charcoal-80/65">
            {t("detail.notFoundBody2")}
          </p>
          <Link
            to="/recommendations"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)] transition hover:bg-violet-deep"
          >
            <ArrowLeft className="h-4 w-4" /> {t("detail.allRecs")}
          </Link>
        </div>
      </div>
    )
  }

  const Icon = CATEGORY_ICONS[rec.category] || Tag

  return (
    <div className="bg-mist">
      <Seo
        title={`${rec.metaTitle || rec.title} · Recommendations · Mustapha Ukizuru`}
        description={rec.metaDescription || rec.summary}
        type="article"
        image={rec.imageUrl || undefined}
        jsonLd={articleSchema ? [articleSchema] : []}
      />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="border-b border-charcoal-80/8 bg-white py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-1.5 text-meta font-semibold text-violet hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("detail.allRecs")}
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet">
              <Icon className="h-3 w-3" /> {rec.category}
            </span>
            {rec.isAffiliate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <Star className="h-2.5 w-2.5" /> {t("detail.affiliateLink")}
              </span>
            )}
          </div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-3 text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight !text-violet"
          >
            {rec.title}
          </motion.h1>

          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-charcoal-80/75">
            {rec.summary}
          </p>

          {targetHref && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={targetHref}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-3 text-meta font-semibold text-white shadow-[0_10px_28px_rgba(93,63,211,0.25)] transition hover:bg-violet-deep"
              >
                {ctaLabel}
                <ExternalLink className="h-4 w-4" />
              </a>
              {rec.isAffiliate && (
                <span className="text-micro text-charcoal-80/55">
                  {t("detail.affiliateNoteShort")}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Image ────────────────────────────────────────────────────────── */}
      {rec.imageUrl && (
        <section className="bg-mist py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_12px_36px_rgba(93,63,211,0.08)]">
              <img src={rec.imageUrl} alt={rec.title} className="h-auto w-full object-cover" />
            </div>
          </div>
        </section>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {rec.body ? (
            <article className="rounded-2xl border border-charcoal-80/10 bg-white p-6 sm:p-10 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
              <MarkdownBody source={rec.body} />
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-charcoal-80/15 bg-white p-8 text-center">
              <p className="text-meta text-charcoal-80/65">
                {t("detail.noLongForm")}
              </p>
            </div>
          )}

          {/* Affiliate disclosure (full sentence, separate from CTA hint) */}
          {rec.isAffiliate && (
            <p className="mt-6 text-micro text-charcoal-80/55">
              <strong>Affiliate disclosure:</strong> {t("detail.buyingThrough")}{t("detail.affiliateNote")}
            </p>
          )}
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-charcoal-80/8 bg-white py-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <h2 className="text-card font-bold !text-violet">{t("detail.moreLike")}</h2>
            <p className="mt-1 text-meta text-charcoal-80/65">
              {t("detail.browseFullDesc")}
            </p>
          </div>
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
          >
            <Sparkles className="h-4 w-4" /> {t("detail.seeAll")}
          </Link>
        </div>
      </section>
    </div>
  )
}
