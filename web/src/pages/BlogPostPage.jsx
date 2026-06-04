/* ════════════════════════════════════════════════════════════════════════
   BlogPostPage.jsx — I18N · Phase 121A
   Strings keyed under `blog.post.*`. Article body content (post.title,
   post.excerpt, post.body) stays as-is; the i18n layer wraps only the
   chrome (back link, share/tags labels, related posts, meta line).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Share2, CalendarCheck, Copy, Check,
} from "lucide-react"

import Container from "../components/system/Container"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { SITE_URL } from "../seo/siteSeo"
import SocialLinks from "../components/SocialLinks"
import BlogContentRenderer, { extractTOC } from "../components/blog/BlogContentRenderer"
import BlogAuthorByline from "../components/blog/BlogAuthorByline"
import { apiRequest } from "../lib/api"
import {
  BLOG_CATEGORIES,
  getPostBySlug,
  getRelatedPosts,
} from "../data/blogPostsData"

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ── Reading progress bar ────────────────────────────────────────────── */
function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    function onScroll() {
      const el  = document.documentElement
      const top = el.scrollTop || document.body.scrollTop
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? Math.min(100, (top / max) * 100) : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [reduce])

  if (reduce) return null
  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-50 h-[3px] origin-left transition-[width] duration-75"
      style={{
        width: `${progress}%`,
        background: "linear-gradient(90deg, #5D3FD3, #0284C7)",
      }}
    />
  )
}

/* ── Copy-link button ────────────────────────────────────────────────── */
function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link"
      className="inline-flex items-center gap-1.5 rounded-full border border-charcoal-80/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-charcoal-80/70 transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-mint" aria-hidden="true" />Copied</>
        : <><Copy className="h-3.5 w-3.5"           aria-hidden="true" />Copy link</>}
    </button>
  )
}

/* ── Table of contents ───────────────────────────────────────────────── */
function TableOfContents({ toc }) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    const ids = toc.map((h) => h.id)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [toc])

  if (toc.length < 2) return null
  return (
    <section>
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
        <ArrowRight className="h-3 w-3 text-violet" aria-hidden="true" />
        Contents
      </h3>
      <nav aria-label="Table of contents">
        <ul className="flex flex-col gap-0.5">
          {toc.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={[
                    "block rounded-lg py-1.5 text-[12.5px] leading-snug transition",
                    item.level === 3 ? "pl-4" : "pl-2",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30",
                    isActive
                      ? "font-semibold text-violet"
                      : "text-charcoal-80/55 hover:text-violet",
                  ].join(" ")}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet align-middle"
                    />
                  )}
                  {item.text}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </section>
  )
}

/* ── Back to top ─────────────────────────────────────────────────────── */
function BackToTop() {
  const [visible, setVisible] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    function onScroll() { setVisible(window.scrollY > 600) }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-violet text-white shadow-[0_8px_24px_-6px_rgba(93,63,211,0.55)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40"
    >
      <ArrowLeft className="h-4 w-4 rotate-90" aria-hidden="true" />
    </button>
  )
}

/* ── Mid-article consultation CTA ───────────────────────────────────── */
function MidArticleCTA() {
  return (
    <aside
      aria-label="Book a consultation"
      className="my-10 overflow-hidden rounded-2xl border border-violet/20 bg-gradient-to-r from-violet/[0.06] to-azure/[0.04] p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)]">
          <CalendarCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-violet">
            Working on something similar?
          </p>
          <p className="mt-0.5 text-[13px] text-charcoal-80/65">
            Book a free 30-minute strategy call — no pitch, just answers.
          </p>
        </div>
        <Link
          to="/book"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-violet px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
        >
          Book 30 min
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  )
}

function categoryByValue(slug) {
  return BLOG_CATEGORIES.find((c) => c.slug === slug) || null
}

