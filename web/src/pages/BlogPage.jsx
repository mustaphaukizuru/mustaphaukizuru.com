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

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { m, useReducedMotion } from "framer-motion"
import {
  Search, Tag, Calendar, Clock, ArrowRight, X, Mail, Filter,
  TrendingUp, Folder, Archive, ChevronRight, BookOpen, Sparkles,
  LayoutList, Settings2, Code2, GraduationCap, FlaskConical,
  Briefcase, Package, FileText,
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
import BlogCoverGradient from "../components/BlogCoverGradient"
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

function formatDate(iso, locale = "en-US") {
  return new Date(iso).toLocaleDateString(locale, {
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

  // Local input state — committed to URL only on submit, so we don't
  // re-render the whole grid on every keystroke.
  const [search, setSearch] = useState(queryParam)
  useEffect(() => { setSearch(queryParam) }, [queryParam])

  // Sort control — does not touch the URL (filter-only URL contract)
  const [sort, setSort] = useState("latest")

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

  // Sort the post list without touching URL state
  const sortedGridSource = useMemo(() => {
    const src = [...gridSource]
    if (sort === "shortest") return src.sort((a, b) => a.readMinutes - b.readMinutes)
    if (sort === "oldest")   return src.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
    return src // "latest" — already date-desc from getAllPosts()
  }, [gridSource, sort])

  // Load-more state (replaces numbered pagination)
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE)
  useEffect(() => { setVisibleCount(POSTS_PER_PAGE) }, [queryParam, categoryParam, tagParam, sort])
  const pagePosts = sortedGridSource.slice(0, visibleCount)
  const hasMore   = visibleCount < sortedGridSource.length

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
    setSort("latest")
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
          <m.div
            variants={reduce ? undefined : stagger}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex flex-col items-center gap-5 py-16 text-center sm:py-20 lg:py-24"
          >
            <m.span
              variants={fadeUp}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-violet/[0.06] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-violet backdrop-blur-sm"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {t("page.title")}
            </m.span>

            <m.h1
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
            </m.h1>

            <m.p
              variants={fadeUp}
              className="max-w-2xl text-[15px] leading-7 text-charcoal-80/70 sm:text-[16px]"
            >
              {t("page.subtitle")}
            </m.p>

            {/* Hero search — primary discovery entry point */}
            <m.form
              variants={fadeUp}
              onSubmit={(e) => {
                e.preventDefault()
                applyFilter({ q: search || null })
              }}
              className="relative w-full max-w-lg"
            >
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("page.searchPlaceholder", { count: allPosts.length })}
                aria-label={t("page.searchAria")}
                title="Press / to search"
                className="w-full rounded-2xl border border-charcoal-80/12 bg-white py-3.5 pl-11 pr-28 text-[14px] text-charcoal-80 shadow-[0_8px_32px_-8px_rgba(93,63,211,0.15)] placeholder-charcoal-80/40 outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/20 sm:text-[15px]"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40"
              >
                {t("page.searchButton")}
              </button>
            </m.form>

            {/* Result meta — shows filter context when active */}
            <m.div
              variants={fadeUp}
              className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[12.5px]"
            >
              <span className="text-charcoal-80/55">
                {t("page.articleCount", { count: filtered.length })}
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
            </m.div>
          </m.div>
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

              {/* Inline newsletter strip — sits between featured card and
                  article list only when no filter is active. */}
              {!hasActiveFilter && featuredPost ? (
                <BlogInlineNewsletter />
              ) : null}

              {/* Section divider with sort control */}
              {pagePosts.length > 0 ? (
                <div className="mt-10 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-80/10 pb-3">
                  <h2 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
                    <LayoutList className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
                    {hasActiveFilter
                      ? `${sortedGridSource.length} result${sortedGridSource.length !== 1 ? "s" : ""}`
                      : `All articles · ${sortedGridSource.length}`}
                  </h2>
                  {/* Sort toggle — only shown when no filter so it's unambiguous */}
                  {!hasActiveFilter && (
                    <div
                      role="group"
                      aria-label="Sort articles"
                      className="inline-flex items-center rounded-full border border-charcoal-80/10 bg-white p-0.5"
                    >
                      {[
                        { key: "latest",   label: "Latest" },
                        { key: "shortest", label: "Shortest" },
                        { key: "oldest",   label: "Oldest" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSort(opt.key)}
                          aria-pressed={sort === opt.key}
                          className={[
                            "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
                            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30",
                            sort === opt.key
                              ? "bg-violet text-white shadow-sm"
                              : "text-charcoal-80/55 hover:text-violet",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Article list — horizontal cards, full editorial width */}
              {pagePosts.length === 0 ? (
                <EmptyState onClear={clearFilters} />
              ) : (
                <StaggerGrid
                  as="ul"
                  itemAs="li"
                  role="list"
                  className="flex flex-col gap-4"
                  stagger={0.055}
                >
                  {pagePosts.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </StaggerGrid>
              )}

              {/* Load more — replaces numbered pagination */}
              {hasMore ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + POSTS_PER_PAGE)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-violet/30 bg-white px-7 py-3 text-[13px] font-bold text-violet transition hover:border-violet hover:bg-violet-pale/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Load more articles
                  </button>
                </div>
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
  const searchRef = useRef(null)
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [newsletterStatus, setNewsletterStatus] = useState({ kind: null, message: "" })
  const [newsletterLoading, setNewsletterLoading] = useState(false)

  // Press "/" anywhere on the page to jump focus to the search box.
  // Ignored when the user is already typing in an input/textarea.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="React · MercadoPago · STEM…"
              aria-label={t("page.searchAria")}
              title="Press / to search"
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
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40 disabled:opacity-60"
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
   FEATURED CARD · large hero card above the article list
   ════════════════════════════════════════════════════════════════════════ */

function FeaturedCard({ post, reduce }) {
  const { t, i18n } = useTranslation("blog")
  const locale = i18n.language === "es" ? "es-MX" : "en-US"
  const cat = categoryByValue(post.category)
  return (
    <m.article
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
          {/* Badge row + read-time */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/12 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-terracotta-deep">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t("list.featured")}
              </span>
              {cat ? <CategoryPill category={cat} /> : null}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-charcoal-80/[0.06] px-2.5 py-1 font-mono text-[10.5px] text-charcoal-80/55">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {post.readMinutes} min
            </span>
          </div>

          {/* Title */}
          <h2 className="text-[clamp(22px,2.4vw,28px)] font-bold leading-tight tracking-tight text-violet group-hover:text-violet-deep">
            {post.title}
          </h2>

          {/* Author byline — elevated to mid-card so it reads as a byline */}
          <div className="flex items-center gap-2.5">
            <img
              src={post.author.avatar}
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-1 ring-charcoal-80/10"
              loading="lazy"
            />
            <div>
              <p className="text-[13px] font-semibold text-charcoal-80/85">
                {post.author.name}
              </p>
              <p className="text-[11.5px] text-charcoal-80/50">
                {formatDate(post.publishedAt, locale)}
              </p>
            </div>
          </div>

          <p className="text-[14.5px] leading-7 text-charcoal-80/70">
            {post.excerpt}
          </p>

          <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-violet">
            {t("page.readArticle")}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </m.article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   POST CARD · horizontal list item (thumb-left, content-right)
   ════════════════════════════════════════════════════════════════════════ */

function PostCard({ post }) {
  const { i18n } = useTranslation("blog")
  const locale = i18n.language === "es" ? "es-MX" : "en-US"
  const cat = categoryByValue(post.category)
  const displayTags = post.tags?.slice(0, 2) || []
  return (
    <article className="group overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white transition hover:border-violet/25 hover:shadow-[0_12px_36px_-12px_rgba(93,63,211,0.18)]">
      <Link to={`/blog/${post.slug}`} className="flex h-full items-stretch">
        {/* Thumbnail — fixed width, full-height cover art */}
        <div className="w-28 shrink-0 sm:w-40">
          <CoverArt post={post} className="h-full rounded-none rounded-l-2xl" />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
          {/* Category + date row */}
          <div className="flex flex-wrap items-center gap-2">
            {cat ? <CategoryPill category={cat} /> : null}
            <span className="hidden font-mono text-[10.5px] text-charcoal-80/40 sm:block">
              {formatDate(post.publishedAt, locale)}
            </span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-violet group-hover:text-violet-deep sm:text-[16px]">
            {post.title}
          </h3>

          {/* Excerpt — hidden on narrow screens */}
          <p className="hidden line-clamp-2 text-[13px] leading-6 text-charcoal-80/60 sm:block">
            {post.excerpt}
          </p>

          {/* Tag chips — hidden on mobile, max 2 */}
          {displayTags.length > 0 && (
            <div className="hidden items-center gap-1.5 sm:flex">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-charcoal-80/[0.05] px-2 py-0.5 font-mono text-[10px] tracking-wide text-charcoal-80/50"
                >
                  {tag}
                </span>
              ))}
              {(post.tags?.length || 0) > 2 && (
                <span className="font-mono text-[10px] text-charcoal-80/35">
                  +{post.tags.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Meta + read link */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <PostMeta post={post} compact />
            <span className="hidden shrink-0 items-center gap-1 text-[12px] font-bold text-violet sm:inline-flex">
              Read
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COVER ART · real image OR brand-consistent icon tile (no dark gradient)
   ════════════════════════════════════════════════════════════════════════ */

const CATEGORY_ICONS = {
  "it-strategy":    Settings2,
  "web-development": Code2,
  "edtech":         GraduationCap,
  "stem-education": FlaskConical,
  "career":         Briefcase,
  "product-updates": Package,
}

function CoverArt({ post, className = "" }) {
  const cat = categoryByValue(post.category)
  if (post.cover) {
    return (
      <div className={`relative overflow-hidden bg-violet-pale/40 ${className}`}>
        {/* Full-bleed thumbnail — object-cover fills the card frame edge to
            edge (the standard, clean grid look). Upload covers at 16:9 so the
            center crop stays flattering. */}
        <img
          src={post.cover}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-violet/15 via-transparent to-terracotta/8"
        />
      </div>
    )
  }
  // Fallback: brand-generated gradient cover — beautiful, unique per category.
  return (
    <BlogCoverGradient
      title={post.title}
      category={cat?.label || ""}
      accent={cat?.accent || "#5D3FD3"}
      readMinutes={post.readMinutes}
      aspectRatio={undefined}
      className={`h-full ${className}`}
    />
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
   INLINE NEWSLETTER STRIP · sits between featured card and article list
   ════════════════════════════════════════════════════════════════════════ */

function BlogInlineNewsletter() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState({ kind: null, message: "" })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    try {
      setLoading(true)
      const res = await apiRequest("/api/newsletter", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setStatus({ kind: "success", message: res.message || "You're in." })
      setEmail("")
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          (err && typeof err.toUserMessage === "function" && err.toUserMessage()) ||
          "Subscription failed — try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="mt-8 overflow-hidden rounded-2xl"
      style={{ background: "linear-gradient(135deg, #5D3FD3, #0284C7)" }}
    >
      <div className="flex flex-col items-start gap-5 px-6 py-6 sm:flex-row sm:items-center sm:gap-8 sm:px-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/60">
            Stay in the loop
          </p>
          <h3 className="mt-1 text-[17px] font-bold text-white">
            New articles, every week.
          </h3>
          <p className="mt-0.5 text-[13px] text-white/70">
            Tech strategy, dev tutorials, and STEM insights — no spam.
          </p>
        </div>
        {status.kind === "success" ? (
          <p className="shrink-0 text-[13px] font-semibold text-white">
            ✓ {status.message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full shrink-0 gap-2 sm:w-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-label="Email address"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[13px] text-white placeholder-white/45 outline-none backdrop-blur transition focus:border-white/55 focus:bg-white/15 sm:w-52"
            />
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-violet transition hover:bg-violet-pale disabled:opacity-60"
            >
              {loading ? "…" : "Subscribe"}
            </button>
          </form>
        )}
      </div>
      {status.kind === "error" ? (
        <p className="px-6 pb-3 text-[11.5px] text-rose-200">{status.message}</p>
      ) : null}
    </div>
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
