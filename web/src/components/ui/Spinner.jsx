// ════════════════════════════════════════════════════════════════════════════
// Spinner · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Lightweight loading indicator. For full-page loads, prefer LoadingScreen.
// For "this content is loading", prefer <Skeleton>. Use this for short
// asynchronous moments where a skeleton would be visual noise.
//
// Sizes: xs (12) · sm (16) · md (20 default) · lg (24) · xl (32)
// Tones: violet (default) · neutral · onDark
// ════════════════════════════════════════════════════════════════════════════

import { Loader2 } from "lucide-react"

const SIZE = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
}

const TONE = {
  violet: "text-[var(--color-action-primary)]",
  neutral: "text-[var(--color-text-muted)]",
  onDark: "text-[var(--color-text-on-dark)]",
}

/**
 * Spinner · simple animated indicator.
 *
 * Props:
 *   size?      · "xs" · "sm" · "md" (default) · "lg" · "xl"
 *   tone?      · "violet" (default) · "neutral" · "onDark"
 *   label?     · accessible label, default "Loading"
 *   className? · escape hatch
 */
export default function Spinner({
  size = "md",
  tone = "violet",
  label = "Loading",
  className = "",
}) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex ${className}`}>
      <Loader2
        className={[
          "animate-spin",
          SIZE[size] || SIZE.md,
          TONE[tone] || TONE.violet,
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ── DotsSpinner ────────────────────────────────────────────────────────────
// Three pulsing dots — alternative for AI/typing contexts.
export function DotsSpinner({ tone = "violet", className = "" }) {
  const dotClass = [
    "inline-block h-1.5 w-1.5 rounded-full",
    TONE[tone] === undefined ? TONE.violet.replace("text-", "bg-") : TONE[tone].replace("text-", "bg-"),
  ].join(" ")
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`${dotClass} animate-bounce [animation-delay:-0.30s]`} />
      <span className={`${dotClass} animate-bounce [animation-delay:-0.15s]`} />
      <span className={`${dotClass} animate-bounce`} />
      <span className="sr-only">Loading</span>
    </span>
  )
}

export { Spinner }
