// ════════════════════════════════════════════════════════════════════════════
// EyebrowChip · system primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// The small uppercase chip that sits above section titles — a brand signature.
// Always:
//   · text-micro tokenised typography (10/11px, 0.12em tracking, weight 700)
//   · pill radius (--radius-full)
//   · 6px vertical / 12px horizontal padding (matches button-sm visual weight)
//
// Tones map to the brand palette and inherit WCAG-validated text/bg pairs.
// ════════════════════════════════════════════════════════════════════════════

const TONE_CLASS = {
  // Primary brand chip — used on light surfaces above section titles
  violet:
    "bg-[var(--color-violet-pale)] text-[var(--color-violet)] " +
    "border border-[var(--color-border-violet)]",

  // Inverted variant for use on the violet hero band (see ContactHero, etc.)
  "violet-inverse":
    "bg-[rgba(255,255,255,0.10)] text-[var(--color-text-on-violet)] " +
    "border border-[rgba(255,255,255,0.18)]",

  // Warm neutral — secondary contexts, About / Story sections
  cream:
    "bg-[var(--color-surface-cream)] text-[var(--color-charcoal-80)] " +
    "border border-[var(--color-border-default)]",

  // Status / availability — "Open to work", "Now booking", etc.
  success:
    "bg-[var(--color-feedback-success-bg)] text-[var(--color-feedback-success-text)] " +
    "border border-[rgba(22,163,74,0.20)]",

  // Informational
  info:
    "bg-[var(--color-feedback-info-bg)] text-[var(--color-feedback-info-text)] " +
    "border border-[rgba(37,99,235,0.20)]",

  // Warning / heads-up
  warning:
    "bg-[var(--color-feedback-warning-bg)] text-[var(--color-feedback-warning-text)] " +
    "border border-[rgba(217,119,6,0.20)]",
}

/**
 * EyebrowChip · brand-signature label that sits above titles.
 *
 * v9.2 update: composes the canonical `.eyebrow` utility so the
 * uppercase + tracking + size rule lives in one place (index.css).
 * The chip surface is the pill (background + border + radius); the
 * `.eyebrow` class governs the type. Component authors no longer
 * need to remember `uppercase tracking-[...]` etc.
 *
 * Props:
 *   children · label text (auto-uppercased by .eyebrow)
 *   tone?    · "violet" (default) · "violet-inverse" · "cream" · "success" · "info" · "warning"
 *   icon?    · Lucide icon — renders before the label (12px)
 *   pulse?   · boolean — adds a subtle pulsing dot (used for "Live", "Booking")
 *   className?· escape hatch
 */
export default function EyebrowChip({
  children,
  tone = "violet",
  icon: Icon,
  pulse = false,
  className = "",
}) {
  return (
    <span
      className={[
        "eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1",
        TONE_CLASS[tone] || TONE_CLASS.violet,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

export { EyebrowChip }
