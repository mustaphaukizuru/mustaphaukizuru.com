// ════════════════════════════════════════════════════════════════════════════
// ui/legacy · Backwards-compat exports · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Legacy primitives that pre-date the unified design system. Preserved so
// that ~50 existing pages keep compiling. New code should NOT import from
// here — prefer the canonical primitives in ./index.jsx.
//
// Migration plan (loose):
//   StatusBadge  → Badge ({ status: ... })
//   PrimaryBtn   → Button
//   AlertBanner  → InlineBanner / Alert
//   EmptyState   → EmptyStateSurface (richer + token-aligned)
//   SkeletonCard → Skeleton.Card
//   SectionCard  → Card with Card.Header
//   PageHeader   → SectionHeader (size="page")
//   TableWrapper / TableHead → DataTable (components/admin/DataTable)
// ════════════════════════════════════════════════════════════════════════════

import { ArrowUp, ArrowDown, X } from "lucide-react"
import SkeletonBlock from "./SkeletonPrimitives"

// Re-export new primitives for ergonomic single-import access
export { SearchInput } from "./SearchInput"
export {
  Skeleton, SkeletonText, SkeletonAvatar, SkeletonRow,
  SkeletonMetricCard, SkeletonTable,
} from "./Skeleton"

/* ──────────────────────────────────────────────────────────────────────────
 *  MetricCard
 *  ──────────────────────────────────────────────────────────────────── */
const TONE_MAP = {
  purple: "bg-violet-pale text-violet",
  green: "bg-mint/15 text-mint-700",
  amber: "bg-amber/10 text-amber-700",
  blue: "bg-azure/10 text-azure-deep",
  red: "bg-rose/10 text-rose-700",
  peach: "bg-terracotta/20 text-terracotta-800",
}

