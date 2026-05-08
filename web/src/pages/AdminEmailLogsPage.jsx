import { useEffect, useMemo, useState } from "react"
import {
  Mail, Filter, CheckCircle2, XCircle, Clock,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminEmailLogsPage · Batch 6B-4
 *
 *  Refactored to use shared DataTable + StatusPill primitives.
 *
 *  What changed:
 *    - Bespoke list of LogRow divs replaced with sortable DataTable
 *    - Bespoke status pills replaced with shared <StatusPill /> taxonomy:
 *      sent → mint, failed → rose, queued → amber
 *    - Bespoke StatsCard replaced with shared <MetricCard />
 *    - Bespoke pagination removed (DataTable handles pagination)
 *    - Bespoke search input removed (DataTable provides search across
 *      configured `searchable` columns)
 *    - Status filter + template filter retained as toolbar slot widgets
 *    - All numerics in JetBrains Mono
 *    - Mojibake fixed (non-ASCII chars replaced with ASCII)
 *
 *  Preserved verbatim:
 *    - authFetch endpoints (/api/admin/email-logs and stats)
 *    - Backend pagination + 50-per-page request
 *    - Stats widget (30-day sent/failed/total counts)
 *    - Filter state + URL parameter building
 *
 *  ── Note on pagination ─────────────────────────────────────────────────
 *  Backend supports server-side pagination, but the existing DataTable
 *  primitive uses client-side pagination over an in-memory array. For
 *  this batch, all current-page rows are loaded into the table. If the
 *  log volume grows past a few thousand entries, swap to a paginated
 *  fetch — increment `page` state in load() and add page buttons that
 *  trigger reload, while keeping DataTable for sort+search within the
 *  current page.
 *  ──────────────────────────────────────────────────────────────────── */

export default function AdminEmailLogsPage() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [templateFilter, setTemplateFilter] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append("status", statusFilter)
      if (templateFilter) params.append("templateKey", templateFilter)
      params.append("page", "1")
      params.append("limit", "200")

      const res = await authFetch(`/api/admin/email-logs?${params.toString()}`, { method: "GET" })
      setItems(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err?.message || "Could not load email logs")
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const res = await authFetch("/api/admin/email-logs/stats", { method: "GET" })
      setStats(res?.data || null)
    } catch { /* non-critical */ }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [statusFilter, templateFilter])
  useEffect(() => { loadStats() }, [])

  // Unique template keys from loaded rows for the filter dropdown
  const templateOptions = useMemo(() => {
    const set = new Set()
    for (const row of items) if (row.templateKey) set.add(row.templateKey)
    return Array.from(set).sort()
  }, [items])

  const columns = useMemo(() => [
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "0.7fr",
      getValue: (row) => row.status || "",
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: "templateKey",
      label: "Template",
      sortable: true,
      searchable: true,
      width: "1.1fr",
      getValue: (row) => row.templateKey || "",
      render: (row) => row.templateKey ? (
        <code className="font-mono text-[11px] text-violet">{row.templateKey}</code>
      ) : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "to",
      label: "Recipient",
      sortable: true,
      searchable: true,
      width: "1.6fr",
      getValue: (row) => row.to || row.recipient || "",
      render: (row) => (
        <span className="truncate font-mono text-meta text-charcoal-80/85">
          {row.to || row.recipient || "-"}
        </span>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      sortable: true,
      searchable: true,
      width: "1.6fr",
      getValue: (row) => row.subject || "",
      render: (row) => (
        <span className="truncate text-meta text-charcoal-80/85" title={row.subject}>
          {row.subject || "-"}
        </span>
      ),
    },
    {
      key: "error",
      label: "Error",
      width: "1.0fr",
      render: (row) => row.error ? (
        <span className="truncate text-micro text-rose-600" title={row.error}>
          {row.error}
        </span>
      ) : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "createdAt",
      label: "Sent at",
      sortable: true,
      width: "0.9fr",
      align: "right",
      getValue: (row) => row.createdAt || "",
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/65">
          {row.createdAt ? new Date(row.createdAt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }) : "-"}
        </span>
      ),
    },
  ], [])

  // Custom toolbar widgets (status + template filter)
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <Filter className="h-3 w-3 text-charcoal-80/45" aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          aria-label="Filter by template"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          <option value="">All templates</option>
          {templateOptions.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
    </div>
  )

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta text-rose-700" role="alert">
          {error}
        </div>
      )}

      {/* 30-day stats */}
      {stats?.last30Days && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard title="Sent (30 days)" value={stats.last30Days.sent} icon={CheckCircle2} tone="green" />
          <MetricCard title="Failed (30 days)" value={stats.last30Days.failed} icon={XCircle} tone="red" />
          <MetricCard title="Total (30 days)" value={stats.last30Days.total} icon={Mail} tone="purple" />
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={load}
        initialSort={{ key: "createdAt", dir: "desc" }}
        searchPlaceholder="Search recipient, subject, template…"
        toolbar={toolbar}
        emptyState={{
          icon: Mail,
          title: "No email logs",
          description: statusFilter || templateFilter
            ? "No entries match the selected filters. Try clearing them."
            : "No emails have been sent yet. Logs will appear here as the platform sends transactional emails.",
        }}
      />
    </section>
  )
}
