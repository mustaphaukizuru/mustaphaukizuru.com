import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  ArrowLeft, ArrowRight, ExternalLink, Github, Calendar, Briefcase,
  CheckCircle2, AlertCircle, Sparkles, ChevronRight, Tag,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { creativeWorkSchema, breadcrumbSchema } from "../seo/schemas"
import { fetchPortfolioBySlug } from "../services/portfolioService"
import { useTranslation } from "react-i18next"
import { aboutProjects } from "../data/aboutProjectsData" // fallback when slug not in DB
import Lens from "../components/motion/Lens"
import OutcomeStats from "../components/portfolio/OutcomeStats"
import ApproachSteps from "../components/portfolio/ApproachSteps"
import ServiceCta from "../components/portfolio/ServiceCta"
import ProjectPager from "../components/portfolio/ProjectPager"
import { getCaseStudy, responsiveSrcSet } from "../components/portfolio/caseStudy"
import { STAGE_FRAME_CLASS } from "../components/ui/ContainerScroll"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectDetailPage · /projects/:slug  (roadmap step 27 — case study)
 *
 *  Order: hero → outcome stats → context / problem / approach / outcome →
 *  legacy challenge/solution/results (when no case-study block) → service
 *  CTA → prev/next → related.
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

/**
 * Adapt a hardcoded `aboutProjects` row to the API row shape.
 */
function adaptHardcoded(row) {
  if (!row) return null
  return {
    slug: row.slug,
    title: row.title,
    role: row.role || "Designer & developer",
    client: row.client || null,
    category: row.category || null,
    coverImage: row.coverImage || row.image || (row.images && row.images[0]) || null,
    gallery: row.gallery || row.images || (row.image ? [row.image] : []),
    shortDescription: row.shortDescription || row.description || "",
    description: row.fullDescription || row.description || "",
    challenge: row.challenge || null,
    solution: row.solution || null,
    results: row.results || null,
    tools: row.tools || row.tags || [],
    tags: row.tags || [],
    liveUrl: row.liveUrl || row.website || null,
    repoUrl: row.repoUrl || null,
    year: row.year || null,
    caseStudy: row.caseStudy || null,
  }
}

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