export function MetricCard({ title, value, subtitle, icon: Icon, tone = "purple", trend }) {
  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)] transition hover:shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-micro font-semibold uppercase tracking-[0.12em] text-charcoal-80/65">
            {title}
          </div>
          <div className="mt-1.5 text-section font-bold leading-none text-violet sm:mt-2 sm:text-page">
            {value ?? ","}
          </div>
          {subtitle && (
            <div className="mt-1.5 text-micro text-charcoal-80/65 sm:mt-2">{subtitle}</div>
          )}
          {trend !== undefined && (
            <div className={`mt-1 inline-flex items-center gap-1 text-micro font-semibold ${
              trend >= 0 ? "text-mint-700" : "text-rose-600"
            }`}>
              {trend >= 0
                ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
                : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
              <span className="font-mono tabular-nums">{Math.abs(trend)}%</span>
              <span className="text-charcoal-80/65 font-normal">from last month</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-xl p-2.5 sm:p-3 ${TONE_MAP[tone] || TONE_MAP.purple}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  StatusBadge — DEPRECATED
 *  Prefer <Badge status="..." /> from ./Badge
 *  ──────────────────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  paid: "bg-mint/15 text-mint-700",
  pending: "bg-amber/10 text-amber-700",
  failed: "bg-rose/10 text-rose-700",
  cancelled: "bg-charcoal-80/10 text-charcoal-80",
  refunded: "bg-rose/10 text-rose-700",
  active: "bg-mint/15 text-mint-700",
  inactive: "bg-charcoal-80/10 text-charcoal-80",
  suspended: "bg-rose/10 text-rose-700",
  open: "bg-azure/10 text-azure-deep",
  closed: "bg-charcoal-80/10 text-charcoal-80",
  resolved: "bg-mint/15 text-mint-700",
  draft: "bg-charcoal-80/10 text-charcoal-80",
  published: "bg-mint/15 text-mint-700",
  in_progress: "bg-azure/10 text-azure-deep",
  approved: "bg-mint/15 text-mint-700",
  rejected: "bg-rose/10 text-rose-700",
  member: "bg-azure/10 text-azure-deep",
  admin: "bg-violet-pale text-violet",
}

export function StatusBadge({ status, size = "sm" }) {
  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-micro"
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ring-1 ring-inset ring-current/15 ${sizeClass} ${
        STATUS_STYLE[status] || "bg-charcoal-80/10 text-charcoal-80"
      }`}
    >
      {status?.replace(/_/g, " ") || ","}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  EmptyState (legacy) — Prefer <EmptyStateSurface /> for new code
 *  ──────────────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      )}
      <div className="text-card font-bold text-violet">{title}</div>
      {description && (
        <div className="mt-1 max-w-sm text-meta text-charcoal-80/65">{description}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SkeletonCard — preserved for backwards compatibility.
 *  Prop signature (`height`) and export name are frozen: ~17 admin/dashboard
 *  pages import it via ui/index.jsx. The hand-rolled `animate-pulse` bars are
 *  gone — every bar now renders through the canonical Skeleton block in
 *  ./SkeletonPrimitives.jsx, so this shares the one reduced-motion-aware
 *  `ukz-shimmer` recipe with the rest of the app.
 *  ──────────────────────────────────────────────────────────────────── */
export function SkeletonCard({ height = "h-[132px]" }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`rounded-xl border border-charcoal-80/8 bg-white ${height}`}
    >
      <div className="flex flex-col gap-3 p-5">
        <SkeletonBlock h="h-3" w="w-1/3" rounded="full" />
        <SkeletonBlock h="h-8" w="w-1/2" rounded="rounded-xl" />
        <SkeletonBlock h="h-2" w="w-2/3" rounded="full" tone="muted" />
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SectionCard
 *  ──────────────────────────────────────────────────────────────────── */
export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)] ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-charcoal-80/8 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            {title && <h3 className="text-body font-semibold text-violet">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-micro text-charcoal-80/65">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  PageHeader
 *  ──────────────────────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, action, breadcrumb }) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/65">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-section font-bold leading-tight text-violet">{title}</h1>
        {subtitle && <p className="mt-1 text-meta text-charcoal-80/65">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  PrimaryBtn — DEPRECATED — Prefer <Button>
 *  ──────────────────────────────────────────────────────────────────── */
export function PrimaryBtn({
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  icon: Icon,
  variant = "primary",
  size = "md",
  className = "",
}) {
  const sizes = {
    sm: "px-3 py-2 text-micro gap-1.5",
    md: "px-4 py-2.5 text-meta gap-2",
    lg: "px-5 py-3 text-meta gap-2",
  }
  const variants = {
    primary: "bg-violet text-white hover:bg-violet-deep shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.18)] focus-visible:ring-azure/40",
    secondary: "border border-violet/20 bg-white text-violet hover:bg-violet-pale focus-visible:ring-azure/30",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300/40",
    ghost: "text-charcoal-80/65 hover:bg-violet-pale hover:text-violet focus-visible:ring-azure/30",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : "false"}
      className={`cursor-pointer inline-flex items-center justify-center rounded-lg font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current"
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  AlertBanner — Prefer <InlineBanner /> / <Alert />
 *  ──────────────────────────────────────────────────────────────────── */
export function AlertBanner({ type = "error", message, onDismiss }) {
  const styles = {
    error: "border-rose/20 bg-rose/5 text-rose-700",
    success: "border-mint/30 bg-mint/8 text-mint-700",
    info: "border-azure/30 bg-azure/10 text-azure-deep",
    warning: "border-amber/20 bg-amber/10 text-amber-700",
  }
  if (!message) return null
  const role = type === "error" || type === "warning" ? "alert" : "status"
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-meta ${styles[type] || styles.error}`}
      role={role}
    >
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer shrink-0 rounded p-0.5 opacity-65 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-current/30"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  TableWrapper + TableHead — Prefer <DataTable /> from components/admin
 *  ──────────────────────────────────────────────────────────────────── */
export function TableWrapper({ children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-80/10">
      <div className="-mx-px overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-meta">{children}</table>
      </div>
    </div>
  )
}

export function TableHead({ columns }) {
  return (
    <thead className="border-b border-charcoal-80/8 bg-violet-pale/30">
      <tr>
        {columns.map((col) => (
          <th
            key={col}
            className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-80/65"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}
