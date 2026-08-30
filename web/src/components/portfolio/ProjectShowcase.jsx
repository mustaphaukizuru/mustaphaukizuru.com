import { useState } from "react"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { ArrowRight, Code2, ExternalLink, Grid3x3, Sparkles, TrendingUp } from "lucide-react"
import ContainerScroll from "../ui/ContainerScroll"
import { getCaseStudy, responsiveSrcSet, hasPlaceholder, projectImages } from "./caseStudy"

const MAX_STACK = 5

/**
 * ProjectShowcase · the one way a project is presented across the site
 *
 * Portfolio page, the home "featured work" band and the About page all render
 * this: the title block sits above a screen that tilts flat as the reader
 * scrolls into it (ui/ContainerScroll), with the outcome line, stack and
 * links below the frame. Replaces the old grid cards — a project is a case
 * study, so it gets a full-width stage rather than a tile.
 *
 * Props:
 *   project    (required) — portfolio row from /api/portfolio (or the leaner
 *              featured/static shape; every field is read defensively)
 *   priority   — true on the first item, so its cover is not lazy-loaded
 *   linkLabel  — overrides the default "Read case study"
 *   density    — "comfortable" (the /portfolio list, where the work is the
 *                page) or "compact" (a band inside another page, where three
 *                full-height stages would swallow it). Only the stage's
 *                proportions change; the anatomy is identical either way.
 */
const DENSITY = {
  comfortable: { height: "min-h-[30rem] md:min-h-[42rem]", frame: "max-w-5xl h-[20rem] md:h-[30rem]", title: "text-section sm:text-page" },
  compact:     { height: "min-h-[26rem] md:min-h-[34rem]", frame: "max-w-4xl h-[17rem] md:h-[24rem]", title: "text-card sm:text-section" },
}

export default function ProjectShowcase({ project, priority = false, linkLabel, density = "comfortable" }) {
  const { t } = useTranslation("portfolio")
  const [coverLoaded, setCoverLoaded] = useState(false)
  if (!project) return null

  const cs = getCaseStudy(project)
  const outcomes = cs?.outcomes || []
  const outcomeLine = project.outcomeLine
    || (outcomes.length
      ? outcomes.slice(0, 2).map((o) => [o.value, o.label].filter(Boolean).join(" ")).join(" · ")
      : null)
  const placeholder = hasPlaceholder(outcomes)
  const service = cs?.serviceSlug
  const cover = projectImages(project)[0] || null
  const href = `/projects/${project.slug || ""}`
  const stack = (cs?.stack || project.tools || project.tags || [])
    .filter((s) => typeof s === "string" && s.trim())
    .slice(0, MAX_STACK)

  const size = DENSITY[density] || DENSITY.comfortable
  const headingId = `showcase-${project.slug || project.id || project.title}`

  return (
    <article className="relative" aria-labelledby={headingId}>
      <ContainerScroll
        heightClassName={size.height}
        frameClassName={size.frame}
        titleComponent={
          <div className="flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              {project.isFeatured ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : null}
              {service ? t(`services.${service}`) : (project.category || t("hero.eyebrow"))}
              {project.year ? <span className="text-violet">· {project.year}</span> : null}
            </span>
            <h3 id={headingId} className={`font-bold tracking-tight text-violet ${size.title}`}>
              <Link to={href} className="transition hover:text-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30">
                {project.title}
              </Link>
            </h3>
            <p className="mx-auto max-w-2xl text-meta leading-6 text-charcoal-80/70">
              {cs?.problem || project.shortDescription}
            </p>
          </div>
        }
      >
        {/* Same destination as the title above it: a mouse target, not a third
            tab stop on every project. */}
        <Link to={href} tabIndex={-1} aria-hidden="true" className="block h-full w-full">
          {cover ? (
            /* A lazy cover entering a frame that is already on screen would
               flash the screen white and show its alt text mid-load, so the
               screen carries a brand wash and the image fades onto it. The
               alt is empty on purpose: the heading above names the project,
               and this link is aria-hidden. */
            <div className="h-full w-full bg-violet-pale">
              {/* layoutId shared with ProjectDetailPage's hero for the page transition */}
              <m.img
                layoutId={`project-cover-${project.slug || project.id || ""}`}
                src={cover}
                srcSet={responsiveSrcSet(cover)}
                sizes="(max-width: 768px) 100vw, 1024px"
                alt=""
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                decoding="async"
                draggable={false}
                onLoad={() => setCoverLoaded(true)}
                className={`mx-auto h-full w-full rounded-2xl object-cover object-left-top transition-opacity duration-500 motion-reduce:transition-none ${
                  coverLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-violet-pale text-violet/40">
              <Grid3x3 className="h-12 w-12" aria-hidden="true" />
            </div>
          )}
        </Link>
      </ContainerScroll>

      {/* Below the frame: the numbers, the stack, the way in */}
      <div className="mx-auto -mt-6 flex max-w-5xl flex-col gap-4 px-4 pb-10 md:-mt-16 md:pb-14 md:px-0">
        {outcomeLine ? (
          <p
            data-placeholder={placeholder ? "true" : undefined}
            className="mx-auto inline-flex items-start gap-2 rounded-xl bg-violet-ghost px-4 py-2.5 text-meta font-semibold leading-5 text-violet"
          >
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-azure" aria-hidden="true" />
            <span>
              <span className="sr-only">{t("card.outcome")}: </span>
              {outcomeLine}
              {placeholder ? <span className="ml-1 font-normal text-charcoal-80/65">({t("card.placeholderShort")})</span> : null}
            </span>
          </p>
        ) : null}

        {stack.length ? (
          <ul className="flex flex-wrap justify-center gap-1.5" aria-label={t("card.stack")}>
            {stack.map((tech) => (
              <li
                key={tech}
                className="rounded-md border border-charcoal-80/10 bg-white px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-charcoal-80/70"
              >
                {tech}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to={href}
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep"
          >
            {linkLabel || t("card.caseStudy")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {project.liveUrl ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-micro font-semibold text-charcoal-80/70 hover:text-violet"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("card.live")}
            </a>
          ) : null}
          {project.repoUrl ? (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-micro font-semibold text-charcoal-80/70 hover:text-violet"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("card.repo")}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}
