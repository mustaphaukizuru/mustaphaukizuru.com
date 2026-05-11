/* ════════════════════════════════════════════════════════════════════════
   BlogPage.jsx
   ────────────────────────────────────────────────────────────────────────
   Professional public blog index with a left-sidebar of "control tools":
   search · category filter · popular tags · recent posts · archive ·
   newsletter mini-CTA. The right column hosts a featured card and a
   responsive post grid with pagination.

   Layout
   ──────
     ┌────────────────────────────────── Hero ────────────────────────────┐
     │  Eyebrow · Title · Subtitle · search-result meta                   │
     └────────────────────────────────────────────────────────────────────┘
     ┌────────────────┬───────────────────────────────────────────────────┐
     │  Sidebar       │  Featured post (only when no filter)              │
     │  (sticky lg+)  │  Posts grid                                       │
     │                │  Pagination                                       │
     └────────────────┴───────────────────────────────────────────────────┘

   Brand contract
   ──────────────
   • Royal Violet primary · Soft Terracotta accent · Charcoal-on-mist surfaces.
   • Framer Motion for entrance + idle motion (gated by reduced-motion).
   • Lucide React icons only.
   • Container, EyebrowChip, and existing newsletter form pattern reused.
   • Source of truth: web/src/data/blogPostsData.js (swap for /api/blog later).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import {
  Search, Tag, Calendar, Clock, ArrowRight, X, Mail, Filter,
  TrendingUp, Folder, Archive, ChevronRight, BookOpen, Sparkles,
} from "lucide-react"

import Container from "../components/system/Container"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { apiRequest } from "../lib/api"
import StaggerGrid from "../components/motion/StaggerGrid"
import {
  BLOG_CATEGORIES,
  getAllPosts,
  getFeaturedPost,
  getCategoryCounts,
  getTopTags,
  getArchive,
} from "../data/blogPostsData"

import { useTranslation } from "react-i18next"
/* ── Motion variants ──────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/* ── Constants ────────────────────────────────────────────────────────── */

/* 9 = 3 rows × 3 columns on xl, 5 rows × 2 columns on sm — fits one
 * full screen at most viewport sizes before pagination kicks in. */
