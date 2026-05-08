// ─────────────────────────────────────────────────────────────────────────────
// AdminToolbar · the consistent control row at the top of every admin page
//
//   <left>                                <right>
//   ─────────                              ─────────────────────────────
//   • count + filter context              • {children — filter selects, etc.}
//                                         • Refresh button
//
// Every admin page should mount this so users get one place to find filters,
// counts, and a manual reload. Reduces visual + interaction inconsistency.
// ─────────────────────────────────────────────────────────────────────────────

import { RefreshCw } from "lucide-react"

export default function AdminToolbar({
  count,
  countLabel = "items",
  contextLabel, // optional secondary text, e.g. "filter: pending"
  onRefresh,
  refreshing = false,
  children, // filter selects, sort selects, search inputs, etc.
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* LEFT, count + context */}
      <div className="text-[12px] text-[#475569]">
        {typeof count === "number" && (
          <span className="font-mono tabular-nums font-semibold text-[#1A1B23]">
            {count.toLocaleString()}
          </span>
        )}
        {typeof count === "number" && (
          <span className="ml-1">{count === 1 ? countLabel.replace(/s$/, "") : countLabel}</span>
        )}
        {contextLabel && (
          <span className="ml-2 text-[#64748B]">· {contextLabel}</span>
        )}
      </div>

      {/* RIGHT, filters + refresh */}
      <div className="flex items-center gap-2">
        {children}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCDCE4] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1B23] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            title="Reload from server"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>
    </div>
  )
}
