// ─────────────────────────────────────────────────────────────────────────────
// Shared UI Design System — mustaphaukizuru.com
// Brand: Indigo #420060 · Carafe #634F40 · Ivory #F7F9F4 · Peach #FFCCAF
// Shape rule: rounded-xl everywhere · Sora font · Consistent shadows
// ─────────────────────────────────────────────────────────────────────────────

// ── MetricCard ─────────────────────────────────────────────────────────────────
const TONE_MAP = {
  purple: "bg-[#ede4ef] text-[#420060]",
  green:  "bg-[#e8f4ea] text-[#3b8f47]",
  amber:  "bg-[#f6efe3] text-[#9c5c00]",
  blue:   "bg-[#eef3fb] text-[#2f5ea8]",
  red:    "bg-red-50 text-red-600",
  peach:  "bg-[#fff3ee] text-[#9c4a00]",
}

export function MetricCard({ title, value, subtitle, icon: Icon, tone = "purple", trend }) {
  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-4 shadow-[0_4px_16px_rgba(66,0,96,0.04)] transition hover:shadow-[0_8px_24px_rgba(66,0,96,0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#634F40]/55 sm:text-[11px]">{title}</div>
          <div className="mt-1.5 text-[22px] font-bold leading-none text-[#420060] sm:mt-2 sm:text-[28px]">{value ?? "—"}</div>
          {subtitle && <div className="mt-1.5 text-[11px] text-[#634F40]/50 sm:mt-2 sm:text-[12px]">{subtitle}</div>}
          {trend !== undefined && (
            <div className={`mt-1 text-[11px] font-semibold ${trend >= 0 ? "text-[#2FA36B]" : "text-[#E5484D]"}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% from last month
            </div>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-xl p-2.5 sm:p-3 ${TONE_MAP[tone] || TONE_MAP.purple}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  paid:        "bg-[#e5f4e8] text-[#2d7a3e]",
  pending:     "bg-[#fff3e2] text-[#b46909]",
  failed:      "bg-red-50 text-red-600",
  cancelled:   "bg-[#f2f2f2] text-[#555]",
  refunded:    "bg-[#eef2ff] text-[#4f46e5]",
  active:      "bg-[#e5f4e8] text-[#2d7a3e]",
  inactive:    "bg-[#f2f2f2] text-[#555]",
  suspended:   "bg-red-50 text-red-600",
  open:        "bg-[#fff3e2] text-[#b46909]",
  closed:      "bg-[#f2f2f2] text-[#555]",
  resolved:    "bg-[#e5f4e8] text-[#2d7a3e]",
  draft:       "bg-[#f2f2f2] text-[#555]",
  published:   "bg-[#e5f4e8] text-[#2d7a3e]",
  in_progress: "bg-[#eef3fb] text-[#2f5ea8]",
  approved:    "bg-[#e5f4e8] text-[#2d7a3e]",
  rejected:    "bg-red-50 text-red-600",
  member:      "bg-[#ede4ef] text-[#420060]",
  admin:       "bg-[#2E2F3A] text-white",
}

export function StatusBadge({ status, size = "sm" }) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"
  return (
    <span className={`inline-flex items-center rounded-full font-semibold capitalize ${sizeClass} ${STATUS_STYLE[status] || "bg-[#f2f2f2] text-[#555]"}`}>
      {status?.replace(/_/g, " ") || "—"}
    </span>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <div className="text-[15px] font-semibold text-[#420060]">{title}</div>
      {description && (
        <div className="mt-2 max-w-[280px] text-[12px] leading-5 text-[#634F40]/60">{description}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── SkeletonCard ───────────────────────────────────────────────────────────────
export function SkeletonCard({ height = "h-[132px]" }) {
  return (
    <div className={`animate-pulse rounded-xl border border-[#634F40]/8 bg-white ${height}`}>
      <div className="flex flex-col gap-3 p-5">
        <div className="h-3 w-1/3 rounded-full bg-[#ede4ef]" />
        <div className="h-8 w-1/2 rounded-xl bg-[#ede4ef]" />
        <div className="h-2 w-2/3 rounded-full bg-[#f4f0f5]" />
      </div>
    </div>
  )
}

// ── SectionCard ────────────────────────────────────────────────────────────────
export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#634F40]/10 bg-white shadow-[0_4px_16px_rgba(66,0,96,0.04)] ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-[#634F40]/8 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-[#420060] sm:text-[16px]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[12px] text-[#634F40]/60">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action, breadcrumb }) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/45">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-[22px] font-bold leading-tight text-[#420060]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-[#634F40]/60">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}

// ── PrimaryBtn ─────────────────────────────────────────────────────────────────
// Standardized primary action button — use everywhere instead of inline styles
export function PrimaryBtn({ children, onClick, type = "button", disabled, loading, icon: Icon, variant = "primary", size = "md", className = "" }) {
  const sizes = {
    sm: "px-3 py-2 text-[12px] gap-1.5",
    md: "px-4 py-2.5 text-[13px] gap-2",
    lg: "px-5 py-3 text-[14px] gap-2",
  }
  const variants = {
    primary:  "bg-[#420060] text-white hover:bg-[#2d003f] shadow-[0_4px_14px_rgba(66,0,96,0.18)]",
    secondary:"border border-[#420060]/20 text-[#420060] hover:bg-[#ede4ef]",
    danger:   "bg-[#E5484D] text-white hover:bg-[#c13a3f]",
    ghost:    "text-[#634F40]/65 hover:text-[#420060] hover:bg-[#f7f4f8]",
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
    </button>
  )
}

// ── AlertBanner ────────────────────────────────────────────────────────────────
export function AlertBanner({ type = "error", message, onDismiss }) {
  const styles = {
    error:   "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
    info:    "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  }
  if (!message) return null
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${styles[type] || styles.error}`}>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
      )}
    </div>
  )
}

// ── TableRow helpers ───────────────────────────────────────────────────────────
export function TableWrapper({ children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
      <div className="-mx-px overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">{children}</table>
      </div>
    </div>
  )
}

export function TableHead({ columns }) {
  return (
    <thead className="border-b border-[#634F40]/8 bg-[#faf8fb]">
      <tr>
        {columns.map((col) => (
          <th key={col} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#634F40]/55">
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}
