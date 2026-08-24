// ─────────────────────────────────────────────────────────────────────────────
// AdminServiceOrderDetailPage — single service-order admin view.
//
// Wired to: /admin/service-orders/:id (route in App.jsx).
// Backend:  GET /api/v1/admin/service-orders/:id      (adminGetServiceOrder)
//           PATCH /api/v1/admin/service-orders/:id    (adminUpdateServiceOrder)
//
// Scope (Phase 1): read-only header + client/service summary + status
// transition controls + internal-notes editor. Project bootstrap and
// consultation scheduling live behind their own buttons but call existing
// service helpers — Phase 6 will turn that into a full project workspace.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { m } from "framer-motion"
import {
  ArrowLeft, Briefcase, Loader2, AlertCircle, Mail, Calendar, Save,
  CheckCircle2, XCircle, ExternalLink, FileText,
} from "lucide-react"
import {
  adminGetServiceOrder,
  adminUpdateServiceOrder,
} from "../services/serviceOrderService"
import { useToast } from "../context/ToastContext"

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const STATUS_TRANSITIONS = [
  { value: "in_progress", label: "Start", tone: "azure" },
  { value: "delivered", label: "Mark delivered", tone: "mint" },
  { value: "completed", label: "Complete", tone: "mint" },
  { value: "cancelled", label: "Cancel", tone: "neutral" },
]

const TONE = {
  azure: "border-azure/30 bg-azure-pale text-azure-800 hover:bg-azure/20",
  mint: "border-mint/30 bg-mint-50 text-mint-700 hover:bg-mint/20",
  neutral: "border-slate-200 bg-white text-steel-700 hover:bg-mist",
}

const STATUS_PILL = {
  pending: "bg-amber/10 text-amber-700",
  in_progress: "bg-azure-pale text-azure-800",
  delivered: "bg-mint-50 text-mint-700",
  completed: "bg-mint-50 text-mint-700",
  cancelled: "bg-slate-100 text-steel-700",
  refunded: "bg-rose-50 text-rose-700",
}

function formatDate(iso) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return "—" }
}

function formatMoney(value, currency = "MXN") {
  if (value == null) return "—"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value))
  } catch { return `$${Number(value).toFixed(2)}` }
}

