// ════════════════════════════════════════════════════════════════════════════
// Skeleton · canonical primitives · roadmap step 35
// ────────────────────────────────────────────────────────────────────────────
// One shimmer implementation for the whole app. Every skeleton in the codebase
// (this file, `ui/Skeleton.jsx`, and the `components/system` re-export) renders
// through the `Skeleton` block below, so there is a single place to tune the
// loading look.
//
// ── Shimmer approach ───────────────────────────────────────────────────────
// CSS-only, no JS, no framer-motion:
//   1. `ukz-shimmer` (index.css) paints an ::after gradient sweep driven by the
//      `ukzShimmerSweep` @keyframes. It already carries its own
//      `prefers-reduced-motion: reduce { animation: none }` guard.
//   2. `motion-safe:animate-pulse` layers a soft tint breathe underneath, and
//      is dropped automatically by the `motion-safe:` variant under reduced
//      motion. `motion-reduce:animate-none` is belt-and-braces.
// Under reduced motion the result is a flat, static tinted block — still a
// correctly-shaped placeholder, just not moving.
//
// ── API ────────────────────────────────────────────────────────────────────
//   <Skeleton />                  single block; `w` / `h` / `rounded` / `tone`
//   <Skeleton.Text lines={3} />   n text lines (last line shorter)
//   <Skeleton.Card />             full Card-shaped placeholder
//   <Skeleton.Avatar size="md" /> circular avatar
//   <Skeleton.Stat />             KPI tile shape
//   <Skeleton.TableRow cols={4}/> one table row of cells
//   <Skeleton.Table rows={5} />   header + n rows
//
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

// Token utilities only — no raw hex. `violet` is the default placeholder tint,
// `muted` is the quieter neutral used for secondary lines.
const TONE = {
  violet: "bg-violet-pale/60",
  muted: "bg-charcoal-80/10",
}

/** The single shimmer recipe. See the header block for why it is two layers. */
const SHIMMER = "ukz-shimmer relative overflow-hidden motion-safe:animate-pulse motion-reduce:animate-none"

/**
 * Skeleton · single shimmer block.
 *
 * Props (all optional):
 *   as       · element/tag to render (default "span")
 *   w        · Tailwind width class (default "w-full")
 *   h        · Tailwind height class (default "h-3")
 *   rounded  · "none" · "sm" · "md" (default) · "lg" · "full",
 *              or any raw Tailwind radius class (e.g. "rounded-xl") which is
 *              passed straight through — this is how the legacy wrappers in
 *              `ui/Skeleton.jsx` keep their original shapes.
 *   tone     · "violet" (default) · "muted"
 *   label    · when set, the block announces itself as a live loading region
 *              (role="status"); otherwise it is decorative + aria-hidden.
 *   className· extra classes
 */
function Skeleton({
  as: Tag = "span",
  w = "w-full",
  h = "h-3",
  rounded = "md",
  tone = "violet",
  label,
  className = "",
}) {
  const a11y = label
    ? { role: "status", "aria-busy": "true", "aria-label": label }
    : { role: "presentation", "aria-hidden": "true" }

  return (
    <Tag
      {...a11y}
      className={[
        SHIMMER,
        "block",
        TONE[tone] || TONE.violet,
        w,
        h,
        ROUND[rounded] ?? rounded,
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
  return (
    <Skeleton
      w={sizeClass.split(" ")[1]}
      h={sizeClass.split(" ")[0]}
      rounded="full"
      className={`shrink-0 ${className}`}
    />
  )
}

// ── Skeleton.Stat — KPI tile shape (matches Stat primitive) ────────────────
function SkeletonStat({ className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Skeleton w="w-1/3" h="h-2.5" />
      <Skeleton w="w-1/2" h="h-9" rounded="md" />
      <Skeleton w="w-2/3" h="h-2.5" tone="muted" />
    </div>
  )
}

// ── Skeleton.TableRow — one row of cells ───────────────────────────────────
function SkeletonTableRow({ cols = 4, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {Array.from({ length: Math.max(1, cols) }).map((_, i) => (
        <Skeleton key={i} w="flex-1" h="h-3" rounded="full" tone="muted" />
      ))}
    </div>
  )
}

// ── Skeleton.Table — header + n rows ───────────────────────────────────────
function SkeletonTableShape({ rows = 5, cols = 4, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-charcoal-80/10 bg-white ${className}`}>
      <div className="flex items-center gap-3 border-b border-charcoal-80/8 bg-violet-pale/20 px-4 py-2.5">
        {Array.from({ length: Math.max(1, cols) }).map((_, i) => (
          <Skeleton key={i} w="flex-1" h="h-2.5" rounded="full" />
        ))}
      </div>
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <SkeletonTableRow
          key={i}
          cols={cols}
          className="border-b border-charcoal-80/8 px-4 py-3 last:border-b-0"
        />
      ))}
    </div>
  )
}

Skeleton.Text = SkeletonText
Skeleton.Card = SkeletonCard
Skeleton.Avatar = SkeletonAvatar
Skeleton.Stat = SkeletonStat
Skeleton.TableRow = SkeletonTableRow
Skeleton.Table = SkeletonTableShape

export default Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonStat,
  SkeletonTableRow,
  SkeletonTableShape,
}
