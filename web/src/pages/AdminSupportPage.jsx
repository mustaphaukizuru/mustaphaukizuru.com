import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Headphones, MessageSquare, AlertCircle, Send, X, Filter,
  CheckCircle2, AlertTriangle, ArchiveRestore, Mail, RotateCcw, ExternalLink,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import DataTable from "../components/admin/DataTable"
import { Field, inputClass } from "../components/admin/Field"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminSupportPage · Batch 6B-5
 *
 *  Threaded conversation pattern. Ticket list migrated to DataTable on the
 *  list view; opening a ticket reveals the thread (preserved as a
 *  full-width view with messages + reply pane) below the list.
 *
 *  What changed:
 *    - Bespoke TicketRow buttons replaced with DataTable rows
 *    - Status filter + priority filter retained as toolbar slot widgets
 *    - Bespoke 3-card metric grid replaced with shared <MetricCard />
 *    - Bespoke statusBadge replaced with <StatusPill />
 *    - PriorityBadge built on StatusPill semantic tokens (high=rose,
 *      medium=amber, low=azure)
 *    - AdminTicketThread refined:
 *      - Reply textarea uses inputClass() from primitive
 *      - Status control buttons use proper aria-pressed
 *      - ESC dismisses the thread view
 *      - Mojibake "..." replaced with proper Unicode
 *      - All numerics in JetBrains Mono
 *      - Better focus rings + hover states
 *
 *  Preserved verbatim:
 *    - All authFetch endpoints (/api/admin/support/tickets, /:id, messages, status PATCH)
 *    - STATUS_OPTIONS + PRIORITY_OPTIONS taxonomy
 *    - Reply flow + status change flow
 *    - Toast on send + status update
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = ["all", "open", "in_progress", "resolved", "closed"]
const PRIORITY_OPTIONS = ["all", "low", "medium", "high"]
const CATEGORY_OPTIONS = ["all", "general", "billing", "technical", "refund_request", "feature_request", "other"]

/* M16 — refund_request tickets get a distinctive label so the inbox can
 * triage them at a glance. */