export default function AdminServiceOrderDetailPage() {
  const { id } = useParams()
  const { showSuccess, showError } = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    ;(async () => {
      setLoading(true); setError("")
      try {
        const data = await adminGetServiceOrder(id)
        if (cancelled) return
        setOrder(data || null)
        setNotes(data?.internalNotes || "")
      } catch (e) {
        if (!cancelled) setError(e?.toUserMessage?.() || e?.message || "Could not load service order")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  async function patchStatus(nextStatus) {
    if (!id || !nextStatus) return
    try {
      setUpdating(true)
      const updated = await adminUpdateServiceOrder(id, { status: nextStatus })
      setOrder((prev) => (prev ? { ...prev, ...updated } : updated))
      showSuccess?.(`Status: ${nextStatus.replace(/_/g, " ")}`, "Order updated")
    } catch (e) {
      showError?.(e?.toUserMessage?.() || e?.message || "Try again", "Update failed")
    } finally {
      setUpdating(false)
    }
  }

  async function saveNotes() {
    if (!id) return
    try {
      setSavingNotes(true)
      const updated = await adminUpdateServiceOrder(id, { internalNotes: notes })
      setOrder((prev) => (prev ? { ...prev, ...updated } : updated))
      showSuccess?.("Internal notes saved")
    } catch (e) {
      showError?.(e?.toUserMessage?.() || e?.message || "Try again", "Save failed")
    } finally {
      setSavingNotes(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet" aria-hidden="true" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/service-orders"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-steel-700 transition hover:text-violet"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to service orders
        </Link>
        <div className="flex items-start gap-2 rounded-xl border border-rose-50 bg-rose-50/30 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error || "Service order not found."}</span>
        </div>
      </div>
    )
  }

  const status = order.status || "pending"
  const isFinal = ["completed", "cancelled", "refunded"].includes(status)
  const orderRef = `#${String(order.id).slice(-12).toUpperCase()}`

  return (
    <m.div variants={fadeUp} initial="hidden" animate="show" className="space-y-6">
      <Link
        to="/admin/service-orders"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-steel-700 transition hover:text-violet"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to service orders
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-steel">Service order</p>
            <h1 className="mt-1 flex items-center gap-2 font-mono text-[20px] font-bold text-violet">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              {orderRef}
            </h1>
            <p className="mt-1 text-[12px] text-steel">Created {formatDate(order.createdAt)}</p>
          </div>
          <span className={`inline-flex items-center self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_PILL[status] || "bg-slate-100 text-steel-700"}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Client */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <h2 className="text-[14px] font-bold text-charcoal">Client</h2>
          <div className="mt-3 space-y-1.5 text-[13px] text-charcoal">
            <div className="font-semibold text-violet">
              {order.user?.fullName || order.user?.email || order.contactEmail || "—"}
            </div>
            {order.user?.email && (
              <a href={`mailto:${order.user.email}`} className="inline-flex items-center gap-1 text-[12px] text-azure hover:underline">
                <Mail className="h-3 w-3" aria-hidden="true" /> {order.user.email}
              </a>
            )}
            {order.contactPhone && (
              <div className="text-[12px] text-steel-700">{order.contactPhone}</div>
            )}
          </div>
        </div>

        {/* Service */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <h2 className="text-[14px] font-bold text-charcoal">Service</h2>
          <div className="mt-3 space-y-1.5 text-[13px]">
            <div className="font-semibold text-charcoal">{order.service?.title || order.serviceTitle || "—"}</div>
            {order.servicePackage?.name && (
              <div className="text-[12px] text-steel">{order.servicePackage.name}</div>
            )}
            <div className="font-mono text-[14px] tabular-nums font-bold text-charcoal">
              {formatMoney(order.totalAmount ?? order.amount, order.currency)}
            </div>
            {order.paidAt && (
              <div className="inline-flex items-center gap-1 text-[12px] text-mint-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Paid {formatDate(order.paidAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status actions */}
      {!isFinal && (
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <h2 className="text-[14px] font-bold text-charcoal">Update status</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {STATUS_TRANSITIONS
              .filter((t) => t.value !== status)
              .map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={updating}
                  onClick={() => patchStatus(t.value)}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${TONE[t.tone]}`}
                >
                  {t.value === "cancelled" ? <XCircle className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                  {t.label}
                </button>
              ))}
            {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" aria-hidden="true" />}
          </div>
        </div>
      )}

      {/* Project link or placeholder */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <h2 className="text-[14px] font-bold text-charcoal">Project workspace</h2>
        {order.projectId ? (
          <a
            href={`/dashboard/projects/${order.projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-azure transition hover:bg-azure-pale"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Open project
          </a>
        ) : (
          <p className="mt-3 text-[12px] text-steel">
            No project workspace yet. Phase 6 will spin one up automatically when an order is confirmed.
          </p>
        )}
      </div>

      {/* Consultation summary (read-only here; scheduling lives in /admin/consultations) */}
      {order.consultations && order.consultations.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <h2 className="text-[14px] font-bold text-charcoal">Consultations</h2>
          <ul className="mt-3 space-y-2 text-[12px] text-steel-700">
            {order.consultations.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                <span>{formatDate(c.scheduledAt || c.startsAt)}</span>
                {c.status && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{c.status}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Internal notes */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-charcoal">
            <FileText className="h-4 w-4 text-violet" aria-hidden="true" />
            Internal notes
          </h2>
          <button
            type="button"
            disabled={savingNotes}
            onClick={saveNotes}
            className="inline-flex items-center gap-1 rounded-md border border-violet/30 bg-violet-pale px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet/15 disabled:opacity-50"
          >
            {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Save className="h-3 w-3" aria-hidden="true" />}
            Save
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Operator-only notes — not visible to the client."
          className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-charcoal outline-none transition focus:border-violet"
        />
      </div>
    </m.div>
  )
}
