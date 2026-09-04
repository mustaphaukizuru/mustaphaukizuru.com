// ════════════════════════════════════════════════════════════════════════════
// LogoCloud · client logo wall · v2.0
// ────────────────────────────────────────────────────────────────────────────
// A bordered grid of the organisations Mustapha has delivered work for.
// 2 columns on phones, 4 from md up, seam lines bleeding to the viewport edge
// and a plus glyph at every interior intersection.
//
// Data comes from GET /api/v1/client-logos (Admin → Clients edits it). The
// bundled list in data/companiesData is the fallback, so the wall still
// renders if the API is unavailable — it is a credibility section, and a row
// of broken frames is worse than slightly stale content.
//
// Adapted from a shadcn reference; four of its assumptions do not hold here:
//   1. JSX, not TSX — this app is JavaScript.
//   2. `cn` from "@/lib/utils" does not exist (no shadcn, no `@/` alias);
//      uses clsx, already a dependency.
//   3. Its alternating cells use shadcn's `bg-secondary` / `bg-background`
//      tokens, which are NOT defined in this theme and would render
//      transparent. The checkerboard uses Cloud Mist against white instead.
//   4. Its logos are remote svgl.app wordmarks; these are real client marks
//      served from our own /images.
//
// Optical sizing: a circular badge at the same CSS height as a wide wordmark
// reads noticeably smaller, so each row carries a `scale` multiplier tuned
// per logo in the admin. Every cell is the same height and every mark is
// centred in an identical box, which is what makes the row scan as one line
// rather than seven different sizes.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { m, useReducedMotion } from "framer-motion"

import { COMPANIES } from "../../data/companiesData"
import { apiRequest } from "../../lib/api"

/**
 * Base mark height in px; `scale` multiplies it.
 *
 * The reference wall gets away with 20px-tall marks because every one of them
 * is a WORDMARK — 6:1 or wider, so it still fills the cell horizontally.
 * These clients are compact badges and lockups (1:1 to 1.6:1), so the same
 * height leaves them floating in a large empty cell and the artwork stops
 * being readable. Height is the right driver here, and it has to be bigger.
 */
const BASE_HEIGHT = { mobile: 48, desktop: 64 }

const CELL_BASE =
  "relative flex h-[104px] items-center justify-center border-b border-r border-charcoal-80/10 px-4 md:h-[132px] md:px-8"

export function LogoCloud({ companies, className, ...props }) {
  const reduce = useReducedMotion()
  const [rows, setRows] = useState(companies || null)

  useEffect(() => {
    if (companies) return undefined // caller supplied data (e.g. an admin preview)
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest("/api/v1/client-logos")
        const data = Array.isArray(res?.data) ? res.data : []
        if (!cancelled && data.length) setRows(data)
      } catch {
        /* keep the bundled fallback */
      }
    })()
    return () => { cancelled = true }
  }, [companies])

  const logos = rows && rows.length ? rows : COMPANIES
  // Pad to whole columns so the wall stays a clean rectangle instead of
  // ending in a ragged gap.
  const desktopFillers = (4 - (logos.length % 4)) % 4
  const mobileFillers = (2 - (logos.length % 2)) % 2

  return (
    <div
      className={clsx(
        "relative grid grid-cols-2 border-x border-charcoal-80/10 md:grid-cols-4",
        className
      )}
      {...props}
    >
      {/* Seams run past the grid to the viewport edge, so the wall reads as a
          band across the page rather than a floating box. */}
      <Seam className="-top-px" />

      {logos.map((company, i) => (
        <LogoCard
          key={company.slug || company.id || i}
          company={company}
          index={i}
          total={logos.length}
          reduce={reduce}
        />
      ))}

      {/* Fillers continue the checkerboard and the borders; they hold no
          content and are hidden from assistive tech. */}
      {Array.from({ length: Math.max(desktopFillers, mobileFillers) }).map((_, i) => (
        <Filler
          key={`filler-${i}`}
          index={logos.length + i}
          hideOnMobile={i >= mobileFillers}
          hideOnDesktop={i >= desktopFillers}
        />
      ))}

      <Seam className="-bottom-px" />
    </div>
  )
}

