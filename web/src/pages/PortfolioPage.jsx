import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { m } from "framer-motion"
import { ArrowRight, Sparkles, Search, Grid3x3, AlertCircle, Tag } from "lucide-react"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { itemListSchema } from "../seo/schemas"
import { apiGet } from "../lib/api"
import StaggerGrid from "../components/motion/StaggerGrid"
import Meteors from "../components/motion/Meteors"
import MagneticButton from "../components/motion/MagneticButton"
import CaseStudyCard from "../components/portfolio/CaseStudyCard"
import ProjectAccordion from "../components/portfolio/ProjectAccordion"
import ServiceFilter from "../components/portfolio/ServiceFilter"
import { SERVICE_SLUGS } from "../components/portfolio/caseStudy"

/* ──────────────────────────────────────────────────────────────────────────
 *  PortfolioPage · /portfolio  (roadmap step 27 — case studies)
 *
 *  Grid of CaseStudyCards that lead with the outcome line. Two filter rows:
 *    • service category (it-strategy-consulting | ai-automation |
 *      cloud-architecture-migration | digital-product-engineering) — server
 *      side via ?service= (JSON path into the case-study block), kept in the
 *      URL so /portfolio?service=ai-automation is linkable.
 *    • legacy free-text category chips (server ?category=).
 *  Search stays client-side over the loaded page.
 *
 *  Talks to /api/portfolio directly: the shared web/services/portfolioService
 *  wrapper drops category/page params and reshapes the envelope.
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

async function fetchPortfolio({ category, service, page, limit }) {
  const qs = new URLSearchParams()
  qs.set("page", String(page))
  qs.set("limit", String(limit))
  if (category) qs.set("category", category)
  if (service) qs.set("service", service)
  const res = await apiGet(`/api/portfolio?${qs.toString()}`)
  return {
    items:      Array.isArray(res?.data) ? res.data : [],
    pagination: res?.pagination || null,
    categories: Array.isArray(res?.categories) ? res.categories : [],
  }
}

export default function PortfolioPage() {
  const { t } = useTranslation("portfolio")
  const [searchParams, setSearchParams] = useSearchParams()
  const serviceParam = searchParams.get("service")
  const activeService = SERVICE_SLUGS.includes(serviceParam) ? serviceParam : null

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
        const result = await fetchPortfolio({
          category: activeCategory || undefined,
          service:  activeService || undefined,
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
  }, [activeCategory, activeService, page])

  // Client-side search on the currently loaded page (cheap, good enough for a dozen items)
  const visibleItems = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      const cs = it.caseStudy || {}
      const hay = [
        it.title, it.shortDescription, it.category, it.role, it.client,
        cs.problem, cs.context, it.outcomeLine,
        ...(it.tags || []), ...(it.tools || []), ...(cs.stack || []),
      ].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const onCategoryClick = (cat) => {
    setActiveCategory(cat)
    setPage(1)
  }

  const onServiceChange = (slug) => {
    const next = new URLSearchParams(searchParams)
    if (slug) next.set("service", slug); else next.delete("service")
    setSearchParams(next, { replace: true })
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
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* HERO */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-12 sm:py-16 lg:py-20">
          <m.div initial="hidden" animate="show" variants={stagger} className="flex flex-col gap-5">
            <m.span variants={fadeUp} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> {t("hero.eyebrow")}
            </m.span>
            <m.h1 variants={fadeUp} className="text-page font-bold tracking-tight text-violet sm:text-page lg:text-display">
              {t("hero.title")}
            </m.h1>
            <m.p variants={fadeUp} className="max-w-2xl text-body leading-7 text-charcoal-80/75 sm:text-body">
              {t("hero.subtitle")}
            </m.p>
          </m.div>
        </Container>
      </section>

      {/* FEATURED BAND — a visual index of the work, above the filters. Only
          on the unfiltered first page: once the reader has narrowed the list
          it is the list they want, not a second view of it. */}
      {!loading && !error && !activeService && !activeCategory && !query.trim() && page === 1 && (
        <section className="border-b border-charcoal-80/10 bg-white">
          <Container className="py-6">
            <ProjectAccordion projects={items} />
          </Container>
        </section>
      )}

      {/* FILTER + SEARCH TOOLBAR */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <ServiceFilter value={activeService} onChange={onServiceChange} />

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("filters.search")}
                  aria-label={t("filters.search")}
                  className="w-full rounded-xl border border-violet/15 bg-white pl-9 pr-3 py-2 text-meta text-violet placeholder:text-charcoal-80/35 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/10 lg:w-64"
                />
              </div>
            </div>

            {/* Legacy free-text category chips (secondary row) */}
            {categories.length > 1 ? (
              <div role="group" aria-label={t("filters.byCategory")} className="flex flex-wrap items-center gap-2 border-t border-charcoal-80/5 pt-3">
                <button
                  type="button"
                  onClick={() => onCategoryClick(null)}
                  aria-pressed={activeCategory === null}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-semibold transition ${
                    activeCategory === null
                      ? "border-violet bg-violet text-white"
                      : "border-charcoal-80/15 bg-white text-charcoal-80/70 hover:border-violet/40 hover:text-violet"
                  }`}
                >
                  <Grid3x3 className="h-3 w-3" aria-hidden="true" /> {t("filters.all")}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onCategoryClick(c.name)}
                    aria-pressed={activeCategory === c.name}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-semibold transition ${
                      activeCategory === c.name
                        ? "border-violet bg-violet text-white"
                        : "border-charcoal-80/15 bg-white text-charcoal-80/70 hover:border-violet/40 hover:text-violet"
                    }`}
                  >
                    <Tag className="h-3 w-3" aria-hidden="true" /> {c.name}
                    <span className="ml-1 rounded-full bg-black/5 px-1.5 text-micro font-normal">{c.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* GRID */}
      <section className="py-10 sm:py-14">
        <Container>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-96 animate-pulse rounded-2xl bg-white shadow-[var(--shadow-e4)]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose/20 bg-rose/10 p-8 text-center text-rose-700" role="alert">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
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
              <StaggerGrid
                key={`${activeService || "any"}-${activeCategory || "all"}-${page}`}
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                stagger={0.06}
              >
                {visibleItems.map((item) => (
                  <CaseStudyCard key={item.id} item={item} />
                ))}
              </StaggerGrid>

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
          <div className="relative isolate overflow-hidden rounded-2xl border border-charcoal-80/10 bg-violet px-6 py-10 text-center sm:px-10 sm:py-14">
            <Meteors number={10} />
            <h2 className="relative text-section font-bold text-white sm:text-section">{t("cta.title")}</h2>
            <p className="relative mx-auto mt-2 max-w-xl text-meta leading-6 text-white/70">
              {t("cta.subtitle")}
            </p>
            <MagneticButton className="relative mt-6">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {t("cta.button")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </MagneticButton>
          </div>
        </Container>
      </section>
    </div>
  )
}