export default function BlogPostPage() {
  const { t, i18n } = useTranslation("blog")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const { slug } = useParams()
  const reduce = useReducedMotion()

  const staticPost = useMemo(() => getPostBySlug(slug), [slug])
  const staticRelated = useMemo(() => getRelatedPosts(slug, 3), [slug])
  const [apiPost, setApiPost] = useState(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest(`/api/v1/blog/${encodeURIComponent(slug)}`)
        if (!cancelled && res?.post) setApiPost(res.post)
      } catch { /* fall back to static */ }
    })()
    return () => { cancelled = true }
  }, [slug])

  const post = apiPost || staticPost
  const related = staticRelated

  if (!post) return <Navigate to="/blog" replace />

  const category = categoryByValue(post.category)
  const url = `${SITE_URL}/blog/${post.slug}`
  const toc = useMemo(() => extractTOC(post.body), [post.body])

  // BlogPosting JSON-LD — injected per-article for Google rich results
  useEffect(() => {
    const id = "blog-post-jsonld"
    document.getElementById(id)?.remove()
    const script = document.createElement("script")
    script.type  = "application/ld+json"
    script.id    = id
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline:        post.title,
      description:     post.excerpt,
      datePublished:   post.publishedAt,
      image:           post.cover ? `${SITE_URL}${post.cover}` : `${SITE_URL}/og/og-default.png`,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      author: {
        "@type":    "Person",
        name:       post.author.name,
        jobTitle:   post.author.role,
        url:        SITE_URL,
      },
      publisher: {
        "@type": "Organization",
        name:    "MUSTAPHA UKIZURU",
        url:     SITE_URL,
      },
    })
    document.head.appendChild(script)
    return () => document.getElementById(id)?.remove()
  }, [post, url])

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(localeTag, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <>
      <ReadingProgress />
      <BackToTop />

      <Seo
        title={`${post.title} · ${t("post.seo.titleSuffix")}`}
        description={post.excerpt}
        type="article"
        canonical={`/blog/${post.slug}`}
        image={post.cover || undefined}
      />
      {/* Print-only header: title + canonical URL */}
      <div className="hidden print:block print:mb-6 print:border-b print:border-gray-200 print:pb-4">
        <p className="text-[11px] font-mono text-gray-400">{url}</p>
      </div>

      <div className="border-b border-slate-100 bg-white print:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* Back-to-blog rail + copy-link */}
      <div className="border-b border-charcoal-80/10 bg-white print:hidden">
        <Container>
          <div className="flex items-center justify-between py-4">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("post.rail.back")}
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden text-[12px] text-charcoal-80/50 sm:block">
                {category?.label || t("post.rail.fallbackKind")}
              </span>
              <CopyLinkButton url={url} />
            </div>
          </div>
        </Container>
      </div>

      {/* Article header */}
      <section className="bg-white">
        <Container size="md" py="md">
          <motion.header
            variants={fadeUp}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex flex-col gap-5 text-center"
          >
            {category ? (
              <span
                className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em]"
                style={{ backgroundColor: `${category.accent}15`, color: category.accent }}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: category.accent }}
                />
                {category.label}
              </span>
            ) : null}

            <h1 className="text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.018em] text-violet">
              {post.title}
            </h1>

            <p className="mx-auto max-w-2xl text-[15.5px] leading-7 text-charcoal-80/70">
              {post.excerpt}
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12.5px] text-charcoal-80/55">
              {/* Author — links to blog index (shows all their posts) */}
              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
              >
                <img
                  src={post.author.avatar}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-charcoal-80/10"
                />
                <span className="font-medium text-charcoal-80/80">
                  {post.author.name}
                </span>
              </Link>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(post.publishedAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {t("post.meta.minRead", { count: post.readMinutes })}
              </span>
            </div>
          </motion.header>
        </Container>
      </section>

      {/* Article body */}
      <section className="bg-white">
        <Container size="md">
          <div className="grid gap-10 lg:grid-cols-[1fr_220px] lg:gap-14">
            <article className="min-w-0">
              <BlogContentRenderer
                blocks={post.body}
                midCTA={
                  <div className="print:hidden">
                    <MidArticleCTA />
                  </div>
                }
              />
              <BlogAuthorByline author={post.author} />
            </article>

            {/* Article rail — TOC + Share + Tags (hidden when printing) */}
            <aside aria-label={t("post.rail.shareAria")} className="print:hidden lg:sticky lg:top-24 lg:self-start">
              <div className="flex flex-col gap-6">
                {/* Table of contents */}
                <TableOfContents toc={toc} />

                <section>
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
                    <Share2 className="h-3 w-3 text-violet" aria-hidden="true" />
                    {t("post.rail.share")}
                  </h3>
                  <SocialLinks
                    platforms={[
                      { key: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
                      { key: "x", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}` },
                      { key: "whatsapp", href: `https://wa.me/?text=${encodeURIComponent(post.title + ", " + url)}` },
                      { key: "email", href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}` },
                    ]}
                    variant="filled"
                    size="sm"
                    align="start"
                    ariaLabel={t("post.rail.shareAria")}
                  />
                </section>

                <section>
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
                    <Tag className="h-3 w-3 text-violet" aria-hidden="true" />
                    {t("post.rail.tags")}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/blog?tag=${encodeURIComponent(tag)}`}
                        className="inline-flex items-center rounded-full border border-charcoal-80/12 bg-white px-2.5 py-1 text-[11.5px] font-medium text-charcoal-80/75 transition hover:border-violet/40 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* Related posts (hidden when printing) */}
      {related.length > 0 ? (
        <section className="border-t border-charcoal-80/10 bg-charcoal-80/[0.02] print:hidden">
          <Container py="md">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="text-[20px] font-bold text-violet">
                {t("post.related.title", { label: category?.label || t("post.related.fallbackLabel") })}
              </h2>
              <Link
                to="/blog"
                className="text-[13px] font-semibold text-violet/70 transition hover:text-violet"
              >
                All articles →
              </Link>
            </div>
            <ul role="list" className="grid gap-5 sm:grid-cols-3">
              {related.map((p) => {
                const pCat = BLOG_CATEGORIES.find((c) => c.slug === p.category)
                return (
                  <li key={p.slug}>
                    <Link
                      to={`/blog/${p.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_14px_36px_-14px_rgba(93,63,211,0.20)]"
                    >
                      {/* Cover thumbnail */}
                      <div className="aspect-[16/9] overflow-hidden bg-violet-pale">
                        {p.cover ? (
                          <img
                            src={p.cover}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 rounded-full opacity-30"
                              style={{ backgroundColor: pCat?.accent || "#5D3FD3" }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2 p-4">
                        {/* Category + read time */}
                        <div className="flex items-center justify-between gap-2">
                          {pCat ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                              style={{ backgroundColor: `${pCat.accent}15`, color: pCat.accent }}
                            >
                              {pCat.label}
                            </span>
                          ) : null}
                          <span className="ml-auto font-mono text-[10.5px] text-charcoal-80/40">
                            {p.readMinutes} min
                          </span>
                        </div>

                        <h3 className="line-clamp-2 text-[14.5px] font-bold leading-snug text-violet group-hover:text-violet-deep">
                          {p.title}
                        </h3>

                        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-bold text-violet">
                          {t("post.related.readArticle")}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  )
}
