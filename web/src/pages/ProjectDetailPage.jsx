import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

/**
 * Adapt a hardcoded `aboutProjects` row to the same shape ProjectDetailPage
 * already renders. The page was originally written for API rows
 * (Portfolio model) which use slightly different keys.
 *   API row    → { slug, title, role, client, coverImage, gallery, shortDescription,
 *                  description, challenge, solution, results, tools, tags, liveUrl }
 *   Hardcoded  → { slug, title, description, image, images, tags, year, link, website }
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
    year: row.year || null,
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
          // API failure — fall through to the hardcoded fallback below
          data = null
        }
        if (cancelled) return

        // Fallback: if the slug isn't in the DB, look it up in the
        // bundled aboutProjects fixture. This makes "Learn More" links
        // on hardcoded About-page projects resolve cleanly even when the
        // Portfolio table is empty (fresh installs / before bio-seed).
        if (!data) {
          const fallback = aboutProjects.find((p) => p.slug === slug)
          if (fallback) {
            data = adaptHardcoded(fallback)
          }
        }

        if (!data) { setError(t("detail.notFound")); return }
        setProject(data)
        setActiveImage(0)
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load project")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Container className="py-10 sm:py-14">
          <div className="animate-pulse space-y-6">
            <div className="h-4 w-48 rounded bg-violet-pale/60" />
            <div className="h-10 w-3/4 rounded-lg bg-violet-pale" />
            <div className="h-4 w-2/3 rounded bg-violet-pale/60" />
            <div className="mt-8 aspect-[16/9] rounded-2xl bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)]" />
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
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-section font-bold text-violet">{t("detail.notFound")}</h1>
            <p className="mt-2 text-meta text-charcoal-80/70">
              {error || "This project may have been moved or archived."}
            </p>
            <Link
              to="/portfolio"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep"
            >
              <ArrowLeft className="h-4 w-4" /> {t("detail.backToPortfolio")}
            </Link>
          </div>
        </Container>
      </div>
    )
  }

  const gallery = Array.isArray(project.gallery) && project.gallery.length > 0
    ? project.gallery
    : project.coverImage ? [project.coverImage] : []

  const displayImage = gallery[activeImage] || project.coverImage || null

  return (
    <div className="min-h-[60vh] bg-mist">
      <Seo
        title={project.metaTitle || `${project.title} · Mustapha Ukizuru`}
        description={project.metaDescription || project.shortDescription}
        jsonLd={[
          creativeWorkSchema(project, `/projects/${project.slug || ""}`),
          breadcrumbSchema([
            { name: "Portfolio", url: "/portfolio" },
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
          {/* Breadcrumbs */}
          <nav className="mb-5 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/55">
            <Link to="/" className="hover:text-violet">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/portfolio" className="hover:text-violet">Portfolio</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-violet line-clamp-1">{project.title}</span>
          </nav>

          <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-col gap-5">
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                <Tag className="h-3 w-3" /> {project.category}
              </span>
              {project.isFeatured && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 text-micro font-semibold text-violet-deep">
                  <Sparkles className="h-3 w-3" /> Featured
                </span>
              )}
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-page font-bold leading-tight tracking-tight text-violet sm:text-page">
              {project.title}
            </motion.h1>
            <motion.p variants={fadeUp} className="max-w-3xl text-body leading-7 text-charcoal-80/75 sm:text-body">
              {project.shortDescription}
            </motion.p>

            {/* Meta pills */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3 pt-2 text-micro">
              {project.role && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Briefcase className="h-3.5 w-3.5 text-violet" />
                  {project.role}
                </span>
              )}
              {project.client && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  Client: <strong className="text-violet">{project.client}</strong>
                </span>
              )}
              {project.duration && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-charcoal-80/75">
                  <Calendar className="h-3.5 w-3.5 text-violet" />
                  {project.duration}
                </span>
              )}
              {project.liveUrl && (
                <a
                  href={project.liveUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet/25 bg-violet px-3 py-1.5 text-white transition hover:bg-violet-deep"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {t("detail.visitLive")}
                </a>
              )}
              {project.repoUrl && (
                <a
                  href={project.repoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-1.5 text-charcoal-80/75 transition hover:bg-violet-pale"
                >
                  <Github className="h-3.5 w-3.5 text-violet" /> Source
                </a>
              )}
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* GALLERY */}
      {displayImage && (
        <section className="py-10 sm:py-14">
          <Container>
            <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_12px_32px_rgba(93,63,211,0.08)]">
              <div className="aspect-[16/9] w-full bg-violet-pale">
                <img
                  src={displayImage}
                  alt={`${project.title}, view ${activeImage + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-3 overflow-x-auto p-4">
                  {gallery.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImage(idx)}
                      aria-label={`Show image ${idx + 1}`}
                      className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        idx === activeImage ? "border-violet" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={src} alt="" className="h-16 w-24 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Container>
        </section>
      )}

      {/* CASE STUDY BODY */}
      <section className="pb-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
            {/* Left: narrative */}
            <div className="space-y-8">
              {project.description && (
                <Section title="Overview" body={project.description} />
              )}
              {project.challenge && (
                <Section title="Challenge" body={project.challenge} />
              )}
              {project.solution && (
                <Section title="Solution" body={project.solution} />
              )}
              {Array.isArray(project.results) && project.results.length > 0 && (
                <div>
                  <h2 className="text-subsection font-bold text-violet">Results</h2>
                  <ul className="mt-4 space-y-3">
                    {project.results.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2FA36B]" />
                        <span className="text-meta leading-6 text-charcoal-80/80">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: tools, tags, meta */}
            <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              {Array.isArray(project.tools) && project.tools.length > 0 && (
                <InfoCard title={t("detail.toolsTechTitle")}>
                  <div className="flex flex-wrap gap-2">
                    {project.tools.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-violet-pale px-2.5 py-1 text-micro font-semibold text-violet">
                        {t}
                      </span>
                    ))}
                  </div>
                </InfoCard>
              )}
              {Array.isArray(project.tags) && project.tags.length > 0 && (
                <InfoCard title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border border-charcoal-80/15 bg-white px-2.5 py-1 text-micro text-charcoal-80/75">
                        <Tag className="h-2.5 w-2.5" /> {t}
                      </span>
                    ))}
                  </div>
                </InfoCard>
              )}
              <InfoCard title={t("detail.projectFactsTitle")}>
                <dl className="space-y-2 text-meta">
                  {project.year && (
                    <div className="flex items-center justify-between">
                      <dt className="text-charcoal-80/60">Year</dt>
                      <dd className="font-semibold text-violet">{project.year}</dd>
                    </div>
                  )}
                  {project.duration && (
                    <div className="flex items-center justify-between">
                      <dt className="text-charcoal-80/60">Duration</dt>
                      <dd className="font-semibold text-violet">{project.duration}</dd>
                    </div>
                  )}
                  {project.role && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-charcoal-80/60">Role</dt>
                      <dd className="text-right font-semibold text-violet">{project.role}</dd>
                    </div>
                  )}
                  {project.client && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-charcoal-80/60">Client</dt>
                      <dd className="text-right font-semibold text-violet">{project.client}</dd>
                    </div>
                  )}
                </dl>
              </InfoCard>
            </aside>
          </div>
        </Container>
      </section>

      {/* RELATED */}
      {Array.isArray(project.related) && project.related.length > 0 && (
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
                {t("detail.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {project.related.map((r) => (
                <Link
                  key={r.id}
                  to={`/projects/${r.slug}`}
                  className="group overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(93,63,211,0.12)]"
                >
                  {r.coverImage && (
                    <div className="aspect-[16/10] overflow-hidden bg-violet-pale">
                      <img src={r.coverImage} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="text-micro font-semibold uppercase tracking-[0.15em] text-violet/70">
                      {r.category}
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 text-body font-bold text-violet">{r.title}</h3>
                    <p className="mt-2 line-clamp-2 text-micro leading-5 text-charcoal-80/70">
                      {r.shortDescription}
                    </p>
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

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_6px_20px_rgba(93,63,211,0.04)]">
      <div className="mb-3 text-micro font-semibold uppercase tracking-[0.16em] text-violet">{title}</div>
      {children}
    </div>
  )
}
