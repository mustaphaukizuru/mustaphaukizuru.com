import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Sparkles, ChevronRight, ExternalLink } from "lucide-react"

import { useTranslation } from "react-i18next"
import SpotlightCard from "./motion/SpotlightCard"
/**
 * PortfolioCard · shared project card
 *
 * Used by:
 *   • pages/Home.jsx          → <PortfolioCard project={p} cardIndex={idx} />
 *   • pages/AboutPage.jsx     → <PortfolioCard project={p} cardIndex={idx} linkLabel="Learn More" />
 *
 * Features:
 *   • Defensive image extraction — handles every realistic shape:
 *       coverImage (schema), cover (legacy alias),
 *       gallery (Json — string[] or {url}[]),
 *       images (legacy alias) — and de-duplicates the result.
 *   • Auto-cycling crossfade carousel — each card rotates on its own
 *     timer (4 + cardIndex × 0.6 s) so cards on the same page never
 *     flip in sync.
 *   • Pauses on hover so users reading a card aren't interrupted.
 *   • Honours `prefers-reduced-motion` — disables auto-rotation.
 *   • Dot indicator (clickable), image counter, optional year overlay.
 *   • Optional external "{t("components.visitSite")}" link in the footer.
 *
 * Props:
 *   project       (required) — the portfolio object from the API or static data
 *   cardIndex     (default 0) — used to offset the rotation timer per card
 *   linkLabel     (default "View case study") — text of the primary link
 *   showYear      (default true) — overlay year on the image when available
 *   showExternal  (default true) — render the external-site link if present
 */

function extractImages(project) {
  if (!project) return []
  const out = []
  if (typeof project.coverImage === "string" && project.coverImage) out.push(project.coverImage)
  if (typeof project.cover === "string" && project.cover) out.push(project.cover)
  if (typeof project.image === "string" && project.image) out.push(project.image)

  const pushArray = (arr) => {
    if (!Array.isArray(arr)) return
    arr.forEach((g) => {
      if (typeof g === "string" && g) out.push(g)
      else if (g && typeof g.url === "string") out.push(g.url)
    })
  }
  pushArray(project.gallery)
  pushArray(project.images)

  return Array.from(new Set(out))
}

/**
 * Build a srcset from the `<name>-<w>.webp` siblings that
 * scripts/convert-images.mjs emits for bundled /images/** assets. Runtime
 * uploads (anything outside /images/) have no siblings, so return undefined
 * and let the browser use the plain src.
 */
function responsiveSrcSet(src) {
  if (typeof src !== "string" || !src.startsWith("/images/")) return undefined
  const m = src.match(/^(.*).(jpe?g|png)$/i)
  if (!m) return undefined
  return [400, 800, 1200].map((w) => `${m[1]}-${w}.webp ${w}w`).join(", ")
}

function extractTools(project) {
  if (Array.isArray(project?.tools) && project.tools.length > 0) return project.tools.slice(0, 4)
  if (Array.isArray(project?.tags) && project.tags.length > 0) return project.tags.slice(0, 4)
  return []
}

function extractYear(project) {
  if (project?.year) return project.year
  if (project?.publishedAt) {
    try { return new Date(project.publishedAt).getFullYear() } catch { /* noop */ }
  }
  return null
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function PortfolioCard({
  project,
  cardIndex = 0,
  linkLabel = "View case study",
  showYear = true,
  showExternal = true,
}) {
  const { t } = useTranslation("common")
  const [currentIdx, setCurrentIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  const images = extractImages(project)
  const tools = extractTools(project)
  const year = extractYear(project)
  const linkTo = project?.slug ? `/projects/${project.slug}` : (project?.link || null)
  const externalUrl = project?.liveUrl || project?.website || null

  /* Auto-rotate. Each card uses a different interval so cards never flip
   * in sync (4.0 / 4.6 / 5.2 s for index 0/1/2). Pauses on hover. Disabled
   * via prefers-reduced-motion. */
  useEffect(() => {
    if (paused || images.length <= 1) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return

    const interval = 4000 + cardIndex * 600
    const id = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % images.length)
    }, interval)
    return () => clearInterval(id)
  }, [paused, images.length, cardIndex])

  return (
    <motion.article
      variants={fadeUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
    <SpotlightCard
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition-all hover:-translate-y-1 hover:border-l-[4px] hover:border-l-violet hover:shadow-[0_20px_48px_rgba(93,63,211,0.10)]"
    >
      {/* Image area, crossfade carousel */}
      <div className="relative aspect-video overflow-hidden bg-violet-pale">
        {images.length > 0 ? (
          images.map((src, i) => (
            <img
              key={src + "-" + i}
              src={src}
              srcSet={responsiveSrcSet(src)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              alt={i === 0 ? (project?.title || "Project") : (project?.title || "Project") + ", image " + (i + 1)}
              loading="lazy"
              decoding="async"
              className={
                "absolute inset-0 h-full w-full object-cover transition-all duration-700 " +
                (i === currentIdx
                  ? "opacity-100 group-hover:scale-105"
                  : "opacity-0")
              }
              style={{
                transition:
                  "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Sparkles className="h-10 w-10 text-violet/30" aria-hidden="true" />
          </div>
        )}

        {/* Gradient overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
        />

        {/* Year overlay (bottom-left) */}
        {showYear && year ? (
          <div className="absolute bottom-3 left-3 font-mono text-[11px] font-semibold tabular-nums text-white/90">
            {year}
          </div>
        ) : null}

        {/* Image counter pill (top-right) */}
        {images.length > 1 ? (
          <span className="absolute right-3 top-3 rounded-md bg-charcoal/55 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-sm">
            {currentIdx + 1} / {images.length}
          </span>
        ) : null}

        {/* Clickable dot indicator (bottom-right) */}
        {images.length > 1 ? (
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIdx(i)}
                aria-label={t("components.imageAria", { index: i + 1 })}
                className={
                  "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white " +
                  (i === currentIdx
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/55 hover:bg-white/85")
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-[16px] font-bold text-violet">{project?.title}</h3>
        {project?.role ? (
          /* Sentence-case caption — eyebrows are short labels; long role
             descriptions read as shouting if uppercased. */
          <p className="mt-1 text-[12px] font-medium text-charcoal-80/60">
            {project.role}
          </p>
        ) : null}
        <p className="mt-2 flex-1 text-[13px] leading-5 text-charcoal-80/65 line-clamp-3">
          {project?.shortDescription || project?.description || ""}
        </p>
        {tools.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tools.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-violet-pale px-2.5 py-1 text-[10.5px] font-semibold text-violet"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer links */}
        <div className="mt-4 flex items-center gap-3">
          {linkTo ? (
            <Link
              to={linkTo}
              className="group/link inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-violet transition hover:gap-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              {linkLabel}
              <ChevronRight
                className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}

          {showExternal && externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-violet/60 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t("components.visitSite")}
            </a>
          ) : null}
        </div>
      </div>
    </SpotlightCard>
    </motion.article>
  )
}
