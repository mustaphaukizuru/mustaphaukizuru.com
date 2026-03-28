import { useEffect, useState } from "react"
import {
  Headphones,
  Plus,
  MessageSquare,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
} from "lucide-react"
import { EmptyState, SectionCard, StatusBadge, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Member support ticket page
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  low: "bg-[#eef3fb] text-[#2f5ea8]",
  medium: "bg-[#fff3e2] text-[#b46909]",
  high: "bg-red-50 text-red-600",
}

function TicketCard({ ticket, onSelect }) {
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
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {ticket.priority}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#634F40]/60">
          <span>Ticket #{ticket.ticketNumber || ticket.id?.slice(0, 8)}</span>
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

function CreateTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ subject: "", message: "", priority: "medium" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!form.subject.trim() || !form.message.trim()) {
      setError("Subject and message are required.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await authFetch("/api/member/support/tickets", {
        method: "POST",
        body: JSON.stringify(form),
      })
      onCreated(res.data)
    } catch (err) {
      setError(err.message || "Failed to create ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[520px] rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_30px_80px_rgba(66,0,96,0.18)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-[#420060]">Open Support Ticket</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/10 text-[#634F40]/60 transition hover:bg-[#f4eef6] hover:text-[#420060]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">
              Subject
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Brief description of your issue"
              className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/10 placeholder:text-[#634F40]/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">
              Priority
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">
              Message
            </label>
            <textarea
              rows={5}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Describe your issue in detail..."
              className="w-full resize-none rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/10 placeholder:text-[#634F40]/40"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#420060] py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#634F40]/15 px-5 py-3 text-[13px] font-medium text-[#634F40] transition hover:bg-[#f4eef6]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function TicketThread({ ticket, onClose }) {
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/member/support/tickets/${ticket.id}`)
        setMessages(res.data?.messages || [])
      } catch {
        // silently fail — ticket data already shown
      }
    }
    load()
  }, [ticket.id])

  async function handleReply() {
    if (!reply.trim()) return
    setSending(true)
    setError("")
    try {
      const res = await authFetch(`/api/member/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply }),
      })
      setMessages((prev) => [...prev, res.data])
      setReply("")
    } catch (err) {
      setError(err.message || "Failed to send reply.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#634F40]/50">
            Ticket #{ticket.ticketNumber || ticket.id?.slice(0, 8)}
          </div>
          <h3 className="mt-1 text-[18px] font-semibold text-[#420060]">{ticket.subject}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-[#634F40]/10 p-2 text-[#634F40]/50 transition hover:bg-[#f4eef6] hover:text-[#420060]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
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
                {msg.isAdmin ? "Support Team" : "You"}
              </span>
              <span className="text-[11px] text-[#634F40]/50">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="leading-6">{msg.message}</div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && ticket.status !== "resolved" && (
        <div className="mt-5">
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply..."
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
      )}
    </div>
  )
}

export default function DashboardSupportPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  async function loadTickets() {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch("/api/member/support/tickets")
      setTickets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || "Failed to load tickets.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTickets() }, [])

  function handleCreated(ticket) {
    setShowCreate(false)
    setTickets((prev) => [ticket, ...prev])
    setSelected(ticket)
  }

  const open = tickets.filter((t) => t.status === "open").length
  const resolved = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[280px]" />
      </section>
    )
  }

  return (
    <>
      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <section className="space-y-5">

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="text-[12px] font-medium text-[#634F40]/70">Total Tickets</div>
            <div className="mt-2 text-[28px] font-bold text-[#420060]">{tickets.length}</div>
            <div className="mt-2 text-[12px] text-[#634F40]/60">All support requests</div>
          </div>
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="text-[12px] font-medium text-[#634F40]/70">Open</div>
            <div className="mt-2 text-[28px] font-bold text-[#b46909]">{open}</div>
            <div className="mt-2 text-[12px] text-[#634F40]/60">Awaiting response</div>
          </div>
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="text-[12px] font-medium text-[#634F40]/70">Resolved</div>
            <div className="mt-2 text-[28px] font-bold text-[#3b8f47]">{resolved}</div>
            <div className="mt-2 text-[12px] text-[#634F40]/60">Closed tickets</div>
          </div>
        </div>

        {/* Thread view or ticket list */}
        {selected ? (
          <TicketThread ticket={selected} onClose={() => setSelected(null)} />
        ) : (
          <SectionCard
            title="Support Tickets"
            subtitle="All your support requests and their current status."
            action={
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]"
              >
                <Plus className="h-4 w-4" />
                New Ticket
              </button>
            }
          >
            {tickets.length === 0 ? (
              <EmptyState
                icon={Headphones}
                title="No support tickets yet"
                description="Having an issue? Open a ticket and our team will get back to you."
                action={
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]"
                  >
                    <Plus className="h-4 w-4" />
                    Open a Ticket
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onSelect={setSelected} />
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </section>
    </>
  )
}
