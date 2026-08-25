import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ArrowRight, Calendar } from "lucide-react"
import { apiRequest } from "../../lib/api"
import { getAllPosts, BLOG_CATEGORIES } from "../../data/blogPostsData"
import BlogCoverGradient from "../BlogCoverGradient"
import { Container, SectionHeading, SectionLink } from "./primitives"
import { TOKENS } from "../../styles/tokens.js"

/** LatestPosts · three newest articles (API first, bundled data as fallback). */
export default function LatestPosts() {
  const { t, i18n } = useTranslation("home")
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiRequest("/api/v1/blog?limit=3")
      .then((data) => {
        if (!cancelled && data?.posts?.length) setPosts(data.posts.slice(0, 3))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const displayPosts = posts || getAllPosts().slice(0, 3)
  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"

  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="home-blog-heading">
      <Container>
        <SectionHeading
          id="home-blog-heading"
          eyebrow={t("blog.eyebrow")}
          title={t("blog.title")}
          subtitle={t("blog.subtitle")}
          action={<SectionLink to="/blog" onWhite>{t("blog.cta")}</SectionLink>}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayPosts.map((post) => {
            const cat = BLOG_CATEGORIES.find((c) => c.slug === post.category)
            const date = post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
              : null
            return (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)] transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_16px_40px_-12px_rgb(var(--color-violet-rgb)/0.18)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <BlogCoverGradient
                  title={post.title}
                  category={cat?.label || ""}
                  accent={cat?.accent || TOKENS.violet}
                  readMinutes={post.readMinutes}
                  aspectRatio="16 / 7"
                />
                <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                  <h3 className="line-clamp-2 text-[16.5px] font-bold leading-snug text-violet group-hover:text-violet-deep">
                    {post.title}
                  </h3>
                  <p className="line-clamp-3 flex-1 text-[13px] leading-6 text-charcoal-80/65">{post.excerpt}</p>
                  <div className="flex items-center justify-between border-t border-charcoal-80/8 pt-3">
                    {date ? (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-charcoal-80/65">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {date}
                      </span>
                    ) : <span />}
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet">
                      {t("blog.read")}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <p className="mt-8 text-center text-[12px] text-charcoal-80/65">
          <a
            href="/feed.xml"
            className="font-mono text-violet underline underline-offset-2 transition hover:text-violet"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("blog.rss")}
          </a>
        </p>
      </Container>
    </section>
  )
}
