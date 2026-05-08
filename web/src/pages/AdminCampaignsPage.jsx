/* ════════════════════════════════════════════════════════════════════════
   AdminCampaignsPage.jsx · /admin/campaigns
   Marketing email campaigns list. Each row shows status, audience,
   send/open metrics, and quick actions (edit · delete · view).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Mail, Plus, RefreshCw, Search, X, Edit2, Trash2, Send, Calendar,
  Users as UsersIcon, AlertCircle, CheckCircle2, Clock,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"

const STATUS_PILLS = {
  draft: { label: "Draft", bg: "bg-charcoal-80/[0.06]", text: "text-charcoal-80/65", ring: "ring-charcoal-80/15" },
  scheduled: { label: "Scheduled", bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" },
  sending: { label: "Sending", bg: "bg-blue-50", text: "text-blue-800", ring: "ring-blue-200" },
  sent: { label: "Sent", bg: "bg-emerald-50", text: "text-emerald-800", ring: "ring-emerald-200" },
  cancelled: { label: "Cancelled", bg: "bg-charcoal-80/[0.06]", text: "text-charcoal-80/65", ring: "ring-charcoal-80/15" },
  failed: { label: "Failed", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
}

const AUDIENCE_LABELS = {
  newsletter: "Newsletter",
  members: "All members",
  custom: "Custom list",
}

function StatusPill({ status }) {
  const s = STATUS_PILLS[status] || STATUS_PILLS.draft
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function pct(num, denom) {
  if (!denom) return "-"
  return `${Math.round((num / denom) * 100)}%`
}

export default function AdminCampaignsPage() {
  const toast = useToast()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [pendingDelete, setPendingDelete] = useState(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (search) params.set("q", search)
      const res = await apiRequest(`/api/v1/admin/campaigns?${params.toString()}`)
      setCampaigns(res.campaigns || [])
    } catch (err) {
      setError(err?.message || "Failed to load campaigns.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await apiRequest(`/api/v1/admin/campaigns/${pendingDelete.id}`, { method: "DELETE" })
      toast?.success?.("Campaign deleted")
      setPendingDelete(null)
      load()
    } catch (err) {
      toast?.error?.(err?.message || "Delete failed")
    }
  }

  const counts = useMemo(() => ({
    total: campaigns.length,
    drafts: campaigns.filter((c) => c.status === "draft").length,
    sent: campaigns.filter((c) => c.status === "sent").length,
    delivered: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
  }), [campaigns])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Mail} label="Campaigns" value={counts.total} accent="violet" />
        <Metric icon={Edit2} label="Drafts" value={counts.drafts} accent="charcoal" />
        <Metric icon={CheckCircle2} label="Sent" value={counts.sent} accent="emerald" />
        <Metric icon={Send} label="Total emails delivered" value={counts.delivered} accent="violet" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <form onSubmit={(e) => { e.preventDefault(); load() }} className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or subject…"
              className="w-full rounded-lg border border-charcoal-80/15 bg-white py-2 pl-9 pr-9 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
            />
            {search ? (
              <button type="button" onClick={() => { setSearch(""); load() }} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-charcoal-80/45 hover:bg-charcoal-80/[0.06]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15">
            <option value="">All statuses</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <button type="button" onClick={load} aria-label="Reload" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <Link to="/admin/campaigns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep">
          <Plus className="h-4 w-4" /> New campaign
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
          <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">
            <tr>
              <th scope="col" className="px-4 py-3">Campaign</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">Audience</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Recipients</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Sent / Failed</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">Updated</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-80/[0.06]">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-charcoal-80/55">Loading campaigns…</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-charcoal-80/55">
                No campaigns yet. <Link to="/admin/campaigns/new" className="font-semibold text-violet hover:underline">Compose your first one</Link>.
              </td></tr>
            ) : campaigns.map((c) => (
              <tr key={c.id} className="transition hover:bg-violet-pale/30">
                <td className="px-4 py-3">
                  <div className="font-semibold text-violet">{c.name}</div>
                  <div className="text-[12px] text-charcoal-80/65">{c.subject}</div>
                </td>
                <td className="hidden px-4 py-3 text-charcoal-80/70 sm:table-cell">
                  <div className="inline-flex items-center gap-1.5">
                    <UsersIcon className="h-3.5 w-3.5 text-charcoal-80/45" />
                    {AUDIENCE_LABELS[c.audience] || c.audience}
                  </div>
                </td>
                <td className="hidden px-4 py-3 font-mono tabular-nums text-charcoal-80/70 lg:table-cell">{c.totalRecipients ?? 0}</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="font-mono tabular-nums text-charcoal-80/80">
                    {c.sentCount ?? 0}<span className="text-charcoal-80/35"> / </span>
                    <span className={c.failedCount > 0 ? "text-red-600" : "text-charcoal-80/55"}>{c.failedCount ?? 0}</span>
                  </div>
                  {c.totalRecipients ? (
                    <div className="text-[10.5px] text-charcoal-80/45">{pct(c.sentCount, c.totalRecipients)} delivered</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <StatusPill status={c.status} />
                    {c.scheduledAt && c.status === "scheduled" ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-charcoal-80/55">
                        <Clock className="h-3 w-3" /> {formatDate(c.scheduledAt)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-charcoal-80/55 md:table-cell">{formatDate(c.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Link to={`/admin/campaigns/${c.id}/edit`} aria-label="Edit campaign" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet">
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    <button type="button" onClick={() => setPendingDelete(c)} aria-label="Delete campaign" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingDelete ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle className="h-5 w-5" /></div>
              <div className="flex-1">
                <h2 className="text-[16px] font-bold text-charcoal-80">Delete campaign?</h2>
                <p className="mt-1 text-[13px] text-charcoal-80/65">
                  <strong>{pendingDelete.name}</strong> will be permanently removed. Per-recipient
                  delivery records are also deleted. Sent emails are not recalled.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border border-charcoal-80/15 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal-80 hover:bg-charcoal-80/[0.04]">Cancel</button>
              <button type="button" onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ icon: Icon, label, value, accent }) {
  const ringMap = {
    violet: "bg-violet-pale text-violet",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    charcoal: "bg-charcoal-80/[0.06] text-charcoal-80/70",
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ringMap[accent] || ringMap.violet}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">{label}</div>
        <div className="text-[20px] font-extrabold tabular-nums text-charcoal-80">{value}</div>
      </div>
    </div>
  )
}
