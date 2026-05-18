import { useEffect, useMemo, useState } from "react"
import { ClipboardList, RefreshCw, Filter, Activity } from "lucide-react"
import { authFetch } from "../lib/api"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminAuditPage · Batch 6B-4
 *
 *  Refactored to use shared DataTable + StatusPill primitives.
 *
 *  What changed:
 *    - Bespoke list of LogRow divs replaced with sortable DataTable
 *    - Local ACTION_COLORS map replaced with semantic ActionBadge built
 *      on top of StatusPill (mapping audit verbs to existing taxonomy)
 *    - Bespoke metric tiles replaced with shared <MetricCard />
 *    - View toggle (audit / activity) + entity filter + action filter
 *      stay as DataTable toolbar slot widgets
 *    - Time-ago + absolute timestamp shown in mono
 *    - Search filters across description, entity, performer
 *    - Refresh button moved into DataTable's built-in refresh icon
 *
 *  Preserved verbatim:
 *    - timeAgo helper
 *    - authFetch endpoints (/api/admin/audit)
 *    - View states + filter behavior
 *  ──────────────────────────────────────────────────────────────────── */

function timeAgo(dateStr) {
  if (!dateStr) return "-"
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

// Map audit action verbs onto the StatusPill semantic taxonomy. Verbs
// without a clean fit fall back to a custom inline pill.
const ACTION_TO_STATUS = {
  create: "completed", // mint
  publish: "active", // mint
  delete: "failed", // rose
  archive: "inactive", // gray
  refund: "refunded", // rose
  revoke: "pending", // amber
  status_change: "pending", // amber
  update: "open", // azure
  login: "inactive", // gray
}

function ActionBadge({ action }) {
  const mapped = ACTION_TO_STATUS[action]
  if (mapped) {
    return <StatusPill status={mapped} label={action.replace(/_/g, " ")} />
  }
  return (
    <span className="inline-flex items-center rounded-full bg-charcoal-80/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-charcoal-80 ring-1 ring-inset ring-charcoal-80/15">
      {action?.replace(/_/g, " ") || "-"}
    </span>
  )
}

const ENTITY_OPTIONS = ["all", "product", "order", "payment", "refund", "download", "user", "page", "file"]
const ACTION_OPTIONS = ["all", "create", "update", "delete", "publish", "archive", "refund", "revoke", "status_change"]

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState("audit")
  const [entityFilter, setEntityFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")

  async function load() {
    setLoading(true); setError("")
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
    }
  }

  useEffect(() => { load() }, [])

  const currentLogs = view === "audit" ? logs : activityLogs

  const filtered = useMemo(() => currentLogs.filter((entry) => {
    const matchEntity = entityFilter === "all" || entry.entity === entityFilter
    const matchAction = actionFilter === "all" || entry.action === actionFilter
    return matchEntity && matchAction
  }), [currentLogs, entityFilter, actionFilter])

  const columns = useMemo(() => [
    {
      key: "action",
      label: "Action",
      sortable: true,
      width: "0.9fr",
      getValue: (row) => row.action || "",
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      searchable: true,
      width: "2.0fr",
      getValue: (row) => row.description || `${row.action} on ${row.entity}` || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-medium text-violet">
            {row.description || `${row.action} on ${row.entity}`}
          </div>
        </div>
      ),
    },
    {
      key: "entity",
      label: "Entity",
      sortable: true,
      searchable: true,
      width: "0.8fr",
      getValue: (row) => row.entity || "",
      render: (row) => row.entity ? (
        <span className="text-meta capitalize text-charcoal-80/85">{row.entity}</span>
      ) : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "entityId",
      label: "ID",
      width: "0.7fr",
      render: (row) => row.entityId ? (
        <code className="font-mono text-[11px] tabular-nums text-violet">
          #{String(row.entityId).slice(0, 8)}
        </code>
      ) : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "performedBy",
      label: "By",
      sortable: true,
      searchable: true,
      width: "0.9fr",
      getValue: (row) => row.performedBy || "",
      render: (row) => row.performedBy ? (
        <span className="truncate text-micro text-charcoal-80/75">{row.performedBy}</span>
      ) : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "createdAt",
      label: "When",
      sortable: true,
      width: "0.8fr",
      align: "right",
      getValue: (row) => row.createdAt || "",
      render: (row) => (
        <span
          className="font-mono text-micro tabular-nums text-charcoal-80/65"
          title={new Date(row.createdAt).toLocaleString()}
        >
          {timeAgo(row.createdAt)}
        </span>
      ),
    },
  ], [])

  // Custom toolbar widgets passed via DataTable's `toolbar` prop slot
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* View toggle */}
      <div role="radiogroup" aria-label="View" className="inline-flex overflow-hidden rounded-lg border border-charcoal-80/12 bg-white">
        {["audit", "activity"].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-micro font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset ${
              view === v
                ? "bg-violet text-white"
                : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Entity filter */}
      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <Filter className="h-3 w-3 text-charcoal-80/45" aria-hidden="true" />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          aria-label="Filter by entity"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          {ENTITY_OPTIONS.map((e) => (
            <option key={e} value={e}>{e === "all" ? "All entities" : e}</option>
          ))}
        </select>
      </label>

      {/* Action filter */}
      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{a === "all" ? "All actions" : a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
    </div>
  )

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          {error}
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Audit entries" value={logs.length} subtitle="Sensitive admin actions" icon={ClipboardList} tone="purple" />
        <MetricCard title="Activity entries" value={activityLogs.length} subtitle="General operational events" icon={Activity} tone="blue" />
        <MetricCard title="Showing" value={filtered.length} subtitle="Matching current filters" icon={Filter} tone="amber" />
      </div>

      {/* DataTable with custom toolbar */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={load}
        initialSort={{ key: "createdAt", dir: "desc" }}
        searchPlaceholder="Search description, entity, performer…"
        toolbar={toolbar}
        emptyState={{
          icon: ClipboardList,
          title: currentLogs.length === 0 ? "No log entries yet" : "No matches",
          description: currentLogs.length === 0
            ? "Admin actions and platform events will appear here as they happen."
            : "No entries match the selected filters. Try clearing them.",
        }}
      />
    </section>
  )
}
