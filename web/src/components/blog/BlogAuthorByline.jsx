import { Link } from "react-router-dom"
import { ArrowRight, Linkedin, BookOpen } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * BlogAuthorByline · full author card at the foot of every article.
 * Shows avatar, name, role, short bio, LinkedIn link, "View all posts"
 * filter link, and the primary "Get in touch" CTA.
 */
export default function BlogAuthorByline({ author }) {
  const { t } = useTranslation("blog")
  return (
    <aside
      aria-label={t("author.aria")}
      className="mt-14 overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_8px_32px_-12px_rgba(93,63,211,0.15)]"
    >
      {/* Accent strip */}
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, #5D3FD3, #0284C7)" }}
      />

      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-7">
        {/* Avatar — wrapper div guarantees h/w even inside a flex-row
            (bare <img> can flex-stretch past its declared dimensions) */}
        <div className="h-16 w-16 shrink-0 self-start overflow-hidden rounded-full ring-2 ring-violet/20">
          <img
            src={author.avatar}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-charcoal-80/45">
            {t("author.writtenBy")}
          </p>
          <p className="mt-0.5 text-[17px] font-bold text-violet">{author.name}</p>
          <p className="text-[12.5px] font-medium text-charcoal-80/55">{author.role}</p>

          {author.bio ? (
            <p className="mt-3 text-[13.5px] leading-6 text-charcoal-80/70">
              {author.bio}
            </p>
          ) : null}

          {/* Action row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(93,63,211,0.55)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
            >
              {t("author.getInTouch")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 rounded-full border border-charcoal-80/15 bg-white px-4 py-2 text-[12.5px] font-semibold text-charcoal-80/70 transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              All articles
            </Link>

            {author.linkedin ? (
              <a
                href={author.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-80/12 bg-white text-charcoal-80/55 transition hover:border-azure/40 hover:text-azure focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}
