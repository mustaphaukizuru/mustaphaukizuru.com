// ─────────────────────────────────────────────────────────────────────────────
// AdminConsultationsPage.jsx — list, filter, and manage all bookings
//
// Distinct from /admin/availability which manages the *rules* (recurring slots,
// exceptions). This page manages the actual *bookings* — who booked what time,
// can the admin cancel on behalf of a client, mark no-show, mark completed.
//
// Backend:
//   GET   /api/v1/admin/consultations[?status=...&from=...&to=...]
//   PATCH /api/v1/admin/consultations/:id   (status, notes, cancellationReason)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar, Clock, Mail, ExternalLink, AlertCircle, CheckCircle2,
  XCircle, RefreshCw, Loader2, Filter, Globe2,
} from "lucide-react"
import {
  adminListConsultations,
  adminUpdateConsultation,
  formatDateTime,
  formatLongDate,
  formatTime,
  getBrowserTimezone,
} from "../services/bookingService"
import { useToast } from "../context/ToastContext"

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const STATUS_FILTERS = [
  { value: "", label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
]

const STATUS_STYLE = {
  pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Pending" },
  confirmed: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "Confirmed" },
  scheduled: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "Scheduled" },
  completed: { bg: "bg-[#E0F2FE]", text: "text-[#075985]", label: "Completed" },
  cancelled: { bg: "bg-[#EFF1F5]", text: "text-[#475569]", label: "Cancelled" },
  rescheduled: { bg: "bg-[#EFF1F5]", text: "text-[#475569]", label: "Rescheduled" },
  no_show: { bg: "bg-[#FFE4E6]", text: "text-[#9F1239]", label: "No-show" },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "bg-[#EFF1F5]", text: "text-[#475569]", label: status || "-" }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default function AdminConsultationsPage() {
  const toast = useToast()
  const tz = useMemo(() => getBrowserTimezone(), [])

  const [statusFilter, setStatusFilter] = useState("")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState(null) // id being patched

  const refresh = async () => {
    setLoading(true); setError("")
    try {
      const r = await adminListConsultations(statusFilter ? { status: statusFilter } : {})
      setItems(Array.isArray(r?.data) ? r.data : [])
    } catch (e) {
      setError(e?.message || "Could not load consultations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [statusFilter])

  async function patchStatus(id, nextStatus, extra = {}) {
    if (!id || !nextStatus) return
    try {
      setUpdating(id)
      const updated = await adminUpdateConsultation(id, { status: nextStatus, ...extra })
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
      toast?.show?.({ type: "success", title: "Booking updated", message: `Marked ${nextStatus.replace(/_/g, " ")}` })
    } catch (e) {
      toast?.show?.({ type: "error", title: "Update failed", message: e?.message || "Try again" })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2 text-[12px] text-[#475569]">
          <Globe2 className="h-3.5 w-3.5" /> Times shown in <span className="font-mono font-semibold text-[#1A1B23]">{tz}</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#5D3FD3]" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#DCDCE4] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1B23] outline-none transition focus:border-[#5D3FD3]"
          >
            {STATUS_FILTERS.map((f) => <option key={f.value || "all"} value={f.value}>{f.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCDCE4] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1B23] transition hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#FFE4E6] bg-[#FFE4E6]/30 px-4 py-3 text-[13px] text-[#9F1239]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table, desktop · cards, mobile */}
      <div className="overflow-hidden rounded-xl border border-[#EFF1F5] bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-[#5D3FD3]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDE9FB] text-[#5D3FD3]">
              <Calendar className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-[#1A1B23]">No consultations match this filter</p>
            <p className="max-w-xs text-[12px] text-[#64748B]">
              When a client books a slot from <code className="font-mono text-[11px]">/book</code>, it appears here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left lg:table">
              <thead className="border-b border-[#EFF1F5] bg-[#F8FAFC]/60">
                <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF1F5] text-[13px]">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-[#1A1B23]">{formatLongDate(c.scheduledAt, c.timezone)}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[#64748B]">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatTime(c.scheduledAt, c.timezone)} · {c.durationMin || 30}min
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-[#5D3FD3]">{c.user?.fullName || c.user?.email || "-"}</div>
                      {c.user?.email && (
                        <a href={`mailto:${c.user.email}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#0284C7] hover:underline">
                          <Mail className="h-3 w-3" aria-hidden="true" /> {c.user.email}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-[#1A1B23]/85">
                      {c.service?.title || c.serviceTitle || "Discovery call"}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-5 py-3 align-top">
                      <RowActions
                        consultation={c}
                        updating={updating === c.id}
                        onPatch={(status, extra) => patchStatus(c.id, status, extra)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-[#EFF1F5] lg:hidden">
              {items.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#1A1B23]">{formatDateTime(c.scheduledAt, c.timezone)}</div>
                      <div className="mt-0.5 truncate text-[12px] text-[#5D3FD3]">{c.user?.fullName || c.user?.email || "-"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#64748B]">{c.service?.title || c.serviceTitle || "Discovery call"}</div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                  <RowActions
                    consultation={c}
                    updating={updating === c.id}
                    onPatch={(status, extra) => patchStatus(c.id, status, extra)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RowActions — status transitions allowed for the given booking
// ─────────────────────────────────────────────────────────────────────────────
function RowActions({ consultation, updating, onPatch }) {
  const status = consultation.status
  const meetingLink = consultation.meetingLink
  const isFinal = ["cancelled", "completed", "no_show"].includes(status)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {meetingLink && (
        <a
          href={meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#DCDCE4] bg-white px-2 py-1 text-[11px] font-semibold text-[#0284C7] transition hover:bg-[#E0F2FE]"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Meeting
        </a>
      )}
      {!isFinal && (
        <>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("confirmed", { confirmedAt: new Date().toISOString() })}
            className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/30 bg-[#D1FAE5] px-2 py-1 text-[11px] font-semibold text-[#065F46] transition hover:bg-[#10B981]/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Confirm
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("completed", { completedAt: new Date().toISOString() })}
            className="inline-flex items-center gap-1 rounded-md border border-[#0284C7]/30 bg-[#E0F2FE] px-2 py-1 text-[11px] font-semibold text-[#075985] transition hover:bg-[#0284C7]/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Done
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("no_show")}
            className="inline-flex items-center gap-1 rounded-md border border-[#E11D48]/30 bg-[#FFE4E6] px-2 py-1 text-[11px] font-semibold text-[#9F1239] transition hover:bg-[#E11D48]/20 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" aria-hidden="true" /> No-show
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              const reason = window.prompt("Cancellation reason (optional, shown to client):") || ""
              onPatch("cancelled", { cancellationReason: reason, cancelledAt: new Date().toISOString() })
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[#DCDCE4] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" aria-hidden="true" /> Cancel
          </button>
        </>
      )}
      {updating && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5D3FD3]" aria-hidden="true" />
      )}
    </div>
  )
}
