/* Single funnel CTA: "Book a 30-min call" → /book?service=<slug>.
 * `BookCallButton` is the inline button; `StickyBookBar` is the page-level
 * bar that appears once the reader scrolls past the hero. */
import { useEffect, useState } from "react"
import { LocalizedLink as Link } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { Calendar, ArrowRight } from "lucide-react"
import { bookHref } from "../../data/servicesCatalogue"

export function BookCallButton({ slug = null, size = "md", tone = "violet", label, className = "" }) {
  const { t } = useTranslation("services")
  const sizes = { sm: "px-4 py-2 text-[13px]", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3.5 text-[15px]" }
  const tones = {
    violet: "bg-violet text-white hover:bg-violet-deep",
    white: "bg-white text-violet hover:bg-violet-pale",
    outline: "border border-violet/30 bg-transparent text-violet hover:bg-violet-pale",
  }
  return (
    <Link
      to={bookHref(slug)}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold shadow-[var(--shadow-lift-4)] transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${sizes[size] || sizes.md} ${tones[tone] || tones.violet} ${className}`}
    >
      <Calendar className="h-4 w-4" aria-hidden="true" />
      {label || t("funnel.cta")}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}

export function StickyBookBar({ slug = null, title }) {
  const { t } = useTranslation("services")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      aria-hidden={!visible || undefined}
      inert={!visible || undefined}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${visible ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-t border-violet/15 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgb(var(--color-charcoal-rgb)/0.10)] backdrop-blur sm:px-6 lg:mb-4 lg:rounded-2xl lg:border lg:px-6">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-violet">{title || t("funnel.stickyTitle")}</div>
          <div className="hidden text-micro text-charcoal-80/65 sm:block">{t("funnel.stickyBody")}</div>
        </div>
        <BookCallButton slug={slug} size="sm" />
      </div>
    </div>
  )
}
