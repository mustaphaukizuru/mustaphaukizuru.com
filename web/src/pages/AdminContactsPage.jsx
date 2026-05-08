import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare, Search, Trash2, X, Mail, Phone, User as UserIcon,
  CheckCircle2, Reply, Filter, AlertCircle, ExternalLink, RefreshCw,
} from "lucide-react"

import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/**
 * AdminContactsPage
 *
 * Lists ContactMessage rows from /api/v1/admin/contact-messages.
 * Statuses: "new" → "read" → "replied"
 *
 * NOTE on shared primitives — these have STRICT APIs:
 *   <MetricCard title value subtitle icon tone>     · tone ∈ purple|green|amber|blue|red|peach
 *   <DataTable columns rows rowKey loading emptyState> · columns are { key, label, render, getValue, sortable, width, align }
 *   <StatusPill status label>                       · status ∈ paid|completed|active|pending|failed|...
 */

/**
 * Map our domain statuses onto StatusPill's known taxonomy so the pill
 * gets the right color. We override `label` so the displayed text stays
 * "New / Read / Replied" instead of the underlying taxonomy value.
 */
const STATUS_PILL_MAP = {
  new: { status: "open", label: "New" },
  read: { status: "pending", label: "Read" },
  replied: { status: "completed", label: "Replied" },
}

function fmtDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return String(iso) }
}

function timeAgo(iso) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

