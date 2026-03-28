import { useEffect, useState } from "react"
import {
  Headphones,
  MessageSquare,
  AlertCircle,
  Send,
  X,
  Filter,
} from "lucide-react"
import { EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"

// ─────────────────────────────────────────────────────────────────────────────
// Admin Support Tickets page
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  low: "bg-[#eef3fb] text-[#2f5ea8]",
  medium: "bg-[#fff3e2] text-[#b46909]",
  high: "bg-red-50 text-red-600",
}

const STATUS_OPTIONS = ["all", "open", "in_progress", "resolved", "closed"]
const PRIORITY_OPTIONS = ["all", "low", "medium", "high"]

function TicketRow({ ticket, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(ticket)}
      className="flex w-full items-start gap-4 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 text-left transition hover:border-[#420060]/20 hover:bg-[#faf7fb]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
        <MessageSquare className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="text-[14px] font-semibold text-[#420060]">{ticket.subject}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {ticket.priority}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#634F40]/60">
          <span className="font-medium text-[#420060]">
            {ticket.user?.fullName || "Unknown User"}
          </span>
          <span>·</span>
          <span>{ticket.user?.email}</span>
          <span>·</span>
          <span>#{ticket.ticketNumber || ticket.id?.slice(0, 8)}</span>
          <span>·</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
          {ticket._count?.messages != null && (
            <>
              <span>·</span>
              <span>{ticket._count.messages} message{ticket._count.messages !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

function AdminTicketThread({ ticket, onClose, onStatusChange }) {
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(ticket.status)
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/admin/support/tickets/${ticket.id}`)
        setMessages(res.data?.messages || [])
      } catch { /* no-op */ }
    }
    load()
  }, [ticket.id])

  async function handleReply() {
    if (!reply.trim()) return
    setSending(true)
    setError("")
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
      showSuccess(`Status updated to ${newStatus}`)
    } catch (err) {
      showError(err.message || "Failed to update status")
    }
  }

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#634F40]/50">
            Ticket #{ticket.ticketNumber || ticket.id?.slice(0, 8)} · {ticket.user?.fullName}
          </div>
          <h3 className="mt-1 text-[18px] font-semibold text-[#420060]">{ticket.subject}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {ticket.priority}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-[#634F40]/10 p-2 text-[#634F40]/50 transition hover:bg-[#f4eef6] hover:text-[#420060]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status controls */}
      <div className="mb-5 flex flex-wrap gap-2">
        {["open", "in_progress", "resolved", "closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-medium capitalize transition ${
              status === s
                ? "bg-[#420060] text-white"
                : "border border-[#634F40]/15 text-[#634F40] hover:bg-[#f4eef6]"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-4 text-[12px] text-[#634F40]/60">
            No messages yet.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 text-[13px] ${
              msg.isAdmin
                ? "border border-[#420060]/15 bg-[#faf7fb] text-[#420060]"
                : "border border-[#634F40]/10 bg-[#fafafa] text-[#634F40]"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[12px] font-semibold">
                {msg.isAdmin ? "Support Team" : (ticket.user?.fullName || "User")}
              </span>
              <span className="text-[11px] text-[#634F40]/50">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="leading-6">{msg.message}</div>
          </div>
        ))}
      </div>

      {/* Reply */}
      <div className="mt-5">
        <textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a reply to this member..."
          className="w-full resize-none rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/10 placeholder:text-[#634F40]/40"
        />
        <button
          type="button"
          onClick={handleReply}
          disabled={sending || !reply.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#420060] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : "Send Reply"}
        </button>
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
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

  function handleStatusChange(id, newStatus) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    )
  }

  const filtered = tickets.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter
    return matchStatus && matchPriority
  })

  const open = tickets.filter((t) => t.status === "open").length
  const high = tickets.filter((t) => t.priority === "high").length
  const resolved = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[360px]" />
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

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">Open Tickets</div>
          <div className="mt-2 text-[28px] font-bold text-[#b46909]">{open}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">Awaiting response</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">High Priority</div>
          <div className="mt-2 text-[28px] font-bold text-red-600">{high}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">Needs immediate attention</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
          <div className="text-[12px] font-medium text-[#634F40]/70">Resolved</div>
          <div className="mt-2 text-[28px] font-bold text-[#3b8f47]">{resolved}</div>
          <div className="mt-2 text-[12px] text-[#634F40]/60">Closed tickets</div>
        </div>
      </div>

      {/* Ticket thread */}
      {selected ? (
        <AdminTicketThread
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <SectionCard
          title="All Support Tickets"
          subtitle="Manage member requests and track ticket resolution."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] px-3 py-2">
                <Filter className="h-3.5 w-3.5 text-[#634F40]/50" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-[12px] text-[#420060] outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === "all" ? "All Status" : s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] px-3 py-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-transparent text-[12px] text-[#420060] outline-none"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p === "all" ? "All Priority" : p}</option>
                  ))}
                </select>
              </div>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Headphones}
              title="No tickets found"
              description={tickets.length === 0 ? "No support tickets have been submitted yet." : "No tickets match the selected filters."}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} onSelect={setSelected} />
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </section>
  )
}
