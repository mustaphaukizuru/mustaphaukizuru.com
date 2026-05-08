// ════════════════════════════════════════════════════════════════════════════
// Avatar · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// User avatar with image fallback to initials. Generates a stable
// deterministic colour from the source string so the same user always lands
// on the same shade. Supports a status dot for presence indicators.
//
// Sizes: xs (24) · sm (32) · md (40 default) · lg (48) · xl (64) · 2xl (80)
// Shapes: "circle" (default) · "rounded"
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"

const SIZE = {
  xs: { box: "h-6 w-6", text: "text-[10px]" },
  sm: { box: "h-8 w-8", text: "text-[11px]" },
  md: { box: "h-10 w-10", text: "text-[13px]" },
  lg: { box: "h-12 w-12", text: "text-[15px]" },
  xl: { box: "h-16 w-16", text: "text-[18px]" },
  "2xl": { box: "h-20 w-20", text: "text-[22px]" },
}

const STATUS_COLOR = {
  online: "bg-[var(--color-feedback-success)]",
  away: "bg-[var(--color-feedback-warning)]",
  busy: "bg-[var(--color-feedback-danger)]",
  offline: "bg-[var(--color-text-muted)]",
}

// Brand-aligned palette for initial backgrounds
const BG_PALETTE = [
  "bg-[var(--color-violet-pale)] text-[var(--color-violet)]",
  "bg-[var(--color-violet-ghost)] text-[var(--color-violet-deep)]",
  "bg-[#fff1ec] text-[#7c2d12]", // terracotta tint
  "bg-[#e6f1ff] text-[#1d4ed8]",
  "bg-[#e8f7ee] text-[#15803d]",
  "bg-[#fff5d6] text-[#854d0e]",
  "bg-[#fde7ef] text-[#9d174d]",
  "bg-[rgba(99,79,64,0.10)] text-[var(--color-charcoal-80)]",
]

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function initialsFrom(name) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?"
}

/**
 * Avatar · image with initials fallback.
 *
 * Props:
 *   src?       · image URL
 *   alt?       · accessible label — falls back to `name`
 *   name?      · used to derive initials and palette
 *   size?      · "xs" · "sm" · "md" (default) · "lg" · "xl" · "2xl"
 *   shape?     · "circle" (default) · "rounded"
 *   status?    · "online" · "away" · "busy" · "offline"
 *   ring?      · boolean — adds a subtle outer ring (e.g. for stacked groups)
 *   className? · escape hatch
 */
export default function Avatar({
  src,
  alt,
  name,
  size = "md",
  shape = "circle",
  status,
  ring = false,
  className = "",
}) {
  const [errored, setErrored] = useState(false)
  const cfg = SIZE[size] || SIZE.md
  const radius = shape === "rounded" ? "rounded-[10px]" : "rounded-full"
  const palette = BG_PALETTE[hashCode(name || alt || "anon") % BG_PALETTE.length]
  const showImage = src && !errored

  return (
    <span
      className={[
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
        cfg.box,
        radius,
        showImage ? "bg-[var(--color-surface-elevated)]" : palette,
        ring && "ring-2 ring-[var(--color-surface-card)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={alt || name || "avatar"}
      role="img"
    >
      {showImage ? (
        <img
          src={src}
          alt={alt || name || ""}
          onError={() => setErrored(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={`font-semibold ${cfg.text}`} aria-hidden="true">
          {initialsFrom(name || alt)}
        </span>
      )}

      {status && (
        <span
          className={[
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-[var(--color-surface-card)]",
            STATUS_COLOR[status] || STATUS_COLOR.offline,
            size === "xs" || size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
          ].join(" ")}
          aria-label={`${status} status`}
        />
      )}
    </span>
  )
}

// ── Avatar.Group ───────────────────────────────────────────────────────────
function AvatarGroup({ children, max = 4, size = "md", className = "" }) {
  const arr = Array.isArray(children)
    ? children
    : children == null
    ? []
    : [children]
  const visible = arr.slice(0, max)
  const overflow = Math.max(0, arr.length - max)
  const cfg = SIZE[size] || SIZE.md
  return (
    <div className={["flex -space-x-2", className].join(" ")}>
      {visible.map((child, i) => (
        <span key={i} className="ring-2 ring-[var(--color-surface-card)] rounded-full">
          {child}
        </span>
      ))}
      {overflow > 0 && (
        <span
          aria-label={`${overflow} more`}
          className={[
            "relative inline-flex shrink-0 select-none items-center justify-center rounded-full",
            "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] font-semibold",
            "ring-2 ring-[var(--color-surface-card)]",
            cfg.box,
            cfg.text,
          ].join(" ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

Avatar.Group = AvatarGroup

export { Avatar, AvatarGroup }
