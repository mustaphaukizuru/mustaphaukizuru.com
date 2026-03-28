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
          <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">
            {eyebrow}
          </span>
        )}

        <h2 className="max-w-3xl font-['Sora'] text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem] lg:text-[2.25rem]">
          {title}
        </h2>

        {subtitle && (
          <p className={`max-w-2xl text-[15px] leading-7 text-[#634F40]/75 ${centered ? "mx-auto" : ""}`}>
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
    <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">
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
    sm: "px-4 py-2 text-[13px]",
    md: "px-5 py-3 text-[14px]",
    lg: "px-7 py-3.5 text-[15px]",
  }

  const variants = {
    primary:
      "bg-[#420060] text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(66,0,96,0.28)] hover:bg-[#2d003f]",
    secondary:
      "border border-[#420060]/25 text-[#420060] hover:bg-[#ede4ef] hover:-translate-y-0.5",
    ghost:
      "text-[#420060] hover:bg-[#ede4ef]",
    peach:
      "bg-[#FFCCAF] text-[#420060] hover:bg-[#f5bf9e] hover:-translate-y-0.5",
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
      className={`rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_8px_24px_rgba(66,0,96,0.05)] ${
        hover ? "transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(66,0,96,0.10)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ className = "" }) {
  return <div className={`h-px w-full bg-[#634F40]/10 ${className}`} />
}