const POSTS_PER_PAGE = 9
const HERO_MESH =
  "radial-gradient(at 18% 20%, rgba(124,58,237,0.20) 0px, transparent 55%), " +
  "radial-gradient(at 82% 0%, rgba(2,132,199,0.14) 0px, transparent 50%), " +
  "radial-gradient(at 50% 100%, rgba(233,196,106,0.18) 0px, transparent 55%), " +
  "linear-gradient(160deg, #F8FAFC 0%, #EFE7F8 45%, #EFF1F5 100%)"

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function categoryByValue(slug) {
  return BLOG_CATEGORIES.find((c) => c.slug === slug) || null
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */

export default function BlogPage() {
  const { t } = useTranslation("blog")
  const reduce = useReducedMotion()

  /* URL-driven state — search/category/tag/page sync to the address bar
   * so visitors can deep-link, share, and use browser back/forward. */
  const [searchParams, setSearchParams] = useSearchParams()
  const queryParam = searchParams.get("q") || ""
  const categoryParam = searchParams.get("category") || ""
  const tagParam = searchParams.get("tag") || ""
  const pageParam = parseInt(searchParams.get("page") || "1", 10) || 1

  // Local input state — committed to URL only on submit, so we don't
  // re-render the whole grid on every keystroke.
  const [search, setSearch] = useState(queryParam)
  useEffect(() => { setSearch(queryParam) }, [queryParam])

  /* Pre-computed (cheap; data is static today). When this moves to the
   * API, swap with `useEffect(() => apiRequest("/api/blog?…"))`. */
  /* Try the API first; fall back to the bundled static data if the
   * backend isn't reachable (e.g. local dev without the API running, or
   * before the BlogPost migration is applied). The API contract returns
   * the exact shape the page already expects. */
  const [apiData, setApiData] = useState(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [list, meta] = await Promise.all([
          apiRequest("/api/v1/blog?limit=200"),
          apiRequest("/api/v1/blog/meta"),
        ])
        if (cancelled) return
        if (list?.posts?.length) {
          setApiData({
            posts: list.posts,
            categories: meta?.categories || [],
            tags: (meta?.tags || []).map((t) => ({ tag: t.tag, count: t.count })),
            archive: meta?.archive || [],
          })
        }
      } catch { /* fall back silently to static data */ }
    })()
    return () => { cancelled = true }
  }, [])

  const allPosts = useMemo(() => apiData?.posts || getAllPosts(), [apiData])
  const featuredPost = useMemo(
    () => apiData?.posts?.find((p) => p.featured) || apiData?.posts?.[0] || getFeaturedPost(),
    [apiData]
  )
  const categoryCounts = useMemo(() => {
    if (apiData?.categories?.length) {
      // Merge API counts with the canonical category metadata so accents stay correct
      return apiData.categories.map((c) => {
        const local = (getCategoryCounts() || []).find((x) => x.slug === c.slug)
        return { slug: c.slug, label: c.label, accent: c.accent || local?.accent || "#5D3FD3", count: c.count }
      })
    }
    return getCategoryCounts()
  }, [apiData])
  const topTags = useMemo(() => apiData?.tags || getTopTags(14), [apiData])
  const archive = useMemo(() => apiData?.archive || getArchive(), [apiData])

  /* Apply filters (search · category · tag) */
  const filtered = useMemo(() => {
    const q = queryParam.trim().toLowerCase()
    return allPosts.filter((post) => {
      if (categoryParam && post.category !== categoryParam) return false
      if (tagParam && !post.tags.includes(tagParam)) return false
      if (q) {
        const haystack = `${post.title} ${post.excerpt} ${post.tags.join(" ")}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allPosts, queryParam, categoryParam, tagParam])

  const hasActiveFilter = !!(queryParam || categoryParam || tagParam)

  /* When the visitor lands on the index with no filter, the featured
   * post owns the hero card — exclude it from the grid below so it
   * never appears twice on the same screen. With a filter active, the
   * featured card is hidden and every result shows in the grid. */
  const gridSource = useMemo(() => {
    if (hasActiveFilter || !featuredPost) return filtered
    return filtered.filter((p) => p.slug !== featuredPost.slug)
  }, [filtered, hasActiveFilter, featuredPost])

  const totalPages = Math.max(1, Math.ceil(gridSource.length / POSTS_PER_PAGE))
  const currentPage = Math.min(pageParam, totalPages)
  const pageStart = (currentPage - 1) * POSTS_PER_PAGE
  const pagePosts = gridSource.slice(pageStart, pageStart + POSTS_PER_PAGE)

  /* URL helpers — never mutate state directly; always go through setSearchParams
   * so the address bar stays the single source of truth. */
  function applyFilter(patch) {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "") next.delete(k)
      else next.set(k, String(v))
    })
    // Reset to page 1 whenever filters change.
    if (!("page" in patch)) next.delete("page")
    setSearchParams(next, { replace: false })
  }

  function clearFilters() {
    setSearchParams({}, { replace: false })
  }

  return (
    <>
      <Seo {...pageSeo.blog} />

      {/* ════════════════════════════ HERO ═══════════════════════════ */}
      <section
        aria-labelledby="blog-hero-title"
        className="relative isolate overflow-hidden"
        style={{ background: HERO_MESH }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,rgba(93,63,211,0.55)_1px,transparent_0)] [background-size:32px_32px]"
        />
        <Container>
          <motion.div
            variants={reduce ? undefined : stagger}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex flex-col items-center gap-5 py-16 text-center sm:py-20 lg:py-24"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-violet/[0.06] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-violet backdrop-blur-sm"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {t("page.title")}
            </motion.span>

            <motion.h1
              variants={fadeUp}
              id="blog-hero-title"
              className="max-w-3xl text-display text-violet"
            >
              The{" "}
              <span className="relative inline-block text-terracotta">
                blog
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-violet/20"
                />
              </span>
              .
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-2xl text-[15px] leading-7 text-charcoal-80/70 sm:text-[16px]"
            >
              {t("page.subtitle")}
            </motion.p>

            {/* Result meta, shows filter context whenever it's active */}
            <motion.div
              variants={fadeUp}
              className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[12.5px]"
            >
              <span className="text-charcoal-80/55">
                {filtered.length} article{filtered.length === 1 ? "" : "s"}
              </span>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-charcoal-80/15 bg-white px-3 py-1 font-semibold text-violet transition hover:border-violet/40 hover:bg-violet-pale/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  {t("page.clearFilters")}
                </button>
              ) : null}
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* ════════════════════════════ BODY ═══════════════════════════ */}
      <section className="bg-white">
        <Container>
          <div className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14 lg:py-20">

            {/* ───────────────── LEFT SIDEBAR · control tools ─────────────── */}
            <BlogSidebar
              search={search}
              setSearch={setSearch}
              onSubmitSearch={(value) => applyFilter({ q: value || null })}
              category={categoryParam}
              tag={tagParam}
              onPickCategory={(slug) => applyFilter({ category: slug || null })}
              onPickTag={(tag) => applyFilter({ tag: tag || null })}
              categories={categoryCounts}
              tags={topTags}
              recentPosts={allPosts.slice(0, 4)}
              archive={archive}
            />

            {/* ───────────────── RIGHT MAIN · featured + grid ─────────────── */}
            <div className="min-w-0">
              {/* Active-filter chips, surfaces what's narrowing the view */}
              {hasActiveFilter ? (
                <ActiveFilterBar
                  category={categoryParam}
                  tag={tagParam}
                  query={queryParam}
                  onClearCategory={() => applyFilter({ category: null })}
                  onClearTag={() => applyFilter({ tag: null })}
                  onClearQuery={() => applyFilter({ q: null })}
                />
              ) : null}

              {/* Featured card — only when no filter is active. Keeps the
                  header of the grid feeling editorial, not promotional. */}
              {!hasActiveFilter && featuredPost ? (
                <FeaturedCard post={featuredPost} reduce={reduce} />
              ) : null}

              {/* Section divider — introduces the grid as "More articles"
                  when a featured card sits above it; renders a clean
                  count-only label when filters are active. */}
              {pagePosts.length > 0 ? (
                <div className="mt-12 mb-6 flex items-end justify-between gap-4 border-b border-charcoal-80/10 pb-3">
                  <h2 className="text-[15px] font-bold uppercase tracking-[0.18em] text-violet">
                    {hasActiveFilter
                      ? `Results · ${gridSource.length}`
                      : "More articles"}
                  </h2>
                  <span className="text-[12px] font-mono text-charcoal-80/45">
                    {hasActiveFilter
                      ? null
                      : `${gridSource.length} article${gridSource.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              ) : null}

              {/* Grid · 1-col on mobile · 2-col from sm · 3-col from xl
                  for editorial density on wide displays without ever
                  feeling cramped against the 280px sidebar. */}
              {/* Phase 10b · StaggerGrid handles the semantic <ul>/<li>
                  pair AND the staggered entrance. PostCard becomes a
                  plain <article> wrapped by StaggerGrid's <li> — valid
                  HTML and one less motion node per card to track. */}
              {pagePosts.length === 0 ? (
                <EmptyState onClear={clearFilters} />
              ) : (
                <StaggerGrid
                  as="ul"
                  itemAs="li"
                  role="list"
                  className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
                  stagger={0.06}
                >
                  {pagePosts.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </StaggerGrid>
              )}

              {/* Pagination */}
              {totalPages > 1 ? (
                <Pagination
                  page={currentPage}
                  total={totalPages}
                  onChange={(p) => applyFilter({ page: p > 1 ? p : null })}
                />
              ) : null}
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SIDEBAR · "control tools" — sticky on lg+, stacks above content on mobile
   ════════════════════════════════════════════════════════════════════════ */

function BlogSidebar({
  search, setSearch, onSubmitSearch,
  category, tag, onPickCategory, onPickTag,
  categories, tags, recentPosts, archive,
}) {
  const { t } = useTranslation("blog")
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [newsletterStatus, setNewsletterStatus] = useState({ kind: null, message: "" })
  const [newsletterLoading, setNewsletterLoading] = useState(false)

  async function handleNewsletter(e) {
    e.preventDefault()
    setNewsletterStatus({ kind: null, message: "" })
    if (!newsletterEmail) {
      setNewsletterStatus({ kind: "error", message: "Please enter your email." })
      return
    }
    try {
      setNewsletterLoading(true)
      const res = await apiRequest("/api/newsletter", {
        method: "POST",
        body: JSON.stringify({ email: newsletterEmail }),
      })
      setNewsletterStatus({ kind: "success", message: res.message || "You're subscribed." })
      setNewsletterEmail("")
    } catch (err) {
      setNewsletterStatus({
        kind: "error",
        message:
          (err && typeof err.toUserMessage === "function" && err.toUserMessage()) ||
          (err && err.message) || "Subscription failed.",
      })
    } finally {
      setNewsletterLoading(false)
    }
  }

  return (
    <aside
      aria-label={t("page.filtersAria")}
      className="lg:sticky lg:top-24 lg:self-start"
    >
      <div className="flex flex-col gap-7">

        {/* ── Search ─────────────────────────────────────────────── */}
        <SidebarBlock title={t("page.searchTitle")} icon={Search}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmitSearch(search)
            }}
            className="relative"
          >
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="React · MercadoPago · STEM…"
              aria-label={t("page.searchAria")}
              className="w-full rounded-xl border border-charcoal-80/15 bg-white py-2.5 pl-9 pr-3 text-[13.5px] text-charcoal-80 placeholder-charcoal-80/40 outline-none transition focus:border-violet/45 focus:ring-[3px] focus:ring-violet/20"
            />
          </form>
        </SidebarBlock>

        {/* ── Categories ────────────────────────────────────────── */}
        <SidebarBlock title="Categories" icon={Folder}>
          <ul role="list" className="flex flex-col">
            <SidebarRow
              label={t("page.allCategories")}
              count={categories.reduce((sum, c) => sum + c.count, 0)}
              active={!category}
              onClick={() => onPickCategory("")}
            />
            {categories.map((c) => (
              <SidebarRow
                key={c.slug}
                label={c.label}
                count={c.count}
                accent={c.accent}
                active={category === c.slug}
                onClick={() => onPickCategory(c.slug)}
              />
            ))}
          </ul>
        </SidebarBlock>

        {/* ── Popular tags ───────────────────────────────────────── */}
        <SidebarBlock title={t("page.popularTags")} icon={Tag}>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(({ tag: t }) => {
              const active = tag === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPickTag(active ? "" : t)}
                  className={[
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30",
                    active
                      ? "border-violet bg-violet text-white shadow-[0_4px_14px_-4px_rgba(93,63,211,0.5)]"
                      : "border-charcoal-80/12 bg-white text-charcoal-80/75 hover:border-violet/40 hover:bg-violet-pale/40 hover:text-violet",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </SidebarBlock>

        {/* ── Recent posts ───────────────────────────────────────── */}
        <SidebarBlock title={t("page.recentPosts")} icon={TrendingUp}>
          <ul role="list" className="flex flex-col gap-3">
            {recentPosts.map((p) => (
              <li key={p.slug}>
                <Link
                  to={`/blog/${p.slug}`}
                  className="group block rounded-lg p-2 -mx-2 transition hover:bg-violet-pale/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                >
                  <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-charcoal-80 group-hover:text-violet">
                    {p.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-charcoal-80/50">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    {formatDate(p.publishedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SidebarBlock>

        {/* ── Archive ────────────────────────────────────────────── */}
        <SidebarBlock title="Archive" icon={Archive}>
          <ul role="list" className="flex flex-col">
            {archive.map((entry) => (
              <li key={entry.key}>
                <Link
                  to={`/blog?q=${encodeURIComponent(entry.label)}`}
                  className="group flex items-center justify-between rounded-md px-2 py-1.5 -mx-2 text-[12.5px] text-charcoal-80/70 transition hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-charcoal-80/30 group-hover:text-violet" aria-hidden="true" />
                    {entry.label}
                  </span>
                  <span className="rounded-full bg-charcoal-80/[0.06] px-1.5 py-0.5 text-[10.5px] font-mono tabular-nums text-charcoal-80/55 group-hover:bg-violet/10 group-hover:text-violet">
                    {entry.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SidebarBlock>

        {/* ── Newsletter mini-CTA ───────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-violet/20 bg-gradient-to-br from-violet to-violet-deep p-5 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] backdrop-blur">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t("page.stayInLoop")}
            </div>
            <h3 className="mt-3 text-[16px] font-bold leading-tight">
              {t("page.newsletterTitle")}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/80">
              {t("page.newsletterBody")}
            </p>
            <form onSubmit={handleNewsletter} className="mt-4 flex flex-col gap-2">
              <label htmlFor="blog-sidebar-newsletter" className="sr-only">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/55" aria-hidden="true" />
                <input
                  id="blog-sidebar-newsletter"
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/25 bg-white/10 py-2 pl-9 pr-3 text-[12.5px] text-white placeholder-white/45 outline-none backdrop-blur transition focus:border-terracotta/60 focus:bg-white/15 focus:ring-[3px] focus:ring-terracotta/30"
                />
              </div>
              <button
                type="submit"
                disabled={newsletterLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-terracotta px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-terracotta/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 disabled:opacity-60"
              >
                {newsletterLoading ? "Joining…" : "Subscribe"}
                {!newsletterLoading && (
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </form>
            <div className="min-h-[16px] mt-2" aria-live="polite">
              {newsletterStatus.kind === "success" ? (
                <p className="text-[11.5px] font-medium text-terracotta">
                  ✓ {newsletterStatus.message}
                </p>
              ) : null}
              {newsletterStatus.kind === "error" ? (
                <p className="text-[11.5px] font-medium text-rose-200">
                  {newsletterStatus.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ── Sidebar building blocks ──────────────────────────────────────────── */

function SidebarBlock({ title, icon: Icon, children }) {
  return (
    <section>
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
        {Icon ? <Icon className="h-3 w-3 text-violet" aria-hidden="true" /> : null}
        {title}
      </h3>
      {children}
    </section>
  )
}

function SidebarRow({ label, count, accent, active, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={[
          "group flex w-full items-center justify-between rounded-md px-2 py-1.5 -mx-2 text-left text-[13px] transition",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30",
          active
            ? "bg-violet-pale/70 font-semibold text-violet"
            : "text-charcoal-80/75 hover:bg-violet-pale/40 hover:text-violet",
        ].join(" ")}
      >
        <span className="inline-flex items-center gap-2">
          {accent ? (
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
          ) : null}
          {label}
        </span>
        <span
          className={[
            "rounded-full px-1.5 py-0.5 text-[10.5px] font-mono tabular-nums",
            active ? "bg-violet/15 text-violet" : "bg-charcoal-80/[0.06] text-charcoal-80/55",
          ].join(" ")}
        >
          {count}
        </span>
      </button>
    </li>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ACTIVE FILTER BAR
   ════════════════════════════════════════════════════════════════════════ */

function ActiveFilterBar({
  category, tag, query,
  onClearCategory, onClearTag, onClearQuery,
}) {
  const { t } = useTranslation("blog")
  const cat = categoryByValue(category)
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-violet/15 bg-violet-pale/30 px-4 py-3">
      <Filter className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-violet">
        {t("page.activeFilters")}
      </span>
      {cat ? (
        <FilterChip onRemove={onClearCategory}>
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: cat.accent }}
          />
          {cat.label}
        </FilterChip>
      ) : null}
      {tag ? <FilterChip onRemove={onClearTag}>#{tag}</FilterChip> : null}
      {query ? <FilterChip onRemove={onClearQuery}>"{query}"</FilterChip> : null}
    </div>
  )
}

function FilterChip({ children, onRemove }) {
  const { t } = useTranslation("blog")
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-white px-3 py-1 text-[12px] font-medium text-violet shadow-sm">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("page.removeFilterAria")}
        className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-violet/65 transition hover:bg-violet/10 hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/30"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   FEATURED CARD · large hero card above the grid
   ════════════════════════════════════════════════════════════════════════ */

function FeaturedCard({ post, reduce }) {
  const { t } = useTranslation("blog")
  const cat = categoryByValue(post.category)
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-3xl border border-charcoal-80/10 bg-white shadow-[0_18px_50px_-20px_rgba(93,63,211,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-20px_rgba(93,63,211,0.30)]"
    >
      <Link
        to={`/blog/${post.slug}`}
        className="grid items-stretch md:grid-cols-[5fr_7fr]"
      >
        <CoverArt
          post={post}
          className="aspect-[16/10] md:aspect-auto md:h-full"
        />
        <div className="flex flex-col gap-4 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/12 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-terracotta-deep">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Featured
            </span>
            {cat ? <CategoryPill category={cat} /> : null}
          </div>
          <h2 className="text-[clamp(22px,2.4vw,28px)] font-bold leading-tight tracking-tight text-violet group-hover:text-violet-deep">
            {post.title}
          </h2>
          <p className="text-[14.5px] leading-7 text-charcoal-80/70">
            {post.excerpt}
          </p>
          <PostMeta post={post} />
          <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-violet">
            {t("page.readArticle")}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </motion.article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   POST CARD · grid item
   ════════════════════════════════════════════════════════════════════════ */

function PostCard({ post }) {
  const cat = categoryByValue(post.category)
  return (
    // Phase 10b · entrance motion now lives one level up in StaggerGrid's
    // <li> wrapper; this article is the static content layer underneath.
    <article
      className="group relative flex min-h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_18px_46px_-16px_rgba(93,63,211,0.20)]"
    >
      <Link to={`/blog/${post.slug}`} className="flex h-full flex-col">
        <CoverArt post={post} className="aspect-[16/10]" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          {cat ? <CategoryPill category={cat} /> : null}
          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-violet group-hover:text-violet-deep">
            {post.title}
          </h3>
          <p className="line-clamp-3 text-[13.5px] leading-6 text-charcoal-80/65">
            {post.excerpt}
          </p>
          <div className="mt-auto pt-3">
            <PostMeta post={post} compact />
          </div>
        </div>
      </Link>
    </article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COVER ART · uses real cover image when present, else a brand gradient
   ════════════════════════════════════════════════════════════════════════ */

function CoverArt({ post, className = "" }) {
  const cat = categoryByValue(post.category)
  if (post.cover) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={post.cover}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-violet/20 via-transparent to-terracotta/10"
        />
      </div>
    )
  }
  // Fallback: gradient cover keyed off the category accent. Renders an
  // editorial-feeling block even when no image is set yet.
  const accent = cat?.accent || "#5D3FD3"
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background:
          `radial-gradient(at 0% 0%, ${accent}55 0px, transparent 55%), ` +
          `radial-gradient(at 100% 100%, rgba(233,196,106,0.30) 0px, transparent 50%), ` +
          `linear-gradient(135deg, #1A1B23 0%, #3B2487 45%, ${accent} 110%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
      />
      <div className="relative flex h-full items-center justify-center p-8">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.28em] text-white/85">
          {cat?.label || "Article"}
        </span>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   META BITS
   ════════════════════════════════════════════════════════════════════════ */

function CategoryPill({ category }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-pale/70 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet"
      style={{ backgroundColor: `${category.accent}15`, color: category.accent }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: category.accent }}
      />
      {category.label}
    </span>
  )
}

function PostMeta({ post, compact = false }) {
  const { t } = useTranslation("blog")
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-charcoal-80/55">
      <span className="inline-flex items-center gap-1.5">
        <img
          src={post.author.avatar}
          alt=""
          className="h-5 w-5 rounded-full object-cover ring-1 ring-charcoal-80/10"
          loading="lazy"
        />
        <span className="font-medium text-charcoal-80/75">
          {post.author.name}
        </span>
      </span>
      {compact ? null : <Dot />}
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" aria-hidden="true" />
        {formatDate(post.publishedAt)}
      </span>
      <Dot />
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {post.readMinutes} {t("page.minRead")}
      </span>
    </div>
  )
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-charcoal-80/25">·</span>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PAGINATION
   ════════════════════════════════════════════════════════════════════════ */

function Pagination({ page, total, onChange }) {
  const { t } = useTranslation("blog")
  const pages = []
  for (let i = 1; i <= total; i++) pages.push(i)
  return (
    <nav
      aria-label={t("page.paginationAria")}
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
    >
      <PageButton disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹ Prev
      </PageButton>
      {pages.map((p) => (
        <PageButton key={p} active={p === page} onClick={() => onChange(p)}>
          {p}
        </PageButton>
      ))}
      <PageButton disabled={page === total} onClick={() => onChange(page + 1)}>
        Next ›
      </PageButton>
    </nav>
  )
}

function PageButton({ children, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30",
        active
          ? "bg-violet text-white shadow-[0_6px_18px_-6px_rgba(93,63,211,0.45)]"
          : "border border-charcoal-80/12 bg-white text-charcoal-80/75 hover:border-violet/40 hover:text-violet",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ════════════════════════════════════════════════════════════════════════ */

function EmptyState({ onClear }) {
  const { t } = useTranslation("blog")
  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-charcoal-80/15 bg-charcoal-80/[0.02] px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-pale text-violet">
        <Search className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-[18px] font-bold text-violet">{t("page.noMatchTitle")}</h3>
      <p className="max-w-md text-[13.5px] leading-6 text-charcoal-80/65">
        {t("page.noMatchBody")}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        {t("page.clearFilters2")}
      </button>
    </div>
  )
}
