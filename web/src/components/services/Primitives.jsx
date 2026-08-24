export function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

export function EyebrowChip({ children, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-pale text-violet",
    terracotta: "bg-terracotta/10 text-terracotta-800",
    azure: "bg-azure/10 text-azure-deep",
    white: "bg-white/15 text-white",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] ${tones[tone] || tones.violet}`}>
      {children}
    </span>
  )
}

export function SectionHeader({ eyebrow, title, subtitle, align = "center", invert = false }) {
  const alignCls = align === "left" ? "text-left" : "mx-auto text-center"
  return (
    <div className={`mb-10 max-w-2xl ${alignCls}`}>
      {eyebrow && <EyebrowChip tone={invert ? "white" : "violet"}>{eyebrow}</EyebrowChip>}
      <h2 className={`mt-3 text-section font-bold ${invert ? "text-white" : "text-violet"}`}>{title}</h2>
      {subtitle && (
        <p className={`mt-3 text-body leading-7 ${invert ? "text-white/75" : "text-charcoal-80/70"}`}>{subtitle}</p>
      )}
    </div>
  )
}
