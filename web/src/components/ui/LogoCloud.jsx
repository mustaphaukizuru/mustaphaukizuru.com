// ════════════════════════════════════════════════════════════════════════════
// LogoCloud · client logo wall · v1.0
// ────────────────────────────────────────────────────────────────────────────
// A bordered grid of the organisations Mustapha has delivered work for.
// 2 columns on phones, 4 from md up, with the seam lines bleeding to the
// viewport edge and a plus glyph at each interior intersection.
//
// Adapted from a shadcn/Tailwind reference component. Four things had to
// change for this codebase, all deliberate:
//
//   1. JSX, not TSX — this app is JavaScript; there is no tsconfig.
//   2. `cn` from "@/lib/utils" does not exist here (no shadcn, no `@/`
//      alias). Uses `clsx`, which the project already depends on.
//   3. The reference paints alternating cells with shadcn's `bg-secondary`
//      / `bg-background` semantic tokens. Those are not defined in this
//      theme — the classes would render transparent — so the rhythm uses
//      the brand's own Cloud Mist against white (Brand v3 tokens only, no
//      hex literals).
//   4. The reference points at remote svgl.app wordmarks. These are real
//      client marks served from our own /images, so the wall keeps working
//      offline and nothing leaks referrer data to a third party.
//
// Logos are greyscale at rest and regain colour on hover/focus: seven marks
// with unrelated palettes read as noise otherwise, and it keeps the section
// subordinate to the page's own violet.
// ════════════════════════════════════════════════════════════════════════════

import clsx from "clsx"
import { Plus } from "lucide-react"
import { m, useReducedMotion } from "framer-motion"

import { COMPANIES } from "../../data/companiesData"

/**
 * @param {object} props
 * @param {import("../../data/companiesData").Company[]} [props.companies]
 * @param {string} [props.className]
 */
export function LogoCloud({ companies = COMPANIES, className, ...props }) {
  const reduce = useReducedMotion()

  return (
    <div
      className={clsx(
        "relative grid grid-cols-2 border-x border-charcoal-80/10 md:grid-cols-4",
        className
      )}
      {...props}
    >
      {/* Seam lines run past the grid to the viewport edge, so the wall reads
          as a band across the page rather than a floating box. */}
      <Seam className="-top-px" />

      {companies.map((company, i) => (
        <LogoCard
          key={company.slug}
          company={company}
          index={i}
          total={companies.length}
          reduce={reduce}
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

function LogoCard({ company, index, total, reduce }) {
  // Checkerboard wash: alternate on phones (2 cols) and again on desktop
  // (4 cols), which is why the two conditions differ per breakpoint.
  const tintedOnMobile = index % 2 === 0
  const tintedOnDesktop = (index + Math.floor(index / 4)) % 2 === 0

  // A plus sits at every interior intersection. On a 4-column grid that is
  // every cell that has both a neighbour to the right and one below.
  const lastRowStartsAt = total - (total % 4 || 4)
  const showPlusDesktop = (index + 1) % 4 !== 0 && index < lastRowStartsAt
  const showPlusMobile = index % 2 === 0 && index < total - 2

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        "group relative flex items-center justify-center border-b border-r border-charcoal-80/10 px-4 py-8 transition-colors duration-300 md:p-8",
        tintedOnMobile ? "bg-mist" : "bg-white",
        tintedOnDesktop ? "md:bg-mist" : "md:bg-white",
        "hover:bg-violet-pale/40 md:hover:bg-violet-pale/40"
      )}
    >
      <img
        src={`/images/brand/companies/${company.slug}.webp`}
        srcSet={`/images/brand/companies/${company.slug}.webp 1x, /images/brand/companies/${company.slug}@2x.webp 2x`}
        alt={company.name}
        title={`${company.name} — ${company.sector}`}
        loading="lazy"
        decoding="async"
        className={clsx(
          "pointer-events-none max-w-[132px] select-none object-contain transition duration-300",
          // Greyscale at rest keeps seven unrelated palettes from fighting
          // each other and the page's violet; colour returns on hover.
          "opacity-70 grayscale group-hover:opacity-100 group-hover:grayscale-0",
          "h-10 md:h-12",
          // Marks that ship with their own background get rounded so the
          // block reads as a deliberate tile, not a stray rectangle.
          company.boxed && "rounded-lg"
        )}
      />

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

export default LogoCloud