export default function AdminContactsPage() {
  const { showSuccess, showError } = useToast()
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({ total: 0, new: 0, read: 0, replied: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (search.trim()) params.set("q", search.trim())

      const [listResp, statsResp] = await Promise.all([
        authFetch(`/api/v1/admin/contact-messages?${params.toString()}`),
        authFetch(`/api/v1/admin/contact-messages/stats`),
      ])
      setMessages(Array.isArray(listResp?.data) ? listResp.data : [])
      setStats(statsResp?.data || { total: 0, new: 0, read: 0, replied: 0 })
    } catch (e) {
      setError(e?.message || "Failed to load contact messages.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  async function handleOpen(msg) {
    setSelected(msg)
    if (msg.status === "new") {
      try {
        await authFetch(`/api/v1/admin/contact-messages/${msg.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "read" }),
        })
        load()
      } catch { /* silent */ }
    }
  }

  async function handleMarkReplied(msg) {
    try {
      await authFetch(`/api/v1/admin/contact-messages/${msg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "replied" }),
      })
      showSuccess(`Marked message from ${msg.name} as replied`)
      setSelected({ ...msg, status: "replied", repliedAt: new Date().toISOString() })
      try { load() } catch (re) { console.warn("[Contacts] reload failed:", re) }
    } catch (e) {
      console.error("[Contacts] mark-replied failed:", e)
      showError(e?.message || "Failed to update status.", "Could not update message")
    }
  }

  async function handleDelete(msg) {
    if (!window.confirm(`Permanently delete the message from ${msg.name}? This cannot be undone.`)) return
    try {
      await authFetch(`/api/v1/admin/contact-messages/${msg.id}`, { method: "DELETE" })
      showSuccess(`Message from ${msg.name} deleted`)
      setSelected(null)
      try { load() } catch (re) { console.warn("[Contacts] reload failed:", re) }
    } catch (e) {
      console.error("[Contacts] delete failed:", e)
      showError(e?.message || "Failed to delete message.", "Could not delete")
    }
  }

  const columns = useMemo(() => [
    {
      key: "from",
      label: "From",
      width: "1.4fr",
      sortable: true,
      getValue: (row) => row.name || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-charcoal">{row.name}</div>
          <div className="truncate font-mono text-[11px] text-charcoal-80/55">{row.email}</div>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      width: "2fr",
      sortable: true,
      getValue: (row) => row.subject || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta text-charcoal">
            {row.subject || <span className="italic text-charcoal-80/40">(no subject)</span>}
          </div>
          <div className="line-clamp-1 text-micro text-charcoal-80/55">{row.message}</div>
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
      key: "createdAt",
      label: "Received",
      width: "0.7fr",
      sortable: true,
      getValue: (row) => row.createdAt || "",
      render: (row) => (
        <span className="font-mono text-micro text-charcoal-80/65" title={fmtDate(row.createdAt)}>
          {timeAgo(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "0.4fr",
      align: "right",
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleOpen(row) }}
          aria-label="View message"
          className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ], [])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total messages" value={stats.total} icon={MessageSquare} tone="purple" />
        <MetricCard title="New" value={stats.new} icon={AlertCircle} tone="blue" />
        <MetricCard title="Read" value={stats.read} icon={CheckCircle2} tone="amber" />
        <MetricCard title="Replied" value={stats.replied} icon={Reply} tone="green" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-charcoal-80/45" aria-hidden="true" />
          {["all", "new", "read", "replied"].map((s) => {
            const active = statusFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={active}
                className={`rounded-lg px-3 py-1.5 text-micro font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                  active ? "bg-violet text-white" : "text-charcoal-80/65 hover:bg-violet-pale hover:text-violet"
                }`}
              >
                {s}
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
              placeholder="Search name, email, subject…"
              aria-label="Search contact messages"
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
        rows={messages}
        rowKey={(row) => row.id}
        loading={loading}
        emptyState={{
          icon: MessageSquare,
          title: "No contact messages",
          description: search.trim() || statusFilter !== "all"
            ? "Try clearing the filters or search."
            : "When someone fills out the contact form, the message lands here.",
        }}
      />

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-detail-heading"
          >
            <div
              className="absolute inset-0 bg-charcoal/45 backdrop-blur-[2px]"
              onClick={() => setSelected(null)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
            >
              <header className="flex items-start justify-between gap-3 border-b border-charcoal-80/10 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="contact-detail-heading" className="truncate text-card font-bold text-charcoal">
                      {selected.subject || "(no subject)"}
                    </h2>
                    {(() => {
                      const pill = STATUS_PILL_MAP[selected.status] || { status: "draft", label: selected.status }
                      return <StatusPill status={pill.status} label={pill.label} />
                    })()}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-charcoal-80/55">
                    Received {fmtDate(selected.createdAt)}
                    {selected.repliedAt && ` · replied ${fmtDate(selected.repliedAt)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close detail"
                  className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <section className="mb-5 space-y-2">
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">From</h3>
                  <div className="space-y-1.5 rounded-xl border border-charcoal-80/10 bg-mist p-4">
                    <p className="flex items-center gap-2 text-meta text-charcoal">
                      <UserIcon className="h-3.5 w-3.5 text-charcoal-80/45" aria-hidden="true" />
                      <span className="font-semibold">{selected.name}</span>
                    </p>
                    <p className="flex items-center gap-2 text-meta">
                      <Mail className="h-3.5 w-3.5 text-charcoal-80/45" aria-hidden="true" />
                      <a
                        href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject || "Your message")}`}
                        className="font-mono text-azure hover:underline"
                      >
                        {selected.email}
                      </a>
                    </p>
                    {selected.phone && (
                      <p className="flex items-center gap-2 text-meta">
                        <Phone className="h-3.5 w-3.5 text-charcoal-80/45" aria-hidden="true" />
                        <a href={`tel:${selected.phone}`} className="font-mono text-azure hover:underline">
                          {selected.phone}
                        </a>
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">Message</h3>
                  <div className="whitespace-pre-wrap rounded-xl border border-charcoal-80/10 bg-white p-4 text-meta leading-relaxed text-charcoal">
                    {selected.message}
                  </div>
                </section>
              </div>

              <footer className="flex items-center justify-between gap-2 border-t border-charcoal-80/10 bg-mist px-6 py-3">
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose/30 bg-white px-3 py-2 text-micro font-semibold text-rose transition hover:bg-rose/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </button>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject || "Your message")}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Reply by email
                  </a>
                  {selected.status !== "replied" && (
                    <button
                      type="button"
                      onClick={() => handleMarkReplied(selected)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Mark as replied
                    </button>
                  )}
                </div>
              </footer>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
