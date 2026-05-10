import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft, ArrowRight, CheckCircle2, Star, Calendar, Clock,
  Sparkles, ChevronRight, Package, AlertCircle, FileText,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { serviceSchema, breadcrumbSchema } from "../seo/schemas"
import ServiceReviews from "../components/ServiceReviews"
import { useAuth } from "../context/AuthContext"
import { fetchServiceBySlug, orderServicePackage } from "../services/serviceService"

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

/* ────────────────────────────────────────────────────────────────────────────
 * ServiceDetailPage — route /services/:slug
 * ──────────────────────────────────────────────────────────────────────────── */

export default function ServiceDetailPage() {
  const { t } = useTranslation("services")
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Order flow state
  const [selectedPackageId, setSelectedPackageId] = useState(null)
  const [requirements, setRequirements] = useState("")
  const [preferredDate, setPreferredDate] = useState("")
  const [orderBusy, setOrderBusy] = useState(false)
  const [orderError, setOrderError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const data = await fetchServiceBySlug(slug)
        if (cancelled) return
        if (!data) { setError("Service not found"); return }
        setService(data)
        // Pre-select the first active package
        if (data.packages?.length) setSelectedPackageId(data.packages[0].id)
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load service")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  async function handleOrder() {
    setOrderError("")
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/services/${slug}` } })
      return
    }
    if (!selectedPackageId) {
      setOrderError("Please select a package.")
      return
    }
    setOrderBusy(true)
    try {
      const result = await orderServicePackage(slug, {
        packageId: selectedPackageId,
        requirements: requirements.trim() || undefined,
        preferredStartDate: preferredDate || undefined,
      })
      if (result?.redirectUrl) {
        navigate(result.redirectUrl)
      } else {
        navigate("/dashboard")
      }
    } catch (err) {
      setOrderError(err?.message || "Could not place order. Please try again.")
    } finally {
      setOrderBusy(false)
    }
  }

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Container className="py-10 sm:py-14">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/2 rounded-lg bg-violet-pale" />
            <div className="h-4 w-3/4 rounded bg-violet-pale/60" />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 rounded-xl bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)]" />
              ))}
            </div>
          </div>
        </Container>
      </div>
    )
  }

  /* ── Error ──────────────────────────────────────────────── */
  if (error || !service) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Container className="py-20">
          <div className="mx-auto max-w-md rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-section font-bold text-violet">{t("detail.errors.notFound")}</h1>
            <p className="mt-2 text-meta text-charcoal-80/70">
              {error || t("detail.errors.unavailable")}
            </p>
            <Link
              to="/services"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep"
            >
              <ArrowLeft className="h-4 w-4" /> {t("detail.errors.backToServices")}
            </Link>
          </div>
        </Container>
      </div>
    )
  }

  const selectedPackage = service.packages?.find((p) => p.id === selectedPackageId) || null

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-[60vh] bg-mist">
      <Seo
        title={service.metaTitle || `${service.title} · Mustapha Ukizuru`}
        description={service.metaDescription || service.shortDescription}
        jsonLd={[
          serviceSchema(service, `/services/${service.slug || ""}`),
          breadcrumbSchema([
            { name: "Services", url: "/services" },
            { name: service.title, url: `/services/${service.slug || ""}` },
          ]),
        ].filter(Boolean)}
      />
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* HERO */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-10 sm:py-14 lg:py-16">
          {/* Breadcrumbs */}
          <nav className="mb-5 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/55">
            <Link to="/" className="hover:text-violet">{t("detail.breadcrumb.home")}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/services" className="hover:text-violet">{t("detail.breadcrumb.services")}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-violet">{service.title}</span>
          </nav>

          <motion.div initial="hidden" animate="show" variants={stagger} className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <motion.div variants={fadeUp}>
              {service.isFeatured && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                  <Sparkles className="h-3 w-3" /> {t("detail.hero.featured")}
                </span>
              )}
              <h1 className="mt-3 text-page font-bold tracking-tight text-violet sm:text-page lg:text-display">
                {service.title}
              </h1>
              <p className="mt-4 max-w-2xl text-body leading-7 text-charcoal-80/75 sm:text-body">
                {service.shortDescription}
              </p>
              {service.fullDescription && (
                <p className="mt-4 max-w-2xl text-meta leading-7 text-charcoal-80/70">
                  {service.fullDescription}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 text-meta">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Clock className="h-3.5 w-3.5 text-violet" />
                  {service.deliveryType}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Package className="h-3.5 w-3.5 text-violet" />
                  {service.packages?.length || 0} {service.packages?.length === 1 ? t("detail.hero.packagesLabel") : t("detail.hero.packagesLabelPlural")}
                </span>
              </div>
            </motion.div>

            {/* Features panel */}
            {service.features?.length > 0 && (
              <motion.div variants={fadeUp} className="rounded-2xl border border-charcoal-80/10 bg-mist p-6">
                <div className="mb-4 flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-violet">
                  <Star className="h-3.5 w-3.5 fill-current" /> {t("detail.features.title")}
                </div>
                <ul className="space-y-3">
                  {service.features.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 text-meta">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2FA36B]" />
                      <span className="text-charcoal-80/80">{f.featureText}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </motion.div>
        </Container>
      </section>

      {/* PACKAGES */}
      {service.packages?.length > 0 && (
        <section className="py-14 sm:py-16 lg:py-20">
          <Container>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }} variants={fadeUp}>
              <div className="mb-10 flex flex-col items-center gap-3 text-center">
                <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                  {t("detail.packages.eyebrow")}
                </span>
                <h2 className="text-section font-bold tracking-tight text-violet sm:text-page">
                  {t("detail.packages.title")}
                </h2>
                <p className="max-w-2xl text-body leading-7 text-charcoal-80/70">
                  {t("detail.packages.subtitle")}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              variants={stagger}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {service.packages.map((pkg, idx) => {
                const isSelected = pkg.id === selectedPackageId
                const isMiddle = idx === 1 && service.packages.length >= 3

                return (
                  <motion.button
                    key={pkg.id}
                    variants={fadeUp}
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`relative flex flex-col rounded-xl border p-7 text-left transition-all ${
                      isSelected
                        ? "border-violet bg-violet text-white shadow-[0_24px_60px_rgba(93,63,211,0.28)]"
                        : "border-charcoal-80/12 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(93,63,211,0.12)]"
                    }`}
                  >
                    {isMiddle && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-1.5 text-micro font-bold text-violet-deep shadow-sm">
                          <Star className="h-3 w-3 fill-current" /> {t("detail.packages.mostPopular")}
                        </span>
                      </div>
                    )}
                    <div className={`text-micro font-semibold uppercase tracking-[0.2em] ${isSelected ? "text-white/60" : "text-charcoal-80/50"}`}>
                      {pkg.name}
                    </div>
                    {pkg.description && (
                      <div className={`mt-2 text-meta leading-6 ${isSelected ? "text-white/70" : "text-charcoal-80/70"}`}>
                        {pkg.description}
                      </div>
                    )}
                    <div className={`my-6 border-t ${isSelected ? "border-white/15" : "border-charcoal-80/10"}`} />
                    <div className={`text-page font-bold leading-none ${isSelected ? "text-white" : "text-violet"}`}>
                      {pkg.priceFormatted || `$${Number(pkg.price).toFixed(0)}`}
                    </div>
                    <div className={`mt-6 flex items-center justify-between text-meta font-semibold ${isSelected ? "text-white" : "text-violet"}`}>
                      <span>{isSelected ? t("detail.packages.selected") : t("detail.packages.select")}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 fill-current" />}
                    </div>
                  </motion.button>
                )
              })}
            </motion.div>
          </Container>
        </section>
      )}

      {/* ORDER FORM */}
      <section className="border-t border-charcoal-80/10 bg-white py-14 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl rounded-2xl border border-charcoal-80/10 bg-mist p-6 sm:p-10">
            <h2 className="text-section font-bold text-violet">{t("detail.order.title")}</h2>
            <p className="mt-2 text-meta text-charcoal-80/70">
              {t("detail.order.subtitle")}
            </p>

            {selectedPackage && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-violet/15 bg-violet-pale/40 px-4 py-3">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                <div className="min-w-0 flex-1 text-meta text-violet">
                  <div className="font-semibold">{selectedPackage.name}</div>
                  <div className="text-charcoal-80/75">{selectedPackage.priceFormatted || `$${selectedPackage.price}`}</div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-micro font-semibold text-charcoal-80">
                  {t("detail.order.requirementsLabel")}
                </label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={t("detail.order.requirementsPlaceholder")}
                  rows={5}
                  className="w-full rounded-xl border border-violet/15 bg-white px-3 py-2 text-meta text-violet placeholder:text-charcoal-80/35 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-micro font-semibold text-charcoal-80">
                  {t("detail.order.preferredDateLabel")}
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" />
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-violet/15 bg-white pl-9 pr-3 py-2 text-meta text-violet focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/10"
                  />
                </div>
              </div>
            </div>

            {orderError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-meta text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {orderError}
              </div>
            )}

            {!isAuthenticated && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-violet/15 bg-violet-pale/50 px-3 py-2 text-micro text-violet">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {t("detail.order.signinHint")}
              </div>
            )}

            <button
              type="button"
              onClick={handleOrder}
              disabled={!selectedPackageId || orderBusy}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-deep disabled:translate-y-0 disabled:opacity-50 sm:w-auto"
            >
              {orderBusy ? t("detail.order.submitting") : (
                <>
                  {t("detail.order.submitButton")} <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </Container>
      </section>

      {/* REVIEWS — Sprint 2: public review surface for services. Mounted
          before the related-services section so social proof reads while
          the visitor is still in decision mode. */}
      <section className="border-t border-charcoal-80/8 bg-white py-14 sm:py-16">
        <Container>
          <div className="mb-8 max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              {t("detail.reviews.eyebrow")}
            </span>
            <h2 className="mt-2 text-section font-bold text-violet">{t("detail.reviews.title")}</h2>
            <p className="mt-2 text-meta leading-6 text-charcoal-80/70">
              {t("detail.reviews.subtitle")}
            </p>
          </div>
          <ServiceReviews slug={service.slug} serviceTitle={service.title} />
        </Container>
      </section>

      {/* RELATED */}
      {Array.isArray(service.related) && service.related.length > 0 && (
        <section className="py-14 sm:py-16">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                  {t("detail.related.eyebrow")}
                </span>
                <h2 className="mt-2 text-section font-bold text-violet">{t("detail.related.title")}</h2>
              </div>
              <Link to="/services" className="hidden items-center gap-1 text-meta font-semibold text-violet hover:underline sm:inline-flex">
                {t("detail.related.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {service.related.map((r) => (
                <Link
                  key={r.id}
                  to={`/services/${r.slug}`}
                  className="group flex flex-col rounded-xl border border-charcoal-80/12 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.04)] transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[0_14px_34px_rgba(93,63,211,0.10)]"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="text-body font-bold text-violet transition-colors group-hover:text-violet-deep">
                    {r.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-meta leading-6 text-charcoal-80/70">
                    {r.shortDescription}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-micro font-semibold text-violet">{t("detail.learnMore", "Learn more")}<ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}
    </div>
  )
}