function Seam({ className }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute left-1/2 w-screen -translate-x-1/2 border-t border-charcoal-80/10",
        className
      )}
    />
  )
}

/**
 * Checkerboard: tint when row + column is even, per breakpoint column count.
 *
 * The tint was Cloud Mist against white — about a 2% luminance difference,
 * which meant the alternating pattern that gives this wall its character was
 * invisible in practice. Violet Pale at half strength keeps it quiet but
 * actually legible, and stays on-brand rather than borrowing the reference's
 * rose. Hover then goes to full strength so it still reads as a state change.
 */
function tintClasses(index) {
  const mobileTinted = ((index % 2) + Math.floor(index / 2)) % 2 === 0
  const desktopTinted = ((index % 4) + Math.floor(index / 4)) % 2 === 0
  return clsx(
    mobileTinted ? "bg-violet-pale/50" : "bg-white",
    desktopTinted ? "md:bg-violet-pale/50" : "md:bg-white"
  )
}

function LogoCard({ company, index, total, reduce }) {
  const scale = Number(company.scale) || 1
  const src = company.logoUrl || `/images/brand/companies/${company.slug}.webp`
  // Bundled assets ship a 2x sibling; uploaded ones may not, so only offer the
  // descriptor when the file is known to exist.
  const srcSet = company.logoUrl ? undefined : `${src} 1x, ${src.replace(/\.webp$/, "@2x.webp")} 2x`

  // A plus marks every interior intersection: a cell with a neighbour to the
  // right AND one below, per breakpoint.
  const showPlusDesktop = (index + 1) % 4 !== 0 && index < total - (total % 4 || 4)
  const showPlusMobile = index % 2 === 0 && index < total - 2

  const mark = (
    <img
      src={src}
      srcSet={srcSet}
      alt={company.name}
      title={company.sector ? `${company.name} — ${company.sector}` : company.name}
      loading="lazy"
      decoding="async"
      style={{
        height: `${Math.round(BASE_HEIGHT.mobile * scale)}px`,
        maxHeight: "100%",
        // Caps a very wide wordmark so it cannot crowd the cell walls.
        maxWidth: "clamp(120px, 82%, 220px)",
      }}
      className={clsx(
        "select-none object-contain transition-transform duration-300 group-hover:scale-[1.04] md:h-[var(--logo-h)]",
        company.boxed && "rounded-lg"
      )}
    />
  )

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      style={{ "--logo-h": `${Math.round(BASE_HEIGHT.desktop * scale)}px` }}
      className={clsx(
        CELL_BASE,
        tintClasses(index),
        "group transition-colors duration-300 hover:bg-violet-pale"
      )}
    >
      {company.websiteUrl ? (
        <a
          href={company.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={company.name}
          className="flex h-full w-full items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          {mark}
        </a>
      ) : (
        mark
      )}

      {showPlusDesktop ? (
        <Plus
          aria-hidden="true"
          strokeWidth={1}
          className="absolute -bottom-[12.5px] -right-[12.5px] z-10 hidden size-6 text-charcoal-80 opacity-25 md:block"
        />
      ) : null}
      {showPlusMobile ? (
        <Plus
          aria-hidden="true"
          strokeWidth={1}
          className="absolute -bottom-[12.5px] -right-[12.5px] z-10 size-6 text-charcoal-80 opacity-25 md:hidden"
        />
      ) : null}
    </m.div>
  )
}

function Filler({ index, hideOnMobile, hideOnDesktop }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        CELL_BASE,
        tintClasses(index),
        hideOnMobile && "hidden",
        hideOnDesktop ? "md:hidden" : "md:flex"
      )}
    />
  )
}

export default LogoCloud
