import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { useState } from "react"
import {
  ArrowLeft, Tag, Calendar, Wrench, ChevronRight,
  CheckCircle2, ArrowRight, ExternalLink, Users
} from "lucide-react"
import { aboutProjects } from "../data/aboutProjectsData"

const fadeUp = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.5,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.08}} }

export default function ProjectDetailPage() {
  const { slug } = useParams()
  const project  = aboutProjects.find((p) => p.slug === slug)

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
            <Wrench className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-[1.5rem] font-bold text-[#420060]">Project Not Found</h1>
          <p className="mt-2 text-[14px] text-[#634F40]/65">
            The project you're looking for is not available.
          </p>
          <Link to="/about"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3 text-[14px] font-semibold text-white transition hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to About
          </Link>
        </div>
      </div>
    )
  }

  const tags    = Array.isArray(project.tags)    ? project.tags    : []
  const tools   = Array.isArray(project.tools)   ? project.tools   : []
  const results = Array.isArray(project.results) ? project.results : []

  return (
    <div className="bg-[#F7F9F4]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#420060]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-56 w-56 rounded-full bg-[#FFCCAF]/10 blur-2xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-6">

            {/* Breadcrumb */}
            <motion.div variants={fadeUp} className="flex items-center gap-2 text-[13px] text-white/50">
              <Link to="/" className="hover:text-white transition">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to="/about" className="hover:text-white transition">About</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-white/70 truncate max-w-[160px]">{project.title}</span>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col gap-4 lg:max-w-3xl">
              {project.year && (
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">
                  <Calendar className="h-3.5 w-3.5" /> {project.year}
                </span>
              )}
              <h1 className="text-[2.2rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.8rem]">
                {project.title}
              </h1>
              <p className="max-w-2xl text-[16px] leading-7 text-white/60">
                {project.overview || project.description}
              </p>
            </motion.div>

            {/* Tags */}
            {tags.length > 0 && (
              <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[12px] font-medium text-white/70">
                    {tag}
                  </span>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Back link */}
        <Link to="/about" className="mb-8 inline-flex items-center gap-2 text-[13px] font-medium text-[#420060] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to About
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">

          {/* ── Left: Content ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

          
   {/* Hero image + thumbnail gallery */}
            {project.image && (() => {
              const gallery = project.images && project.images.length > 0 ? project.images : [project.image]
              const [activeImg, setActiveImg] = useState(0)

              return (
                <div className="flex flex-col gap-3">
                  {/* Main image */}
                  <div className="overflow-hidden rounded-xl shadow-[0_16px_48px_rgba(66,0,96,0.10)]">
                    <img
                      src={gallery[activeImg]}
                      alt={project.title}
                      className="h-[320px] w-full object-cover transition-all duration-500 sm:h-[420px]"
                    />
                  </div>

                  {/* Thumbnails */}
                  {gallery.length > 1 && (
                    <div className="grid grid-cols-6 gap-2">
                      {gallery.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={`aspect-[4/3] overflow-hidden rounded-lg transition-all ${
                            i === activeImg
                              ? "ring-2 ring-[#420060] ring-offset-2"
                              : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={img} alt={`${project.title} ${i + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Challenge */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-4 text-[18px] font-bold text-[#420060]">The Challenge</h2>
              <p className="text-[15px] leading-7 text-[#634F40]/75">
                {project.challenge || `${project.title} required a structured approach to address organizational technology needs, operational gaps, and practical implementation challenges.`}
              </p>
            </div>

            {/* Solution */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-4 text-[18px] font-bold text-[#420060]">The Solution</h2>
              <p className="text-[15px] leading-7 text-[#634F40]/75">
                {project.solution || `A structured technology solution was designed and implemented to address the core challenges, incorporating modern tools, clear processes, and practical delivery strategies.`}
              </p>
            </div>

            {/* Results */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-4 text-[18px] font-bold text-[#420060]">Results & Impact</h2>
              {results.length > 0 ? (
                <ul className="space-y-3">
                  {results.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] text-[#634F40]/75">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2FA36B]" />
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-3">
                  {[
                    "Improved operational efficiency and digital processes",
                    "Stronger technology systems and infrastructure reliability",
                    "Better adoption of modern digital tools and workflows",
                    "Clear implementation roadmap for continued development",
                  ].map((r, i) => (
                    <div key={i} className="flex items-start gap-3 text-[15px] text-[#634F40]/75">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2FA36B]" />
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Sidebar ─────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-5">

            {/* Project details */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h3 className="mb-5 text-[16px] font-bold text-[#420060]">Project Details</h3>
              <div className="space-y-4">
                {[
                  { icon: Calendar, label: "Timeline", value: project.year },
                  { icon: Users, label: "Role", value: project.role },
                  { icon: Tag, label: "Category", value: tags.join(", ") },
                  { icon: Wrench, label: "Tools", value: tools.join(", ") || "Multiple digital tools" },
                ].filter((d) => d.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/50">{label}</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#420060]">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project website */}
            {project.website && (<a
              
                href={project.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-[#634F40]/10 bg-white p-4 shadow-[0_4px_16px_rgba(66,0,96,0.04)] transition hover:border-[#420060]/25 hover:shadow-[0_8px_24px_rgba(66,0,96,0.08)]"
              >
                <div className="text-[14px] font-semibold text-[#420060]">Visit Live Website</div>
                <ExternalLink className="h-4 w-4 text-[#420060]" />
              </a>
            )}

            {/* CTA card */}
            <div className="relative overflow-hidden rounded-xl bg-[#420060] p-6">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
              <h3 className="text-[16px] font-bold text-white">Need a Similar Solution?</h3>
              <p className="mt-2 text-[13px] leading-6 text-white/60">
                I help organizations and professionals turn operational needs into practical digital systems.
              </p>
              <Link
                to="/contact"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[13px] font-semibold text-[#420060] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Contact Me <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Other projects */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h3 className="mb-4 text-[14px] font-bold text-[#420060]">Other Projects</h3>
              <div className="space-y-2.5">
                {aboutProjects
                  .filter((p) => p.slug !== slug)
                  .slice(0, 3)
                  .map((p) => (
                    <Link
                      key={p.slug}
                      to={`/projects/${p.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-[#634F40]/8 bg-[#fafafa] p-3 transition hover:border-[#420060]/20 hover:bg-[#faf7fb]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#ede4ef]">
                        <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#420060]">{p.title}</div>
                        <div className="text-[11px] text-[#634F40]/50">{p.year}</div>
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[#634F40]/30" />
                    </Link>
                  ))}
              </div>
              <Link to="/about" className="mt-4 flex items-center gap-1 text-[12px] font-medium text-[#420060] hover:underline">
                View all projects <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