function CategoryBadge({ category }) {
  if (!category || category === "general") return null
  const isRefund = category === "refund_request"
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        isRefund
          ? "bg-rose-50 text-rose-600 ring-1 ring-rose-300/40"
          : "bg-violet-pale text-violet ring-1 ring-violet/20"
      }`}
      aria-label={`Category ${category.replace(/_/g, " ")}`}
    >
      {isRefund ? <RotateCcw className="h-3 w-3" aria-hidden="true" /> : null}
      {category.replace(/_/g, " ")}
    </span>
  )
}

function PriorityBadge({ priority }) {
  // Map priority onto StatusPill tones via semantic equivalents
  const map = { high: "failed", medium: "pending", low: "open" }
  const status = map[priority] || "inactive"
  return <StatusPill status={status} label={priority || "-"} />
}

/* ──────────────────────────────────────────────────────────────────── */

function AdminTicketThread({ ticket, onClose, onStatusChange }) {
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(ticket.status)
  // M16 — full ticket data (with order relation) loaded on detail fetch
  const [fullTicket, setFullTicket] = useState(ticket)
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/admin/support/tickets/${ticket.id}`)
        setMessages(res.data?.messages || [])
        if (res.data) setFullTicket(res.data)
      } catch { /* no-op */ }
    }
    load()
  }, [ticket.id])

  // ESC dismisses the thread
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleReply() {
    if (!reply.trim()) return
    setSending(true); setError("")
    try {
      const res = await authFetch(`/api/admin/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply }),
      })
      setMessages((prev) => [...prev, res.data])
      setReply("")
      showSuccess("Reply sent")
    } catch (err) {
      setError(err.message || "Failed to send reply.")
      showError("Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus) {
    try {
      await authFetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      setStatus(newStatus)
      onStatusChange?.(ticket.id, newStatus)
      showSuccess(`Status updated to ${newStatus.replace("_", " ")}`)
    } catch (err) {
      showError(err.message || "Failed to update status")
    }
  }

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/55">
            Ticket{" "}
            <span className="text-violet">
              #{ticket.ticketNumber || (ticket.id ? String(ticket.id).slice(0, 8) : "-")}
            </span>
            {" \u00b7 "}
            {ticket.user?.fullName}
          </div>
          <h3 className="mt-1 text-card font-bold text-violet">{ticket.subject}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill status={status} />
            <PriorityBadge priority={ticket.priority} />
            <CategoryBadge category={fullTicket.category || ticket.category} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread"
          className="shrink-0 rounded-lg border border-charcoal-80/12 bg-white p-2 text-charcoal-80/55 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Status controls */}
      <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Update ticket status">
        {["open", "in_progress", "resolved", "closed"].map((s) => {
          const active = status === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleStatusChange(s)}
              className={`rounded-lg px-3 py-1.5 text-micro font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                active
                  ? "bg-violet text-white shadow-[0_4px_12px_rgba(93,63,211,0.20)]"
                  : "border border-charcoal-80/12 bg-white text-charcoal-80/85 hover:border-violet/20 hover:bg-violet-pale hover:text-violet"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          )
        })}
      </div>

      {/* M16, Refund request banner with deep-link to the order's refund modal */}
      {(fullTicket.category === "refund_request") && fullTicket.order ? (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-meta font-semibold text-rose-700">
                <RotateCcw className="h-4 w-4" />
                Refund request · Order #{fullTicket.order.orderNumber}
              </div>
              <div className="mt-1 text-micro text-rose-700/85">
                Total {Number(fullTicket.order.totalAmount || 0).toFixed(2)} {fullTicket.order.currency} ·
                Status <span className="font-semibold capitalize">{fullTicket.order.status}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/admin/orders/${fullTicket.order.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-micro font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/30"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View order
              </Link>
              {fullTicket.order.status === "paid" ? (
                <Link
                  to={`/admin/orders/${fullTicket.order.id}?action=refund`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Open refund modal
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3" role="log" aria-label="Conversation messages">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-[#fafafa] p-4 text-center text-micro text-charcoal-80/55">
            No messages yet.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-4 text-meta ${
              msg.isAdmin
                ? "border border-violet/15 bg-violet-pale/40 text-violet"
                : "border border-charcoal-80/10 bg-[#fafafa] text-charcoal-80"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-micro font-bold">
                {msg.isAdmin ? "Support Team" : (ticket.user?.fullName || "User")}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-charcoal-80/55">
                {new Date(msg.createdAt).toLocaleString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <div className="leading-6 whitespace-pre-wrap">{msg.message}</div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="mt-5">
        <Field label="Your reply">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply to this member\u2026"
              className={inputClass({ className: "resize-none" })}
            />
          )}
        </Field>
        <button
          type="button"
          onClick={handleReply}
          disabled={sending || !reply.trim()}
          aria-busy={sending ? "true" : "false"}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          {sending ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              Sending\u2026
            </>
          ) : (
            <>
              <Send className="h-3 w-3" aria-hidden="true" />
              Send Reply
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        const res = await authFetch("/api/admin/support/tickets")
        setTickets(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        setError(err.message || "Failed to load tickets.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function reload() {
    try {
      const res = await authFetch("/api/admin/support/tickets")
      setTickets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || "Failed to load tickets.")
    }
  }

  function handleStatusChange(id, newStatus) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)))
  }

  // Filter by status + priority + category
  const filtered = useMemo(() => tickets.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter
    const matchCategory = categoryFilter === "all" || (t.category || "general") === categoryFilter
    return matchStatus && matchPriority && matchCategory
  }), [tickets, statusFilter, priorityFilter, categoryFilter])

  const metrics = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    high: tickets.filter((t) => t.priority === "high").length,
    refunds: tickets.filter((t) => t.category === "refund_request" && t.status !== "closed" && t.status !== "resolved").length,
    resolved: tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
  }), [tickets])

  /* ── Columns for ticket list DataTable ─────────────────────────────── */
  const columns = useMemo(() => [
    {
      key: "subject",
      label: "Subject",
      sortable: true,
      searchable: true,
      width: "1.8fr",
      getValue: (row) => row.subject || "",
      render: (row) => (
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            row.category === "refund_request"
              ? "bg-rose-50 text-rose-600"
              : "bg-violet-pale text-violet"
          }`}>
            {row.category === "refund_request"
              ? <RotateCcw className="h-4 w-4" aria-hidden="true" />
              : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="truncate text-meta font-semibold text-violet">{row.subject}</div>
              <CategoryBadge category={row.category} />
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
              #{row.ticketNumber || (row.id ? String(row.id).slice(0, 8) : "-")}
              {row.order ? ` · order ${row.order.orderNumber}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "user",
      label: "Member",
      sortable: true,
      searchable: true,
      width: "1.4fr",
      getValue: (row) => row.user?.fullName || row.user?.email || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-medium text-charcoal-80">
            {row.user?.fullName || "Unknown User"}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
            {row.user?.email}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      sortable: true,
      width: "0.7fr",
      getValue: (row) => row.priority || "",
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "0.8fr",
      getValue: (row) => row.status || "",
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: "messages",
      label: "Msgs",
      sortable: true,
      width: "0.5fr",
      align: "center",
      getValue: (row) => row._count?.messages ?? 0,
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row._count?.messages ?? 0}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Opened",
      sortable: true,
      width: "0.8fr",
      align: "right",
      getValue: (row) => row.createdAt || "",
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/65">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
      ),
    },
  ], [])

  // Custom toolbar widgets — status + priority filters
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
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All status" : s.replace("_", " ")}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p === "all" ? "All priority" : p}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="bg-transparent text-micro font-medium text-violet outline-none"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
    </div>
  )

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[400px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open Tickets" value={metrics.open} subtitle="Awaiting response" icon={Mail} tone="amber" />
        <MetricCard title="High Priority" value={metrics.high} subtitle="Needs immediate attention" icon={AlertTriangle} tone="red" />
        <MetricCard title="Refund Requests" value={metrics.refunds} subtitle="Open refund-policy reviews" icon={RotateCcw} tone="purple" />
        <MetricCard title="Resolved" value={metrics.resolved} subtitle="Closed tickets" icon={ArchiveRestore} tone="green" />
      </div>

      {/* Conversation thread (when selected) OR ticket list */}
      {selected ? (
        <AdminTicketThread
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          onRefresh={reload}
          initialSort={{ key: "createdAt", dir: "desc" }}
          searchPlaceholder="Search subject, member name, email\u2026"
          toolbar={toolbar}
          rowAction={(row) => setSelected(row)}
          emptyState={{
            icon: Headphones,
            title: tickets.length === 0 ? "No tickets yet" : "No matches",
            description: tickets.length === 0
              ? "Support tickets will appear here when members submit requests."
              : "No tickets match the selected filters.",
          }}
        />
      )}
    </section>
  )
}