export default function ProjectDetailPage() {
  const { t } = useTranslation("portfolio")
  const { slug } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        let data = null
        try {
          data = await fetchPortfolioBySlug(slug)
        } catch {
          data = null
        }
        if (cancelled) return

        if (!data) {
          const fallback = aboutProjects.find((p) => p.slug === slug)
          if (fallback) data = adaptHardcoded(fallback)
        }

        if (!data) { setError(t("detail.notFound")); return }
        setProject(data)
        setActiveImage(0)
      } catch (err) {
        if (!cancelled) setError(err?.message || t("detail.notFound"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Container className="py-10 sm:py-14">
          <div className="animate-pulse space-y-6" role="status" aria-busy="true">
            <div className="h-4 w-48 rounded bg-violet-pale/60" />
            <div className="h-10 w-3/4 rounded-lg bg-violet-pale" />
            <div className="h-4 w-2/3 rounded bg-violet-pale/60" />
            <div className="mt-8 aspect-[16/9] rounded-2xl bg-white shadow-[var(--shadow-e4)]" />
          </div>
        </Container>
      </div>
    )
  }

  /* ── Error ──────────────────────────────────────────────── */
  if (error || !project) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Container className="py-20">
          <div className="mx-auto max-w-md rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-section font-bold text-violet">{t("detail.notFound")}</h1>
            <p className="mt-2 text-meta text-charcoal-80/70">{error || t("detail.notFoundBody")}</p>
            <Link
              to="/portfolio"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("detail.backToPortfolio")}
            </Link>
          </div>
        </Container>
      </div>
    )
  }

  const cs = getCaseStudy(project)
  const hasCaseStudy = Boolean(cs && (cs.problem || cs.context || cs.approach.length || cs.outcomes.length))
  const serviceLabel = cs?.serviceSlug ? t(`services.${cs.serviceSlug}`) : null

  const gallery = Array.isArray(project.gallery) && project.gallery.length > 0
    ? project.gallery
    : project.coverImage ? [project.coverImage] : []
  const displayImage = gallery[activeImage] || project.coverImage || null
  const heroSrcSet = responsiveSrcSet(displayImage)

  return (
    <div className="min-h-[60vh] bg-mist">
      <Seo
        title={project.metaTitle || `${project.title} · Mustapha Ukizuru`}
        description={project.metaDescription || project.shortDescription}
        jsonLd={[
          creativeWorkSchema(project, `/projects/${project.slug || ""}`),
          breadcrumbSchema([
            { name: t("detail.portfolio"), url: "/portfolio" },
            { name: project.title, url: `/projects/${project.slug || ""}` },
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
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/65">
            <Link to="/" className="hover:text-violet">{t("detail.home")}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link to="/portfolio" className="hover:text-violet">{t("detail.portfolio")}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-violet line-clamp-1">{project.title}</span>
          </nav>

          <m.div initial="hidden" animate="show" variants={stagger} className="flex flex-col gap-5">
            <m.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              {serviceLabel ? (
                <Link
                  to={`/portfolio?service=${cs.serviceSlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-white hover:bg-violet-deep"
                >
                  <Briefcase className="h-3 w-3" aria-hidden="true" /> {serviceLabel}
                </Link>
              ) : null}
              {project.category ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                  <Tag className="h-3 w-3" aria-hidden="true" /> {project.category}
                </span>
              ) : null}
              {project.isFeatured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 text-micro font-semibold text-violet-deep">
                  <Sparkles className="h-3 w-3" aria-hidden="true" /> {t("card.featured")}
                </span>
              ) : null}
            </m.div>
            <m.h1 variants={fadeUp} className="text-page font-bold leading-tight tracking-tight text-violet sm:text-page">
              {project.title}
            </m.h1>
            <m.p variants={fadeUp} className="max-w-3xl text-body leading-7 text-charcoal-80/75 sm:text-body">
              {project.shortDescription}
            </m.p>

            {/* Meta pills */}
            <m.div variants={fadeUp} className="flex flex-wrap gap-3 pt-2 text-micro">
              {project.role ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Briefcase className="h-3.5 w-3.5 text-violet" aria-hidden="true" /> {project.role}
                </span>
              ) : null}
              {project.client ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  {t("detail.client")}: <strong className="text-violet">{project.client}</strong>
                </span>
              ) : null}
              {project.duration ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Calendar className="h-3.5 w-3.5 text-violet" aria-hidden="true" /> {project.duration}
                </span>
              ) : null}
              {project.liveUrl ? (
                <a
                  href={project.liveUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet/25 bg-violet px-3 py-1.5 text-white transition hover:bg-violet-deep"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("detail.visitLive")}
                </a>
              ) : null}
              {project.repoUrl ? (
                <a
                  href={project.repoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-1.5 text-charcoal-80/75 transition hover:bg-violet-pale"
                >
                  <Github className="h-3.5 w-3.5 text-violet" aria-hidden="true" /> {t("detail.source")}
                </a>
              ) : null}
            </m.div>
          </m.div>
        </Container>
      </section>

      {/* HERO IMAGE / GALLERY — responsive WebP sources for bundled assets */}
      {displayImage ? (
        <section className="py-10 sm:py-14">
          <Container>
            {/* The same bezel the portfolio stages use (ui/ContainerScroll), held
                flat: this hero is where a stage's tilt hands off, and there is
                no scroll above the fold to drive one. */}
            <div className={`mx-auto w-full max-w-5xl ${STAGE_FRAME_CLASS}`}>
              {/* layoutId shared with ProjectShowcase's cover for the page transition */}
              <m.div layoutId={`project-cover-${slug}`} className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-violet-pale">
                {heroSrcSet ? (
                  <picture className="block h-full w-full">
                    <source type="image/webp" srcSet={heroSrcSet} sizes="(max-width: 1152px) 100vw, 1152px" />
                    <img
                      src={displayImage}
                      alt={t("detail.viewOf", { title: project.title, n: activeImage + 1 })}
                      decoding="async"
                      fetchPriority="high"
                      className="h-full w-full object-cover"
                    />
                  </picture>
                ) : (
                  <Lens
                    src={displayImage}
                    alt={t("detail.viewOf", { title: project.title, n: activeImage + 1 })}
                    className="h-full w-full"
                  />
                )}
              </m.div>
            </div>
            {gallery.length > 1 ? (
              <div className="mx-auto mt-4 flex max-w-5xl gap-3 overflow-x-auto">
                  {gallery.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImage(idx)}
                      aria-label={t("detail.showImage", { n: idx + 1 })}
                      aria-pressed={idx === activeImage}
                      className={`shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                        idx === activeImage ? "border-violet" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={src}
                        srcSet={responsiveSrcSet(src)}
                        sizes="96px"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-24 object-cover"
                      />
                    </button>
                  ))}
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* OUTCOME STATS — the headline numbers, before the narrative */}
      {cs?.outcomes.length ? (
        <section className={displayImage ? "pb-10" : "py-10"}>
          <Container>
            <h2 className="mb-4 text-micro font-semibold uppercase tracking-[0.2em] text-violet">{t("detail.outcome")}</h2>
            <OutcomeStats outcomes={cs.outcomes} />
          </Container>
        </section>
      ) : null}

      {/* CASE STUDY BODY */}
      <section className="pb-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
            {/* Left: narrative */}
            <div className="space-y-10">
              {hasCaseStudy ? (
                <>
                  {cs.context ? <Section title={t("detail.context")} body={cs.context} /> : null}
                  {cs.problem ? <Section title={t("detail.problem")} body={cs.problem} /> : null}
                  {cs.approach.length ? (
                    <div>
                      <h2 className="text-subsection font-bold text-violet">{t("detail.approach")}</h2>
                      <div className="mt-5">
                        <ApproachSteps steps={cs.approach} />
                      </div>
                    </div>
                  ) : null}
                  {project.description ? <Section title={t("detail.overview")} body={project.description} /> : null}
                  {Array.isArray(project.results) && project.results.length > 0 ? (
                    <ResultsList title={t("detail.moreResults")} items={project.results} />
                  ) : null}
                </>
              ) : (
                <>
                  {project.description ? <Section title={t("detail.overview")} body={project.description} /> : null}
                  {project.challenge ? <Section title={t("detail.challenge")} body={project.challenge} /> : null}
                  {project.solution ? <Section title={t("detail.solution")} body={project.solution} /> : null}
                  {Array.isArray(project.results) && project.results.length > 0 ? (
                    <ResultsList title={t("detail.results")} items={project.results} />
                  ) : null}
                </>
              )}

              <ServiceCta serviceSlug={cs?.serviceSlug} />
            </div>

            {/* Right: stack, tags, facts */}
            <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              {cs?.stack.length ? (
                <InfoCard title={t("detail.stack")}>
                  <div className="flex flex-wrap gap-2">
                    {cs.stack.map((s) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-violet-pale px-2.5 py-1 text-micro font-semibold text-violet">{s}</span>
                    ))}
                  </div>
                </InfoCard>
              ) : Array.isArray(project.tools) && project.tools.length > 0 ? (
                <InfoCard title={t("detail.toolsTechTitle")}>
                  <div className="flex flex-wrap gap-2">
                    {project.tools.map((s) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-violet-pale px-2.5 py-1 text-micro font-semibold text-violet">{s}</span>
                    ))}
                  </div>
                </InfoCard>
              ) : null}
              {Array.isArray(project.tags) && project.tags.length > 0 ? (
                <InfoCard title={t("detail.tags")}>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full border border-charcoal-80/15 bg-white px-2.5 py-1 text-micro text-charcoal-80/75">
                        <Tag className="h-2.5 w-2.5" aria-hidden="true" /> {s}
                      </span>
                    ))}
                  </div>
                </InfoCard>
              ) : null}
              <InfoCard title={t("detail.projectFactsTitle")}>
                <dl className="space-y-2 text-meta">
                  {project.year ? <Fact label={t("detail.year")} value={project.year} /> : null}
                  {project.duration ? <Fact label={t("detail.duration")} value={project.duration} /> : null}
                  {project.role ? <Fact label={t("detail.role")} value={project.role} /> : null}
                  {project.client ? <Fact label={t("detail.client")} value={project.client} /> : null}
                </dl>
              </InfoCard>
            </aside>
          </div>
        </Container>
      </section>

      {/* PREV / NEXT */}
      {(project.prev || project.next) ? (
        <section className="border-t border-charcoal-80/10 py-10">
          <Container>
            <ProjectPager prev={project.prev} next={project.next} />
          </Container>
        </section>
      ) : null}

      {/* RELATED */}
      {Array.isArray(project.related) && project.related.length > 0 ? (
        <section className="border-t border-charcoal-80/10 bg-white py-14">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                  {t("detail.moreToExplore")}
                </span>
                <h2 className="mt-2 text-section font-bold text-violet">{t("detail.relatedProjects")}</h2>
              </div>
              <Link to="/portfolio" className="hidden items-center gap-1 text-meta font-semibold text-violet hover:underline sm:inline-flex">
                {t("detail.viewAll")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {project.related.map((r) => (
                <Link
                  key={r.id}
                  to={`/projects/${r.slug}`}
                  className="group overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_34px_rgb(var(--color-violet-rgb)/0.12)]"
                >
                  {r.coverImage ? (
                    <div className="aspect-[16/10] overflow-hidden bg-violet-pale">
                      <img
                        src={r.coverImage}
                        srcSet={responsiveSrcSet(r.coverImage)}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                        alt={r.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ) : null}
                  <div className="p-5">
                    <div className="text-micro font-semibold uppercase tracking-[0.15em] text-violet">{r.category}</div>
                    <h3 className="mt-1.5 line-clamp-2 text-body font-bold text-violet">{r.title}</h3>
                    <p className="mt-2 line-clamp-2 text-micro leading-5 text-charcoal-80/70">
                      {r.outcomeLine || r.shortDescription}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Subcomponents
 * ──────────────────────────────────────────────────────────────────────────── */

function Section({ title, body }) {
  return (
    <div>
      <h2 className="text-subsection font-bold text-violet">{title}</h2>
      <p className="mt-3 whitespace-pre-line text-meta leading-7 text-charcoal-80/80">{body}</p>
    </div>
  )
}

function ResultsList({ title, items }) {
  return (
    <div>
      <h2 className="text-subsection font-bold text-violet">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((r, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" aria-hidden="true" />
            <span className="text-meta leading-6 text-charcoal-80/80">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-charcoal-80/65">{label}</dt>
      <dd className="text-right font-semibold text-violet">{value}</dd>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e3)]">
      <div className="mb-3 text-micro font-semibold uppercase tracking-[0.16em] text-violet">{title}</div>
      {children}
    </div>
  )
}
