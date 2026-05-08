/* ════════════════════════════════════════════════════════════════════════
   BlogPostPage.jsx — I18N · Phase 121A
   Strings keyed under `blog.post.*`. Article body content (post.title,
   post.excerpt, post.body) stays as-is; the i18n layer wraps only the
   chrome (back link, share/tags labels, related posts, meta line).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Tag, Share2,
} from "lucide-react"

import Container from "../components/system/Container"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { SITE_URL } from "../seo/siteSeo"
import SocialLinks from "../components/SocialLinks"
import BlogContentRenderer from "../components/blog/BlogContentRenderer"
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

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(localeTag, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <>
      <Seo
        title={`${post.title} · ${t("post.seo.titleSuffix")}`}
        description={post.excerpt}
        type="article"
        canonical={`/blog/${post.slug}`}
        image={post.cover || undefined}
      />
      <div className="border-b border-[#EFF1F5] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* Back-to-blog rail */}
      <div className="border-b border-charcoal-80/10 bg-white">
        <Container>
          <div className="flex items-center justify-between py-4">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("post.rail.back")}
            </Link>
            <span className="text-[12px] text-charcoal-80/50">
              {category?.label || t("post.rail.fallbackKind")}
            </span>
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
              <span className="inline-flex items-center gap-1.5">
                <img
                  src={post.author.avatar}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-charcoal-80/10"
                />
                <span className="font-medium text-charcoal-80/80">
                  {post.author.name}
                </span>
              </span>
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
              <BlogContentRenderer blocks={post.body} />
              <BlogAuthorByline author={post.author} />
            </article>

            {/* Article rail */}
            <aside aria-label={t("post.rail.shareAria")} className="lg:sticky lg:top-24 lg:self-start">
              <div className="flex flex-col gap-6">
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

      {/* Related posts */}
      {related.length > 0 ? (
        <section className="border-t border-charcoal-80/10 bg-charcoal-80/[0.02]">
          <Container py="md">
            <h2 className="mb-6 text-[20px] font-bold text-violet">
              {t("post.related.title", { label: category?.label || t("post.related.fallbackLabel") })}
            </h2>
            <ul role="list" className="grid gap-5 sm:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    to={`/blog/${p.slug}`}
                    className="group block rounded-2xl border border-charcoal-80/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_14px_36px_-14px_rgba(93,63,211,0.20)]"
                  >
                    <h3 className="line-clamp-2 text-[15.5px] font-bold text-violet group-hover:text-violet-deep">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-charcoal-80/65">
                      {p.excerpt}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-violet">
                      {t("post.related.readArticle")}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  )
}
