// ════════════════════════════════════════════════════════════════════════════
// Skeleton · system composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Loading placeholders that match the shape of the content they're replacing.
// Uses the .skeleton class (shimmer keyframe) defined in tokens.css.
//
// API:
//   · <Skeleton /> — single rectangle; pass `w`, `h`, `rounded` Tailwind-arbitrary classes
//   · <Skeleton.Card /> — full Card-shaped placeholder
//   · <Skeleton.Text lines={3} /> — n lines of text-shaped pulses (last line shorter)
//   · <Skeleton.Avatar size="md" /> — circular avatar pulse
//   · <Skeleton.Stat /> — KPI tile shape
//
// Use prefers-reduced-motion: the shimmer keyframe is suppressed automatically
// by the global rule in tokens.css (animation-duration: 0.001ms).
// Keep skeletons SHORT — they should disappear in <500ms or be replaced by an
// optimistic UI. Prolonged skeletons feel broken; switch to a spinner or
// progress bar for longer waits.
// ════════════════════════════════════════════════════════════════════════════

const ROUND = {
  none: "rounded-none",
  sm: "rounded-[6px]",
  md: "rounded-[10px]",
  lg: "rounded-[14px]",
  full: "rounded-full",
}

/**
 * Skeleton · single shimmer block.
 *
 * Props (all optional):
 *   w        · Tailwind width class (default "w-full")
 *   h        · Tailwind height class (default "h-3")
 *   rounded  · "none" · "sm" · "md" (default) · "lg" · "full"
 *   className· extra classes
 */
function Skeleton({ w = "w-full", h = "h-3", rounded = "md", className = "" }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={[
        "skeleton block",
        w,
        h,
        ROUND[rounded] || ROUND.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  )
}

// ── Skeleton.Text — lines of body copy ─────────────────────────────────────
function SkeletonText({ lines = 3, className = "" }) {
  const arr = Array.from({ length: Math.max(1, lines) })
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {arr.map((_, i) => (
        <Skeleton key={i} h="h-3" w={i === arr.length - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  )
}

// ── Skeleton.Card — generic card shape ─────────────────────────────────────
function SkeletonCard({ className = "" }) {
  return (
    <div
      className={[
        "rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-rest)]",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <Skeleton w="w-1/3" h="h-3" />
        <Skeleton w="w-8" h="h-8" rounded="md" />
      </div>
      <div className="mt-5">
        <Skeleton w="w-1/2" h="h-7" rounded="md" />
      </div>
      <div className="mt-4">
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

// ── Skeleton.Avatar — circular pulse ───────────────────────────────────────
function SkeletonAvatar({ size = "md", className = "" }) {
  const sizeClass = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
  }[size] || "h-9 w-9"
  return <Skeleton w={sizeClass.split(" ")[1]} h={sizeClass.split(" ")[0]} rounded="full" className={className} />
}

// ── Skeleton.Stat — KPI tile shape (matches Stat primitive) ────────────────
function SkeletonStat({ className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Skeleton w="w-1/3" h="h-2.5" />
      <Skeleton w="w-1/2" h="h-9" rounded="md" />
      <Skeleton w="w-2/3" h="h-2.5" />
    </div>
  )
}

Skeleton.Text = SkeletonText
Skeleton.Card = SkeletonCard
Skeleton.Avatar = SkeletonAvatar
Skeleton.Stat = SkeletonStat

export default Skeleton
export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, SkeletonStat }
