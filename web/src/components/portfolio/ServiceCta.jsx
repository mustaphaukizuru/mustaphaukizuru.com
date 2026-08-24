import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowRight, CalendarCheck } from "lucide-react"
import { bookHref } from "./caseStudy"

/** ServiceCta · "Book a call about a project like this" → /book?service=<slug> */
export default function ServiceCta({ serviceSlug }) {
  const { t } = useTranslation("portfolio")
  if (!serviceSlug) return null
  const label = t(`services.${serviceSlug}`)
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-violet p-6 text-white sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-azure/30 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-micro font-semibold uppercase tracking-[0.18em] text-terracotta">
            <CalendarCheck className="h-3 w-3" aria-hidden="true" /> {t("serviceCta.eyebrow")}
          </span>
          <h2 className="mt-3 text-subsection font-bold">{t("serviceCta.title")}</h2>
          <p className="mt-1 max-w-xl text-meta leading-6 text-white/75">
            {t("serviceCta.body", { service: label })}
          </p>
        </div>
        <Link
          to={bookHref(serviceSlug)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
        >
          {t("serviceCta.button")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
