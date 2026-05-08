import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { useTranslation } from "react-i18next"
/**
 * BlogAuthorByline · sits at the foot of the article body.
 * Promotes the contact CTA so engaged readers can convert in one tap.
 */
export default function BlogAuthorByline({ author }) {
  const { t } = useTranslation("blog")
  return (
    <aside
      aria-label={t("author.aria")}
      className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_8px_24px_-12px_rgba(93,63,211,0.18)] sm:flex-row sm:items-center sm:gap-5 sm:p-6"
    >
      <img
        src={author.avatar}
        alt=""
        className="h-14 w-14 rounded-full object-cover ring-1 ring-charcoal-80/10"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
          {t("author.writtenBy")}
        </p>
        <p className="mt-0.5 text-[16px] font-bold text-violet">{author.name}</p>
        <p className="mt-1 text-[13px] leading-6 text-charcoal-80/65">
          {author.role}
        </p>
      </div>
      <Link
        to="/contact"
        className="inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
      >
        {t("author.getInTouch")}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </aside>
  )
}
