/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ─────────────────────────────────────────────────────────────────────────────
// Public layout primitives
// Eliminates the Container / MediumSectionHeading / fadeUp duplication
// that currently exists in Home, About, Solutions, Services, Contact, Store
// ─────────────────────────────────────────────────────────────────────────────

// ── Container ────────────────────────────────────────────────────────────────
export function Container({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
export function Section({ children, className = "", id }) {
  return (
    <section id={id} className={`py-20 lg:py-28 ${className}`}>
      {children}
    </section>
  )
}

// ── SectionHeading ────────────────────────────────────────────────────────────
// eyebrow: small label above title  |  align: "center" | "left"
// action: optional React node (button/link) rendered to the right on large screens
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  action = null,
  className = "",
}) {
  const centered = align === "center"

  return (
    <div
      className={`mb-12 flex flex-col gap-5 ${
        action ? "lg:flex-row lg:items-end lg:justify-between" : ""
      } ${className}`}
    >
      <div className={`flex flex-col gap-3 ${centered ? "items-center text-center" : "items-start text-left"}`}>
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
            {eyebrow}
          </span>
        )}

        <h2 className="max-w-3xl font-display text-section font-bold tracking-tight text-violet sm:text-page lg:text-page">
          {title}
        </h2>

        {subtitle && (
          <p className={`max-w-2xl text-body leading-7 text-charcoal-80/75 ${centered ? "mx-auto" : ""}`}>
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="mt-2 shrink-0 lg:mt-0">{action}</div>}
    </div>
  )
}

// ── Eyebrow pill ──────────────────────────────────────────────────────────────
export function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
      {children}
    </span>
  )
}

// ── Primary CTA button ────────────────────────────────────────────────────────
export function Btn({
  children,
  as: Tag = "button",
  to,
  href,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  const sizes = {
    sm: "px-4 py-2 text-meta",
    md: "px-5 py-3 text-meta",
    lg: "px-7 py-3.5 text-body",
  }

  const variants = {
    primary:
      "bg-violet text-white shadow-[var(--shadow-lift-3)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgb(var(--color-violet-rgb)/0.28)] hover:bg-violet-deep",
    secondary:
      "border border-violet/25 text-violet hover:bg-violet-pale hover:-translate-y-0.5",
    ghost:
      "text-violet hover:bg-violet-pale",
    peach:
      "bg-terracotta text-violet hover:bg-[#f5bf9e] hover:-translate-y-0.5",
  }

  const base = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`

  // If a Link (react-router) is needed, the parent should use `import { Link } from "react-router-dom"` and pass `as={Link} to="..."`
  return (
    <Tag to={to} href={href} className={base} {...props}>
      {children}
    </Tag>
  )
}

// ── Framer-motion variants ────────────────────────────────────────────────────
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.52, ease: "easeOut" } },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}

export const staggerFast = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
}

// ── Card shell ────────────────────────────────────────────────────────────────
export function Card({ children, className = "", hover = true }) {
  return (
    <div
      className={`rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e4)] ${
        hover ? "transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgb(var(--color-violet-rgb)/0.10)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ className = "" }) {
  return <div className={`h-px w-full bg-charcoal-80/10 ${className}`} />
}
