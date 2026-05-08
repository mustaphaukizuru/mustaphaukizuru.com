import { useTranslation } from "react-i18next"
/* ──────────────────────────────────────────────────────────────────────────
 *  Skeleton primitives · Batch 6C · Component consolidation
 *
 *  Unified skeleton variants for loading states. Replaces the patchwork
 *  of `<div className="h-X animate-pulse...">` snippets scattered across
 *  the codebase with named primitives that match the v3 visual language.
 *
 *  All skeletons use:
 *    - Tailwind's animate-pulse
 *    - violet-pale and charcoal-80/8 for the muted shimmer
 *    - rounded-xl by default (matches v3 shape language)
 *
 *  ── Variants ───────────────────────────────────────────────────────────
 *
 *  <Skeleton />                       Plain rectangle, customizable
 *  <SkeletonText lines={3} />         N stacked text lines (varying width)
 *  <SkeletonAvatar size="md" />       Circular avatar placeholder
 *  <SkeletonRow />                    Avatar + 2 text lines (list row)
 *  <SkeletonMetricCard />             Mirrors MetricCard's layout
 *  <SkeletonTable rows={5} />         Stacked rows for table loading
 *
 *  Note: The original `SkeletonCard` from components/ui/index.jsx is kept
 *  unchanged for backwards compatibility — existing callers continue to
 *  work. New code should prefer these named variants.
 *  ──────────────────────────────────────────────────────────────────── */

/* ── Plain Skeleton · base building block ────────────────────────────── */
export function Skeleton({
  className = "",
  rounded = "rounded-xl",
  width = "w-full",
  height = "h-4",
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`animate-pulse bg-violet-pale/60 ${rounded} ${width} ${height} ${className}`}
    />
  )
}

/* ── SkeletonText · N stacked text lines with variance ───────────────── */
export function SkeletonText({ lines = 3, className = "" }) {
  const { t } = useTranslation("common")
  // Vary width across lines so it doesn't look like a brick
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-5/6"]
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-busy="true" aria-label={t("ui.skeleton.loadingText")}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 animate-pulse rounded-full bg-violet-pale/60 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  )
}

/* ── SkeletonAvatar · circular placeholder ───────────────────────────── */
const AVATAR_SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
}

export function SkeletonAvatar({ size = "md", className = "" }) {
  const sizeCls = AVATAR_SIZES[size] || AVATAR_SIZES.md
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`shrink-0 animate-pulse rounded-full bg-violet-pale/60 ${sizeCls} ${className}`}
    />
  )
}

/* ── SkeletonRow · avatar + 2 text lines (for list rows) ─────────────── */
export function SkeletonRow({ avatarSize = "md", className = "" }) {
  const { t } = useTranslation("common")
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("ui.skeleton.loadingRow")}
      className={`flex items-center gap-3 rounded-xl border border-charcoal-80/8 bg-white p-4 ${className}`}
    >
      <SkeletonAvatar size={avatarSize} />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-violet-pale/60" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-charcoal-80/10" />
      </div>
    </div>
  )
}

/* ── SkeletonMetricCard · mirrors the actual MetricCard shape ────────── */
export function SkeletonMetricCard({ className = "" }) {
  const { t } = useTranslation("common")
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("ui.skeleton.loadingMetric")}
      className={`rounded-xl border border-charcoal-80/10 bg-white p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-violet-pale/60" />
          <div className="h-7 w-1/2 animate-pulse rounded-lg bg-violet-pale/60" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-charcoal-80/10" />
        </div>
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-violet-pale/60" />
      </div>
    </div>
  )
}

/* ── SkeletonTable · stacked rows for table loading ──────────────────── */
export function SkeletonTable({ rows = 5, className = "" }) {
  const { t } = useTranslation("common")
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("ui.skeleton.loadingTable")}
      className={`overflow-hidden rounded-xl border border-charcoal-80/10 bg-white ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-charcoal-80/8 bg-violet-pale/20 px-4 py-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-2.5 flex-1 animate-pulse rounded-full bg-violet-pale/60" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-charcoal-80/6 px-4 py-3 last:border-b-0">
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="h-3 flex-1 animate-pulse rounded-full bg-charcoal-80/8" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Skeleton
