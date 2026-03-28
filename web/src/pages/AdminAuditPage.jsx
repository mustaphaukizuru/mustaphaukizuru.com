import { useEffect, useState } from "react"
import { ClipboardList, RefreshCw, AlertCircle, Filter } from "lucide-react"
import { EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Admin Audit Log — append-only view of admin actions and activity
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_COLORS = {
  create: "bg-[#e8f4ea] text-[#3b8f47]",
  update: "bg-[#eef3fb] text-[#2f5ea8]",
  delete: "bg-red-50 text-red-600",
  publish: "bg-[#e5f4e8] text-[#3b8f47]",
  archive: "bg-[#f2f2f2] text-[#666]",
  refund: "bg-[#eef2ff] text-[#4f46e5]",
  revoke: "bg-[#fff3e2] text-[#b46909]",
  status_change: "bg-[#f6efe3] text-[#9c5c00]",
  login: "bg-[#f2f2f2] text-[#666]",
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function LogRow({ entry }) {
  const actionColor = ACTION_COLORS[entry.action] || "bg-[#f2f2f2] text-[#666]"

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#634F40]/10 bg-[#fafafa] px-4 py-3 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 shrink-0 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold capitalize ${actionColor}`}>
          {entry.action?.replace(/_/g, " ")}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#420060]">
            {entry.description || `${entry.action} on ${entry.entity}`}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#634F40]/55">
            {entry.entity && (
              <span className="font-medium capitalize">{entry.entity}</span>
            )}
            {entry.entityId && (
              <>
                <span>·</span>
                <span className="font-mono text-[#420060]">#{entry.entityId.slice(0, 8)}</span>
              </>
            )}
            {entry.performedBy && (
              <>
                <span>·</span>
                <span>by {entry.performedBy}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-[11px] text-[#634F40]/50" title={new Date(entry.createdAt).toLocaleString()}>
        {timeAgo(entry.createdAt)}
      </div>
    </div>
  )
}

const ENTITY_OPTIONS = ["all", "product", "order", "payment", "refund", "download", "user", "page", "file"]
const ACTION_OPTIONS = ["all", "create", "update", "delete", "publish", "archive", "refund", "revoke", "status_change"]

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [view, setView] = useState("audit") // "audit" | "activity"
  const [entityFilter, setEntityFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const [auditRes, activityRes] = await Promise.allSettled([
        authFetch("/api/admin/audit"),
        authFetch("/api/admin/audit"),
      ])

      if (auditRes.status === "fulfilled") {
        setLogs(Array.isArray(auditRes.value?.data) ? auditRes.value.data : [])
      }
      if (activityRes.status === "fulfilled") {
        setActivityLogs(Array.isArray(activityRes.value?.data) ? activityRes.value.data : [])
      }
    } catch (err) {
      setError(err.message || "Failed to load logs.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const currentLogs = view === "audit" ? logs : activityLogs

  const filtered = currentLogs.filter((entry) => {
    const matchEntity = entityFilter === "all" || entry.entity === entityFilter
    const matchAction = actionFilter === "all" || entry.action === actionFilter
    return matchEntity && matchAction
  })

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[460px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">Audit Entries</div>
          <div className="mt-2 text-[28px] font-bold text-[#420060]">{logs.length}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">Sensitive admin actions</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">Activity Entries</div>
          <div className="mt-2 text-[28px] font-bold text-[#420060]">{activityLogs.length}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">General operational events</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">Showing</div>
          <div className="mt-2 text-[28px] font-bold text-[#420060]">{filtered.length}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">Matching current filters</div>
        </div>
      </div>

      <SectionCard
        title="Audit & Activity Log"
        subtitle="Append-only record of admin actions and platform events."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] p-0.5">
              {["audit", "activity"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition ${
                    view === v
                      ? "bg-white text-[#420060] shadow-sm"
                      : "text-[#634F40]/60 hover:text-[#420060]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Entity filter */}
            <div className="flex items-center gap-1 rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] px-3 py-2">
              <Filter className="h-3.5 w-3.5 text-[#634F40]/50" />
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="bg-transparent text-[12px] text-[#420060] outline-none"
              >
                {ENTITY_OPTIONS.map((e) => (
                  <option key={e} value={e}>{e === "all" ? "All Entities" : e}</option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div className="flex items-center gap-1 rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] px-3 py-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-transparent text-[12px] text-[#420060] outline-none"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a === "all" ? "All Actions" : a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#634F40]/10 bg-[#f7f4f8] px-3 py-2 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No log entries found"
            description={
              currentLogs.length === 0
                ? "No log entries have been recorded yet."
                : "No entries match the selected filters."
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  )
}
