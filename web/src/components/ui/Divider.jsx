// ════════════════════════════════════════════════════════════════════════════
// Divider · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Visual separator. Horizontal by default, optional centred label
// ("OR" / "Continue with"). Vertical orientation for inline content rows.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Divider · semantic <hr>-like separator.
 *
 * Props:
 *   orientation? · "horizontal" (default) · "vertical"
 *   label?       · ReactNode — centred text on the line (horizontal only)
 *   tone?        · "subtle" (default) · "strong" · "violet"
 *   spacing?     · "none" · "sm" · "md" (default) · "lg"
 *   className?
 */
export default function Divider({
  orientation = "horizontal",
  label,
  tone = "subtle",
  spacing = "md",
  className = "",
}) {
  const colorClass = {
    subtle: "border-[var(--color-border-subtle)]",
    strong: "border-[var(--color-border-default)]",
    violet: "border-[var(--color-border-violet)]",
  }[tone] || "border-[var(--color-border-subtle)]"

  const spaceClass = {
    none: "",
    sm: "my-3",
    md: "my-6",
    lg: "my-10",
  }[spacing] || "my-6"

  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={[
          "inline-block self-stretch border-l",
          colorClass,
          className,
        ].join(" ")}
      />
    )
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={[
          "flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]",
          spaceClass,
          className,
        ].join(" ")}
      >
        <span className={`flex-1 border-t ${colorClass}`} aria-hidden="true" />
        <span>{label}</span>
        <span className={`flex-1 border-t ${colorClass}`} aria-hidden="true" />
      </div>
    )
  }

  return (
    <hr
      className={[
        "w-full border-t border-0",
        colorClass,
        spaceClass,
        className,
      ].join(" ")}
    />
  )
}

export { Divider }
