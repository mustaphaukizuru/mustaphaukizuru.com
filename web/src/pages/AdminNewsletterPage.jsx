import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Mail, Search, Trash2, Filter, AlertCircle, Loader2,
  Download, Users, UserCheck, UserX, RefreshCw, Copy,
} from "lucide-react"

import { authFetch, API_BASE_URL } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/**
 * AdminNewsletterPage
 *
 * NewsletterSubscriber CRUD + CSV export. Backend endpoints:
 *   GET    /api/v1/admin/newsletter/subscribers       (list w/ filters)
 *   DELETE /api/v1/admin/newsletter/subscribers/:id   (hard delete · GDPR)
 *   POST   /api/v1/admin/newsletter/subscribers/export  (CSV blob)
 *
 * Uses shared admin primitives — see API contract notes in AdminContactsPage.
 */

const STATUS_PILL_MAP = {
  subscribed: { status: "active", label: "Active" },
  unsubscribed: { status: "inactive", label: "Unsubscribed" },
}

function fmtDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    })
  } catch { return String(iso) }
}

export default function AdminNewsletterPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (search.trim()) params.set("q", search.trim())
      const r = await authFetch(`/api/v1/admin/newsletter/subscribers?${params.toString()}`)
      setItems(Array.isArray(r?.data) ? r.data : [])
    } catch (e) {
      setError(e?.message || "Failed to load subscribers.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: items.length,
    subscribed: items.filter((i) => i.status === "subscribed").length,
    unsubscribed: items.filter((i) => i.status === "unsubscribed").length,
  }), [items])

  async function handleDelete(sub) {
    if (!window.confirm(`Permanently delete ${sub.email}? This is a GDPR-compliant hard delete and cannot be undone.`)) return
    try {
      await authFetch(`/api/v1/admin/newsletter/subscribers/${sub.id}`, { method: "DELETE" })
      showSuccess(`Subscriber ${sub.email} deleted (GDPR)`)
      try { load() } catch (re) { console.warn("[Newsletter] reload failed:", re) }
    } catch (e) {
      console.error("[Newsletter] delete failed:", e)
      showError(e?.message || "Failed to delete subscriber.", "Could not delete subscriber")
    }
  }

  async function handleCopy(sub) {
    try {
      await navigator.clipboard.writeText(sub.email)
      setCopiedId(sub.id)
      setTimeout(() => setCopiedId(""), 1500)
    } catch { /* clipboard unavailable */ }
  }

  /**
   * CSV export — authFetch normalises binary responses into a
   * { ok, status, data: Blob, headers } envelope (text/csv falls through
   * the JSON branch in parseResponseBody to text(), then we materialise
   * the Blob client-side from the response text). For text/csv we get a
   * plain string back, which we wrap in a Blob with the right MIME type.
   */
  async function handleExport() {
    setExporting(true); setError("")
    try {
      const body = { status: statusFilter !== "all" ? statusFilter : undefined }
      const resp = await authFetch("/api/v1/admin/newsletter/subscribers/export", {
        method: "POST",
        body:   JSON.stringify(body),
      })
      // authFetch returns a Blob for application/octet-stream, but text/csv
      // falls through its JSON/text branch — handle both shapes.
      const blob = resp?.data instanceof Blob
        ? resp.data
        : new Blob([typeof resp === "string" ? resp : (resp?.message ?? "")], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.toUserMessage?.() || e?.message || "Export failed.")
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo(() => [
    {
      key: "email",
      label: "Email",
      width: "1.6fr",
      sortable: true,
      getValue: (row) => row.email || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-meta text-charcoal">{row.email}</div>
          {row.name && <div className="truncate text-micro text-charcoal-80/55">{row.name}</div>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "0.6fr",
      sortable: true,
      getValue: (row) => row.status || "",
      render: (row) => {
        const pill = STATUS_PILL_MAP[row.status] || { status: "draft", label: row.status }
        return <StatusPill status={pill.status} label={pill.label} />
      },
    },
    {
      key: "subscribedAt",
      label: "Subscribed",
      width: "0.7fr",
      sortable: true,
      getValue: (row) => row.subscribedAt || "",
      render: (row) => (
        <span className="font-mono text-micro text-charcoal-80/65">{fmtDate(row.subscribedAt)}</span>
      ),
    },
    {
      key: "unsubscribedAt",
      label: "Unsubscribed",
      width: "0.7fr",
      sortable: true,
      getValue: (row) => row.unsubscribedAt || "",
      render: (row) => (
        <span className="font-mono text-micro text-charcoal-80/65">
          {row.unsubscribedAt ? fmtDate(row.unsubscribedAt) : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "0.5fr",
      align: "right",
      sortable: false,
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCopy(row) }}
            aria-label={`Copy ${row.email}`}
            title="Copy email"
            className={`rounded-lg p-1.5 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
              copiedId === row.id ? "bg-mint/15 text-mint" : "text-charcoal-80/55 hover:bg-violet-pale hover:text-violet"
            }`}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
            aria-label={`Delete ${row.email}`}
            title="Delete (GDPR)"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-rose/10 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ], [copiedId])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Total subscribers" value={stats.total} icon={Users} tone="purple" />
        <MetricCard title="Active" value={stats.subscribed} icon={UserCheck} tone="green" />
        <MetricCard title="Unsubscribed" value={stats.unsubscribed} icon={UserX} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-charcoal-80/45" aria-hidden="true" />
          {[
            { v: "all", label: "All" },
            { v: "subscribed", label: "Active" },
            { v: "unsubscribed", label: "Unsubscribed" },
          ].map(({ v, label }) => {
            const active = statusFilter === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                aria-pressed={active}
                className={`rounded-lg px-3 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                  active ? "bg-violet text-white" : "text-charcoal-80/65 hover:bg-violet-pale hover:text-violet"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or name…"
              aria-label="Search subscribers"
              className="h-9 w-72 rounded-xl border border-charcoal-80/15 bg-mist pl-9 pr-3 text-meta text-charcoal outline-none placeholder:text-charcoal-80/40 focus:border-violet/40 focus-visible:ring-[3px] focus-visible:ring-azure/30"
            />
          </div>

          <button
            type="button"
            onClick={load}
            aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-charcoal-80/15 text-charcoal-80/65 transition hover:border-violet/30 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            {exporting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose/30 bg-rose/5 p-4 text-meta text-rose">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        emptyState={{
          icon: Mail,
          title: "No subscribers",
          description: search.trim() || statusFilter !== "all"
            ? "Try clearing the filters or search."
            : "When someone subscribes via the footer form, they'll appear here.",
        }}
      />
    </div>
  )
}
