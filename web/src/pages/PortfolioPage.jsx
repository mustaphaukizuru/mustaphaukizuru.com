import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, Sparkles, Search, Grid3x3, AlertCircle, ChevronRight,
  ExternalLink, Tag,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { itemListSchema } from "../seo/schemas"
import { listPortfolio } from "../services/portfolioService"

/* ──────────────────────────────────────────────────────────────────────────
 *  PortfolioPage · /portfolio
 *
 *  I18N · Phase 118 — every visible string keyed under the `portfolio`
 *  namespace. Server-driven content (item.title, item.shortDescription,
 *  item.category) already comes locale-resolved via pickLocale in
 *  portfolioService (Phase 6A) — only the chrome (hero, filters,
 *  pagination, empty/error states, CTA, SEO) is translated here.
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

const PAGE_SIZE = 12

export default function PortfolioPage() {
  const { t } = useTranslation("portfolio")
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeCategory, setActiveCategory] = useState(null) // null = "All"
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const result = await listPortfolio({
          category: activeCategory || undefined,
          page,
          limit: PAGE_SIZE,
        })
        if (cancelled) return
        setItems(result.items)
        setPagination(result.pagination)
        setCategories(result.categories)
      } catch (err) {
        if (!cancelled) setError(err?.message || t("states.errorFallback"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, page])

  // Client-side search on the currently loaded page (cheap, good enough for a dozen items)
  const visibleItems = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      const hay = [
        it.title, it.shortDescription, it.category, it.role, it.client,
        ...(it.tags || []), ...(it.tools || []),
      ].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const onCategoryClick = (cat) => {
    setActiveCategory(cat)
    setPage(1)
  }

  return (
    <div className="min-h-[60vh] bg-mist">
      <Seo
        title={t("seo.title")}
        description={t("seo.description")}
        jsonLd={[
          itemListSchema(
            (Array.isArray(items) ? items : []).map((p) => ({
              name: p.title,
              url:  `/projects/${p.slug || ""}`,
              image: p.coverImage || undefined,
            })),
            { name: t("seo.schemaName"), description: t("seo.schemaDesc"), pathname: "/portfolio", type: "CreativeWork" },
          ),
        ].filter(Boolean)}
      />
      <div className="border-b border-[#EFF1F5] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* HERO */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-12 sm:py-16 lg:py-20">
          <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-col gap-5">
            <motion.span variants={fadeUp} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              <Sparkles className="h-3 w-3" /> {t("hero.eyebrow")}
            </motion.span>
            <motion.h1 variants={fadeUp} className="text-page font-bold tracking-tight text-violet sm:text-page lg:text-display">
              {t("hero.title")}
            </motion.h1>
            <motion.p variants={fadeUp} className="max-w-2xl text-body leading-7 text-charcoal-80/75 sm:text-body">
              {t("hero.subtitle")}
            </motion.p>
          </motion.div>
        </Container>
      </section>

      {/* FILTER + SEARCH TOOLBAR */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Category chips */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onCategoryClick(null)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-micro font-semibold transition ${
                  activeCategory === null
                    ? "bg-violet text-white"
                    : "bg-violet-pale text-violet hover:bg-violet/10"
                }`}
              >
                <Grid3x3 className="h-3.5 w-3.5" /> {t("filters.all")}
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onCategoryClick(c.name)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-micro font-semibold transition ${
                    activeCategory === c.name
                      ? "bg-violet text-white"
                      : "bg-violet-pale text-violet hover:bg-violet/10"
                  }`}
                >
                  <Tag className="h-3 w-3" /> {c.name}
                  <span className="ml-1 rounded-full bg-black/5 px-1.5 text-micro font-normal">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("filters.search")}
                className="w-full rounded-xl border border-violet/15 bg-white pl-9 pr-3 py-2 text-meta text-violet placeholder:text-charcoal-80/35 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/10 lg:w-64"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* GRID */}
      <section className="py-10 sm:py-14">
        <Container>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-white shadow-[0_8px_24px_rgba(93,63,211,0.04)]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              <p className="text-meta">{error}</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-charcoal-80/20 bg-white p-14 text-center">
              <h2 className="text-subsection font-bold text-violet">{t("states.emptyTitle")}</h2>
              <p className="mt-2 text-meta text-charcoal-80/70">
                {query ? t("states.emptyQuery") : t("states.emptyDefault")}
              </p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeCategory || "all"}-${page}`}
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {visibleItems.map((item) => (
                    <PortfolioCard key={item.id} item={item} />
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-40"
                  >
                    {t("filters.previous")}
                  </button>
                  <span className="px-3 text-micro text-charcoal-80/70">
                    {t("filters.pageOf", { page: pagination.page, total: pagination.totalPages })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-40"
                  >
                    {t("filters.next")}
                  </button>
                </div>
              )}
            </>
          )}
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-charcoal-80/10 bg-white py-12">
        <Container>
          <div className="rounded-2xl border border-charcoal-80/10 bg-violet px-6 py-10 text-center sm:px-10 sm:py-14">
            <h2 className="text-section font-bold text-white sm:text-section">{t("cta.title")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-meta leading-6 text-white/70">
              {t("cta.subtitle")}
            </p>
            <Link
              to="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {t("cta.button")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Card · sub-component scopes its own useTranslation hook because the
 * Featured/Case study/Live labels live under the same namespace.
 * ──────────────────────────────────────────────────────────────────────────── */

function PortfolioCard({ item }) {
  const { t } = useTranslation("portfolio")
  return (
    <motion.article
      variants={fadeUp}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(93,63,211,0.12)]"
    >
      <Link to={`/projects/${item.slug}`} className="block">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden bg-violet-pale">
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-violet/40">
              <Grid3x3 className="h-10 w-10" />
            </div>
          )}
          {item.isFeatured && (
            <div className="absolute left-3 top-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 text-micro font-bold text-violet-deep">
                <Sparkles className="h-2.5 w-2.5" /> {t("card.featured")}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <div className="text-micro font-semibold uppercase tracking-[0.15em] text-violet/70">
            {item.category}
            {item.year && <span className="ml-2 text-charcoal-80/40">· {item.year}</span>}
          </div>
          <h3 className="mt-2 line-clamp-2 text-card font-bold text-violet group-hover:text-violet-deep">
            {item.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-meta leading-6 text-charcoal-80/70">
            {item.shortDescription}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-micro font-semibold text-violet">
              {t("card.caseStudy")} <ChevronRight className="h-3.5 w-3.5" />
            </span>
            {item.liveUrl && (
              <span className="inline-flex items-center gap-1 text-micro text-charcoal-80/55">
                <ExternalLink className="h-3 w-3" /> {t("card.live")}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}
