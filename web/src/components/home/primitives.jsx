import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"

/**
 * Home-page primitives — shared by every section under components/home.
 *
 *   Container      — 7xl centred column
 *   SectionHeading — eyebrow + h2 + subtitle (+ optional action slot)
 *   SectionLink    — outlined "see all" pill used in heading action slots
 *   RevealSection  — the ONLY scroll motion on Home: one fade-up per
 *                    section, plays once, disabled under reduced motion.
 */

export function Container({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, subtitle, align = "left", action = null, id }) {
  const centred = align === "center"
  return (
    <div className={`mb-10 flex flex-col gap-4 ${action ? "sm:flex-row sm:items-end sm:justify-between" : ""}`}>
      <div className={`flex flex-col gap-3 ${centred ? "items-center text-center" : "items-start"}`}>
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
            {eyebrow}
          </span>
        )}
        <h2 id={id} className="text-section font-bold tracking-tight text-violet sm:text-page">
          {title}
        </h2>
        {subtitle && (
          <p className={`max-w-2xl text-body leading-7 text-charcoal-80/70 ${centred ? "mx-auto" : ""}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function SectionLink({ to, children, onWhite = false }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${onWhite ? "bg-white" : ""}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}

export function RevealSection({ children, className = "" }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
