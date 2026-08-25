import { useTranslation } from "react-i18next"
import Block, {
  SkeletonCard as PrimitiveCard,
  SkeletonStat as PrimitiveStat,
  SkeletonTableRow as PrimitiveTableRow,
} from "./SkeletonPrimitives"

/* ──────────────────────────────────────────────────────────────────────────
 *  Skeleton primitives · legacy surface · roadmap step 35
 *
 *  These are the *original* skeleton exports (wide `width`/`height`/`rounded`
 *  props, i18n'd `role="status"` labels). ~50 pages import them through
 *  `ui/legacy.jsx` → `ui/index.jsx`, so every export name and prop below is
 *  frozen.
 *
 *  What changed in step 35: they no longer hand-roll `animate-pulse` divs.
 *  Every bar now renders through the canonical `Skeleton` block in
 *  ./SkeletonPrimitives.jsx, so the whole app shares ONE shimmer:
 *  a CSS-only `ukz-shimmer` gradient sweep + `motion-safe:animate-pulse`,
 *  both of which go static under `prefers-reduced-motion`. No JS involved.
 *
 *  ── Variants ───────────────────────────────────────────────────────────
 *
 *  <Skeleton />                       Plain block, customizable
 *  <SkeletonText lines={3} />         N stacked text lines (varying width)
 *  <SkeletonAvatar size="md" />       Circular avatar placeholder
 *  <SkeletonRow />                    Avatar + 2 text lines (list row)
 *  <SkeletonCard />                   Card-shaped placeholder
 *  <SkeletonStat />                   KPI tile shape
 *  <SkeletonMetricCard />             Mirrors MetricCard's layout
 *  <SkeletonTableRow cols={4} />      A single table row of cells
 *  <SkeletonTable rows={5} />         Header + stacked rows
 *
 *  Note: the separate `SkeletonCard` in components/ui/legacy.jsx (the one
 *  taking a `height` prop) is a different, older component and is untouched.
 *  ──────────────────────────────────────────────────────────────────── */

/* ── Plain Skeleton · base building block ────────────────────────────── */
export function Skeleton({
  className = "",
  rounded = "rounded-xl",
  width = "w-full",
  height = "h-4",
}) {
  return (
    <Block as="div" w={width} h={height} rounded={rounded} className={className} label="Loading" />
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
        <Block key={i} h="h-3" w={widths[i % widths.length]} rounded="full" />
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
  const [h, w] = sizeCls.split(" ")
  return (
    <Block
      as="div"
      w={w}
      h={h}
      rounded="full"
      label="Loading"
      className={`shrink-0 ${className}`}
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
        <Block h="h-3.5" w="w-1/3" rounded="full" />
        <Block h="h-3" w="w-1/2" rounded="full" tone="muted" />
      </div>
    </div>
  )
}

/* ── SkeletonCard · card-shaped placeholder ──────────────────────────── */
export function SkeletonCard({ className = "" }) {
  return <PrimitiveCard className={className} />
}

/* ── SkeletonStat · KPI tile shape ───────────────────────────────────── */
export function SkeletonStat({ className = "" }) {
  return <PrimitiveStat className={className} />
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
          <Block h="h-3" w="w-2/3" rounded="full" />
          <Block h="h-7" w="w-1/2" rounded="lg" />
          <Block h="h-3" w="w-3/4" rounded="full" tone="muted" />
        </div>
        <Block h="h-10" w="w-10" rounded="rounded-xl" className="shrink-0" />
      </div>
    </div>
  )
}

/* ── SkeletonTableRow · a single row of cells ────────────────────────── */
export function SkeletonTableRow({ cols = 4, className = "" }) {
  return <PrimitiveTableRow cols={cols} className={className} />
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
          <Block key={i} h="h-2.5" w="flex-1" rounded="full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow
          key={i}
          cols={4}
          className="border-b border-charcoal-80/6 px-4 py-3 last:border-b-0"
        />
      ))}
    </div>
  )
}

export default Skeleton
