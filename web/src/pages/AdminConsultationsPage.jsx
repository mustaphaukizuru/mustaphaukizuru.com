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
  adminRegenerateConsultationLink,
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
  pending: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
  confirmed: { bg: "bg-mint-50", text: "text-mint-700", label: "Confirmed" },
  scheduled: { bg: "bg-mint-50", text: "text-mint-700", label: "Scheduled" },
  completed: { bg: "bg-azure-pale", text: "text-azure-800", label: "Completed" },
  cancelled: { bg: "bg-slate-100", text: "text-steel-700", label: "Cancelled" },
  rescheduled: { bg: "bg-slate-100", text: "text-steel-700", label: "Rescheduled" },
  no_show: { bg: "bg-rose-50", text: "text-rose-700", label: "No-show" },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "bg-slate-100", text: "text-steel-700", label: status || "-" }
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

  // Re-runs the Google Calendar + Meet provisioner on a single booking.
  // Used when a confirmed booking lacks a meetingLink because Google was
  // misconfigured at booking time. The backend short-circuits with 409 +
  // diagnostic if Google is STILL misconfigured — we surface that text
  // verbatim so the admin sees exactly what to fix.
  async function regenerateLink(id) {
    if (!id) return
    try {
      setUpdating(id)
      const updated = await adminRegenerateConsultationLink(id)
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
      toast?.show?.({
        type:  updated?.meetingLink ? "success" : "warning",
        title: updated?.meetingLink ? "Meeting link generated" : "Provisioner ran",
        message: updated?.meetingLink
          ? "Google Meet link saved on this booking."
          : "Google did not return a link — check server logs.",
      })
    } catch (e) {
      toast?.show?.({
        type:    "error",
        title:   "Could not regenerate link",
        message: e?.message || "Try again, or check that the Google refresh token is valid.",
      })
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
        <div className="flex items-center gap-2 text-[12px] text-steel-700">
          <Globe2 className="h-3.5 w-3.5" /> Times shown in <span className="font-mono font-semibold text-charcoal">{tz}</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-violet" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-charcoal outline-none transition focus:border-violet"
          >
            {STATUS_FILTERS.map((f) => <option key={f.value || "all"} value={f.value}>{f.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-charcoal transition hover:bg-mist disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-50 bg-rose-50/30 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table, desktop · cards, mobile */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-violet">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <Calendar className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-charcoal">No consultations match this filter</p>
            <p className="max-w-xs text-[12px] text-steel">
              When a client books a slot from <code className="font-mono text-[11px]">/book</code>, it appears here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left lg:table">
              <thead className="border-b border-slate-100 bg-mist/60">
                <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-steel">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-charcoal">{formatLongDate(c.scheduledAt, c.timezone)}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-steel">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatTime(c.scheduledAt, c.timezone)} · {c.durationMin || 30}min
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-violet">{c.user?.fullName || c.user?.email || "-"}</div>
                      {c.user?.email && (
                        <a href={`mailto:${c.user.email}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-azure hover:underline">
                          <Mail className="h-3 w-3" aria-hidden="true" /> {c.user.email}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-charcoal/85">
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
                        onRegenerateLink={() => regenerateLink(c.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {items.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-charcoal">{formatDateTime(c.scheduledAt, c.timezone)}</div>
                      <div className="mt-0.5 truncate text-[12px] text-violet">{c.user?.fullName || c.user?.email || "-"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-steel">{c.service?.title || c.serviceTitle || "Discovery call"}</div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                  <RowActions
                    consultation={c}
                    updating={updating === c.id}
                    onPatch={(status, extra) => patchStatus(c.id, status, extra)}
                    onRegenerateLink={() => regenerateLink(c.id)}
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
function RowActions({ consultation, updating, onPatch, onRegenerateLink }) {
  const status = consultation.status
  const meetingLink = consultation.meetingLink
  const isFinal = ["cancelled", "completed", "no_show"].includes(status)
  // Surface the "needs a link" state on any non-final booking. Lets the
  // admin spot stuck bookings at a glance and click to retry the Google
  // provisioner without having to PATCH the row manually.
  const linkPending = !meetingLink && !isFinal

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {meetingLink && (
        <a
          href={meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-azure transition hover:bg-azure-pale"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Meeting
        </a>
      )}
      {linkPending && (
        <button
          type="button"
          disabled={updating}
          onClick={onRegenerateLink}
          title="Re-run the Google Calendar + Meet provisioner for this booking"
          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Generate link
        </button>
      )}
      {!isFinal && (
        <>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("confirmed", { confirmedAt: new Date().toISOString() })}
            className="inline-flex items-center gap-1 rounded-md border border-mint/30 bg-mint-50 px-2 py-1 text-[11px] font-semibold text-mint-700 transition hover:bg-mint/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Confirm
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("completed", { completedAt: new Date().toISOString() })}
            className="inline-flex items-center gap-1 rounded-md border border-azure/30 bg-azure-pale px-2 py-1 text-[11px] font-semibold text-azure-800 transition hover:bg-azure/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Done
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("no_show")}
            className="inline-flex items-center gap-1 rounded-md border border-rose/30 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose/20 disabled:opacity-50"
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
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-steel-700 transition hover:bg-mist disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" aria-hidden="true" /> Cancel
          </button>
        </>
      )}
      {updating && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" aria-hidden="true" />
      )}
    </div>
  )
}
