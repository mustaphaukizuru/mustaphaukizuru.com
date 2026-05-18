import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

/**
 * BentoCell · hover-expand bento grid cell
 *
 * A tile in an asymmetric grid that lifts, brightens its accent ring,
 * and reveals an "explore" affordance on hover. Designed to compose into
 * a parent grid like:
 *
 *   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 *     <BentoCell to="/foo" eyebrow="STEM" title="Schools" tone="azure" span="lg:col-span-2 lg:row-span-2" />
 *     <BentoCell to="/bar" eyebrow="SMBs"  title="Owners"  tone="mint"  />
 *     ...
 *   </div>
 *
 * Tones map to brand v3.1 status tints — pick the one that matches the
 * semantic of the cell rather than chasing visual variety.
 *
 * Props:
 *   to / href   — link target (uses <Link> when `to` is a path, <a> when `href`)
 *   eyebrow     — small uppercase label above the title
 *   title       — large headline (required)
 *   description — optional body copy
 *   icon        — optional lucide-react icon component
 *   tone        — "violet" | "azure" | "mint" | "amber" | "rose" | "slate"
 *   span        — Tailwind grid-span utilities (e.g. "lg:col-span-2")
 *   className   — extra utility classes
 *   onClick     — optional click handler (use with neither `to` nor `href`)
 */
const TONES = {
  violet: {
    bg:        "bg-violet",
    text:      "text-white",
    eyebrow:   "text-white/70",
    accent:    "bg-white/15",
    overlay:   "from-violet-deep/40 to-transparent",
  },
  azure: {
    bg:        "bg-azure-pale",
    text:      "text-azure-800",
    eyebrow:   "text-azure-deep",
    accent:    "bg-azure-deep/10",
    overlay:   "from-azure-pale/0 to-azure-pale/50",
  },
  mint: {
    bg:        "bg-mint-50",
    text:      "text-mint-700",
    eyebrow:   "text-mint-700/75",
    accent:    "bg-mint/15",
    overlay:   "from-mint-50/0 to-mint-50/50",
  },
  amber: {
    bg:        "bg-amber/10",
    text:      "text-amber-700",
    eyebrow:   "text-amber-700/75",
    accent:    "bg-amber/15",
    overlay:   "from-amber-50/0 to-amber-50/50",
  },
  rose: {
    bg:        "bg-rose-50",
    text:      "text-rose-700",
    eyebrow:   "text-rose-700/75",
    accent:    "bg-rose/15",
    overlay:   "from-rose-50/0 to-rose-50/50",
  },
  slate: {
    bg:        "bg-slate-100",
    text:      "text-charcoal",
    eyebrow:   "text-steel-700",
    accent:    "bg-charcoal/8",
    overlay:   "from-slate-100/0 to-slate-100/50",
  },
}

export default function BentoCell({
  to,
  href,
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "violet",
  span = "",
  className = "",
  onClick,
}) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const palette = TONES[tone] || TONES.violet

  // The visible content is identical regardless of element type; we just
  // pick the appropriate wrapper (Link / a / button / div) based on props.
  const inner = (
    <>
      {/* Soft gradient overlay only present on hover to keep the resting
          state calm; brightens slightly on hover for depth */}
      <motion.div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.overlay}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="relative z-10 flex h-full flex-col">
        {(eyebrow || Icon) && (
          <div className="flex items-center justify-between gap-3">
            {eyebrow && (
              <span
                className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] ${palette.eyebrow}`}
              >
                {eyebrow}
              </span>
            )}
            {Icon && (
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${palette.accent}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
              </span>
            )}
          </div>
        )}

        <h3 className="mt-4 text-[clamp(20px,2.2vw,28px)] font-bold leading-tight tracking-tight">
          {title}
        </h3>

        {description && (
          <p className="mt-2 text-[14px] leading-relaxed opacity-80">
            {description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-6">
          <motion.span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${palette.accent}`}
            initial={{ x: 0 }}
            animate={{ x: hovered && !reduced ? 4 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </motion.span>
        </div>
      </div>
    </>
  )

  const baseClass = `group relative flex h-full min-h-[180px] flex-col overflow-hidden rounded-2xl p-6 ${palette.bg} ${palette.text} ${span} ${className} ring-1 ring-charcoal/5 transition-shadow focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/35 focus-visible:ring-offset-2`

  const motionProps = reduced
    ? {}
    : {
        whileHover: { y: -4, boxShadow: "0 18px 40px -16px rgba(15,23,42,0.18)" },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        onHoverStart: () => setHovered(true),
        onHoverEnd:   () => setHovered(false),
        onFocus:      () => setHovered(true),
        onBlur:       () => setHovered(false),
      }

  if (to) {
    return (
      <motion.div {...motionProps} className={baseClass}>
        <Link to={to} className="absolute inset-0 z-20" aria-label={title} />
        {inner}
      </motion.div>
    )
  }
  if (href) {
    return (
      <motion.div {...motionProps} className={baseClass}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-20"
          aria-label={title}
        />
        {inner}
      </motion.div>
    )
  }
  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        {...motionProps}
        className={`${baseClass} text-left`}
      >
        {inner}
      </motion.button>
    )
  }
  return <motion.div {...motionProps} className={baseClass}>{inner}</motion.div>
}
