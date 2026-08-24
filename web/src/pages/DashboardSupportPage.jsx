import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Headphones, Plus, MessageSquare, Clock3, CheckCircle2,
  AlertCircle, Send, X,
} from "lucide-react"
import { EmptyState, SectionCard, StatusBadge, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"
import useApiQuery from "../hooks/useApiQuery"

// ─────────────────────────────────────────────────────────────────────────────
// Member support ticket page · I18N · Phase 119C — strings under
// `dashboard.support.*`. Sub-components (TicketCard, CreateTicketModal,
// TicketThread) each scope their own useTranslation hook. Status enum
// values stay untranslated — StatusBadge renders the canonical chip.
// ─────────────────────────────────────────────────────────────────────────────

// Brand v3 §05 — semantic feedback colors are sacred. low/medium/high
// map to the canonical info/warning/error tiers using azure-pale + amber
// + rose tokens instead of ad-hoc Tailwind hex values.
const PRIORITY_COLORS = {
  low: "bg-azure-pale text-azure-800",
  medium: "bg-amber/12 text-amber-700",
  high: "bg-rose/10 text-rose-700",
}

function TicketCard({ ticket, onSelect }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const messageCount = ticket._count?.messages
  return (
    <button
      type="button"
      onClick={() => onSelect(ticket)}
      className="flex w-full items-start gap-4 rounded-xl border border-charcoal-80/10 bg-mist p-4 text-left transition hover:border-violet/20 hover:bg-violet-ghost"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
        <MessageSquare className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="text-meta font-semibold text-violet">{ticket.subject}</div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-micro font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
              {ticket.priority}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/60">
          <span>{t("support.list.ticketNumber", { number: ticket.ticketNumber || ticket.id?.slice(0, 8) })}</span>
          <span>·</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString(localeTag)}</span>
          {messageCount != null && (
            <>
              <span>·</span>
              <span>{t("support.list.messages", { count: messageCount })}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

function CreateTicketModal({ onClose, onCreated }) {
  const { t } = useTranslation("dashboard")
  const [form, setForm] = useState({ subject: "", message: "", priority: "medium" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!form.subject.trim() || !form.message.trim()) {
      setError(t("support.errors.subjectMessageRequired"))
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
      setError(err.message || t("support.errors.createTicket"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[520px] rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_30px_80px_rgb(var(--color-violet-rgb)/0.18)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-subsection font-bold text-violet">{t("support.create.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-charcoal-80/10 text-charcoal-80/60 transition hover:bg-violet-pale/60 hover:text-violet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2.5 text-micro text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-micro font-semibold text-violet">
              {t("support.create.subjectLabel")}
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder={t("support.create.subjectPlaceholder")}
              className="w-full rounded-xl border border-charcoal-80/20 bg-mist px-4 py-3 text-meta text-violet outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-charcoal-80/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-micro font-semibold text-violet">
              {t("support.create.priorityLabel")}
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full rounded-xl border border-charcoal-80/20 bg-mist px-4 py-3 text-meta text-violet outline-none focus:border-violet/40"
            >
              <option value="low">{t("support.create.priorityLow")}</option>
              <option value="medium">{t("support.create.priorityMedium")}</option>
              <option value="high">{t("support.create.priorityHigh")}</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-micro font-semibold text-violet">
              {t("support.create.messageLabel")}
            </label>
            <textarea
              rows={5}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder={t("support.create.messagePlaceholder")}
              className="w-full resize-none rounded-xl border border-charcoal-80/20 bg-mist px-4 py-3 text-meta text-violet outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-charcoal-80/40"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet py-3 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? t("support.create.submitting") : t("support.create.submit")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-charcoal-80/15 px-5 py-3 text-meta font-medium text-charcoal-80 transition hover:bg-violet-pale/60"
          >
            {t("support.create.cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

function TicketThread({ ticket, onClose }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
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
      setError(err.message || t("support.errors.sendReply"))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-micro font-semibold uppercase tracking-[0.12em] text-charcoal-80/50">
            {t("support.thread.ticketNumberLabel", { number: ticket.ticketNumber || ticket.id?.slice(0, 8) })}
          </div>
          <h3 className="mt-1 text-card font-semibold text-violet">{ticket.subject}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-charcoal-80/10 p-2 text-charcoal-80/50 transition hover:bg-violet-pale/60 hover:text-violet"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2 text-micro text-rose-700">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-violet/20 bg-violet-pale/30 p-4 text-micro text-charcoal-80/60">
            {t("support.thread.noMessages")}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 text-meta ${
              msg.isAdmin
                ? "border border-violet/15 bg-violet-ghost text-violet"
                : "border border-charcoal-80/10 bg-mist text-charcoal-80"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-micro font-semibold">
                {msg.isAdmin ? t("support.thread.supportTeam") : t("support.thread.you")}
              </span>
              <span className="text-micro text-charcoal-80/50">
                {new Date(msg.createdAt).toLocaleString(localeTag)}
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
            placeholder={t("support.thread.replyPlaceholder")}
            className="w-full resize-none rounded-xl border border-charcoal-80/20 bg-mist px-4 py-3 text-meta text-violet outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-charcoal-80/40"
          />
          <button
            type="button"
            onClick={handleReply}
            disabled={sending || !reply.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? t("support.thread.sending") : t("support.thread.send")}
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardSupportPage() {
  const { t } = useTranslation("dashboard")
  const { data: tickets = [], loading, error, setData: setTickets } = useApiQuery(
    "support:tickets",
    () => authFetch("/api/member/support/tickets"),
    { select: (res) => (Array.isArray(res?.data) ? res.data : []) }
  )
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  function handleCreated(ticket) {
    setShowCreate(false)
    setTickets((prev = []) => [ticket, ...prev])
    setSelected(ticket)
  }

  const open = tickets.filter((tx) => tx.status === "open").length
  const resolved = tickets.filter((tx) => ["resolved", "closed"].includes(tx.status)).length

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
          <div className="flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="text-micro font-medium text-charcoal-80/70">{t("support.metrics.totalTitle")}</div>
            <div className="mt-2 text-page font-bold text-violet">{tickets.length}</div>
            <div className="mt-2 text-micro text-charcoal-80/60">{t("support.metrics.totalSubtitle")}</div>
          </div>
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="text-micro font-medium text-charcoal-80/70">{t("support.metrics.openTitle")}</div>
            <div className="mt-2 text-page font-bold text-amber-700">{open}</div>
            <div className="mt-2 text-micro text-charcoal-80/60">{t("support.metrics.openSubtitle")}</div>
          </div>
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="text-micro font-medium text-charcoal-80/70">{t("support.metrics.resolvedTitle")}</div>
            <div className="mt-2 text-page font-bold text-mint-800">{resolved}</div>
            <div className="mt-2 text-micro text-charcoal-80/60">{t("support.metrics.resolvedSubtitle")}</div>
          </div>
        </div>

        {/* Thread view or ticket list */}
        {selected ? (
          <TicketThread ticket={selected} onClose={() => setSelected(null)} />
        ) : (
          <SectionCard
            title={t("support.list.title")}
            subtitle={t("support.list.subtitle")}
            action={
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep"
              >
                <Plus className="h-4 w-4" />
                {t("support.list.newTicket")}
              </button>
            }
          >
            {tickets.length === 0 ? (
              <EmptyState
                icon={Headphones}
                title={t("support.empty.title")}
                description={t("support.empty.body")}
                action={
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep"
                  >
                    <Plus className="h-4 w-4" />
                    {t("support.empty.openCta")}
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
